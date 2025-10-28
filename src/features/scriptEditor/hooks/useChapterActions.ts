import { useMemo, useCallback } from 'react';
import { Project, Chapter } from '../../../types';

interface UseChapterActionsProps {
  currentProject: Project | null;
  multiSelectedChapterIds: string[];
  selectedChapterIdForViewing: string | null;
  paginatedChapters: Chapter[];
  isLoadingAiAnnotation: boolean;
  isLoadingImportAnnotation: boolean;
  isLoadingManualParse: boolean;
  onRunAiAnnotationForChapters: (chapterIds: string[]) => Promise<void>;
  onRunManualParseForChapters: (chapterIds: string[]) => Promise<void>;
  onOpenImportModal: () => void;
}

export const useChapterActions = ({
  currentProject,
  multiSelectedChapterIds,
  selectedChapterIdForViewing,
  paginatedChapters,
  isLoadingAiAnnotation,
  isLoadingImportAnnotation,
  isLoadingManualParse,
  onRunAiAnnotationForChapters,
  onRunManualParseForChapters,
  onOpenImportModal,
}: UseChapterActionsProps) => {

  const isAnyOperationLoading = useMemo(() => 
    isLoadingAiAnnotation || isLoadingImportAnnotation || isLoadingManualParse,
    [isLoadingAiAnnotation, isLoadingImportAnnotation, isLoadingManualParse]
  );
  
  const getChapterIdsForProcessing = useCallback(() => {
    return multiSelectedChapterIds.length > 0
      ? multiSelectedChapterIds
      : selectedChapterIdForViewing
      ? [selectedChapterIdForViewing]
      : [];
  }, [multiSelectedChapterIds, selectedChapterIdForViewing]);

  const handleAiAnnotationClick = useCallback(() => {
    const ids = getChapterIdsForProcessing();
    if (ids.length > 0) onRunAiAnnotationForChapters(ids);
  }, [getChapterIdsForProcessing, onRunAiAnnotationForChapters]);

  const handleManualParseClick = useCallback(() => {
    const ids = getChapterIdsForProcessing();
    if (ids.length > 0) onRunManualParseForChapters(ids);
  }, [getChapterIdsForProcessing, onRunManualParseForChapters]);

  const handleOpenImportModal = useCallback(() => {
    onOpenImportModal();
  }, [onOpenImportModal]);

  const getAnnotationButtonText = useCallback((baseText: string, forAi: boolean) => {
    const count = multiSelectedChapterIds.length;
    if (isLoadingAiAnnotation && forAi) return "处理中...";
    if (isLoadingManualParse && !forAi) return "处理中...";

    if (count > 0) {
      return `${baseText} ${count} 章`;
    }
    return `${baseText}当前章节`;
  }, [multiSelectedChapterIds.length, isLoadingAiAnnotation, isLoadingManualParse]);

  const isProcessingDisabled = useCallback((forOperation: 'ai' | 'manual' | 'import') => {
    if (isAnyOperationLoading) return true;
    
    const chapterIds = getChapterIdsForProcessing();
    if (chapterIds.length === 0) return true;
    
    const chaptersToProcess = currentProject?.chapters.filter(ch => chapterIds.includes(ch.id));

    if (forOperation === 'import') {
      if (!chaptersToProcess) return true;
      // Disable if ALL selected chapters have no script lines to match against.
      return chaptersToProcess.every(ch => !ch.scriptLines || ch.scriptLines.length === 0);
    }
    
    // Existing logic for AI and Manual parsing. They operate on rawContent.
    return !chaptersToProcess || chaptersToProcess.some(ch => !ch.rawContent || ch.rawContent.trim() === '');

  }, [isAnyOperationLoading, getChapterIdsForProcessing, currentProject]);

  return {
    handleAiAnnotationClick,
    handleManualParseClick,
    handleOpenImportModal,
    getAnnotationButtonText,
    isProcessingDisabled,
    isAnyOperationLoading,
  };
};
