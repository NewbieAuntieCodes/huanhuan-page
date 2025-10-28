

import React, { useState, useCallback } from 'react';
import { UploadIcon } from '../../components/ui/icons';
import { useStore } from '../../store/useStore';
import { Project } from '../../types';
import { internalParseScriptToChapters } from '../../lib/scriptParser';

const UploadPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const { addProject, navigateTo } = useStore();

  const handleFileProcessing = (file: File | undefined) => {
    if (file) {
      if (file.type === "text/plain" || file.name.endsWith('.txt')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setSelectedFile(null);
        setError("无效的文件类型。请上传 .txt 文件。");
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileProcessing(event.target.files?.[0]);
  };

  const handleUpload = useCallback(() => {
    if (!selectedFile) {
      setError("请选择要上传的文件。");
      return;
    }
    setIsUploading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const projectName = selectedFile.name.replace(/\.txt$/i, '');
        const chapters = internalParseScriptToChapters(text, projectName);

        const newProject: Project = {
          id: Date.now().toString() + "_proj",
          name: projectName,
          rawFullScript: text,
          chapters: chapters,
          status: "in-progress",
          mainCategory: "", 
          subCategory: "",  
          lastModified: Date.now(),
        };
        addProject(newProject);
        navigateTo("dashboard");
      } else {
        setError("无法读取文件内容。");
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      setError("读取文件时出错。");
      setIsUploading(false);
    };
    reader.readAsText(selectedFile);
  }, [selectedFile, addProject, navigateTo]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcessing(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const dropzoneClasses = `cursor-pointer w-full inline-flex items-center justify-center px-6 py-3 border-2 border-dashed rounded-lg transition-colors ${
    error 
    ? 'border-red-500 hover:border-red-400' 
    : isDraggingOver 
      ? 'border-sky-400 bg-slate-600' 
      : selectedFile 
        ? 'border-green-500 bg-slate-700' 
        : 'border-slate-600 hover:border-sky-500 bg-slate-700 hover:bg-slate-600'
  }`;

  return (
    <div className="p-6 md:p-10 flex flex-col items-center justify-center h-full bg-slate-900 text-slate-100">
      <div className="w-full max-w-lg bg-slate-800 p-8 rounded-xl shadow-2xl text-center">
        <UploadIcon className="w-16 h-16 text-sky-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3 text-sky-400">上传你的小说</h1>
        <p className="text-slate-400 mb-8">
          选择一个纯文本 (.txt) 文件或拖拽到此处开始创作你的音频内容。
        </p>

        <div 
            className="mb-6"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
          <label
            htmlFor="file-upload"
            className={dropzoneClasses}
          >
            <UploadIcon className={`w-5 h-5 mr-2 ${selectedFile ? 'text-green-400' : 'text-slate-400'}`} />
            <span className={`${selectedFile ? 'text-green-300' : 'text-slate-300'}`}>
              {selectedFile ? selectedFile.name : '点击选择或拖拽 .txt 文件'}
            </span>
            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".txt" onChange={handleFileChange} />
          </label>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-md
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 ease-in-out
                     focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          {isUploading ? '处理中...' : '上传并继续'}
        </button>
      </div>
      <p className="mt-8 text-sm text-slate-500">
        还没有脚本？如果您有现有项目，请导航至项目面板。
      </p>
    </div>
  );
};

export default UploadPage;