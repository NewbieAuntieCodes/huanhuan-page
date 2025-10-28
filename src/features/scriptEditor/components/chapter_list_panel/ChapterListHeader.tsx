import React from 'react';
import { Project } from '../../../../types';

interface ChapterListHeaderProps {
  project: Project;
  currentPage: number;
  totalPages: number;
  filteredCount: number;
}

const ChapterListHeader: React.FC<ChapterListHeaderProps> = ({
  project,
  currentPage,
  totalPages,
  filteredCount,
}) => {
  return (
    <>
      <h2 className="text-xl font-semibold mb-1 text-sky-400 truncate" title={project.name}>
        {project.name}
      </h2>
      <p className="text-xs text-slate-400 mb-3">
        {project.chapters.length === filteredCount
          ? `(${project.chapters.length} 个章节 - 第 ${currentPage} 页 / 共 ${totalPages} 页)`
          : `(筛选出 ${filteredCount} / ${project.chapters.length} 个章节 - 第 ${currentPage} 页 / 共 ${totalPages} 页)`
        }
      </p>
    </>
  );
};

export default ChapterListHeader;