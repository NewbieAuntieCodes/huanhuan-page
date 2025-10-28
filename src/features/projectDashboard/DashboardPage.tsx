import React, { useState, useCallback } from 'react';
import { Project, PresetColor } from '../../types';
import BookCard from './components/BookCard';
import { BookOpenIcon, UploadIcon, PaletteIcon, XMarkIcon, SaveIcon, ArrowPathIcon } from '../../components/ui/icons';
import useStore from '../../store/useStore';
import CollaboratorModal from './components/CollaboratorModal';
import { isHexColor, getContrastingTextColor } from '../../lib/colorUtils';
import { tailwindToHex } from '../../lib/tailwindColorMap';
import { internalParseScriptToChapters } from '../../lib/scriptParser';

// --- In-file Component: Editable Preset Color Item --- //
const EditablePresetColor: React.FC<{
  preset: PresetColor;
  onUpdate: (updates: Partial<PresetColor>) => void;
  idPrefix: string;
}> = ({ preset, onUpdate, idPrefix }) => {
  const { name, bgColorClass, textColorClass } = preset;

  const previewStyle: React.CSSProperties = isHexColor(bgColorClass)
    ? { backgroundColor: bgColorClass, color: isHexColor(textColorClass) ? textColorClass : getContrastingTextColor(bgColorClass) }
    : {};
  const previewClassName = !isHexColor(bgColorClass) ? `${bgColorClass} ${textColorClass}` : '';

  const getColorAsHex = (colorValue: string, fallback: string): string => {
    if (isHexColor(colorValue)) {
      return colorValue;
    }
    return tailwindToHex[colorValue] || fallback;
  };

  const bgColorPickerValue = getColorAsHex(bgColorClass, '#ffffff');
  const textColorPickerValue = getColorAsHex(textColorClass, '#000000');

  const handleBgColorPickerChange = (e: React.FormEvent<HTMLInputElement>) => {
    const newHex = e.currentTarget.value;
    onUpdate({
      bgColorClass: newHex,
      textColorClass: getContrastingTextColor(newHex),
    });
  };

  const handleTextColorPickerChange = (e: React.FormEvent<HTMLInputElement>) => {
    onUpdate({ textColorClass: e.currentTarget.value });
  };

  return (
    <div className="p-2 bg-slate-800 rounded-md border border-slate-700 space-y-2">
      <div className={`p-2 h-10 rounded text-center font-bold flex items-center justify-center ${previewClassName}`} style={previewStyle}>
        Aa
      </div>
      <div className="flex justify-around items-center">
        <input
          id={`bg-color-${idPrefix}`}
          type="color"
          value={bgColorPickerValue}
          onInput={handleBgColorPickerChange}
          className="p-0 h-7 w-10 rounded border-2 border-slate-600 bg-slate-700 cursor-pointer"
          aria-label={`Background color for ${name}`}
          title="背景颜色"
        />
        <input
          id={`text-color-${idPrefix}`}
          type="color"
          value={textColorPickerValue}
          onInput={handleTextColorPickerChange}
          className="p-0 h-7 w-10 rounded border-2 border-slate-600 bg-slate-700 cursor-pointer"
          aria-label={`Text color for ${name}`}
          title="文本颜色"
        />
      </div>
      <input
        type="text"
        value={name}
        onChange={e => onUpdate({ name: e.target.value })}
        className="w-full p-1.5 text-xs bg-slate-700 text-slate-100 rounded border border-slate-600 focus:ring-sky-500"
        placeholder="名称"
        aria-label={`Preset name for ${name}`}
      />
    </div>
  );
};

// --- In-file Component: Color Preset Manager Modal --- //
const ColorPresetManagerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const initialCvPresets = useStore(state => state.cvColorPresets);
  const initialCharPresets = useStore(state => state.characterColorPresets);
  const updateCvPresets = useStore(state => state.updateCvColorPresets);
  const updateCharPresets = useStore(state => state.updateCharacterColorPresets);

  const [editedCvPresets, setEditedCvPresets] = useState<PresetColor[]>([]);
  const [editedCharPresets, setEditedCharPresets] = useState<PresetColor[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setEditedCvPresets(JSON.parse(JSON.stringify(initialCvPresets)));
      setEditedCharPresets(JSON.parse(JSON.stringify(initialCharPresets)));
    }
  }, [isOpen, initialCvPresets, initialCharPresets]);

  const handleCvUpdate = (index: number, updates: Partial<PresetColor>) => {
    setEditedCvPresets(prevPresets => {
      const newPresets = [...prevPresets];
      newPresets[index] = { ...newPresets[index], ...updates };
      return newPresets;
    });
  };
  const handleCharUpdate = (index: number, updates: Partial<PresetColor>) => {
    setEditedCharPresets(prevPresets => {
        const newPresets = [...prevPresets];
        newPresets[index] = { ...newPresets[index], ...updates };
        return newPresets;
    });
  };

  const handleSave = async () => {
    await updateCvPresets(editedCvPresets);
    await updateCharPresets(editedCharPresets);
    onClose();
  };

  const handleReset = () => {
    setEditedCvPresets(JSON.parse(JSON.stringify(initialCvPresets)));
    setEditedCharPresets(JSON.parse(JSON.stringify(initialCharPresets)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
      <div className="bg-slate-850 p-6 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col border border-slate-700">
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-2xl font-semibold text-slate-100">颜色预设管理器</h2>
          <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-white"><XMarkIcon /></button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-1 gap-8">
          <section>
            <h3 className="text-lg font-medium text-teal-400 sticky top-0 bg-slate-850 py-2">CV 预设颜色 (2排 × 8个)</h3>
            <div className="grid grid-cols-8 gap-3">
              {editedCvPresets.map((preset, index) => (
                <EditablePresetColor key={`cv-${index}`} preset={preset} onUpdate={(updates) => handleCvUpdate(index, updates)} idPrefix={`cv-${index}`} />
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-lg font-medium text-rose-400 sticky top-0 bg-slate-850 py-2">角色 预设颜色 (2排 × 8个)</h3>
            <div className="grid grid-cols-8 gap-3">
              {editedCharPresets.map((preset, index) => (
                <EditablePresetColor key={`char-${index}`} preset={preset} onUpdate={(updates) => handleCharUpdate(index, updates)} idPrefix={`char-${index}`} />
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-between items-center pt-4 mt-4 border-t border-slate-700 flex-shrink-0">
          <p className="text-xs text-slate-500">提示：颜色选择实时同步，名称在输入框失焦后自动保存。</p>
          <div className="flex space-x-3">
            <button onClick={handleReset} className="flex items-center px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md">
                <ArrowPathIcon className="w-4 h-4 mr-2" /> 重置为默认
            </button>
            <button onClick={handleSave} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
                <SaveIcon className="w-4 h-4 mr-2" /> 保存并关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


const DashboardPage: React.FC = () => {
  const { 
    projects, 
    updateProject, 
    deleteProject, 
    navigateTo, 
    setSelectedProjectId,
    appendChaptersToProject,
    openConfirmModal,
    selectedProjectId
  } = useStore();

  const sortedProjects = [...projects].sort((a, b) => b.lastModified - a.lastModified);
  const addCollaboratorToProject = useStore(state => state.addCollaboratorToProject);
  
  const [projectToManage, setProjectToManage] = useState<Project | null>(null);
  const [isColorPresetModalOpen, setIsColorPresetModalOpen] = useState(false);

  const handleOpenCollaboratorsModal = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setProjectToManage(project);
    }
  };

  const handleCloseCollaboratorsModal = () => {
    setProjectToManage(null);
  };
  
  const handleOpenEditor = (projectId: string) => {
    setSelectedProjectId(projectId);
    navigateTo("editor");
  };

  const handleDeleteProject = (projectId: string) => {
    openConfirmModal(
      "删除项目确认",
      `您确定要删除项目吗？此操作无法撤销。`,
      () => {
        const currentProjects = useStore.getState().projects;
        const currentSelectedId = useStore.getState().selectedProjectId;
        
        deleteProject(projectId); 
        
        if (currentSelectedId === projectId && currentProjects.length <= 1) {
            navigateTo("upload"); 
        }
      },
      "删除",
      "取消"
    );
  };
  
  const handleContinueUpload = useCallback(async (projectId: string, file: File) => {
    if (!file) return;

    try {
      const rawText = await file.text();
      if (!rawText.trim()) {
        alert("上传的文件为空。");
        return;
      }
      
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        alert("未找到项目。");
        return;
      }

      const newChapters = internalParseScriptToChapters(rawText, project.name);

      if (newChapters.length > 0) {
        appendChaptersToProject(projectId, newChapters);
        alert(`成功为项目 "${project.name}" 添加了 ${newChapters.length} 个新章节。`);
      } else {
        alert("在上传的文件中未检测到新的章节。请检查文件格式。");
      }
    } catch (error) {
      console.error("处理续传文件时出错:", error);
      alert(`处理文件时出错: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [projects, appendChaptersToProject]);

  return (
    <div className="p-4 md:p-6 bg-slate-900 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-sky-400">我的项目</h1>
        <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsColorPresetModalOpen(true)}
              className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md text-sm transition-colors"
              aria-label="颜色预设"
            >
              <PaletteIcon className="w-4 h-4 mr-2" /> 颜色预设
            </button>
            <button
              onClick={() => navigateTo("upload")}
              className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md text-sm transition-colors"
              aria-label="上传新书"
            >
              <UploadIcon className="w-4 h-4 mr-2" /> 上传新书
            </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="pt-10 flex flex-col items-center justify-center text-center text-slate-100">
          <BookOpenIcon className="w-20 h-20 text-slate-600 mb-6" />
          <h2 className="text-2xl font-semibold text-slate-300 mb-2">尚无项目</h2>
          <p className="text-slate-400 mb-6">上传您的第一份文稿以开始创作。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {sortedProjects.map(project => (
            <BookCard
              key={project.id}
              project={project}
              onOpenEditor={handleOpenEditor}
              onUpdateProject={updateProject}
              onDeleteProject={handleDeleteProject}
              onOpenCollaborators={handleOpenCollaboratorsModal}
              onContinueUpload={handleContinueUpload}
            />
          ))}
        </div>
      )}
       <CollaboratorModal
        isOpen={!!projectToManage}
        onClose={handleCloseCollaboratorsModal}
        project={projectToManage}
        onAddCollaborator={addCollaboratorToProject}
      />
      <ColorPresetManagerModal
        isOpen={isColorPresetModalOpen}
        onClose={() => setIsColorPresetModalOpen(false)}
      />
    </div>
  );
};

export default DashboardPage;