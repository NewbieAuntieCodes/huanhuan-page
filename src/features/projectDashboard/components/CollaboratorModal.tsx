
import React, { useState } from 'react';
import { Project } from '../../../types';
import { XMarkIcon, UserPlusIcon } from '../../../components/ui/icons';

interface CollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onAddCollaborator: (projectId: string, username: string, role: 'reader' | 'editor') => void;
}

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ isOpen, onClose, project, onAddCollaborator }) => {
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'reader' | 'editor'>('reader');

  if (!isOpen || !project) return null;

  const handleAddClick = () => {
    if (!username.trim()) {
      alert("请输入用户名。");
      return;
    }
    onAddCollaborator(project.id, username.trim(), role);
    setUsername('');
    setRole('reader');
  };

  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={handleModalContentClick}>
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-100">
            管理项目协作者: <span className="text-sky-400">{project.name}</span>
          </h2>
          <button onClick={onClose} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-full text-sky-300">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 rounded-md">
            <h3 className="text-lg font-medium text-slate-200 mb-3">邀请协作者</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">用户名</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="输入被邀请用户的准确名称"
                  className="w-full p-2 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500"
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-1">分配角色</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'reader' | 'editor')}
                  className="w-full p-2 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500"
                >
                  <option value="reader">阅读者 (只读)</option>
                  <option value="editor">编辑者 (可编辑)</option>
                </select>
              </div>
              <button
                onClick={handleAddClick}
                className="flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-md text-sm transition-colors"
              >
                <UserPlusIcon className="w-4 h-4 mr-2" />
                添加协作者
              </button>
            </div>
          </div>

          <div className="p-4 rounded-md bg-slate-850">
            <h3 className="text-lg font-medium text-slate-200 mb-3">
              当前协作者 ({project.collaborators?.length || 0})
            </h3>
            {(!project.collaborators || project.collaborators.length === 0) ? (
              <p className="text-sm text-slate-400">此项目尚无协作者。</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {project.collaborators.map(collab => (
                  <li key={collab.id} className="flex justify-between items-center bg-slate-700 p-2 rounded">
                    <span className="font-medium text-slate-100">{collab.username}</span>
                    <span className="text-sm text-slate-300 px-2 py-0.5 bg-slate-600 rounded-full">
                      {collab.role === 'reader' ? '阅读者' : '编辑者'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-md text-sm">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollaboratorModal;