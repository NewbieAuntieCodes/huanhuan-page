import React, { useState, useRef, useEffect } from 'react';
import { UserPlusIcon, ArrowPathIcon, ArrowsRightLeftIcon, MagnifyingGlassIcon, EllipsisVerticalIcon, TrashIcon } from '../../../../components/ui/icons';
import { CharacterFilterMode } from '../../../../types'; 

interface CharacterListHeaderControlsProps {
  filterMode: CharacterFilterMode;
  onSetFilterMode: (mode: CharacterFilterMode) => void;
  onAddNewCharacter: () => void;
  selectedCharacterIdsForMerge: string[];
  onMergeSelectedCharacters: () => void;
  canUndoMerge: boolean;
  onUndoLastMerge: () => void;
  onBatchDeleteCharacters: () => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

const CharacterListHeaderControls: React.FC<CharacterListHeaderControlsProps> = ({
  filterMode,
  onSetFilterMode,
  onAddNewCharacter,
  selectedCharacterIdsForMerge,
  onMergeSelectedCharacters,
  canUndoMerge,
  onUndoLastMerge,
  onBatchDeleteCharacters,
  searchTerm,
  onSearchTermChange,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showNoMoreOperations = !canUndoMerge && selectedCharacterIdsForMerge.length === 0;

  return (
    <div className="mb-3 flex-shrink-0 space-y-3">
       <div className="flex space-x-2">
        <button
          onClick={() => onSetFilterMode('currentChapter')}
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
            filterMode === 'currentChapter'
              ? 'bg-sky-600 text-white font-semibold'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          aria-pressed={filterMode === 'currentChapter'}
          title="仅显示当前选定章节中出现的角色"
        >
          本章角色
        </button>
        <button
          onClick={() => onSetFilterMode('all')}
          className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
            filterMode === 'all'
              ? 'bg-sky-600 text-white font-semibold'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          aria-pressed={filterMode === 'all'}
          title="显示项目中的所有角色"
        >
          所有角色
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="搜索角色..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full h-9 py-1.5 pl-9 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500 focus:border-sky-500 text-sm"
            aria-label="搜索角色"
          />
        </div>
        
        <button
            onClick={onAddNewCharacter}
            className="flex-shrink-0 flex items-center justify-center px-2.5 py-1.5 h-9 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors"
            title="添加新角色"
        >
            <UserPlusIcon className="w-4 h-4 mr-1" /> 添加
        </button>
        <button
            onClick={onMergeSelectedCharacters}
            disabled={selectedCharacterIdsForMerge.length < 2}
            className="flex-shrink-0 flex items-center justify-center px-2.5 py-1.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
            title={selectedCharacterIdsForMerge.length < 2 ? "至少选择两个角色进行合并" : "合并选中的角色"}
        >
            <ArrowsRightLeftIcon className="w-4 h-4 mr-1" /> 合并
        </button>

        <div className="relative flex-shrink-0" ref={moreMenuRef}>
            <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="flex items-center justify-center px-2.5 py-1.5 h-9 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-md text-xs font-medium transition-colors"
                title="更多操作"
            >
                <EllipsisVerticalIcon className="w-4 h-4 mr-1" /> 更多
            </button>
            {isMoreMenuOpen && (
                 <div className="absolute right-0 mt-2 w-48 bg-slate-700 rounded-md shadow-lg z-20 border border-slate-600 text-sm">
                    <ul className="p-1 space-y-1">
                        {canUndoMerge && (
                            <li>
                                <button
                                    onClick={() => { onUndoLastMerge(); setIsMoreMenuOpen(false); }}
                                    className="w-full flex items-center px-3 py-1.5 text-left text-slate-200 hover:bg-slate-600 rounded-md"
                                >
                                    <ArrowPathIcon className="w-4 h-4 mr-2" /> 撤销合并
                                </button>
                            </li>
                        )}
                        <li>
                            <button
                                onClick={() => { onBatchDeleteCharacters(); setIsMoreMenuOpen(false); }}
                                disabled={selectedCharacterIdsForMerge.length === 0}
                                className="w-full flex items-center px-3 py-1.5 text-left rounded-md transition-colors text-red-300 hover:bg-red-800/50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                                title={selectedCharacterIdsForMerge.length === 0 ? "请先勾选要删除的角色" : "删除所有选中的角色"}
                            >
                                <TrashIcon className="w-4 h-4 mr-2" /> 批量删除
                            </button>
                        </li>
                         {showNoMoreOperations && (
                             <li>
                                <span className="px-3 py-1.5 text-xs text-slate-500 block">无更多操作</span>
                             </li>
                        )}
                    </ul>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CharacterListHeaderControls;