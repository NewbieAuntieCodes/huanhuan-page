import React, { useState, useEffect, FormEvent } from 'react';
import { Character, PresetColor } from '../../../../types';
import { isHexColor, getContrastingTextColor } from '../../../../lib/colorUtils';
import useStore from '../../../../store/useStore';
import { tailwindToHex } from '../../../../lib/tailwindColorMap';
// Fix: Import from types.ts to break circular dependency
import { CVStylesMap } from '../../../../types';

interface CharacterAndCvStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    characterData: Character,
    cvName: string,
    cvBgColor: string,
    cvTextColor: string
  ) => void;
  characterToEdit: Character | null; 
  allCvNames: string[];
  cvStyles: CVStylesMap;
}

const DEFAULT_CV_BG_CLASS = 'bg-slate-700'; 
const DEFAULT_CV_TEXT_CLASS = 'text-slate-300';

const CharacterAndCvStyleModal: React.FC<CharacterAndCvStyleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  characterToEdit,
  allCvNames,
  cvStyles,
}) => {
  const { cvColorPresets, characterColorPresets } = useStore();
  const defaultCharPreset = characterColorPresets.length > 0 ? characterColorPresets[0] : { bgColorClass: 'bg-rose-500', textColorClass: 'text-rose-100', name: 'Default' };
  
  const [charName, setCharName] = useState('');
  const [charDescription, setCharDescription] = useState('');
  
  const [charBgColorInput, setCharBgColorInput] = useState(defaultCharPreset.bgColorClass);
  const [charTextColorInput, setCharTextColorInput] = useState(defaultCharPreset.textColorClass);
  const [customCharBgInputText, setCustomCharBgInputText] = useState(defaultCharPreset.bgColorClass);
  const [customCharTextInputText, setCustomCharTextInputText] = useState(defaultCharPreset.textColorClass);

  const [cvNameInput, setCvNameInput] = useState('');
  const [cvBgColorInput, setCvBgColorInput] = useState(DEFAULT_CV_BG_CLASS);
  const [cvTextColorInput, setCvTextColorInput] = useState(DEFAULT_CV_TEXT_CLASS);
  const [customCvBgInputText, setCustomCvBgInputText] = useState(DEFAULT_CV_BG_CLASS);
  const [customCvTextInputText, setCustomCvTextInputText] = useState(DEFAULT_CV_TEXT_CLASS);
  
  const [isCharStyleLocked, setIsCharStyleLocked] = useState(false);

  useEffect(() => {
    // This effect initializes the form state whenever the character to edit changes.
    // It is intentionally not dependent on `isOpen` to prevent resetting user input
    // on re-renders while the modal is open.
    if (characterToEdit) {
      setCharName(characterToEdit.name);
      setCharDescription(characterToEdit.description || '');
      
      setCharBgColorInput(characterToEdit.color || defaultCharPreset.bgColorClass);
      setCharTextColorInput(characterToEdit.textColor || defaultCharPreset.textColorClass);
      setCustomCharBgInputText(characterToEdit.color || defaultCharPreset.bgColorClass);
      setCustomCharTextInputText(characterToEdit.textColor || defaultCharPreset.textColorClass);

      const currentCvName = characterToEdit.cvName || '';
      setCvNameInput(currentCvName);
      setIsCharStyleLocked(characterToEdit.isStyleLockedToCv || false);

      if (currentCvName && cvStyles[currentCvName]) {
        // If CV name exists and has a style, use it.
        setCvBgColorInput(cvStyles[currentCvName].bgColor);
        setCvTextColorInput(cvStyles[currentCvName].textColor);
        setCustomCvBgInputText(cvStyles[currentCvName].bgColor);
        setCustomCvTextInputText(cvStyles[currentCvName].textColor);
      } else {
        // If no CV or no style for CV, default CV style to character's own style.
        setCvBgColorInput(characterToEdit.color || defaultCharPreset.bgColorClass);
        setCvTextColorInput(characterToEdit.textColor || defaultCharPreset.textColorClass);
        setCustomCvBgInputText(characterToEdit.color || defaultCharPreset.bgColorClass);
        setCustomCvTextInputText(characterToEdit.textColor || defaultCharPreset.textColorClass);
      }
      
    } else { 
      // This block runs when the modal is opened for a *new* character (characterToEdit is null),
      // or when it's closed and characterToEdit becomes null.
      setCharName('');
      setCharDescription('');
      setCharBgColorInput(defaultCharPreset.bgColorClass);
      setCharTextColorInput(defaultCharPreset.textColorClass);
      setCustomCharBgInputText(defaultCharPreset.bgColorClass);
      setCustomCharTextInputText(defaultCharPreset.textColorClass);
      
      setCvNameInput('');
      setCvBgColorInput(DEFAULT_CV_BG_CLASS);
      setCvTextColorInput(DEFAULT_CV_TEXT_CLASS);
      setCustomCvBgInputText(DEFAULT_CV_BG_CLASS);
      setCustomCvTextInputText(DEFAULT_CV_TEXT_CLASS);
      setIsCharStyleLocked(false);
    }
  // We only want this to run when the character being edited changes, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterToEdit]);


  useEffect(() => {
    if (isOpen && !isCharStyleLocked) {
      setCharBgColorInput(cvBgColorInput);
      setCharTextColorInput(cvTextColorInput);
      setCustomCharBgInputText(cvBgColorInput);
      setCustomCharTextInputText(cvTextColorInput);
    }
  }, [isOpen, isCharStyleLocked, cvBgColorInput, cvTextColorInput]);


  const handleCharPresetColorClick = (preset: PresetColor) => {
    setCharBgColorInput(preset.bgColorClass);
    setCharTextColorInput(preset.textColorClass);
    setCustomCharBgInputText(preset.bgColorClass);
    setCustomCharTextInputText(preset.textColorClass);
    if (!isCharStyleLocked) setIsCharStyleLocked(true); 
  };

  const handleCharBgColorPickerChange = (e: FormEvent<HTMLInputElement>) => {
    const hexColor = e.currentTarget.value;
    setCharBgColorInput(hexColor);
    setCustomCharBgInputText(hexColor);
    const contrastingText = getContrastingTextColor(hexColor);
    setCharTextColorInput(contrastingText);
    setCustomCharTextInputText(contrastingText);
    if (!isCharStyleLocked) setIsCharStyleLocked(true);
  };
  
  const handleCharTextColorPickerChange = (e: FormEvent<HTMLInputElement>) => {
    const hexColor = e.currentTarget.value;
    setCharTextColorInput(hexColor);
    setCustomCharTextInputText(hexColor);
    if (!isCharStyleLocked) setIsCharStyleLocked(true);
  };

  const handleCustomCharBgInputChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim();
    setCustomCharBgInputText(value);
    setCharBgColorInput(value); 
    if (isHexColor(value)) {
        const contrastingText = getContrastingTextColor(value);
        setCharTextColorInput(contrastingText);
        setCustomCharTextInputText(contrastingText);
    }
    if (!isCharStyleLocked) setIsCharStyleLocked(true);
  };

  const handleCustomCharTextInputChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim();
    setCustomCharTextInputText(value);
    setCharTextColorInput(value);
    if (!isCharStyleLocked) setIsCharStyleLocked(true);
  };

  const handleCvNameChange = (e: FormEvent<HTMLInputElement>) => {
    const newNameRaw = e.currentTarget.value;
    setCvNameInput(newNameRaw);
    const newNameTrimmed = newNameRaw.trim();
    if (newNameTrimmed && cvStyles[newNameTrimmed]) {
      setCvBgColorInput(cvStyles[newNameTrimmed].bgColor);
      setCvTextColorInput(cvStyles[newNameTrimmed].textColor);
      setCustomCvBgInputText(cvStyles[newNameTrimmed].bgColor);
      setCustomCvTextInputText(cvStyles[newNameTrimmed].textColor);
    } else if (!newNameTrimmed) {
      setCvBgColorInput(DEFAULT_CV_BG_CLASS);
      setCvTextColorInput(DEFAULT_CV_TEXT_CLASS);
      setCustomCvBgInputText(DEFAULT_CV_BG_CLASS);
      setCustomCvTextInputText(DEFAULT_CV_TEXT_CLASS);
    }
  };

  const handleCvPresetColorClick = (preset: PresetColor) => {
    setCvBgColorInput(preset.bgColorClass);
    setCvTextColorInput(preset.textColorClass);
    setCustomCvBgInputText(preset.bgColorClass);
    setCustomCvTextInputText(preset.textColorClass);
  };
  
  const handleCvBgPickerChange = (e: FormEvent<HTMLInputElement>) => {
    const hexColor = e.currentTarget.value;
    setCvBgColorInput(hexColor);
    setCustomCvBgInputText(hexColor);
    const contrastingText = getContrastingTextColor(hexColor); 
    setCvTextColorInput(contrastingText);
    setCustomCvTextInputText(contrastingText);
  };
  
  const handleCvTextPickerChange = (e: FormEvent<HTMLInputElement>) => {
    const hexColor = e.currentTarget.value;
    setCvTextColorInput(hexColor);
    setCustomCvTextInputText(hexColor);
  };

  const handleCustomCvBgInputChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim();
    setCustomCvBgInputText(value);
    setCvBgColorInput(value);
     if (isHexColor(value)) { 
        const contrastingText = getContrastingTextColor(value);
        setCvTextColorInput(contrastingText);
        setCustomCvTextInputText(contrastingText);
    }
  };
  const handleCustomCvTextInputChange = (e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value.trim();
    setCustomCvTextInputText(value);
    setCvTextColorInput(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!charName.trim()) {
      alert("角色名称不能为空。");
      return;
    }
    
    let finalCharBg = charBgColorInput;
    let finalCharText = charTextColorInput;

    if (!isCharStyleLocked && cvNameInput.trim()) {
        finalCharBg = cvBgColorInput; 
        finalCharText = cvTextColorInput;
    }

    const characterDataToSave: Character = {
      id: characterToEdit ? characterToEdit.id : Date.now().toString() + "_newchar_" + Math.random(),
      name: charName.trim(),
      description: charDescription.trim(),
      color: finalCharBg,
      textColor: finalCharText,
      cvName: cvNameInput.trim(),
      isStyleLockedToCv: isCharStyleLocked,
      status: characterToEdit ? characterToEdit.status : 'active',
      projectId: characterToEdit?.projectId,
    };

    onSave(characterDataToSave, cvNameInput.trim(), cvBgColorInput, cvTextColorInput);
    onClose();
  };

  if (!isOpen) return null;

  const getColorAsHex = (colorValue: string, fallback: string): string => {
    if (isHexColor(colorValue)) {
      return colorValue;
    }
    // Assumes colorValue is a Tailwind class if not a hex
    return tailwindToHex[colorValue] || fallback;
  };

  const charBgPickerValue = getColorAsHex(charBgColorInput, '#FFFFFF');
  const charTextColorPickerValue = getColorAsHex(charTextColorInput, '#000000');
  const cvBgColorPickerValue = getColorAsHex(cvBgColorInput, '#334155');
  const cvTextColorPickerValue = getColorAsHex(cvTextColorInput, '#CBD5E1');
  const cvDatalistId = `cv-names-unified-${characterToEdit?.id || 'new'}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <input 
            type="text" 
            id="charNameModalTop" 
            value={charName} 
            onChange={(e) => setCharName(e.target.value)}
            className="text-2xl font-semibold text-slate-100 bg-transparent border-b-2 border-slate-700 focus:border-sky-500 outline-none py-1 flex-grow mr-4" 
            placeholder="输入角色名称*"
            required 
          />
          <div className="flex space-x-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md">取消</button>
            <button type="button" onClick={handleSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">{characterToEdit ? '保存更改' : '添加角色'}</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto flex-grow">
          <fieldset className="border border-slate-700 p-4 rounded-md">
            <legend className="text-lg font-medium text-sky-400 px-2">角色描述</legend>
            <div>
              <label htmlFor="charDescription" className="block text-sm font-medium text-slate-300 mb-1 sr-only">角色描述</label>
              <textarea 
                id="charDescription" 
                value={charDescription} 
                onChange={(e) => setCharDescription(e.target.value)}
                rows={3}
                className="w-full p-2 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500 resize-y" 
                placeholder="输入角色描述（可选）"
              />
            </div>
          </fieldset>

          <fieldset className="border border-slate-700 p-4 rounded-md">
            <legend className="text-lg font-medium text-teal-400 px-2">CV (配音) 信息与全局样式</legend>
            <div className="mb-4">
              <label htmlFor="cvNameInput" className="block text-sm font-medium text-slate-300 mb-1">CV 名称</label>
              <input type="text" id="cvNameInput" list={cvDatalistId} value={cvNameInput} onChange={handleCvNameChange}
                className="w-full p-2 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500" placeholder="输入或选择CV名称"/>
              {allCvNames.length > 0 && <datalist id={cvDatalistId}>{allCvNames.map(name => <option key={name} value={name} />)}</datalist>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">CV 背景颜色 (全局)</label>
                <div className="flex items-center space-x-2">
                  <input type="color" value={cvBgColorPickerValue} onInput={handleCvBgPickerChange} className="p-0.5 h-9 w-9 rounded border border-slate-600"/>
                  <input type="text" value={customCvBgInputText} onChange={handleCustomCvBgInputChange} className="flex-grow p-2 text-sm bg-slate-700 rounded border border-slate-600"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">CV 文字颜色 (全局)</label>
                <div className="flex items-center space-x-2">
                  <input type="color" value={cvTextColorPickerValue} onInput={handleCvTextPickerChange} className="p-0.5 h-9 w-9 rounded border border-slate-600"/>
                  <input type="text" value={customCvTextInputText} onChange={handleCustomCvTextInputChange} className="flex-grow p-2 text-sm bg-slate-700 rounded border border-slate-600"/>
                </div>
              </div>
            </div>
            <div className="mt-3">
                <label className="block text-sm font-medium text-slate-300 mb-1">CV 预设颜色 (全局)</label>
                <div className="grid grid-cols-8 gap-1.5">
                {cvColorPresets.map(p => (
                    <button key={`cv-${p.name}`} type="button" onClick={() => handleCvPresetColorClick(p)}
                    className={`h-8 rounded flex items-center justify-center ${p.bgColorClass} ${ (cvBgColorInput === p.bgColorClass && cvTextColorInput === p.textColorClass) ? 'ring-2 ring-offset-1 ring-offset-slate-800 ring-teal-400' : 'hover:opacity-80'}`}
                    title={p.name}><span className={`text-xs font-bold ${p.textColorClass}`}>Aa</span></button>
                ))}
                </div>
            </div>
          </fieldset>

          <fieldset className="border border-slate-700 p-4 rounded-md">
            <legend className="text-lg font-medium text-rose-400 px-1">角色独立样式</legend>
            <div className="flex justify-between items-center mb-3"> 
                <div className="flex items-center">
                    <input type="checkbox" id="lockCharStyle" checked={isCharStyleLocked} onChange={(e) => setIsCharStyleLocked(e.target.checked)}
                        className="h-4 w-4 text-rose-500 bg-slate-700 border-slate-600 rounded focus:ring-rose-400 mr-2"/>
                    <label htmlFor="lockCharStyle" className="text-sm text-slate-300 select-none">
                        {isCharStyleLocked ? "样式已独立设置 (不受CV影响)" : "样式跟随CV (点击以独立设置)"}
                    </label>
                </div>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 ${!isCharStyleLocked ? 'opacity-60 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">角色背景颜色</label>
                <div className="flex items-center space-x-2">
                  <input type="color" value={charBgPickerValue} onInput={handleCharBgColorPickerChange} className="p-0.5 h-9 w-9 rounded border border-slate-600" disabled={!isCharStyleLocked}/>
                  <input type="text" value={customCharBgInputText} onChange={handleCustomCharBgInputChange} className="flex-grow p-2 text-sm bg-slate-700 rounded border border-slate-600" disabled={!isCharStyleLocked}/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">角色文字颜色</label>
                <div className="flex items-center space-x-2">
                  <input type="color" value={charTextColorPickerValue} onInput={handleCharTextColorPickerChange} className="p-0.5 h-9 w-9 rounded border border-slate-600" disabled={!isCharStyleLocked}/>
                  <input type="text" value={customCharTextInputText} onChange={handleCustomCharTextInputChange} className="flex-grow p-2 text-sm bg-slate-700 rounded border border-slate-600" disabled={!isCharStyleLocked}/>
                </div>
              </div>
            </div>
            <div className={`mt-3 ${!isCharStyleLocked ? 'opacity-60 pointer-events-none' : ''}`}>
                <label className="block text-sm font-medium text-slate-300 mb-1">角色预设颜色</label>
                <div className="grid grid-cols-8 gap-1.5">
                {characterColorPresets.map(p => (
                    <button key={`char-${p.name}`} type="button" onClick={() => handleCharPresetColorClick(p)}
                    className={`h-8 rounded flex items-center justify-center ${p.bgColorClass} ${ (charBgColorInput === p.bgColorClass && charTextColorInput === p.textColorClass && isCharStyleLocked) ? 'ring-2 ring-offset-1 ring-offset-slate-800 ring-rose-400' : 'hover:opacity-80'}`}
                    title={p.name} disabled={!isCharStyleLocked}><span className={`text-xs font-bold ${p.textColorClass}`}>Aa</span></button>
                ))}
                </div>
            </div>
             {!isCharStyleLocked && cvNameInput.trim() && (
                <p className="text-xs text-slate-400 mt-2">提示：当前角色样式已链接至CV "{cvNameInput.trim()}" 的全局样式。取消勾选上方“样式跟随CV”以独立编辑角色样式。</p>
            )}
            {!isCharStyleLocked && !cvNameInput.trim() && (
                <p className="text-xs text-slate-400 mt-2">提示：当前角色样式会跟随CV的全局样式（如果指定了CV）。取消勾选上方“样式跟随CV”以独立编辑。</p>
            )}
          </fieldset>
        </form>
      </div>
    </div>
  );
};

export default CharacterAndCvStyleModal;