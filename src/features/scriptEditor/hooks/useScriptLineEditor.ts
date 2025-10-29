

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

    if (!currentProject) return;

    applyUndoableProjectUpdate(prevProject => {
        const project = { ...prevProject };
        const chapterIndex = project.chapters.findIndex(ch => ch.id === chapterId);
        if (chapterIndex === -1) return prevProject;

        const chapter = { ...project.chapters[chapterIndex] };
        const lineIndex = chapter.scriptLines.findIndex(l => l.id === lineId);
        if (lineIndex === -1) return prevProject;

        const currentLine = chapter.scriptLines[lineIndex];
        const originalCharacter = characters.find(c => c.id === currentLine.characterId);
        
        const isChangingToNarrator = newCharacterId === '' || newCharacterId === narratorCharacter?.id;

        if (isChangingToNarrator) {
            const isOriginallyCharacter = originalCharacter && originalCharacter.name !== 'Narrator';
            // Only apply special logic if changing from a character TO a narrator
            if (!isOriginallyCharacter) {
                const newScriptLines = [...chapter.scriptLines];
                newScriptLines[lineIndex] = { ...currentLine, characterId: newCharacterId };
                chapter.scriptLines = newScriptLines;
                project.chapters[chapterIndex] = chapter;
                return project;
            }

            // 1. Transform text: double quotes to single quotes
            let textToMerge = currentLine.text;
            const trimmedText = textToMerge.trim();
            if ((trimmedText.startsWith('“') && trimmedText.endsWith('”')) || (trimmedText.startsWith('「') && trimmedText.endsWith('」'))) {
                const content = trimmedText.substring(1, trimmedText.length - 1);
                const before = textToMerge.substring(0, textToMerge.indexOf(trimmedText));
                const after = textToMerge.substring(textToMerge.indexOf(trimmedText) + trimmedText.length);
                textToMerge = `${before}‘${content}’${after}`;
            }

            // 2. Find the entire contiguous block of Narrator lines
            let firstIndex = lineIndex;
            while (firstIndex > 0) {
                const prevLine = chapter.scriptLines[firstIndex - 1];
                const prevChar = characters.find(c => c.id === prevLine.characterId);
                if (!prevChar || prevChar.name === 'Narrator') {
                    firstIndex--;
                } else {
                    break;
                }
            }

            let lastIndex = lineIndex;
            while (lastIndex < chapter.scriptLines.length - 1) {
                const nextLine = chapter.scriptLines[lastIndex + 1];
                const nextChar = characters.find(c => c.id === nextLine.characterId);
                if (!nextChar || nextChar.name === 'Narrator') {
                    lastIndex++;
                } else {
                    break;
                }
            }
            
            // 3. Merge if there's a block of more than one line
            if (firstIndex !== lastIndex) {
                const linesToProcess = chapter.scriptLines.slice(firstIndex, lastIndex + 1);
                const combinedText = linesToProcess.map((line, index) => {
                    if ((firstIndex + index) === lineIndex) return textToMerge;
                    return line.text;
                }).join('');

                const mergedLine: ScriptLine = {
                    ...chapter.scriptLines[firstIndex],
                    text: combinedText,
                    characterId: newCharacterId,
                };

                const lineIdsToRemove = new Set(linesToProcess.map(l => l.id));
                const filteredLines = chapter.scriptLines.filter(l => !lineIdsToRemove.has(l.id));
                
                filteredLines.splice(firstIndex, 0, mergedLine);
                chapter.scriptLines = filteredLines;
                project.chapters[chapterIndex] = chapter;
                return project;
            } else {
                // No merge, just update the single line's text and character
                const newScriptLines = [...chapter.scriptLines];
                newScriptLines[lineIndex] = { ...currentLine, text: textToMerge, characterId: newCharacterId };
                chapter.scriptLines = newScriptLines;
                project.chapters[chapterIndex] = chapter;
                return project;
            }

        } else {
            // Handle changing FROM Narrator TO a character
            let newText = currentLine.text;
            const isOriginallyNarrator = !originalCharacter || originalCharacter.id === narratorCharacter?.id;
            
            if (isOriginallyNarrator) {
                const trimmedText = newText.trim();
                const isAlreadyDialogue = (trimmedText.startsWith('“') && trimmedText.endsWith('”')) || (trimmedText.startsWith('「') && trimmedText.endsWith('」'));

                if (!isAlreadyDialogue) {
                    let content = trimmedText;
                    // Unwrap single quotes if they exist from a previous conversion
                    if (content.startsWith('‘') && content.endsWith('’')) {
                        content = content.substring(1, content.length - 1);
                    }
                    const before = newText.substring(0, newText.indexOf(trimmedText));
                    const after = newText.substring(newText.indexOf(trimmedText) + trimmedText.length);
                    newText = `${before}“${content}”${after}`;
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
