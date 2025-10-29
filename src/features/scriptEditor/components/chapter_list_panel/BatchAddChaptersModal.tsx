import React, { useState } from 'react';

interface BatchAddChaptersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (count: number) => void;
}

const BatchAddChaptersModal: React.FC<BatchAddChaptersModalProps> = ({ isOpen, onClose, onSave }) => {
  const [count, setCount] = useState(1);

  if (!isOpen) return null;

  const handleSave = () => {
    if (count > 0 && count <= 100) { // Limit to 100 chapters at a time
      onSave(count);
    } else {
      alert("请输入一个1到100之间的数字。");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-sm">
        <h2 className="text-xl font-semibold mb-4 text-slate-100">批量添加章节</h2>
        <div className="mb-4">
          <label htmlFor="chapter-count" className="block text-sm font-medium text-slate-300 mb-2">要添加的章节数量：</label>
          <input
            type="number"
            id="chapter-count"
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
            min="1"
            max="100"
            className="w-full p-2 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <p className="text-xs text-slate-400 mb-6">
          新章节的标题将根据项目中最后一个章节的标题自动递增。
        </p>
        <div className="flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md">
            取消
          </button>
          <button type="button" onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md">
            确认添加
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchAddChaptersModal;
