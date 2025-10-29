

import { create } from 'zustand';
// Fix: Import from types.ts to break circular dependency
import { AppView, CVStylesMap, PresetColor } from '../types';
import { Project, Character, MergeHistoryEntry } from '../types';

// Import slice creators and their state/action types
import { createUiSlice, UiSlice } from './slices/uiSlice';
import { createProjectSlice, ProjectSlice } from './slices/projectSlice';
import { createCharacterSlice, CharacterSlice } from './slices/characterSlice';
import { createMergeSlice, MergeSlice } from './slices/mergeSlice';
import { db } from '../db'; // Import the Dexie database instance
import { defaultCvPresetColors, defaultCharacterPresetColors } from '../lib/colorPresets';

// Define the combined state shape by extending all slice types
export interface AppState extends UiSlice, ProjectSlice, CharacterSlice, MergeSlice {
  cvColorPresets: PresetColor[];
  characterColorPresets: PresetColor[];
  loadInitialData: () => Promise<void>;
  updateCvColorPresets: (presets: PresetColor[]) => Promise<void>;
  updateCharacterColorPresets: (presets: PresetColor[]) => Promise<void>;
}

const defaultCharConfigs = [
  { name: '[静音]', color: 'bg-slate-700', textColor: 'text-slate-400', description: '用于标记无需录制的旁白提示' },
  { name: 'Narrator', color: 'bg-slate-600', textColor: 'text-slate-100', description: '默认旁白角色' },
  { name: '待识别角色', color: 'bg-orange-400', textColor: 'text-black', description: '由系统自动识别但尚未分配的角色' },
  { name: '音效', color: 'bg-transparent', textColor: 'text-red-500', description: '用于标记音效的文字描述' },
];

export const useStore = create<AppState>((set, get, api) => ({
  // Spread slice creators, passing set, get, and api
  ...createUiSlice(set, get, api),
  ...createProjectSlice(set, get, api),
  ...createCharacterSlice(set, get, api),
  ...createMergeSlice(set, get, api),

  // State for global color presets
  cvColorPresets: [],
  characterColorPresets: [],

  // Global actions
  loadInitialData: async () => {
    try {
      const [
        projectsFromDb,
        charactersFromDb,
        mergeHistoryItem,
        cvColorPresetsItem,
        characterColorPresetsItem,
        apiSettingsItem,
        selectedAiProviderItem,
        characterShortcutsItem,
      ] = await db.transaction('r', db.projects, db.characters, db.misc, async () => {
        return Promise.all([
          db.projects.orderBy('lastModified').reverse().toArray(),
          db.characters.toArray(),
          db.misc.get('mergeHistory'),
          db.misc.get('cvColorPresets'),
          db.misc.get('characterColorPresets'),
          db.misc.get('apiSettings'),
          db.misc.get('selectedAiProvider'),
          db.misc.get('characterShortcuts'),
        ]);
      });

      const projects = projectsFromDb.map(p => ({ ...p, cvStyles: p.cvStyles || {} }));
      const mergeHistory = mergeHistoryItem?.value || [];
      const apiSettings = apiSettingsItem?.value || get().apiSettings;
      const selectedAiProvider = selectedAiProviderItem?.value || 'gemini';
      const characterShortcuts = characterShortcutsItem?.value || {};
      
      let cvColorPresets = cvColorPresetsItem?.value;
      if (!cvColorPresets || !Array.isArray(cvColorPresets) || cvColorPresets.length === 0) {
        cvColorPresets = defaultCvPresetColors;
        await db.misc.put({ key: 'cvColorPresets', value: cvColorPresets });
      }

      let characterColorPresets = characterColorPresetsItem?.value;
      if (!characterColorPresets || !Array.isArray(characterColorPresets) || characterColorPresets.length === 0) {
        characterColorPresets = defaultCharacterPresetColors;
        await db.misc.put({ key: 'characterColorPresets', value: characterColorPresets });
      }
      
      const processedCharacters = charactersFromDb.map((char: Character) => ({
        ...char,
        isStyleLockedToCv: char.isStyleLockedToCv || false,
        status: char.status || 'active',
      }));

      // --- Project-specific default character migration ---
      const charactersToCreate: Character[] = [];
      projects.forEach(proj => {
        const projectChars = processedCharacters.filter(c => c.projectId === proj.id);
        for (const config of defaultCharConfigs) {
          if (!projectChars.some(c => c.name === config.name)) {
            const newChar: Character = {
              id: Date.now().toString() + `_char_default_${proj.id}_` + Math.random(),
              name: config.name,
              projectId: proj.id,
              color: config.color,
              textColor: config.textColor,
              description: config.description,
              cvName: '',
              isStyleLockedToCv: false,
              status: 'active',
            };
            charactersToCreate.push(newChar);
          }
        }
      });
      
      if (charactersToCreate.length > 0) {
        await db.characters.bulkAdd(charactersToCreate);
        processedCharacters.push(...charactersToCreate);
      }
      // --- End migration ---

      let initialView: AppView = "dashboard";
      if (projects.length === 0) {
        initialView = "upload";
      }
      
      set({
        projects,
        characters: processedCharacters,
        mergeHistory,
        cvColorPresets,
        characterColorPresets,
        apiSettings,
        selectedAiProvider,
        characterShortcuts,
        currentView: initialView,
        aiProcessingChapterIds: [], // Reset on load
        selectedProjectId: get().selectedProjectId || null,
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to load data from Dexie database:", error);
      set({
        projects: [],
        characters: [],
        mergeHistory: [],
        cvColorPresets: defaultCvPresetColors,
        characterColorPresets: defaultCharacterPresetColors,
        currentView: "upload",
        isLoading: false,
      });
    }
  },
  updateCvColorPresets: async (presets: PresetColor[]) => {
    const state = get();
    const oldPresets = state.cvColorPresets;

    if (oldPresets.length !== presets.length) {
      await db.misc.put({ key: 'cvColorPresets', value: presets });
      set({ cvColorPresets: presets });
      console.warn("CV color presets length changed unexpectedly. Propagation skipped.");
      return;
    }

    // Since cvStyles is now per-project, this global preset update doesn't automatically propagate
    // to character colors anymore. This simplifies the logic here significantly. We just save the presets.
    await db.misc.put({ key: 'cvColorPresets', value: presets });
    set({ cvColorPresets: presets });
  },
  updateCharacterColorPresets: async (presets: PresetColor[]) => {
    await db.misc.put({ key: 'characterColorPresets', value: presets });
    set({ characterColorPresets: presets });
  },
}));

export default useStore;
