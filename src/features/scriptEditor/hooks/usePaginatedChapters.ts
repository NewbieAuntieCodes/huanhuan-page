
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Chapter } from '../../../types';

interface UsePaginatedChaptersProps {
  chapters: Chapter[];
  projectId?: string;
  initialSelectedChapterIdForViewing: string | null;
  onSelectChapterForViewing: (id: string | null) => void;
  multiSelectedChapterIds: string[];
  // FIX: Added React import to provide the React namespace for Dispatch and SetStateAction types.
  setMultiSelectedChapterIdsContext: React.Dispatch<React.SetStateAction<string[]>>;
  onPageChangeSideEffects: () => void;
  chaptersPerPage?: number;
}

export const usePaginatedChapters = ({
  chapters,
  projectId,
  initialSelectedChapterIdForViewing,
  onSelectChapterForViewing,
  multiSelectedChapterIds,
  setMultiSelectedChapterIdsContext,
  onPageChangeSideEffects,
  chaptersPerPage = 100,
}: UsePaginatedChaptersProps) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(chapters.length / chaptersPerPage));

  // This effect handles jumping to the correct page ONLY when the user actively selects a new chapter.
  // It no longer depends on `chapters`, preventing jumps when the chapter data is refreshed.
  useEffect(() => {
    if (initialSelectedChapterIdForViewing) {
      const chapterIndex = chapters.findIndex(c => c.id === initialSelectedChapterIdForViewing);
      if (chapterIndex !== -1) {
        const pageNumber = Math.floor(chapterIndex / chaptersPerPage) + 1;
        if (pageNumber !== currentPage) {
          setCurrentPage(pageNumber);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedChapterIdForViewing]);
  
  // This effect now handles resetting the page when the project changes,
  // and correcting the page number if it becomes invalid (e.g., due to filtering).
  useEffect(() => {
    // On project change, reset to page 1
    setCurrentPage(1);
    // This effect should re-run when the projectId changes.
    // The component using this hook will re-mount or receive a new projectId prop,
    // which effectively resets the state including currentPage.
    // The dependency on projectId ensures this logic is tied to project switches.
  }, [projectId]);

  // This effect corrects the current page if it becomes out of bounds, for example after filtering.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);


  const paginatedChapters = useMemo(() => {
    const startIndex = (currentPage - 1) * chaptersPerPage;
    const endIndex = startIndex + chaptersPerPage;
    return chapters.slice(startIndex, endIndex);
  }, [chapters, currentPage, chaptersPerPage]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      onPageChangeSideEffects();
    }
  }, [totalPages, onPageChangeSideEffects]);
  
  const allVisibleChaptersSelected = useMemo(() => {
    if (paginatedChapters.length === 0) return false;
    return paginatedChapters.every(ch => multiSelectedChapterIds.includes(ch.id));
  }, [paginatedChapters, multiSelectedChapterIds]);

  const handleToggleSelectAllOnPage = useCallback(() => {
    const visibleChapterIds = paginatedChapters.map(ch => ch.id);
    if (allVisibleChaptersSelected) {
      setMultiSelectedChapterIdsContext(prev => prev.filter(id => !visibleChapterIds.includes(id)));
    } else {
      setMultiSelectedChapterIdsContext(prev => [...new Set([...prev, ...visibleChapterIds])]);
    }
  }, [allVisibleChaptersSelected, paginatedChapters, setMultiSelectedChapterIdsContext]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedChapters,
    handlePageChange,
    allVisibleChaptersSelected,
    handleToggleSelectAllOnPage,
  };
};