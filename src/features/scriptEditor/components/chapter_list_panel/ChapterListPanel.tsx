import React, { useState, useCallback, useMemo } from 'react';
import { Chapter } from '../../../../types';
import { useEditorContext } from '../../contexts/EditorContext';

import { usePaginatedChapters } from '../../hooks/usePaginatedChapters';
import { useChapterTitleEditor } from '../../hooks/useChapterTitleEditor';
import { useChapterActions } from '../../hooks/useChapterActions';

import ChapterListHeader from './ChapterListHeader';
import ChapterListActions from './ChapterListActions';
import ChapterListItem from './ChapterListItem';
import ChapterPagination from './ChapterPagination';
import BatchModifyModal from './BatchModifyModal';
import MergeChaptersModal from './MergeChaptersModal';
import ExportScriptModal, { ExportOption } from './ExportScriptModal';
import { exportChaptersToDocx } from '../../services/docxExporter'; // Import the new service

const ChapterListPanel: React.FC = () => {
    const {
        currentProject,
        characters,
        selectedChapterId,
        setSelectedChapterId,
        multiSelectedChapterIds,
        setMultiSelectedChapterIds,
        undoableParseProjectChapters,
        undoableUpdateChapterTitle,
        deleteChapters,
        mergeChapters,
        isLoadingAiAnnotation,
        isLoadingManualParse,
        isLoadingImportAnnotation,
        runAiAnnotationForChapters,
        runManualParseForChapters,
        openImportModal,
        cvFilter,
    } = useEditorContext();

    const [isBatchModifyModalOpen, setIsBatchModifyModalOpen] = useState(false);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [lastSelectedChapterForShiftClick, setLastSelectedChapterForShiftClick] = useState<string | null>(null);

    const filteredChapters = useMemo(() => {
        if (!currentProject) return [];
        if (!cvFilter) {
            return currentProject.chapters;
        }

        const characterIdsForCv = characters
            .filter(c => c.cvName === cvFilter && c.status !== 'merged')
            .map(c => c.id);
        
        if (characterIdsForCv.length === 0) {
            return [];
        }

        return currentProject.chapters.filter(chapter => 
            chapter.scriptLines.some(line => 
                line.characterId && characterIdsForCv.includes(line.characterId)
            )
        );
    }, [currentProject, cvFilter, characters]);

    const {
        currentPage,
        totalPages,
        paginatedChapters,
        handlePageChange,
        allVisibleChaptersSelected,
        handleToggleSelectAllOnPage,
    } = usePaginatedChapters({
        chapters: filteredChapters,
        projectId: currentProject?.id,
        initialSelectedChapterIdForViewing: selectedChapterId,
        onSelectChapterForViewing: setSelectedChapterId,
        multiSelectedChapterIds,
        setMultiSelectedChapterIdsContext: setMultiSelectedChapterIds,
        onPageChangeSideEffects: useCallback(() => {
            setLastSelectedChapterForShiftClick(null);
        }, []),
    });

    const chapterActions = useChapterActions({
        currentProject,
        multiSelectedChapterIds,
        selectedChapterIdForViewing: selectedChapterId,
        paginatedChapters,
        isLoadingAiAnnotation,
        isLoadingImportAnnotation,
        isLoadingManualParse,
        onRunAiAnnotationForChapters: runAiAnnotationForChapters,
        onRunManualParseForChapters: runManualParseForChapters,
        onOpenImportModal: openImportModal,
    });

    const { isAnyOperationLoading } = chapterActions;

    const {
        editingChapterId,
        isEditingTitle,
        editingTitleInput,
        handleStartEditChapterTitle,
        handleEditingTitleInputChange,
        handleSaveChapterTitle,
        handleCancelEditChapterTitle,
    } = useChapterTitleEditor({
        currentProjectChapters: currentProject?.chapters || [],
        onUpdateProjectChapterTitle: undoableUpdateChapterTitle,
        isAnyOperationLoading,
    });

    const handleToggleMultiSelect = useCallback((chapterId: string, event: React.MouseEvent) => {
        if (event.shiftKey && lastSelectedChapterForShiftClick && currentProject) {
            const allChapterIds = currentProject.chapters.map(ch => ch.id);
            const lastIndex = allChapterIds.indexOf(lastSelectedChapterForShiftClick);
            const currentIndex = allChapterIds.indexOf(chapterId);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const idsToSelect = allChapterIds.slice(start, end + 1);
                
                setMultiSelectedChapterIds(prev => {
                    const selection = new Set(prev);
                    idsToSelect.forEach(id => selection.add(id));
                    return Array.from(selection);
                });
                return;
            }
        }
        
        setMultiSelectedChapterIds(prev =>
            prev.includes(chapterId)
                ? prev.filter(id => id !== chapterId)
                : [...prev, chapterId]
        );
        setLastSelectedChapterForShiftClick(chapterId);
    }, [lastSelectedChapterForShiftClick, currentProject, setMultiSelectedChapterIds]);


    const handleSelectForViewing = useCallback((chapterId: string) => {
        if (editingChapterId !== chapterId) {
            setSelectedChapterId(chapterId);
        }
    }, [editingChapterId, setSelectedChapterId]);

    const handleBatchDelete = useCallback(() => {
        if (multiSelectedChapterIds.length > 0) {
            deleteChapters(multiSelectedChapterIds);
        }
    }, [multiSelectedChapterIds, deleteChapters]);

    const canMerge = useMemo(() => {
        if (!currentProject || multiSelectedChapterIds.length < 2) return false;
        const indices = multiSelectedChapterIds
            .map(id => currentProject.chapters.findIndex(ch => ch.id === id))
            .filter(index => index !== -1)
            .sort((a, b) => a - b);

        if (indices.length !== multiSelectedChapterIds.length) return false;

        for (let i = 0; i < indices.length - 1; i++) {
            if (indices[i + 1] - indices[i] !== 1) {
                return false;
            }
        }
        return true;
    }, [multiSelectedChapterIds, currentProject]);

    const chaptersToMerge = useMemo(() => {
        if (!currentProject) return [];
        return currentProject.chapters
            .filter(ch => multiSelectedChapterIds.includes(ch.id))
            .sort((a, b) =>
                currentProject.chapters.findIndex(ch => ch.id === a.id) -
                currentProject.chapters.findIndex(ch => ch.id === b.id)
            );
    }, [multiSelectedChapterIds, currentProject]);

    const handleOpenMergeModal = useCallback(() => {
        setIsMergeModalOpen(true);
    }, []);

    const handleConfirmMerge = useCallback((targetChapterId: string) => {
        mergeChapters(multiSelectedChapterIds, targetChapterId);
        setIsMergeModalOpen(false);
    }, [multiSelectedChapterIds, mergeChapters]);

    const handleExportConfirm = (option: ExportOption) => {
        if (!currentProject) return;

        let chaptersToExport: Chapter[] = [];
        
        switch (option) {
            case 'all':
                chaptersToExport = currentProject.chapters;
                break;
            case 'multi':
                if (multiSelectedChapterIds.length > 0) {
                    chaptersToExport = currentProject.chapters.filter(ch => multiSelectedChapterIds.includes(ch.id));
                }
                break;
            case 'view':
                if (selectedChapterId) {
                    const chapter = currentProject.chapters.find(ch => ch.id === selectedChapterId);
                    if (chapter) chaptersToExport = [chapter];
                }
                break;
        }

        exportChaptersToDocx({
            project: currentProject,
            chaptersToExport,
            characters,
        });

        setIsExportModalOpen(false);
    };

    if (!currentProject) {
        return <div className="p-4 h-full flex items-center justify-center bg-slate-800 text-slate-400">项目加载中...</div>;
    }

    return (
        <div className="p-4 h-full flex flex-col bg-slate-800 text-slate-100">
            <ChapterListHeader
                project={currentProject}
                currentPage={currentPage}
                totalPages={totalPages}
                filteredCount={filteredChapters.length}
            />
            <ChapterListActions
                project={currentProject}
                onParseProject={undoableParseProjectChapters}
                chapterActions={chapterActions}
                onOpenExportModal={() => setIsExportModalOpen(true)}
            />
            
            <div className="flex items-center space-x-2 mb-2 pt-3 border-t border-slate-700">
                <input
                    type="checkbox"
                    id="select-all-on-page"
                    checked={allVisibleChaptersSelected}
                    onChange={handleToggleSelectAllOnPage}
                    disabled={isAnyOperationLoading || paginatedChapters.length === 0}
                    className="form-checkbox h-4 w-4 text-sky-500 bg-slate-700 border-slate-600 rounded focus:ring-sky-400 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="select-all-on-page" className="text-sm text-slate-300 select-none">
                    全选当前页 ({multiSelectedChapterIds.length} / {currentProject.chapters.length})
                </label>
                {multiSelectedChapterIds.length > 0 && (
                    <button 
                        onClick={() => setIsBatchModifyModalOpen(true)}
                        className="ml-auto text-xs text-sky-300 hover:text-sky-100 bg-slate-700 px-2 py-1 rounded"
                    >
                        批量修改...
                    </button>
                )}
            </div>

            <div className="flex-grow overflow-y-auto space-y-1 pr-1 -mr-1">
                {paginatedChapters.map(chapter => (
                    <ChapterListItem
                        key={chapter.id}
                        chapter={chapter}
                        isSelectedForViewing={selectedChapterId === chapter.id}
                        isMultiSelected={multiSelectedChapterIds.includes(chapter.id)}
                        isAnyOperationLoading={isAnyOperationLoading}
                        onToggleMultiSelect={(event) => {
                            event.stopPropagation();
                            handleToggleMultiSelect(chapter.id, event);
                        }}
                        onSelectForViewing={() => handleSelectForViewing(chapter.id)}
                        isEditingThisItem={editingChapterId === chapter.id}
                        editingTitleValue={editingTitleInput}
                        onStartEditTitle={() => handleStartEditChapterTitle(chapter)}
                        onTitleInputChange={handleEditingTitleInputChange}
                        onSaveTitle={() => handleSaveChapterTitle(chapter.id)}
                        onCancelEditTitle={handleCancelEditChapterTitle}
                    />
                ))}
            </div>

            <ChapterPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isAnyOperationLoading={isAnyOperationLoading}
                isEditingTitle={isEditingTitle}
            />

            <BatchModifyModal
                isOpen={isBatchModifyModalOpen}
                onClose={() => setIsBatchModifyModalOpen(false)}
                selectedCount={multiSelectedChapterIds.length}
                onBatchDelete={handleBatchDelete}
                onBatchMerge={handleOpenMergeModal}
                canMerge={canMerge}
            />
            <MergeChaptersModal
                isOpen={isMergeModalOpen}
                onClose={() => setIsMergeModalOpen(false)}
                chaptersToMerge={chaptersToMerge}
                onConfirmMerge={handleConfirmMerge}
            />
            <ExportScriptModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                onConfirm={handleExportConfirm}
                multiSelectCount={multiSelectedChapterIds.length}
                currentChapterTitle={currentProject.chapters.find(c => c.id === selectedChapterId)?.title || null}
                projectTitle={currentProject.name}
            />
        </div>
    );
};

export default ChapterListPanel;