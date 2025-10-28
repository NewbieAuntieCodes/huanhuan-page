import React, { useState, useEffect } from 'react';
import { Character } from '../../../../types';
import { isHexColor, getContrastingTextColor } from '../../../../lib/colorUtils';

interface MergeCharactersModalProps {
  isOpen: boolean;
  onClose: () => void;
  charactersToMerge: Character[];
  onConfirmMerge: (targetCharacterId: string) => void;
}

const MergeCharactersModal: React.FC<MergeCharactersModalProps> = ({
  isOpen,
  onClose,
  charactersToMerge,
  onConfirmMerge,
}) => {
  const [targetCharacterId, setTargetCharacterId] = useState<string>('');

  useEffect(() => {
    if (isOpen && charactersToMerge.length > 0) {
      setTargetCharacterId(charactersToMerge[0].id); // Default to the first selected character
    }
  }, [isOpen, charactersToMerge]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCharacterId) {
      alert("请选择一个目标角色。");
      return;
    }
    onConfirmMerge(targetCharacterId);
  };

  if (!isOpen) return null;

  const getCharacterDisplayInfo = (character: Character) => {
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
    return { style: { ...charBgStyle, ...charTextStyle }, className: `${charBgClass} ${charTextClass}` };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 overflow-y-auto">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg my-auto">
        <h2 className="text-2xl font-semibold mb-4 text-slate-100">合并角色</h2>
        <p className="text-sm text-slate-300 mb-1">您选择了以下 <strong className="text-sky-300">{charactersToMerge.length}</strong> 个角色进行合并：</p>
        <ul className="mb-4 space-y-1 text-sm max-h-40 overflow-y-auto pr-2">
            {charactersToMerge.map(char => {
                 const display = getCharacterDisplayInfo(char);
                 return (
                    <li key={char.id} className={`px-2 py-1 rounded ${display.className}`} style={display.style}>
                        {char.name} {char.cvName && `(CV: ${char.cvName})`}
                    </li>
                 );
            })}
        </ul>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="targetCharacter" className="block text-sm font-medium text-slate-300 mb-1">
              选择目标角色 (保留该角色，其他角色将被并入):
            </label>
            <select
              id="targetCharacter"
              value={targetCharacterId}
              onChange={(e) => setTargetCharacterId(e.target.value)}
              className="w-full p-3 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              {charactersToMerge.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.name} {char.cvName && `(CV: ${char.cvName})`}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            注意：源角色的脚本行将被分配给目标角色。源角色将被标记为“已合并”并从活动列表中隐藏。此操作可以通过“撤销合并”按钮恢复。
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!targetCharacterId}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              确认合并
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MergeCharactersModal;
