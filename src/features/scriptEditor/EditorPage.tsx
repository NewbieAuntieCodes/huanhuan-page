import React, { useCallback, useMemo, useRef } from 'react';
import { Project, Character, ScriptLine, Chapter } from '../../types';
import { CVStylesMap } from '../../types';
import mammoth from 'mammoth';

// Components
import ResizablePanels from '../../components/ui/ResizablePanels';
import ChapterListPanel from './components/chapter_list_panel/ChapterListPanel';
import ScriptEditorPanel from './components/script_editor_panel/ScriptEditorPanel';
import { ControlsAndCharactersPanel } from './components/character_panel/ControlsAndCharactersPanel';
import CharacterDetailsSidePanel from './components/character_side_panel/CharacterDetailsSidePanel';
import ImportAnnotationModal from './components/editor_page_modal/ImportAnnotationModal';
import AddChaptersModal from './components/chapter_list_panel/AddChaptersModal';

// Hooks
import { useEnhancedEditorCoreLogic } from './hooks/useEnhancedEditorCoreLogic';
import { useScriptLineEditor } from './hooks/useScriptLineEditor';
import { useAiChapterAnnotator } from './hooks/useAiChapterAnnotator';
import { useManualChapterParser } from './hooks/useManualChapterParser';
import { useAnnotationImporter } from './hooks/useAnnotationImporter';
import { useCharacterSidePanel } from './hooks/useCharacterSidePanel';

// Context
import { EditorContext } from './contexts/EditorContext';

// Utils
import { parseImportedScriptToChapters } from '../../lib/scriptImporter';
import { parseHtmlWorkbook } from '../../lib/htmlScriptParser';
import useStore from '../../store/useStore';

interface EditorPageProps {
  projectId: string;
  projects: Project[];
  characters: Character[];
  allCvNames: string[];
  cvStyles: CVStylesMap;
  onProjectUpdate: (project: Project) => void;
  onAddCharacter: (character: Character) => Character;
  onDeleteCharacter: (characterId: string) => void;
  onDeleteChapters: (chapterIds: string[], undoableDelete: () => void) => void;
  onUpdateCharacterCV: (characterId: string, cvName: string, cvBgColor: string, cvTextColor: string) => Promise<void>;
  onToggleCharacterStyleLock: (characterId: string) => void;
  onBulkUpdateCharacterStylesForCV: (cvName: string, newBgColor: string, newTextColor: string) => void;
  onNavigateToDashboard: () => void;
  onOpenCharacterAndCvStyleModal: (character: Character | null) => void;
  onEditCharacter: (characterBeingEdited: Character, updatedCvName?: string, updatedCvBgColor?: string, updatedCvTextColor?: string) => Promise<void>;
}

const EditorPage: React.FC<EditorPageProps> = (props) => {
  const {
    projectId,
    projects,
    characters,
    allCvNames,
    cvStyles,
    onProjectUpdate,
    onAddCharacter,
    onDeleteCharacter,
    onDeleteChapters,
    onUpdateCharacterCV,
    onToggleCharacterStyleLock,
    onBulkUpdateCharacterStylesForCV,
    onOpenCharacterAndCvStyleModal,
    onEditCharacter,
  } = props;

  const coreLogic = useEnhancedEditorCoreLogic({
    projectId,
    projects,
    onProjectUpdate,
  });

  const {
    currentProject,
    selectedChapterId,
    multiSelectedChapterIds,
    setMultiSelectedChapterIds,
    applyUndoableProjectUpdate,
  } = coreLogic;
  
  const scriptImportInputRef = useRef<HTMLInputElement>(null);


  const setMultiSelectedChapterIdsAfterProcessing = useCallback((ids: string[]) => {
      setMultiSelectedChapterIds(ids);
  }, [setMultiSelectedChapterIds]);

  const { isLoadingAiAnnotation, handleRunAiAnnotationForChapters } = useAiChapterAnnotator({
    currentProject,
    onAddCharacter,
    applyUndoableProjectUpdate,
    setMultiSelectedChapterIdsAfterProcessing,
  });

  const { isLoadingManualParse, handleManualParseChapters } = useManualChapterParser({
    currentProject,
    characters,
    onAddCharacter,
    applyUndoableProjectUpdate,
    setMultiSelectedChapterIdsAfterProcessing,
  });

  const {
    isLoadingImportAnnotation,
    isImportModalOpen,
    setIsImportModalOpen,
    handleOpenImportModalTrigger,
    handleImportPreAnnotatedScript,
  } = useAnnotationImporter({
    currentProject,
    onAddCharacter,
    applyUndoableProjectUpdate,
    selectedChapterId,
    multiSelectedChapterIds,
    setMultiSelectedChapterIdsAfterProcessing,
  });
  
  const handleImportAndCvUpdate = useCallback(async (annotatedText: string) => {
    const cvUpdates = await handleImportPreAnnotatedScript(annotatedText);
    if (cvUpdates.size > 0) {
      const defaultCvBg = 'bg-slate-700';
      const defaultCvText = 'text-slate-300';
      const updatePromises = Array.from(cvUpdates.entries()).map(([charId, cvName]) => {
          const style = cvStyles[cvName] || { bgColor: defaultCvBg, textColor: defaultCvText };
          return onUpdateCharacterCV(charId, cvName, style.bgColor, style.textColor);
      });
      await Promise.all(updatePromises);
    }
  }, [handleImportPreAnnotatedScript, onUpdateCharacterCV, cvStyles]);

  const {
    handleUpdateScriptLineText,
    handleAssignCharacterToLine,
    handleSplitScriptLine,
    handleMergeAdjacentLines,
  } = useScriptLineEditor(
    currentProject,
    characters,
    applyUndoableProjectUpdate,
    selectedChapterId
  );

  const {
    characterForSidePanel,
    handleOpenCharacterSidePanel,
    handleCloseCharacterSidePanel,
  } = useCharacterSidePanel(characters);
  
  const [isAddChaptersModalOpen, setIsAddChaptersModalOpen] = React.useState(false);

  const handleOpenScriptImport = useCallback(async () => {
    if (!currentProject) return;

    const insertionIndex = selectedChapterId
        ? currentProject.chapters.findIndex(ch => ch.id === selectedChapterId)
        : 0;
    const finalInsertionIndex = insertionIndex === -1 ? 0 : insertionIndex;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const fileNameLower = file.name.toLowerCase();
        
        if (fileNameLower.endsWith('.doc') && !fileNameLower.endsWith('.docx')) {
            alert("不支持旧版 .doc 格式。请在Word中打开该文件，并将其另存为 .docx 格式后再上传。");
            return;
        }

        let parsedResult: { 
            newChapters: Chapter[]; 
            charactersWithCvToUpdate: Map<string, string>; 
            characterDescriptions: Map<string, string>;
        };

        try {
            // More robust file type sniffing
            const headTextRaw = await file.slice(0, 1024).text();
            const headText = headTextRaw.replace(/^\uFEFF/, ''); // Remove BOM
            const magicBytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
            const isZipLike = magicBytes[0] === 0x50 && magicBytes[1] === 0x4B; // 'PK'
            const isHtmlLike = /<(?:!doctype\s+html|html|head|meta\s+charset)/i.test(headText);

            if ((isHtmlLike && fileNameLower.endsWith('.docx')) || (!isZipLike && fileNameLower.endsWith('.docx'))) {
                // Handle app-exported HTML "docx" and other non-zip .docx as HTML
                const htmlString = await file.text();
                parsedResult = parseHtmlWorkbook(htmlString, onAddCharacter);
            } else if (isZipLike && fileNameLower.endsWith('.docx')) {
                // Handle real docx with mammoth
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                parsedResult = parseImportedScriptToChapters(result.value, onAddCharacter);
            } else if (fileNameLower.endsWith('.txt')) {
                // Handle txt file
                const rawText = await file.text();
                parsedResult = parseImportedScriptToChapters(rawText, onAddCharacter);
            } else {
                alert("不支持的文件格式或文件内容无法识别。请上传 .txt, .docx, 或由本应用导出的画本文件。");
                return;
            }
        } catch (error) {
            console.error("读取或解析文件时出错:", error);
            let errorMessage = `读取文件时出错: ${error instanceof Error ? error.message : "未知错误"}`;
            if (error instanceof Error && error.message.includes('central directory')) {
                errorMessage = '无法读取该 .docx 文件。文件可能已损坏，或者它是一个旧版 .doc 文件但扩展名被错误地改成了 .docx。请尝试在Word中打开并重新另存为 .docx 格式。';
            }
            alert(errorMessage);
            return;
        }

        const { newChapters, charactersWithCvToUpdate, characterDescriptions } = parsedResult;

        if (charactersWithCvToUpdate.size > 0) {
            const defaultCvBg = 'bg-slate-700';
            const defaultCvText = 'text-slate-300';
            const updatePromises = Array.from(charactersWithCvToUpdate.entries()).map(([charId, cvName]) => {
                const style = cvStyles[cvName] || { bgColor: defaultCvBg, textColor: defaultCvText };
                return onUpdateCharacterCV(charId, cvName, style.bgColor, style.textColor);
            });
            await Promise.all(updatePromises);
        }
        
        if (characterDescriptions && characterDescriptions.size > 0) {
            const currentCharacters = useStore.getState().characters;
            let descriptionsUpdatedCount = 0;
            for (const [name, description] of characterDescriptions.entries()) {
                const charToUpdate = currentCharacters.find(c => c.name === name);
                if (charToUpdate && charToUpdate.description !== description) {
                    const updatedCharacterData = { ...charToUpdate, description };
                    await onEditCharacter(updatedCharacterData, updatedCharacterData.cvName, undefined, undefined);
                    descriptionsUpdatedCount++;
                }
            }
            if (descriptionsUpdatedCount > 0) {
                alert(`${descriptionsUpdatedCount} 个角色的描述已从文件更新。`);
            }
        }

        if (newChapters.length > 0) {
            applyUndoableProjectUpdate(prev => {
                const updatedChapters = [...prev.chapters];
                updatedChapters.splice(finalInsertionIndex, 0, ...newChapters);
                return { ...prev, chapters: updatedChapters };
            });
            alert(`成功导入 ${newChapters.length} 个新章节。`);
        } else {
            if (!characterDescriptions || characterDescriptions.size === 0) {
              alert('在导入的文件中未找到可识别的新章节。');
            }
        }
    };
    input.click();
  }, [currentProject, selectedChapterId, applyUndoableProjectUpdate, onAddCharacter, onUpdateCharacterCV, onEditCharacter, cvStyles]);
  

  const handleSaveNewChapters = (pastedText: string) => {
    const { newChapters } = parseImportedScriptToChapters(pastedText, onAddCharacter);
    if (newChapters.length > 0) {
      applyUndoableProjectUpdate(prev => ({
        ...prev,
        chapters: [...prev.chapters, ...newChapters],
      }));
    }
    setIsAddChaptersModalOpen(false);
  };

  const undoableDeleteChapters = (chapterIds: string[]) => {
    applyUndoableProjectUpdate(prev => {
        const newSelectedChapterId = chapterIds.includes(selectedChapterId ?? '') ? null : selectedChapterId;
        if(newSelectedChapterId !== selectedChapterId) {
            coreLogic.setSelectedChapterId(newSelectedChapterId);
        }
        setMultiSelectedChapterIds(currentIds => currentIds.filter(id => !chapterIds.includes(id)));
        return {
            ...prev,
            chapters: prev.chapters.filter(ch => !chapterIds.includes(ch.id)),
        };
    });
  };

  const undoableMergeChapters = (chapterIds: string[], targetChapterId: string) => {
      applyUndoableProjectUpdate(prev => {
        const targetChapter = prev.chapters.find(ch => ch.id === targetChapterId);
        if (!targetChapter) return prev;

        const chaptersToMerge = prev.chapters
          .filter(ch => chapterIds.includes(ch.id))
          .sort((a,b) => prev.chapters.findIndex(c => c.id === a.id) - prev.chapters.findIndex(c => c.id === b.id));

        let mergedRawContent = '';
        let mergedScriptLines: ScriptLine[] = [];
        chaptersToMerge.forEach(ch => {
          mergedRawContent += ch.rawContent + '\n\n';
          mergedScriptLines = mergedScriptLines.concat(ch.scriptLines);
        });
        
        const newChapters = prev.chapters
          .map(ch => ch.id === targetChapterId ? { ...targetChapter, rawContent: mergedRawContent.trim(), scriptLines: mergedScriptLines } : ch)
          .filter(ch => !chapterIds.includes(ch.id) || ch.id === targetChapterId);

        return { ...prev, chapters: newChapters };
      });
      coreLogic.setSelectedChapterId(targetChapterId);
      setMultiSelectedChapterIds([]);
  };

  const contextValue = useMemo(() => ({
    ...coreLogic,
    characters,
    allCvNames,
    cvStyles,
    undoableProjectUpdate: applyUndoableProjectUpdate,
    undoableParseProjectChapters: coreLogic.parseProjectChaptersAndUpdateHistory,
    undoableUpdateChapterTitle: coreLogic.updateChapterTitleInHistory,
    undoableUpdateChapterRawContent: coreLogic.undoableUpdateChapterRawContent,
    deleteChapters: (ids: string[]) => onDeleteChapters(ids, () => undoableDeleteChapters(ids)),
    mergeChapters: undoableMergeChapters,
    isLoadingAiAnnotation,
    isLoadingManualParse,
    isLoadingImportAnnotation,
    runAiAnnotationForChapters: handleRunAiAnnotationForChapters,
    runManualParseForChapters: handleManualParseChapters,
    openImportModal: handleOpenImportModalTrigger,
    openAddChaptersModal: () => setIsAddChaptersModalOpen(true),
    openScriptImport: handleOpenScriptImport,
    saveNewChapters: handleSaveNewChapters,
    openCharacterSidePanel: handleOpenCharacterSidePanel,
    openCvModal: onOpenCharacterAndCvStyleModal,
    openCharacterEditModal: onOpenCharacterAndCvStyleModal,
    cvFilter: coreLogic.cvFilter,
    setCvFilter: coreLogic.setCvFilter,
  }), [
    coreLogic, characters, allCvNames, cvStyles, applyUndoableProjectUpdate, onDeleteChapters,
    isLoadingAiAnnotation, isLoadingManualParse, isLoadingImportAnnotation,
    handleRunAiAnnotationForChapters, handleManualParseChapters, handleOpenImportModalTrigger,
    handleOpenCharacterSidePanel, onOpenCharacterAndCvStyleModal, handleOpenScriptImport
  ]);

  if (coreLogic.isLoadingProject) {
    return <div className="p-4 h-full flex items-center justify-center bg-slate-900 text-slate-400">Loading project...</div>;
  }

  if (!currentProject) {
    return <div className="p-4 h-full flex items-center justify-center bg-slate-900 text-slate-400">Project not found. Please return to the dashboard.</div>;
  }

  return (
    <EditorContext.Provider value={contextValue}>
      <div className="flex h-full w-full">
        <ResizablePanels
          leftPanel={
            <ResizablePanels
              leftPanel={<ChapterListPanel />}
              rightPanel={
                <ScriptEditorPanel
                  onUpdateScriptLineText={handleUpdateScriptLineText}
                  onAssignCharacterToLine={handleAssignCharacterToLine}
                  onSplitScriptLine={handleSplitScriptLine}
                  onMergeAdjacentLines={handleMergeAdjacentLines}
                  onOpenCvModalForCharacterLine={(char) => onOpenCharacterAndCvStyleModal(char)}
                />
              }
              initialLeftWidthPercent={40}
            />
          }
          rightPanel={
            <ControlsAndCharactersPanel
              onDeleteCharacter={onDeleteCharacter}
              onToggleCharacterStyleLock={onToggleCharacterStyleLock}
              onBulkUpdateCharacterStylesForCV={onBulkUpdateCharacterStylesForCV}
            />
          }
          initialLeftWidthPercent={65}
        />
        <CharacterDetailsSidePanel
          character={characterForSidePanel}
          project={currentProject}
          onClose={handleCloseCharacterSidePanel}
          onEditCharacter={(char) => onOpenCharacterAndCvStyleModal(char)}
          onEditCv={(char) => onOpenCharacterAndCvStyleModal(char)}
          onSelectChapter={coreLogic.setSelectedChapterId}
          cvStyles={cvStyles}
        />
        <ImportAnnotationModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSubmit={handleImportAndCvUpdate}
          isLoading={isLoadingImportAnnotation}
        />
        <AddChaptersModal 
          isOpen={isAddChaptersModalOpen}
          onClose={() => setIsAddChaptersModalOpen(false)}
          onSave={handleSaveNewChapters}
        />
      </div>
    </EditorContext.Provider>
  );
};

export default EditorPage;