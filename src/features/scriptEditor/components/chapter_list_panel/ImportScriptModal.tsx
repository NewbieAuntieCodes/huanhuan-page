import React, { useState, useEffect } from 'react';
import { Chapter } from '../../../../types';

interface ImportScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (insertionIndex: number) => void;
  chapters: Chapter[];
}

const ImportScriptModal: React.FC<ImportScriptModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  chapters,
}) => {
  const [insertionIndex, setInsertionIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setInsertionIndex(0); // Reset on open
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(insertionIndex);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-slate-100">导入画本</h2>
        <p className="text-sm text-slate-300 mb-4">请选择新章节的插入位置。导入的内容将被解析为新的章节并插入到您选择的位置。</p>
        
        <div>
          <label htmlFor="insertion-point" className="block text-sm font-medium text-slate-300 mb-1">插入位置</label>
          <select
            id="insertion-point"
            value={insertionIndex}
            onChange={(e) => setInsertionIndex(Number(e.target.value))}
            className="w-full p-2 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500"
          >
            <option value={0}>在项目最开始</option>
            {chapters.map((chapter, index) => (
              <option key={chapter.id} value={index + 1}>
                在章节 "{chapter.title}" 之前
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md">
            取消
          </button>
          <button type="button" onClick={handleConfirm} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
            确认导入
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportScriptModal;