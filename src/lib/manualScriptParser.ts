
import { ScriptLine, Character } from '../types';

interface ParsedSegment {
  text: string; // Full text for display, including quotes for dialogue
  originalText?: string; // For dialogue, the text *without* quotes
  isDialogue: boolean;
}

// Helper to find or add a character and get their ID
const getCharacterId = (
  name: string,
  existingCharacters: Character[],
  addCharacterCallback: (character: Pick<Character, 'name' | 'color' | 'textColor' | 'description'>) => Character,
  tempCharMap: Map<string, Character>
): string => {
  const standardizedName = name.trim(); // Keep name as is, e.g., "待识别角色" or "Narrator"
  const standardizedNameLower = standardizedName.toLowerCase();

  const existingByName = existingCharacters.find(c => c.name.toLowerCase() === standardizedNameLower);
  if (existingByName) {
    return existingByName.id;
  }
  if (tempCharMap.has(standardizedNameLower)) {
    return tempCharMap.get(standardizedNameLower)!.id;
  }

  const availableColors = ['bg-gray-500', 'bg-stone-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'];
  const colorIndex = tempCharMap.size % availableColors.length;
  
  const UNKNOWN_SPEAKER_NAME_INTERNAL = "待识别角色"; // Use constant for "待识别角色"

  const newCharData = {
    name: standardizedName,
    color: standardizedName === "Narrator" ? 'bg-slate-600' : (standardizedName === UNKNOWN_SPEAKER_NAME_INTERNAL ? 'bg-orange-400' : availableColors[colorIndex]),
    textColor: standardizedName === "Narrator" ? 'text-slate-100' : (standardizedName === UNKNOWN_SPEAKER_NAME_INTERNAL ? 'text-orange-900': 'text-white'),
    description: '', // Default description is now empty
  };
  const addedChar = addCharacterCallback(newCharData);
  tempCharMap.set(standardizedNameLower, addedChar);
  return addedChar.id;
};

export const parseRawTextToScriptLinesByRules = (
  rawText: string,
  existingCharacters: Character[],
  addCharacterCallback: (character: Pick<Character, 'name' | 'color' | 'textColor' | 'description'>) => Character
): ScriptLine[] => {
  if (!rawText || rawText.trim() === "") return [];

  const outputSegments: ParsedSegment[] = [];
  const lines = rawText.split(/\r?\n/);

  const CHINESE_QUOTE_START = '“';
  const CHINESE_QUOTE_END = '”';

  for (const line of lines) {
    let currentPos = 0;
    const lineLength = line.length;

    while (currentPos < lineLength) {
      const nextDialogueStart = line.indexOf(CHINESE_QUOTE_START, currentPos);

      if (nextDialogueStart === -1) { // No more dialogue in this line
        const remainingNarration = line.substring(currentPos).trim();
        if (remainingNarration) {
          outputSegments.push({
            text: remainingNarration,
            originalText: remainingNarration,
            isDialogue: false,
          });
        }
        break; // Move to next line
      }

      // Narration before this dialogue
      const narrationBeforeText = line.substring(currentPos, nextDialogueStart).trim();
      if (narrationBeforeText) {
        outputSegments.push({
          text: narrationBeforeText,
          originalText: narrationBeforeText,
          isDialogue: false,
        });
      }

      // Find dialogue end
      const nextDialogueEnd = line.indexOf(CHINESE_QUOTE_END, nextDialogueStart + 1);
      if (nextDialogueEnd === -1) { // Unclosed quote, treat rest of line as narration/dialogue based on start
        const restOfLine = line.substring(nextDialogueStart).trim();
         if (restOfLine) {
            outputSegments.push({
                text: restOfLine, // Keep the opening quote
                originalText: restOfLine.substring(1), // Text after quote
                isDialogue: true, // Treat as dialogue due to opening quote
            });
        }
        break; // Move to next line
      }

      // Dialogue content
      const dialogueTextWithQuotes = line.substring(nextDialogueStart, nextDialogueEnd + 1);
      const dialogueTextWithoutQuotes = line.substring(nextDialogueStart + 1, nextDialogueEnd);
      outputSegments.push({
        text: dialogueTextWithQuotes,
        originalText: dialogueTextWithoutQuotes,
        isDialogue: true,
      });

      currentPos = nextDialogueEnd + 1;
    }
  }


  // Convert ParsedSegments to ScriptLines and consolidate narrators
  const scriptLines: ScriptLine[] = [];
  const tempCharacterMap = new Map<string, Character>(); 

  const NARRATOR_NAME = "Narrator";
  const UNKNOWN_SPEAKER_NAME = "待识别角色";

  for (let i = 0; i < outputSegments.length; i++) {
    const segment = outputSegments[i];
    const characterNameForSegment = segment.isDialogue ? UNKNOWN_SPEAKER_NAME : NARRATOR_NAME;

    if (
      !segment.isDialogue && // Current is narrator
      scriptLines.length > 0 && // There's a previous line
      scriptLines[scriptLines.length - 1].characterId &&
      (existingCharacters.find(c => c.id === scriptLines[scriptLines.length - 1].characterId)?.name === NARRATOR_NAME ||
       tempCharacterMap.get(NARRATOR_NAME.toLowerCase())?.id === scriptLines[scriptLines.length - 1].characterId)
    ) {
      // Consolidate with previous narrator line
      scriptLines[scriptLines.length - 1].text += `\n${segment.text}`;
      if (scriptLines[scriptLines.length - 1].originalText) {
         scriptLines[scriptLines.length - 1].originalText += `\n${segment.text}`;
      } else {
         scriptLines[scriptLines.length - 1].originalText = segment.text;
      }
    } else {
      // New line (either dialogue or first narrator in a sequence)
      const charId = getCharacterId(characterNameForSegment, existingCharacters, addCharacterCallback, tempCharacterMap);
      scriptLines.push({
        id: Date.now().toString() + "_line_manual_" + i + Math.random(),
        text: segment.text,
        originalText: segment.originalText,
        characterId: charId,
        isAiAudioLoading: false,
        isAiAudioSynced: false,
        isTextModifiedManual: false,
      });
    }
  }

  return scriptLines;
};