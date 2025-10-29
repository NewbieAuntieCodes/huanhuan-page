import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Character, Chapter, ParsedFileInfo, AudioAssistantState } from '../../types';
import { FolderOpenIcon, CheckCircleIcon, XMarkIcon, ChevronLeftIcon, ArrowPathIcon } from '../../components/ui/icons';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { db } from '../../db';

// --- Helper Functions ---

const chineseToArabic = (numStr: string): number | null => {
    // This is a simplified version. For full support, a more complex library would be needed.
    const map: { [key: string]: number } = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100, '千': 1000 };
    if (/^\d+$/.test(numStr)) return parseInt(numStr, 10);
    if(map[numStr] !== undefined) return map[numStr];
    // Basic support for 十, e.g., "十一" -> 11, "二十" -> 20
    if (numStr.startsWith('十')) return 10 + (map[numStr[1]] || 0);
    if (numStr.endsWith('十')) return map[numStr[0]] * 10;
    return null;
};

const getChapterNumber = (title: string): number | null => {
    if (!title) return null;
    const match = title.match(/(?:Chapter|第)\s*([一二三四五六七八九十百千万零\d]+)/i);
    if (match?.[1]) {
        const numPart = match[1];
        if (/^\d+$/.test(numPart)) return parseInt(numPart, 10);
        return chineseToArabic(numPart);
    }
    const numericMatch = title.match(/^\s*(\d+)\s*$/);
    return numericMatch ? parseInt(numericMatch[1], 10) : null;
};

interface MatchStatus {
    characters: Record<string, boolean>;
    chapters: Record<string, boolean>;
    ranges: Record<string, boolean>;
}

const AudioAlignmentAssistantPage: React.FC = () => {
    const { projects, characters, selectedProjectId, navigateTo } = useStore();
    const [directoryName, setDirectoryName] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [scannedFiles, setScannedFiles] = useState<ParsedFileInfo[]>([]);
    const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});

    const [selectedRangeIndex, setSelectedRangeIndex] = useState<number | null>(null);
    const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
    
    // --- File System Access API state and refs ---
    const isApiSupported = 'showDirectoryPicker' in window;
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    
    // Ref for fallback input method
    const directoryInputRef = useRef<HTMLInputElement>(null);


    const currentProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
    const { allCvNames, projectCharacters } = useMemo<{ allCvNames: string[], projectCharacters: Character[] }>(() => {
        if (!currentProject) return { allCvNames: [], projectCharacters: [] };
        const projChars = characters.filter(c => c.projectId === currentProject.id || !c.projectId);
        const cvs = projChars.reduce<string[]>((acc, c) => {
            if (c.cvName && !acc.includes(c.cvName)) {
                acc.push(c.cvName);
            }
            return acc;
        }, []).sort();
        return { allCvNames: cvs, projectCharacters: projChars };
    }, [currentProject, characters]);
    
    const scanDirectory = useCallback(async (handle: FileSystemDirectoryHandle, resetState: boolean) => {
        setIsLoading(true);
        if (resetState) {
            setScannedFiles([]);
            setManualOverrides({});
        }

        try {
            const parsedFiles: ParsedFileInfo[] = [];
            for await (const entry of handle.values()) {
                // FIX: `kind` and `getFile` are not on the base `FileSystemHandle` type. Cast to `any` to access them after checking the kind.
                if ((entry as any).kind === 'file') {
                    const file = await (entry as any).getFile();
                    if (file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
                        const name = file.name.replace(/\.(mp3|wav)$/i, '');
                        const parts = name.split(/[_]/);
                        if (parts.length < 1) continue;
        
                        const chapterPart = parts[0];
                        const chapterNumbers: number[] = [];
                        if (chapterPart.includes('-')) {
                            const [start, end] = chapterPart.split('-').map(Number);
                            if (!isNaN(start) && !isNaN(end)) {
                                for (let i = start; i <= end; i++) chapterNumbers.push(i);
                            }
                        } else if (!isNaN(Number(chapterPart))) {
                            chapterNumbers.push(Number(chapterPart));
                        }
        
                        if (chapterNumbers.length === 0) continue;
        
                        let cvName: string | null = null;
                        let characterName: string | null = null;
        
                        if (parts.length > 1) {
                            const potentialIdentifier = parts.slice(1).join('_');
                            if (allCvNames.includes(potentialIdentifier)) {
                                cvName = potentialIdentifier;
                            } else {
                                characterName = potentialIdentifier;
                            }
                        }
        
                        if (characterName === 'pb' || cvName === 'pb') {
                           cvName = 'pb';
                           characterName = 'Narrator';
                        }
        
                        parsedFiles.push({ chapters: chapterNumbers, characterName, cvName });
                    }
                }
            }
            setDirectoryName(handle.name);
            setScannedFiles(parsedFiles);
        } catch (err) {
            console.error("Error scanning directory:", err);
            alert(`扫描文件夹时出错: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setIsLoading(false);
        }
    }, [allCvNames]);

    useEffect(() => {
        if (currentProject) {
            const loadState = async () => {
                setIsLoading(true);
                try {
                    if (isApiSupported) {
                        const handleEntry = await db.directoryHandles.get(currentProject.id);
                        if (handleEntry) {
                            const handle = handleEntry.handle;
                            // FIX: `queryPermission` is not in the default type. Cast to 'any' to use.
                            const permission = await (handle as any).queryPermission({ mode: 'read' });
                            setDirectoryHandle(handle);
                            if (permission === 'granted') {
                                // Automatically scan if permission is already granted
                                await scanDirectory(handle, true);
                                return;
                            } else {
                                // We have a handle but no permission, just show the name
                                setDirectoryName(handle.name);
                            }
                        }
                    }

                    // Fallback to old state if API not supported or no handle saved/permissioned
                    const savedState = await db.assistantState.get(currentProject.id);
                    if (savedState) {
                        setDirectoryName(savedState.directoryName);
                        setScannedFiles(savedState.scannedFiles);
                        setManualOverrides(savedState.manualOverrides);
                    }
                } catch (err) {
                    console.error("Failed to load assistant state from DB:", err);
                } finally {
                    setIsLoading(false);
                }
            };
            loadState();
        }
    }, [currentProject, isApiSupported, scanDirectory]);

    // Effect to save non-handle state
    useEffect(() => {
        if (currentProject && (directoryName || scannedFiles.length > 0)) {
            const saveState = async () => {
                const stateToSave: AudioAssistantState = {
                    projectId: currentProject.id,
                    directoryName,
                    scannedFiles,
                    manualOverrides,
                };
                await db.assistantState.put(stateToSave);
            };
            saveState().catch(err => console.error("Failed to save assistant state to DB:", err));
        }
    }, [directoryName, scannedFiles, manualOverrides, currentProject]);

    const handleSelectDirectory = async () => {
        if (!currentProject) return;
        try {
            // FIX: 'showDirectoryPicker' is not in the default 'window' type definition. Cast to 'any' to use this API.
            const handle = await (window as any).showDirectoryPicker();
            // FIX: 'requestPermission' is not in the default 'FileSystemDirectoryHandle' type. Cast to 'any' to use it.
            if ((await (handle as any).requestPermission({ mode: 'read' })) !== 'granted') {
                alert("需要文件夹读取权限才能继续。");
                return;
            }
            await db.directoryHandles.put({ projectId: currentProject.id, handle });
            setDirectoryHandle(handle);
            await scanDirectory(handle, true);
        } catch (err) {
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
                console.error("Error picking directory:", err);
            }
        }
    };
    
    const handleRescan = async () => {
        if (directoryHandle) {
            // FIX: 'requestPermission' is not in the default 'FileSystemDirectoryHandle' type. Cast to 'any' to use it.
            if ((await (directoryHandle as any).requestPermission({ mode: 'read' })) === 'granted') {
                await scanDirectory(directoryHandle, true);
            } else {
                alert("需要文件夹读取权限才能重新扫描。");
            }
        }
    };

    // --- Fallback method handlers ---
    const handleScanDirectoryClick_Fallback = () => {
        directoryInputRef.current?.click();
    };

    // FIX: Set the non-standard 'webkitdirectory' attribute via a useEffect hook to avoid TypeScript prop errors.
    useEffect(() => {
        if (directoryInputRef.current) {
            directoryInputRef.current.setAttribute('webkitdirectory', '');
        }
    }, []);

    const handleDirectoryInputChange_Fallback = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setIsLoading(true);
        setScannedFiles([]);
        setManualOverrides({});
        
        try {
            const firstFilePath = files[0].webkitRelativePath;
            const dirName = firstFilePath.split('/')[0];
            const parsedFiles: ParsedFileInfo[] = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file) continue;
                if (file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
                    const name = file.name.replace(/\.(mp3|wav)$/i, '');
                    const parts = name.split(/[_]/);
                    if (parts.length < 1) continue;
    
                    const chapterPart = parts[0];
                    const chapterNumbers: number[] = [];
                    if (chapterPart.includes('-')) {
                        const [start, end] = chapterPart.split('-').map(Number);
                        if (!isNaN(start) && !isNaN(end)) {
                            for (let i = start; i <= end; i++) chapterNumbers.push(i);
                        }
                    } else if (!isNaN(Number(chapterPart))) {
                        chapterNumbers.push(Number(chapterPart));
                    }
    
                    if (chapterNumbers.length === 0) continue;
    
                    let cvName: string | null = null;
                    let characterName: string | null = null;
    
                    if (parts.length > 1) {
                        const potentialIdentifier = parts.slice(1).join('_');
                        if (allCvNames.includes(potentialIdentifier)) {
                            cvName = potentialIdentifier;
                        } else {
                            characterName = potentialIdentifier;
                        }
                    }
    
                    if (characterName === 'pb' || cvName === 'pb') {
                       cvName = 'pb';
                       characterName = 'Narrator';
                    }
    
                    parsedFiles.push({ chapters: chapterNumbers, characterName, cvName });
                }
            }
            setDirectoryName(dirName);
            setScannedFiles(parsedFiles);

        } catch (err) {
            console.error("Error processing directory files:", err);
            alert(`Error processing files: ${err instanceof Error ? err.message : String(err)}`);
            setDirectoryName(null);
            setScannedFiles([]);
            setManualOverrides({});
        } finally {
            setIsLoading(false);
            if (event.target) event.target.value = '';
        }
    }, [allCvNames]);
    
    // --- Memoized calculations for UI ---
    
    const chapterRanges = useMemo<{ label: string; start: number; end: number; }[]>(() => {
        if (!currentProject) return [];
        const ranges = [];
        const rangeSize = 100;
        const totalChapters = currentProject.chapters.length;
        if (totalChapters === 0) return [];

        let currentStart = 1;
        
        while (currentStart <= totalChapters) {
            const end = Math.min(currentStart + rangeSize - 1, totalChapters);
            ranges.push({
                label: `${currentStart}-${end}`,
                start: currentStart -1, // 0-indexed for slice
                end: end - 1, // 0-indexed for slice
            });
            currentStart += rangeSize;
        }

        return ranges;
    }, [currentProject]);

    const finalMatchStatus = useMemo(() => {
        if (scannedFiles.length === 0 || !currentProject) return null;

        // FIX: Explicitly type `finalStatus` to `MatchStatus` to resolve indexing errors where keys were inferred as `unknown`.
        const finalStatus: MatchStatus = { characters: {}, chapters: {}, ranges: {} };

        const fileCoverage = new Map<number, ParsedFileInfo[]>();
        scannedFiles.forEach(file => {
            file.chapters.forEach(chNum => {
                if (!fileCoverage.has(chNum)) fileCoverage.set(chNum, []);
                fileCoverage.get(chNum)!.push(file);
            });
        });

        currentProject.chapters.forEach(chapter => {
            const chapterNum = getChapterNumber(chapter.title);
            if (chapterNum === null) {
                finalStatus.chapters[chapter.id] = true;
                return;
            }
            const charIdsInChapter = new Set(chapter.scriptLines.map(l => l.characterId).filter((id): id is string => !!id));
            if (charIdsInChapter.size === 0) {
                finalStatus.chapters[chapter.id] = true;
                return;
            }

            const isChapterComplete = Array.from(charIdsInChapter).every(charId => {
                const character = projectCharacters.find(c => c.id === charId);
                if (!character) return true;
                if (manualOverrides[charId] !== undefined) return manualOverrides[charId];
                
                const relevantFiles = fileCoverage.get(chapterNum) || [];
                
                return relevantFiles.some(file => 
                    (file.characterName && (file.characterName === character.name || file.characterName === character.cvName)) ||
                    (file.cvName && file.cvName === character.cvName)
                );
            });
            finalStatus.chapters[chapter.id] = isChapterComplete;
        });
        
        chapterRanges.forEach(range => {
            const chaptersInRange = currentProject.chapters.slice(range.start, range.end + 1);
            finalStatus.ranges[range.label] = chaptersInRange.every(ch => finalStatus.chapters[ch.id]);
        });

        if (selectedChapterId) {
            const chapter = currentProject.chapters.find(c => c.id === selectedChapterId);
            const chapterNum = chapter ? getChapterNumber(chapter.title) : null;

            if (chapter && chapterNum !== null) {
                const relevantFiles = fileCoverage.get(chapterNum) || [];
                const charIdsInChapter = new Set(chapter.scriptLines.map(l => l.characterId).filter((id): id is string => !!id));

                charIdsInChapter.forEach(charId => {
                    const character = projectCharacters.find(c => c.id === charId);
                    if (!character) return;
                    
                    if (manualOverrides[charId] !== undefined) {
                        finalStatus.characters[charId] = manualOverrides[charId];
                        return;
                    }

                    const isCharFound = relevantFiles.some(file => 
                        (file.characterName && (file.characterName === character.name || file.characterName === character.cvName)) ||
                        (file.cvName && file.cvName === character.cvName)
                    );
                    finalStatus.characters[charId] = isCharFound;
                });
            }
        }
        
        return finalStatus;
    }, [scannedFiles, currentProject, projectCharacters, manualOverrides, chapterRanges, selectedChapterId]);


    const handleToggleCharacter = (charId: string) => {
        setManualOverrides(prev => ({
            ...prev,
            [charId]: !(finalMatchStatus?.characters[charId] ?? false)
        }));
    };

    const chaptersInSelectedRange = useMemo(() => {
        if (selectedRangeIndex === null || !currentProject) return [];
        const range = chapterRanges[selectedRangeIndex];
        return currentProject.chapters.slice(range.start, range.end + 1);
    }, [selectedRangeIndex, chapterRanges, currentProject]);

    const charactersInSelectedChapter = useMemo(() => {
        if (!selectedChapterId || !currentProject) return [];
        const chapter = currentProject.chapters.find(c => c.id === selectedChapterId);
        if (!chapter) return [];
        const charIds = new Set(chapter.scriptLines.map(l => l.characterId));
        return projectCharacters.filter(c => charIds.has(c.id)).sort((a,b) => a.name.localeCompare(b.name));
    }, [selectedChapterId, currentProject, projectCharacters]);

    const StatusIcon: React.FC<{ status?: boolean }> = ({ status }) => (
        status === true ? <CheckCircleIcon className="w-5 h-5 text-green-500" /> :
        status === false ? <XMarkIcon className="w-5 h-5 text-red-500" /> :
        <span className="w-5 h-5 text-slate-600">-</span>
    );
    
    if (!currentProject) {
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center bg-slate-900 text-slate-100">
                <h1 className="text-2xl font-bold text-sky-400">对轨助手</h1>
                <p className="mt-4 text-slate-400">请先从项目面板选择一个项目。</p>
                 <button onClick={() => navigateTo('dashboard')} className="mt-6 flex items-center text-sm text-sky-300 hover:text-sky-100 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md">
                   <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回项目面板
                 </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-slate-900 text-slate-100">
            <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold text-sky-400">对轨助手: <span className="text-slate-200">{currentProject.name}</span></h1>
                    {directoryName && <p className="text-xs text-slate-400 mt-1">当前文件夹: {directoryName}</p>}
                </div>
                <div className="flex items-center space-x-3">
                    {isApiSupported ? (
                        <>
                            <button onClick={handleSelectDirectory} disabled={isLoading} className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50">
                                {isLoading && !directoryHandle ? <LoadingSpinner/> : <FolderOpenIcon className="w-4 h-4 mr-2" />}
                                {directoryHandle ? "更换文件夹" : "关联音频文件夹"}
                            </button>
                            {directoryHandle && (
                                <button onClick={handleRescan} disabled={isLoading} className="flex items-center text-sm text-green-300 hover:text-green-100 px-3 py-1.5 bg-green-800/50 hover:bg-green-700/50 rounded-md disabled:opacity-50">
                                    {isLoading ? <LoadingSpinner/> : <ArrowPathIcon className="w-4 h-4 mr-2" />}
                                    重新扫描
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <input
                                type="file"
                                ref={directoryInputRef}
                                onChange={handleDirectoryInputChange_Fallback}
                                multiple
                                style={{ display: 'none' }}
                            />
                            <button onClick={handleScanDirectoryClick_Fallback} disabled={isLoading} className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50">
                                {isLoading ? <LoadingSpinner/> : <FolderOpenIcon className="w-4 h-4 mr-2" />}
                                {isLoading ? "扫描中..." : "扫描本地文件夹"}
                            </button>
                        </>
                    )}
                    <button onClick={() => navigateTo('editor')} className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md">
                        <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回
                    </button>
                </div>
            </header>

            <div className="flex-grow flex overflow-hidden">
                <aside className="w-48 bg-slate-800 p-3 flex-shrink-0 overflow-y-auto border-r border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-300 mb-3">目录</h2>
                    <ul className="space-y-1">
                        {chapterRanges.map((range, index) => (
                            <li key={range.label}>
                                <button onClick={() => setSelectedRangeIndex(index)} className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${selectedRangeIndex === index ? 'bg-sky-600 text-white font-semibold' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                                    <span>{range.label}</span>
                                    <StatusIcon status={finalMatchStatus?.ranges[range.label]} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
                
                <aside className="w-64 bg-slate-800 p-3 flex-shrink-0 overflow-y-auto border-r border-slate-700">
                    <h2 className="text-lg font-semibold text-slate-300 mb-3">章节列表</h2>
                    {selectedRangeIndex === null ? <p className="text-sm text-slate-500">请选择一个目录。</p> : (
                         <ul className="space-y-1">
                            {chaptersInSelectedRange.map(chapter => (
                                <li key={chapter.id}>
                                    <button onClick={() => setSelectedChapterId(chapter.id)} className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between ${selectedChapterId === chapter.id ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}>
                                        <span className="truncate">{chapter.title}</span>
                                        <StatusIcon status={finalMatchStatus?.chapters[chapter.id]} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </aside>

                <main className="flex-grow p-4 overflow-y-auto">
                     <h2 className="text-lg font-semibold text-slate-300 mb-3">角色状态</h2>
                     {!directoryName && !scannedFiles.length ? (
                        <div className="text-center py-10 text-slate-500">请先关联或扫描本地音频文件夹。</div>
                     ) : !selectedChapterId ? (
                        <div className="text-center py-10 text-slate-500">请选择一个章节查看角色状态。</div>
                     ) : charactersInSelectedChapter.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">此章节没有已分配的角色。</div>
                     ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {charactersInSelectedChapter.map(char => (
                                <div key={char.id} onClick={() => handleToggleCharacter(char.id)} className="p-3 bg-slate-800 rounded-md flex justify-between items-center cursor-pointer hover:bg-slate-700 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="font-semibold">{char.name}</span>
                                        {char.cvName && <span className="text-xs text-slate-400">{char.cvName}</span>}
                                    </div>
                                    <StatusIcon status={finalMatchStatus?.characters[char.id]} />
                                </div>
                            ))}
                        </div>
                     )}
                </main>
            </div>
        </div>
    );
};

export default AudioAlignmentAssistantPage;