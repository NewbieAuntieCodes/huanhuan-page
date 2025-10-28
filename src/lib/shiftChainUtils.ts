import { ScriptLine, Character } from '../types';

export type ShiftMode = 'cv' | 'character' | 'chapter';

/**
 * Calculates a "shift chain" of script lines that should be affected by an audio shift operation.
 * @param scriptLines The full list of script lines in the chapter.
 * @param startIndex The index from which to start calculating the chain.
 * @param shiftMode The mode determining which lines to include ('cv', 'character', 'chapter').
 * @param allCharacters The list of all characters in the project.
 * @param startCharacterId The character ID of the line initiating the shift.
 * @returns An array of objects, each containing the line and its original index.
 */
export const calculateShiftChain = (
    scriptLines: ScriptLine[],
    startIndex: number,
    shiftMode: ShiftMode,
    allCharacters: Character[],
    startCharacterId?: string,
): { line: ScriptLine, index: number }[] => {
    const chain: { line: ScriptLine, index: number }[] = [];
    if (startIndex < 0 || startIndex >= scriptLines.length) return chain;

    const startCharacter = allCharacters.find(c => c.id === startCharacterId);
    const silentCharId = allCharacters.find(c => c.name === '[静音]')?.id;

    for (let i = startIndex; i < scriptLines.length; i++) {
        const currentLine = scriptLines[i];
        if (currentLine.characterId === silentCharId) continue;

        let shouldInclude = false;
        if (shiftMode === 'chapter') {
            shouldInclude = true;
        } else if (shiftMode === 'character' && startCharacter) {
            if (currentLine.characterId === startCharacter.id) {
                shouldInclude = true;
            }
        } else if (shiftMode === 'cv' && startCharacter?.cvName) {
            const lineChar = allCharacters.find(c => c.id === currentLine.characterId);
            if (lineChar?.cvName === startCharacter.cvName) {
                shouldInclude = true;
            }
        }
        
        if (shouldInclude) {
            chain.push({ line: currentLine, index: i });
        }
    }
    return chain;
};
