
import { AiAnnotatedLine, Character, ScriptLine } from '../types';

// This function converts raw AI annotated lines into ScriptLine objects
// and handles character creation/lookup.
export const processAiScriptAnnotations = (
  annotatedLinesFromAI: AiAnnotatedLine[],
  onAddCharacter: (character: Pick<Character, 'name' | 'color' | 'textColor' | 'cvName' | 'description' | 'isStyleLockedToCv'>) => Character
): { newScriptLines: ScriptLine[] } => {
  const consolidatedAiLines: AiAnnotatedLine[] = [];
  let lastLineWasNarrator = false;

  for (const currentAiLine of annotatedLinesFromAI) {
    const isCurrentLineNarrator = currentAiLine.suggested_character_name.toLowerCase() === 'narrator';
    if (isCurrentLineNarrator && lastLineWasNarrator && consolidatedAiLines.length > 0) {
      consolidatedAiLines[consolidatedAiLines.length - 1].line_text += `\n${currentAiLine.line_text}`;
    } else {
      consolidatedAiLines.push({ ...currentAiLine });
    }
    lastLineWasNarrator = isCurrentLineNarrator;
  }

  const defaultNarratorName = "Narrator";
  const tempCharacterNameMap = new Map<string, Character>(); // Local cache for this processing run

  const updatedScriptLines: ScriptLine[] = consolidatedAiLines.map((item, index) => {
    const suggestedName = item.suggested_character_name.trim();
    const suggestedNameLower = suggestedName.toLowerCase();
    let characterForLine: Character | undefined;

    if (suggestedNameLower === 'narrator' || suggestedName === "") {
      if (tempCharacterNameMap.has(defaultNarratorName)) {
        characterForLine = tempCharacterNameMap.get(defaultNarratorName);
      } else {
        const newNarratorCandidate = {
          name: defaultNarratorName,
          color: 'bg-slate-500',
          textColor: 'text-slate-100',
          cvName: '',
          description: '',
          isStyleLockedToCv: false,
        };
        const actualNarrator = onAddCharacter(newNarratorCandidate);
        tempCharacterNameMap.set(defaultNarratorName, actualNarrator);
        characterForLine = actualNarrator;
      }
    } else {
      if (tempCharacterNameMap.has(suggestedNameLower)) {
        characterForLine = tempCharacterNameMap.get(suggestedNameLower);
      } else {
        const availableColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-purple-600', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];
        const availableTextColors = ['text-red-100', 'text-blue-100', 'text-green-100', 'text-yellow-800', 'text-purple-100', 'text-pink-100', 'text-indigo-100', 'text-teal-100'];
        const colorIndex = tempCharacterNameMap.size % availableColors.length;
        const newCharacterCandidate = {
          name: suggestedName,
          color: availableColors[colorIndex],
          textColor: availableTextColors[colorIndex],
          cvName: '',
          description: '',
          isStyleLockedToCv: false,
        };
        const actualCharacter = onAddCharacter(newCharacterCandidate);
        tempCharacterNameMap.set(suggestedNameLower, actualCharacter);
        characterForLine = actualCharacter;
      }
    }

    const rawTextFromAI = item.line_text;
    let displayText = rawTextFromAI;
    // Add quotes for dialogue lines if not already present and not narrator
    if (characterForLine && characterForLine.name.toLowerCase() !== 'narrator' && rawTextFromAI.trim() !== '') {
      const t = rawTextFromAI.trim();
      if (!((t.startsWith('“') && t.endsWith('”')) || (t.startsWith('"') && t.endsWith('"')))) {
         displayText = `“${rawTextFromAI}”`;
      } else {
         displayText = rawTextFromAI; // Already has quotes
      }
    }

    return {
      id: Date.now().toString() + "_line_ai_" + index + Math.random().toString(36).substr(2, 5),
      text: displayText,
      originalText: rawTextFromAI, // Store the raw AI output for dialogue content
      characterId: characterForLine?.id,
      isAiAudioLoading: false,
      isAiAudioSynced: false,
      isTextModifiedManual: false, // Initially false
    };
  });
  return { newScriptLines: updatedScriptLines };
};