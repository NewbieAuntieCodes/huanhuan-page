// FIX: Changed React import from a named import to a default import to correctly resolve the React namespace for types like React.ChangeEvent.
import React, { useState, useCallback } from 'react';
import { Project, Character, Chapter, ScriptLine } from '../../../types';

interface UseAudioFileMatcherProps {
  currentProject: Project | undefined;
  characters: Character[];
  assignAudioToLine: (projectId: string, chapterId: string, lineId: string, audioBlob: Blob) => Promise<void>;
}

const parseChapterIdentifier = (identifier: string): string[] => {
    if (identifier.includes('-')) {
        const parts = identifier.split('-').map(p => parseInt(p, 10));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const [start, end] = parts;
            const range = [];
            for (let i = start; i <= end; i++) {
                range.push(i.toString());
            }
            return range;
        }
    }
    if (!isNaN(parseInt(identifier, 10))) {
        return [identifier];
    }
    return []; 
};

export const useAudioFileMatcher = ({
  currentProject,
  characters,
  assignAudioToLine,
}: UseAudioFileMatcherProps) => {
  const [isCvMatchLoading, setIsCvMatchLoading] = useState(false);
  const [isCharacterMatchLoading, setIsCharacterMatchLoading] = useState(false);
  const [isChapterMatchLoading, setIsChapterMatchLoading] = useState(false);

  const handleFileSelectionForCvMatch = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !currentProject) return;
  
      setIsCvMatchLoading(true);
  
      const cvFileGroups = new Map<string, { file: File; sequence: number; chapterMatchers: string[] }[]>();
  
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
          const parts = nameWithoutExt.split('_');
  
          if (parts.length === 3) { // Expecting chapter_cv_seq
              const chapterIdentifier = parts[0];
              const cvName = parts[1];
              const sequence = parseInt(parts[2], 10);
  
              if (cvName && !isNaN(sequence)) {
                  if (!cvFileGroups.has(cvName)) {
                      cvFileGroups.set(cvName, []);
                  }
                  cvFileGroups.get(cvName)!.push({
                      file: file,
                      sequence,
                      chapterMatchers: parseChapterIdentifier(chapterIdentifier),
                  });
              }
          }
      }
      
      let matchedCount = 0;
      let missedCount = 0;
  
      for (const [cvName, filesForCv] of cvFileGroups.entries()) {
          const targetCharacterIds = new Set(
              characters.filter(c => c.cvName === cvName && c.status !== 'merged').map(c => c.id)
          );
          if (targetCharacterIds.size === 0) {
              missedCount += filesForCv.length;
              continue;
          }
  
          const allChapterMatchers = new Set<string>();
          filesForCv.forEach(f => f.chapterMatchers.forEach(m => allChapterMatchers.add(m)));
  
          const targetChapters = currentProject.chapters.filter(chapter => 
              Array.from(allChapterMatchers).some(matcher => chapter.title.includes(matcher))
          );
  
          if (targetChapters.length === 0) {
              missedCount += filesForCv.length;
              continue;
          }
          
          const chapterOrderMap = new Map(currentProject.chapters.map((ch, i) => [ch.id, i]));
          targetChapters.sort((a: Chapter, b: Chapter) => {
            const aIndex = chapterOrderMap.get(a.id);
            const bIndex = chapterOrderMap.get(b.id);
            if (typeof aIndex === 'number' && typeof bIndex === 'number') {
              return aIndex - bIndex;
            }
            if (typeof aIndex === 'number') return -1;
            if (typeof bIndex === 'number') return 1;
            return 0;
          });
  
          const targetLines: { line: ScriptLine; chapterId: string }[] = [];
          for (const chapter of targetChapters) {
              for (const line of chapter.scriptLines) {
                  if (line.characterId && targetCharacterIds.has(line.characterId)) {
                      targetLines.push({ line, chapterId: chapter.id });
                  }
              }
          }
  
          const sortedFiles = filesForCv.sort((a, b) => a.sequence - b.sequence);
  
          const limit = Math.min(targetLines.length, sortedFiles.length);
          for (let i = 0; i < limit; i++) {
              const { line, chapterId } = targetLines[i];
              const { file } = sortedFiles[i];
              await assignAudioToLine(currentProject.id, chapterId, line.id, file);
              matchedCount++;
          }
          missedCount += sortedFiles.length - limit;
      }
  
      setIsCvMatchLoading(false);
      alert(`按CV匹配完成。\n成功匹配: ${matchedCount} 个文件\n未匹配: ${missedCount} 个文件`);
  
      if (event.target) {
          event.target.value = '';
      }
  }, [currentProject, characters, assignAudioToLine]);
  
  const handleFileSelectionForCharacterMatch = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0 || !currentProject) return;

      setIsCharacterMatchLoading(true);
      
      const fileGroups = new Map<string, { file: File; sequence: number }[]>();

      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
          const parts = nameWithoutExt.split('_');

          if (parts.length === 4) { // Expecting chapter_cv_char_seq
              const sequence = parseInt(parts[3], 10);
              if (!isNaN(sequence)) {
                  const baseName = `${parts[0]}_${parts[1]}_${parts[2]}`; // chapter_cv_char
                  if (!fileGroups.has(baseName)) {
                      fileGroups.set(baseName, []);
                  }
                  fileGroups.get(baseName)!.push({ file: file, sequence });
              }
          } else if (parts.length === 3) { // Expecting chapter_char_seq
              const sequence = parseInt(parts[2], 10);
              if (!isNaN(sequence)) {
                  const baseName = `${parts[0]}_${parts[1]}`; // chapter_char
                  const key = `NO_CV::${baseName}`; // Marker for no CV in filename
                  if (!fileGroups.has(key)) {
                      fileGroups.set(key, []);
                  }
                  fileGroups.get(key)!.push({ file: file, sequence });
              }
          }
      }

      let matchedCount = 0;
      let missedCount = 0;
      
      for (const [groupKey, filesForGroup] of fileGroups.entries()) {
          let chapterIdentifier: string;
          let characterName: string;
          let cvName: string | undefined;

          if (groupKey.startsWith('NO_CV::')) {
              const baseName = groupKey.replace('NO_CV::', '');
              const parts = baseName.split('_');
              chapterIdentifier = parts[0];
              characterName = parts[1];
              cvName = undefined;
          } else {
              const parts = groupKey.split('_');
              chapterIdentifier = parts[0];
              cvName = parts[1];
              characterName = parts[2];
          }

          if (!chapterIdentifier || !characterName) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const targetCharacters: Character[] = characters.filter(c => {
              const nameMatch = c.name === characterName;
              const cvMatch = cvName ? c.cvName === cvName : true; // If no cvName, match any CV for that character name.
              return nameMatch && cvMatch && c.status !== 'merged';
          });
          
          if (targetCharacters.length === 0) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const targetCharacterIds = new Set(targetCharacters.map(c => c.id));
          const chapterMatchers = parseChapterIdentifier(chapterIdentifier);
          if (chapterMatchers.length === 0) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const targetChapters = currentProject.chapters.filter(chapter => 
              chapterMatchers.some(matcher => chapter.title.includes(matcher))
          );
          
          if (targetChapters.length === 0) {
              missedCount += filesForGroup.length;
              continue;
          }
          
          const chapterOrderMap = new Map(currentProject.chapters.map((ch, i) => [ch.id, i]));
          targetChapters.sort((a: Chapter, b: Chapter) => {
            const aIndex = chapterOrderMap.get(a.id);
            const bIndex = chapterOrderMap.get(b.id);
            if (typeof aIndex === 'number' && typeof bIndex === 'number') return aIndex - bIndex;
            if (typeof aIndex === 'number') return -1;
            if (typeof bIndex === 'number') return 1;
            return 0;
          });
          
          const targetLines: { line: ScriptLine; chapterId: string }[] = [];
          for (const chapter of targetChapters) {
              for (const line of chapter.scriptLines) {
                  if (line.characterId && targetCharacterIds.has(line.characterId)) {
                      targetLines.push({ line, chapterId: chapter.id });
                  }
              }
          }
          
          const sortedFiles = filesForGroup.sort((a, b) => a.sequence - b.sequence);
          
          const limit = Math.min(targetLines.length, sortedFiles.length);
          for (let i = 0; i < limit; i++) {
              const { line, chapterId } = targetLines[i];
              const { file } = sortedFiles[i];
              await assignAudioToLine(currentProject.id, chapterId, line.id, file);
              matchedCount++;
          }
          missedCount += sortedFiles.length - limit;
      }
      
      setIsCharacterMatchLoading(false);
      alert(`按角色匹配完成。\n成功匹配: ${matchedCount} 个文件\n未匹配: ${missedCount} 个文件`);

      if (event.target) {
          event.target.value = '';
      }
  }, [currentProject, characters, assignAudioToLine]);

  const handleFileSelectionForChapterMatch = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !currentProject) return;

    setIsChapterMatchLoading(true);

    const chapterFileGroups = new Map<string, { file: File; sequence: number }[]>();

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
        const parts = nameWithoutExt.split('_');

        if (parts.length === 2) { // Expecting chapter_seq
            const chapterIdentifier = parts[0];
            const sequence = parseInt(parts[1], 10);

            if (chapterIdentifier && !isNaN(sequence)) {
                if (!chapterFileGroups.has(chapterIdentifier)) {
                    chapterFileGroups.set(chapterIdentifier, []);
                }
                chapterFileGroups.get(chapterIdentifier)!.push({ file: file, sequence });
            }
        }
    }

    let matchedCount = 0;
    let missedCount = 0;

    for (const [chapterIdentifier, filesForGroup] of chapterFileGroups.entries()) {
        const chapterMatchers = parseChapterIdentifier(chapterIdentifier);
        if (chapterMatchers.length === 0) {
            missedCount += filesForGroup.length;
            continue;
        }

        const targetChapters = currentProject.chapters.filter(chapter =>
            chapterMatchers.some(matcher => chapter.title.includes(matcher))
        );

        if (targetChapters.length === 0) {
            missedCount += filesForGroup.length;
            continue;
        }

        const chapterOrderMap = new Map(currentProject.chapters.map((ch, i) => [ch.id, i]));
        targetChapters.sort((a: Chapter, b: Chapter) => {
            const aIndex = chapterOrderMap.get(a.id);
            const bIndex = chapterOrderMap.get(b.id);
            if (typeof aIndex === 'number' && typeof bIndex === 'number') return aIndex - bIndex;
            if (typeof aIndex === 'number') return -1;
            if (typeof bIndex === 'number') return 1;
            return 0;
        });

        const targetLines: { line: ScriptLine; chapterId: string }[] = [];
        for (const chapter of targetChapters) {
            for (const line of chapter.scriptLines) {
                targetLines.push({ line, chapterId: chapter.id });
            }
        }
        
        const sortedFiles = filesForGroup.sort((a, b) => a.sequence - b.sequence);
        
        const limit = Math.min(targetLines.length, sortedFiles.length);
        for (let i = 0; i < limit; i++) {
            const { line, chapterId } = targetLines[i];
            const { file } = sortedFiles[i];
            await assignAudioToLine(currentProject.id, chapterId, line.id, file);
            matchedCount++;
        }
        missedCount += sortedFiles.length - limit;
    }

    setIsChapterMatchLoading(false);
    alert(`按章节匹配完成。\n成功匹配: ${matchedCount} 个文件\n未匹配: ${missedCount} 个文件`);

    if (event.target) {
        event.target.value = '';
    }
  }, [currentProject, assignAudioToLine]);

  return {
    isCvMatchLoading,
    handleFileSelectionForCvMatch,
    isCharacterMatchLoading,
    handleFileSelectionForCharacterMatch,
    isChapterMatchLoading,
    handleFileSelectionForChapterMatch,
  };
};