import React, { useState, useEffect } from 'react';
import { InformationCircleIcon } from '../../../../components/ui/icons';

interface ImportAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (annotatedText: string) => void;
  isLoading: boolean;
}

const ImportAnnotationModal: React.FC<ImportAnnotationModalProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [annotatedText, setAnnotatedText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAnnotatedText(''); // Clear text area when modal opens
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (annotatedText.trim()) {
      onSubmit(annotatedText);
    } else {
      alert("请粘贴一些已标注的文本。");
    }
  };

  if (!isOpen) return null;
  
  const aiPrompt = `请为以下小说文稿的“对话行”进行角色标注。严格按照【角色】“台词内容”或【CV-角色】“台词内容”的格式返回，非对话行请忽略。

文稿内容：
[你的章节原文]`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-2xl">
        <h2 className="text-2xl font-semibold mb-4 text-slate-100">导入 AI 辅助标注文本</h2>
        
        <div className="mb-4 text-sm text-slate-300 space-y-4">
          <p>
            使用外部 AI (如 ChatGPT, Kimi 等) 为章节对话快速分配角色。
          </p>

          <div className="bg-slate-700 p-3 rounded-md">
            <h3 className="font-semibold text-base text-sky-300 mb-2">第一步：让 AI 处理你的文本</h3>
            <p className="text-xs mb-2 text-slate-300">
              复制下面的提示词，将 <strong>[你的章节原文]</strong> 替换成章节内容后，发送给 AI。
            </p>
            <pre className="mt-1 p-2 bg-slate-900 rounded text-xs overflow-x-auto text-sky-200 select-all">
              {aiPrompt}
            </pre>
          </div>
          
          <div className="bg-slate-700 p-3 rounded-md">
            <h3 className="font-semibold text-base text-sky-300 mb-2">第二步：粘贴 AI 返回的结果</h3>
            <p className="text-xs text-slate-300">
              将 AI 生成的已标注文本，完整粘贴到下方的输入框中。
            </p>
            <div className="flex items-start text-xs text-slate-400 mt-2">
                <InformationCircleIcon className="w-4 h-4 mr-1.5 flex-shrink-0 mt-0.5" />
                <span>只会更新内容完全匹配的对话行。旁白和不匹配的行将被忽略。</span>
            </div>
          </div>
        </div>

        <textarea
          value={annotatedText}
          onChange={(e) => setAnnotatedText(e.target.value)}
          className="w-full h-56 p-3 bg-slate-900 text-slate-100 rounded-md border border-slate-600 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
          placeholder="在此处粘贴 AI 生成的标注文本..."
          disabled={isLoading}
          aria-label="Paste annotated script here"
        />
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-600 hover:bg-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !annotatedText.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50"
          >
            {isLoading ? '处理中...' : '处理导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportAnnotationModal;
