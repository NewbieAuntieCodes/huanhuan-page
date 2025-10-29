

import React, { useEffect, useCallback, useMemo } from 'react';
import { useStore }  from './store/useStore';
// FIX: Add CVStylesMap to imports for explicit typing of useMemo.
import { Character, CVStylesMap } from './types';
import ConfirmModal from './components/modal/ConfirmModal';
import CharacterAndCvStyleModal from './features/scriptEditor/components/editor_page_modal/CharacterAndCvStyleModal';
import AppRouter from './routing/AppRouter'; 
import { CogIcon } from './components/ui/icons';
import SettingsModal from './components/modal/SettingsModal';

const App: React.FC = () => {
  const { 
    currentView, 
    projects, 
    characters, 
    selectedProjectId, 
    isLoading, 
    confirmModal,
    characterAndCvStyleModal,
    isSettingsModalOpen,
    loadInitialData,
    navigateTo,
    addCharacter,
    editCharacter,
    closeConfirmModal,
    closeCharacterAndCvStyleModal,
    openSettingsModal,
    closeSettingsModal,
  } = useStore();
  
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // FIX: Added an explicit return type to `useMemo` to ensure TypeScript correctly infers `projectCvNames` as `string[]` instead of `unknown[]`.
  // FIX: Replaced `Array.from(new Set(...))` with a `reduce` operation to create the unique list of CV names. This approach is more robust for TypeScript's type inference.
  const { projectCvStyles, projectCvNames } = useMemo<{ projectCvStyles: CVStylesMap, projectCvNames: string[] }>(() => {
    const currentProject = projects.find(p => p.id === selectedProjectId);
    if (!currentProject) {
      return { projectCvStyles: {}, projectCvNames: [] };
    }
    
    // Get characters for the current project only, plus global characters (no projectId)
    const projectCharacters = characters.filter(c => !c.projectId || c.projectId === selectedProjectId);
    
    // Derive CV names from the project's characters
    const cvNames = projectCharacters.reduce<string[]>((acc, c) => {
      if (c.cvName && !acc.includes(c.cvName)) {
        acc.push(c.cvName);
      }
      return acc;
    }, []).sort();

    return {
      projectCvStyles: currentProject.cvStyles || {},
      projectCvNames: cvNames,
    };
  }, [selectedProjectId, projects, characters]);


  const handleSaveFromUnifiedModal = useCallback((
    characterData: Character,
    cvName: string,
    cvBgColor: string,
    cvTextColor: string
  ) => {
    const isNewCharacter = !characterAndCvStyleModal.characterToEdit || !characterData.projectId;
    if (isNewCharacter) {
      if (!selectedProjectId) {
        alert("错误：无法在没有选定项目的情况下创建角色。");
        return;
      }
      const newChar = addCharacter(characterData, selectedProjectId);
      editCharacter(newChar, cvName, cvBgColor, cvTextColor);
    } else {
      editCharacter(characterData, cvName, cvBgColor, cvTextColor);
    }
    closeCharacterAndCvStyleModal();
  }, [characterAndCvStyleModal.characterToEdit, addCharacter, editCharacter, closeCharacterAndCvStyleModal, selectedProjectId]);


  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900">
      <header className="bg-slate-800 text-white p-3 shadow-md flex-shrink-0 border-b border-slate-700 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-sky-400">AI 有声内容创作</h1>
        <nav className="space-x-3 flex items-center">
          {currentView !== "upload" && (
            <button onClick={() => navigateTo("upload")} className="text-sm text-sky-300 hover:text-sky-100">上传新文件</button>
          )}
          {currentView !== "dashboard" && projects.length > 0 && (
            <button onClick={() => navigateTo("dashboard")} className="text-sm text-sky-300 hover:text-sky-100">我的项目</button>
          )}
           {currentView !== "editor" && selectedProjectId && projects.length > 0 && (
             <button onClick={() => navigateTo("editor")} className="text-sm text-sky-300 hover:text-sky-100">编辑项目</button>
          )}
          {currentView !== "audioAlignment" && projects.length > 0 && ( 
             <button onClick={() => navigateTo("audioAlignment")} className="text-sm text-sky-300 hover:text-sky-100">音频对轨</button>
          )}
          {currentView !== "audioAlignmentAssistant" && projects.length > 0 && (
             <button onClick={() => navigateTo("audioAlignmentAssistant")} className="text-sm text-sky-300 hover:text-sky-100">对轨助手</button>
          )}
          {currentView !== "cvManagement" && characters.length > 0 && (
             <button onClick={() => navigateTo("cvManagement")} className="text-sm text-sky-300 hover:text-sky-100">CV管理</button>
          )}
          {currentView !== "voiceLibrary" && projects.length > 0 && (
             <button onClick={() => navigateTo("voiceLibrary")} className="text-sm text-sky-300 hover:text-sky-100">音色库</button>
          )}
          <button onClick={openSettingsModal} className="text-sm text-sky-300 hover:text-sky-100 p-2 rounded-full hover:bg-slate-700" title="设置">
            <CogIcon className="w-5 h-5" />
          </button>
        </nav>
      </header>      
      <main className="flex-grow overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center z-[100]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
            <p className="ml-3 text-slate-100">加载中...</p>
          </div>
        )}
        <AppRouter />
      </main>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={() => {
          confirmModal.onConfirm();
          closeConfirmModal();
        }}
        onCancel={() => {
          if (confirmModal.onCancel) {
            confirmModal.onCancel();
          }
          closeConfirmModal();
        }}
        confirmButtonText={confirmModal.confirmText}
        cancelButtonText={confirmModal.cancelText}
      />
      {characterAndCvStyleModal.isOpen && (
        <CharacterAndCvStyleModal
          isOpen={characterAndCvStyleModal.isOpen}
          onClose={closeCharacterAndCvStyleModal}
          onSave={handleSaveFromUnifiedModal}
          characterToEdit={characterAndCvStyleModal.characterToEdit}
          allCvNames={projectCvNames}
          cvStyles={projectCvStyles}
        />
      )}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={closeSettingsModal}
      />
    </div>
  );
};

export default App;