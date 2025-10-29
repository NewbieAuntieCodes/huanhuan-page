import { ScriptLine, Project, Character, LineType, SilencePairing } from '../types';
import { defaultSilenceSettings } from './defaultSilenceSettings';

interface LineWithAudio {
    line: ScriptLine;
    audioBlob: Blob;
}

const TARGET_SAMPLE_RATE = 44100;
const TARGET_CHANNELS = 1; // Mono
const TARGET_BIT_DEPTH = 16;

// Helper function to write a string to a DataView
function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

// Resample and convert an AudioBuffer to a Float32Array in the target format
async function processAudioBuffer(buffer: AudioBuffer): Promise<Float32Array> {
    if (buffer.sampleRate === TARGET_SAMPLE_RATE && buffer.numberOfChannels === TARGET_CHANNELS) {
        return buffer.getChannelData(0);
    }

    const offlineCtx = new OfflineAudioContext(
        TARGET_CHANNELS,
        (buffer.duration * TARGET_SAMPLE_RATE),
        TARGET_SAMPLE_RATE
    );
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    
    const resampledBuffer = await offlineCtx.startRendering();
    return resampledBuffer.getChannelData(0);
}

const getLineType = (line: ScriptLine | undefined, characters: Character[]): LineType => {
    if (!line || !line.characterId) return 'narration';
    const character = characters.find(c => c.id === line.characterId);
    if (!character || character.name === 'Narrator' || character.name === '[静音]') return 'narration';
    if (character.name === '音效') return 'sfx';
    return 'dialogue';
};


// FIX: The `characters` property does not exist on the `Project` type. It is now passed as a separate argument.
export async function exportAudioWithMarkers(linesWithAudio: LineWithAudio[], project: Project, characters: Character[]): Promise<Blob> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const { silenceSettings = defaultSilenceSettings } = project;

    try {
        const decodedBuffers = await Promise.all(
            linesWithAudio.map(item => item.audioBlob.arrayBuffer().then(ab => audioContext.decodeAudioData(ab)))
        );

        const cuePoints: number[] = [];
        let totalSamples = 0;
        const processedPcmData: Float32Array[] = [];
        
        // Add start padding
        if (silenceSettings.startPadding > 0) {
            const startPaddingSamples = Math.floor(silenceSettings.startPadding * TARGET_SAMPLE_RATE);
            processedPcmData.push(new Float32Array(startPaddingSamples).fill(0));
            totalSamples += startPaddingSamples;
        }

        for (let i = 0; i < decodedBuffers.length; i++) {
            const buffer = decodedBuffers[i];
            const item = linesWithAudio[i];

            cuePoints.push(totalSamples);
            const pcm = await processAudioBuffer(buffer);
            processedPcmData.push(pcm);
            totalSamples += pcm.length;

            let silenceDuration = 0;
            if (item.line.postSilence !== undefined && item.line.postSilence !== null) {
                silenceDuration = item.line.postSilence;
            } else {
                if (i === linesWithAudio.length - 1) {
                    silenceDuration = silenceSettings.endPadding;
                } else {
                    const nextItem = linesWithAudio[i + 1];
                    const currentLineType = getLineType(item.line, characters);
                    const nextLineType = getLineType(nextItem.line, characters);
                    const pairKey = `${currentLineType}-to-${nextLineType}` as SilencePairing;
                    silenceDuration = silenceSettings.pairs[pairKey] ?? 1.0; 
                }
            }
            
            if (silenceDuration > 0) {
                const silenceSamples = Math.floor(silenceDuration * TARGET_SAMPLE_RATE);
                const silencePcm = new Float32Array(silenceSamples).fill(0);
                processedPcmData.push(silencePcm);
                totalSamples += silenceSamples;
            }
        }

        const concatenatedPcm16 = new Int16Array(totalSamples);
        let offset = 0;
        for (const pcm of processedPcmData) {
            for (let i = 0; i < pcm.length; i++) {
                concatenatedPcm16[offset + i] = Math.max(-1, Math.min(1, pcm[i])) * 32767;
            }
            offset += pcm.length;
        }

        const pcmDataSize = concatenatedPcm16.byteLength;
        const bytesPerSample = TARGET_BIT_DEPTH / 8;

        // Cue chunk
        const cueChunkSize = 4 + (cuePoints.length * 24);
        const cueBuffer = new ArrayBuffer(cueChunkSize);
        const cueView = new DataView(cueBuffer);
        cueView.setUint32(0, cuePoints.length, true);
        cuePoints.forEach((sampleFrame, i) => {
            const cueOffset = 4 + (i * 24);
            cueView.setUint32(cueOffset, i + 1, true); 
            cueView.setUint32(cueOffset + 4, sampleFrame, true);
            writeString(cueView, cueOffset + 8, 'data');
            cueView.setUint32(cueOffset + 12, 0, true);
            cueView.setUint32(cueOffset + 16, 0, true);
            cueView.setUint32(cueOffset + 20, sampleFrame, true);
        });

        // Labels for cue points
        let labelsChunkSize = 0;
        const labelChunks = cuePoints.map((_, i) => {
            const label = (i + 1).toString();
            const dataSize = 4 + label.length + 1;
            const totalChunkSize = 8 + dataSize;
            const paddedChunkSize = totalChunkSize + (totalChunkSize % 2);
            labelsChunkSize += paddedChunkSize;
            return { id: i + 1, text: label, size: paddedChunkSize, dataSize };
        });

        const listChunkSize = 4 + labelsChunkSize;
        const listBuffer = new ArrayBuffer(listChunkSize);
        const listView = new DataView(listBuffer);
        writeString(listView, 0, 'adtl');
        let listOffset = 4;
        labelChunks.forEach(labelInfo => {
            writeString(listView, listOffset, 'labl');
            listView.setUint32(listOffset + 4, labelInfo.dataSize, true);
            listView.setUint32(listOffset + 8, labelInfo.id, true);
            writeString(listView, listOffset + 12, labelInfo.text);
            listView.setUint8(listOffset + 12 + labelInfo.text.length, 0);
            listOffset += labelInfo.size;
        });


        const headerSize = 44;
        const fileSize = headerSize + pcmDataSize + (8 + cueChunkSize) + (8 + listChunkSize);
        const finalBuffer = new ArrayBuffer(fileSize);
        const view = new DataView(finalBuffer);

        let o = 0;
        writeString(view, o, 'RIFF'); o += 4;
        view.setUint32(o, fileSize - 8, true); o += 4;
        writeString(view, o, 'WAVE'); o += 4;
        
        writeString(view, o, 'fmt '); o += 4;
        view.setUint32(o, 16, true); o += 4;
        view.setUint16(o, 1, true); o += 2;
        view.setUint16(o, TARGET_CHANNELS, true); o += 2;
        view.setUint32(o, TARGET_SAMPLE_RATE, true); o += 4;
        view.setUint32(o, TARGET_SAMPLE_RATE * TARGET_CHANNELS * bytesPerSample, true); o += 4;
        view.setUint16(o, TARGET_CHANNELS * bytesPerSample, true); o += 2;
        view.setUint16(o, TARGET_BIT_DEPTH, true); o += 2;

        writeString(view, o, 'data'); o += 4;
        view.setUint32(o, pcmDataSize, true); o += 4;
        new Uint8Array(finalBuffer).set(new Uint8Array(concatenatedPcm16.buffer), o);
        o += pcmDataSize;

        writeString(view, o, 'cue '); o += 4;
        view.setUint32(o, cueChunkSize, true); o += 4;
        new Uint8Array(finalBuffer).set(new Uint8Array(cueBuffer), o);
        o += cueChunkSize;

        writeString(view, o, 'LIST'); o += 4;
        view.setUint32(o, listChunkSize, true); o += 4;
        new Uint8Array(finalBuffer).set(new Uint8Array(listBuffer), o);
        o += listChunkSize;

        return new Blob([view], { type: 'audio/wav' });
    } finally {
        await audioContext.close();
    }
}