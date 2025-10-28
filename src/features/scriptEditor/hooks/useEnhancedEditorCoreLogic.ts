import { useState, useEffect, useMemo, useCallback } from 'react';
import { Project, ScriptLine, CharacterFilterMode } from '../../../types';
import { internalParseScriptToChapters } from '../../../lib/scriptParser';
import { useStore } from '../../../store/useStore';

interface UseEnhancedEditorCoreLogicProps {
  projectId: string;
  projects: Project[];
  onProjectUpdate: (project: Project) => void;
}

export const useEnhancedEditorCoreLogic = ({
  projectId,
  projects,
  onProjectUpdate,
}: UseEnhancedEditorCoreLogicProps) => {
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const { selectedChapterId, setSelectedChapterId } = useStore(state => ({
    selectedChapterId: state.selectedChapterId,
    setSelectedChapterId: state.setSelectedChapterId,
  }));
  const [multiSelectedChapterIds, setMultiSelectedChapterIds] = useState<string[]>([]);
  const [selectedLineForPlayback, setSelectedLineForPlayback] = useState<ScriptLine | null>(null);
  const [focusedScriptLineId, setFocusedScriptLineId] = useState<string | null>(null);
  const [characterFilterMode, setCharacterFilterMode] = useState<CharacterFilterMode>('all');
  const [cvFilter, setCvFilter] = useState<string | null>(null);
  const [history, setHistory] = useState<Project[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const currentProject = useMemo(() => projects.find(p => p.id === projectId), [projects, projectId]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  useEffect(() => {
    if (currentProject) {
      setIsLoadingProject(false);
      if (!selectedChapterId && currentProject.chapters.length > 0) {
        setSelectedChapterId(currentProject.chapters[0].id);
      }
      if (history.length === 0 || history[history.length - 1].id !== currentProject.id) {
          setHistory([currentProject]);
          setHistoryIndex(0);
          setCvFilter(null); // Reset filter on project change
      }
    }
  }, [currentProject, selectedChapterId, history, setSelectedChapterId]);

  const applyUndoableProjectUpdate = useCallback((updater: (prevProject: Project) => Project) => {
    if (!currentProject) return;
    const newProject = updater(currentProject);
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newProject]);
    setHistoryIndex(newHistory.length);
    onProjectUpdate(newProject);
  }, [currentProject, history, historyIndex, onProjectUpdate]);

  const undo = useCallback(() => {
    if (canUndo) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onProjectUpdate(history[newIndex]);
    }
  }, [canUndo, history, historyIndex, onProjectUpdate]);

  const redo = useCallback(() => {
    if (canRedo) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onProjectUpdate(history[newIndex]);
    }
  }, [canRedo, history, historyIndex, onProjectUpdate]);
  
  const parseProjectChaptersAndUpdateHistory = useCallback(() => {
    if (!currentProject || !currentProject.rawFullScript) return;
    const newChapters = internalParseScriptToChapters(currentProject.rawFullScript, currentProject.name);
    applyUndoableProjectUpdate(prev => ({ ...prev, chapters: newChapters }));
  }, [currentProject, applyUndoableProjectUpdate]);

  const updateChapterTitleInHistory = useCallback((chapterId: string, newTitle: string) => {
    applyUndoableProjectUpdate(prev => ({
      ...prev,
      chapters: prev.chapters.map(ch => ch.id === chapterId ? { ...ch, title: newTitle } : ch)
    }));
  }, [applyUndoableProjectUpdate]);

  const undoableUpdateChapterRawContent = useCallback((chapterId: string, newRawContent: string) => {
    applyUndoableProjectUpdate(prev => ({
        ...prev,
        chapters: prev.chapters.map(ch =>
            ch.id === chapterId ? { ...ch, rawContent: newRawContent, scriptLines: [] } : ch
        )
    }));
  }, [applyUndoableProjectUpdate]);

  return {
    currentProject,
    isLoadingProject,
    selectedChapterId,
    setSelectedChapterId,
    multiSelectedChapterIds,
    setMultiSelectedChapterIds,
    selectedLineForPlayback,
    setSelectedLineForPlayback,
    focusedScriptLineId,
    setFocusedScriptLineId,
    characterFilterMode,
    setCharacterFilterMode,
    cvFilter,
    setCvFilter,
    applyUndoableProjectUpdate,
    parseProjectChaptersAndUpdateHistory,
    updateChapterTitleInHistory,
    undoableUpdateChapterRawContent,
    undo,
    redo,
    canUndo,
    canRedo,
  };
};