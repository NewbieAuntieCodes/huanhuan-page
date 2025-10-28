import React, { useState, useEffect } from 'react';
import { Character } from '../../../types';

export type ShiftMode = 'cv' | 'character' | 'chapter';

interface ShiftUpAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (shiftMode: ShiftMode) => void;
  character: Character | undefined;
}

const ShiftUpAudioModal: React.FC<ShiftUpAudioModalProps> = ({ isOpen, onClose, onConfirm, character }) => {
  const [shiftMode, setShiftMode] = useState<ShiftMode>('cv');
  
  const cvName = character?.cvName;
  const charName = character?.name;

  useEffect(() => {
    if (isOpen) {
      if (cvName) {
        setShiftMode('cv');
      } else if (charName) {
        setShiftMode('character');
      } else {
        setShiftMode('chapter');
      }
    }
  }, [isOpen, cvName, charName]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(shiftMode);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-slate-100">向上顺移音频</h2>
        <p className="text-sm text-slate-300 mb-6">
          这将导致下一句符合条件的台词的音频，被移动到当前行。后续音频会依次向上移动，而此操作链条中的最后一句台词将变为空音频。请选择顺移模式：
        </p>

        <div className="space-y-4">
          <label htmlFor="shift-up-cv" className={`flex items-start p-3 rounded-md transition-colors ${cvName ? 'bg-slate-700 hover:bg-slate-600 cursor-pointer' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}>
            <input
              type="radio"
              id="shift-up-cv"
              name="shift-up-mode"
              value="cv"
              checked={shiftMode === 'cv'}
              onChange={() => setShiftMode('cv')}
              disabled={!cvName}
              className="h-5 w-5 mt-0.5 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className={`font-medium ${cvName ? 'text-slate-200' : 'text-slate-500'}`}>按 CV 顺移</span>
              <p className={cvName ? 'text-slate-400' : 'text-slate-500'}>
                {cvName ? `仅向上顺移后续由 ${cvName} 配音的台词音频。` : '(当前角色未分配CV)'}
              </p>
            </div>
          </label>
          
          <label htmlFor="shift-up-char" className={`flex items-start p-3 rounded-md transition-colors ${charName ? 'bg-slate-700 hover:bg-slate-600 cursor-pointer' : 'bg-slate-700 opacity-50 cursor-not-allowed'}`}>
            <input
              type="radio"
              id="shift-up-char"
              name="shift-up-mode"
              value="character"
              checked={shiftMode === 'character'}
              onChange={() => setShiftMode('character')}
              disabled={!charName}
              className="h-5 w-5 mt-0.5 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className={`font-medium ${charName ? 'text-slate-200' : 'text-slate-500'}`}>按角色顺移</span>
              <p className={charName ? 'text-slate-400' : 'text-slate-500'}>
                {charName ? `仅向上顺移后续属于 ${charName} 的台词音频。` : '(当前行无角色)'}
              </p>
            </div>
          </label>

          <label htmlFor="shift-up-chapter" className="flex items-start p-3 bg-slate-700 hover:bg-slate-600 rounded-md cursor-pointer transition-colors">
            <input
              type="radio"
              id="shift-up-chapter"
              name="shift-up-mode"
              value="chapter"
              checked={shiftMode === 'chapter'}
              onChange={() => setShiftMode('chapter')}
              className="h-5 w-5 mt-0.5 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className="font-medium text-slate-200">按章节顺移</span>
              <p className="text-slate-400">向上顺移本章节内后续的所有台词音频。</p>
            </div>
          </label>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md">
            取消
          </button>
          <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
            确认顺移
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShiftUpAudioModal;