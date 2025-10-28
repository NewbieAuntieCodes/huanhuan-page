





import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { ChevronLeftIcon, BookOpenIcon, UploadIcon, UserCircleIcon, ListBulletIcon, ArrowDownTrayIcon, SpeakerXMarkIcon } from '../../components/ui/icons';
import AudioScriptLine from './components/AudioScriptLine';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ExportAudioModal from './components/ExportAudioModal';
import { exportAudioWithMarkers } from '../../lib/wavExporter';
import { db } from '../../db';
import { ScriptLine, Chapter, Character } from '../../types';
import SplitAudioModal, { ShiftMode } from './components/SplitAudioModal';
import ShiftAudioModal from './components/ShiftAudioModal';
import ShiftUpAudioModal from './components/ShiftUpAudioModal';
import MergeAudioModal from './components/MergeAudioModal';


const parseChapterIdentifier = (identifier: string): string[] => {
    if (identifier.includes('-')) {
        const parts = identifier.split('-').map(p => parseInt(p, 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const [start, end] = parts;
            const range = [];
            for (let i = start; i <= end; i++) {
                range.push(i.toString());
            }
            return range;
        }
    }
    if (!isNaN(parseInt(identifier, 10))) {
        return [identifier];
    }
    return []; 
};


const AudioAlignmentPage: React.FC = () => {
  const { 
    projects, 
    characters, 
    selectedProjectId, 
    selectedChapterId, 
    setSelectedChapterId,
    playingLineInfo,
    assignAudioToLine,
    splitAndShiftAudio,
    shiftAudioDown,
    shiftAudioUp,
    mergeAudioUp,
    navigateTo,
    openConfirmModal,
    clearAudioFromChapter,
  } = useStore(state => ({
    projects: state.projects,
    characters: state.characters,
    selectedProjectId: state.selectedProjectId,
    selectedChapterId: state.selectedChapterId,
    setSelectedChapterId: state.setSelectedChapterId,
    playingLineInfo: state.playingLineInfo,
    assignAudioToLine: state.assignAudioToLine,
    splitAndShiftAudio: state.splitAndShiftAudio,
    shiftAudioDown: state.shiftAudioDown,
    shiftAudioUp: state.shiftAudioUp,
    mergeAudioUp: state.mergeAudioUp,
    navigateTo: state.navigateTo,
    openConfirmModal: state.openConfirmModal,
    clearAudioFromChapter: state.clearAudioFromChapter,
  }));

  const [isCvMatchLoading, setIsCvMatchLoading] = useState(false);
  const cvMatchFileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCharacterMatchLoading, setIsCharacterMatchLoading] = useState(false);
  const characterMatchFileInputRef = useRef<HTMLInputElement>(null);

  const [isChapterMatchLoading, setIsChapterMatchLoading] = useState(false);
  const chapterMatchFileInputRef = useRef<HTMLInputElement>(null);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [splitModalInfo, setSplitModalInfo] = useState<{ isOpen: boolean; lineId: string | null; character: Character | undefined, splitTime: number | null }>({
    isOpen: false,
    lineId: null,
    character: undefined,
    splitTime: null,
  });

  const [shiftModalInfo, setShiftModalInfo] = useState<{ isOpen: boolean; lineId: string | null; character: Character | undefined }>({
    isOpen: false,
    lineId: null,
    character: undefined,
  });

  const [shiftUpModalInfo, setShiftUpModalInfo] = useState<{ isOpen: boolean; lineId: string | null; character: Character | undefined }>({
    isOpen: false,
    lineId: null,
    character: undefined,
  });

  const [mergeModalInfo, setMergeModalInfo] = useState<{ isOpen: boolean; lineId: string | null; character: Character | undefined }>({
    isOpen: false,
    lineId: null,
    character: undefined,
  });


  const currentProject = projects.find(p => p.id === selectedProjectId);
  const selectedChapter = currentProject?.chapters.find(c => c.id === selectedChapterId);

  const nonAudioCharacterIds = useMemo(() => {
    return characters
      .filter(c => c.name === '[静音]' || c.name === '音效')
      .map(c => c.id);
  }, [characters]);

  const visibleScriptLines = useMemo(() => {
    if (!selectedChapter) return [];
    if (nonAudioCharacterIds.length === 0) return selectedChapter.scriptLines;
    return selectedChapter.scriptLines.filter(line => !nonAudioCharacterIds.includes(line.characterId || ''));
  }, [selectedChapter, nonAudioCharacterIds]);

  const onGoBack = () => {
    selectedProjectId ? navigateTo("editor") : navigateTo("dashboard");
  }

  const handleCvMatchClick = () => {
    cvMatchFileInputRef.current?.click();
  };
  
  const handleCharacterMatchClick = () => {
    characterMatchFileInputRef.current?.click();
  };
  
  const handleChapterMatchClick = () => {
    chapterMatchFileInputRef.current?.click();
  };

  const handleFileSelectionForCvMatch = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !currentProject) return;
  
      setIsCvMatchLoading(true);
  
      const cvFileGroups = new Map<string, { file: File; sequence: number; chapterMatchers: string[] }[]>();
  
      // FIX: Replaced for...of loop with a standard for loop to ensure `file` is correctly typed as `File` and resolve TS errors.
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
          const parts = nameWithoutExt.split('_');
  
          if (parts.length === 3) { // Expecting chapter_cv_seq
              const chapterIdentifier = parts[0];
              const cvName = parts[1];
              const sequence = parseInt(parts[2], 10);
  
              if (cvName && !isNaN(sequence)) {
                  if (!cvFileGroups.has(cvName)) {
                      cvFileGroups.set(cvName, []);
                  }
                  cvFileGroups.get(cvName)!.push({
                      file: file,
                      sequence,
                      chapterMatchers: parseChapterIdentifier(chapterIdentifier),
                  });
              }
          }
      }
      
      let matchedCount = 0;
      let missedCount = 0;
  
      for (const [cvName, filesForCv] of cvFileGroups.entries()) {
          const targetCharacterIds = new Set(
              characters.filter(c => c.cvName === cvName && c.status !== 'merged').map(c => c.id)
          );
          if (targetCharacterIds.size === 0) {
              missedCount += filesForCv.length;
              continue;
          }
  
          const allChapterMatchers = new Set<string>();
          filesForCv.forEach(f => f.chapterMatchers.forEach(m => allChapterMatchers.add(m)));
  
          const targetChapters = currentProject.chapters.filter(chapter => 
              Array.from(allChapterMatchers).some(matcher => chapter.title.includes(matcher))
          );
  
          if (targetChapters.length === 0) {
              missedCount += filesForCv.length;
              continue;
          }
          
          const chapterOrderMap = new Map(currentProject.chapters.map((ch, i) => [ch.id, i]));
          // FIX: Rewrote sort comparator to be more explicit and robust, avoiding potential TypeScript errors with arithmetic operations on potentially undefined values from the map.
          targetChapters.sort((a: Chapter, b: Chapter) => {
            const aIndex = chapterOrderMap.get(a.id);
            const bIndex = chapterOrderMap.get(b.id);
            if (typeof aIndex === 'number' && typeof bIndex === 'number') {
              return aIndex - bIndex;
            }
            if (typeof aIndex === 'number') {
              return -1; // b is undefined, so a comes first
            }
            if (typeof bIndex === 'number') {
              return 1; // a is undefined, so b comes first
            }
            return 0; // both undefined
          });
  
          const targetLines: { line: ScriptLine; chapterId: string }[] = [];
          for (const chapter of targetChapters) {
              for (const line of chapter.scriptLines) {
                  if (line.characterId && targetCharacterIds.has(line.characterId)) {
                      targetLines.push({ line, chapterId: chapter.id });
                  }
              }
          }
  
          const sortedFiles = filesForCv.sort((a, b) => a.sequence - b.sequence);
  
          const limit = Math.min(targetLines.length, sortedFiles.length);
          for (let i = 0; i < limit; i++) {
              const { line, chapterId } = targetLines[i];
              const { file } = sortedFiles[i];
              await assignAudioToLine(currentProject.id, chapterId, line.id, file);
              matchedCount++;
          }
          missedCount += sortedFiles.length - limit;
      }
  
      setIsCvMatchLoading(false);
      alert(`按CV匹配完成。\n成功匹配: ${matchedCount} 个文件\n未匹配: ${missedCount} 个文件`);
  
      if (event.target) {
          event.target.value = '';
      }
  };
  
  const handleFileSelectionForCharacterMatch = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !currentProject) return;

      setIsCharacterMatchLoading(true);
      
      const fileGroups = new Map<string, { file: File; sequence: number }[]>();

      // FIX: Replaced for...of loop with a standard for loop to ensure `file` is correctly typed as `File` and resolve TS errors.
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
          const parts = nameWithoutExt.split('_');

          if (parts.length === 4) { // Expecting chapter_cv_char_seq
              const sequence = parseInt(parts[3], 10);
              if (!isNaN(sequence)) {
                  const baseName = `${parts[0]}_${parts[1]}_${parts[2]}`; // chapter_cv_char
                  if (!fileGroups.has(baseName)) {
                      fileGroups.set(baseName, []);
                  }
                  fileGroups.get(baseName)!.push({ file: file, sequence });
              }
          } else if (parts.length === 3) { // Expecting chapter_char_seq
              const sequence = parseInt(parts[2], 10);
              if (!isNaN(sequence)) {
                  const baseName = `${parts[0]}_${parts[1]}`; // chapter_char
                  const key = `NO_CV::${baseName}`; // Marker for no CV in filename
                  if (!fileGroups.has(key)) {
                      fileGroups.set(key, []);
                  }
                  fileGroups.get(key)!.push({ file: file, sequence });
              }
          }
      }

      let matchedCount = 0;
      let missedCount = 0;
      
      for (const [groupKey, filesForGroup] of fileGroups.entries()) {
          let chapterIdentifier: string;
          let characterName: string;
          let cvName: string | undefined;

          if (groupKey.startsWith('NO_CV::')) {
              const baseName = groupKey.replace('NO_CV::', '');
              const parts = baseName.split('_');
              chapterIdentifier = parts[0];
              characterName = parts[1];
              cvName = undefined;
          } else {
              const parts = groupKey.split('_');
              chapterIdentifier = parts[0];
              cvName = parts[1];
              characterName = parts[2];
          }

          if (!chapterIdentifier || !characterName) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const targetCharacters: Character[] = characters.filter(c => {
              const nameMatch = c.name === characterName;
              const cvMatch = cvName ? c.cvName === cvName : true; // If no cvName, match any CV for that character name.
              return nameMatch && cvMatch && c.status !== 'merged';
          });
          
          if (targetCharacters.length === 0) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const targetCharacterIds = new Set(targetCharacters.map(c => c.id));
          const chapterMatchers = parseChapterIdentifier(chapterIdentifier);
          if (chapterMatchers.length === 0) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const targetChapters = currentProject.chapters.filter(chapter => 
              chapterMatchers.some(matcher => chapter.title.includes(matcher))
          );
          
          if (targetChapters.length === 0) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const chapterOrderMap = new Map(currentProject.chapters.map((ch, i) => [ch.id, i]));
          targetChapters.sort((a: Chapter, b: Chapter) => {
            const aIndex = chapterOrderMap.get(a.id);
            const bIndex = chapterOrderMap.get(b.id);
            if (typeof aIndex === 'number' && typeof bIndex === 'number') return aIndex - bIndex;
            if (typeof aIndex === 'number') return -1;
            if (typeof bIndex === 'number') return 1;
            return 0;
          });
          
          const targetLines: { line: ScriptLine; chapterId: string }[] = [];
          for (const chapter of targetChapters) {
              for (const line of chapter.scriptLines) {
                  if (line.characterId && targetCharacterIds.has(line.characterId)) {
                      targetLines.push({ line, chapterId: chapter.id });
                  }
              }
          }
          
          const sortedFiles = filesForGroup.sort((a, b) => a.sequence - b.sequence);
          
          const limit = Math.min(targetLines.length, sortedFiles.length);
          for (let i = 0; i < limit; i++) {
              const { line, chapterId } = targetLines[i];
              const { file } = sortedFiles[i];
              await assignAudioToLine(currentProject.id, chapterId, line.id, file);
              matchedCount++;
          }
          missedCount += sortedFiles.length - limit;
      }
      
      setIsCharacterMatchLoading(false);
      alert(`按角色匹配完成。\n成功匹配: ${matchedCount} 个文件\n未匹配: ${missedCount} 个文件`);

      if (event.target) {
          event.target.value = '';
      }
  };

  const handleFileSelectionForChapterMatch = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentProject) return;

    setIsChapterMatchLoading(true);

    const chapterFileGroups = new Map<string, { file: File; sequence: number }[]>();

    // FIX: Replaced for...of loop with a standard for loop to ensure `file` is correctly typed as `File` and resolve TS errors.
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
        const parts = nameWithoutExt.split('_');

        if (parts.length === 2) { // Expecting chapter_seq
            const chapterIdentifier = parts[0];
            const sequence = parseInt(parts[1], 10);

            if (chapterIdentifier && !isNaN(sequence)) {
                if (!chapterFileGroups.has(chapterIdentifier)) {
                    chapterFileGroups.set(chapterIdentifier, []);
                }
                chapterFileGroups.get(chapterIdentifier)!.push({ file: file, sequence });
            }
        }
    }

    let matchedCount = 0;
    let missedCount = 0;

    for (const [chapterIdentifier, filesForGroup] of chapterFileGroups.entries()) {
        const chapterMatchers = parseChapterIdentifier(chapterIdentifier);
        if (chapterMatchers.length === 0) {
            missedCount += filesForGroup.length;
            continue;
        }

        const targetChapters = currentProject.chapters.filter(chapter =>
            chapterMatchers.some(matcher => chapter.title.includes(matcher))
        );

        if (targetChapters.length === 0) {
            missedCount += filesForGroup.length;
            continue;
        }

        const chapterOrderMap = new Map(currentProject.chapters.map((ch, i) => [ch.id, i]));
        targetChapters.sort((a: Chapter, b: Chapter) => {
            const aIndex = chapterOrderMap.get(a.id);
            const bIndex = chapterOrderMap.get(b.id);
            if (typeof aIndex === 'number' && typeof bIndex === 'number') return aIndex - bIndex;
            if (typeof aIndex === 'number') return -1;
            if (typeof bIndex === 'number') return 1;
            return 0;
        });

        const targetLines: { line: ScriptLine; chapterId: string }[] = [];
        for (const chapter of targetChapters) {
            for (const line of chapter.scriptLines) {
                targetLines.push({ line, chapterId: chapter.id });
            }
        }
        
        const sortedFiles = filesForGroup.sort((a, b) => a.sequence - b.sequence);
        
        const limit = Math.min(targetLines.length, sortedFiles.length);
        for (let i = 0; i < limit; i++) {
            const { line, chapterId } = targetLines[i];
            const { file } = sortedFiles[i];
            await assignAudioToLine(currentProject.id, chapterId, line.id, file);
            matchedCount++;
        }
        missedCount += sortedFiles.length - limit;
    }

    setIsChapterMatchLoading(false);
    alert(`按章节匹配完成。\n成功匹配: ${matchedCount} 个文件\n未匹配: ${missedCount} 个文件`);

    if (event.target) {
        event.target.value = '';
    }
  };

  const handleExport = async (scope: 'current' | 'all') => {
    if (!currentProject) return;
    setIsExportModalOpen(false);
    setIsExporting(true);

    try {
        const chaptersToExport = scope === 'current'
            ? selectedChapter ? [selectedChapter] : []
            : currentProject.chapters;

        if (chaptersToExport.length === 0) {
            alert('没有可导出的章节。');
            return;
        }

        const linesWithAudio = [];
        for (const chapter of chaptersToExport) {
            for (const line of chapter.scriptLines) {
                if (line.audioBlobId) {
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
            alert('所选范围内没有已对轨的音频可供导出。');
            return;
        }

        const waveBlob = await exportAudioWithMarkers(linesWithAudio);
        
        const url = URL.createObjectURL(waveBlob);
        const a = document.createElement('a');
        a.href = url;
        const fileNameScope = scope === 'current' && selectedChapter ? selectedChapter.title.replace(/[<>:"/\\|?*]+/g, '_') : 'AllChapters';
        a.download = `${currentProject.name}_${fileNameScope}_Marked.wav`;
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

  const handleClearChapterAudio = () => {
    if (currentProject && selectedChapter) {
        openConfirmModal(
          "清除章节音频确认",
          <>您确定要清除章节 <strong className="text-sky-300">{selectedChapter.title}</strong> 的所有已对轨音频吗？<br/>此操作无法撤销。</>,
          () => {
            clearAudioFromChapter(currentProject.id, selectedChapter.id);
          },
          "全部清除",
          "取消"
        );
    }
  };
  
  const handleSplitRequest = (splitTime: number, lineInfo: { line: ScriptLine; character: Character | undefined }) => {
    if (!lineInfo) return;
    setSplitModalInfo({
        isOpen: true,
        lineId: lineInfo.line.id,
        character: lineInfo.character,
        splitTime: splitTime,
    });
  };

  const handleSplitConfirm = async (shiftMode: ShiftMode) => {
    if (splitModalInfo.lineId && splitModalInfo.splitTime !== null && currentProject && selectedChapter) {
        await splitAndShiftAudio(currentProject.id, selectedChapter.id, splitModalInfo.lineId, splitModalInfo.splitTime, shiftMode);
    }
    setSplitModalInfo({ isOpen: false, lineId: null, character: undefined, splitTime: null });
  };
  
  const handleRequestShiftDown = (lineId: string, character: Character | undefined) => {
    setShiftModalInfo({
        isOpen: true,
        lineId: lineId,
        character: character,
    });
  };

  const handleShiftConfirm = async (shiftMode: ShiftMode) => {
    if (shiftModalInfo.lineId && currentProject && selectedChapter) {
        await shiftAudioDown(currentProject.id, selectedChapter.id, shiftModalInfo.lineId, shiftMode);
    }
    setShiftModalInfo({ isOpen: false, lineId: null, character: undefined });
  };

  const handleRequestShiftUp = (lineId: string, character: Character | undefined) => {
    setShiftUpModalInfo({
        isOpen: true,
        lineId: lineId,
        character: character,
    });
  };

  const handleShiftUpConfirm = async (shiftMode: ShiftMode) => {
    if (shiftUpModalInfo.lineId && currentProject && selectedChapter) {
        await shiftAudioUp(currentProject.id, selectedChapter.id, shiftUpModalInfo.lineId, shiftMode);
    }
    setShiftUpModalInfo({ isOpen: false, lineId: null, character: undefined });
  };
  
  const handleRequestMerge = (lineInfo: { line: ScriptLine; character: Character | undefined; }) => {
    if (!lineInfo) return;
    setMergeModalInfo({
        isOpen: true,
        lineId: lineInfo.line.id,
        character: lineInfo.character,
    });
  };

  const handleMergeConfirm = async (shiftMode: ShiftMode) => {
    if (mergeModalInfo.lineId && currentProject && selectedChapter) {
        await mergeAudioUp(currentProject.id, selectedChapter.id, mergeModalInfo.lineId, shiftMode);
    }
    setMergeModalInfo({ isOpen: false, lineId: null, character: undefined });
  };

  const canMergeDown = useMemo(() => {
    if (!playingLineInfo || !selectedChapter) return false;

    const lineIndex = selectedChapter.scriptLines.findIndex(l => l.id === playingLineInfo.line.id);
    if (lineIndex < 0 || lineIndex >= selectedChapter.scriptLines.length - 1) return false;

    const nextLine = selectedChapter.scriptLines[lineIndex + 1];
    
    if (!nextLine.audioBlobId || !playingLineInfo.line.audioBlobId) return false;
    
    if (nonAudioCharacterIds.includes(playingLineInfo.line.characterId || '')) return false;

    return true;
  }, [playingLineInfo, selectedChapter, characters, nonAudioCharacterIds]);


  const hasAudioInChapter = useMemo(() => {
    return selectedChapter?.scriptLines.some(l => l.audioBlobId) || false;
  }, [selectedChapter]);

  if (!currentProject) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center bg-slate-900 text-slate-100">
        <h1 className="text-2xl font-bold text-sky-400">音频对轨</h1>
        <p className="mt-4 text-slate-400">请先从项目面板选择一个项目。</p>
        <button
            onClick={onGoBack}
            className="mt-6 flex items-center text-sm text-sky-300 hover:text-sky-100 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回项目面板
        </button>
      </div>
    );
  }
  
  const hasAudioInProject = currentProject.chapters.some(c => c.scriptLines.some(l => l.audioBlobId));
  

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
        <h1 className="text-2xl font-bold text-sky-400 truncate pr-4">
          音频对轨: <span className="text-slate-200">{currentProject.name}</span>
        </h1>
        <div className="flex items-center space-x-2">
            <input 
                type="file" 
                multiple 
                accept="audio/*" 
                ref={chapterMatchFileInputRef} 
                onChange={handleFileSelectionForChapterMatch}
                className="hidden"
            />
            <input 
                type="file" 
                multiple 
                accept="audio/*" 
                ref={cvMatchFileInputRef} 
                onChange={handleFileSelectionForCvMatch}
                className="hidden"
            />
            <input 
                type="file" 
                multiple 
                accept="audio/*" 
                ref={characterMatchFileInputRef} 
                onChange={handleFileSelectionForCharacterMatch}
                className="hidden"
            />
            <button
                onClick={handleCvMatchClick}
                disabled={isCvMatchLoading}
                className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50"
                aria-label="按CV匹配批量上传"
            >
                {isCvMatchLoading ? <LoadingSpinner /> : <UploadIcon className="w-4 h-4 mr-1" />}
                {isCvMatchLoading ? '匹配中...' : '按CV匹配'}
            </button>
            <button
                onClick={handleCharacterMatchClick}
                disabled={isCharacterMatchLoading}
                className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50"
                aria-label="按角色匹配批量上传"
            >
                {isCharacterMatchLoading ? <LoadingSpinner /> : <UserCircleIcon className="w-4 h-4 mr-1" />}
                {isCharacterMatchLoading ? '匹配中...' : '按角色匹配'}
            </button>
            <button
                onClick={handleChapterMatchClick}
                disabled={isChapterMatchLoading}
                className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50"
                aria-label="按章节匹配批量上传"
            >
                {isChapterMatchLoading ? <LoadingSpinner /> : <ListBulletIcon className="w-4 h-4 mr-1" />}
                {isChapterMatchLoading ? '匹配中...' : '按章节匹配'}
            </button>
            <button
                onClick={() => setIsExportModalOpen(true)}
                disabled={isExporting}
                className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md disabled:opacity-50"
                aria-label="导出音频"
            >
                {isExporting ? <LoadingSpinner /> : <ArrowDownTrayIcon className="w-4 h-4 mr-1" />}
                {isExporting ? '导出中...' : '导出音频'}
            </button>
            <button
                onClick={handleClearChapterAudio}
                disabled={!selectedChapter || !hasAudioInChapter || isExporting}
                className="flex items-center text-sm text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 rounded-md disabled:opacity-50"
                aria-label="清除本章所有音频"
            >
                <SpeakerXMarkIcon className="w-4 h-4 mr-1" />
                清除本章音频
            </button>
            <button
                onClick={onGoBack}
                className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md"
                aria-label="Back"
            >
              <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回
            </button>
        </div>
      </header>
      <div className="flex flex-grow overflow-hidden">
        {/* Chapter Sidebar */}
        <aside className="w-64 bg-slate-800 p-3 flex-shrink-0 overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-300 mb-3">章节列表</h2>
            <ul className="space-y-1">
                {currentProject.chapters.map(chapter => (
                    <li key={chapter.id}>
                        <button
                            onClick={() => setSelectedChapterId(chapter.id)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                selectedChapterId === chapter.id
                                ? 'bg-sky-600 text-white font-semibold'
                                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                            }`}
                        >
                           {chapter.title}
                        </button>
                    </li>
                ))}
            </ul>
        </aside>

        {/* Main Content */}
        <main 
            className="flex-grow p-4 overflow-y-auto transition-all" 
            style={{ paddingBottom: playingLineInfo ? '8rem' : '1rem' }}
        >
            {selectedChapter ? (
                <div>
                    <h3 className="text-xl font-bold text-sky-300 mb-4">{selectedChapter.title}</h3>
                    <div className="space-y-3">
                        {visibleScriptLines.map(line => (
                            <AudioScriptLine
                                key={line.id}
                                line={line}
                                chapterId={selectedChapter.id}
                                projectId={currentProject.id}
                                character={characters.find(c => c.id === line.characterId)}
                                onRequestShiftDown={handleRequestShiftDown}
                                onRequestShiftUp={handleRequestShiftUp}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                    <BookOpenIcon className="w-16 h-16 mb-4"/>
                    <p className="text-lg">请从左侧选择一个章节开始对轨。</p>
                </div>
            )}
        </main>
      </div>
      <GlobalAudioPlayer onSplitRequest={handleSplitRequest} onMergeRequest={handleRequestMerge} canMerge={canMergeDown} />
      <ExportAudioModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        currentChapterTitle={selectedChapter?.title || null}
        projectTitle={currentProject.name}
        hasAudioInProject={hasAudioInProject}
      />
      <SplitAudioModal
        isOpen={splitModalInfo.isOpen}
        onClose={() => setSplitModalInfo({ isOpen: false, lineId: null, character: undefined, splitTime: null })}
        onConfirm={handleSplitConfirm}
        character={splitModalInfo.character}
      />
      <ShiftAudioModal
        isOpen={shiftModalInfo.isOpen}
        onClose={() => setShiftModalInfo({ isOpen: false, lineId: null, character: undefined })}
        onConfirm={handleShiftConfirm}
        character={shiftModalInfo.character}
      />
      <ShiftUpAudioModal
        isOpen={shiftUpModalInfo.isOpen}
        onClose={() => setShiftUpModalInfo({ isOpen: false, lineId: null, character: undefined })}
        onConfirm={handleShiftUpConfirm}
        character={shiftUpModalInfo.character}
      />
      <MergeAudioModal
        isOpen={mergeModalInfo.isOpen}
        onClose={() => setMergeModalInfo({ isOpen: false, lineId: null, character: undefined })}
        onConfirm={handleMergeConfirm}
        character={mergeModalInfo.character}
      />
    </div>
  );
};

export default AudioAlignmentPage;