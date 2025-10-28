import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Project, Collaborator, Chapter, AudioBlob, ScriptLine } from '../../types';
import { db } from '../../db';
import { splitAudio, mergeAudio } from '../../lib/audioProcessing';
import { calculateShiftChain, ShiftMode } from '../../lib/shiftChainUtils';


export interface ProjectSlice {
  projects: Project[];
  addProject: (newProject: Project) => Promise<void>;
  updateProject: (updatedProject: Project) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  addCollaboratorToProject: (projectId: string, username: string, role: 'reader' | 'editor') => Promise<void>;
  appendChaptersToProject: (projectId: string, newChapters: Chapter[]) => Promise<void>;
  updateLineAudio: (projectId: string, chapterId: string, lineId: string, audioBlobId: string | null) => Promise<void>;
  assignAudioToLine: (projectId: string, chapterId: string, lineId: string, audioBlob: Blob) => Promise<void>;
  clearAudioFromChapter: (projectId: string, chapterId: string) => Promise<void>;
  splitAndShiftAudio: (projectId: string, chapterId: string, lineId: string, splitTime: number, shiftMode: ShiftMode) => Promise<void>;
  shiftAudioDown: (projectId: string, chapterId: string, startLineId: string, shiftMode: ShiftMode) => Promise<void>;
  shiftAudioUp: (projectId: string, chapterId: string, startLineId: string, shiftMode: ShiftMode) => Promise<void>;
  mergeWithNextAndShift: (projectId: string, chapterId: string, currentLineId: string, shiftMode: ShiftMode) => Promise<void>;
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get, _api) => ({
  projects: [],
  addProject: async (newProject) => {
    const projectWithExtras = { ...newProject, cvStyles: {} };
    await db.projects.add(projectWithExtras);
    set(state => {
      const updatedProjects = [projectWithExtras, ...state.projects].sort((a,b) => b.lastModified - a.lastModified);
      return { projects: updatedProjects };
    });
  },
  updateProject: async (updatedProject) => {
    const projectWithTimestamp = { ...updatedProject, lastModified: Date.now() };
    await db.projects.put(projectWithTimestamp);
    set(state => {
      const updatedProjects = state.projects
        .map(p => p.id === updatedProject.id ? projectWithTimestamp : p)
        .sort((a,b) => b.lastModified - a.lastModified);
      return { projects: updatedProjects };
    });
  },
  deleteProject: async (projectId) => {
    const state = get();

    // Identify characters associated with the project being deleted
    const characterIdsToDelete = state.characters
      .filter(char => char.projectId === projectId)
      .map(char => char.id);
    
    // Identify all audio blobs associated with the project's script lines
    const projectToDelete = state.projects.find(p => p.id === projectId);
    const audioBlobIdsToDelete: string[] = [];
    if (projectToDelete) {
      projectToDelete.chapters.forEach(chapter => {
        chapter.scriptLines.forEach(line => {
          if (line.audioBlobId) {
            audioBlobIdsToDelete.push(line.audioBlobId);
          }
        });
      });
    }

    // Perform an atomic transaction to delete the project and all its associated data
    await db.transaction('rw', db.projects, db.characters, db.audioBlobs, async () => {
      await db.projects.delete(projectId);
      if (characterIdsToDelete.length > 0) {
        await db.characters.bulkDelete(characterIdsToDelete);
      }
      if (audioBlobIdsToDelete.length > 0) {
        await db.audioBlobs.bulkDelete(audioBlobIdsToDelete);
      }
    });

    // Update the Zustand state after the database operations are complete
    set(currentState => {
      const updatedProjects = currentState.projects.filter(p => p.id !== projectId);
      const updatedCharacters = currentState.characters.filter(char => !characterIdsToDelete.includes(char.id));
      
      let newSelectedProjectId = currentState.selectedProjectId;
      if (currentState.selectedProjectId === projectId) {
        newSelectedProjectId = null;
      }

      return { 
        projects: updatedProjects, 
        characters: updatedCharacters,
        selectedProjectId: newSelectedProjectId 
      };
    });
  },
  addCollaboratorToProject: async (projectId, username, role) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) {
        console.error(`Project with ID ${projectId} not found for adding collaborator.`);
        return;
    }

    const existingCollaborators = project.collaborators || [];
    if (existingCollaborators.some(c => c.username.toLowerCase() === username.toLowerCase())) {
        alert(`协作者 "${username}" 已存在于此项目中。`);
        return;
    }
    const newCollaborator: Collaborator = {
        id: Date.now().toString() + "_collab_" + Math.random(),
        username,
        role
    };
    const updatedCollaborators = [...existingCollaborators, newCollaborator];
    const lastModified = Date.now();

    await db.projects.update(projectId, { collaborators: updatedCollaborators, lastModified });
    set(state => ({
        projects: state.projects.map(p => p.id === projectId ? { ...p, collaborators: updatedCollaborators, lastModified } : p)
            .sort((a,b) => b.lastModified - a.lastModified)
    }));
  },
  appendChaptersToProject: async (projectId, newChapters) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;
    
    const updatedChapters = [...project.chapters, ...newChapters];
    const lastModified = Date.now();

    await db.projects.update(projectId, { chapters: updatedChapters, lastModified });
    set(state => ({
      projects: state.projects.map(p => {
        if (p.id === projectId) {
          return { ...p, chapters: updatedChapters, lastModified };
        }
        return p;
      }).sort((a, b) => b.lastModified - a.lastModified),
    }));
  },
  updateLineAudio: async (projectId, chapterId, lineId, audioBlobId) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;
    
    const updatedProject = {
      ...project,
      chapters: project.chapters.map(ch => {
        if (ch.id === chapterId) {
          return {
            ...ch,
            scriptLines: ch.scriptLines.map(line => {
              if (line.id === lineId) {
                // Set to undefined if null is passed, to avoid storing null in DB
                return { ...line, audioBlobId: audioBlobId || undefined };
              }
              return line;
            })
          };
        }
        return ch;
      }),
      lastModified: Date.now(),
    };
    
    await db.projects.put(updatedProject);
    set(state => ({
      projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        .sort((a,b) => b.lastModified - a.lastModified),
    }));
  },
  assignAudioToLine: async (projectId, chapterId, lineId, audioBlob) => {
    const newId = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const audioBlobEntry: AudioBlob = { id: newId, lineId, data: audioBlob };
    
    // First, save the blob to the database.
    await db.audioBlobs.put(audioBlobEntry);

    // Then, call the existing function to update the project state with the new ID.
    await get().updateLineAudio(projectId, chapterId, lineId, newId);
  },
  clearAudioFromChapter: async (projectId, chapterId) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const chapterToClear = project.chapters.find(ch => ch.id === chapterId);
    if (!chapterToClear) return;

    const blobIdsToDelete = chapterToClear.scriptLines
        .map(line => line.audioBlobId)
        .filter((id): id is string => !!id);

    if (blobIdsToDelete.length === 0) {
        return;
    }
    
    const updatedProject = {
      ...project,
      chapters: project.chapters.map(ch => {
        if (ch.id === chapterId) {
          return {
            ...ch,
            scriptLines: ch.scriptLines.map(line => ({ ...line, audioBlobId: undefined }))
          };
        }
        return ch;
      }),
      lastModified: Date.now(),
    };
    
    await db.transaction('rw', db.projects, db.audioBlobs, async () => {
        await db.projects.put(updatedProject);
        if (blobIdsToDelete.length > 0) {
            await db.audioBlobs.bulkDelete(blobIdsToDelete);
        }
    });
    
    set(state => ({
      projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        .sort((a,b) => b.lastModified - a.lastModified),
    }));
  },
  splitAndShiftAudio: async (projectId, chapterId, lineId, splitTime, shiftMode) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    const chapter = project?.chapters.find(c => c.id === chapterId);
    const line = chapter?.scriptLines.find(l => l.id === lineId);

    if (!project || !chapter || !line || !line.audioBlobId) {
        console.error("Split precondition not met.");
        return;
    }

    get().clearPlayingLine(); 

    try {
        const audioBlob = await db.audioBlobs.get(line.audioBlobId);
        if (!audioBlob) throw new Error("Audio blob not found in DB.");

        const { part1Blob, part2Blob } = await splitAudio(audioBlob.data, splitTime);
        
        const part1BlobId = `audio_split_${Date.now()}_1`;
        const part2BlobId = `audio_split_${Date.now()}_2`;
        
        const newBlobs: AudioBlob[] = [{ id: part1BlobId, lineId: line.id, data: part1Blob }];
        const blobsToDelete: string[] = [line.audioBlobId];

        const lineIndex = chapter.scriptLines.findIndex(l => l.id === lineId);
        const shiftChain = calculateShiftChain(chapter.scriptLines, lineIndex + 1, shiftMode, get().characters, line.characterId);
        
        const newScriptLines = [...chapter.scriptLines];
        newScriptLines[lineIndex] = { ...newScriptLines[lineIndex], audioBlobId: part1BlobId };

        if (shiftChain.length > 0) {
            const firstInChain = shiftChain[0];
            const audioIdFromFirstInChain = firstInChain.line.audioBlobId;

            newScriptLines[firstInChain.index] = { ...firstInChain.line, audioBlobId: part2BlobId };
            newBlobs.push({ id: part2BlobId, lineId: firstInChain.line.id, data: part2Blob });

            let previousAudioId = audioIdFromFirstInChain;
            for (let i = 1; i < shiftChain.length; i++) {
                const currentInChain = shiftChain[i];
                const audioIdFromCurrent = currentInChain.line.audioBlobId;
                newScriptLines[currentInChain.index] = { ...currentInChain.line, audioBlobId: previousAudioId };
                previousAudioId = audioIdFromCurrent;
            }
            
            if (previousAudioId) blobsToDelete.push(previousAudioId);
        }

        const updatedChapter = { ...chapter, scriptLines: newScriptLines };
        const updatedProject = { ...project, chapters: project.chapters.map(c => c.id === chapterId ? updatedChapter : c), lastModified: Date.now() };

        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            await db.audioBlobs.bulkDelete(blobsToDelete);
            await db.audioBlobs.bulkPut(newBlobs);
            await db.projects.put(updatedProject);
        });

        set({ projects: state.projects.map(p => p.id === projectId ? updatedProject : p) });

    } catch (e) {
        console.error("Failed to split and shift audio:", e);
        alert(`分割音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
  shiftAudioDown: async (projectId, chapterId, startLineId, shiftMode) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    const chapter = project?.chapters.find(c => c.id === chapterId);
    const startLineIndex = chapter?.scriptLines.findIndex(l => l.id === startLineId);

    if (!project || !chapter || startLineIndex === undefined || startLineIndex === -1) return;
    
    get().clearPlayingLine();

    try {
        const startLine = chapter.scriptLines[startLineIndex];
        const shiftChain = calculateShiftChain(chapter.scriptLines, startLineIndex, shiftMode, get().characters, startLine.characterId);

        if (shiftChain.length === 0) return;

        const newScriptLines = [...chapter.scriptLines];
        const blobsToDelete: string[] = [];
        
        const lastLineInChain = shiftChain[shiftChain.length - 1];
        if (lastLineInChain.line.audioBlobId) {
            blobsToDelete.push(lastLineInChain.line.audioBlobId);
        }

        for (let i = shiftChain.length - 1; i > 0; i--) {
            const currentLineInfo = shiftChain[i];
            const prevLineInfo = shiftChain[i - 1];
            newScriptLines[currentLineInfo.index] = { ...currentLineInfo.line, audioBlobId: prevLineInfo.line.audioBlobId };
        }

        const firstLineInfo = shiftChain[0];
        newScriptLines[firstLineInfo.index] = { ...firstLineInfo.line, audioBlobId: undefined };

        const updatedChapter = { ...chapter, scriptLines: newScriptLines };
        const updatedProject = { ...project, chapters: project.chapters.map(c => c.id === chapterId ? updatedChapter : c), lastModified: Date.now() };

        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            if (blobsToDelete.length > 0) await db.audioBlobs.bulkDelete(blobsToDelete);
            await db.projects.put(updatedProject);
        });

        set({ projects: state.projects.map(p => p.id === projectId ? updatedProject : p) });

    } catch (e) {
        console.error("Failed to shift audio down:", e);
        alert(`顺移音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
  shiftAudioUp: async (projectId, chapterId, startLineId, shiftMode) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    const chapter = project?.chapters.find(c => c.id === chapterId);
    const startLineIndex = chapter?.scriptLines.findIndex(l => l.id === startLineId);

    if (!project || !chapter || startLineIndex === undefined || startLineIndex === -1) return;

    get().clearPlayingLine();

    try {
        const startLine = chapter.scriptLines[startLineIndex];
        const shiftChain = calculateShiftChain(chapter.scriptLines, startLineIndex, shiftMode, get().characters, startLine.characterId);
        
        if (shiftChain.length < 2) {
             alert('无法向上顺移：这是此筛选条件下的最后一句台词。');
             return;
        }

        const newScriptLines = [...chapter.scriptLines];
        const blobsToDelete: string[] = [];

        if (shiftChain[0].line.audioBlobId) {
            blobsToDelete.push(shiftChain[0].line.audioBlobId);
        }

        for (let i = 0; i < shiftChain.length - 1; i++) {
            const currentLineInfo = shiftChain[i];
            const nextLineInfo = shiftChain[i + 1];
            newScriptLines[currentLineInfo.index] = { ...currentLineInfo.line, audioBlobId: nextLineInfo.line.audioBlobId };
        }

        const lastLineInfo = shiftChain[shiftChain.length - 1];
        newScriptLines[lastLineInfo.index] = { ...lastLineInfo.line, audioBlobId: undefined };

        const updatedChapter = { ...chapter, scriptLines: newScriptLines };
        const updatedProject = { ...project, chapters: project.chapters.map(c => c.id === chapterId ? updatedChapter : c), lastModified: Date.now() };
        
        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            if (blobsToDelete.length > 0) await db.audioBlobs.bulkDelete(blobsToDelete);
            await db.projects.put(updatedProject);
        });

        set({ projects: state.projects.map(p => p.id === projectId ? updatedProject : p) });

    } catch (e) {
        console.error("Failed to shift audio up:", e);
        alert(`向上顺移音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
  mergeWithNextAndShift: async (projectId, chapterId, currentLineId, shiftMode) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    const chapter = project?.chapters.find(c => c.id === chapterId);
    if (!project || !chapter) return;

    const currentLineIndex = chapter.scriptLines.findIndex(l => l.id === currentLineId);
    if (currentLineIndex < 0) return;
    const currentLine = chapter.scriptLines[currentLineIndex];

    // Find the next line with the same character ID
    let nextLine: ScriptLine | null = null;
    let nextLineIndex: number = -1;
    for (let i = currentLineIndex + 1; i < chapter.scriptLines.length; i++) {
        const potentialNextLine = chapter.scriptLines[i];
        if (potentialNextLine.characterId === currentLine.characterId) {
            nextLine = potentialNextLine;
            nextLineIndex = i;
            break;
        }
    }

    if (!nextLine || nextLineIndex === -1) {
        alert("无法合并：找不到下一个属于该角色的台词行。");
        return;
    }
    if (!currentLine.audioBlobId || !nextLine.audioBlobId) {
        alert("无法合并：其中一句台词没有音频。");
        return;
    }

    get().clearPlayingLine();

    try {
        const [blob1, blob2] = await Promise.all([
            db.audioBlobs.get(currentLine.audioBlobId),
            db.audioBlobs.get(nextLine.audioBlobId),
        ]);

        if (!blob1 || !blob2) throw new Error("Audio blob not found in DB.");

        const mergedBlob = await mergeAudio([blob1.data, blob2.data]);
        const mergedBlobId = `audio_merged_${Date.now()}`;
        
        const newBlobEntry: AudioBlob = { id: mergedBlobId, lineId: currentLine.id, data: mergedBlob };
        const blobsToDelete = [currentLine.audioBlobId, nextLine.audioBlobId];

        const newScriptLines = [...chapter.scriptLines];
        
        // Update the current line with merged text and audio
        newScriptLines[currentLineIndex] = {
            ...currentLine,
            text: `${currentLine.text}\n${nextLine.text}`,
            audioBlobId: mergedBlobId,
        };
        
        // The line that was merged FROM is now the starting point for the shift-up operation
        const lineToStartShiftFrom = newScriptLines[nextLineIndex];
        
        // Calculate the chain starting from the line *after* the one we're taking audio from
        const shiftChain = calculateShiftChain(chapter.scriptLines, nextLineIndex + 1, shiftMode, get().characters, currentLine.characterId);

        // Perform the shift up, starting at the now-vacated nextLine's position
        let previousAudioId = lineToStartShiftFrom.audioBlobId; // This is the audio ID of the line we are removing
        
        newScriptLines[nextLineIndex] = { ...lineToStartShiftFrom, audioBlobId: shiftChain.length > 0 ? shiftChain[0].line.audioBlobId : undefined };

        for(let i=0; i < shiftChain.length -1; i++){
            const currentInChain = shiftChain[i];
            const nextInChain = shiftChain[i+1];
            newScriptLines[currentInChain.index] = { ...currentInChain.line, audioBlobId: nextInChain.line.audioBlobId };
        }

        if(shiftChain.length > 0){
            const lastInChain = shiftChain[shiftChain.length - 1];
            newScriptLines[lastInChain.index] = { ...lastInChain.line, audioBlobId: undefined };
            if (lastInChain.line.audioBlobId) {
                blobsToDelete.push(lastInChain.line.audioBlobId);
            }
        }
        
        // Remove the line that was merged from the script
        const finalScriptLines = newScriptLines.filter(line => line.id !== nextLine!.id);

        const updatedChapter = { ...chapter, scriptLines: finalScriptLines };
        const updatedProject = { ...project, chapters: project.chapters.map(c => c.id === chapterId ? updatedChapter : c), lastModified: Date.now() };

        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            await db.audioBlobs.bulkDelete([...new Set(blobsToDelete)]);
            await db.audioBlobs.put(newBlobEntry);
            await db.projects.put(updatedProject);
        });

        set({ projects: state.projects.map(p => p.id === projectId ? updatedProject : p) });

    } catch (e) {
        console.error("Failed to merge audio:", e);
        alert(`合并音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
});