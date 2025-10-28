

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
        projects,
        characters,
        allCvNamesItem,
        cvStylesItem,
        mergeHistoryItem,
        cvColorPresetsItem,
        characterColorPresetsItem,
        apiSettingsItem,
        selectedAiProviderItem,
      ] = await db.transaction('r', db.projects, db.characters, db.misc, async () => {
        return Promise.all([
          db.projects.orderBy('lastModified').reverse().toArray(),
          db.characters.toArray(),
          db.misc.get('allCvNames'),
          db.misc.get('cvStyles'),
          db.misc.get('mergeHistory'),
          db.misc.get('cvColorPresets'),
          db.misc.get('characterColorPresets'),
          db.misc.get('apiSettings'),
          db.misc.get('selectedAiProvider'),
        ]);
      });

      const allCvNames = allCvNamesItem?.value || [];
      const cvStyles = cvStylesItem?.value || {};
      const mergeHistory = mergeHistoryItem?.value || [];
      const apiSettings = apiSettingsItem?.value || get().apiSettings;
      const selectedAiProvider = selectedAiProviderItem?.value || 'gemini';
      
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

      let initialView: AppView = "dashboard";
      if (projects.length === 0) {
        initialView = "upload";
      }

      const processedCharacters = characters.map((char: Character) => ({
        ...char,
        isStyleLockedToCv: char.isStyleLockedToCv || false,
        status: char.status || 'active',
      }));

      // Ensure default characters exist
      const defaultCharsToAdd: Character[] = [];
      const defaultCharConfigs = [
        { name: '[静音]', color: 'bg-slate-700', textColor: 'text-slate-400', description: '用于标记无需录制的旁白提示' },
        { name: 'Narrator', color: 'bg-slate-600', textColor: 'text-slate-100', description: '默认旁白角色' },
        { name: '待识别角色', color: 'bg-orange-400', textColor: 'text-black', description: '由系统自动识别但尚未分配的角色' },
        { name: '音效', color: 'bg-transparent', textColor: 'text-red-500', description: '用于标记音效的文字描述' },
      ];

      for (const config of defaultCharConfigs) {
        if (!processedCharacters.some(c => c.name === config.name)) {
          const newChar: Character = {
            id: Date.now().toString() + "_char_default_" + Math.random(),
            name: config.name,
            color: config.color,
            textColor: config.textColor,
            description: config.description,
            cvName: '',
            isStyleLockedToCv: false,
            status: 'active',
          };
          defaultCharsToAdd.push(newChar);
        }
      }

      if (defaultCharsToAdd.length > 0) {
        await db.characters.bulkAdd(defaultCharsToAdd);
        processedCharacters.push(...defaultCharsToAdd);
      }

      const sortedCvNames = allCvNames.sort();

      set({
        projects,
        characters: processedCharacters,
        allCvNames: sortedCvNames,
        cvStyles,
        mergeHistory,
        cvColorPresets,
        characterColorPresets,
        apiSettings,
        selectedAiProvider,
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
        allCvNames: [],
        cvStyles: {},
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

    const newCvStyles = { ...state.cvStyles };
    const newAllCvNames = [...state.allCvNames];
    const changes: { oldName: string; newPreset: PresetColor; colorChanged: boolean; nameChanged: boolean }[] = [];

    presets.forEach((newPreset, index) => {
      const oldPreset = oldPresets[index];
      if (oldPreset) {
        const colorChanged = oldPreset.bgColorClass !== newPreset.bgColorClass || oldPreset.textColorClass !== newPreset.textColorClass;
        const nameChanged = oldPreset.name !== newPreset.name;
        if (colorChanged || nameChanged) {
          changes.push({ oldName: oldPreset.name, newPreset, colorChanged, nameChanged });
        }
      }
    });

    if (changes.length > 0) {
      let charactersModified = false;
      const updatedCharacters = [...state.characters];

      changes.forEach(change => {
        const { oldName, newPreset, colorChanged, nameChanged } = change;
        const newName = newPreset.name;

        if (nameChanged) {
          delete newCvStyles[oldName];
          const oldNameIndex = newAllCvNames.findIndex(n => n.toLowerCase() === oldName.toLowerCase());
          if (oldNameIndex > -1) {
            newAllCvNames.splice(oldNameIndex, 1);
          }
          if (!newAllCvNames.some(n => n.toLowerCase() === newName.toLowerCase())) {
            newAllCvNames.push(newName);
          }
        }
        newCvStyles[newName] = {
          bgColor: newPreset.bgColorClass,
          textColor: newPreset.textColorClass,
        };

        updatedCharacters.forEach((char, index) => {
          if (char.cvName === oldName) {
            const charCopy = { ...char };
            let needsUpdate = false;
            if (nameChanged) {
              charCopy.cvName = newName;
              needsUpdate = true;
            }
            if (colorChanged && !char.isStyleLockedToCv) {
              charCopy.color = newPreset.bgColorClass;
              charCopy.textColor = newPreset.textColorClass;
              needsUpdate = true;
            }
            if (needsUpdate) {
              updatedCharacters[index] = charCopy;
              charactersModified = true;
            }
          }
        });
      });

      newAllCvNames.sort();

      await db.transaction('rw', db.misc, db.characters, async () => {
        await db.misc.put({ key: 'cvColorPresets', value: presets });
        await db.misc.put({ key: 'cvStyles', value: newCvStyles });
        await db.misc.put({ key: 'allCvNames', value: newAllCvNames });
        if (charactersModified) {
          await db.characters.bulkPut(updatedCharacters);
        }
      });

      set({
        cvColorPresets: presets,
        cvStyles: newCvStyles,
        characters: updatedCharacters,
        allCvNames: newAllCvNames,
      });
    } else {
      // No color changes, but maybe names or order did. Save anyway.
      await db.misc.put({ key: 'cvColorPresets', value: presets });
      set({ cvColorPresets: presets });
    }
  },
  updateCharacterColorPresets: async (presets: PresetColor[]) => {
    await db.misc.put({ key: 'characterColorPresets', value: presets });
    set({ characterColorPresets: presets });
  },
}));

export default useStore;