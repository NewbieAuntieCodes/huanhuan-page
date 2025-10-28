import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Project, Collaborator, Chapter, AudioBlob, ScriptLine } from '../../types';
import { db } from '../../db';
import { bufferToWav } from '../../lib/audioUtils';


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
  splitAndShiftAudio: (projectId: string, chapterId: string, lineId: string, splitTime: number, shiftMode: 'cv' | 'character' | 'chapter') => Promise<void>;
  shiftAudioDown: (projectId: string, chapterId: string, startLineId: string, shiftMode: 'cv' | 'character' | 'chapter') => Promise<void>;
  shiftAudioUp: (projectId: string, chapterId: string, startLineId: string, shiftMode: 'cv' | 'character' | 'chapter') => Promise<void>;
  mergeAudioUp: (projectId: string, chapterId: string, currentLineId: string, shiftMode: 'cv' | 'character' | 'chapter') => Promise<void>;
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get, _api) => ({
  projects: [],
  addProject: async (newProject) => {
    await db.projects.add(newProject);
    set(state => {
      const updatedProjects = [newProject, ...state.projects].sort((a,b) => b.lastModified - a.lastModified);
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
    await db.projects.delete(projectId);
    set(state => {
      const updatedProjects = state.projects.filter(p => p.id !== projectId);
      let newSelectedProjectId = state.selectedProjectId;
      if (state.selectedProjectId === projectId) {
        newSelectedProjectId = null;
      }
      return { projects: updatedProjects, selectedProjectId: newSelectedProjectId };
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

    if (!project || !chapter || !line || !line.audioBlobId || splitTime <= 0) {
        console.error("Split precondition not met.");
        return;
    }

    get().clearPlayingLine(); 

    try {
        const audioBlob = await db.audioBlobs.get(line.audioBlobId);
        if (!audioBlob) throw new Error("Audio blob not found in DB.");

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const originalBuffer = await audioContext.decodeAudioData(await audioBlob.data.arrayBuffer());
        
        if (splitTime >= originalBuffer.duration - 0.01) {
            console.warn("Split time is at or after audio duration. No split performed.");
            return;
        }

        const splitSample = Math.floor(splitTime * originalBuffer.sampleRate);
        const numChannels = originalBuffer.numberOfChannels;

        const part1Buffer = audioContext.createBuffer(numChannels, splitSample, originalBuffer.sampleRate);
        const part2Length = originalBuffer.length - splitSample;
        const part2Buffer = audioContext.createBuffer(numChannels, part2Length, originalBuffer.sampleRate);

        for (let i = 0; i < numChannels; i++) {
            const channelData = originalBuffer.getChannelData(i);
            part1Buffer.copyToChannel(channelData.subarray(0, splitSample), i);
            part2Buffer.copyToChannel(channelData.subarray(splitSample), i);
        }

        const part1Blob = bufferToWav(part1Buffer);
        const part2Blob = bufferToWav(part2Buffer);
        
        const part1BlobId = `audio_split_${Date.now()}_1`;
        const part2BlobId = `audio_split_${Date.now()}_2`;
        const originalBlobId = line.audioBlobId;
        
        const newBlobs: AudioBlob[] = [{ id: part1BlobId, lineId: line.id, data: part1Blob }];
        const blobsToDelete: string[] = [originalBlobId];

        const updatedProject = { ...project };
        const chapterIndex = updatedProject.chapters.findIndex(c => c.id === chapterId);
        const targetChapter = { ...updatedProject.chapters[chapterIndex] };
        
        const lineIndex = targetChapter.scriptLines.findIndex(l => l.id === lineId);
        if (lineIndex === -1) throw new Error("Could not find line index for splitting.");

        const shiftChain: { line: ScriptLine, index: number }[] = [];
        const originalCharacter = get().characters.find(c => c.id === line.characterId);

        for (let i = lineIndex + 1; i < targetChapter.scriptLines.length; i++) {
            const currentLine = targetChapter.scriptLines[i];
            const silentChar = get().characters.find(c => c.name === '[静音]');
            if (currentLine.characterId === silentChar?.id) continue;

            if (shiftMode === 'chapter') {
                shiftChain.push({ line: currentLine, index: i });
            } else if (shiftMode === 'character' && originalCharacter) {
                if (currentLine.characterId === originalCharacter.id) {
                    shiftChain.push({ line: currentLine, index: i });
                }
            } else if (shiftMode === 'cv' && originalCharacter?.cvName) {
                const lineChar = get().characters.find(c => c.id === currentLine.characterId);
                if (lineChar?.cvName === originalCharacter.cvName) {
                    shiftChain.push({ line: currentLine, index: i });
                }
            }
        }
        
        const newScriptLines = [...targetChapter.scriptLines];
        newScriptLines[lineIndex] = { ...newScriptLines[lineIndex], audioBlobId: part1BlobId };

        if (shiftChain.length > 0) {
            const firstInChain = shiftChain[0];
            const oldAudioIdOfFirstInChain = firstInChain.line.audioBlobId;

            newScriptLines[firstInChain.index] = { ...firstInChain.line, audioBlobId: part2BlobId };
            newBlobs.push({ id: part2BlobId, lineId: firstInChain.line.id, data: part2Blob });

            let prevAudioId = oldAudioIdOfFirstInChain;
            for (let i = 1; i < shiftChain.length; i++) {
                const currentInChain = shiftChain[i];
                const oldAudioIdOfCurrent = currentInChain.line.audioBlobId;
                newScriptLines[currentInChain.index] = { ...currentInChain.line, audioBlobId: prevAudioId };
                prevAudioId = oldAudioIdOfCurrent;
            }
            
            const lastInChain = shiftChain[shiftChain.length - 1];
            const audioIdToDrop = lastInChain.line.audioBlobId === prevAudioId ? prevAudioId : lastInChain.line.audioBlobId;
            if (audioIdToDrop) blobsToDelete.push(audioIdToDrop);

        }

        targetChapter.scriptLines = newScriptLines;
        updatedProject.chapters[chapterIndex] = targetChapter;
        updatedProject.lastModified = Date.now();

        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            await db.audioBlobs.bulkDelete(blobsToDelete);
            await db.audioBlobs.bulkPut(newBlobs);
            await db.projects.put(updatedProject);
        });

        set({
            projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        });

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

    if (!project || !chapter || startLineIndex === undefined || startLineIndex === -1) {
        console.error("Shift down precondition not met.");
        return;
    }
    
    get().clearPlayingLine();

    try {
        const updatedProject = { ...project };
        const chapterIndex = updatedProject.chapters.findIndex(c => c.id === chapterId);
        const targetChapter = { ...updatedProject.chapters[chapterIndex] };
        
        const shiftChainIndices: number[] = [];
        const startLine = targetChapter.scriptLines[startLineIndex];
        const startCharacter = get().characters.find(c => c.id === startLine.characterId);
        
        for (let i = startLineIndex; i < targetChapter.scriptLines.length; i++) {
            const currentLine = targetChapter.scriptLines[i];
            const silentChar = get().characters.find(c => c.name === '[静音]');
            if (currentLine.characterId === silentChar?.id) continue;

            if (shiftMode === 'chapter') {
                shiftChainIndices.push(i);
            } else if (shiftMode === 'character' && startCharacter) {
                if (currentLine.characterId === startCharacter.id) {
                    shiftChainIndices.push(i);
                }
            } else if (shiftMode === 'cv' && startCharacter?.cvName) {
                const lineChar = get().characters.find(c => c.id === currentLine.characterId);
                if (lineChar?.cvName === startCharacter.cvName) {
                    shiftChainIndices.push(i);
                }
            }
        }

        if (shiftChainIndices.length <= 1) {
            // Nothing to shift besides the start line itself. Just clear it.
            const audioIdToDelete = targetChapter.scriptLines[startLineIndex].audioBlobId;
            if (audioIdToDelete) {
                await db.audioBlobs.delete(audioIdToDelete);
            }
            targetChapter.scriptLines[startLineIndex] = { ...targetChapter.scriptLines[startLineIndex], audioBlobId: undefined };
        } else {
            let audioToShiftDown: string | undefined | null = null;
            let blobsToDelete: string[] = [];

            // This processes the shift chain in place.
            shiftChainIndices.forEach(lineIndex => {
                const line = targetChapter.scriptLines[lineIndex];
                const tempAudioId = line.audioBlobId;
                targetChapter.scriptLines[lineIndex] = { ...line, audioBlobId: audioToShiftDown || undefined };
                audioToShiftDown = tempAudioId;
            });

            if (audioToShiftDown) {
                blobsToDelete.push(audioToShiftDown);
            }

            if (blobsToDelete.length > 0) {
                 await db.audioBlobs.bulkDelete(blobsToDelete);
            }
        }

        updatedProject.chapters[chapterIndex] = targetChapter;
        updatedProject.lastModified = Date.now();

        await db.projects.put(updatedProject);

        set({
            projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        });

    } catch (e) {
        console.error("Failed to shift audio down:", e);
        alert(`顺移音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
  shiftAudioUp: async (projectId, chapterId, startLineId, shiftMode) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    const chapter = project?.chapters.find(c => c.id === chapterId);
    if (!project || !chapter) return;

    get().clearPlayingLine();

    try {
        const scriptLines = chapter.scriptLines;
        const startLine = scriptLines.find(l => l.id === startLineId);
        if (!startLine) return;

        const startCharacter = state.characters.find(c => c.id === startLine.characterId);
        const silentCharId = state.characters.find(c => c.name === '[静音]')?.id;

        const eligibleLines = scriptLines.filter(line => {
            if (line.characterId === silentCharId) return false;
            if (shiftMode === 'chapter') return true;
            if (shiftMode === 'character' && startCharacter) return line.characterId === startCharacter.id;
            if (shiftMode === 'cv' && startCharacter?.cvName) {
                const lineChar = state.characters.find(c => c.id === line.characterId);
                return lineChar?.cvName === startCharacter.cvName;
            }
            return false;
        });

        const startIndexInChain = eligibleLines.findIndex(l => l.id === startLineId);
        if (startIndexInChain === -1 || startIndexInChain === eligibleLines.length - 1) {
            alert('无法向上顺移：这是此筛选条件下的最后一句台词。');
            return;
        }

        const blobsToDelete: string[] = [];
        const updates = new Map<string, string | undefined>();
        
        // The audio on the start line will be discarded.
        const discardedAudioId = eligibleLines[startIndexInChain].audioBlobId;
        if (discardedAudioId) {
            blobsToDelete.push(discardedAudioId);
        }

        // Create a chain of updates: line `i` gets audio from line `i+1`
        for (let i = startIndexInChain; i < eligibleLines.length - 1; i++) {
            const lineToUpdate = eligibleLines[i];
            const lineToTakeAudioFrom = eligibleLines[i + 1];
            updates.set(lineToUpdate.id, lineToTakeAudioFrom.audioBlobId);
        }
        
        // The last eligible line in the chain becomes empty
        const lastEligibleLine = eligibleLines[eligibleLines.length - 1];
        updates.set(lastEligibleLine.id, undefined);

        // Apply all updates to a copy of the script lines
        const finalScriptLines = scriptLines.map(line => {
            if (updates.has(line.id)) {
                return { ...line, audioBlobId: updates.get(line.id) };
            }
            return line;
        });

        const updatedProject = { ...project };
        const chapterIndex = updatedProject.chapters.findIndex(c => c.id === chapterId);
        updatedProject.chapters[chapterIndex] = { ...chapter, scriptLines: finalScriptLines };
        updatedProject.lastModified = Date.now();
        
        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            if(blobsToDelete.length > 0) {
                await db.audioBlobs.bulkDelete(blobsToDelete);
            }
            await db.projects.put(updatedProject);
        });

        set({
            projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        });

    } catch (e) {
        console.error("Failed to shift audio up:", e);
        alert(`向上顺移音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
  mergeAudioUp: async (projectId, chapterId, currentLineId, shiftMode) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    const chapter = project?.chapters.find(c => c.id === chapterId);
    if (!project || !chapter) return;

    const currentLineIndex = chapter.scriptLines.findIndex(l => l.id === currentLineId);
    if (currentLineIndex <= 0) {
        alert("无法合并：这是第一句台词。");
        return;
    }
    const previousLineIndex = currentLineIndex - 1;
    const currentLine = chapter.scriptLines[currentLineIndex];
    const previousLine = chapter.scriptLines[previousLineIndex];

    if (!currentLine.audioBlobId || !previousLine.audioBlobId) {
        alert("无法合并：其中一句台词没有音频。");
        return;
    }
    if (currentLine.characterId !== previousLine.characterId) {
        alert("无法合并：两句台词不属于同一个角色。");
        return;
    }

    get().clearPlayingLine();

    try {
        const [blob1, blob2] = await Promise.all([
            db.audioBlobs.get(previousLine.audioBlobId),
            db.audioBlobs.get(currentLine.audioBlobId),
        ]);

        if (!blob1 || !blob2) throw new Error("Audio blob not found in DB.");

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const [buffer1, buffer2] = await Promise.all([
            audioContext.decodeAudioData(await blob1.data.arrayBuffer()),
            audioContext.decodeAudioData(await blob2.data.arrayBuffer()),
        ]);

        const sampleRate = buffer1.sampleRate;
        if(buffer1.sampleRate !== buffer2.sampleRate || buffer1.numberOfChannels !== buffer2.numberOfChannels) {
            audioContext.close();
            throw new Error("音频格式(采样率或声道)不匹配，无法合并。");
        }
        
        const mergedBuffer = audioContext.createBuffer(buffer1.numberOfChannels, buffer1.length + buffer2.length, sampleRate);
        for (let i = 0; i < buffer1.numberOfChannels; i++) {
            mergedBuffer.getChannelData(i).set(buffer1.getChannelData(i), 0);
            mergedBuffer.getChannelData(i).set(buffer2.getChannelData(i), buffer1.length);
        }
        audioContext.close();

        const mergedBlob = bufferToWav(mergedBuffer);
        const mergedBlobId = `audio_merged_${Date.now()}`;
        
        const blobsToDelete = [previousLine.audioBlobId, currentLine.audioBlobId];
        const newBlobEntry: AudioBlob = { id: mergedBlobId, lineId: previousLine.id, data: mergedBlob };

        // Shift audio up starting from the current line's position.
        const startCharacter = state.characters.find(c => c.id === currentLine.characterId);
        const silentCharId = state.characters.find(c => c.name === '[静音]')?.id;

        const eligibleLinesForShift = chapter.scriptLines.filter((line, index) => {
            if (index < currentLineIndex) return false; // Only consider lines from currentLine onwards
            if (line.characterId === silentCharId) return false;
            
            if (shiftMode === 'chapter') return true;
            if (shiftMode === 'character' && startCharacter) return line.characterId === startCharacter.id;
            if (shiftMode === 'cv' && startCharacter?.cvName) {
                const lineChar = state.characters.find(c => c.id === line.characterId);
                return lineChar?.cvName === startCharacter.cvName;
            }
            return false;
        });

        const updates = new Map<string, string | undefined>();
        
        for (let i = 0; i < eligibleLinesForShift.length - 1; i++) {
            const lineToUpdate = eligibleLinesForShift[i];
            const lineToTakeAudioFrom = eligibleLinesForShift[i + 1];
            updates.set(lineToUpdate.id, lineToTakeAudioFrom.audioBlobId);
        }

        const lastEligibleLine = eligibleLinesForShift[eligibleLinesForShift.length - 1];
        if(lastEligibleLine) {
            updates.set(lastEligibleLine.id, undefined);
            if(lastEligibleLine.audioBlobId) {
                blobsToDelete.push(lastEligibleLine.audioBlobId);
            }
        }
        
        const finalScriptLines = chapter.scriptLines.map(line => {
            if (line.id === previousLine.id) {
                return { ...line, audioBlobId: mergedBlobId };
            }
            if (updates.has(line.id)) {
                return { ...line, audioBlobId: updates.get(line.id) };
            }
            return line;
        });
        
        const updatedProject = { ...project };
        const chapterIndex = updatedProject.chapters.findIndex(c => c.id === chapterId);
        updatedProject.chapters[chapterIndex] = { ...chapter, scriptLines: finalScriptLines };
        updatedProject.lastModified = Date.now();

        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            await db.audioBlobs.bulkDelete(blobsToDelete);
            await db.audioBlobs.put(newBlobEntry);
            await db.projects.put(updatedProject);
        });

        set({
            projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        });

    } catch (e) {
        console.error("Failed to merge audio:", e);
        alert(`合并音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
});