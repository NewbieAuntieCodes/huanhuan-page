import { Character, Chapter, ScriptLine } from '../types';

export const parseHtmlWorkbook = (
  htmlString: string,
  onAddCharacter: (character: Pick<Character, 'name' | 'color' | 'textColor' | 'description' | 'cvName' | 'isStyleLockedToCv' | 'status'>) => Character
): { newChapters: Chapter[]; charactersWithCvToUpdate: Map<string, string>; characterDescriptions: Map<string, string> } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  const newChapters: Chapter[] = [];
  let currentChapter: Chapter | null = null;
  const tempCharacterMap = new Map<string, Character>();
  const charactersWithCvToUpdate = new Map<string, string>();
  const characterDescriptions = new Map<string, string>();


  const getCharacter = (speakerTag: string): Character => {
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
      cvName: cvName,
      isStyleLockedToCv: false,
      status: 'active'
    });

    if (cvName) {
        charactersWithCvToUpdate.set(newChar.id, cvName);
    }

    tempCharacterMap.set(lowerName, newChar);
    return newChar;
  };

  const saveCurrentChapter = () => {
    if (currentChapter && currentChapter.scriptLines.length > 0) {
      newChapters.push(currentChapter);
    }
    currentChapter = null;
  };

  const elements = Array.from(doc.body.children);

  const descriptionHeading = elements.find(el => el.tagName === 'H2' && el.textContent?.trim() === '主要角色介绍');
  if (descriptionHeading) {
      const descriptionContainer = descriptionHeading.nextElementSibling;
      if (descriptionContainer) {
          const descriptionParagraphs = descriptionContainer.querySelectorAll('p');
          descriptionParagraphs.forEach(p => {
              const strongTag = p.querySelector('strong');
              if (strongTag) {
                  const nameMatch = strongTag.textContent?.trim().match(/【(.*?)】/);
                  if (nameMatch && nameMatch[1]) {
                      const charName = nameMatch[1];
                      const pClone = p.cloneNode(true) as HTMLParagraphElement;
                      const strongClone = pClone.querySelector('strong');
                      if(strongClone) pClone.removeChild(strongClone);
                      const description = pClone.textContent?.trim().replace(/^：/, '').trim();
                      if(charName && description) {
                          characterDescriptions.set(charName, description);
                      }
                  }
              }
          });
      }
  }
  
  for (const el of elements) {
    if (el === descriptionHeading || el === descriptionHeading?.nextElementSibling) {
        continue;
    }

    if (el.tagName === 'H2') {
      saveCurrentChapter();
      currentChapter = {
        id: `imported_html_ch_${Date.now()}_${newChapters.length}`,
        title: el.textContent?.trim() || 'Untitled Chapter',
        rawContent: '',
        scriptLines: [],
      };
    } else if (el.tagName === 'DIV' && currentChapter) {
        // This 'el' is the wrapper div for a chapter's content
        const lineElements = el.querySelectorAll('.line');
        const rawContentParts: string[] = [];

        for (const lineEl of lineElements) {
            const dialogueSpan = lineEl.querySelector('.dialogue-line');
            let text = '';
            let characterId: string;

            if (dialogueSpan) {
                const fullText = dialogueSpan.textContent?.trim() || '';
                rawContentParts.push(fullText);
                
                const match = fullText.match(/^【(.*?)】([\s\S]*)/);
                if (match) {
                    const speakerTag = match[1].trim();
                    text = match[2].trim();
                    const character = getCharacter(speakerTag);
                    characterId = character.id;
                } else {
                    text = fullText;
                    characterId = getCharacter('Narrator').id;
                }

            } else {
                text = lineEl.textContent?.trim() || '';
                rawContentParts.push(text);
                characterId = getCharacter('Narrator').id;
            }

            if(text) {
                const scriptLine: ScriptLine = {
                    id: `imported_line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    text: text,
                    characterId: characterId,
                    isAiAudioLoading: false,
                    isAiAudioSynced: false,
                    isTextModifiedManual: false,
                };
                currentChapter.scriptLines.push(scriptLine);
            }
        }
        currentChapter.rawContent = rawContentParts.join('\n');
    }
  }

  saveCurrentChapter();

  return { newChapters, charactersWithCvToUpdate, characterDescriptions };
};