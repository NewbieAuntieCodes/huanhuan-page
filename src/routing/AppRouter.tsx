import React from 'react';
import { useStore } from '../store/useStore';
import UploadPage from '../features/upload/UploadPage';
import DashboardPage from '../features/projectDashboard/DashboardPage';
import EditorPage from '../features/scriptEditor/EditorPage';
import AudioAlignmentPage from '../features/audioAlignment/AudioAlignmentPage';
import CvManagementPage from '../features/cvManagement/CvManagementPage';
import VoiceLibraryPage from '../features/voiceLibrary/VoiceLibraryPage';
import AudioAlignmentAssistantPage from '../features/audioAlignmentAssistant/AudioAlignmentAssistantPage';
import { Character } from '../types';

const AppRouter: React.FC = () => {
  const {
    currentView,
    projects,
    characters,
    selectedProjectId,
    updateProject,
    addCharacter,
    deleteCharacter,
    editCharacter,
    toggleCharacterStyleLock,
    bulkUpdateCharacterStylesForCV,
    navigateTo,
    openCharacterAndCvStyleModal,
    openConfirmModal,
  } = useStore(state => ({
    currentView: state.currentView,
    projects: state.projects,
    characters: state.characters,
    selectedProjectId: state.selectedProjectId,
    updateProject: state.updateProject,
    addCharacter: state.addCharacter,
    deleteCharacter: state.deleteCharacter,
    editCharacter: state.editCharacter,
    toggleCharacterStyleLock: state.toggleCharacterStyleLock,
    bulkUpdateCharacterStylesForCV: state.bulkUpdateCharacterStylesForCV,
    navigateTo: state.navigateTo,
    openCharacterAndCvStyleModal: state.openCharacterAndCvStyleModal,
    openConfirmModal: state.openConfirmModal,
  }));

  const onNavigateToDashboard = () => navigateTo('dashboard');

  const onDeleteChapters = (chapterIds: string[], undoableDelete: () => void) => {
    openConfirmModal(
      `删除 ${chapterIds.length} 个章节确认`,
      `您确定要删除选中的章节吗？此操作可通过“撤销”恢复。`,
      () => {
        undoableDelete();
      },
      "删除",
      "取消"
    );
  };

  switch (currentView) {
    case 'upload':
      return <UploadPage />;
    
    case 'dashboard':
      return <DashboardPage />;
      
    case 'editor':
      if (selectedProjectId) {
        return <EditorPage 
          projectId={selectedProjectId}
          projects={projects}
          characters={characters}
          onProjectUpdate={updateProject}
          onAddCharacter={addCharacter}
          onDeleteCharacter={deleteCharacter}
          onDeleteChapters={onDeleteChapters}
          onToggleCharacterStyleLock={toggleCharacterStyleLock}
          onBulkUpdateCharacterStylesForCV={bulkUpdateCharacterStylesForCV}
          onNavigateToDashboard={onNavigateToDashboard}
          onOpenCharacterAndCvStyleModal={openCharacterAndCvStyleModal}
          onEditCharacter={editCharacter}
        />;
      }
      return <DashboardPage />;
      
    case 'audioAlignment':
        return <AudioAlignmentPage />;

    case 'audioAlignmentAssistant':
        return <AudioAlignmentAssistantPage />;
      
    case 'cvManagement':
      return <CvManagementPage />;
      
    case 'voiceLibrary':
        return <VoiceLibraryPage />;

    default:
        if (projects.length === 0) {
            return <UploadPage />;
        }
        return <DashboardPage />;
  }
};

export default AppRouter;