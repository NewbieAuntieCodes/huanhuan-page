import React, { useState, useEffect } from 'react';

type ExportScope = 'current' | 'all';

interface ExportAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (scope: ExportScope) => void;
  currentChapterTitle: string | null;
  projectTitle: string;
  hasAudioInProject: boolean;
}

const ExportAudioModal: React.FC<ExportAudioModalProps> = ({
  isOpen,
  onClose,
  onExport,
  currentChapterTitle,
  projectTitle,
  hasAudioInProject,
}) => {
  const [selectedOption, setSelectedOption] = useState<ExportScope>('current');

  const isCurrentDisabled = !currentChapterTitle;

  useEffect(() => {
    if (isOpen) {
      if (!isCurrentDisabled) {
        setSelectedOption('current');
      } else {
        setSelectedOption('all');
      }
    }
  }, [isOpen, isCurrentDisabled]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    onExport(selectedOption);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold mb-4 text-slate-100">导出带标记的音频</h2>
        <p className="text-sm text-slate-400 mb-6">选择要导出的音频范围。将生成一个 <strong className="text-sky-300">.wav</strong> 文件，其中包含每句台词开始位置的标记点。</p>

        <div className="space-y-4">
          <label htmlFor="export-current" className={`flex items-center p-3 rounded-md transition-colors ${isCurrentDisabled ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 cursor-pointer'}`}>
            <input
              type="radio"
              id="export-current"
              name="export-option"
              value="current"
              checked={selectedOption === 'current'}
              onChange={() => !isCurrentDisabled && setSelectedOption('current')}
              disabled={isCurrentDisabled}
              className="h-4 w-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className={`font-medium ${isCurrentDisabled ? 'text-slate-500' : 'text-slate-200'}`}>导出当前章节</span>
              <p className={`truncate max-w-xs ${isCurrentDisabled ? 'text-slate-500' : 'text-slate-400'}`}>
                {isCurrentDisabled ? '(无打开的章节)' : `"${currentChapterTitle}"`}
              </p>
            </div>
          </label>
        
          <label htmlFor="export-all" className={`flex items-center p-3 rounded-md transition-colors ${!hasAudioInProject ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 cursor-pointer'}`}>
            <input
              type="radio"
              id="export-all"
              name="export-option"
              value="all"
              checked={selectedOption === 'all'}
              onChange={() => hasAudioInProject && setSelectedOption('all')}
              disabled={!hasAudioInProject}
              className="h-4 w-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className={`font-medium ${!hasAudioInProject ? 'text-slate-500' : 'text-slate-200'}`}>导出整个项目</span>
              <p className={!hasAudioInProject ? 'text-slate-500' : 'text-slate-400'}>
                {projectTitle}
              </p>
            </div>
          </label>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md"
          >
            确认并导出
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportAudioModal;
