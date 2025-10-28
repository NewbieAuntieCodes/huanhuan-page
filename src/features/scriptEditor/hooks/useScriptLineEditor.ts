import { useCallback } from 'react';
import { Project, Character, ScriptLine } from '../../../types';

export const useScriptLineEditor = (
  currentProject: Project | null,
  characters: Character[],
  applyUndoableProjectUpdate: (updater: (prevProject: Project) => Project) => void,
  selectedChapterId: string | null
) => {

  const updateLineInProject = useCallback((chapterId: string, lineId: string, lineUpdater: (line: ScriptLine) => ScriptLine) => {
    applyUndoableProjectUpdate(prevProject => ({
      ...prevProject,
      chapters: prevProject.chapters.map(ch => {
        if (ch.id === chapterId) {
          return {
            ...ch,
            scriptLines: ch.scriptLines.map(l => l.id === lineId ? lineUpdater(l) : l)
          };
        }
        return ch;
      })
    }));
  }, [applyUndoableProjectUpdate]);

  const handleUpdateScriptLineText = useCallback((chapterId: string, lineId: string, newText: string) => {
    updateLineInProject(chapterId, lineId, line => ({
      ...line,
      text: newText,
      isTextModifiedManual: true,
      isAiAudioSynced: line.text === newText,
    }));
  }, [updateLineInProject]);

  const handleUpdateSoundType = useCallback((chapterId: string, lineId: string, newSoundType: string) => {
    updateLineInProject(chapterId, lineId, line => ({
      ...line,
      soundType: newSoundType,
    }));
  }, [updateLineInProject]);

  const handleAssignCharacterToLine = useCallback((chapterId: string, lineId: string, newCharacterId: string) => {
    const narratorCharacter = characters.find(c => c.name === 'Narrator');
    const newCharacter = characters.find(c => c.id === newCharacterId);

    if (!currentProject || !newCharacter) return;

    applyUndoableProjectUpdate(prevProject => {
        const project = { ...prevProject };
        const chapterIndex = project.chapters.findIndex(ch => ch.id === chapterId);
        if (chapterIndex === -1) return prevProject;

        const chapter = { ...project.chapters[chapterIndex] };
        const lineIndex = chapter.scriptLines.findIndex(l => l.id === lineId);
        if (lineIndex === -1) return prevProject;

        const currentLine = chapter.scriptLines[lineIndex];
        const originalCharacter = characters.find(c => c.id === currentLine.characterId);
        
        // Case 1: Changing TO Narrator
        if (newCharacter.id === narratorCharacter?.id) {
            let convertedText = currentLine.text;
            const isOriginallyCharacter = originalCharacter && originalCharacter.name !== 'Narrator';
            if (isOriginallyCharacter) {
                 const trimmedText = convertedText.trim();
                 // If it's quoted, unquote it.
                 if (trimmedText.startsWith('“') && trimmedText.endsWith('”')) {
                    const content = trimmedText.substring(1, trimmedText.length - 1);
                    // This is safer than .replace() if content is repeated
                    const before = convertedText.substring(0, convertedText.indexOf(trimmedText));
                    const after = convertedText.substring(convertedText.indexOf(trimmedText) + trimmedText.length);
                    convertedText = before + content + after;
                }
            }

            const previousLine = lineIndex > 0 ? chapter.scriptLines[lineIndex - 1] : null;
            const nextLine = lineIndex < chapter.scriptLines.length - 1 ? chapter.scriptLines[lineIndex + 1] : null;

            const isPrevNarrator = !previousLine?.characterId || previousLine?.characterId === narratorCharacter?.id;
            const isNextNarrator = !nextLine?.characterId || nextLine?.characterId === narratorCharacter?.id;

            let newScriptLines = [...chapter.scriptLines];

            if (isPrevNarrator && isNextNarrator) {
                const combinedText = `${previousLine!.text}\n${convertedText}\n${nextLine!.text}`;
                newScriptLines[lineIndex - 1] = { ...previousLine!, text: combinedText };
                newScriptLines = newScriptLines.filter(l => l.id !== currentLine.id && l.id !== nextLine!.id);
            } else if (isPrevNarrator) {
                const combinedText = `${previousLine!.text}\n${convertedText}`;
                newScriptLines[lineIndex - 1] = { ...previousLine!, text: combinedText };
                newScriptLines = newScriptLines.filter(l => l.id !== currentLine.id);
            } else if (isNextNarrator) {
                const combinedText = `${convertedText}\n${nextLine!.text}`;
                newScriptLines[lineIndex] = { ...currentLine, text: combinedText, characterId: newCharacterId };
                newScriptLines = newScriptLines.filter(l => l.id !== nextLine!.id);
            } else {
                newScriptLines[lineIndex] = { ...currentLine, text: convertedText, characterId: newCharacterId };
            }

            chapter.scriptLines = newScriptLines;
            project.chapters[chapterIndex] = chapter;
            return project;
        } 
        
        // Case 2: Changing FROM Narrator/unassigned TO a character
        else {
            let newText = currentLine.text;
            const isOriginallyNarrator = !originalCharacter || originalCharacter.id === narratorCharacter?.id;
            
            if (isOriginallyNarrator) {
                const trimmedText = newText.trim();
                // If it's not already a dialogue line, wrap it in quotes.
                if (trimmedText && !trimmedText.startsWith('“') && !trimmedText.startsWith('「')) {
                    newText = `“${newText}”`;
                }
            }
            
            const newScriptLines = [...chapter.scriptLines];
            newScriptLines[lineIndex] = { ...currentLine, text: newText, characterId: newCharacterId };
            chapter.scriptLines = newScriptLines;
            project.chapters[chapterIndex] = chapter;
            return project;
        }
    });
  }, [applyUndoableProjectUpdate, characters, currentProject]);


  const handleSplitScriptLine = useCallback((chapterId: string, lineId: string, splitIndex: number) => {
    applyUndoableProjectUpdate(prevProject => {
        const newChapters = prevProject.chapters.map(ch => {
            if (ch.id === chapterId) {
                const newScriptLines: ScriptLine[] = [];
                ch.scriptLines.forEach(line => {
                    if (line.id === lineId) {
                        const originalText = line.text;
                        const part1 = originalText.substring(0, splitIndex).trim();
                        const part2 = originalText.substring(splitIndex).trim();

                        if (part1) {
                            newScriptLines.push({
                                ...line,
                                id: `${line.id}_split_1_${Date.now()}_${Math.random()}`,
                                text: part1,
                            });
                        }
                        if (part2) {
                            newScriptLines.push({
                                ...line,
                                id: `${line.id}_split_2_${Date.now()}_${Math.random()}`,
                                text: part2,
                            });
                        }
                    } else {
                        newScriptLines.push(line);
                    }
                });
                return { ...ch, scriptLines: newScriptLines };
            }
            return ch;
        });
        return { ...prevProject, chapters: newChapters };
    });
  }, [applyUndoableProjectUpdate]);

  const handleMergeAdjacentLines = useCallback((chapterId: string, lineId: string) => {
    applyUndoableProjectUpdate(prevProject => {
      const chapterIndex = prevProject.chapters.findIndex(ch => ch.id === chapterId);
      if (chapterIndex === -1) return prevProject;

      const chapter = prevProject.chapters[chapterIndex];
      const lineIndex = chapter.scriptLines.findIndex(l => l.id === lineId);
      if (lineIndex === -1) return prevProject;

      const characterId = chapter.scriptLines[lineIndex].characterId;
      if (!characterId) return prevProject; // Cannot merge lines without a character.

      let firstLineIndex = lineIndex;
      while (firstLineIndex > 0 && chapter.scriptLines[firstLineIndex - 1].characterId === characterId) {
        firstLineIndex--;
      }

      let lastLineIndex = lineIndex;
      while (lastLineIndex < chapter.scriptLines.length - 1 && chapter.scriptLines[lastLineIndex + 1].characterId === characterId) {
        lastLineIndex++;
      }

      if (firstLineIndex === lastLineIndex) {
        // No adjacent lines to merge.
        return prevProject;
      }

      const linesToMerge = chapter.scriptLines.slice(firstLineIndex, lastLineIndex + 1);
      const combinedText = linesToMerge.map(l => l.text).join('\n');

      const mergedLine: ScriptLine = {
        ...chapter.scriptLines[firstLineIndex],
        text: combinedText,
      };

      const newScriptLines = [
        ...chapter.scriptLines.slice(0, firstLineIndex),
        mergedLine,
        ...chapter.scriptLines.slice(lastLineIndex + 1),
      ];

      const updatedChapter = { ...chapter, scriptLines: newScriptLines };
      const newChapters = [...prevProject.chapters];
      newChapters[chapterIndex] = updatedChapter;

      return { ...prevProject, chapters: newChapters };
    });
  }, [applyUndoableProjectUpdate]);

  const handleDeleteScriptLine = useCallback((chapterId: string, lineId: string) => {
    applyUndoableProjectUpdate(prevProject => ({
      ...prevProject,
      chapters: prevProject.chapters.map(ch => {
        if (ch.id === chapterId) {
          return {
            ...ch,
            scriptLines: ch.scriptLines.filter(l => l.id !== lineId)
          };
        }
        return ch;
      })
    }));
  }, [applyUndoableProjectUpdate]);

  return {
    handleUpdateScriptLineText,
    handleAssignCharacterToLine,
    handleSplitScriptLine,
    handleMergeAdjacentLines,
    handleDeleteScriptLine,
    handleUpdateSoundType,
  };
};