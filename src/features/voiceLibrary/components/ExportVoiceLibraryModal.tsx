import React from 'react';

interface ExportVoiceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  exportCount: number;
}

const ExportVoiceLibraryModal: React.FC<ExportVoiceLibraryModalProps> = ({ isOpen, onClose, onConfirm, exportCount }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold mb-4 text-slate-100">导出带标记的音频</h2>
        <p className="text-sm text-slate-400 mb-6">
          将从当前页面导出一个包含 <strong className="text-sky-300">{exportCount}</strong> 条已生成音频的 <strong className="text-sky-300">.wav</strong> 文件。
          文件中将包含每句台词开始位置的标记点。
        </p>

        <div className="flex justify-end space-x-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md">
            取消
          </button>
          <button type="button" onClick={onConfirm} disabled={exportCount === 0} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md disabled:opacity-50">
            确认并导出
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportVoiceLibraryModal;
