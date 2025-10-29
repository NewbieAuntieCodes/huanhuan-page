import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../../../store/useStore';
import { Character } from '../../../../types';
import { XMarkIcon, ChevronUpDownIcon } from '../../../../components/ui/icons';
import CharacterSelectorDropdown from '../script_editor_panel/CharacterSelectorDropdown';
import { isHexColor } from '../../../../lib/colorUtils';

interface ShortcutSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    allCharacters: Character[];
    characterIdsInChapter: Set<string>; // Can be empty set
}

const keysToConfigure = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
    'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p',
    'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',
    'z', 'x', 'c', 'v', 'b', 'n', 'm'
];

const ShortcutSettingsModal: React.FC<ShortcutSettingsModalProps> = ({ isOpen, onClose, allCharacters, characterIdsInChapter }) => {
    const storeShortcuts = useStore(state => state.characterShortcuts);
    const setCharacterShortcuts = useStore(state => state.setCharacterShortcuts);
    
    const [localShortcuts, setLocalShortcuts] = useState<Record<string, string>>(storeShortcuts);
    const [assigningForKey, setAssigningForKey] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setLocalShortcuts(storeShortcuts);
        }
    }, [isOpen, storeShortcuts]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setAssigningForKey(null);
          }
        };
        if (assigningForKey) {
          document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, [assigningForKey]);


    const handleSave = () => {
        setCharacterShortcuts(localShortcuts);
        onClose();
    };
    
    const handleAssignCharacter = (key: string, charId: string) => {
        setLocalShortcuts(prev => ({...prev, [key]: charId}));
        setAssigningForKey(null);
    }
    
    const handleClearShortcut = (key: string) => {
        const newShortcuts = {...localShortcuts};
        delete newShortcuts[key];
        setLocalShortcuts(newShortcuts);
    }

    const characterMap = useMemo(() => {
        return new Map(allCharacters.map(c => [c.id, c]));
    }, [allCharacters]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-850 p-6 rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col border border-slate-700">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-2xl font-semibold text-slate-100">角色快捷键设置</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-white"><XMarkIcon /></button>
                </div>

                <div className="flex-grow overflow-y-auto pr-4 -mr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                        {keysToConfigure.map(key => {
                            const assignedCharId = localShortcuts[key];
                            const character = assignedCharId ? characterMap.get(assignedCharId) : null;
                            
                            const getStyle = () => {
                                if (!character) return { className: 'bg-slate-700 hover:bg-slate-600 text-slate-200' };
                                const bgIsHex = isHexColor(character.color);
                                return {
                                  style: { ...(bgIsHex && { backgroundColor: character.color }) },
                                  className: `${bgIsHex ? '' : character.color}`
                                };
                            };
                            const appliedStyle = getStyle();

                            return (
                                <div key={key} className="flex items-center gap-3 relative">
                                    <span className="font-mono text-lg bg-slate-900 px-3 py-1.5 rounded-md w-12 text-center text-sky-300">{key.toUpperCase()}</span>
                                    <div className="flex-grow relative" ref={assigningForKey === key ? dropdownRef : null}>
                                        <button 
                                            onClick={() => setAssigningForKey(key)}
                                            className={`w-full flex items-center justify-between p-2 text-sm rounded-md border border-slate-600 ${appliedStyle.className}`}
                                            style={appliedStyle.style}
                                        >
                                            <span className="truncate">{character ? character.name : '未分配'}</span>
                                            <ChevronUpDownIcon className="w-4 h-4 flex-shrink-0 ml-1 opacity-70" />
                                        </button>

                                        {assigningForKey === key && (
                                            <div className="absolute z-10 mt-1 w-full">
                                                <CharacterSelectorDropdown
                                                    characters={allCharacters}
                                                    characterIdsInChapter={characterIdsInChapter}
                                                    currentLineCharacterId={null}
                                                    onSelectCharacter={(charId) => handleAssignCharacter(key, charId)}
                                                    onClose={() => setAssigningForKey(null)}
                                                    showMergeOption={false}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {character && (
                                        <button 
                                            onClick={() => handleClearShortcut(key)}
                                            className="p-1.5 text-slate-500 hover:text-red-400"
                                            title={`清除 ${key.toUpperCase()} 的快捷键`}
                                        >
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex justify-end pt-4 mt-4 border-t border-slate-700 flex-shrink-0 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md">
                        取消
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
                        保存并关闭
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShortcutSettingsModal;
