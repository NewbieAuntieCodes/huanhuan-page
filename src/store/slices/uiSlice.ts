import { StateCreator } from 'zustand';
import { AppState } from '../useStore'; // Import AppState for cross-slice type reference
import { AppView, ScriptLine, Character } from '../../types';
import React from 'react';

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
});