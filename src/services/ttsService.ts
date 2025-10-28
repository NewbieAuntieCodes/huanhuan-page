import { VoiceLibraryRowState } from '../features/voiceLibrary/hooks/useVoiceLibrary';

const TTS_API_BASE_URL = 'http://127.0.0.1:8000/api';
export const TTS_SERVER_ORIGIN = 'http://127.0.0.1:8000';

export const checkTtsServerHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${TTS_API_BASE_URL}/health`);
        const data = await response.json();
        return response.ok && data.ok;
    } catch (error) {
        return false;
    }
};

export const uploadTtsPrompt = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${TTS_API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        throw new Error(`上传失败: ${response.statusText}`);
    }
    const data = await response.json();
    return data.filePath;
};

interface TtsBatchItem {
    promptAudio: string | null;
    text: string;
}

interface TtsBatchResultItem {
    ok: boolean;
    audioUrl?: string;
    error?: string;
}

export const generateTtsBatch = async (items: TtsBatchItem[]): Promise<TtsBatchResultItem[]> => {
    const response = await fetch(`${TTS_API_BASE_URL}/batch-tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            items: items.map(item => ({
                promptAudio: item.promptAudio,
                text: item.text
            })),
            options: { do_sample: true, top_p: 0.8 } 
        }),
    });
    if (!response.ok) {
        throw new Error(`批量生成失败: ${response.statusText}`);
    }
    const result = await response.json();
    return result.items as TtsBatchResultItem[];
};
