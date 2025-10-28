import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Character, Chapter, ScriptLine } from '../../types';
import VoiceLibraryRow from './components/VoiceLibraryRow';
import { ChevronLeftIcon, SparklesIcon, CheckCircleIcon, XMarkIcon, PlusIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from '../../components/ui/icons';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { db } from '../../db';
import { exportAudioWithMarkers } from '../../lib/wavExporter';
import ExportVoiceLibraryModal from './components/ExportVoiceLibraryModal';
import JSZip from 'jszip';

type RowStatus = 'idle' | 'uploading' | 'generating' | 'done' | 'error';
type ServerHealth = 'checking' | 'ok' | 'error' | 'unknown';

export interface VoiceLibraryRowState {
  id: string;
  promptFilePath: string | null;
  promptAudioUrl: string | null; // URL for local playback
  promptFileName: string | null; // To display filename immediately
  text: string;
  status: RowStatus;
  audioUrl: string | null; // This will now be populated from DB
  error: string | null;
  originalLineId?: string; // To link back to project script lines
}

const TTS_API_BASE_URL = 'http://127.0.0.1:8000/api';
const TTS_SERVER_ORIGIN = 'http://127.0.0.1:8000';


// Helper to convert Chinese numbers to Arabic numerals
const chineseToArabic = (numStr: string): number | null => {
    const map: { [key: string]: number } = { '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const units: { [key: string]: { val: number, sec: boolean } } = { '十': { val: 10, sec: false }, '百': { val: 100, sec: false }, '千': { val: 1000, sec: false }, '万': { val: 10000, sec: true }, '亿': { val: 100000000, sec: true } };
    let result = 0;
    let section = 0;
    let number = 0;
    let secUnit = false;
    for (let i = 0; i < numStr.length; i++) {
        const char = numStr[i];
        if (map[char] !== undefined) {
            number = map[char];
        } else if (units[char] !== undefined) {
            const unit = units[char];
            if (unit.sec) {
                section = (section + number) * unit.val;
                result += section;
                section = 0;
                secUnit = true;
            } else {
                 section += (number || 1) * unit.val;
            }
            number = 0;
        }
    }
    if (!secUnit) {
        result += section;
    }
    result += number;
    return result > 0 ? result : null;
};

// Helper to get chapter number from title
const getChapterNumber = (title: string): number | null => {
    if (!title) return null;
    const match = title.match(/(?:Chapter|第)\s*([一二三四五六七八九十百千万零\d]+)/i);
    if (match && match[1]) {
        const numPart = match[1];
        if (/^\d+$/.test(numPart)) {
            return parseInt(numPart, 10);
        } else {
            return chineseToArabic(numPart);
        }
    }
    // Fallback for titles that are just numbers
    const numericMatch = title.match(/^\s*(\d+)\s*$/);
    if (numericMatch) {
      return parseInt(numericMatch[1], 10);
    }
    return null;
};

const sanitizeFilename = (name: string): string => {
  // Replace characters that are invalid in Windows, macOS, and Linux filenames.
  const sanitized = name.replace(/[\r\n]/g, ' ').replace(/[<>:"/\\|?*]+/g, '_');
  // Truncate if too long to be safe. 255 is a common limit. Let's use 230 to be safe.
  if (sanitized.length > 230) {
    return sanitized.substring(0, 230) + '...';
  }
  return sanitized;
};


const VoiceLibraryPage: React.FC = () => {
  const { projects, characters, selectedProjectId, assignAudioToLine, navigateTo } = useStore(state => ({
    projects: state.projects,
    characters: state.characters,
    selectedProjectId: state.selectedProjectId,
    assignAudioToLine: state.assignAudioToLine,
    navigateTo: state.navigateTo
  }));

  const [rows, setRows] = useState<VoiceLibraryRowState[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [serverHealth, setServerHealth] = useState<ServerHealth>('unknown');
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [generatedAudioUrls, setGeneratedAudioUrls] = useState<Record<string, string>>({});
  
  const [chapterFilter, setChapterFilter] = useState('');
  const [isCharacterDropdownOpen, setIsCharacterDropdownOpen] = useState(false);
  const [characterSearchTerm, setCharacterSearchTerm] = useState('');
  const characterDropdownRef = useRef<HTMLDivElement>(null);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [activePlayerKey, setActivePlayerKey] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);

  const objectUrlsRef = useRef<Record<string, string>>({});
  const generatedUrlsRef = useRef<Record<string, string>>({});
  generatedUrlsRef.current = generatedAudioUrls;

  useEffect(() => {
    // This effect's cleanup function will run ONLY when the component unmounts.
    return () => {
      // Revoke all created blob URLs to prevent memory leaks.
      const promptUrls = objectUrlsRef.current;
      const genUrls = generatedUrlsRef.current;
      Object.values(promptUrls).forEach(url => URL.revokeObjectURL(url));
      Object.values(genUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, []); // Empty dependency array ensures this runs only once on mount/unmount.

  const currentProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const charactersInProject = useMemo(() => characters.filter(c => c.status !== 'merged' && c.name !== '[静音]' && c.name !== '音效'), [characters]);
  const selectedCharacter = useMemo(() => characters.find(c => c.id === selectedCharacterId), [characters, selectedCharacterId]);

  const filteredCharactersForDropdown = useMemo(() => {
    if (!characterSearchTerm) return charactersInProject;
    const lowerSearch = characterSearchTerm.toLowerCase();
    return charactersInProject.filter(c => 
        c.name.toLowerCase().includes(lowerSearch) || 
        c.cvName?.toLowerCase().includes(lowerSearch)
    );
  }, [charactersInProject, characterSearchTerm]);

  const checkServerHealth = useCallback(async () => {
    setServerHealth('checking');
    try {
      const response = await fetch(`${TTS_API_BASE_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          setServerHealth('ok');
        } else {
          setServerHealth('error');
        }
      } else {
        setServerHealth('error');
      }
    } catch (error) {
      setServerHealth('error');
    }
  }, []);

  const onGoBack = () => {
    selectedProjectId ? navigateTo("editor") : navigateTo("dashboard");
  };

  useEffect(() => {
    checkServerHealth();
  }, [checkServerHealth]);

  useEffect(() => {
      const syncAudioUrls = async () => {
          if (!currentProject) return;

          const newUrls: Record<string, string> = {};
          const lineIdToRowIdMap = new Map(rows.filter(r => r.originalLineId).map(r => [r.originalLineId!, r.id]));
          const existingGeneratedUrls = generatedUrlsRef.current;

          for (const chapter of currentProject.chapters) {
              for (const line of chapter.scriptLines) {
                  const rowId = lineIdToRowIdMap.get(line.id);
                  if (typeof rowId === 'string' && line.audioBlobId) {
                      if (!existingGeneratedUrls[rowId]) { 
                          const audioBlob = await db.audioBlobs.get(line.audioBlobId);
                          if (audioBlob) {
                              newUrls[rowId] = URL.createObjectURL(audioBlob.data);
                          }
                      }
                  }
              }
          }
          if (Object.keys(newUrls).length > 0) {
            setGeneratedAudioUrls(prev => ({ ...prev, ...newUrls }));
          }
      };

      syncAudioUrls();
  }, [currentProject, rows]); 

  useEffect(() => {
    if (!selectedCharacterId || !currentProject) {
      setRows([]);
      return;
    }
    
    const chapterMatchesFilter = (chapter: Chapter): boolean => {
      const filter = chapterFilter.trim();
      if (!filter) {
        return true;
      }
      
      const rangeMatch = filter.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const chapterNum = getChapterNumber(chapter.title);
        return chapterNum !== null && chapterNum >= start && chapterNum <= end;
      }
      
      return chapter.title.includes(filter);
    };

    const scriptLines: { id: string, text: string }[] = [];
    currentProject.chapters.forEach(chapter => {
      if (chapterMatchesFilter(chapter)) {
        chapter.scriptLines.forEach(line => {
          if (line.characterId === selectedCharacterId) {
            scriptLines.push({ id: line.id, text: line.text });
          }
        });
      }
    });

    setRows(scriptLines.map(line => ({
      id: `row_${line.id}_${Math.random()}`,
      promptFilePath: null,
      promptAudioUrl: null,
      promptFileName: null,
      text: line.text,
      status: 'idle',
      audioUrl: null,
      error: null,
      originalLineId: line.id,
    })));

  }, [selectedCharacterId, chapterFilter, currentProject, characters]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (characterDropdownRef.current && !characterDropdownRef.current.contains(event.target as Node)) {
        setIsCharacterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelectCharacter = (charId: string) => {
    setSelectedCharacterId(charId);
    setIsCharacterDropdownOpen(false);
    setCharacterSearchTerm('');
  };

  const updateRow = useCallback((id: string, updates: Partial<VoiceLibraryRowState>) => {
    setRows(prevRows => prevRows.map(row => row.id === id ? { ...row, ...updates } : row));
  }, []);

  const handleUpload = useCallback(async (rowId: string, file: File) => {
    const existingUrl = objectUrlsRef.current[rowId];
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
    }
    const newUrl = URL.createObjectURL(file);
    objectUrlsRef.current[rowId] = newUrl;

    updateRow(rowId, { 
        status: 'uploading', 
        error: null, 
        promptAudioUrl: newUrl,
        promptFileName: file.name 
    });
    
    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch(`${TTS_API_BASE_URL}/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`上传失败: ${res.statusText}`);
      const data = await res.json();
      updateRow(rowId, { promptFilePath: data.filePath, status: 'idle' });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知上传错误';
      updateRow(rowId, { status: 'error', error: errorMsg, promptFilePath: null });
    }
  }, [updateRow]);

  const processAndAssignAudio = async (row: VoiceLibraryRowState, audioPath: string) => {
    if (!row.originalLineId || !selectedProjectId || !currentProject) return;

    let chapterId: string | undefined;
    for (const chapter of currentProject.chapters) {
      if (chapter.scriptLines.some(line => line.id === row.originalLineId)) {
        chapterId = chapter.id;
        break;
      }
    }

    if (!chapterId) {
      updateRow(row.id, { status: 'error', error: '找不到原始章节' });
      return;
    }
    
    const fullAudioUrl = audioPath.startsWith('http') 
        ? audioPath 
        : `${TTS_SERVER_ORIGIN}/${audioPath.replace(/\\/g, '/').replace(/^\//, '')}`;

    try {
        const audioRes = await fetch(fullAudioUrl);
        if (!audioRes.ok) throw new Error('下载生成的音频失败');
        const audioBlob = await audioRes.blob();
        await assignAudioToLine(selectedProjectId, chapterId, row.originalLineId, audioBlob);
        updateRow(row.id, { status: 'done' });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '保存音频失败';
      updateRow(row.id, { status: 'error', error: errorMsg });
    }
  };

  const handleBatchGenerate = useCallback(async () => {
    if (!currentProject || !selectedCharacter) return;
    const rowsToProcess = rows.filter(r => r.text.trim() && r.promptFilePath && r.originalLineId);
    if (rowsToProcess.length === 0) {
      alert('没有可生成的行。请确保至少有一行已上传参考音频、填写了台词并且是从项目中加载的。');
      return;
    }

    setIsGenerating(true);
    rowsToProcess.forEach(r => updateRow(r.id, { status: 'generating', error: null }));

    const items = rowsToProcess.map(r => ({ 
        promptAudio: r.promptFilePath, 
        text: r.text
    }));

    try {
      const res = await fetch(`${TTS_API_BASE_URL}/batch-tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, options: { do_sample: true, top_p: 0.8 } }),
      });

      if (!res.ok) throw new Error(`批量生成失败: ${res.statusText}`);
      const result = await res.json();

      for (let i = 0; i < result.items.length; i++) {
        const item = result.items[i];
        const correspondingRow = rowsToProcess[i];
        if (item.ok && item.audioUrl) {
          // FIX: Explicitly cast item.audioUrl to string. The 'unknown' type from res.json() is not assignable to the 'string' parameter of processAndAssignAudio.
          await processAndAssignAudio(correspondingRow, item.audioUrl as string);
        } else {
          // FIX: Explicitly cast item.error to string as it is of type 'unknown'.
          updateRow(correspondingRow.id, { status: 'error', error: String(item.error || '生成失败') });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      rowsToProcess.forEach(r => updateRow(r.id, { status: 'error', error: errorMsg }));
    } finally {
      setIsGenerating(false);
    }
  }, [rows, updateRow, currentProject, selectedCharacter, assignAudioToLine]);
  
  const handleGenerateSingle = useCallback(async (rowId: string) => {
    const rowToProcess = rows.find(r => r.id === rowId);
    if (!rowToProcess || !rowToProcess.text.trim() || !rowToProcess.promptFilePath) {
      alert('请确保已上传参考音频并填写了台词。');
      return;
    }
    if (!selectedCharacter) {
        alert('请先选择一个角色。');
        return;
    }
     if (!rowToProcess.originalLineId) {
      alert('手动添加的行无法自动同步到对轨页面，请使用批量生成或在对轨页手动上传。');
      return;
    }

    updateRow(rowId, { status: 'generating', error: null });

    const item = { 
        promptAudio: rowToProcess.promptFilePath, 
        text: rowToProcess.text
    };

    try {
      const res = await fetch(`${TTS_API_BASE_URL}/batch-tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [item] }), // Send as a single-item array
      });

      if (!res.ok) throw new Error(`生成失败: ${res.statusText}`);
      const result = await res.json();
      
      const resultItem = result.items[0];
      if (resultItem.ok && resultItem.audioUrl) {
        // FIX: Explicitly cast resultItem.audioUrl to string. The 'unknown' type from res.json() is not assignable to the 'string' parameter of processAndAssignAudio.
        await processAndAssignAudio(rowToProcess, resultItem.audioUrl as string);
      } else {
        // FIX: Explicitly cast resultItem.error to string as it is of type 'unknown'.
        updateRow(rowId, { status: 'error', error: String(resultItem.error || '生成失败') });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      updateRow(rowId, { status: 'error', error: errorMsg });
    }
}, [rows, updateRow, selectedCharacter, assignAudioToLine]);

  const handleDeleteGeneratedAudio = useCallback(async (rowId: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row || !row.originalLineId || !selectedProjectId || !currentProject) return;

    let chapterId: string | undefined;
    let lineId: string | undefined;
    let audioBlobId: string | undefined;

    for (const chapter of currentProject.chapters) {
      const line = chapter.scriptLines.find(l => l.id === row.originalLineId);
      if (line) {
        chapterId = chapter.id;
        lineId = line.id;
        audioBlobId = line.audioBlobId;
        break;
      }
    }

    if (chapterId && lineId && audioBlobId) {
        await db.audioBlobs.delete(audioBlobId);
        await useStore.getState().updateLineAudio(selectedProjectId, chapterId, lineId, null);
    }
    
    setGeneratedAudioUrls(prev => {
        const newUrls = { ...prev };
        if (newUrls[rowId]) {
            URL.revokeObjectURL(newUrls[rowId]);
            delete newUrls[rowId];
        }
        return newUrls;
    });

  }, [rows, selectedProjectId, currentProject]);

  const handleDeletePromptAudio = useCallback((rowId: string) => {
    const urlToRemove = objectUrlsRef.current[rowId];
    if (urlToRemove) {
      URL.revokeObjectURL(urlToRemove);
      delete objectUrlsRef.current[rowId];
    }
    updateRow(rowId, { 
      promptFilePath: null, 
      promptAudioUrl: null, 
      promptFileName: null,
      status: 'idle',
      error: null,
    });
  }, [updateRow]);

  const addEmptyRow = () => {
    const newRow: VoiceLibraryRowState = {
      id: `row_manual_${Date.now()}`,
      promptFilePath: null,
      promptAudioUrl: null,
      promptFileName: null,
      text: '',
      status: 'idle',
      audioUrl: null,
      error: null,
    };
    setRows(prev => [...prev, newRow]);
  };
  
  const removeRow = (id: string) => {
    const urlToRemove = objectUrlsRef.current[id];
    if (urlToRemove) {
      URL.revokeObjectURL(urlToRemove);
      delete objectUrlsRef.current[id];
    }
    setRows(prev => prev.filter(row => row.id !== id));
  };

    const handleExport = async () => {
        if (!currentProject || !selectedCharacter) return;
        
        const rowsToExport = rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId);

        if (rowsToExport.length === 0) {
            alert('当前页面没有可导出的已生成音频。');
            return;
        }

        setIsExportModalOpen(false);
        setIsExporting(true);

        try {
            const linesWithAudio: { line: ScriptLine; audioBlob: Blob; }[] = [];
            
            const lineIdToChapterId = new Map<string, string>();
            currentProject.chapters.forEach(ch => {
                ch.scriptLines.forEach(line => {
                    lineIdToChapterId.set(line.id, ch.id);
                });
            });

            for (const row of rowsToExport) {
                const lineId = row.originalLineId!;
                const chapterId = lineIdToChapterId.get(lineId);
                
                if (chapterId) {
                    const chapter = currentProject.chapters.find(ch => ch.id === chapterId);
                    const line = chapter?.scriptLines.find(l => l.id === lineId);
                    
                    if (line?.audioBlobId) {
                         const audioBlobFromDb = await db.audioBlobs.get(line.audioBlobId);
                         if (audioBlobFromDb) {
                             linesWithAudio.push({
                                 line,
                                 audioBlob: audioBlobFromDb.data,
                             });
                         }
                    }
                }
            }

            if (linesWithAudio.length === 0) {
                alert('未找到与音频文件关联的脚本行。');
                return;
            }

            const waveBlob = await exportAudioWithMarkers(linesWithAudio);
            
            const url = URL.createObjectURL(waveBlob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${currentProject.name}_${selectedCharacter.name}_TTS_Marked.wav`;
            a.download = fileName.replace(/[<>:"/\\|?*]+/g, '_');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("导出音频时出错:", error);
            alert(`导出音频时出错: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setIsExporting(false);
        }
    };
    
  const handleExportCharacterClips = async () => {
    if (!selectedCharacter) {
        alert('请先选择一个角色。');
        return;
    }
    if (!currentProject) {
        alert('未找到当前项目。');
        return;
    }

    const rowsToExport = rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId);

    if (rowsToExport.length === 0) {
        alert('没有可导出的音频片段。请先生成或对轨音频。');
        return;
    }

    setIsExporting(true);

    try {
        const zip = new JSZip();
        const lineIdToChapterIdMap = new Map<string, string>();
        currentProject.chapters.forEach(ch => {
            ch.scriptLines.forEach(line => {
                lineIdToChapterIdMap.set(line.id, ch.id);
            });
        });

        for (const row of rowsToExport) {
            const lineId = row.originalLineId!;
            const chapterId = lineIdToChapterIdMap.get(lineId);

            if (chapterId) {
                const chapter = currentProject.chapters.find(ch => ch.id === chapterId);
                const line = chapter?.scriptLines.find(l => l.id === lineId);
                
                if (line?.audioBlobId) {
                    const audioBlobFromDb = await db.audioBlobs.get(line.audioBlobId);
                    if (audioBlobFromDb) {
                        let baseName = '';
                        if (selectedCharacter.cvName) {
                            baseName = `【${selectedCharacter.cvName}-${selectedCharacter.name}】${line.text}`;
                        } else {
                            baseName = `【${selectedCharacter.name}】${line.text}`;
                        }
                        const filename = sanitizeFilename(baseName) + '.mp3';

                        zip.file(filename, audioBlobFromDb.data);
                    }
                }
            }
        }
        
        const zipBlob = await zip.generateAsync({ type: "blob" });
        
        const zipFilename = sanitizeFilename(`${currentProject.name}_${selectedCharacter.name}_片段`) + '.zip';
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert(`已开始导出包含 ${rowsToExport.length} 个音频文件的 .zip 压缩包。`);

    } catch (error) {
        console.error("导出角色片段时出错:", error);
        alert(`导出时出错: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
        setIsExporting(false);
    }
  };


  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
        <h1 className="text-2xl font-bold text-sky-400">音色库 (本地TTS)</h1>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-sm">
            <span>本地服务状态:</span>
            {serverHealth === 'checking' && <span className="text-yellow-400">检查中...</span>}
            {serverHealth === 'ok' && <span className="flex items-center text-green-400"><CheckCircleIcon className="w-4 h-4 mr-1"/>正常</span>}
            {serverHealth === 'error' && <span className="flex items-center text-red-400"><XMarkIcon className="w-4 h-4 mr-1"/>异常</span>}
            {serverHealth === 'unknown' && <span className="text-slate-500">未知</span>}
          </div>
          <button onClick={checkServerHealth} disabled={serverHealth==='checking'} className="text-xs p-1 text-slate-400 hover:text-white disabled:opacity-50">重试</button>
          <button
            onClick={handleBatchGenerate}
            disabled={isGenerating || serverHealth !== 'ok'}
            className="flex items-center text-sm text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            {isGenerating ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4 mr-1" />}
            {isGenerating ? '生成中...' : '批量生成'}
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isGenerating || isExporting || rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId).length === 0}
            className="flex items-center text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            {isExporting ? <LoadingSpinner /> : <ArrowDownTrayIcon className="w-4 h-4 mr-1" />}
            {isExporting ? '导出中...' : '导出'}
          </button>
          <button onClick={onGoBack} className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md">
            <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回
          </button>
        </div>
      </header>
      
      <div className="p-4 flex-shrink-0 border-b border-slate-800 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
            <label htmlFor="character-select" className="text-sm font-medium whitespace-nowrap">选择角色:</label>
            <div ref={characterDropdownRef} className="relative w-48">
                <button
                    onClick={() => setIsCharacterDropdownOpen(prev => !prev)}
                    disabled={!currentProject}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 p-2 flex justify-between items-center disabled:opacity-50"
                >
                    <span className="truncate">{selectedCharacter ? selectedCharacter.name : (currentProject ? '选择角色...' : '无项目')}</span>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {isCharacterDropdownOpen && (
                    <div className="absolute z-30 mt-1 w-full bg-slate-800 rounded-md shadow-lg border border-slate-600 max-h-96 flex flex-col">
                        <div className="p-2 border-b border-slate-700">
                           <div className="relative">
                               <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2"/>
                               <input
                                   type="text"
                                   placeholder="搜索角色或CV..."
                                   value={characterSearchTerm}
                                   onChange={e => setCharacterSearchTerm(e.target.value)}
                                   className="w-full bg-slate-700 text-sm rounded-md pl-7 p-1.5 focus:ring-1 focus:ring-sky-500 outline-none"
                               />
                           </div>
                        </div>
                        <ul className="overflow-y-auto">
                            {filteredCharactersForDropdown.length === 0 ? (
                                <li className="px-3 py-2 text-sm text-slate-400">未找到角色</li>
                            ) : (
                                filteredCharactersForDropdown.map(char => (
                                    <li key={char.id} onClick={() => handleSelectCharacter(char.id)} className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer flex justify-between">
                                        <span>{char.name}</span>
                                        {char.cvName && <span className="text-xs text-slate-400">{char.cvName}</span>}
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                )}
            </div>
        </div>
        <div className="flex items-center gap-2">
            <label htmlFor="chapter-filter" className="text-sm font-medium whitespace-nowrap">章节筛选:</label>
            <input
                id="chapter-filter"
                type="text"
                value={chapterFilter}
                onChange={(e) => setChapterFilter(e.target.value)}
                placeholder="例如: 405 或 405-420"
                className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 p-2 w-48"
                disabled={!selectedCharacterId}
            />
        </div>
        <button onClick={addEmptyRow} className="flex items-center text-sm text-green-300 hover:text-green-100 px-3 py-1.5 bg-green-800/50 hover:bg-green-700/50 rounded-md">
            <PlusIcon className="w-4 h-4 mr-1" /> 添加空行
        </button>
        <button
            onClick={handleExportCharacterClips}
            disabled={isGenerating || isExporting || !selectedCharacterId || rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId).length === 0}
            className="flex items-center text-sm text-fuchsia-300 hover:text-fuchsia-100 px-3 py-1.5 bg-fuchsia-800/50 hover:bg-fuchsia-700/50 rounded-md disabled:opacity-50"
            title="将当前筛选出的、已有音频的片段批量导出为 mp3 文件"
          >
            {isExporting ? <LoadingSpinner /> : <ArrowDownTrayIcon className="w-4 h-4 mr-1" />}
            {isExporting ? '导出中...' : '导出角色片段'}
          </button>
      </div>

      <main className="flex-grow overflow-y-auto">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-x-4 px-4 py-2 text-sm font-semibold text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>参考音频 (拖拽上传)</div>
          <div>台词文本 {selectedCharacter && <span className="text-sky-400 font-semibold ml-2">【{selectedCharacter.name}】</span>}</div>
          <div>生成结果</div>
          <div className="w-8"></div>
        </div>
        <div className="p-4 space-y-3">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
                <p>{selectedCharacterId ? '此角色在此章节筛选条件下没有台词。' : '请从上方选择一个角色以加载台词。'}</p>
                <p>或点击“添加空行”手动创建。</p>
            </div>
          ) : (
             rows.map(row => (
                <VoiceLibraryRow
                    key={row.id}
                    row={{...row, audioUrl: generatedAudioUrls[row.id] || null}}
                    character={selectedCharacter}
                    isBatchGenerating={isGenerating}
                    onTextChange={(text) => updateRow(row.id, { text })}
                    onFileUpload={(file) => handleUpload(row.id, file)}
                    onRemove={() => removeRow(row.id)}
                    onGenerateSingle={() => handleGenerateSingle(row.id)}
                    onDeleteGeneratedAudio={() => handleDeleteGeneratedAudio(row.id)}
                    onDeletePromptAudio={() => handleDeletePromptAudio(row.id)}
                    audioContext={audioContextRef.current}
                    activePlayerKey={activePlayerKey}
                    setActivePlayerKey={setActivePlayerKey}
                />
             ))
          )}
        </div>
      </main>
      <ExportVoiceLibraryModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleExport}
        exportCount={rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId).length}
      />
    </div>
  );
};

export default VoiceLibraryPage;