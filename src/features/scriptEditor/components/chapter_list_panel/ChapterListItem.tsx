import React, { useEffect, useRef } from 'react';
import { Chapter } from '../../../../types';
import { PencilIcon } from '../../../../components/ui/icons';
import { useStore } from '../../../../store/useStore'; // Import useStore

interface ChapterListItemProps {
  chapter: Chapter;
  isSelectedForViewing: boolean;
  isMultiSelected: boolean;
  isAnyOperationLoading: boolean; // General loading state
  onToggleMultiSelect: (event: React.MouseEvent<HTMLInputElement>) => void;
  onSelectForViewing: () => void;
  
  isEditingThisItem: boolean;
  editingTitleValue: string;
  onStartEditTitle: () => void; 
  onTitleInputChange: (newTitle: string) => void;
  onSaveTitle: () => void; 
  onCancelEditTitle: () => void;
}

const ChapterListItem: React.FC<ChapterListItemProps> = ({
  chapter,
  isSelectedForViewing,
  isMultiSelected,
  isAnyOperationLoading,
  onToggleMultiSelect,
  onSelectForViewing,
  isEditingThisItem,
  editingTitleValue,
  onStartEditTitle,
  onTitleInputChange,
  onSaveTitle,
  onCancelEditTitle,
}) => {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const aiProcessingChapterIds = useStore(state => state.aiProcessingChapterIds);
  const isProcessingThisChapter = aiProcessingChapterIds.includes(chapter.id);

  useEffect(() => {
    if (isEditingThisItem && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingThisItem]);

  const handleTitleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSaveTitle();
    } else if (e.key === 'Escape') {
      onCancelEditTitle();
    }
  };
  
  const handleTitleInputBlur = () => {
    setTimeout(() => {
      if (isEditingThisItem) { 
          onSaveTitle();
      }
    }, 150); 
  };

  const itemDisabled = isAnyOperationLoading || isProcessingThisChapter || isEditingThisItem;

  return (
    <div className={`flex items-center space-x-2 group ${isProcessingThisChapter ? 'opacity-60 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        id={`ch-select-${chapter.id}`}
        checked={isMultiSelected}
        onClick={onToggleMultiSelect}
        readOnly // Let onClick handle the logic
        disabled={itemDisabled}
        className="form-checkbox h-4 w-4 text-sky-500 bg-slate-700 border-slate-600 rounded focus:ring-sky-400 cursor-pointer disabled:opacity-50"
        aria-label={`Select chapter ${chapter.title}`}
      />
      {isEditingThisItem && !isProcessingThisChapter ? (
        <input
          ref={titleInputRef}
          type="text"
          value={editingTitleValue} 
          onChange={(e) => onTitleInputChange(e.target.value)}
          onBlur={handleTitleInputBlur}
          onKeyDown={handleTitleInputKeyDown}
          className="flex-grow px-3 py-2 rounded-md text-sm bg-slate-600 text-slate-100 border border-sky-500 focus:ring-1 focus:ring-sky-400 outline-none"
          aria-label={`Editing title for chapter ${chapter.title}`}
        />
      ) : (
        <button
          onClick={onSelectForViewing}
          disabled={isAnyOperationLoading || isProcessingThisChapter} // Explicitly disable if processing this chapter
          className={`flex-grow text-left px-3 py-2 rounded-md text-sm transition-colors disabled:opacity-50 flex justify-between items-center 
                      ${isProcessingThisChapter ? 'cursor-not-allowed' : 'cursor-pointer'}
                      ${isSelectedForViewing && !isProcessingThisChapter
                        ? 'bg-sky-500 text-white font-semibold'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-sky-300'
                      }`}
          aria-pressed={isSelectedForViewing}
        >
          <span className="truncate block" title={chapter.title}>
            {chapter.title}
            {isProcessingThisChapter && <span className="ml-1 text-xs text-sky-200">(处理中...)</span>}
          </span>
          {!isProcessingThisChapter && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Edit title for ${chapter.title}`}
              onClick={(e) => { 
                if (isProcessingThisChapter) return;
                e.stopPropagation(); 
                onStartEditTitle(); 
              }}
              onKeyDown={(e) => {
                if (isProcessingThisChapter) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onStartEditTitle();
                }
              }}
              className="inline-flex items-center justify-center ml-2 flex-shrink-0 cursor-pointer"
            >
              <PencilIcon className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-sky-300" />
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default ChapterListItem;