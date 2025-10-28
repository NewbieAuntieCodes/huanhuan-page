import { Character, Chapter, ScriptLine } from '../types';

export const parseImportedScriptToChapters = (
  rawText: string,
  onAddCharacter: (character: Pick<Character, 'name' | 'color' | 'textColor' | 'description' | 'cvName' | 'isStyleLockedToCv' | 'status'>) => Character
): { newChapters: Chapter[]; charactersWithCvToUpdate: Map<string, string>; characterDescriptions: Map<string, string> } => {
  if (!rawText || !rawText.trim()) return { newChapters: [], charactersWithCvToUpdate: new Map(), characterDescriptions: new Map() };

  const lines = rawText.split(/\r?\n/);
  const newChapters: Chapter[] = [];
  let currentChapterContent: ScriptLine[] = [];
  let currentChapterTitle = "导入的章节 1";
  let chapterCounter = 1;

  const chapterTitleLineRegex = /^(?:##\d+\s*\.\s*)?(Chapter\s+\d+|Part\s+\d+|第\s*[一二三四五六七八九十百千万零\d]+\s*[章章节回卷篇部]|楔子|序章|引子|尾声|Prologue|Epilogue|前言|后记)/i;
  const scriptLineRegex = /^【(.*?)】([\s\S]*)/;

  const tempCharacterMap = new Map<string, Character>();
  const charactersWithCvToUpdate = new Map<string, string>(); // Map of characterId -> cvName

  const getCharacter = (nameAndCv: string): Character => {
    let charName = nameAndCv;
    let cvName: string | undefined = undefined;

    // Split "CVName-CharacterName" format. Handles various hyphen types.
    const parts = nameAndCv.split(/[-－–—]/);
    if (parts.length > 1) {
      const potentialCv = parts[0].trim();
      const potentialCharName = parts.slice(1).join('-').trim();
      if (potentialCv && potentialCharName) {
        cvName = potentialCv;
        charName = potentialCharName;
      }
    }

    const lowerName = charName.toLowerCase();
    if (tempCharacterMap.has(lowerName)) {
      const existingChar = tempCharacterMap.get(lowerName)!;
      if (cvName && (!existingChar.cvName || existingChar.cvName.toLowerCase() !== cvName.toLowerCase())) {
          charactersWithCvToUpdate.set(existingChar.id, cvName);
      }
      return existingChar;
    }

    const availableColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-purple-600', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
    const availableTextColors = ['text-red-100', 'text-blue-100', 'text-green-100', 'text-yellow-800', 'text-purple-100', 'text-pink-100', 'text-indigo-100', 'text-teal-100'];
    const colorIndex = tempCharacterMap.size % availableColors.length;

    const newChar = onAddCharacter({
      name: charName,
      color: charName.toLowerCase() === 'narrator' ? 'bg-slate-500' : availableColors[colorIndex],
      textColor: charName.toLowerCase() === 'narrator' ? 'text-slate-100' : availableTextColors[colorIndex],
      description: '',
      cvName: cvName, // Pass initial CV name
      isStyleLockedToCv: false,
      status: 'active'
    });
    
    if (cvName && (!newChar.cvName || newChar.cvName.toLowerCase() !== cvName.toLowerCase())) {
        charactersWithCvToUpdate.set(newChar.id, cvName);
    }

    tempCharacterMap.set(lowerName, newChar);
    return newChar;
  };

  const saveCurrentChapter = () => {
    if (currentChapterContent.length > 0) {
      const allCharacters = Array.from(tempCharacterMap.values());
      const rawContent = currentChapterContent.map(line => {
        const character = allCharacters.find(c => c.id === line.characterId);
        if (character && character.name.toLowerCase() !== 'narrator') {
            return `【${character.name}】${line.text}`;
        }
        return line.text;
      }).join('\n');

      newChapters.push({
        id: `imported_ch_${Date.now()}_${chapterCounter}`,
        title: currentChapterTitle,
        rawContent: rawContent,
        scriptLines: currentChapterContent,
      });

      currentChapterContent = [];
      chapterCounter++;
      currentChapterTitle = `导入的章节 ${chapterCounter}`;
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (chapterTitleLineRegex.test(trimmedLine)) {
      saveCurrentChapter();
      currentChapterTitle = trimmedLine;
      continue;
    }

    const match = trimmedLine.match(scriptLineRegex);
    let character: Character;
    let text: string;

    if (match) {
      const charName = match[1].trim();
      text = match[2].trim();
      character = getCharacter(charName);
    } else {
      text = trimmedLine;
      character = getCharacter('Narrator');
    }

    const scriptLine: ScriptLine = {
      id: `imported_line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: text,
      characterId: character.id,
      isAiAudioLoading: false,
      isAiAudioSynced: false,
      isTextModifiedManual: false,
    };
    currentChapterContent.push(scriptLine);
  }

  saveCurrentChapter();

  return { newChapters, charactersWithCvToUpdate, characterDescriptions: new Map() };
};