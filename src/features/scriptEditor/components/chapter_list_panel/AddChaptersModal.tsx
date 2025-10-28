import React, { useState, useEffect } from 'react';

interface AddChaptersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pastedText: string) => void;
  isLoading?: boolean;
}

const AddChaptersModal: React.FC<AddChaptersModalProps> = ({ isOpen, onClose, onSave, isLoading = false }) => {
  const [pastedText, setPastedText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPastedText(''); // Clear on open
    }
  }, [isOpen]);

  const handleSave = () => {
    if (pastedText.trim()) {
      onSave(pastedText);
    } else {
      alert("请粘贴章节内容。");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-xl">
        <h2 className="text-2xl font-semibold mb-4 text-slate-100">添加新章节</h2>
        <div className="mb-4 text-sm text-slate-300 bg-slate-700 p-3 rounded-md">
          <p>将新章节的文本粘贴到下方。系统将自动识别章节标题 (例如: "第十章", "Chapter 10") 并创建新章节。</p>
        </div>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          className="w-full h-64 p-3 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          placeholder="在此处粘贴章节文本..."
          disabled={isLoading}
          aria-label="Paste new chapter text here"
        />
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || !pastedText.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50"
          >
            {isLoading ? '正在保存...' : '保存并添加'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddChaptersModal;
