import React, { useState, useEffect, useRef } from 'react';
import { ScriptLine, Character } from '../../../../types';
import { UserCircleIcon, MagnifyingGlassIcon } from '../../../../components/ui/icons';
import { isHexColor, getContrastingTextColor } from '../../../../lib/colorUtils';

interface ScriptLineItemProps {
  line: ScriptLine;
  characters: Character[];
  onUpdateText: (lineId: string, newText: string) => void;
  onAssignCharacter: (lineId: string, characterId: string) => void;
  onMergeLines: (lineId: string) => void;
  onOpenCvModalForCharacter: (character: Character) => void; // This will open the unified modal
  cvStyles: Record<string, { bgColor: string, textColor: string }>;
  isFocusedForSplit?: boolean; 
  onFocusChange: (lineId: string | null) => void; 
}

const isDialogue = (text: string): boolean => {
  const trimmedText = text.trim();
  const dialogueQuotes = [
    { start: '“', end: '”' }, // Chinese
    { start: '"', end: '"' },  // English
    { start: '「', end: '」' }, // Japanese
  ];
  return dialogueQuotes.some(q => trimmedText.startsWith(q.start) && trimmedText.endsWith(q.end));
};

const ScriptLineItem: React.FC<ScriptLineItemProps> = ({
  line,
  characters,
  onUpdateText,
  onAssignCharacter,
  onMergeLines,
  onOpenCvModalForCharacter, // Renamed from onOpenCvModalForCharacterLine for consistency
  cvStyles,
  onFocusChange,
}) => {
  const character = characters.find(c => c.id === line.characterId);
  const isCharacterMissing = line.characterId && !character;
  const isSilentLine = character && character.name === '[静音]';

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus the search input when dropdown opens
      setTimeout(() => searchInputRef.current?.focus(), 0); 
    } else {
      setSearchTerm(''); // Reset search on close
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const filteredCharacters = characters.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    if (newText !== line.text) {
      onUpdateText(line.id, newText);
    }
    // Delay blur slightly to allow other interactions (like split button) to register if needed
    // This specific timeout might not be strictly necessary for the split button if it relies on context state
    // which is updated on focus.
    setTimeout(() => {
        if (document.activeElement !== e.target) { // Check if focus truly moved away from this element
             onFocusChange(null);
        }
    }, 150); 
  };

  const isCurrentLineDialogue = isDialogue(line.text);
  let contentEditableStyle: React.CSSProperties = {};
  let contentEditableClasses = 'flex-grow p-2 rounded-md min-h-[40px] focus:ring-1 focus:ring-sky-500 outline-none whitespace-pre-wrap'; // Added whitespace-pre-wrap

  if (isSilentLine) {
    contentEditableClasses += ' bg-slate-800 text-slate-500 italic';
  } else if (isCurrentLineDialogue && character) {
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
    } else { // No charText defined
      if (isHexColor(charBg)) { 
        contentEditableStyle.color = getContrastingTextColor(charBg);
      } else { // charBg is a class, derive text based on common Tailwind dark shades
        const darkBgPatterns = ['-700', '-800', '-900', 'slate-600', 'gray-600']; // Add more as needed
        const isDarkBg = charBg && darkBgPatterns.some(pattern => charBg.includes(pattern));
        contentEditableClasses += isDarkBg ? ' text-slate-100' : ' text-slate-800'; // Default to dark text for lighter unknown BGs
      }
    }
  } else { 
    contentEditableClasses += ' bg-slate-700 text-slate-100';
  }
  
  return (
    <div className={`p-3 mb-2 rounded-lg border flex items-start gap-3 transition-all duration-150 ${isSilentLine ? 'border-slate-800 opacity-70' : 'border-slate-700'} hover:border-slate-600 ${line.isAiAudioLoading ? 'opacity-70' : ''}`}>
      
      <div className="flex-shrink-0 w-48 space-y-1">
        <div className="flex items-center space-x-1 w-full">
          {character ? (
            isSilentLine ? (
                <span
                    title="静音行"
                    className="flex-shrink-0 flex items-center justify-center text-xs px-1.5 py-2 h-9 rounded truncate max-w-[80px] bg-slate-700/60 text-slate-500"
                >
                    <UserCircleIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                    <span className="truncate">静音</span>
                </span>
            ) : (
                <button
                    onClick={() => onOpenCvModalForCharacter(character)} // Opens unified modal
                    title={character.cvName ? `CV: ${character.cvName} (编辑CV与角色样式)` : `为角色 ${character.name} 添加CV并编辑样式`}
                    className={`flex-shrink-0 flex items-center justify-center text-xs px-1.5 py-2 h-9 rounded truncate max-w-[80px] ${cvButtonAppliedStyle.className}`}
                    style={cvButtonAppliedStyle.style}
                    aria-label={`编辑角色 ${character.name} 的CV与样式`}
                >
                    <UserCircleIcon className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                    <span className="truncate">{cvButtonText}</span>
                </button>
            )
          ) : (
            <div className="w-[80px] h-9 flex-shrink-0"></div> 
          )}
          <div className="relative flex-grow min-w-[80px]" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full p-2 text-sm text-left rounded-md border outline-none focus:ring-2 focus:ring-sky-500 h-9 flex items-center justify-between ${charSelectAppliedStyle.className} border-slate-600`}
              style={charSelectAppliedStyle.style}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
            >
              <span className="truncate">
                {isCharacterMissing ? '待识别角色' : character?.name || '分配角色...'}
              </span>
               <svg className="w-4 h-4 text-current opacity-70 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-slate-800 rounded-md shadow-lg border border-slate-600 max-h-96 flex flex-col">
                <div className="p-2 sticky top-0 bg-slate-800 border-b border-slate-700">
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <MagnifyingGlassIcon className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="搜索..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full p-1.5 pl-8 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500 focus:border-sky-500 text-sm"
                      />
                  </div>
                </div>
                <ul role="listbox" className="overflow-y-auto">
                  {character && !isSilentLine && (
                    <li
                      role="option"
                      onClick={() => {
                        onMergeLines(line.id);
                        setIsDropdownOpen(false);
                      }}
                      className="px-3 py-2 text-sm text-indigo-200 bg-indigo-600 hover:bg-indigo-500 cursor-pointer font-semibold"
                    >
                      [合并相邻同角色行]
                    </li>
                  )}
                  <li
                      role="option"
                      onClick={() => {
                          onAssignCharacter(line.id, ''); // Assign to Narrator/Unassigned
                          setIsDropdownOpen(false);
                      }}
                      className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-600 cursor-pointer"
                  >
                      分配角色...
                  </li>
                  {isCharacterMissing && (
                     <li role="option" className="px-3 py-2 text-sm bg-orange-700 text-orange-100 font-bold cursor-default">待识别角色</li>
                  )}
                  {filteredCharacters.map(c => {
                    const optionBgIsHex = isHexColor(c.color);
                    const optionTextIsHex = isHexColor(c.textColor || '');
                    const style = {
                        backgroundColor: optionBgIsHex ? c.color : undefined, 
                        color: optionTextIsHex ? c.textColor : undefined 
                    };
                    const className = `hover:opacity-80 ${optionBgIsHex ? '' : c.color} ${optionTextIsHex ? '' : c.textColor || 'text-slate-100'}`;

                    return (
                      <li
                        key={c.id}
                        role="option"
                        aria-selected={line.characterId === c.id}
                        onClick={() => {
                          onAssignCharacter(line.id, c.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`px-3 py-2 text-sm cursor-pointer ${className}`}
                        style={style}
                      >
                        {c.name}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-grow flex flex-col">
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
      </div>
      
    </div>
  );
};

export default ScriptLineItem;