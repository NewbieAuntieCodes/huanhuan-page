import React from 'react';
import { Character } from '../../../../types';
// Fix: Import from types.ts to break circular dependency
import { CVStylesMap } from '../../../../types';
import { isHexColor, getContrastingTextColor } from '../../../../lib/colorUtils';
import { UserCircleIcon, InformationCircleIcon, PencilIcon, TrashIcon } from '../../../../components/ui/icons';

interface CharacterListItemViewProps {
  character: Character;
  cvStyles: CVStylesMap;
  onOpenCvModal: (character: Character) => void; // This will now open the unified modal
  onOpenCharacterSidePanel: (character: Character) => void;
  onEditCharacter: (character: Character | null) => void; // This will also open the unified modal
  onDeleteCharacter: (characterId: string) => void;
  isSelectedForMerge: boolean;
  onToggleSelectForMerge: (characterId: string) => void;
}

const CharacterListItemView: React.FC<CharacterListItemViewProps> = ({
  character,
  cvStyles,
  onOpenCvModal, 
  onOpenCharacterSidePanel,
  onEditCharacter, 
  onDeleteCharacter,
  isSelectedForMerge,
  onToggleSelectForMerge,
}) => {
  const charBgIsHex = isHexColor(character.color);
  const charTextIsHex = isHexColor(character.textColor || '');

  const charBgStyle = charBgIsHex ? { backgroundColor: character.color } : {};
  let charTextStyle = charTextIsHex ? { color: character.textColor } : {};

  const charBgClass = !charBgIsHex ? character.color : '';
  let charTextClass = !charTextIsHex ? (character.textColor || '') : '';

  if (charBgIsHex && (!character.textColor || !isHexColor(character.textColor))) {
    charTextStyle = { color: getContrastingTextColor(character.color) };
    charTextClass = '';
  } else if (!character.textColor) {
    charTextClass = 'text-slate-100';
  }

  const cvName = character.cvName;
  let displayCvBgColor = ''; 
  let displayCvTextColor = ''; 

  if (cvName && cvStyles[cvName]) {
    displayCvBgColor = cvStyles[cvName].bgColor;
    displayCvTextColor = cvStyles[cvName].textColor;
  } else if (cvName) { 
    displayCvBgColor = 'bg-slate-700'; 
    displayCvTextColor = 'text-slate-300'; 
  }


  const cvButtonText = cvName ? cvName : '添加CV';
  const cvBgIsHex = isHexColor(displayCvBgColor);
  const cvTextIsHex = isHexColor(displayCvTextColor);

  const cvBgStyle = cvBgIsHex ? { backgroundColor: displayCvBgColor } : {};
  let cvTextStyle = cvTextIsHex ? { color: displayCvTextColor } : {};

  const defaultCvButtonBgClass = 'bg-slate-600 hover:bg-slate-500';
  let defaultCvButtonTextColorClass = 'text-slate-200';

  let finalCvBgClass = !cvBgIsHex ? (displayCvBgColor || defaultCvButtonBgClass) : '';
  let finalCvTextClass = !cvTextIsHex ? (displayCvTextColor || '') : '';

  if (cvBgIsHex && (!displayCvTextColor || !cvTextIsHex)) {
    cvTextStyle = { color: getContrastingTextColor(displayCvBgColor) };
    finalCvTextClass = '';
  } else if (!displayCvTextColor && !cvTextIsHex && !cvName) { 
    finalCvTextClass = defaultCvButtonTextColorClass;
  } else if (!displayCvTextColor && !cvTextIsHex && cvName && !cvStyles[cvName]) { 
     finalCvTextClass = defaultCvButtonTextColorClass;
  }


  return (
    <div
      className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-2 p-1.5 rounded-md transition-colors group
                  ${isSelectedForMerge ? 'bg-sky-700/30 ring-1 ring-sky-500' : 'hover:bg-slate-700/40'}`}
      role="listitem"
    >
      {/* Col 1: Checkbox */}
      <input
        type="checkbox"
        id={`char-select-merge-${character.id}`}
        checked={isSelectedForMerge}
        onChange={() => onToggleSelectForMerge(character.id)}
        className="form-checkbox h-4 w-4 text-sky-500 bg-slate-700 border-slate-600 rounded focus:ring-sky-400 cursor-pointer flex-shrink-0"
        aria-label={`选择角色 ${character.name} 进行合并`}
      />
      {/* Col 2: CV Button */}
      <div className="flex items-center flex-shrink-0 min-w-[90px] max-w-[130px]"> 
        <button
          onClick={() => onOpenCvModal(character)} 
          title={cvName ? `CV: ${cvName} (编辑CV与角色样式)` : `为角色 ${character.name} 添加CV并编辑样式`}
          className={`flex items-center text-sm px-2 py-1 rounded h-9 truncate w-full ${finalCvBgClass} ${finalCvTextClass}`}
          style={{ ...cvBgStyle, ...cvTextStyle }} 
          aria-label={`编辑 ${cvButtonText} 及 ${character.name} 的样式`}
        >
          <UserCircleIcon className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
          <span className="truncate">{cvButtonText}</span>
        </button>
      </div>

      {/* Col 3: Character Bar (without description) */}
      <div
        className={`p-2 rounded-md flex items-center ${charBgClass} ${charTextClass} gap-x-2 min-w-0 h-9 text-sm`}
        style={{ ...charBgStyle, ...charTextStyle }}
      >
        <span
          className="font-medium truncate"
          title={character.name}
        >
          {character.name}
        </span>
      </div>

      {/* Col 4: Action Buttons */}
      <div className="flex space-x-1 flex-shrink-0">
        <button
          onClick={() => onOpenCharacterSidePanel(character)}
          className="text-sm p-1 text-slate-400 hover:text-sky-300"
          title={`查看角色 ${character.name} 的详情`}
          aria-label={`查看角色 ${character.name} 的详情`}
        >
          <InformationCircleIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEditCharacter(character)} 
          className="text-sm p-1 text-slate-400 hover:text-sky-300"
          title={`编辑角色 ${character.name} 与CV样式`}
          aria-label={`编辑角色 ${character.name} 与CV样式`}
        >
          <PencilIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDeleteCharacter(character.id)}
          className="text-sm p-1 text-slate-400 hover:text-red-400"
          title={`删除角色 ${character.name}`}
          aria-label={`删除角色 ${character.name}`}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      
      {/* New Row for Description, aligned under Col 3 */}
      {character.description && (
        <p 
          className="col-start-3 col-span-2 text-base text-slate-200 mt-1 px-1 truncate" 
          title={character.description}
        >
          {character.description}
        </p>
      )}
    </div>
  );
};

export default CharacterListItemView;