
import { useState, useCallback } from 'react';
import { Project, Character } from '../../../types';
import { parseRawTextToScriptLinesByRules } from '../../../lib/manualScriptParser';
import useStore from '../../../store/useStore';

interface UseManualChapterParserProps {
  currentProject: Project | null;
  characters: Character[];
  onAddCharacter: (character: Pick<Character, 'name' | 'color' | 'textColor' | 'description'>) => Character;
  applyUndoableProjectUpdate: (updater: (prevProject: Project) => Project) => void;
  setMultiSelectedChapterIdsAfterProcessing: (ids: string[]) => void;
}

export const useManualChapterParser = ({
  currentProject,
  characters,
  onAddCharacter,
  applyUndoableProjectUpdate,
  setMultiSelectedChapterIdsAfterProcessing,
}: UseManualChapterParserProps) => {
  const [isLoadingManualParse, setIsLoadingManualParse] = useState(false);
  const addAiProcessingChapterId = useStore(state => state.addAiProcessingChapterId);
  const removeAiProcessingChapterId = useStore(state => state.removeAiProcessingChapterId);


  const handleManualParseChapters = useCallback(async (chapterIds: string[]) => {
    if (!currentProject || chapterIds.length === 0) return;

    setIsLoadingManualParse(true);
    chapterIds.forEach(addAiProcessingChapterId); // Reuse AI processing state for UI feedback

    try {
      applyUndoableProjectUpdate(prevProject => {
        const newChapters = prevProject.chapters.map(ch => {
          if (chapterIds.includes(ch.id)) {
            const newScriptLines = parseRawTextToScriptLinesByRules(
              ch.rawContent,
              characters,
              onAddCharacter
            );
            return { ...ch, scriptLines: newScriptLines };
          }
          return ch;
        });
        return { ...prevProject, chapters: newChapters };
      });
    } catch (error) {
      console.error("Manual parsing failed:", error);
      alert(`Manual parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoadingManualParse(false);
      chapterIds.forEach(removeAiProcessingChapterId);
    }
  }, [currentProject, characters, onAddCharacter, applyUndoableProjectUpdate, addAiProcessingChapterId, removeAiProcessingChapterId, setMultiSelectedChapterIdsAfterProcessing]);

  return {
    isLoadingManualParse,
    handleManualParseChapters,
  };
};