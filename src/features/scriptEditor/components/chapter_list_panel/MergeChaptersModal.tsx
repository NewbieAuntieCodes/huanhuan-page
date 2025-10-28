import React, { useState, useEffect } from 'react';
import { Chapter } from '../../../../types';

interface MergeChaptersModalProps {
  isOpen: boolean;
  onClose: () => void;
  chaptersToMerge: Chapter[];
  onConfirmMerge: (targetChapterId: string) => void;
}

const MergeChaptersModal: React.FC<MergeChaptersModalProps> = ({
  isOpen,
  onClose,
  chaptersToMerge,
  onConfirmMerge,
}) => {
  const [targetChapterId, setTargetChapterId] = useState<string>('');

  useEffect(() => {
    if (isOpen && chaptersToMerge.length > 0) {
      // Default to the first selected chapter in the sorted list
      setTargetChapterId(chaptersToMerge[0].id);
    }
  }, [isOpen, chaptersToMerge]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetChapterId) {
      alert("请选择一个目标章节标题。");
      return;
    }
    onConfirmMerge(targetChapterId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 overflow-y-auto">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg my-auto">
        <h2 className="text-2xl font-semibold mb-4 text-slate-100">合并章节</h2>
        <p className="text-sm text-slate-300 mb-1">您选择了以下 <strong className="text-sky-300">{chaptersToMerge.length}</strong> 个章节进行合并：</p>
        <ul className="mb-4 space-y-1 text-sm max-h-40 overflow-y-auto pr-2 bg-slate-700 p-2 rounded-md">
            {chaptersToMerge.map(char => (
                <li key={char.id} className="px-2 py-1 rounded truncate" title={char.title}>
                    {char.title}
                </li>
            ))}
        </ul>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="targetChapter" className="block text-sm font-medium text-slate-300 mb-1">
              选择要保留的章节标题:
            </label>
            <select
              id="targetChapter"
              value={targetChapterId}
              onChange={(e) => setTargetChapterId(e.target.value)}
              className="w-full p-3 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-2 focus:ring-sky-500 outline-none"
            >
              {chaptersToMerge.map((char) => (
                <option key={char.id} value={char.id}>
                  {char.title}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            注意：所有选中章节的内容将被合并到标题被保留的章节中。其他章节将被删除。此操作可以通过“撤销”按钮恢复。
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!targetChapterId}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              确认合并
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MergeChaptersModal;
