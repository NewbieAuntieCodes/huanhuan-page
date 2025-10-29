import React from 'react';
import { PlusIcon, MinusIcon, ListBulletIcon, TrashIcon, ArrowsRightLeftIcon } from '../../../../components/ui/icons';

interface BatchModifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onBatchDelete: () => void;
  onBatchMerge: () => void;
  canMerge: boolean;
  onBatchAdd: () => void;
}

const BatchModifyModal: React.FC<BatchModifyModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  onBatchDelete,
  onBatchMerge,
  canMerge,
  onBatchAdd,
}) => {
  if (!isOpen) return null;

  const handleActionClick = (action: () => void) => {
    action();
    onClose();
  };
  
  const handleNotImplemented = () => {
    alert('功能待实现');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-850 p-6 rounded-lg shadow-xl w-full max-w-sm border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-slate-100">批量操作</h2>
        </div>
        <p className="text-sm text-slate-400 mb-6">已选中 <span className="text-sky-400 font-semibold">{selectedCount}</span> 个章节</p>
        
        <div className="space-y-2">
          <button onClick={handleNotImplemented} className="w-full flex items-center justify-between text-left p-3 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 transition-colors">
            <div className="flex items-center"><PlusIcon className="w-5 h-5 mr-3" /> 批量增加文字</div>
            <span className="text-slate-500 font-sans">&gt;</span>
          </button>
          <button onClick={handleNotImplemented} className="w-full flex items-center justify-between text-left p-3 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 transition-colors">
            <div className="flex items-center"><MinusIcon className="w-5 h-5 mr-3" /> 批量删除文字</div>
            <span className="text-slate-500 font-sans">&gt;</span>
          </button>
          <button onClick={handleNotImplemented} className="w-full flex items-center justify-between text-left p-3 bg-slate-700 hover:bg-slate-600 rounded-md text-slate-200 transition-colors">
            <div className="flex items-center"><ListBulletIcon className="w-5 h-5 mr-3" /> 批量添加序号 (1)(2)(3)...</div>
            <span className="text-slate-500 font-sans">&gt;</span>
          </button>
           <button 
            onClick={() => handleActionClick(onBatchMerge)} 
            disabled={!canMerge}
            className="w-full flex items-center justify-between text-left p-3 bg-indigo-800/80 hover:bg-indigo-700/90 rounded-md text-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={canMerge ? "合并选中的章节" : "请选择2个或更多连续的章节进行合并"}
          >
            <div className="flex items-center"><ArrowsRightLeftIcon className="w-5 h-5 mr-3" /> 合并章节</div>
            <span className="text-indigo-300 font-sans">&gt;</span>
          </button>
          <button onClick={() => handleActionClick(onBatchDelete)} className="w-full flex items-center justify-between text-left p-3 bg-red-900/80 hover:bg-red-800/90 rounded-md text-red-100 transition-colors">
            <div className="flex items-center"><TrashIcon className="w-5 h-5 mr-3" /> 批量删除章节</div>
            <span className="text-red-300 font-sans">&gt;</span>
          </button>
          <button onClick={() => handleActionClick(onBatchAdd)} className="w-full flex items-center justify-between text-left p-3 bg-green-800/80 hover:bg-green-700/90 rounded-md text-green-100 transition-colors mt-4">
            <div className="flex items-center"><PlusIcon className="w-5 h-5 mr-3" /> 批量添加章节</div>
            <span className="text-green-300 font-sans">&gt;</span>
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-md text-sm">
            取消
          </button>
        </div>
      </div>
    </div>
  );
};
export default BatchModifyModal;