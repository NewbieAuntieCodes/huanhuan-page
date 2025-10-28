import React, { useMemo } from 'react';
import { Character, Project, Chapter } from '../../../../types';
import { PencilIcon, UserCircleIcon, BookOpenIcon, XMarkIcon } from '../../../../components/ui/icons';
import { isHexColor, getContrastingTextColor } from '../../../../lib/colorUtils';
// Fix: Import from types.ts to break circular dependency
import { CVStylesMap } from '../../../../types';

interface CharacterAppearance {
  chapterId: string;
  chapterTitle: string;
  lineCount: number;
}

interface CharacterDetailsSidePanelProps {
  character: Character | null;
  project: Project | null;
  onClose: () => void;
  onEditCharacter: (character: Character) => void; // Opens unified modal
  onEditCv: (character: Character) => void; // Also opens unified modal
  onSelectChapter: (chapterId: string) => void;
  cvStyles: CVStylesMap;
}

const CharacterDetailsSidePanel: React.FC<CharacterDetailsSidePanelProps> = ({
  character,
  project,
  onClose,
  onEditCharacter, // Will call handleOpenCharacterAndCvStyleModal
  onEditCv,       // Will also call handleOpenCharacterAndCvStyleModal
  onSelectChapter,
  cvStyles,
}) => {
  const characterAppearances = useMemo((): CharacterAppearance[] => {
    if (!character || !project || !project.chapters) return [];
    
    return project.chapters.reduce((acc, chapter) => {
      const count = chapter.scriptLines.filter(line => line.characterId === character.id).length;
      if (count > 0) {
        acc.push({ chapterId: chapter.id, chapterTitle: chapter.title, lineCount: count });
      }
      return acc;
    }, [] as CharacterAppearance[]);
  }, [character, project]);

  if (!character) {
    return null; 
  }

  // Character's own style
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

  // CV related styles from global cvStyles map
  const cvName = character.cvName;
  let globalCvBgColor = '';
  let globalCvTextColor = '';
  if (cvName && cvStyles[cvName]) {
    globalCvBgColor = cvStyles[cvName].bgColor;
    globalCvTextColor = cvStyles[cvName].textColor;
  } else if (cvName) { // CV name exists but no specific global style
    globalCvBgColor = 'bg-slate-700'; 
    globalCvTextColor = 'text-slate-300'; 
  }
  const cvBgIsHex = isHexColor(globalCvBgColor);
  const cvTextIsHex = isHexColor(globalCvTextColor);
  const cvBgStyle = cvBgIsHex ? { backgroundColor: globalCvBgColor } : {};
  let cvTextStyle = cvTextIsHex ? { color: globalCvTextColor } : {};
  
  const defaultCvButtonBgClass = 'bg-slate-600 hover:bg-slate-500';
  let defaultCvButtonTextColorClass = 'text-slate-200';
  let finalCvBgClass = !cvBgIsHex ? (globalCvBgColor || defaultCvButtonBgClass) : '';
  let finalCvTextClass = !cvTextIsHex ? (globalCvTextColor || '') : '';

  if (cvBgIsHex && (!globalCvTextColor || !isHexColor(globalCvTextColor))) {
    cvTextStyle = { color: getContrastingTextColor(globalCvBgColor) };
    finalCvTextClass = '';
  } else if (!globalCvTextColor && !cvTextIsHex && !cvName) {
    finalCvTextClass = defaultCvButtonTextColorClass;
  } else if (!globalCvTextColor && !cvTextIsHex && cvName && !cvStyles[cvName]){
     finalCvTextClass = defaultCvButtonTextColorClass;
  }
  const cvButtonText = cvName ? cvName : '未分配CV';


  return (
    <div className={`fixed top-0 right-0 h-full w-96 bg-slate-850 shadow-2xl text-slate-200
                     transform transition-transform duration-300 ease-in-out z-40 border-l border-slate-700
                     ${character ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex justify-between items-center p-5 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-sky-400 truncate" title={character.name}>
          角色: {character.name}
        </h2>
        <button 
          onClick={onClose} 
          className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-sky-300 hover:text-sky-100 transition-colors"
          aria-label="关闭角色详情"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-slate-800 p-5 h-[calc(100%-73px)] overflow-y-auto space-y-5">
        
        <section>
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-lg font-medium text-slate-300">基本信息</h3>
            <button 
              onClick={() => onEditCharacter(character)} // Opens unified modal
              className="flex items-center text-xs px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-md"
            >
              <PencilIcon className="w-3 h-3 mr-1" /> 编辑角色/CV
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <p><strong className="text-slate-400">名称:</strong> <span className="text-slate-100">{character.name}</span></p>
            <p><strong className="text-slate-400">描述:</strong> <span className="text-slate-100">{character.description || '无描述'}</span></p>
            <div className="flex items-center">
              <strong className="text-slate-400">角色样式:</strong>
              <span 
                className={`ml-2 px-3 py-1 rounded text-xs ${charBgClass} ${charTextClass}`} 
                style={{...charBgStyle, ...charTextStyle}}
              >
                Aa
              </span>
              <span className="ml-2 text-xs text-slate-500">({character.color}, {character.textColor || '自动'})</span>
               {character.isStyleLockedToCv && <span className="ml-2 text-xs text-amber-400">(独立样式)</span>}
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-lg font-medium text-slate-300">配音 (CV)</h3>
            <button 
              onClick={() => onEditCv(character)} // Also opens unified modal
              className="flex items-center text-xs px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md"
            >
              <UserCircleIcon className="w-3 h-3 mr-1" /> 编辑角色/CV
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <p><strong className="text-slate-400">CV名称:</strong> <span className="text-slate-100">{cvButtonText}</span></p>
            {cvName && (
              <div className="flex items-center">
                <strong className="text-slate-400">CV全局样式:</strong>
                <span 
                  className={`ml-2 px-3 py-1 rounded text-xs ${finalCvBgClass} ${finalCvTextClass}`}
                  style={{...cvBgStyle, ...cvTextStyle}}
                >
                  Aa
                </span>
                 <span className="ml-2 text-xs text-slate-500">({globalCvBgColor || 'N/A'}, {globalCvTextColor || '自动'})</span>
              </div>
            )}
             {!character.isStyleLockedToCv && cvName && (
                <p className="text-xs text-sky-300">角色样式当前跟随此CV的全局样式。</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-medium text-slate-300 mb-2.5">章节出场</h3>
          <div className="max-h-72 overflow-y-auto">
            {characterAppearances.length > 0 ? (
              <ul className="space-y-1.5">
                {characterAppearances.map(appearance => (
                  <li key={appearance.chapterId}>
                    <button
                      onClick={() => onSelectChapter(appearance.chapterId)}
                      className="w-full text-left flex items-center justify-between p-2.5 bg-slate-700 hover:bg-sky-600/70 rounded-md transition-colors duration-150 group"
                    >
                      <div className="flex items-center min-w-0">
                        <BookOpenIcon className="w-4 h-4 mr-2 text-sky-400 group-hover:text-sky-200 flex-shrink-0" />
                        <span className="text-sm text-slate-200 group-hover:text-white truncate" title={appearance.chapterTitle}>
                          {appearance.chapterTitle}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 group-hover:text-sky-200 flex-shrink-0 ml-2">
                        {appearance.lineCount} 行
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 text-center py-3">该角色尚未在任何章节中出现。</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CharacterDetailsSidePanel;
