
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
  apiSettings: ApiSettings;
  selectedAiProvider: AiProvider;


  navigateTo: (view: AppView) => void;
  setIsLoading: (loading: boolean) => void;
  setSelectedProjectId: (id: string | null) => void;
  setSelectedChapterId: (id: string | null) => void;
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
  setApiSettings: (settings: ApiSettings) => Promise<void>;
  setSelectedAiProvider: (provider: AiProvider) => Promise<void>;
}

export const createUiSlice: StateCreator<AppState, [], [], UiSlice> = (set) => ({
  currentView: "dashboard", // Initial default
  isLoading: false,
  selectedProjectId: null,
  selectedChapterId: null,
  aiProcessingChapterIds: [],
  playingLineInfo: null,
  confirmModal: confirmModalInitState,
  characterAndCvStyleModal: { isOpen: false, characterToEdit: null },
  isSettingsModalOpen: false,
  apiSettings: {
    gemini: { apiKey: '' },
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4-turbo' },
    moonshot: { apiKey: '', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  },
  selectedAiProvider: 'gemini',

  navigateTo: (view) => set({ currentView: view }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSelectedProjectId: (id) => set({ selectedProjectId: id, selectedChapterId: null }),
  setSelectedChapterId: (id) => set({ selectedChapterId: id }),
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
  setApiSettings: async (settings) => {
    await db.misc.put({ key: 'apiSettings', value: settings });
    set({ apiSettings: settings });
  },
  setSelectedAiProvider: async (provider) => {
    await db.misc.put({ key: 'selectedAiProvider', value: provider });
    set({ selectedAiProvider: provider });
  },
});
