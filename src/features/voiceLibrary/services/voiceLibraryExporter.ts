import JSZip from 'jszip';
import { db } from '../../../db';
import { exportAudioWithMarkers } from '../../../lib/wavExporter';
import { Project, Character, ScriptLine } from '../../../types';
import { VoiceLibraryRowState } from '../hooks/useVoiceLibrary';

const sanitizeFilename = (name: string): string => {
    const sanitized = name.replace(/[\r\n]/g, ' ').replace(/[<>:"/\\|?*]+/g, '_');
    return sanitized.length > 230 ? sanitized.substring(0, 230) + '...' : sanitized;
};

/**
 * Exports a single marked WAV file for the given rows.
 */
export const exportMarkedWav = async (
    rows: VoiceLibraryRowState[],
    project: Project,
    character: Character,
    generatedAudioUrls: Record<string, string>,
    // FIX: Add `allProjectCharacters` to satisfy the updated signature of `exportAudioWithMarkers`.
    allProjectCharacters: Character[]
): Promise<void> => {
    const rowsToExport = rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId);
    if (rowsToExport.length === 0) {
        alert('没有可导出的音频。');
        return;
    }

    const linesWithAudio: { line: ScriptLine; audioBlob: Blob; }[] = [];
    const lineIdToChapterId = new Map<string, string>();
    project.chapters.forEach(ch => ch.scriptLines.forEach(line => lineIdToChapterId.set(line.id, ch.id)));

    for (const row of rowsToExport) {
        const lineId = row.originalLineId!;
        const line = project.chapters
            .flatMap(ch => ch.scriptLines)
            .find(l => l.id === lineId);
        
        if (line?.audioBlobId) {
            const audioBlobFromDb = await db.audioBlobs.get(line.audioBlobId);
            if (audioBlobFromDb) {
                linesWithAudio.push({ line, audioBlob: audioBlobFromDb.data });
            }
        }
    }

    if (linesWithAudio.length === 0) {
        alert('未找到音频文件。');
        return;
    }

    // FIX: Pass all required arguments (`project` and `allProjectCharacters`) to `exportAudioWithMarkers`.
    const waveBlob = await exportAudioWithMarkers(linesWithAudio, project, allProjectCharacters);
    const url = URL.createObjectURL(waveBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(`${project.name}_${character.name}_TTS_Marked.wav`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};


/**
 * Exports a ZIP file containing individual audio clips for the given character.
 */
export const exportCharacterClips = async (
    rows: VoiceLibraryRowState[],
    project: Project,
    characters: Character[],
    generatedAudioUrls: Record<string, string>,
    selectedCharacter: Character | null
): Promise<void> => {
    const rowsToExport = rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId);
    if (rowsToExport.length === 0) {
        alert('没有可导出的音频。');
        return;
    }

    const zip = new JSZip();
    const lineIdMap = new Map<string, ScriptLine>();
    project.chapters.forEach(ch => ch.scriptLines.forEach(line => lineIdMap.set(line.id, line)));
    const characterMap = new Map(characters.map(c => [c.id, c]));

    for (const row of rowsToExport) {
        const lineId = row.originalLineId!;
        const line = lineIdMap.get(lineId);

        if (line?.audioBlobId) {
            const audioBlob = await db.audioBlobs.get(line.audioBlobId);
            if (audioBlob) {
                const character = line.characterId ? characterMap.get(line.characterId) : null;
                if (!character) continue;

                const baseName = character.cvName
                    ? `【${character.cvName}-${character.name}】${line.text}`
                    : `【${character.name}】${line.text}`;
                zip.file(`${sanitizeFilename(baseName)}.mp3`, audioBlob.data);
            }
        }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    const filename = selectedCharacter
        ? `${sanitizeFilename(`${project.name}_${selectedCharacter.name}_片段`)}.zip`
        : `${sanitizeFilename(`${project.name}_所有角色片段`)}.zip`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};