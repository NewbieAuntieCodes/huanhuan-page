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
import { useAudioFileMatcher } from './hooks/useAudioFileMatcher';
import ResizablePanels from '../../components/ui/ResizablePanels';
import { usePaginatedChapters } from '../scriptEditor/hooks/usePaginatedChapters';
import ChapterPagination from '../scriptEditor/components/chapter_list_panel/ChapterPagination';


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
    mergeWithNextAndShift,
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
    mergeWithNextAndShift: state.mergeWithNextAndShift,
    navigateTo: state.navigateTo,
    openConfirmModal: state.openConfirmModal,
    clearAudioFromChapter: state.clearAudioFromChapter,
  }));

  const cvMatchFileInputRef = useRef<HTMLInputElement>(null);
  const characterMatchFileInputRef = useRef<HTMLInputElement>(null);
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
  
  const {
    isCvMatchLoading,
    handleFileSelectionForCvMatch,
    isCharacterMatchLoading,
    handleFileSelectionForCharacterMatch,
    isChapterMatchLoading,
    handleFileSelectionForChapterMatch,
  } = useAudioFileMatcher({
    currentProject,
    characters,
    assignAudioToLine,
  });


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
  
  const {
      currentPage,
      totalPages,
      paginatedChapters,
      handlePageChange,
  } = usePaginatedChapters({
      chapters: currentProject?.chapters || [],
      projectId: currentProject?.id,
      initialSelectedChapterIdForViewing: selectedChapterId,
      onSelectChapterForViewing: setSelectedChapterId,
      multiSelectedChapterIds: [], // Not used here
      setMultiSelectedChapterIdsContext: () => {}, // Not used here
      onPageChangeSideEffects: () => {},
      chaptersPerPage: 50,
  });


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
        await mergeWithNextAndShift(currentProject.id, selectedChapter.id, mergeModalInfo.lineId, shiftMode);
    }
    setMergeModalInfo({ isOpen: false, lineId: null, character: undefined });
  };

  const mergeability = useMemo(() => {
    if (!playingLineInfo || !selectedChapter) return { canMerge: false, reason: "没有正在播放的音频行。" };
    const { line: currentLine, character: currentChar } = playingLineInfo;

    if (!currentChar || nonAudioCharacterIds.includes(currentChar.id) || !currentLine.audioBlobId) {
        return { canMerge: false, reason: "当前行没有音频或为特殊行(静音/音效)。" };
    }
    
    const lineIndex = selectedChapter.scriptLines.findIndex(l => l.id === currentLine.id);
    if (lineIndex < 0 || lineIndex >= selectedChapter.scriptLines.length - 1) {
        return { canMerge: false, reason: "这是本章最后一句台词。" };
    }

    // Find the next line with the same character
    for (let i = lineIndex + 1; i < selectedChapter.scriptLines.length; i++) {
        const potentialNextLine = selectedChapter.scriptLines[i];
        if (potentialNextLine.characterId === currentLine.characterId) {
            // Found the next line by the same character. Now check if it's mergeable.
            if (!potentialNextLine.audioBlobId) {
                return { canMerge: false, reason: "无法合并：下一个同角色的台词行没有音频。" };
            }
            return { canMerge: true, reason: "与下一行合并" };
        }
    }
    
    // If loop completes without finding a match
    return { canMerge: false, reason: "后面没有可合并的同角色台词行。" };

  }, [playingLineInfo, selectedChapter, nonAudioCharacterIds]);


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
  
  const ChapterList = (
    <div className="p-3 h-full flex flex-col bg-slate-800 text-slate-100">
      <h2 className="text-lg font-semibold text-slate-300 mb-3">章节列表 ({currentProject.chapters.length})</h2>
      
      <div className="flex-grow overflow-y-auto space-y-1 pr-1 -mr-1">
          {paginatedChapters.map(chapter => (
              <li key={chapter.id} className="list-none">
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
      </div>

      <ChapterPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          isAnyOperationLoading={false}
          isEditingTitle={false}
      />
    </div>
  );

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
        <ResizablePanels
          leftPanel={ChapterList}
          rightPanel={
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
          }
          initialLeftWidthPercent={25}
        />
      </div>
      <GlobalAudioPlayer 
        onSplitRequest={handleSplitRequest} 
        onMergeRequest={handleRequestMerge} 
        canMerge={mergeability.canMerge}
        mergeDisabledReason={mergeability.reason}
       />
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