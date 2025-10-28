
import React, { useState, useEffect, useRef } from 'react';
import { Project, ProjectStatus, MainCategory } from '../../../types';
import { PencilIcon, BookOpenIcon as OpenIcon, TrashIcon, UsersIcon, UploadIcon } from '../../../components/ui/icons';

interface BookCardProps {
  project: Project;
  onOpenEditor: (projectId: string) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void; 
  onOpenCollaborators: (projectId: string) => void;
  onContinueUpload: (projectId: string, file: File) => void;
}

const mainCategoryDropdownOptions: { label: string; value: "female" | "male" | "custom" }[] = [
  { label: "女频", value: "female" },
  { label: "男频", value: "male" },
  { label: "自定义", value: "custom" },
];

const subCategories: Record<string, { label: string; value: string }[]> = {
  female: [
    { label: "现代言情", value: "modern_romance" },
    { label: "古代言情", value: "historical_romance" },
    { label: "幻想言情", value: "fantasy_romance" },
    { label: "悬疑言情", value: "suspense_romance" },
  ],
  male: [
    { label: "玄幻", value: "fantasy" },
    { label: "悬疑", value: "suspense_mystery" },
    { label: "都市", value: "urban" },
  ],
};


const BookCard: React.FC<BookCardProps> = ({ project, onOpenEditor, onUpdateProject, onDeleteProject, onOpenCollaborators, onContinueUpload }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editableProject, setEditableProject] = useState<Project>(project);
  const [selectedMainCategoryDropdownValue, setSelectedMainCategoryDropdownValue] = useState<"female" | "male" | "custom">("custom");
  const [showCustomSubCategoryInput, setShowCustomSubCategoryInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditableProject(project); 
    if (project.mainCategory === "female") {
      setSelectedMainCategoryDropdownValue("female");
      setShowCustomSubCategoryInput(subCategories.female?.every(sc => sc.value !== project.subCategory) && project.subCategory !== "未分类" && project.subCategory !== "");
    } else if (project.mainCategory === "male") {
      setSelectedMainCategoryDropdownValue("male");
      setShowCustomSubCategoryInput(subCategories.male?.every(sc => sc.value !== project.subCategory) && project.subCategory !== "未分类" && project.subCategory !== "");
    } else { 
      setSelectedMainCategoryDropdownValue("custom");
      setShowCustomSubCategoryInput(true); 
    }
  }, [project, isEditing]); 

  const handleMainCategoryDropdownChange = (selectedValueString: string) => {
    const selectedValue = selectedValueString as "female" | "male" | "custom";
    setSelectedMainCategoryDropdownValue(selectedValue);

    if (selectedValue === "female" || selectedValue === "male") {
        setEditableProject(prev => ({ ...prev, mainCategory: selectedValue, subCategory: "未分类" }));
        setShowCustomSubCategoryInput(false);
    } else { 
        if (editableProject.mainCategory === "female" || editableProject.mainCategory === "male") {
             setEditableProject(prev => ({ ...prev, mainCategory: "", subCategory: "" })); 
        } else {
             setEditableProject(prev => ({ ...prev, subCategory: prev.subCategory === "未分类" ? "" : prev.subCategory }));
        }
        setShowCustomSubCategoryInput(true);
    }
  };
  
  const handleCustomMainCategoryTextChange = (newCustomName: string) => {
    setEditableProject(prev => ({ ...prev, mainCategory: newCustomName }));
  };

  const handleSubCategoryChange = (value: string) => {
     setEditableProject(prev => ({ ...prev, subCategory: value }));
  };

  const handleSaveChanges = () => {
    if (selectedMainCategoryDropdownValue === "custom" && editableProject.mainCategory.trim() === "") {
      alert("自定义主分类名称不能为空。");
      return;
    }
    onUpdateProject(editableProject);
    setIsEditing(false);
  };

  const getStatusDisplay = (status: ProjectStatus) => {
    if (status === "completed") return { text: "已完成", color: "bg-green-600 text-green-100" };
    return { text: "进行中", color: "bg-sky-600 text-sky-100" };
  };
  
  const currentMainCatIsPreset = editableProject.mainCategory === "female" || editableProject.mainCategory === "male";
  const currentSubCategoryOptions = currentMainCatIsPreset ? subCategories[editableProject.mainCategory] || [] : [];

  const handleDeleteClick = () => {
    onDeleteProject(project.id);
  };
  
  const displayMainCategoryLabel = mainCategoryDropdownOptions.find(mc => mc.value === project.mainCategory)?.label || project.mainCategory || "自定义";


  return (
    <div className="bg-slate-800 rounded-lg shadow-lg p-5 flex flex-col justify-between transition-all hover:shadow-sky-700/30">
      <div>
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold text-sky-300 truncate pr-2" title={editableProject.name}>
            {editableProject.name}
            </h3>
            {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-sky-400 p-1">
                    <PencilIcon className="w-4 h-4" />
                </button>
            )}
        </div>

        {isEditing ? (
          <div className="space-y-3 mb-3">
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">状态</label>
              <select
                value={editableProject.status}
                onChange={(e) => setEditableProject(prev => ({ ...prev, status: e.target.value as ProjectStatus}))}
                className="w-full p-1.5 text-sm bg-slate-700 text-slate-100 rounded border border-slate-600 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="in-progress">进行中</option>
                <option value="completed">已完成</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-0.5">主分类</label>
              <select
                value={selectedMainCategoryDropdownValue}
                onChange={(e) => handleMainCategoryDropdownChange(e.target.value)}
                className="w-full p-1.5 text-sm bg-slate-700 text-slate-100 rounded border border-slate-600 focus:ring-sky-500 focus:border-sky-500"
              >
                {mainCategoryDropdownOptions.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            
            {selectedMainCategoryDropdownValue === "custom" && (
              <div className="mt-1">
                <label htmlFor={`custom-main-cat-${project.id}`} className="text-xs text-slate-400 block mb-0.5">自定义主分类名称</label>
                <input
                  id={`custom-main-cat-${project.id}`}
                  type="text"
                  value={editableProject.mainCategory} 
                  onChange={(e) => handleCustomMainCategoryTextChange(e.target.value)}
                  placeholder="输入自定义主分类"
                  className="w-full p-1.5 text-sm bg-slate-700 text-slate-100 rounded border border-slate-600 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 block mb-0.5">子分类</label>
              {showCustomSubCategoryInput ? (
                <input
                    type="text"
                    value={editableProject.subCategory} 
                    onChange={(e) => handleSubCategoryChange(e.target.value)}
                    placeholder={selectedMainCategoryDropdownValue === "custom" ? "输入子分类 (可选)" : "输入自定义子分类"}
                    className="w-full p-1.5 text-sm bg-slate-700 text-slate-100 rounded border border-slate-600 focus:ring-sky-500 focus:border-sky-500"
                />
              ) : (
                 <select
                    value={(editableProject.subCategory === "" || editableProject.subCategory === "未分类") && currentSubCategoryOptions.length > 0 ? "未分类" : editableProject.subCategory}
                    onChange={(e) => {
                        if (e.target.value === "CustomSub") {
                            handleSubCategoryChange(""); 
                            setShowCustomSubCategoryInput(true);
                        } else {
                            handleSubCategoryChange(e.target.value);
                            setShowCustomSubCategoryInput(false);
                        }
                    }}
                    className="w-full p-1.5 text-sm bg-slate-700 text-slate-100 rounded border border-slate-600 focus:ring-sky-500 focus:border-sky-500"
                >
                    <option value="未分类">未分类</option>
                    {currentSubCategoryOptions.map(subCat => (
                        <option key={subCat.value} value={subCat.value}>{subCat.label}</option>
                    ))}
                     <option value="CustomSub">自定义...</option>
                </select>
              )}
            </div>
            <button onClick={handleSaveChanges} className="w-full mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded shadow-sm">
              保存更改
            </button>
            <button onClick={() => {
                setIsEditing(false);
                setEditableProject(project); 
                 if (project.mainCategory === "female") setSelectedMainCategoryDropdownValue("female");
                 else if (project.mainCategory === "male") setSelectedMainCategoryDropdownValue("male");
                 else setSelectedMainCategoryDropdownValue("custom");
                if (project.mainCategory === "female" || project.mainCategory === "male") {
                    const isPredefined = subCategories[project.mainCategory]?.some(sc => sc.value === project.subCategory);
                    const isUncategorized = project.subCategory === "未分类" || project.subCategory === "";
                    setShowCustomSubCategoryInput(!(isPredefined || isUncategorized) && project.subCategory !== "");
                } else {
                    setShowCustomSubCategoryInput(true);
                }

            }} className="w-full mt-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded shadow-sm">
              取消
            </button>
          </div>
        ) : (
          <div className="mb-3 space-y-1">
            <p className="text-sm text-slate-400">状态: <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusDisplay(editableProject.status).color}`}>{getStatusDisplay(editableProject.status).text}</span></p>
            <p className="text-sm text-slate-400">分类: <span className="font-medium text-slate-200">{displayMainCategoryLabel}</span></p>
            <p className="text-sm text-slate-400">子类: <span className="font-medium text-slate-200">
                { currentMainCatIsPreset
                    ? subCategories[project.mainCategory]?.find(sc => sc.value === editableProject.subCategory)?.label || editableProject.subCategory
                    : editableProject.subCategory || "无" 
                }
            </span></p>
            <p className="text-sm text-slate-400">章节数: <span className="font-medium text-slate-200">{editableProject.chapters?.length || 0}</span></p>
            <p className="text-sm text-slate-400">协作者: <span className="font-medium text-slate-200">{editableProject.collaborators?.length || 0}</span></p>
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            if (e.target.files[0].type === "text/plain" || e.target.files[0].name.endsWith('.txt')) {
              onContinueUpload(project.id, e.target.files[0]);
            } else {
              alert("无效的文件类型。请上传 .txt 文件。");
            }
            e.target.value = ''; 
          }
        }}
        accept=".txt"
        className="hidden"
      />
      <div className="mt-auto flex items-center space-x-2">
        <button
          onClick={() => onOpenEditor(project.id)}
          className="flex-grow flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md text-sm transition-colors"
        >
          <OpenIcon className="w-4 h-4 mr-2" /> 打开项目
        </button>
        {!isEditing && (
            <>
              <button
                onClick={() => onOpenCollaborators(project.id)}
                className="p-2 text-slate-400 hover:text-sky-400 rounded-md transition-colors"
                title="管理协作者"
              >
                <UsersIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-green-400 rounded-md transition-colors"
                title="继续上传章节"
              >
                <UploadIcon className="w-5 h-5" />
              </button>
              <button
                  onClick={handleDeleteClick}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-md transition-colors"
                  title="删除项目"
              >
                  <TrashIcon className="w-5 h-5" />
              </button>
            </>
        )}
      </div>
    </div>
  );
};

export default BookCard;