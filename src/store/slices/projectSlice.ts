import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Project, Collaborator, Chapter, AudioBlob, ScriptLine, Character, SilenceSettings } from '../../types';
import { db } from '../../db';
import { splitAudio, mergeAudio } from '../../lib/audioProcessing';
import { calculateShiftChain, ShiftMode } from '../../lib/shiftChainUtils';
import { defaultSilenceSettings } from '../../lib/defaultSilenceSettings';

const defaultCharConfigs = [
  { name: '[静音]', color: 'bg-slate-700', textColor: 'text-slate-400', description: '用于标记无需录制的旁白提示' },
  { name: 'Narrator', color: 'bg-slate-600', textColor: 'text-slate-100', description: '默认旁白角色' },
  { name: '待识别角色', color: 'bg-orange-400', textColor: 'text-black', description: '由系统自动识别但尚未分配的角色' },
  { name: '音效', color: 'bg-transparent', textColor: 'text-red-500', description: '用于标记音效的文字描述' },
];

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
  addCustomSoundType: (projectId: string, soundType: string) => Promise<void>;
  deleteCustomSoundType: (projectId: string, soundType: string) => Promise<void>;
  batchAddChapters: (projectId: string, count: number) => Promise<void>;
  toggleLineReturnMark: (projectId: string, chapterId: string, lineId: string) => Promise<void>;
  updateLineFeedback: (projectId: string, chapterId: string, lineId: string, feedback: string) => Promise<void>;
  updateProjectSilenceSettings: (projectId: string, settings: SilenceSettings) => Promise<void>;
  updateLinePostSilence: (projectId: string, chapterId: string, lineId: string, silence?: number) => Promise<void>;
}

export const createProjectSlice: StateCreator<AppState, [], [], ProjectSlice> = (set, get, _api) => ({
  projects: [],
  addProject: async (newProject) => {
    const projectWithExtras = { 
      ...newProject, 
      cvStyles: {
        'pb': { bgColor: 'bg-slate-700', textColor: 'text-slate-300' } // Add default style for 'pb'
      },
      customSoundTypes: [],
      silenceSettings: defaultSilenceSettings,
    };
    
    // Create project-specific default characters
    const defaultCharsForProject: Character[] = defaultCharConfigs.map(config => ({
      id: Date.now().toString() + `_char_default_${newProject.id}_` + Math.random(),
      name: config.name,
      projectId: newProject.id, // Link to this new project
      color: config.color,
      textColor: config.textColor,
      description: config.description,
      cvName: config.name === 'Narrator' ? 'pb' : '', // Set default CV for Narrator
      isStyleLockedToCv: false,
      status: 'active',
    }));

    await db.transaction('rw', db.projects, db.characters, async () => {
      await db.projects.add(projectWithExtras);
      await db.characters.bulkAdd(defaultCharsForProject);
    });

    set(state => {
      const updatedProjects = [projectWithExtras, ...state.projects].sort((a,b) => b.lastModified - a.lastModified);
      const updatedCharacters = [...state.characters, ...defaultCharsForProject];
      return { projects: updatedProjects, characters: updatedCharacters };
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

    let nextLine: ScriptLine | null = null;
    let nextLineIndex: number = -1;
    const allCharacters = get().characters;
    const startChar = allCharacters.find(c => c.id === currentLine.characterId);
    const silentAndEffectCharIds = new Set(allCharacters.filter(c => c.name === '[静音]' || c.name === '音效').map(c => c.id));

    for (let i = currentLineIndex + 1; i < chapter.scriptLines.length; i++) {
        const potentialNextLine = chapter.scriptLines[i];
        if (!potentialNextLine.audioBlobId || silentAndEffectCharIds.has(potentialNextLine.characterId || '')) continue;

        let isMatch = false;
        if (shiftMode === 'chapter') {
            isMatch = true;
        } else if (shiftMode === 'character' && startChar) {
            isMatch = potentialNextLine.characterId === startChar.id;
        } else if (shiftMode === 'cv' && startChar?.cvName) {
            const potentialChar = allCharacters.find(c => c.id === potentialNextLine.characterId);
            isMatch = !!potentialChar && !!potentialChar.cvName && potentialChar.cvName === startChar.cvName;
        }
        
        if (isMatch) {
            nextLine = potentialNextLine;
            nextLineIndex = i;
            break;
        }
    }

    if (!nextLine || !currentLine.audioBlobId || !nextLine.audioBlobId) {
        alert("无法合并：找不到符合条件的下一句带音频的台词。");
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

        const shiftChain = calculateShiftChain(chapter.scriptLines, nextLineIndex + 1, shiftMode, get().characters, currentLine.characterId);

        const newScriptLines = [...chapter.scriptLines];
        
        // 1. Update current line with merged audio. DO NOT CHANGE TEXT.
        newScriptLines[currentLineIndex] = { ...currentLine, audioBlobId: mergedBlobId };

        // 2. The line we merged FROM gets the audio of the first item in the chain.
        const firstShiftedAudioId = shiftChain.length > 0 ? shiftChain[0].line.audioBlobId : undefined;
        newScriptLines[nextLineIndex] = { ...nextLine, audioBlobId: firstShiftedAudioId };

        // 3. Shift audio up for the rest of the chain
        for (let i = 0; i < shiftChain.length - 1; i++) {
            const currentInChain = shiftChain[i];
            const nextInChain = shiftChain[i + 1];
            newScriptLines[currentInChain.index] = { ...currentInChain.line, audioBlobId: nextInChain.line.audioBlobId };
        }

        // 4. Last item in chain becomes empty
        if (shiftChain.length > 0) {
            const lastInChain = shiftChain[shiftChain.length - 1];
            newScriptLines[lastInChain.index] = { ...lastInChain.line, audioBlobId: undefined };
        }
        
        const updatedChapter = { ...chapter, scriptLines: newScriptLines };
        const updatedProject = { ...project, chapters: project.chapters.map(c => c.id === chapterId ? updatedChapter : c), lastModified: Date.now() };

        await db.transaction('rw', db.projects, db.audioBlobs, async () => {
            await db.audioBlobs.bulkDelete(blobsToDelete);
            await db.audioBlobs.put(newBlobEntry);
            await db.projects.put(updatedProject);
        });

        set({ projects: state.projects.map(p => p.id === projectId ? updatedProject : p) });

    } catch (e) {
        console.error("Failed to merge and shift audio:", e);
        alert(`合并音频失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
  addCustomSoundType: async (projectId, soundType) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const trimmedSoundType = soundType.trim();
    if (!trimmedSoundType || (project.customSoundTypes || []).includes(trimmedSoundType)) {
      return;
    }

    const updatedProject = {
      ...project,
      customSoundTypes: [...(project.customSoundTypes || []), trimmedSoundType],
      lastModified: Date.now(),
    };

    await db.projects.put(updatedProject);
    set({
      projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        .sort((a,b) => b.lastModified - a.lastModified),
    });
  },
  deleteCustomSoundType: async (projectId, soundTypeToDelete) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedProject = {
      ...project,
      customSoundTypes: (project.customSoundTypes || []).filter(st => st !== soundTypeToDelete),
      chapters: project.chapters.map(ch => ({
        ...ch,
        scriptLines: ch.scriptLines.map(line => 
          line.soundType === soundTypeToDelete ? { ...line, soundType: '' } : line
        )
      })),
      lastModified: Date.now(),
    };

    await db.projects.put(updatedProject);
    set({
      projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
        .sort((a,b) => b.lastModified - a.lastModified),
    });
  },
  batchAddChapters: async (projectId, count) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    let lastChapterTitle = '';
    if (project.chapters.length > 0) {
        lastChapterTitle = project.chapters[project.chapters.length - 1].title;
    }

    const titleRegex = /^(.*?)(\d+)(.*?)$/;
    const match = lastChapterTitle.match(titleRegex);

    let baseName = `第`;
    let startNumber = project.chapters.length + 1;
    let suffix = `章`;

    if (match) {
        baseName = match[1];
        startNumber = parseInt(match[2], 10) + 1;
        suffix = match[3];
    } else if (lastChapterTitle) {
        baseName = `${lastChapterTitle}-`;
        startNumber = 1;
        suffix = '';
    }
    
    const newChapters: Chapter[] = [];
    for (let i = 0; i < count; i++) {
        const newChapter: Chapter = {
            id: `ch_${Date.now()}_${i}_${Math.random()}`,
            title: `${baseName}${startNumber + i}${suffix}`,
            rawContent: '',
            scriptLines: [],
        };
        newChapters.push(newChapter);
    }
    
    const updatedProject = {
        ...project,
        chapters: [...project.chapters, ...newChapters],
        lastModified: Date.now(),
    };

    await db.projects.put(updatedProject);
    set({
        projects: state.projects.map(p => p.id === projectId ? updatedProject : p)
    });
  },
  toggleLineReturnMark: async (projectId, chapterId, lineId) => {
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
                return { ...line, isMarkedForReturn: !line.isMarkedForReturn };
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
    }));
  },
  updateLineFeedback: async (projectId, chapterId, lineId, feedback) => {
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
                return { ...line, feedback: feedback };
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
    }));
  },
  updateProjectSilenceSettings: async (projectId, settings) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedProject = { ...project, silenceSettings: settings, lastModified: Date.now() };
    await db.projects.put(updatedProject);
    set(state => ({
        projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
    }));
  },
  updateLinePostSilence: async (projectId, chapterId, lineId, silence) => {
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
                            return { ...line, postSilence: silence === undefined ? undefined : Number(silence) };
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
        projects: state.projects.map(p => p.id === projectId ? updatedProject : p),
    }));
  },
});