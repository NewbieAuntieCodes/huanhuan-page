
import React, { useState, useMemo, FormEvent } from 'react';
import { Character, Project, CVStyle, CVStylesMap } from '../../types';
import { isHexColor, getContrastingTextColor } from '../../lib/colorUtils';
import { tailwindToHex } from '../../lib/tailwindColorMap';
import { UserCircleIcon, PencilIcon, LockClosedIcon, LockOpenIcon, ChevronLeftIcon, MagnifyingGlassIcon, PaletteIcon } from '../../components/ui/icons';
import { useStore } from '../../store/useStore';

const CvManagementPage: React.FC = () => {
  const { 
    characters, 
    projects, 
    bulkUpdateCharacterStylesForCV, 
    toggleCharacterStyleLock, 
    openCharacterAndCvStyleModal,
    navigateTo,
    selectedProjectId
  } = useStore(state => ({
    characters: state.characters,
    projects: state.projects,
    bulkUpdateCharacterStylesForCV: state.bulkUpdateCharacterStylesForCV,
    toggleCharacterStyleLock: state.toggleCharacterStyleLock,
    openCharacterAndCvStyleModal: state.openCharacterAndCvStyleModal,
    navigateTo: state.navigateTo,
    selectedProjectId: state.selectedProjectId
  }));

  const [searchTerm, setSearchTerm] = useState('');
  const [editingCv, setEditingCv] = useState<{ name: string; bgColor: string; textColor: string } | null>(null);
  
  const currentProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  // FIX: Added an explicit return type to `useMemo` to ensure TypeScript correctly infers `projectCvNames` as `string[]`, fixing multiple subsequent errors.
  // FIX: Replaced `Array.from(new Set(...))` with a `reduce` operation to create the unique list of CV names. This approach is more robust for TypeScript's type inference.
  const projectData = useMemo<{ projectCharacters: Character[]; projectCvStyles: CVStylesMap; projectCvNames: string[] }>(() => {
    if (!currentProject) {
      return { projectCharacters: [], projectCvStyles: {}, projectCvNames: [] };
    }
    const projectCharacters = characters.filter(c => (!c.projectId || c.projectId === currentProject.id) && c.status !== 'merged');
    const projectCvStyles = currentProject.cvStyles || {};
    const projectCvNames = projectCharacters.reduce<string[]>((acc, c) => {
      if (c.cvName && !acc.includes(c.cvName)) {
        acc.push(c.cvName);
      }
      return acc;
    }, []).sort();
    return { projectCharacters, projectCvStyles, projectCvNames };
  }, [currentProject, characters]);

  const { projectCharacters, projectCvStyles, projectCvNames } = projectData;

  const filteredCvNames = useMemo(() => {
    if (!searchTerm.trim()) {
      return projectCvNames;
    }
    return projectCvNames.filter(cvName =>
      cvName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projectCvNames, searchTerm]);
  
  const onNavigateBack = () => {
    selectedProjectId ? navigateTo("editor") : navigateTo("dashboard");
  };

  const getStylePreview = (bgColorInput: string, textColorInput?: string | null) => {
    const bgIsHex = isHexColor(bgColorInput);
    const textIsHex = textColorInput ? isHexColor(textColorInput) : false;

    const style: React.CSSProperties = {};
    let className = 'px-2 py-0.5 rounded text-xs';

    if (bgIsHex) {
      style.backgroundColor = bgColorInput;
    } else {
      className += ` ${bgColorInput || 'bg-slate-700'}`;
    }

    if (textIsHex && textColorInput) {
      style.color = textColorInput;
    } else if (textColorInput) {
      className += ` ${textColorInput}`;
    } else if (bgIsHex) {
      style.color = getContrastingTextColor(bgColorInput);
    } else {
      className += ` text-slate-100`; 
    }
    return { style, className };
  };

  const calculateCharacterLineCount = (characterId: string): number => {
    if (!currentProject) return 0;
    let count = 0;
    currentProject.chapters.forEach(chapter => {
      chapter.scriptLines.forEach(line => {
        if (line.characterId === characterId) {
          count++;
        }
      });
    });
    return count;
  };

  const calculateCvStats = (cvName: string): { totalLines: number; totalWords: number } => {
    if (!currentProject) return { totalLines: 0, totalWords: 0 };
    let totalLines = 0;
    let totalWords = 0;
    const characterIdsForCv = projectCharacters
      .filter(c => c.cvName === cvName)
      .map(c => c.id);

    if (characterIdsForCv.length > 0) {
      currentProject.chapters.forEach(chapter => {
        chapter.scriptLines.forEach(line => {
          if (line.characterId && characterIdsForCv.includes(line.characterId)) {
            totalLines++;
            totalWords += line.text.length;
          }
        });
      });
    }
    return { totalLines, totalWords };
  };

  const handleStartEditing = (cvName: string, currentStyle: CVStyle) => {
    setEditingCv({
      name: cvName,
      bgColor: currentStyle.bgColor,
      textColor: currentStyle.textColor,
    });
  };

  const handleCancelEditing = () => {
    setEditingCv(null);
  };

  const handleSaveEditing = () => {
    if (editingCv) {
      bulkUpdateCharacterStylesForCV(editingCv.name, editingCv.bgColor, editingCv.textColor);
      setEditingCv(null);
    }
  };
  
  const handleColorInputChange = (type: 'bgColor' | 'textColor', value: string) => {
    if (editingCv) {
      setEditingCv(prev => ({ ...prev!, [type]: value }));
    }
  };

  const handleColorPickerChange = (type: 'bgColor' | 'textColor', e: FormEvent<HTMLInputElement>) => {
     if (editingCv) {
        const hexColor = e.currentTarget.value;
        if (type === 'bgColor') {
            setEditingCv({
                ...editingCv,
                bgColor: hexColor,
                textColor: getContrastingTextColor(hexColor)
            });
        } else {
            setEditingCv({ ...editingCv, textColor: hexColor });
        }
     }
  };

  const getColorAsHex = (colorValue: string, fallback: string): string => {
    if (isHexColor(colorValue)) return colorValue;
    return tailwindToHex[colorValue] || fallback;
  };

  if (!currentProject) {
    return (
      <div className="p-4 md:p-6 h-full flex flex-col items-center justify-center bg-slate-900 text-slate-100">
        <UserCircleIcon className="w-16 h-16 mx-auto text-slate-600 mb-4" />
        <h1 className="text-2xl font-bold text-sky-400 mb-4">CV 管理</h1>
        <p className="text-slate-400">请先从项目面板选择一个项目以管理其CV信息。</p>
        <button
          onClick={onNavigateBack}
          className="mt-6 flex items-center text-sm text-sky-300 hover:text-sky-100 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回项目面板
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col bg-slate-900 text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-sky-400">CV 管理: {currentProject.name}</h1>
        <button
          onClick={onNavigateBack}
          className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md"
          aria-label="返回"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回
        </button>
      </div>

      <div className="mb-6">
        <label htmlFor="cv-search" className="sr-only">搜索CV名称</label>
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
                type="text"
                id="cv-search"
                placeholder="搜索CV名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 pl-10 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500 focus:border-sky-500"
            />
        </div>
      </div>

      {projectCvNames.length === 0 ? (
        <div className="text-center py-10">
          <UserCircleIcon className="w-16 h-16 mx-auto text-slate-600 mb-4" />
          <p className="text-slate-400">此项目中尚无CV信息。请在编辑角色时添加CV。</p>
        </div>
      ) : filteredCvNames.length === 0 ? (
        <div className="text-center py-10">
            <MagnifyingGlassIcon className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <p className="text-slate-400">未找到匹配的CV名称 "{searchTerm}"。</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCvNames.map((cvName) => {
            const charactersForThisCv = projectCharacters.filter(c => c.cvName === cvName);
            const cvGlobalStyle = projectCvStyles[cvName] || { bgColor: 'bg-slate-700', textColor: 'text-slate-300' };
            const globalStylePreview = getStylePreview(cvGlobalStyle.bgColor, cvGlobalStyle.textColor);
            const cvStats = calculateCvStats(cvName);

            return (
              <section key={cvName} aria-labelledby={`cv-heading-${cvName}`} className="bg-slate-800 p-4 rounded-lg shadow-md">
                <div className="flex flex-wrap justify-between items-center mb-3 pb-3 border-b border-slate-700 gap-2">
                  <div className="flex items-baseline gap-x-2">
                    <h2 id={`cv-heading-${cvName}`} className="text-xl font-semibold text-sky-300">{cvName}</h2>
                    <span className="text-xs text-slate-400">
                      (总行数: {cvStats.totalLines}, 总字数: {cvStats.totalWords})
                    </span>
                  </div>
                  <button
                    onClick={() => bulkUpdateCharacterStylesForCV(cvName, cvGlobalStyle.bgColor, cvGlobalStyle.textColor)}
                    className="px-3 py-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors"
                    title={`将所有使用此CV且未锁定样式的角色，其样式统一为CV全局样式`}
                  >
                    统一角色样式
                  </button>
                </div>

                <div className="mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <strong>全局样式:</strong>
                    {editingCv?.name !== cvName && (
                      <>
                        <span className={`ml-2 ${globalStylePreview.className}`} style={globalStylePreview.style}>Aa</span>
                        <span className="ml-1 text-xs text-slate-400">
                          ({cvGlobalStyle.bgColor}, {cvGlobalStyle.textColor})
                        </span>
                        <button onClick={() => handleStartEditing(cvName, cvGlobalStyle)} className="p-1 text-slate-400 hover:text-sky-300" title="编辑全局样式">
                           <PencilIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                  {editingCv?.name === cvName && (
                    <div className="mt-2 p-3 bg-slate-700/50 rounded-md border border-slate-700 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">背景颜色</label>
                                <div className="flex items-center space-x-2">
                                    <input type="color" value={getColorAsHex(editingCv.bgColor, '#334155')} onInput={(e) => handleColorPickerChange('bgColor', e)} className="p-0.5 h-8 w-8 rounded border border-slate-600"/>
                                    <input type="text" value={editingCv.bgColor} onChange={(e) => handleColorInputChange('bgColor', e.target.value)} className="flex-grow p-1.5 text-xs bg-slate-900 rounded border border-slate-600"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">文字颜色</label>
                                <div className="flex items-center space-x-2">
                                    <input type="color" value={getColorAsHex(editingCv.textColor, '#CBD5E1')} onInput={(e) => handleColorPickerChange('textColor', e)} className="p-0.5 h-8 w-8 rounded border border-slate-600"/>
                                    <input type="text" value={editingCv.textColor} onChange={(e) => handleColorInputChange('textColor', e.target.value)} className="flex-grow p-1.5 text-xs bg-slate-900 rounded border border-slate-600"/>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                            <button onClick={handleCancelEditing} className="px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded">取消</button>
                            <button onClick={handleSaveEditing} className="px-3 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded">保存</button>
                        </div>
                    </div>
                  )}
                </div>


                <h3 className="text-md font-medium text-slate-300 mb-2">配音角色 ({charactersForThisCv.length}):</h3>
                {charactersForThisCv.length === 0 ? (
                  <p className="text-sm text-slate-400">该CV尚未分配给任何活动角色。</p>
                ) : (
                  <ul className="space-y-2">
                    {charactersForThisCv.map((char) => {
                      const charStylePreview = getStylePreview(char.color, char.textColor);
                      const isCharStyleDifferentFromGlobal = char.color !== cvGlobalStyle.bgColor || char.textColor !== cvGlobalStyle.textColor;
                      const charIsIndividuallyLocked = char.isStyleLockedToCv || false;
                      const charLineCount = calculateCharacterLineCount(char.id);

                      return (
                        <li key={char.id} className="flex items-center justify-between p-2 bg-slate-700/70 rounded-md group text-sm">
                          <div className="flex items-center">
                            <span className={`mr-2 ${charStylePreview.className}`} style={charStylePreview.style}>Aa</span>
                            <span className="font-medium text-slate-100">{char.name}</span>
                            <span className="ml-2 text-xs text-slate-400">({charLineCount} 行)</span>
                            {(charIsIndividuallyLocked || (!charIsIndividuallyLocked && isCharStyleDifferentFromGlobal)) && (
                               <span 
                                className={`ml-2 px-1.5 py-0.5 rounded text-[10px] opacity-80 border ${charIsIndividuallyLocked ? 'border-amber-500 text-amber-300' : 'border-slate-500 text-slate-300' }`}
                                title={charIsIndividuallyLocked ? `角色样式独立设置: ${char.color}, ${char.textColor || 'auto'}` : `角色样式与CV全局不同: ${char.color}, ${char.textColor || 'auto'}`}
                               >
                                {charIsIndividuallyLocked ? "独立" : "自身"}
                               </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => bulkUpdateCharacterStylesForCV(cvName, char.color, char.textColor || '')}
                              className="p-1 text-slate-400 hover:text-teal-400"
                              title={`将此角色的样式设为CV全局样式`}
                            >
                              <PaletteIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleCharacterStyleLock(char.id)}
                              className={`p-1 rounded-full transition-colors ${
                                charIsIndividuallyLocked ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-slate-200'
                              }`}
                              title={charIsIndividuallyLocked ? "角色样式已锁定独立 (点击以跟随CV全局样式)" : "角色样式跟随CV全局 (点击以锁定独立样式)"}
                              aria-pressed={charIsIndividuallyLocked}
                            >
                              {charIsIndividuallyLocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openCharacterAndCvStyleModal(char)}
                              className="p-1 text-slate-400 hover:text-sky-300"
                              title={`编辑角色 ${char.name} (包括其CV关联和样式)`}
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CvManagementPage;
