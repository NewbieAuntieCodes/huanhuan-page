import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from '../../../store/useStore';
import { Character, Chapter, ScriptLine } from '../../../types';
import { db } from '../../../db';
import { checkTtsServerHealth, uploadTtsPrompt, generateTtsBatch, TTS_SERVER_ORIGIN } from '../../../services/ttsService';
import { exportMarkedWav, exportCharacterClips } from '../services/voiceLibraryExporter';


type RowStatus = 'idle' | 'uploading' | 'generating' | 'done' | 'error';
type ServerHealth = 'checking' | 'ok' | 'error' | 'unknown';

export interface VoiceLibraryRowState {
  id: string;
  promptFilePath: string | null;
  promptAudioUrl: string | null;
  promptFileName: string | null;
  text: string;
  status: RowStatus;
  audioUrl: string | null;
  error: string | null;
  originalLineId?: string;
}

// --- Utility Functions ---
const chineseToArabic = (numStr: string): number | null => {
    const map: { [key: string]: number } = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const units: { [key: string]: { val: number, sec: boolean } } = { '十': { val: 10, sec: false }, '百': { val: 100, sec: false }, '千': { val: 1000, sec: false }, '万': { val: 10000, sec: true }, '亿': { val: 100000000, sec: true } };
    let result = 0, section = 0, number = 0, secUnit = false;
    for (const char of numStr) {
        if (map[char] !== undefined) number = map[char];
        else if (units[char] !== undefined) {
            if (units[char].sec) {
                section = (section + number) * units[char].val;
                result += section;
                section = 0;
                secUnit = true;
            } else {
                 section += (number || 1) * units[char].val;
            }
            number = 0;
        }
    }
    if (!secUnit) result += section;
    result += number;
    return result > 0 ? result : null;
};

const getChapterNumber = (title: string): number | null => {
    if (!title) return null;
    const match = title.match(/(?:Chapter|第)\s*([一二三四五六七八九十百千万零\d]+)/i);
    if (match?.[1]) {
        const numPart = match[1];
        return /^\d+$/.test(numPart) ? parseInt(numPart, 10) : chineseToArabic(numPart);
    }
    const numericMatch = title.match(/^\s*(\d+)\s*$/);
    return numericMatch ? parseInt(numericMatch[1], 10) : null;
};


// --- Main Hook ---
export const useVoiceLibrary = () => {
    const { projects, characters, selectedProjectId, assignAudioToLine, selectedChapterId } = useStore(state => ({
        projects: state.projects,
        characters: state.characters,
        selectedProjectId: state.selectedProjectId,
        assignAudioToLine: state.assignAudioToLine,
        selectedChapterId: state.selectedChapterId,
    }));

    const [rows, setRows] = useState<VoiceLibraryRowState[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [serverHealth, setServerHealth] = useState<ServerHealth>('unknown');
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
    const [chapterFilter, setChapterFilter] = useState('');
    const [generatedAudioUrls, setGeneratedAudioUrls] = useState<Record<string, string>>({});

    const objectUrlsRef = useRef<Record<string, string>>({});
    const syncedChapterIdRef = useRef<string | null>(null);

    // Cleanup object URLs on unmount
    useEffect(() => {
        const promptUrls = Object.values(objectUrlsRef.current);
        const genUrls = Object.values(generatedAudioUrls);
        return () => {
            promptUrls.forEach(URL.revokeObjectURL);
            genUrls.forEach(URL.revokeObjectURL);
        };
    }, [generatedAudioUrls]);

    const currentProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
    
    const charactersInProject = useMemo(() => {
        if (!selectedProjectId) {
            return characters.filter(c => !c.projectId && c.status !== 'merged' && c.name !== '[静音]' && c.name !== '音效' && c.name !== 'Narrator');
        }
        return characters.filter(c =>
            (c.projectId === selectedProjectId || !c.projectId) &&
            c.status !== 'merged' && 
            c.name !== '[静音]' && 
            c.name !== '音效' &&
            c.name !== 'Narrator'
        );
    }, [characters, selectedProjectId]);

    const selectedCharacter = useMemo(() => characters.find(c => c.id === selectedCharacterId), [characters, selectedCharacterId]);

    const updateRow = useCallback((id: string, updates: Partial<VoiceLibraryRowState>) => {
        setRows(prevRows => prevRows.map(row => row.id === id ? { ...row, ...updates } : row));
    }, []);
    
    const handleCheckServerHealth = useCallback(async () => {
        setServerHealth('checking');
        const isOk = await checkTtsServerHealth();
        setServerHealth(isOk ? 'ok' : 'error');
    }, []);

    useEffect(() => { handleCheckServerHealth(); }, [handleCheckServerHealth]);

    // Effect to sync chapter selection from other pages
    useEffect(() => {
        if (currentProject && selectedChapterId && selectedChapterId !== syncedChapterIdRef.current) {
            const chapter = currentProject.chapters.find(c => c.id === selectedChapterId);
            if (chapter) {
                const chapterNum = getChapterNumber(chapter.title);
                if (chapterNum !== null) {
                    setChapterFilter(String(chapterNum));
                    syncedChapterIdRef.current = selectedChapterId;
                }
            }
        }
    }, [selectedChapterId, currentProject]);

    // Effect to create/revoke Object URLs for generated audio from DB
    useEffect(() => {
        const syncAudioUrls = async () => {
            if (!currentProject) return;
            const newUrls: Record<string, string> = {};
            const urlsToRevoke: string[] = [];
            const currentRowIds = new Set(rows.map(r => r.id));
            const existingUrlKeys = new Set(Object.keys(generatedAudioUrls));

            // Create URLs for new/updated rows
            for (const row of rows) {
                if (row.originalLineId && !generatedAudioUrls[row.id]) {
                    const line = currentProject.chapters
                        .flatMap(ch => ch.scriptLines)
                        .find(l => l.id === row.originalLineId);
                    
                    if (line?.audioBlobId) {
                        const audioBlob = await db.audioBlobs.get(line.audioBlobId);
                        if (audioBlob) newUrls[row.id] = URL.createObjectURL(audioBlob.data);
                    }
                }
            }

            // Find URLs to revoke for rows that no longer exist
            existingUrlKeys.forEach(rowId => {
                if (!currentRowIds.has(rowId)) {
                    urlsToRevoke.push(generatedAudioUrls[rowId]);
                }
            });

            if (urlsToRevoke.length > 0) {
                urlsToRevoke.forEach(URL.revokeObjectURL);
                setGeneratedAudioUrls(prev => {
                    const next = { ...prev };
                    urlsToRevoke.forEach(url => {
                        const key = Object.keys(next).find(k => next[k] === url);
                        if (key) delete next[key];
                    });
                    return next;
                });
            }

            if (Object.keys(newUrls).length > 0) {
                setGeneratedAudioUrls(prev => ({ ...prev, ...newUrls }));
            }
        };
        syncAudioUrls();
    }, [rows, currentProject, generatedAudioUrls]);

    // Effect to populate rows based on filters
    useEffect(() => {
        if (!currentProject) {
            setRows([]);
            return;
        }
        const chapterMatchesFilter = (chapter: Chapter): boolean => {
            const filter = chapterFilter.trim();
            if (!filter) return true;
            const rangeMatch = filter.match(/^(\d+)-(\d+)$/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10), end = parseInt(rangeMatch[2], 10);
                const chapterNum = getChapterNumber(chapter.title);
                return chapterNum !== null && chapterNum >= start && chapterNum <= end;
            }
            return chapter.title.includes(filter);
        };
        
        const nonAudioCharacterIds = characters
            .filter(c => c.name === '[静音]' || c.name === '音效')
            .map(c => c.id);

        const scriptLines = currentProject.chapters.flatMap(chapter => {
             if (chapterMatchesFilter(chapter)) {
                let linesInChapter = chapter.scriptLines;
                
                // Filter out non-audio lines first
                linesInChapter = linesInChapter.filter(line => !nonAudioCharacterIds.includes(line.characterId || ''));

                if (selectedCharacterId) {
                    // Then filter by character if one is selected
                    return linesInChapter.filter(line => line.characterId === selectedCharacterId);
                }
                // No character selected, return all (already filtered) lines from the chapter
                return linesInChapter;
            }
            return [];
        });

        setRows(scriptLines.map(line => ({
            id: `row_${line.id}_${Math.random()}`,
            promptFilePath: null, promptAudioUrl: null, promptFileName: null,
            text: line.text, status: 'idle', audioUrl: null, error: null,
            originalLineId: line.id,
        })));
    }, [selectedCharacterId, chapterFilter, currentProject, characters]);
    
    const processAndAssignAudio = async (row: VoiceLibraryRowState, audioPath: string) => {
        if (!row.originalLineId || !selectedProjectId || !currentProject) return;
        
        const chapter = currentProject.chapters.find(ch => ch.scriptLines.some(l => l.id === row.originalLineId));
        if (!chapter) {
            updateRow(row.id, { status: 'error', error: '找不到原始章节' });
            return;
        }

        const fullAudioUrl = audioPath.startsWith('http') ? audioPath : `${TTS_SERVER_ORIGIN}/${audioPath.replace(/\\/g, '/').replace(/^\//, '')}`;
        
        try {
            const audioRes = await fetch(fullAudioUrl);
            if (!audioRes.ok) throw new Error('下载生成的音频失败');
            await assignAudioToLine(selectedProjectId, chapter.id, row.originalLineId, await audioRes.blob());
            updateRow(row.id, { status: 'done' });
        } catch (e) {
            updateRow(row.id, { status: 'error', error: e instanceof Error ? e.message : '保存音频失败' });
        }
    };

    const handleBatchGenerate = useCallback(async () => {
        const rowsToProcess = rows.filter(r => r.text.trim() && r.promptFilePath && r.originalLineId);
        if (rowsToProcess.length === 0) {
            alert('没有可生成的行 (确保已上传参考音频并填写了台词)。');
            return;
        }

        setIsGenerating(true);
        rowsToProcess.forEach(r => updateRow(r.id, { status: 'generating', error: null }));

        try {
            // FIX: Mapped rowsToProcess to match the TtsBatchItem interface required by generateTtsBatch.
            const ttsItems = rowsToProcess.map(r => ({
                promptAudio: r.promptFilePath,
                text: r.text
            }));
            const results = await generateTtsBatch(ttsItems);
            for (let i = 0; i < results.length; i++) {
                const item = results[i];
                if (item.ok && item.audioUrl) {
                    await processAndAssignAudio(rowsToProcess[i], item.audioUrl);
                } else {
                    updateRow(rowsToProcess[i].id, { status: 'error', error: String(item.error || '生成失败') });
                }
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '未知错误';
            rowsToProcess.forEach(r => updateRow(r.id, { status: 'error', error: errorMsg }));
        } finally {
            setIsGenerating(false);
        }
    }, [rows, updateRow, processAndAssignAudio]);
    
    const handleGenerateSingle = useCallback(async (rowId: string) => {
        const row = rows.find(r => r.id === rowId);
        if (!row?.text.trim() || !row.promptFilePath) {
            alert('请确保已上传参考音频并填写了台词。');
            return;
        }
        if (!row.originalLineId) {
            alert('手动添加的行无法自动同步，请使用批量生成。');
            return;
        }

        updateRow(rowId, { status: 'generating', error: null });
        try {
            // FIX: Created an object matching the TtsBatchItem interface before calling generateTtsBatch.
            const ttsItem = {
                promptAudio: row.promptFilePath,
                text: row.text,
            };
            const results = await generateTtsBatch([ttsItem]);
            const item = results[0];
            if (item.ok && item.audioUrl) {
                await processAndAssignAudio(row, item.audioUrl);
            } else {
                updateRow(rowId, { status: 'error', error: String(item.error || '生成失败') });
            }
        } catch (err) {
            updateRow(rowId, { status: 'error', error: err instanceof Error ? err.message : '未知错误' });
        }
    }, [rows, updateRow, processAndAssignAudio]);

    const handleUpload = useCallback(async (rowId: string, file: File) => {
        if (objectUrlsRef.current[rowId]) URL.revokeObjectURL(objectUrlsRef.current[rowId]);
        
        objectUrlsRef.current[rowId] = URL.createObjectURL(file);
        updateRow(rowId, { status: 'uploading', error: null, promptAudioUrl: objectUrlsRef.current[rowId], promptFileName: file.name });
        
        try {
            const filePath = await uploadTtsPrompt(file);
            updateRow(rowId, { promptFilePath: filePath, status: 'idle' });
        } catch (err) {
            updateRow(rowId, { status: 'error', error: err instanceof Error ? err.message : '未知上传错误', promptFilePath: null });
        }
    }, [updateRow]);
    
    const handleDeleteGeneratedAudio = useCallback(async (rowId: string) => {
        const row = rows.find(r => r.id === rowId);
        if (!row?.originalLineId || !selectedProjectId || !currentProject) return;

        const chapter = currentProject.chapters.find(ch => ch.scriptLines.some(l => l.id === row.originalLineId));
        const line = chapter?.scriptLines.find(l => l.id === row.originalLineId);

        if (chapter && line?.audioBlobId) {
            await db.audioBlobs.delete(line.audioBlobId);
            // This implicitly triggers a state update via useStore, which will cause the useEffect to clean up the URL
            await useStore.getState().updateLineAudio(selectedProjectId, chapter.id, line.id, null);
        }
    }, [rows, selectedProjectId, currentProject]);

    const handleDeletePromptAudio = useCallback((rowId: string) => {
        if (objectUrlsRef.current[rowId]) {
            URL.revokeObjectURL(objectUrlsRef.current[rowId]);
            delete objectUrlsRef.current[rowId];
        }
        updateRow(rowId, { promptFilePath: null, promptAudioUrl: null, promptFileName: null, status: 'idle', error: null });
    }, [updateRow]);

    const addEmptyRow = () => setRows(prev => [...prev, {
        id: `row_manual_${Date.now()}`, promptFilePath: null, promptAudioUrl: null, promptFileName: null,
        text: '', status: 'idle', audioUrl: null, error: null,
    }]);
    
    const removeRow = (id: string) => {
        if (objectUrlsRef.current[id]) {
            URL.revokeObjectURL(objectUrlsRef.current[id]);
            delete objectUrlsRef.current[id];
        }
        if (generatedAudioUrls[id]) {
            URL.revokeObjectURL(generatedAudioUrls[id]);
            setGeneratedAudioUrls(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
        setRows(prev => prev.filter(row => row.id !== id));
    };

    const handleTextChange = (id: string, text: string) => updateRow(id, { text });

    const handleExport = async () => {
        if (!currentProject || !selectedCharacter) return;
        setIsExporting(true);
        try {
            await exportMarkedWav(rows, currentProject, selectedCharacter, generatedAudioUrls);
        } catch (error) {
            alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportCharacterClips = async () => {
        if (!currentProject) return;
        setIsExporting(true);
        try {
            await exportCharacterClips(rows, currentProject, characters, generatedAudioUrls, selectedCharacter);
        } catch (error) {
            alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsExporting(false);
        }
    };
    
    return {
        rows,
        currentProject,
        charactersInProject,
        selectedCharacter,
        isGenerating,
        isExporting,
        serverHealth,
        chapterFilter,
        setChapterFilter,
        selectedCharacterId,
        handleSelectCharacter: setSelectedCharacterId,
        checkServerHealth: handleCheckServerHealth,
        handleBatchGenerate,
        handleGenerateSingle,
        handleUpload,
        handleTextChange,
        removeRow,
        addEmptyRow,
        handleDeleteGeneratedAudio,
        handleDeletePromptAudio,
        handleExport,
        handleExportCharacterClips,
        generatedAudioUrls,
    };
};