import { ScriptLine } from '../types';

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

export async function exportAudioWithMarkers(linesWithAudio: LineWithAudio[]): Promise<Blob> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    try {
        // 1. Decode all audio blobs into AudioBuffers
        const decodedBuffers = await Promise.all(
            linesWithAudio.map(item => item.audioBlob.arrayBuffer().then(ab => audioContext.decodeAudioData(ab)))
        );

        // 2. Process and resample each buffer, and collect cue points
        const cuePoints: number[] = [];
        let totalSamples = 0;
        const processedPcmData: Float32Array[] = [];

        for (const buffer of decodedBuffers) {
            cuePoints.push(totalSamples);
            const pcm = await processAudioBuffer(buffer);
            processedPcmData.push(pcm);
            totalSamples += pcm.length;
        }

        // 3. Concatenate all PCM data and convert to 16-bit Int
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

        // 4. Build WAV file chunks
        // Cue chunk
        const cueChunkSize = 4 + (cuePoints.length * 24);
        const cueBuffer = new ArrayBuffer(cueChunkSize);
        const cueView = new DataView(cueBuffer);
        cueView.setUint32(0, cuePoints.length, true); // Number of cue points
        cuePoints.forEach((sampleFrame, i) => {
            const cueOffset = 4 + (i * 24);
            cueView.setUint32(cueOffset, i + 1, true); // Cue Point ID
            cueView.setUint32(cueOffset + 4, sampleFrame, true); // Position in sample frames
            writeString(cueView, cueOffset + 8, 'data'); // Data Chunk ID
            cueView.setUint32(cueOffset + 12, 0, true); // Chunk Start
            cueView.setUint32(cueOffset + 16, 0, true); // Block Start
            cueView.setUint32(cueOffset + 20, sampleFrame, true); // Sample Offset
        });

        // Labels for cue points
        let labelsChunkSize = 0;
        const labelChunks = cuePoints.map((_, i) => {
            const label = (i + 1).toString();
            // A 'labl' chunk's data section contains: 4-byte cue point ID, N-byte text, 1-byte null terminator.
            const dataSize = 4 + label.length + 1;
            // The total chunk size on disk is the header (8 bytes) + data, with the whole chunk padded to an even size.
            // The size field in the header stores the unpadded dataSize.
            const totalChunkSize = 8 + dataSize;
            const paddedChunkSize = totalChunkSize + (totalChunkSize % 2);
            labelsChunkSize += paddedChunkSize;
            return { id: i + 1, text: label, size: paddedChunkSize, dataSize };
        });

        const listChunkSize = 4 + labelsChunkSize; // 4 for 'adtl' type + total size of all labl chunks.
        const listBuffer = new ArrayBuffer(listChunkSize);
        const listView = new DataView(listBuffer);
        writeString(listView, 0, 'adtl'); // Associated Data List identifier
        let listOffset = 4;
        labelChunks.forEach(labelInfo => {
            writeString(listView, listOffset, 'labl');
            listView.setUint32(listOffset + 4, labelInfo.dataSize, true); // chunk data size (unpadded)
            listView.setUint32(listOffset + 8, labelInfo.id, true); // cue point id
            writeString(listView, listOffset + 12, labelInfo.text);
            listView.setUint8(listOffset + 12 + labelInfo.text.length, 0); // null terminator
            // ArrayBuffer is zero-filled, so padding byte is implicitly zero. Just advance the offset.
            listOffset += labelInfo.size;
        });


        // 5. Assemble the final file
        const headerSize = 44;
        const fileSize = headerSize + pcmDataSize + (8 + cueChunkSize) + (8 + listChunkSize);
        const finalBuffer = new ArrayBuffer(fileSize);
        const view = new DataView(finalBuffer);

        let o = 0;
        // RIFF header
        writeString(view, o, 'RIFF'); o += 4;
        view.setUint32(o, fileSize - 8, true); o += 4;
        writeString(view, o, 'WAVE'); o += 4;
        
        // fmt chunk
        writeString(view, o, 'fmt '); o += 4;
        view.setUint32(o, 16, true); o += 4; // chunk size
        view.setUint16(o, 1, true); o += 2; // PCM format
        view.setUint16(o, TARGET_CHANNELS, true); o += 2;
        view.setUint32(o, TARGET_SAMPLE_RATE, true); o += 4;
        view.setUint32(o, TARGET_SAMPLE_RATE * TARGET_CHANNELS * bytesPerSample, true); o += 4; // byte rate
        view.setUint16(o, TARGET_CHANNELS * bytesPerSample, true); o += 2; // block align
        view.setUint16(o, TARGET_BIT_DEPTH, true); o += 2;

        // data chunk
        writeString(view, o, 'data'); o += 4;
        view.setUint32(o, pcmDataSize, true); o += 4;
        new Uint8Array(finalBuffer).set(new Uint8Array(concatenatedPcm16.buffer), o);
        o += pcmDataSize;

        // cue chunk
        writeString(view, o, 'cue '); o += 4;
        view.setUint32(o, cueChunkSize, true); o += 4;
        new Uint8Array(finalBuffer).set(new Uint8Array(cueBuffer), o);
        o += cueChunkSize;

        // LIST chunk
        writeString(view, o, 'LIST'); o += 4;
        view.setUint32(o, listChunkSize, true); o += 4;
        new Uint8Array(finalBuffer).set(new Uint8Array(listBuffer), o);
        o += listChunkSize;

        return new Blob([view], { type: 'audio/wav' });
    } finally {
        await audioContext.close();
    }
}
