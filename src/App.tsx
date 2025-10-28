

import React, { useEffect, useCallback } from 'react';
import { useStore }  from './store/useStore';
import { Character } from './types';
import ConfirmModal from './components/modal/ConfirmModal';
import CharacterAndCvStyleModal from './features/scriptEditor/components/editor_page_modal/CharacterAndCvStyleModal';
import AppRouter from './routing/AppRouter'; 

const App: React.FC = () => {
  const { 
    currentView, 
    projects, 
    characters, 
    selectedProjectId, 
    isLoading, 
    allCvNames, 
    cvStyles,
    confirmModal,
    characterAndCvStyleModal,
    loadInitialData,
    navigateTo,
    addCharacter,
    editCharacter,
    closeConfirmModal,
    closeCharacterAndCvStyleModal,
  } = useStore();
  
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSaveFromUnifiedModal = useCallback((
    characterData: Character,
    cvName: string,
    cvBgColor: string,
    cvTextColor: string
  ) => {
    const isNewCharacter = !characterAndCvStyleModal.characterToEdit || !characterAndCvStyleModal.characterToEdit.id;
    if (isNewCharacter) {
      // addCharacter is sync and returns the new character with an ID
      const newChar = addCharacter(characterData);
      // editCharacter can then be used to properly set CV and other details that might involve async updates
      editCharacter(newChar, cvName, cvBgColor, cvTextColor);
    } else {
      editCharacter(characterData, cvName, cvBgColor, cvTextColor);
    }
    closeCharacterAndCvStyleModal();
  }, [characterAndCvStyleModal.characterToEdit, addCharacter, editCharacter, closeCharacterAndCvStyleModal]);


  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900">
      <header className="bg-slate-800 text-white p-3 shadow-md flex-shrink-0 border-b border-slate-700 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-sky-400">AI 有声内容创作</h1>
        <nav className="space-x-3">
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
          {currentView !== "cvManagement" && characters.length > 0 && (
             <button onClick={() => navigateTo("cvManagement")} className="text-sm text-sky-300 hover:text-sky-100">CV管理</button>
          )}
          {currentView !== "voiceLibrary" && projects.length > 0 && (
             <button onClick={() => navigateTo("voiceLibrary")} className="text-sm text-sky-300 hover:text-sky-100">音色库</button>
          )}
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
          allCvNames={allCvNames}
          cvStyles={cvStyles}
        />
      )}
    </div>
  );
};

export default App;