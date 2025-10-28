import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Character } from '../../types';
// Fix: Import from types.ts to break circular dependency
import { CVStylesMap } from '../../types';
import { db } from '../../db';

export interface CharacterSlice {
  characters: Character[];
  allCvNames: string[];
  cvStyles: CVStylesMap;
  addCharacter: (characterToAdd: Character) => Character; // Signature remains sync for utility functions
  editCharacter: (characterBeingEdited: Character, updatedCvName?: string, updatedCvBgColor?: string, updatedCvTextColor?: string) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;
  updateCharacterCV: (characterId: string, cvName: string, cvBgColor: string, cvTextColor: string) => Promise<void>;
  toggleCharacterStyleLock: (characterId: string) => Promise<void>;
  bulkUpdateCharacterStylesForCV: (cvName: string, newBgColor: string, newTextColor: string) => Promise<void>;
}

export const createCharacterSlice: StateCreator<AppState, [], [], CharacterSlice> = (set, get, _api) => ({
  characters: [],
  allCvNames: [],
  cvStyles: {},
  // This action's signature remains synchronous to avoid major refactoring of parsing utilities.
  // The DB write is a "fire-and-forget" operation.
  addCharacter: (characterToAdd) => {
    const state = get();
    
    // Check for existing character by name (case-insensitive, active status)
    const existingByName = state.characters.find(c => c.name.toLowerCase() === characterToAdd.name.toLowerCase() && c.status !== 'merged');
    if (existingByName) {
        return existingByName;
    }

    // Check by ID if an ID was provided
    if (characterToAdd.id) {
        const existingById = state.characters.find(c => c.id === characterToAdd.id && c.status !== 'merged');
        if (existingById) {
            return existingById;
        }
    }
    
    // No character found, create a new one.
    const finalCharacter: Character = {
        ...characterToAdd,
        id: characterToAdd.id || Date.now().toString() + "_char_" + Math.random().toString(36).substr(2, 9),
        textColor: characterToAdd.textColor || '',
        cvName: characterToAdd.cvName || '',
        description: characterToAdd.description || '',
        isStyleLockedToCv: characterToAdd.isStyleLockedToCv === undefined ? false : characterToAdd.isStyleLockedToCv,
        status: 'active' as const,
    };
    db.characters.add(finalCharacter).catch(err => console.error("DB: Failed to add character", err));
    set(s => ({ characters: [...s.characters, finalCharacter] }));
    
    return finalCharacter;
  },
  editCharacter: async (characterBeingEdited, updatedCvNameFromModalProp, updatedCvBgColorFromModalProp, updatedCvTextColorFromModalProp) => {
    const state = get();
    const trimmedCvNameFromModal = updatedCvNameFromModalProp?.trim();
    let newCvStyles = { ...state.cvStyles };
    let newAllCvNames = [...state.allCvNames];

    if (trimmedCvNameFromModal && updatedCvBgColorFromModalProp && updatedCvTextColorFromModalProp) {
        newCvStyles[trimmedCvNameFromModal] = { bgColor: updatedCvBgColorFromModalProp, textColor: updatedCvTextColorFromModalProp };
        if (!newAllCvNames.some(name => name.toLowerCase() === trimmedCvNameFromModal.toLowerCase())) {
            newAllCvNames = [...newAllCvNames, trimmedCvNameFromModal].sort();
        }
    }

    const updatedCharacters = state.characters.map(char => {
        if (char.id === characterBeingEdited.id) {
            return {
                ...char,
                name: characterBeingEdited.name.trim(),
                description: characterBeingEdited.description?.trim() || '',
                cvName: trimmedCvNameFromModal,
                isStyleLockedToCv: characterBeingEdited.isStyleLockedToCv,
                color: characterBeingEdited.color,
                textColor: characterBeingEdited.textColor,
                status: characterBeingEdited.status || char.status || 'active',
            };
        } else {
            let otherChar = { ...char };
            if (otherChar.cvName && newCvStyles[otherChar.cvName] && !otherChar.isStyleLockedToCv) {
                otherChar.color = newCvStyles[otherChar.cvName].bgColor;
                otherChar.textColor = newCvStyles[otherChar.cvName].textColor;
            }
            return otherChar;
        }
    });

    await db.transaction('rw', db.characters, db.misc, async () => {
        await db.characters.bulkPut(updatedCharacters);
        if (trimmedCvNameFromModal) {
            await db.misc.put({ key: 'cvStyles', value: newCvStyles });
            await db.misc.put({ key: 'allCvNames', value: newAllCvNames });
        }
    });

    set({ characters: updatedCharacters, allCvNames: newAllCvNames, cvStyles: newCvStyles });
  },
  deleteCharacter: async (characterId) => {
    const state = get();
    const charToDelete = state.characters.find(c => c.id === characterId);
    let updatedCharacters = state.characters;
    let updatedProjects = state.projects;
    let needsProjectUpdate = false;

    if (charToDelete && charToDelete.status === 'merged') {
        updatedCharacters = state.characters.filter(char => char.id !== characterId);
    } else {
        updatedCharacters = state.characters.filter(char => char.id !== characterId);
        updatedProjects = state.projects.map(proj => ({
            ...proj,
            chapters: proj.chapters.map(ch => ({
                ...ch,
                scriptLines: ch.scriptLines.map(line =>
                    line.characterId === characterId ? { ...line, characterId: undefined } : line
                )
            }))
        }));
        needsProjectUpdate = true;
    }

    await db.transaction('rw', db.characters, db.projects, async () => {
        await db.characters.delete(characterId);
        if (needsProjectUpdate) {
            await db.projects.bulkPut(updatedProjects);
        }
    });

    set({ characters: updatedCharacters, projects: updatedProjects });
  },
  updateCharacterCV: async (characterId, cvName, cvBgColor, cvTextColor) => {
    const state = get();
    const trimmedCvName = cvName.trim();
    let newCvStyles = { ...state.cvStyles };
    let newAllCvNames = [...state.allCvNames];

    if (trimmedCvName) {
        newCvStyles[trimmedCvName] = { bgColor: cvBgColor, textColor: cvTextColor };
        if (!state.allCvNames.some(name => name.toLowerCase() === trimmedCvName.toLowerCase())) {
            newAllCvNames = [...state.allCvNames, trimmedCvName].sort();
        }
    }

    const updatedCharacters = state.characters.map(char => {
        if (char.id === characterId) {
            const updatedChar: Character = { ...char, cvName: trimmedCvName };
            if (!char.isStyleLockedToCv && trimmedCvName && newCvStyles[trimmedCvName]) {
                updatedChar.color = newCvStyles[trimmedCvName].bgColor;
                updatedChar.textColor = newCvStyles[trimmedCvName].textColor;
            }
            return updatedChar;
        } else if (char.cvName === trimmedCvName && !char.isStyleLockedToCv && trimmedCvName && newCvStyles[trimmedCvName]) {
            return { ...char, color: newCvStyles[trimmedCvName].bgColor, textColor: newCvStyles[trimmedCvName].textColor };
        }
        return char;
    });

    await db.transaction('rw', db.characters, db.misc, async () => {
        await db.characters.bulkPut(updatedCharacters);
        if (trimmedCvName) {
            await db.misc.put({ key: 'cvStyles', value: newCvStyles });
            await db.misc.put({ key: 'allCvNames', value: newAllCvNames });
        }
    });

    set({ characters: updatedCharacters, cvStyles: newCvStyles, allCvNames: newAllCvNames });
  },
  toggleCharacterStyleLock: async (characterId) => {
    const state = get();
    let characterToUpdate: Character | undefined;
    const updatedCharacters = state.characters.map(char => {
        if (char.id === characterId) {
            const newLockState = !(char.isStyleLockedToCv || false);
            const updatedChar = { ...char, isStyleLockedToCv: newLockState };
            if (!newLockState && char.cvName && state.cvStyles[char.cvName]) {
                updatedChar.color = state.cvStyles[char.cvName].bgColor;
                updatedChar.textColor = state.cvStyles[char.cvName].textColor;
            }
            characterToUpdate = updatedChar;
            return updatedChar;
        }
        return char;
    });

    if (characterToUpdate) {
        await db.characters.put(characterToUpdate);
    }

    set({ characters: updatedCharacters });
  },
  bulkUpdateCharacterStylesForCV: async (cvName, newBgColor, newTextColor) => {
    const state = get();
    let updatedCvStyles = { ...state.cvStyles };
    if (cvName) {
        updatedCvStyles[cvName] = { bgColor: newBgColor, textColor: newTextColor };
    }
    
    const charactersToUpdate: Character[] = [];
    const updatedCharacters = state.characters.map(char => {
        if (char.cvName === cvName && !(char.isStyleLockedToCv || false)) {
            const updated = { ...char, color: newBgColor, textColor: newTextColor };
            charactersToUpdate.push(updated);
            return updated;
        }
        return char;
    });

    await db.transaction('rw', db.characters, db.misc, async () => {
        if (charactersToUpdate.length > 0) {
            await db.characters.bulkPut(charactersToUpdate);
        }
        if (cvName) {
            await db.misc.put({ key: 'cvStyles', value: updatedCvStyles });
        }
    });

    set({ characters: updatedCharacters, cvStyles: updatedCvStyles });
  },
});