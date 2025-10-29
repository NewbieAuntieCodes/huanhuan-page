import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../store/useStore';
import VoiceLibraryRow from './components/VoiceLibraryRow';
import { ChevronLeftIcon, SparklesIcon, CheckCircleIcon, XMarkIcon, PlusIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from '../../components/ui/icons';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import ExportVoiceLibraryModal from './components/ExportVoiceLibraryModal';
import { useVoiceLibrary } from './hooks/useVoiceLibrary';
import { VoiceLibraryRowState } from './hooks/useVoiceLibrary'; // Import type from hook
import { ScriptLine } from '../../types';

const VoiceLibraryPage: React.FC = () => {
  const { navigateTo } = useStore(state => ({
    navigateTo: state.navigateTo
  }));

  const {
    rows,
    currentProject,
    charactersInProject,
    selectedCharacter,
    isGenerating,
    isExporting,
    serverHealth,
    chapterFilter,
    setChapterFilter,
    selectedCharacterId,
    handleSelectCharacter,
    checkServerHealth,
    handleBatchGenerate,
    handleGenerateSingle,
    handleUpload,
    handleTextChange,
    removeRow,
    addEmptyRow,
    handleDeleteGeneratedAudio,
    handleDeletePromptAudio,
    handleExport,
    handleExportCharacterClips,
    generatedAudioUrls,
  } = useVoiceLibrary();

  const [isCharacterDropdownOpen, setIsCharacterDropdownOpen] = useState(false);
  const [characterSearchTerm, setCharacterSearchTerm] = useState('');
  const characterDropdownRef = useRef<HTMLDivElement>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activePlayerKey, setActivePlayerKey] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, []);
  
  const onGoBack = () => {
    currentProject ? navigateTo("editor") : navigateTo("dashboard");
  };

  const filteredCharactersForDropdown = React.useMemo(() => {
    if (!characterSearchTerm) return charactersInProject;
    const lowerSearch = characterSearchTerm.toLowerCase();
    return charactersInProject.filter(c =>
      c.name.toLowerCase().includes(lowerSearch) ||
      c.cvName?.toLowerCase().includes(lowerSearch)
    );
  }, [charactersInProject, characterSearchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (characterDropdownRef.current && !characterDropdownRef.current.contains(event.target as Node)) {
        setIsCharacterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCharacterSelection = (charId: string) => {
    handleSelectCharacter(charId);
    setIsCharacterDropdownOpen(false);
    setCharacterSearchTerm('');
  };

  const characterMap = useMemo(() => new Map(charactersInProject.map(c => [c.id, c])), [charactersInProject]);
  const lineMap = useMemo(() => {
      if (!currentProject) return new Map();
      const map = new Map<string, ScriptLine>();
      currentProject.chapters.forEach(ch => ch.scriptLines.forEach(line => map.set(line.id, line)));
      return map;
  }, [currentProject]);


  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
        <h1 className="text-2xl font-bold text-sky-400">音色库 (本地TTS)</h1>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-sm">
            <span>本地服务状态:</span>
            {serverHealth === 'checking' && <span className="text-yellow-400">检查中...</span>}
            {serverHealth === 'ok' && <span className="flex items-center text-green-400"><CheckCircleIcon className="w-4 h-4 mr-1" />正常</span>}
            {serverHealth === 'error' && <span className="flex items-center text-red-400"><XMarkIcon className="w-4 h-4 mr-1" />异常</span>}
            {serverHealth === 'unknown' && <span className="text-slate-500">未知</span>}
          </div>
          <button onClick={checkServerHealth} disabled={serverHealth === 'checking'} className="text-xs p-1 text-slate-400 hover:text-white disabled:opacity-50">重试</button>
          <button
            onClick={handleBatchGenerate}
            disabled={isGenerating || serverHealth !== 'ok'}
            className="flex items-center text-sm text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            {isGenerating ? <LoadingSpinner /> : <SparklesIcon className="w-4 h-4 mr-1" />}
            {isGenerating ? '生成中...' : '批量生成'}
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isGenerating || isExporting || rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId).length === 0}
            className="flex items-center text-sm text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md disabled:opacity-50"
          >
            {isExporting ? <LoadingSpinner /> : <ArrowDownTrayIcon className="w-4 h-4 mr-1" />}
            {isExporting ? '导出中...' : '导出'}
          </button>
          <button onClick={onGoBack} className="flex items-center text-sm text-sky-300 hover:text-sky-100 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md">
            <ChevronLeftIcon className="w-4 h-4 mr-1" /> 返回
          </button>
        </div>
      </header>

      <div className="p-4 flex-shrink-0 border-b border-slate-800 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label htmlFor="character-select" className="text-sm font-medium whitespace-nowrap">选择角色:</label>
          <div ref={characterDropdownRef} className="relative w-48">
            <button
              onClick={() => setIsCharacterDropdownOpen(prev => !prev)}
              disabled={!currentProject}
              className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 p-2 flex justify-between items-center disabled:opacity-50"
            >
              <span className="truncate">{selectedCharacter ? selectedCharacter.name : (currentProject ? '所有角色' : '无项目')}</span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isCharacterDropdownOpen && (
              <div className="absolute z-30 mt-1 w-full bg-slate-800 rounded-md shadow-lg border border-slate-600 max-h-96 flex flex-col">
                <div className="p-2 border-b border-slate-700">
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="搜索角色或CV..."
                      value={characterSearchTerm}
                      onChange={e => setCharacterSearchTerm(e.target.value)}
                      className="w-full bg-slate-700 text-sm rounded-md pl-7 p-1.5 focus:ring-1 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>
                <ul className="overflow-y-auto">
                   <li onClick={() => handleCharacterSelection('')} className="px-3 py-2 text-sm text-sky-300 hover:bg-slate-700 cursor-pointer">
                        显示所有角色
                    </li>
                  {filteredCharactersForDropdown.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-400">未找到角色</li>
                  ) : (
                    filteredCharactersForDropdown.map(char => (
                      <li key={char.id} onClick={() => handleCharacterSelection(char.id)} className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer flex justify-between">
                        <span>{char.name}</span>
                        {char.cvName && <span className="text-xs text-slate-400">{char.cvName}</span>}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="chapter-filter" className="text-sm font-medium whitespace-nowrap">章节筛选:</label>
          <input
            id="chapter-filter"
            type="text"
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            placeholder="例如: 405 或 405-420"
            className="bg-slate-700 border border-slate-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 p-2 w-48"
            disabled={!currentProject}
          />
        </div>
        <button onClick={addEmptyRow} className="flex items-center text-sm text-green-300 hover:text-green-100 px-3 py-1.5 bg-green-800/50 hover:bg-green-700/50 rounded-md">
          <PlusIcon className="w-4 h-4 mr-1" /> 添加空行
        </button>
        <button
          onClick={handleExportCharacterClips}
          disabled={isGenerating || isExporting || rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId).length === 0}
          className="flex items-center text-sm text-fuchsia-300 hover:text-fuchsia-100 px-3 py-1.5 bg-fuchsia-800/50 hover:bg-fuchsia-700/50 rounded-md disabled:opacity-50"
          title="将当前筛选出的、已有音频的片段批量导出为 mp3 文件"
        >
          {isExporting ? <LoadingSpinner /> : <ArrowDownTrayIcon className="w-4 h-4 mr-1" />}
          {isExporting ? '导出中...' : '导出角色片段'}
        </button>
      </div>

      <main className="flex-grow overflow-y-auto">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-x-4 px-4 py-2 text-sm font-semibold text-slate-400 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>参考音频 (拖拽上传)</div>
          <div>台词文本 {selectedCharacter && <span className="text-sky-400 font-semibold ml-2">【{selectedCharacter.name}】</span>}</div>
          <div>生成结果</div>
          <div className="w-8"></div>
        </div>
        <div className="p-4 space-y-3">
          {rows.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <p>{currentProject ? '当前筛选条件下没有台词。' : '请先选择一个项目。'}</p>
              <p>或点击“添加空行”手动创建。</p>
            </div>
          ) : (
            rows.map(row => {
              const line = row.originalLineId ? lineMap.get(row.originalLineId) : null;
              const characterForRow = line?.characterId ? characterMap.get(line.characterId) : null;
              return (
              <VoiceLibraryRow
                key={row.id}
                row={{ ...row, audioUrl: generatedAudioUrls[row.id] || null }}
                // FIX: Pass null instead of an empty object when a character is not found. This resolves a TypeScript error where an empty object doesn't match the `Character` type.
                character={characterForRow || null}
                isBatchGenerating={isGenerating}
                onTextChange={(text) => handleTextChange(row.id, text)}
                onFileUpload={(file) => handleUpload(row.id, file)}
                onRemove={() => removeRow(row.id)}
                onGenerateSingle={() => handleGenerateSingle(row.id)}
                onDeleteGeneratedAudio={() => handleDeleteGeneratedAudio(row.id)}
                onDeletePromptAudio={() => handleDeletePromptAudio(row.id)}
                audioContext={audioContextRef.current}
                activePlayerKey={activePlayerKey}
                setActivePlayerKey={setActivePlayerKey}
              />
            )})
          )}
        </div>
      </main>
      <ExportVoiceLibraryModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleExport}
        exportCount={rows.filter(r => generatedAudioUrls[r.id] && r.originalLineId).length}
      />
    </div>
  );
};

export default VoiceLibraryPage;