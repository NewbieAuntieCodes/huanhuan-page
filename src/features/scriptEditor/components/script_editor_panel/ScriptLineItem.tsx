import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ScriptLine, Character } from '../../../../types';
import { UserCircleIcon, ChevronDownIcon, XMarkIcon } from '../../../../components/ui/icons';
import { isHexColor, getContrastingTextColor } from '../../../../lib/colorUtils';
import CharacterSelectorDropdown from './CharacterSelectorDropdown';

interface ScriptLineItemProps {
  line: ScriptLine;
  characters: Character[];
  characterIdsInChapter: Set<string>;
  onUpdateText: (lineId: string, newText: string) => void;
  onAssignCharacter: (lineId: string, characterId: string) => void;
  onMergeLines: (lineId: string) => void;
  onDelete: (lineId: string) => void;
  onOpenCvModalForCharacter: (character: Character) => void; // This will open the unified modal
  cvStyles: Record<string, { bgColor: string, textColor: string }>;
  isFocusedForSplit?: boolean; 
  onUpdateSoundType: (lineId: string, soundType: string) => void;
  onFocusChange: (lineId: string | null) => void; 
  shortcutActiveLineId: string | null;
  onActivateShortcutMode: (lineId: string | null) => void;
  customSoundTypes: string[];
  onAddCustomSoundType: (soundType: string) => void;
  onDeleteCustomSoundType: (soundType: string) => void;
}

const ScriptLineItem: React.FC<ScriptLineItemProps> = ({
  line,
  characters,
  characterIdsInChapter,
  onUpdateText,
  onAssignCharacter,
  onMergeLines,
  onDelete,
  onOpenCvModalForCharacter,
  cvStyles,
  onUpdateSoundType,
  onFocusChange,
  shortcutActiveLineId,
  onActivateShortcutMode,
  customSoundTypes,
  onAddCustomSoundType,
  onDeleteCustomSoundType,
}) => {
  const character = characters.find(c => c.id === line.characterId);
  const isCharacterMissing = line.characterId && !character;
  const isSilentLine = character && character.name === '[静音]';

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isSoundTypeDropdownOpen, setIsSoundTypeDropdownOpen] = useState(false);
  const soundTypeDropdownRef = useRef<HTMLDivElement>(null);
  
  const defaultSoundOptions = ['清除', 'OS', '电话音', '系统音', '广播'];
  const soundOptions = [...defaultSoundOptions, ...customSoundTypes, '自定义'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (soundTypeDropdownRef.current && !soundTypeDropdownRef.current.contains(event.target as Node)) {
        setIsSoundTypeDropdownOpen(false);
      }
    };
    if (isDropdownOpen || isSoundTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isSoundTypeDropdownOpen]);

  const getCharacterSelectStyle = () => {
    if (isSilentLine) {
        return { className: 'bg-slate-700/60 text-slate-500' };
    }
    if (isCharacterMissing) {
      return { className: 'bg-orange-400 text-orange-900' };
    }
    if (!character) return { className: 'bg-slate-600 text-slate-100' };
    const bgIsHex = isHexColor(character.color);
    const textIsHex = isHexColor(character.textColor || '');
    return {
      style: {
        ...(bgIsHex && { backgroundColor: character.color }),
        ...(textIsHex && { color: character.textColor }),
      },
      className: `${bgIsHex ? '' : character.color || 'bg-slate-600'} ${textIsHex ? '' : character.textColor || 'text-slate-100'}`,
    };
  };
  const charSelectAppliedStyle = getCharacterSelectStyle();

  const getCvButtonStyle = () => {
    if (!character) return { className: 'bg-black bg-opacity-25 hover:bg-opacity-40 text-slate-200' };
    
    const cvName = character.cvName;
    let cvBgToUse = ''; // Will be from global cvStyles
    let cvTextToUse = ''; // Will be from global cvStyles

    if (cvName && cvStyles[cvName]) {
      cvBgToUse = cvStyles[cvName].bgColor;
      cvTextToUse = cvStyles[cvName].textColor;
    } else if (cvName) { 
        cvBgToUse = 'bg-slate-700'; // Fallback display if CV name but no style
        cvTextToUse = 'text-slate-300';
    }
    
    const bgIsHex = isHexColor(cvBgToUse);
    const textIsHex = isHexColor(cvTextToUse);
    const defaultBgClass = 'bg-black bg-opacity-25 hover:bg-opacity-40';
    const defaultTextClass = 'text-slate-200';

    let finalBgClass = !bgIsHex ? (cvBgToUse || defaultBgClass) : '';
    let finalTextClass = !textIsHex ? (cvTextToUse || '') : '';

    if (bgIsHex && (!cvTextToUse || !isHexColor(cvTextToUse))) { // CV BG is hex, text is not or empty
        // Derive contrasting text color
        const contrasting = getContrastingTextColor(cvBgToUse);
        return { style: { backgroundColor: cvBgToUse, color: contrasting }, className: '' };
    } else if (!cvTextToUse && !textIsHex && !cvName){ // No text color, not hex, and no CV name (should be "Add CV" button)
        finalTextClass = defaultTextClass;
    } else if (!cvTextToUse && !textIsHex && cvName && !cvStyles[cvName]) { // CV name, no global style
        finalTextClass = defaultTextClass;
    }


    return {
      style: {
        ...(bgIsHex && { backgroundColor: cvBgToUse }),
        ...(textIsHex && { color: cvTextToUse }),
      },
      className: `${finalBgClass} ${finalTextClass}`,
    };
  };
  const cvButtonAppliedStyle = getCvButtonStyle();
  const cvButtonText = character?.cvName ? character.cvName : '添加CV';

  const handleDivFocus = () => {
    onFocusChange(line.id);
  };

  const handleDivBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerText;
    
    if (newText.trim() === '') {
        onDelete(line.id);
    } else if (newText !== line.text) {
      onUpdateText(line.id, newText);
    }
    
    setTimeout(() => {
        if (document.activeElement !== e.target) {
             onFocusChange(null);
        }
    }, 150); 
  };
  
  const isNarrator = !character || character.name === 'Narrator';
  
  let contentEditableStyle: React.CSSProperties = {};
  let contentEditableClasses = 'flex-grow p-2 rounded-md min-h-[40px] focus:ring-1 focus:ring-sky-500 outline-none whitespace-pre-wrap';

  if (isSilentLine) {
    contentEditableClasses += ' bg-slate-800 text-slate-500 italic';
  } else if (isNarrator) {
    contentEditableClasses += ' bg-slate-700 text-slate-100';
  } else if (character) {
    const charBg = character.color; 
    const charText = character.textColor; 

    if (isHexColor(charBg)) {
        contentEditableStyle.backgroundColor = charBg;
    } else {
        contentEditableClasses += ` ${charBg || 'bg-slate-700'}`; 
    }

    if (charText) {
        if (isHexColor(charText)) {
            contentEditableStyle.color = charText;
        } else { 
            contentEditableClasses += ` ${charText}`;
        }
    } else {
        if (isHexColor(charBg)) { 
            contentEditableStyle.color = getContrastingTextColor(charBg);
        } else {
            const darkBgPatterns = ['-700', '-800', '-900', 'slate-600', 'gray-600'];
            const isDarkBg = charBg && darkBgPatterns.some(pattern => charBg.includes(pattern));
            contentEditableClasses += isDarkBg ? ' text-slate-100' : ' text-slate-800';
        }
    }
  } else {
    contentEditableClasses += ' bg-slate-700 text-slate-100';
  }

  const handleToggleOS = () => {
    const newSoundType = line.soundType === 'OS' ? '' : 'OS';
    onUpdateSoundType(line.id, newSoundType);
  };
  
  const isLit = !!line.soundType && line.soundType !== '清除';


  const handleAddCustom = () => {
    const newSoundType = prompt("请输入新的音效类型:", "");
    if (newSoundType && newSoundType.trim() !== '') {
      onAddCustomSoundType(newSoundType.trim());
    }
    setIsSoundTypeDropdownOpen(false);
  };

  const isShortcutActive = shortcutActiveLineId === line.id;

  return (
    <div className={`p-3 mb-2 rounded-lg border flex items-center gap-3 transition-all duration-150 ${isSilentLine ? 'border-slate-800 opacity-70' : 'border-slate-700'} hover:border-slate-600 ${line.isAiAudioLoading ? 'opacity-70' : ''} ${isShortcutActive ? 'ring-2 ring-amber-400' : ''}`}>
      
      <div className="flex-shrink-0 w-48 space-y-1">
        <div className="flex items-center space-x-1 w-full">
          {character && !isSilentLine ? (
            <button
                onClick={() => onOpenCvModalForCharacter(character)}
                title={character.cvName ? `CV: ${character.cvName} (编辑CV与角色样式)` : `为角色 ${character.name} 添加CV并编辑样式`}
                className={`flex-shrink-0 flex items-center justify-center text-xs px-1.5 py-2 h-9 rounded truncate w-20 ${cvButtonAppliedStyle.className}`}
                style={cvButtonAppliedStyle.style}
                aria-label={`编辑角色 ${character.name} 的CV与样式`}
            >
                <UserCircleIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                <span className="truncate">{cvButtonText}</span>
            </button>
          ) : (
            <div className="w-20 h-9 flex-shrink-0"></div> 
          )}

          <div className="relative flex-grow min-w-[80px]" ref={dropdownRef}>
            <div className={`relative flex rounded-md border h-9 overflow-hidden ${isShortcutActive ? 'ring-2 ring-sky-400' : 'border-slate-600'}`}>
                <button
                    onClick={() => onActivateShortcutMode(line.id)}
                    title="点击激活快捷键模式"
                    className={`flex-grow p-2 text-sm text-left outline-none focus:z-10 flex items-center ${charSelectAppliedStyle.className}`}
                    style={charSelectAppliedStyle.style}
                >
                    <span className="truncate">
                        {isCharacterMissing ? '待识别角色' : character?.name || '分配角色...'}
                    </span>
                </button>
                <button
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    title="打开角色选择菜单"
                    className={`flex-shrink-0 px-1 outline-none focus:z-10 border-l border-black/20 ${charSelectAppliedStyle.className}`}
                    style={charSelectAppliedStyle.style}
                    aria-haspopup="listbox"
                    aria-expanded={isDropdownOpen}
                >
                    <ChevronDownIcon className="w-4 h-4 text-current opacity-70" />
                </button>
            </div>


            {isDropdownOpen && (
              <CharacterSelectorDropdown
                characters={characters}
                characterIdsInChapter={characterIdsInChapter}
                currentLineCharacterId={line.characterId}
                onSelectCharacter={(charId) => {
                    onAssignCharacter(line.id, charId);
                    setIsDropdownOpen(false);
                }}
                onMergeLines={() => {
                    onMergeLines(line.id);
                    setIsDropdownOpen(false);
                }}
                onClose={() => setIsDropdownOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      <div
          contentEditable
          suppressContentEditableWarning
          onFocus={handleDivFocus}
          onBlur={handleDivBlur}
          className={contentEditableClasses}
          style={contentEditableStyle}
          dangerouslySetInnerHTML={{ __html: line.text }}
          aria-label={`脚本行文本: ${line.text.substring(0,50)}... ${character ? `角色: ${character.name}` : '未分配角色'}`}
      />
      
      <div className="relative flex-shrink-0" style={{width: '6rem'}} ref={soundTypeDropdownRef}>
        <div className="flex w-full h-9 rounded-md border border-slate-600 overflow-hidden">
            <button
              onClick={handleToggleOS}
              className={`flex-grow h-full flex items-center justify-center px-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:z-10
                ${isLit ? 'bg-orange-500 text-white font-semibold' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
            >
              <span className="truncate">{line.soundType || 'OS'}</span>
            </button>
            <button
                onClick={() => setIsSoundTypeDropdownOpen(prev => !prev)}
                className={`flex-shrink-0 h-full flex items-center justify-center px-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:z-10 border-l 
                  ${isLit ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600'}`}
                aria-label="选择音效类型"
            >
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
        </div>

        {isSoundTypeDropdownOpen && (
          <div className="absolute z-20 mt-1 w-full bg-slate-800 rounded-md shadow-lg border border-slate-600 max-h-60 overflow-y-auto">
            <ul className="py-1">
              {soundOptions.map(option => {
                const isCustom = !defaultSoundOptions.includes(option) && option !== '自定义';
                const isSelected = (line.soundType === option || ((!line.soundType || line.soundType === '') && option === '清除'));

                const handleOptionClick = () => {
                  if (option === '自定义') {
                    handleAddCustom();
                  } else {
                    onUpdateSoundType(line.id, option === '清除' ? '' : option);
                    setIsSoundTypeDropdownOpen(false);
                  }
                };

                const handleDeleteClick = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (window.confirm(`确定要删除自定义音效 "${option}" 吗？所有使用此音效的行将被重置。`)) {
                    onDeleteCustomSoundType(option);
                  }
                };

                return (
                  <li key={option}
                      onClick={handleOptionClick}
                      className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer group ${isSelected ? 'bg-sky-600 text-white' : 'text-slate-200 hover:bg-slate-700'}`}
                  >
                    <span>{option}</span>
                    {isCustom && (
                      <button
                        onClick={handleDeleteClick}
                        className="p-1 -mr-2 rounded-full text-slate-500 group-hover:text-red-400 hover:bg-slate-600"
                        title={`删除 "${option}"`}
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
};

export default ScriptLineItem;
