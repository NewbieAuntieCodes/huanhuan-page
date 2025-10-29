
import { useState, useCallback } from 'react';
import { Project, Character, ScriptLine } from '../../../types';
import useStore from '../../../store/useStore';

interface UseAnnotationImporterProps {
  currentProject: Project | null;
  onAddCharacter: (character: Pick<Character, 'name' | 'color' | 'textColor' | 'cvName' | 'description' | 'isStyleLockedToCv'>) => Character;
  applyUndoableProjectUpdate: (updater: (prevProject: Project) => Project) => void;
  selectedChapterId: string | null;
  multiSelectedChapterIds: string[];
  setMultiSelectedChapterIdsAfterProcessing: (ids: string[]) => void;
}

export const useAnnotationImporter = ({
  currentProject,
  onAddCharacter,
  applyUndoableProjectUpdate,
  selectedChapterId,
  multiSelectedChapterIds,
  setMultiSelectedChapterIdsAfterProcessing,
}: UseAnnotationImporterProps) => {
  const [isLoadingImportAnnotation, setIsLoadingImportAnnotation] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleOpenImportModalTrigger = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const handleImportPreAnnotatedScript = useCallback(async (annotatedText: string): Promise<Map<string, string>> => {
    const chapterIds = multiSelectedChapterIds.length > 0 ? multiSelectedChapterIds : (selectedChapterId ? [selectedChapterId] : []);
    if (!currentProject || chapterIds.length === 0) return new Map();

    setIsLoadingImportAnnotation(true);
    const charactersWithCvToUpdate = new Map<string, string>();

    try {
      // New logic: Parse all annotations from the pasted text into a map first.
      const annotationMap = new Map<string, { charName: string, cvName?: string }>();
      const annotationRegex = /【(.*?)】“([\s\S]*?)”/g;
      let match;
      while ((match = annotationRegex.exec(annotatedText)) !== null) {
          const speakerTag = match[1].trim();
          const dialogueContent = match[2];
          
          let charName = speakerTag;
          let cvName: string | undefined = undefined;

          const parts = speakerTag.split(/[-－–—]/);
          if (parts.length > 1) {
              const potentialCv = parts[0].trim();
              const potentialCharName = parts.slice(1).join('-').trim();
              if (potentialCv && potentialCharName) {
                  cvName = potentialCv;
                  charName = potentialCharName;
              }
          }
          // Store by dialogue content. If duplicate dialogues exist, the last one wins.
          annotationMap.set(dialogueContent, { charName, cvName });
      }

      const newCharacterMap = new Map<string, Character>();

      applyUndoableProjectUpdate(prevProject => {
        return {
          ...prevProject,
          chapters: prevProject.chapters.map(ch => {
            if (chapterIds.includes(ch.id)) {
              const updatedScriptLines = ch.scriptLines.map(line => {
                const dialogueContentMatch = line.text.match(/“([\s\S]*)”/);
                if (!dialogueContentMatch) return line;
                const dialogueContent = dialogueContentMatch[1];

                const annotation = annotationMap.get(dialogueContent);

                if (annotation) {
                  const { charName, cvName } = annotation;

                  let character = Array.from(newCharacterMap.values()).find(c => c.name.toLowerCase() === charName.toLowerCase());
                  if (!character) {
                      const existingInStore = useStore.getState().characters.find(c => 
                          c.name.toLowerCase() === charName.toLowerCase() && 
                          (!c.projectId || c.projectId === prevProject.id) &&
                          c.status !== 'merged'
                      );
                      if (existingInStore) {
                          character = existingInStore;
                      }
                  }

                  if (!character) {
                      const availableColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-purple-600', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
                      const availableTextColors = ['text-red-100', 'text-blue-100', 'text-green-100', 'text-yellow-800', 'text-purple-100', 'text-pink-100', 'text-indigo-100', 'text-teal-100'];
                      const colorIndex = newCharacterMap.size % availableColors.length;
                      
                      character = onAddCharacter({
                         name: charName, 
                         color: availableColors[colorIndex], 
                         textColor: availableTextColors[colorIndex],
                         cvName: cvName,
                         description: '',
                         isStyleLockedToCv: false
                      });
                      newCharacterMap.set(charName, character);
                  }
                  
                  if (cvName && (!character.cvName || character.cvName.toLowerCase() !== cvName.toLowerCase())) {
                     charactersWithCvToUpdate.set(character.id, cvName);
                  }
                  
                  return { ...line, characterId: character.id };
                }
                
                return line;
              });
              return { ...ch, scriptLines: updatedScriptLines };
            }
            return ch;
          })
        };
      });

      setIsImportModalOpen(false);
      return charactersWithCvToUpdate;

    } catch (error) {
      console.error("Annotation import failed:", error);
      alert(`Annotation import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return new Map();
    } finally {
      setIsLoadingImportAnnotation(false);
    }
  }, [currentProject, selectedChapterId, multiSelectedChapterIds, onAddCharacter, applyUndoableProjectUpdate, setMultiSelectedChapterIdsAfterProcessing]);

  return {
    isLoadingImportAnnotation,
    isImportModalOpen,
    setIsImportModalOpen,
    handleOpenImportModalTrigger,
    handleImportPreAnnotatedScript,
  };
};
