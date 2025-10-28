import React, { useState, useCallback, useMemo } from 'react';
import { Chapter, Character } from '../../../../types';
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

import { isHexColor, getContrastingTextColor } from '../../../../lib/colorUtils';
import { tailwindToHex } from '../../../../lib/tailwindColorMap';

// --- Helper Functions for Export ---

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
    // Match "Chapter 123", "第123章", "第十二章"
    const match = title.match(/(?:Chapter|第)\s*([一二三四五六七八九十百千万零\d]+)/i);
    if (match && match[1]) {
        const numPart = match[1];
        if (/^\d+$/.test(numPart)) {
            return parseInt(numPart, 10);
        } else {
            return chineseToArabic(numPart);
        }
    }
    return null;
};

// --- Component ---

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
            // This is a good place to clear selection if it's page-specific
            setLastSelectedChapterForShiftClick(null); // Reset shift-click anchor on page change
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
                return; // End shift-click logic
            }
        }
        
        // Normal toggle behavior
        setMultiSelectedChapterIds(prev =>
            prev.includes(chapterId)
                ? prev.filter(id => id !== chapterId)
                : [...prev, chapterId]
        );
        // Set the new anchor for the next potential shift-click
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

        if (indices.length !== multiSelectedChapterIds.length) return false; // Some IDs weren't found

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

        if (chaptersToExport.length === 0) {
            alert("没有可导出的章节。");
            setIsExportModalOpen(false);
            return;
        }

        const chapterNumbers = chaptersToExport
            .map(ch => getChapterNumber(ch.title))
            .filter((n): n is number => n !== null)
            .sort((a, b) => a - b);

        const formatNum = (n: number) => n.toString().padStart(3, '0');
        let exportFilename = `${currentProject.name}_画本.docx`; // Fallback

        if (chapterNumbers.length > 0) {
            if (chapterNumbers.length === 1) {
                exportFilename = `${currentProject.name}_画本_${formatNum(chapterNumbers[0])}章.docx`;
            } else {
                const startNum = formatNum(chapterNumbers[0]);
                const endNum = formatNum(chapterNumbers[chapterNumbers.length - 1]);
                exportFilename = `${currentProject.name}_画本_${startNum}-${endNum}章.docx`;
            }
        } else if (chaptersToExport.length > 0) {
             if (chaptersToExport.length === 1) {
               exportFilename = `${currentProject.name}_画本_${chaptersToExport[0].title}.docx`;
            } else {
               exportFilename = `${currentProject.name}_画本_${chaptersToExport.length}章.docx`;
            }
        }


        const characterMap = new Map(characters.map(c => [c.id, c]));

        const getColorAsHex = (colorValue: string | undefined, fallback: string): string => {
            if (!colorValue) return fallback;
            if (isHexColor(colorValue)) return colorValue;
            return tailwindToHex[colorValue] || fallback;
        };

        const characterIdsInExport = new Set<string>();
        chaptersToExport.forEach(chapter => {
            chapter.scriptLines.forEach(line => {
                if (line.characterId) {
                    characterIdsInExport.add(line.characterId);
                }
            });
        });

        const charactersToDescribe = Array.from(characterIdsInExport)
            .map(id => characterMap.get(id))
            .filter((char): char is Character => !!char && !!char.description && char.name !== 'Narrator' && char.name !== '[静音]');
        
        let characterDescriptionHtml = '';
        if (charactersToDescribe.length > 0) {
            characterDescriptionHtml = `
                <h2 style="text-align: center; font-size: 18pt; margin-bottom: 1em;">主要角色介绍</h2>
                <div style="margin-bottom: 2em; font-size: 11pt; line-height: 1.6;">
                    ${charactersToDescribe.map(char => {
                        const bgColor = getColorAsHex(char.color, '#334155');
                        const textColor = char.textColor ? getColorAsHex(char.textColor, '#f1f5f9') : getContrastingTextColor(bgColor);
                        return `
                            <p style="margin-bottom: 10px;">
                                <strong style="background-color: ${bgColor}; color: ${textColor}; padding: 2px 6px; border-radius: 4px; font-family: 'SimHei', '黑体', sans-serif;">
                                    【${char.name}】
                                </strong>：${char.description}
                            </p>
                        `;
                    }).join('')}
                </div>
            `;
        }


        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${currentProject.name}</title>
                <style>
                    body { font-family: 'SimSun', '宋体', serif; font-size: 12pt; }
                    h1 { font-size: 22pt; font-weight: bold; text-align: center; }
                    h2 { font-size: 16pt; font-weight: bold; margin-top: 2em; margin-bottom: 1em; }
                    .line { margin-bottom: 12px; line-height: 1.5; }
                    .dialogue-line { display: inline-block; padding: 2px 8px; border-radius: 4px; font-family: 'SimHei', '黑体', sans-serif; }
                </style>
            </head>
            <body>
                <h1>${currentProject.name}</h1>
                ${characterDescriptionHtml}
                ${chaptersToExport.map(chapter => `
                    <h2>${chapter.title}</h2>
                    <div>
                        ${chapter.scriptLines.map(line => {
                            const character = line.characterId ? characterMap.get(line.characterId) : null;
                            const isNarrator = !character || character.name.toLowerCase() === 'narrator';

                            if (isNarrator) {
                                return `<div class="line">${line.text.replace(/\n/g, '<br>')}</div>`;
                            }
                            
                            const charName = character.name;
                            const cvName = character.cvName;

                            let speakerTag;
                            if (cvName && cvName.trim() !== '') {
                                speakerTag = `【${cvName}-${charName}】`;
                            } else {
                                speakerTag = `【${charName}】`;
                            }
                            
                            const bgColor = getColorAsHex(character?.color, '#334155');
                            const textColor = character?.textColor ? getColorAsHex(character.textColor, '#f1f5f9') : getContrastingTextColor(bgColor);
                            
                            return `
                                <div class="line">
                                    <span class="dialogue-line" style="background-color: ${bgColor}; color: ${textColor};">
                                        ${speakerTag}${line.text}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff', htmlContent], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportFilename.replace(/[<>:"/\\|?*]+/g, '_');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

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