import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Character, ScriptLine, CharacterFilterMode } from '../../../../types';
// DetailsModal and CvDetailsContent are no longer used here
// Fix: Import from types.ts to break circular dependency
import { CVStylesMap } from '../../../../types';
// FIX: Corrected import path for EditorContext
import { useEditorContext } from '../../contexts/EditorContext';

import CharacterListHeaderControls from './CharacterListHeaderControls'; 
import CharacterListItemView from './CharacterListItemView'; 
import { useStore } from '../../../../store/useStore'; 
import MergeCharactersModal from '../editor_page_modal/MergeCharactersModal';

interface ControlsAndCharactersPanelProps {
  onDeleteCharacter: (characterId: string) => void; 
  onToggleCharacterStyleLock: (characterId: string) => void;
  onBulkUpdateCharacterStylesForCV: (cvName: string, newBgColor: string, newTextColor: string) => void;
}

// Interface CharacterEditingContextForCvReturn is no longer needed

export const ControlsAndCharactersPanel: React.FC<ControlsAndCharactersPanelProps> = ({
  onDeleteCharacter,
  onToggleCharacterStyleLock,
  onBulkUpdateCharacterStylesForCV,
}) => {
  const {
    currentProject,
    // characters: charactersFromContext, // Sourced from Zustand store below
    cvStyles,   
    selectedChapterId,
    openCharacterSidePanel,
    openCvModal,
    openCharacterEditModal, 
    characterFilterMode, 
    setCharacterFilterMode, 
  } = useEditorContext();

  const storeCharacters = useStore(state => state.characters);
  const mergeHistory = useStore(state => state.mergeHistory);
  const mergeCharactersAction = useStore(state => state.mergeCharacters);
  const undoLastMergeAction = useStore(state => state.undoLastMerge);
  const deleteCharactersAction = useStore(state => state.deleteCharacters);
  const openConfirmModal = useStore(state => state.openConfirmModal);
  const [searchTerm, setSearchTerm] = useState('');

  // State for CV Details Modal is removed
  // const [isCvDetailsModalOpen, setIsCvDetailsModalOpen] = useState(false);
  // const [cvDetailsModalTitle, setCvDetailsModalTitle] = useState('');
  // const [currentCvNameForDetailsModal, setCurrentCvNameForDetailsModal] = useState<string | null>(null);
  // const [characterEditingContextForCvReturn, setCharacterEditingContextForCvReturn] = useState<CharacterEditingContextForCvReturn | null>(null);
  const [selectedCharacterIdsForMerge, setSelectedCharacterIdsForMerge] = useState<string[]>([]);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);


  const charactersToDisplay = useMemo(() => {
    let filteredChars = storeCharacters.filter(c => (!c.projectId || c.projectId === currentProject?.id) && c.status !== 'merged');
    
    if (characterFilterMode === 'currentChapter' && currentProject && selectedChapterId) {
      const chapter = currentProject.chapters.find(ch => ch.id === selectedChapterId);
      const characterIdsInChapter = new Set(
        chapter?.scriptLines.map(line => line.characterId).filter(Boolean) as string[]
      );
      filteredChars = filteredChars.filter(char => characterIdsInChapter.has(char.id));
    }

    if (searchTerm.trim() !== '') {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        filteredChars = filteredChars.filter(char => 
            char.name.toLowerCase().includes(lowercasedSearchTerm) ||
            (char.cvName && char.cvName.toLowerCase().includes(lowercasedSearchTerm))
        );
    }

    return filteredChars;
  }, [storeCharacters, characterFilterMode, currentProject, selectedChapterId, searchTerm]);


  // Effects and functions related to CV Details Modal are removed
  // useEffect(() => {
  //   if (!isCvDetailsModalOpen) {
  //     setCurrentCvNameForDetailsModal(null);
  //     setCharacterEditingContextForCvReturn(null);
  //   }
  // }, [isCvDetailsModalOpen]);
  
  // const editCharacterFromCvDetails = (char: Character, cvNameContext: string) => {
  //   setIsCvDetailsModalOpen(false); 
  //   setCharacterEditingContextForCvReturn({ characterId: char.id, originalCvName: cvNameContext });
  //   openCharacterEditModal(char); 
  // };

  // useEffect(() => {
  //   if (characterEditingContextForCvReturn && !isCvDetailsModalOpen && !document.querySelector('.fixed.inset-0.bg-black.bg-opacity-75')) { 
  //     const { originalCvName } = characterEditingContextForCvReturn;
  //     const charForCvContext = storeCharacters.find(c => c.cvName === originalCvName); 
      
  //     if (charForCvContext) {
  //       openCvDetailsModalAndSetContext(originalCvName, charForCvContext);
  //     }
  //     setCharacterEditingContextForCvReturn(null); 
  //   }
  // }, [characterEditingContextForCvReturn, isCvDetailsModalOpen, storeCharacters, openCharacterEditModal]);

  const handleAddNewCharacterClick = () => {
    openCharacterEditModal(null); 
  };

  // openCvDetailsModalAndSetContext is removed
  // const openCvDetailsModalAndSetContext = (cvNameFromButton: string, characterContext: Character) => {
  //   const actualCvName = characterContext.cvName || cvNameFromButton;
  //   if (!actualCvName) {
  //     alert("CV名称未设定，无法查看详情。");
  //     return;
  //   }
  //   setCurrentCvNameForDetailsModal(actualCvName);
  //   setCvDetailsModalTitle(`CV详情: ${actualCvName}`);
  //   setIsCvDetailsModalOpen(true);
  // };
  
  const handleToggleSelectForMerge = (characterId: string) => {
    setSelectedCharacterIdsForMerge(prev =>
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  const handleOpenMergeModal = () => {
    if (selectedCharacterIdsForMerge.length < 2) {
      alert("请至少选择两个角色进行合并。");
      return;
    }
    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = (targetCharacterId: string) => {
    const sourceIds = selectedCharacterIdsForMerge.filter(id => id !== targetCharacterId);
    if (sourceIds.length === 0 || !targetCharacterId) {
        alert("合并错误：必须有源角色和目标角色。");
        return;
    }
    mergeCharactersAction(sourceIds, targetCharacterId);
    setIsMergeModalOpen(false);
    setSelectedCharacterIdsForMerge([]);
  };

  const handleUndoLastMerge = () => {
    if (mergeHistory.length > 0) {
        undoLastMergeAction();
    } else {
        alert("没有可以撤销的合并操作。");
    }
  };

  const handleBatchDeleteCharacters = () => {
    if (selectedCharacterIdsForMerge.length === 0) {
        alert("请先勾选要删除的角色。");
        return;
    }

    openConfirmModal(
        `批量删除角色确认`,
        `您确定要删除选中的 ${selectedCharacterIdsForMerge.length} 个角色吗？\n所有项目中引用这些角色的台词行，其角色将被重置为“未分配”。此操作无法撤销。`,
        () => {
            deleteCharactersAction(selectedCharacterIdsForMerge);
            setSelectedCharacterIdsForMerge([]);
        },
        "确认删除",
        "取消"
    );
  };


  return (
    <div className="p-4 h-full flex flex-col bg-slate-800 text-slate-100">
      <CharacterListHeaderControls
        filterMode={characterFilterMode} 
        onSetFilterMode={setCharacterFilterMode} 
        onAddNewCharacter={handleAddNewCharacterClick} 
        selectedCharacterIdsForMerge={selectedCharacterIdsForMerge}
        onMergeSelectedCharacters={handleOpenMergeModal}
        canUndoMerge={mergeHistory.length > 0}
        onUndoLastMerge={handleUndoLastMerge}
        onBatchDeleteCharacters={handleBatchDeleteCharacters}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
      />
      
      <div className="flex-grow overflow-y-auto space-y-1.5 pr-1">
        {charactersToDisplay.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-3">
            {searchTerm.trim() ? `未找到匹配的角色 "${searchTerm}"。` : (characterFilterMode === 'currentChapter' ? '本章尚未分配角色。' : '项目中还没有角色。')}
          </p>
        ) : (
          charactersToDisplay.map(char => (
            <CharacterListItemView
              key={char.id}
              character={char}
              cvStyles={cvStyles} 
              onOpenCvModal={openCvModal} 
              // onOpenCvDetailsModal prop removed
              onOpenCharacterSidePanel={openCharacterSidePanel} 
              onEditCharacter={openCharacterEditModal} 
              onDeleteCharacter={onDeleteCharacter} 
              isSelectedForMerge={selectedCharacterIdsForMerge.includes(char.id)}
              onToggleSelectForMerge={handleToggleSelectForMerge}
            />
          ))
        )}
      </div>

      {/* CV Details Modal rendering is removed */}
      {/* {currentCvNameForDetailsModal && (
        <DetailsModal
          isOpen={isCvDetailsModalOpen}
          onClose={() => setIsCvDetailsModalOpen(false)}
          title={cvDetailsModalTitle}
        >
          <CvDetailsContent
            cvName={currentCvNameForDetailsModal}
            characters={storeCharacters} 
            cvStyles={cvStyles}    
            onToggleCharacterStyleLock={onToggleCharacterStyleLock} 
            onEditCharacterFromCvDetails={editCharacterFromCvDetails} 
            onBulkUpdateCharacterStylesForCV={onBulkUpdateCharacterStylesForCV} 
          />
        </DetailsModal>
      )} */}
      {isMergeModalOpen && selectedCharacterIdsForMerge.length > 0 && (
        <MergeCharactersModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          charactersToMerge={storeCharacters.filter(c => selectedCharacterIdsForMerge.includes(c.id))}
          onConfirmMerge={handleConfirmMerge}
        />
      )}
    </div>
  );
};