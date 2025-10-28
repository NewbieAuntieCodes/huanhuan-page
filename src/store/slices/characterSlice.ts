import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Character, Project } from '../../types';
import { db } from '../../db';

export interface CharacterSlice {
  characters: Character[];
  addCharacter: (characterToAdd: Pick<Character, 'name' | 'color' | 'textColor' | 'cvName' | 'description' | 'isStyleLockedToCv'>, projectId: string) => Character;
  editCharacter: (characterBeingEdited: Character, updatedCvName?: string, updatedCvBgColor?: string, updatedCvTextColor?: string) => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;
  deleteCharacters: (characterIds: string[]) => Promise<void>;
  toggleCharacterStyleLock: (characterId: string) => Promise<void>;
  bulkUpdateCharacterStylesForCV: (cvName: string, newBgColor: string, newTextColor: string) => Promise<void>;
}

export const createCharacterSlice: StateCreator<AppState, [], [], CharacterSlice> = (set, get, _api) => ({
  characters: [],
  addCharacter: (characterToAdd, projectId) => {
    const state = get();
    
    // Global characters (like Narrator) can exist. Project-specific characters are checked with projectId.
    const existingByName = state.characters.find(c => 
      c.name.toLowerCase() === characterToAdd.name.toLowerCase() && 
      c.projectId === projectId &&
      c.status !== 'merged'
    );
    if (existingByName) {
        return existingByName;
    }
    
    const finalCharacter: Character = {
        id: Date.now().toString() + "_char_" + Math.random().toString(36).substr(2, 9),
        name: characterToAdd.name,
        projectId: projectId, // Associate with the project
        color: characterToAdd.color,
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
    const { projects, characters } = get();
    const projectId = characterBeingEdited.projectId || get().selectedProjectId;
    if (!projectId) {
      console.error("Cannot edit character/CV: No project context.");
      alert("错误：无法在没有选定项目的情况下编辑角色。");
      return;
    }

    const projectToUpdate = projects.find(p => p.id === projectId);
    if (!projectToUpdate) {
      console.error(`Project with ID ${projectId} not found.`);
      return;
    }
    
    const trimmedCvName = (updatedCvNameFromModalProp || '').trim();

    // Update Project's CV Styles
    let newProjectCvStyles = { ...(projectToUpdate.cvStyles || {}) };
    if (trimmedCvName && updatedCvBgColorFromModalProp && updatedCvTextColorFromModalProp) {
        newProjectCvStyles[trimmedCvName] = { bgColor: updatedCvBgColorFromModalProp, textColor: updatedCvTextColorFromModalProp };
    }
    const updatedProject = { ...projectToUpdate, cvStyles: newProjectCvStyles };

    // Prepare the final character data to be saved
    const finalCharacterData = { ...characterBeingEdited, cvName: trimmedCvName };

    // If style is not locked, sync it with the CV style
    if (!finalCharacterData.isStyleLockedToCv && trimmedCvName && newProjectCvStyles[trimmedCvName]) {
        finalCharacterData.color = newProjectCvStyles[trimmedCvName].bgColor;
        finalCharacterData.textColor = newProjectCvStyles[trimmedCvName].textColor;
    }

    // Create the new characters array for state update
    const updatedCharacters = characters.map(c => c.id === finalCharacterData.id ? finalCharacterData : c);

    // Perform DB operations in a transaction
    await db.transaction('rw', db.projects, db.characters, async () => {
        await db.projects.put(updatedProject);
        await db.characters.put(finalCharacterData);
    });
    
    // Update state
    set({ 
        projects: projects.map(p => p.id === projectId ? updatedProject : p),
        characters: updatedCharacters 
    });
  },
  deleteCharacter: async (characterId) => {
    const state = get();
    const charToDelete = state.characters.find(c => c.id === characterId);
    let updatedCharacters = state.characters;
    let updatedProjects = state.projects;
    let needsProjectUpdate = false;

    // Do not allow deleting global default characters
    if (charToDelete && !charToDelete.projectId) {
      alert(`无法删除默认角色: ${charToDelete.name}`);
      return;
    }

    if (charToDelete && charToDelete.status === 'merged') {
        updatedCharacters = state.characters.filter(char => char.id !== characterId);
    } else {
        updatedCharacters = state.characters.filter(char => char.id !== characterId);
        updatedProjects = state.projects.map(proj => {
            // Only modify projects that this character belongs to
            if (charToDelete && proj.id === charToDelete.projectId) {
                needsProjectUpdate = true;
                return {
                    ...proj,
                    chapters: proj.chapters.map(ch => ({
                        ...ch,
                        scriptLines: ch.scriptLines.map(line =>
                            line.characterId === characterId ? { ...line, characterId: undefined } : line
                        )
                    }))
                };
            }
            return proj;
        });
    }

    await db.transaction('rw', db.characters, db.projects, async () => {
        await db.characters.delete(characterId);
        if (needsProjectUpdate) {
            await db.projects.bulkPut(updatedProjects.filter(p => {
                const charProject = charToDelete ? charToDelete.projectId : null;
                return p.id === charProject;
            }));
        }
    });

    set({ characters: updatedCharacters, projects: updatedProjects });
  },
  deleteCharacters: async (characterIds) => {
    const state = get();
    
    const charsToDelete = state.characters.filter(c => characterIds.includes(c.id));
    const globalCharsFound = charsToDelete.filter(c => !c.projectId);

    if (globalCharsFound.length > 0) {
        alert(`无法批量删除默认角色: ${globalCharsFound.map(c => c.name).join(', ')}`);
        return;
    }
    
    const updatedCharacters = state.characters.filter(char => !characterIds.includes(char.id));

    let projectsHadChanges = false;
    const projectIdsAffected = new Set(charsToDelete.map(c => c.projectId));

    const updatedProjects = state.projects.map(proj => {
        if (projectIdsAffected.has(proj.id)) {
            projectsHadChanges = true;
            return {
                ...proj,
                chapters: proj.chapters.map(ch => ({
                    ...ch,
                    scriptLines: ch.scriptLines.map(line => 
                        line.characterId && characterIds.includes(line.characterId) ? { ...line, characterId: undefined } : line
                    )
                })),
                lastModified: Date.now()
            };
        }
        return proj;
    });

    await db.transaction('rw', db.characters, db.projects, async () => {
        await db.characters.bulkDelete(characterIds);
        if (projectsHadChanges) {
            await db.projects.bulkPut(updatedProjects.filter(p => projectIdsAffected.has(p.id)));
        }
    });

    set({ characters: updatedCharacters, projects: updatedProjects });
  },
  toggleCharacterStyleLock: async (characterId) => {
    const { characters, projects } = get();
    const characterToUpdate = characters.find(c => c.id === characterId);
    if (!characterToUpdate) return;
    
    // Can't toggle lock for global characters
    if (!characterToUpdate.projectId) return;

    const project = projects.find(p => p.id === characterToUpdate.projectId);
    const projectCvStyles = project?.cvStyles || {};

    const newLockState = !characterToUpdate.isStyleLockedToCv;
    const updatedChar = { ...characterToUpdate, isStyleLockedToCv: newLockState };

    if (!newLockState && updatedChar.cvName && projectCvStyles[updatedChar.cvName]) {
        updatedChar.color = projectCvStyles[updatedChar.cvName].bgColor;
        updatedChar.textColor = projectCvStyles[updatedChar.cvName].textColor;
    }
    
    await db.characters.put(updatedChar);

    set({ characters: characters.map(c => c.id === characterId ? updatedChar : c) });
  },
  bulkUpdateCharacterStylesForCV: async (cvName, newBgColor, newTextColor) => {
    const { projects, characters, selectedProjectId } = get();
    if (!selectedProjectId) return;
    const projectToUpdate = projects.find(p => p.id === selectedProjectId);
    if (!projectToUpdate) return;

    const newProjectCvStyles = { ...(projectToUpdate.cvStyles || {}) };
    newProjectCvStyles[cvName] = { bgColor: newBgColor, textColor: newTextColor };
    const updatedProject = { ...projectToUpdate, cvStyles: newProjectCvStyles };

    const charactersToUpdateInDb: Character[] = [];
    const updatedCharacters = characters.map(char => {
        // Only update characters belonging to the current project
        if (char.projectId === selectedProjectId && char.cvName === cvName && !char.isStyleLockedToCv) {
            const updated = { ...char, color: newBgColor, textColor: newTextColor };
            charactersToUpdateInDb.push(updated);
            return updated;
        }
        return char;
    });

    await db.transaction('rw', db.projects, db.characters, async () => {
        await db.projects.put(updatedProject);
        if (charactersToUpdateInDb.length > 0) {
            await db.characters.bulkPut(charactersToUpdateInDb);
        }
    });

    set({
        projects: projects.map(p => p.id === selectedProjectId ? updatedProject : p),
        characters: updatedCharacters
    });
  },
});