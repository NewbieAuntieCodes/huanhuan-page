import React, { useState, useEffect } from 'react';

export type ExportOption = 'all' | 'multi' | 'view';

interface ExportScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (option: ExportOption) => void;
  multiSelectCount: number;
  currentChapterTitle: string | null;
  projectTitle: string;
}

const ExportScriptModal: React.FC<ExportScriptModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  multiSelectCount,
  currentChapterTitle,
  projectTitle,
}) => {
  const [selectedOption, setSelectedOption] = useState<ExportOption>('all');

  const isMultiDisabled = multiSelectCount === 0;
  const isViewDisabled = !currentChapterTitle;

  useEffect(() => {
    if (isOpen) {
      if (!isMultiDisabled) {
        setSelectedOption('multi');
      } else if (!isViewDisabled) {
        setSelectedOption('view');
      } else {
        setSelectedOption('all');
      }
    }
  }, [isOpen, isMultiDisabled, isViewDisabled]);

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    onConfirm(selectedOption);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold mb-4 text-slate-100">导出画本</h2>
        <p className="text-sm text-slate-400 mb-6">选择内容范围。将导出一个带样式的 <strong className="text-sky-300">.docx</strong> 文件，可在 Word 或其他文字处理器中打开。</p>

        <div className="space-y-4">
          <label htmlFor="export-all" className="flex items-center p-3 bg-slate-700 hover:bg-slate-600 rounded-md cursor-pointer transition-colors">
            <input
              type="radio"
              id="export-all"
              name="export-option"
              value="all"
              checked={selectedOption === 'all'}
              onChange={() => setSelectedOption('all')}
              className="h-4 w-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className="font-medium text-slate-200">导出整个项目</span>
              <p className="text-slate-400">"{projectTitle}"</p>
            </div>
          </label>

          <label htmlFor="export-multi" className={`flex items-center p-3 rounded-md transition-colors ${isMultiDisabled ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 cursor-pointer'}`}>
            <input
              type="radio"
              id="export-multi"
              name="export-option"
              value="multi"
              checked={selectedOption === 'multi'}
              onChange={() => !isMultiDisabled && setSelectedOption('multi')}
              disabled={isMultiDisabled}
              className="h-4 w-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className={`font-medium ${isMultiDisabled ? 'text-slate-500' : 'text-slate-200'}`}>导出选中的章节</span>
              <p className={isMultiDisabled ? 'text-slate-500' : 'text-slate-400'}>
                {isMultiDisabled ? '(未选择章节)' : `(${multiSelectCount}个章节)`}
              </p>
            </div>
          </label>

          <label htmlFor="export-view" className={`flex items-center p-3 rounded-md transition-colors ${isViewDisabled ? 'bg-slate-700 opacity-50 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 cursor-pointer'}`}>
            <input
              type="radio"
              id="export-view"
              name="export-option"
              value="view"
              checked={selectedOption === 'view'}
              onChange={() => !isViewDisabled && setSelectedOption('view')}
              disabled={isViewDisabled}
              className="h-4 w-4 text-sky-500 bg-slate-800 border-slate-600 focus:ring-sky-400"
            />
            <div className="ml-3 text-sm">
              <span className={`font-medium ${isViewDisabled ? 'text-slate-500' : 'text-slate-200'}`}>导出当前打开的章节</span>
              <p className={`truncate max-w-xs ${isViewDisabled ? 'text-slate-500' : 'text-slate-400'}`}>
                {isViewDisabled ? '(无打开的章节)' : `"${currentChapterTitle}"`}
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

export default ExportScriptModal;