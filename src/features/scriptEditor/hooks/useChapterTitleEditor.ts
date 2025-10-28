
import { useState, useCallback } from 'react';
import { Chapter } from '../../../types';

interface UseChapterTitleEditorProps {
  currentProjectChapters: Chapter[];
  onUpdateProjectChapterTitle: (chapterId: string, newTitle: string) => void;
  isAnyOperationLoading: boolean;
}

export const useChapterTitleEditor = ({
  currentProjectChapters,
  onUpdateProjectChapterTitle,
  isAnyOperationLoading,
}: UseChapterTitleEditorProps) => {
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editingTitleInput, setEditingTitleInput] = useState('');

  const isEditingTitle = !!editingChapterId;

  const handleStartEditChapterTitle = useCallback((chapter: Chapter) => {
    if (isAnyOperationLoading) return;
    setEditingChapterId(chapter.id);
    setEditingTitleInput(chapter.title);
  }, [isAnyOperationLoading]);

  const handleEditingTitleInputChange = useCallback((newTitle: string) => {
    setEditingTitleInput(newTitle);
  }, []);

  const handleSaveChapterTitle = useCallback((chapterId: string) => {
    const trimmedTitle = editingTitleInput.trim();
    if (trimmedTitle && editingChapterId === chapterId) {
      const originalChapter = currentProjectChapters.find(c => c.id === chapterId);
      if (originalChapter && originalChapter.title !== trimmedTitle) {
        onUpdateProjectChapterTitle(chapterId, trimmedTitle);
      }
    }
    setEditingChapterId(null);
    setEditingTitleInput('');
  }, [editingChapterId, editingTitleInput, currentProjectChapters, onUpdateProjectChapterTitle]);

  const handleCancelEditChapterTitle = useCallback(() => {
    setEditingChapterId(null);
    setEditingTitleInput('');
  }, []);

  return {
    editingChapterId,
    isEditingTitle,
    editingTitleInput,
    handleStartEditChapterTitle,
    handleEditingTitleInputChange,
    handleSaveChapterTitle,
    handleCancelEditChapterTitle,
  };
};
