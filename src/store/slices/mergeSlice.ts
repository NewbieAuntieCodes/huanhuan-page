
import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Character, Project, MergeHistoryEntry, ProjectLineReassignment } from '../../types';
import { db } from '../../db';

export interface MergeSlice {
  mergeHistory: MergeHistoryEntry[];
  mergeCharacters: (sourceCharacterIds: string[], targetCharacterId: string) => Promise<void>;
  undoLastMerge: () => Promise<void>;
}

export const createMergeSlice: StateCreator<AppState, [], [], MergeSlice> = (set, get, _api) => ({
  mergeHistory: [],
  mergeCharacters: async (sourceCharacterIds, targetCharacterId) => {
    const state = get();
    const sourceCharsData: Character[] = [];
    const updatedCharacters = state.characters.map(char => {
        if (sourceCharacterIds.includes(char.id)) {
            sourceCharsData.push({ ...char });
            return { ...char, status: 'merged' as 'merged', mergedIntoCharacterId: targetCharacterId };
        }
        return char;
    });

    const projectLineReassignments: Record<string, ProjectLineReassignment[]> = {};
    const projectsToUpdate: Project[] = [];

    const updatedProjects = state.projects.map(project => {
        let projectHadChanges = false;
        const assignmentsForThisProject: ProjectLineReassignment[] = [];

        const newChapters = project.chapters.map(chapter => {
            const newScriptLines = chapter.scriptLines.map(line => {
                if (line.characterId && sourceCharacterIds.includes(line.characterId)) {
                    assignmentsForThisProject.push({ lineId: line.id, originalCharacterId: line.characterId });
                    projectHadChanges = true;
                    return { ...line, characterId: targetCharacterId };
                }
                return line;
            });
            return { ...chapter, scriptLines: newScriptLines };
        });

        if (projectHadChanges) {
            projectLineReassignments[project.id] = assignmentsForThisProject;
            const updatedProject = { ...project, chapters: newChapters, lastModified: Date.now() };
            projectsToUpdate.push(updatedProject);
            return updatedProject;
        }
        return project;
    });

    const newMergeEntry: MergeHistoryEntry = {
        id: `merge_${Date.now()}`,
        mergedAt: Date.now(),
        sourceCharacters: sourceCharsData,
        targetCharacterId: targetCharacterId,
        projectLineReassignments: projectLineReassignments,
    };
    const updatedMergeHistory = [newMergeEntry, ...state.mergeHistory].slice(0, 10);

    await db.transaction('rw', db.characters, db.projects, db.misc, async () => {
        await db.characters.bulkPut(updatedCharacters);
        if (projectsToUpdate.length > 0) {
            await db.projects.bulkPut(projectsToUpdate);
        }
        await db.misc.put({ key: 'mergeHistory', value: updatedMergeHistory });
    });

    set({
        characters: updatedCharacters,
        projects: updatedProjects.sort((a,b) => b.lastModified - a.lastModified),
        mergeHistory: updatedMergeHistory,
    });
  },
  undoLastMerge: async () => {
    const state = get();
    if (state.mergeHistory.length === 0) return;

    const lastMerge = state.mergeHistory[0];
    const remainingMergeHistory = state.mergeHistory.slice(1);

    const charactersAfterUndo = state.characters.map(char => {
        const originalSourceData = lastMerge.sourceCharacters.find(sc => sc.id === char.id);
        if (originalSourceData) {
            return { ...originalSourceData, status: 'active' as const, mergedIntoCharacterId: undefined };
        }
        return char;
    });

    lastMerge.sourceCharacters.forEach(sourceChar => {
        if (!charactersAfterUndo.find(c => c.id === sourceChar.id)) {
            charactersAfterUndo.push({ ...sourceChar, status: 'active' as const, mergedIntoCharacterId: undefined });
        }
    });

    const projectsToUpdate: Project[] = [];
    const updatedProjects = state.projects.map(project => {
        const reassignmentsForThisProject = lastMerge.projectLineReassignments[project.id];
        if (!reassignmentsForThisProject || reassignmentsForThisProject.length === 0) return project;

        let projectHadReversions = false;
        const newChapters = project.chapters.map(chapter => {
            const newScriptLines = chapter.scriptLines.map(line => {
                const reassignmentInfo = reassignmentsForThisProject.find(r => r.lineId === line.id);
                if (reassignmentInfo && line.characterId === lastMerge.targetCharacterId) {
                    projectHadReversions = true;
                    return { ...line, characterId: reassignmentInfo.originalCharacterId };
                }
                return line;
            });
            return { ...chapter, scriptLines: newScriptLines };
        });

        if (projectHadReversions) {
            const updatedProject = { ...project, chapters: newChapters, lastModified: Date.now() };
            projectsToUpdate.push(updatedProject);
            return updatedProject;
        }
        return project;
    });

    await db.transaction('rw', db.characters, db.projects, db.misc, async () => {
        await db.characters.bulkPut(charactersAfterUndo);
        if (projectsToUpdate.length > 0) {
            await db.projects.bulkPut(projectsToUpdate);
        }
        await db.misc.put({ key: 'mergeHistory', value: remainingMergeHistory });
    });

    set({
        characters: charactersAfterUndo,
        projects: updatedProjects.sort((a,b) => b.lastModified - a.lastModified),
        mergeHistory: remainingMergeHistory,
    });
  },
});
