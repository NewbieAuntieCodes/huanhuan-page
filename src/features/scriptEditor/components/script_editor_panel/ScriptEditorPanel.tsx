import React, { useState, useEffect, useRef } from 'react';
import { Chapter, ScriptLine, Character } from '../../../../types';
import ScriptLineItem from './ScriptLineItem';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import { SplitIcon, UndoIcon, RedoIcon, PencilIcon, SaveIcon } from '../../../../components/ui/icons'; 
// FIX: Corrected import path for EditorContext
import { useEditorContext } from '../../contexts/EditorContext';

interface ScriptEditorPanelProps {
  // Callbacks for script line operations, passed directly from EditorPage's useScriptLineEditor hook
  onUpdateScriptLineText: (chapterId: string, lineId: string, newText: string) => void;
  onAssignCharacterToLine: (chapterId: string, lineId: string, characterId: string) => void;
  onSplitScriptLine: (chapterId: string, lineId: string, splitIndex: number) => void;
  onMergeAdjacentLines: (chapterId: string, lineId: string) => void;
  // Callback for opening CV modal, passed from EditorPage's useEditorModals hook
  onOpenCvModalForCharacterLine: (character: Character) => void;
}

const ScriptEditorPanel: React.FC<ScriptEditorPanelProps> = ({
  onUpdateScriptLineText,
  onAssignCharacterToLine,
  onSplitScriptLine,
  onMergeAdjacentLines,
  onOpenCvModalForCharacterLine,
}) => {
  const {
    currentProject,
    characters,
    cvStyles,
    undoableUpdateChapterTitle, // For editing chapter title
    undoableUpdateChapterRawContent, // For editing raw content
    undo,
    redo,
    canUndo,
    canRedo,
    selectedChapterId,
    focusedScriptLineId,
    setFocusedScriptLineId,
    isLoadingAiAnnotation, // From context, for chapter processing
    isLoadingManualParse,  // From context, for chapter processing
  } = useEditorContext();

  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false);
  const [headerTitleInput, setHeaderTitleInput] = useState('');
  const headerTitleInputRef = useRef<HTMLInputElement>(null);
  const [editableRawContent, setEditableRawContent] = useState('');
  const [isRawContentDirty, setIsRawContentDirty] = useState(false);

  const selectedChapter = currentProject?.chapters.find(ch => ch.id === selectedChapterId);

  useEffect(() => {
    if (selectedChapter) {
      setHeaderTitleInput(selectedChapter.title);
      setIsEditingHeaderTitle(false); 
      setEditableRawContent(selectedChapter.rawContent);
      setIsRawContentDirty(false);
    }
  }, [selectedChapter]);

  useEffect(() => {
    if (isEditingHeaderTitle && headerTitleInputRef.current) {
      headerTitleInputRef.current.focus();
      headerTitleInputRef.current.select();
    }
  }, [isEditingHeaderTitle]);


  if (!selectedChapter) {
    return (
      <div className="p-6 h-full flex items-center justify-center text-slate-400 bg-slate-800">
        <p>选择一个章节开始编辑或查看其内容。</p>
      </div>
    );
  }

  const canSplitFocusedLine = !!focusedScriptLineId;

  const handleSplitClick = () => {
    if (selectedChapter && focusedScriptLineId) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      
      let el = container.nodeType === 3 ? container.parentElement : container as HTMLElement;
      let contentEditableEl: HTMLElement | null = null;
      while(el) {
          if (el.isContentEditable) {
              contentEditableEl = el;
              break;
          }
          el = el.parentElement;
      }
      
      if (contentEditableEl) {
          const preCaretRange = range.cloneRange();
          preCaretRange.selectNodeContents(contentEditableEl);
          preCaretRange.setEnd(range.endContainer, range.endOffset);
          const splitIndex = preCaretRange.toString().length;
          
          onSplitScriptLine(selectedChapter.id, focusedScriptLineId, splitIndex);
      }
    }
  };
  
  const isCurrentlyLoadingLines = (isLoadingAiAnnotation || isLoadingManualParse) && selectedChapter.scriptLines.length === 0;

  const handleHeaderTitleClick = () => {
    if (!selectedChapter) return;
    setHeaderTitleInput(selectedChapter.title);
    setIsEditingHeaderTitle(true);
  };

  const saveHeaderTitle = () => {
    if (!selectedChapter) return;
    const trimmedTitle = headerTitleInput.trim();
    if (trimmedTitle) {
      undoableUpdateChapterTitle(selectedChapter.id, trimmedTitle);
    } else {
      setHeaderTitleInput(selectedChapter.title); 
      alert("章节标题不能为空。");
    }
    setIsEditingHeaderTitle(false);
  };

  const handleHeaderTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveHeaderTitle();
    } else if (e.key === 'Escape') {
      if(selectedChapter) setHeaderTitleInput(selectedChapter.title);
      setIsEditingHeaderTitle(false);
    }
  };

  const handleRawContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableRawContent(e.target.value);
    if (!isRawContentDirty) {
      setIsRawContentDirty(true);
    }
  };
  
  const handleSaveRawContent = () => {
    if (selectedChapter && isRawContentDirty) {
      undoableUpdateChapterRawContent(selectedChapter.id, editableRawContent);
      setIsRawContentDirty(false);
    }
  };

  const hasScriptLines = selectedChapter.scriptLines.length > 0;

  return (
    <div className="p-4 h-full flex flex-col bg-slate-800 text-slate-100">
      <div className="sticky top-0 bg-slate-800 py-2 z-10 border-b border-slate-700 flex justify-between items-center pr-2">
        {isEditingHeaderTitle && selectedChapter ? (
          <input
            ref={headerTitleInputRef}
            type="text"
            value={headerTitleInput}
            onChange={(e) => setHeaderTitleInput(e.target.value)}
            onBlur={saveHeaderTitle}
            onKeyDown={handleHeaderTitleKeyDown}
            className="text-xl font-semibold text-sky-300 bg-slate-700 border border-sky-500 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-sky-400 flex-grow mr-2"
            aria-label={`编辑章节标题: ${selectedChapter.title}`}
          />
        ) : (
          <div 
            className="flex items-center group cursor-pointer flex-grow min-w-0 mr-2" 
            onClick={handleHeaderTitleClick}
            title="点击编辑标题"
          >
            <h3 className="text-xl font-semibold text-sky-300 truncate" title={selectedChapter.title}>
              {selectedChapter.title}
            </h3>
            <PencilIcon className="w-4 h-4 text-slate-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
        )}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={undo}
            disabled={!canUndo || isEditingHeaderTitle}
            title="撤销上一步操作"
            className="flex items-center px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UndoIcon className="w-4 h-4 mr-1.5" />
            撤销
          </button>
          <button
            onClick={redo}
            disabled={!canRedo || isEditingHeaderTitle}
            title="重做上一步操作"
            className="flex items-center px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RedoIcon className="w-4 h-4 mr-1.5" />
            重做
          </button>
          <button
            onClick={handleSplitClick}
            disabled={!canSplitFocusedLine || isEditingHeaderTitle}
            title={canSplitFocusedLine ? "在光标位置拆分当前行" : "请先将光标置于要拆分的行内"}
            className="flex items-center px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SplitIcon className="w-4 h-4 mr-1.5" />
            拆分行
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pt-3 pr-1">
        {isCurrentlyLoadingLines ? (
           <div className="flex flex-col items-center justify-center h-64">
                <LoadingSpinner />
                <p className="mt-2 text-slate-400">
                    {isLoadingAiAnnotation ? "AI 正在处理脚本行..." : "正在按规则处理脚本行..."}
                </p>
            </div>
        ) : hasScriptLines ? (
          selectedChapter.scriptLines.map(line => (
            <ScriptLineItem
              key={line.id}
              line={line}
              characters={characters} // From context
              // FIX: Call the correct prop functions `onUpdateScriptLineText` and `onAssignCharacterToLine`.
              onUpdateText={(lineId, newText) => onUpdateScriptLineText(selectedChapter.id, lineId, newText)}
              onAssignCharacter={(lineId, charId) => onAssignCharacterToLine(selectedChapter.id, lineId, charId)}
              onMergeLines={(lineId) => onMergeAdjacentLines(selectedChapter.id, lineId)}
              // FIX: Removed props that do not exist on ScriptLineItem.
              onOpenCvModalForCharacter={onOpenCvModalForCharacterLine} // Direct prop
              cvStyles={cvStyles} // From context
              isFocusedForSplit={focusedScriptLineId === line.id} // From context
              onFocusChange={setFocusedScriptLineId} // From context
            />
          ))
        ) : (
          <div className="text-slate-400 space-y-3 p-3 h-full flex flex-col">
            <p>
              {selectedChapter.rawContent.trim() === "" 
                ? "此章节似乎没有文本内容。" 
                : "尚未处理任何脚本行。"}
              {selectedChapter.rawContent.trim() !== "" && "请尝试使用左侧面板的“AI 标注章节”或“手动解析章节”功能。"}
            </p>
            <div className="mt-4 p-3 bg-slate-700 rounded-md flex flex-col flex-grow">
              <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h4 className="text-sm font-semibold text-slate-300">
                  {hasScriptLines ? "原始章节内容预览：" : "原始章节内容编辑："}
                </h4>
                {!hasScriptLines && (
                  <button
                    onClick={handleSaveRawContent}
                    disabled={!isRawContentDirty}
                    className="flex items-center px-2.5 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-md disabled:opacity-50"
                    title={isRawContentDirty ? "保存对原始内容的更改" : "无更改"}
                  >
                    <SaveIcon className="w-3.5 h-3.5 mr-1" /> 保存更改
                  </button>
                )}
              </div>
              {hasScriptLines ? (
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto flex-grow bg-slate-800 p-4 rounded-md">
                    {selectedChapter.rawContent}
                  </pre>
              ) : (
                  <textarea 
                    value={editableRawContent}
                    onChange={handleRawContentChange}
                    className="text-xs text-slate-300 whitespace-pre-wrap overflow-y-auto flex-grow bg-slate-800 p-4 rounded-md w-full h-full resize-none border border-slate-600 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none"
                    aria-label="原始章节内容编辑器"
                  />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScriptEditorPanel;