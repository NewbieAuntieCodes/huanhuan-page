import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Character } from '../../../../types';
import { isHexColor } from '../../../../lib/colorUtils';
import { useStore } from '../../../../store/useStore';
import { MagnifyingGlassIcon } from '../../../../components/ui/icons';

interface CharacterSelectorDropdownProps {
    characters: Character[];
    characterIdsInChapter: Set<string>;
    currentLineCharacterId: string | null | undefined;
    onSelectCharacter: (characterId: string) => void;
    onMergeLines?: () => void;
    onClose: () => void;
    showMergeOption?: boolean;
}

const CharacterSelectorDropdown: React.FC<CharacterSelectorDropdownProps> = ({
    characters,
    characterIdsInChapter,
    currentLineCharacterId,
    onSelectCharacter,
    onMergeLines,
    onClose,
    showMergeOption = true,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const shortcuts = useStore(s => s.characterShortcuts);

    const reversedShortcuts = useMemo(() => {
        const reversed: Record<string, string> = {};
        for (const key in shortcuts) {
          reversed[shortcuts[key]] = key;
        }
        return reversed;
    }, [shortcuts]);

    useEffect(() => {
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }, []);

    const { specialCharacters, chapterCharacters, otherCharacters } = useMemo(() => {
        const specialNamesOrder = ['[静音]', '音效', 'narrator']; // lowercase
        const specials: Character[] = [];
        const chapterChars: Character[] = [];
        const otherChars: Character[] = [];
        const lowerSearchTerm = searchTerm.toLowerCase();

        characters.forEach(c => {
            const lowerName = c.name.toLowerCase();
            const cvName = c.cvName?.toLowerCase() || '';
            const shortcut = reversedShortcuts[c.id] || '';

            if (searchTerm && !lowerName.includes(lowerSearchTerm) && !cvName.includes(lowerSearchTerm) && !shortcut.includes(lowerSearchTerm)) {
                return;
            }

            if (specialNamesOrder.includes(lowerName)) {
                specials.push(c);
            } else if (characterIdsInChapter.has(c.id)) {
                chapterChars.push(c);
            } else {
                otherChars.push(c);
            }
        });

        specials.sort((a, b) => specialNamesOrder.indexOf(a.name.toLowerCase()) - specialNamesOrder.indexOf(b.name.toLowerCase()));
        chapterChars.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        otherChars.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        
        return { specialCharacters: specials, chapterCharacters: chapterChars, otherCharacters: otherChars };
    }, [characters, searchTerm, characterIdsInChapter, reversedShortcuts]);

    const renderCharacterOption = (c: Character) => {
        const optionBgIsHex = isHexColor(c.color);
        const optionTextIsHex = isHexColor(c.textColor || '');
        const style = {
            backgroundColor: optionBgIsHex ? c.color : undefined,
            color: optionTextIsHex ? c.textColor : undefined,
        };
        let className = `w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors hover:opacity-80`;
        if (!optionBgIsHex) className += ` ${c.color}`;
        if (!optionTextIsHex) className += ` ${c.textColor || 'text-slate-100'}`;
        
        const shortcut = reversedShortcuts[c.id];

        return (
            <li
                key={c.id}
                role="option"
                aria-selected={currentLineCharacterId === c.id}
                onClick={() => onSelectCharacter(c.id)}
                className={className}
                style={style}
            >
                <span>{c.name}</span>
                {shortcut && <span className="ml-auto text-xs font-mono bg-black/20 px-1.5 py-0.5 rounded">{shortcut.toUpperCase()}</span>}
            </li>
        );
    };

    return (
        <div className="absolute z-20 mt-1 w-full bg-slate-800 rounded-md shadow-lg border border-slate-600 max-h-96 flex flex-col">
            <div className="p-2 sticky top-0 bg-slate-800 border-b border-slate-700 z-10">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="搜索角色、CV或快捷键..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-1.5 pl-8 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500 focus:border-sky-500 text-sm"
                    />
                </div>
            </div>
            <ul role="listbox" className="overflow-y-auto">
                {showMergeOption && onMergeLines && (
                    <li
                        role="option"
                        onClick={onMergeLines}
                        className="px-3 py-2 text-sm text-indigo-200 bg-indigo-600 hover:bg-indigo-500 cursor-pointer font-semibold sticky top-0 z-10"
                    >
                        [合并相邻同角色行]
                    </li>
                )}
                {specialCharacters.map(renderCharacterOption)}

                {(specialCharacters.length > 0 && (chapterCharacters.length > 0 || otherCharacters.length > 0)) && (
                    <li role="separator"><hr className="my-1 border-slate-600" /></li>
                )}

                {chapterCharacters.length > 0 && (
                    <>
                        <li role="separator" className="px-3 py-1 text-xs text-slate-400 font-semibold sticky top-0 bg-slate-800 z-10">
                            本章角色
                        </li>
                        {chapterCharacters.map(renderCharacterOption)}
                    </>
                )}

                {chapterCharacters.length > 0 && otherCharacters.length > 0 && (
                    <li role="separator"><hr className="my-1 border-slate-600" /></li>
                )}

                {otherCharacters.length > 0 && (
                    <>
                        <li role="separator" className="px-3 py-1 text-xs text-slate-400 font-semibold sticky top-0 bg-slate-800 z-10">
                            其他角色
                        </li>
                        {otherCharacters.map(renderCharacterOption)}
                    </>
                )}
                 {(chapterCharacters.length > 0 || otherCharacters.length > 0 || specialCharacters.length > 0) && (
                    <li role="separator"><hr className="my-1 border-slate-600" /></li>
                  )}
                  <li
                    role="option"
                    onClick={() => onSelectCharacter('')}
                    className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 cursor-pointer"
                  >
                    [取消分配]
                  </li>
            </ul>
        </div>
    );
};

export default CharacterSelectorDropdown;
