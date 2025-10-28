import { bufferToWav } from './wavEncoder';

/**
 * Splits an audio blob into two parts at a specified time.
 * @param audioBlob The original audio blob.
 * @param splitTime The time in seconds to split the audio.
 * @returns A promise that resolves to an object with part1Blob and part2Blob.
 */
export async function splitAudio(audioBlob: Blob, splitTime: number): Promise<{ part1Blob: Blob; part2Blob: Blob }> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
        const originalBuffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer());

        if (splitTime <= 0.01 || splitTime >= originalBuffer.duration - 0.01) {
            throw new Error("无效的分割时间点。");
        }

        const splitSample = Math.floor(splitTime * originalBuffer.sampleRate);
        const numChannels = originalBuffer.numberOfChannels;

        const part1Buffer = audioContext.createBuffer(numChannels, splitSample, originalBuffer.sampleRate);
        const part2Length = originalBuffer.length - splitSample;
        const part2Buffer = audioContext.createBuffer(numChannels, part2Length, originalBuffer.sampleRate);

        for (let i = 0; i < numChannels; i++) {
            const channelData = originalBuffer.getChannelData(i);
            part1Buffer.copyToChannel(channelData.subarray(0, splitSample), i);
            part2Buffer.copyToChannel(channelData.subarray(splitSample), i);
        }

        const part1Blob = bufferToWav(part1Buffer);
        const part2Blob = bufferToWav(part2Buffer);
        
        return { part1Blob, part2Blob };
    } finally {
        // Ensure AudioContext is closed to release resources
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
}

/**
 * Merges multiple audio blobs into a single audio blob.
 * @param blobs An array of audio blobs to merge in order.
 * @returns A promise that resolves to the merged audio blob.
 */
export async function mergeAudio(blobs: Blob[]): Promise<Blob> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    try {
        if (blobs.length === 0) throw new Error("没有可合并的音频文件。");

        const buffers = await Promise.all(blobs.map(b => b.arrayBuffer().then(ab => audioContext.decodeAudioData(ab))));
        
        if (buffers.length === 0) throw new Error("没有可合并的音频缓冲。");

        const firstBuffer = buffers[0];
        const { sampleRate, numberOfChannels } = firstBuffer;

        if (buffers.some(b => b.sampleRate !== sampleRate || b.numberOfChannels !== numberOfChannels)) {
            throw new Error("音频格式（采样率或声道数）不匹配，无法合并。");
        }

        const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
        const mergedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

        let offset = 0;
        for (const buffer of buffers) {
            for (let i = 0; i < numberOfChannels; i++) {
                mergedBuffer.getChannelData(i).set(buffer.getChannelData(i), offset);
            }
            offset += buffer.length;
        }

        return bufferToWav(mergedBuffer);
    } finally {
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
}
