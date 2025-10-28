import React, { useMemo } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '../../../../components/ui/icons';

interface ChapterPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  isAnyOperationLoading: boolean;
  isEditingTitle: boolean;
}

const MAX_VISIBLE_PAGINATION_BUTTONS = 7;

const getPaginationModel = (currentPage: number, totalPages: number, maxVisiblePages: number = MAX_VISIBLE_PAGINATION_BUTTONS): (number | string)[] => {
  if (totalPages <= 0) return [];
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | string)[] = [];
  const firstPage = 1;
  const lastPage = totalPages;
  
  if (currentPage <= 4) { // Show 1, 2, 3, 4, 5, ..., L
    for (let i = 1; i <= Math.min(5, totalPages) ; i++) {
      pages.push(i);
    }
    if (totalPages > 5) pages.push('...');
    if (totalPages > 5 && !pages.includes(lastPage)) pages.push(lastPage);
  } else if (currentPage >= totalPages - 3) { // Show 1, ..., L-4, L-3, L-2, L-1, L
    pages.push(firstPage);
    if (totalPages > 5) pages.push('...');
    for (let i = Math.max(1, totalPages - 4); i <= totalPages; i++) {
      if (!pages.includes(i)) pages.push(i);
    }
  } else { // Show 1, ..., C-1, C, C+1, ..., L
    pages.push(firstPage);
    pages.push('...');
    pages.push(currentPage - 1);
    pages.push(currentPage);
    pages.push(currentPage + 1);
    pages.push('...');
    pages.push(lastPage);
  }
  
  return Array.from(new Set(pages));
};

const ChapterPagination: React.FC<ChapterPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  isAnyOperationLoading,
  isEditingTitle,
}) => {
  const pageNumbersToDisplay = useMemo(() => {
    return getPaginationModel(currentPage, totalPages, MAX_VISIBLE_PAGINATION_BUTTONS);
  }, [currentPage, totalPages]);

  if (totalPages <= 1) return null;

  const isDisabled = isAnyOperationLoading || isEditingTitle;

  return (
    <nav aria-label="Chapter pagination" className="flex justify-between items-center pt-3 mt-auto border-t border-slate-700">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || isDisabled}
        className="px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-md disabled:opacity-50 flex items-center"
        aria-label="转到上一页"
      >
        <ChevronLeftIcon className="w-4 h-4 mr-1" /> 上一页
      </button>
      
      <div className="flex items-center space-x-1">
        {pageNumbersToDisplay.map((page, index) => 
          typeof page === 'number' ? (
            <button
              key={`page-${page}`}
              onClick={() => onPageChange(page)}
              disabled={isDisabled}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors disabled:opacity-50
                ${currentPage === page 
                  ? 'bg-sky-500 text-white font-semibold' 
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                }`}
              aria-label={`转到第 ${page} 页`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          ) : (
            <span key={`ellipsis-${index}`} className="px-1.5 py-1 text-xs text-slate-400">
              ...
            </span>
          )
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || isDisabled}
        className="px-3 py-1.5 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-md disabled:opacity-50 flex items-center"
        aria-label="转到下一页"
      >
        下一页 <ChevronRightIcon className="w-4 h-4 ml-1" />
      </button>
    </nav>
  );
};

export default ChapterPagination;
