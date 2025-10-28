
import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../../../../types';
import { SparklesIcon, BookOpenIcon, UploadIcon, BoltIcon, UserCircleIcon, ArrowDownTrayIcon, ChevronDownIcon } from '../../../../components/ui/icons'; 
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { useEditorContext } from '../../contexts/EditorContext';
import { useStore } from '../../../../store/useStore';
import { AiProvider } from '../../../../store/slices/uiSlice';

// Define an interface for the expected return type of useChapterActions
interface ChapterActionsHookReturn {
  handleAiAnnotationClick: () => void;
  handleManualParseClick: () => void;
  handleOpenImportModal: () => void;
  getAnnotationButtonText: (baseText: string, forAi: boolean) => string;
  isProcessingDisabled: (forOperation: 'ai' | 'manual' | 'import') => boolean;
  isAnyOperationLoading: boolean;
}

interface ChapterListActionsProps {
  project: Project;
  onParseProject: () => void; // This is undoableParseProjectChapters
  chapterActions: ChapterActionsHookReturn; // Props from useChapterActions
  onOpenExportModal: () => void;
}

const providers: { key: AiProvider; name: string }[] = [
    { key: 'gemini', name: 'Gemini' },
    { key: 'openai', name: 'GPT' },
    { key: 'moonshot', name: 'Moonshot' },
    { key: 'deepseek', name: 'DeepSeek' },
];

const ChapterListActions: React.FC<ChapterListActionsProps> = ({
  project,
  onParseProject,
  chapterActions,
  onOpenExportModal,
}) => {
  const { 
    handleAiAnnotationClick, 
    handleManualParseClick,
    handleOpenImportModal,
    getAnnotationButtonText,
    isProcessingDisabled,
    isAnyOperationLoading 
  } = chapterActions;

  const { openScriptImport, allCvNames, cvFilter, setCvFilter } = useEditorContext();

  const { 
    selectedAiProvider,
    setSelectedAiProvider,
  } = useStore();
  const [isAiDropdownOpen, setIsAiDropdownOpen] = useState(false);
  const aiButtonRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (aiButtonRef.current && !aiButtonRef.current.contains(event.target as Node)) {
              setIsAiDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, []);

  return (
    <>
      {project.chapters.length === 0 && project.rawFullScript && (
        <button
          onClick={onParseProject}
          disabled={isAnyOperationLoading}
          className="w-full flex items-center justify-center px-3 py-2 mb-3 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          title="将脚本解析为章节"
        >
          <BookOpenIcon className="w-4 h-4 mr-2" /> 解析章节
        </button>
      )}

      <div className="space-y-2 mb-3">
        <div className="grid grid-cols-3 gap-2">
            <div ref={aiButtonRef} className="relative inline-flex rounded-md shadow-sm col-span-1">
              <button
                type="button"
                onClick={handleAiAnnotationClick}
                disabled={isProcessingDisabled('ai')}
                className="flex-grow w-full flex items-center justify-center px-2 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-l-md text-xs font-medium transition-colors disabled:opacity-50"
                title={isProcessingDisabled('ai') ? "选择包含内容的章节或确保当前页面有内容以进行 AI 标注" : "使用 AI 标注选定内容"}
              >
                {isAnyOperationLoading && isProcessingDisabled('ai') ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4 mr-1" />}
                {getAnnotationButtonText(`${providers.find(p => p.key === selectedAiProvider)?.name || '...'}`, true)}
              </button>
              <button
                type="button"
                onClick={() => setIsAiDropdownOpen(prev => !prev)}
                disabled={isAnyOperationLoading}
                className="px-1.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-r-md disabled:opacity-50"
              >
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              {isAiDropdownOpen && (
                <div className="origin-top-left absolute left-0 mt-10 w-48 rounded-md shadow-lg bg-slate-700 ring-1 ring-black ring-opacity-5 z-20">
                  <div className="py-1" role="menu">
                    {providers.map(provider => (
                      <a
                        key={provider.key}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedAiProvider(provider.key);
                          setIsAiDropdownOpen(false);
                        }}
                        className={`block px-4 py-2 text-sm ${selectedAiProvider === provider.key ? 'bg-purple-600 text-white' : 'text-slate-200 hover:bg-slate-600'}`}
                      >
                        {provider.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
             <button
              onClick={openScriptImport}
              className="flex items-center justify-center px-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors"
              title="从 .txt 或 .docx 文件导入新章节和脚本"
            >
              <UploadIcon className="w-4 h-4 mr-1" />
              导入
            </button>
            <button
              onClick={onOpenExportModal}
              className="flex items-center justify-center px-2 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-medium transition-colors"
              title="将选中章节或当前章节导出为 .docx 画本文件"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
              导出
            </button>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={handleManualParseClick}
            disabled={isProcessingDisabled('manual')}
            className="flex-1 flex items-center justify-center px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            title={isProcessingDisabled('manual') ? "选择包含内容的章节或确保当前页面有内容以进行规则解析" : "手动解析选定内容的脚本行"}
          >
            {isAnyOperationLoading && isProcessingDisabled('manual') ? <LoadingSpinner /> : <BoltIcon className="w-4 h-4 mr-2" />}
            画本步骤1: 解析章节
          </button>

          <button
            onClick={handleOpenImportModal}
            disabled={isProcessingDisabled('import')}
            className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
            title={isProcessingDisabled('import') ? "选择单个章节以导入标注" : "导入已标注的行"}
          >
            {isAnyOperationLoading && isProcessingDisabled('import') ? <LoadingSpinner /> : <UploadIcon className="w-4 h-4 mr-2" />}
            画本步骤2: 导入辅助文本
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <label htmlFor="cv-filter-select" className="text-sm text-slate-400 flex-shrink-0">筛选CV:</label>
        <div className="relative flex-grow">
            <select
                id="cv-filter-select"
                value={cvFilter || ''}
                onChange={(e) => setCvFilter(e.target.value || null)}
                className="w-full appearance-none p-2 pr-8 bg-slate-700 rounded-md text-sm text-slate-200 cursor-pointer hover:bg-slate-600 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                title="筛选包含所选CV台词的章节"
            >
                <option value="">显示所有章节</option>
                {allCvNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <UserCircleIcon className="w-5 h-5" />
            </div>
        </div>
      </div>
    </>
  );
};

export default ChapterListActions;
