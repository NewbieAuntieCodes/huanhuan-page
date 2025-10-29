

import { StateCreator } from 'zustand';
import { AppState } from '../useStore'; // Import AppState for cross-slice type reference
import { AppView, ScriptLine, Character } from '../../types';
import React from 'react';
import { db } from '../../db';

export type AiProvider = 'gemini' | 'openai' | 'moonshot' | 'deepseek';

export interface ApiSettings {
  gemini: { apiKey: string; baseUrl?: string };
  openai: { apiKey: string; baseUrl: string; model: string };
  moonshot: { apiKey: string; baseUrl: string; model: string };
  deepseek: { apiKey: string; baseUrl: string; model: string };
}


export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const confirmModalInitState: ConfirmModalState = {
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
};

export interface UiSlice {
  currentView: AppView;
  isLoading: boolean;
  selectedProjectId: string | null;
  selectedChapterId: string | null;
  aiProcessingChapterIds: string[];
  playingLineInfo: { line: ScriptLine; character: Character | undefined } | null;
  confirmModal: ConfirmModalState;
  characterAndCvStyleModal: {
    isOpen: boolean;
    characterToEdit: Character | null;
  };
  isSettingsModalOpen: boolean;
  isShortcutSettingsModalOpen: boolean;
  apiSettings: ApiSettings;
  selectedAiProvider: AiProvider;
  characterShortcuts: Record<string, string>; // key: keyboard key, value: characterId


  navigateTo: (view: AppView) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedChapterId: (id: string | null) => Promise<void>;
  addAiProcessingChapterId: (id: string) => void;
  removeAiProcessingChapterId: (id: string) => void;
  setPlayingLine: (line: ScriptLine, character: Character | undefined) => void;
  clearPlayingLine: () => void;
  openConfirmModal: (
    title: string,
    message: React.ReactNode,
    onConfirm: () => void,
    confirmText?: string,
    cancelText?: string,
    onCancel?: () => void
  ) => void;
  closeConfirmModal: () => void;
  openCharacterAndCvStyleModal: (character: Character | null) => void;
  closeCharacterAndCvStyleModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openShortcutSettingsModal: () => void;
  closeShortcutSettingsModal: () => void;
  setApiSettings: (settings: ApiSettings) => Promise<void>;
  setSelectedAiProvider: (provider: AiProvider) => Promise<void>;
  setCharacterShortcuts: (shortcuts: Record<string, string>) => Promise<void>;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set, get) => ({
  currentView: "dashboard", // Initial default
  isLoading: false,
  selectedProjectId: null,
  selectedChapterId: null,
  aiProcessingChapterIds: [],
  playingLineInfo: null,
  confirmModal: confirmModalInitState,
  characterAndCvStyleModal: { isOpen: false, characterToEdit: null },
  isSettingsModalOpen: false,
  isShortcutSettingsModalOpen: false,
  apiSettings: {
    gemini: { apiKey: '' },
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4-turbo' },
    moonshot: { apiKey: '', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  },
  selectedAiProvider: 'gemini',
  characterShortcuts: {},

  navigateTo: (view) => set({ currentView: view }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSelectedProjectId: (id) => {
    if (id) {
        const { projects } = get();
        const project = projects.find(p => p.id === id);
        // Restore last viewed chapter, or default to first chapter, or null if no chapters.
        const chapterIdToSet = project?.lastViewedChapterId || project?.chapters[0]?.id || null;
        set({ selectedProjectId: id, selectedChapterId: chapterIdToSet });
    } else {
        set({ selectedProjectId: null, selectedChapterId: null });
    }
  },
  setSelectedChapterId: async (id) => {
    const { selectedProjectId, projects } = get();
    // Update UI state immediately for responsiveness
    set({ selectedChapterId: id });

    if (selectedProjectId && id) {
        const projectToUpdate = projects.find(p => p.id === selectedProjectId);
        // Only update if the chapter has changed and project exists
        if (projectToUpdate && projectToUpdate.lastViewedChapterId !== id) {
            const updatedProject = { ...projectToUpdate, lastViewedChapterId: id };
            
            // Persist change to the database in the background
            await db.projects.put(updatedProject);
            
            // Update the project in the global state
            set(state => ({
                projects: state.projects.map(p => p.id === selectedProjectId ? updatedProject : p),
            }));
        }
    }
  },
  addAiProcessingChapterId: (id) =>
    set((state) => ({
      aiProcessingChapterIds: state.aiProcessingChapterIds.includes(id)
        ? state.aiProcessingChapterIds
        : [...state.aiProcessingChapterIds, id],
    })),
  removeAiProcessingChapterId: (id) =>
    set((state) => ({
      aiProcessingChapterIds: state.aiProcessingChapterIds.filter(
        (chapterId) => chapterId !== id
      ),
    })),
  setPlayingLine: (line, character) => set({ playingLineInfo: { line, character } }),
  clearPlayingLine: () => set({ playingLineInfo: null }),

  openConfirmModal: (title, message, onConfirm, confirmText, cancelText, onCancel) => {
    set({
      confirmModal: {
        isOpen: true,
        title,
        message,
        onConfirm,
        onCancel,
        confirmText,
        cancelText,
      }
    });
  },
  closeConfirmModal: () => set({ confirmModal: confirmModalInitState }),
  openCharacterAndCvStyleModal: (character) => set({ characterAndCvStyleModal: { isOpen: true, characterToEdit: character } }),
  closeCharacterAndCvStyleModal: () => set({ characterAndCvStyleModal: { isOpen: false, characterToEdit: null } }),
  openSettingsModal: () => set({ isSettingsModalOpen: true }),
  closeSettingsModal: () => set({ isSettingsModalOpen: false }),
  openShortcutSettingsModal: () => set({ isShortcutSettingsModalOpen: true }),
  closeShortcutSettingsModal: () => set({ isShortcutSettingsModalOpen: false }),
  setApiSettings: async (settings) => {
    await db.misc.put({ key: 'apiSettings', value: settings });
    set({ apiSettings: settings });
  },
  setSelectedAiProvider: async (provider) => {
    await db.misc.put({ key: 'selectedAiProvider', value: provider });
    set({ selectedAiProvider: provider });
  },
  setCharacterShortcuts: async (shortcuts) => {
    await db.misc.put({ key: 'characterShortcuts', value: shortcuts });
    set({ characterShortcuts: shortcuts });
  },
});
