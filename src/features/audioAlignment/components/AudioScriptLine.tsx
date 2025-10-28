import React, { useState, useEffect, useCallback } from 'react';
import { ScriptLine, Character } from '../../../types';
import { useStore } from '../../../store/useStore';
import { db } from '../../../db';
import { isHexColor, getContrastingTextColor } from '../../../lib/colorUtils';
import { TrashIcon, UploadIcon, PlayIcon, PauseIcon, CheckCircleIcon, XMarkIcon, ArrowDownIcon, ArrowUpIcon } from '../../../components/ui/icons';

interface AudioScriptLineProps {
    line: ScriptLine;
    character: Character | undefined;
    projectId: string;
    chapterId: string;
    onRequestShiftDown: (lineId: string, character: Character | undefined) => void;
    onRequestShiftUp: (lineId: string, character: Character | undefined) => void;
}

const AudioScriptLine: React.FC<AudioScriptLineProps> = ({ line, character, projectId, chapterId, onRequestShiftDown, onRequestShiftUp }) => {
    const { assignAudioToLine, updateLineAudio, projects, playingLineInfo, setPlayingLine, clearPlayingLine } = useStore(state => ({
        assignAudioToLine: state.assignAudioToLine,
        updateLineAudio: state.updateLineAudio,
        projects: state.projects,
        playingLineInfo: state.playingLineInfo,
        setPlayingLine: state.setPlayingLine,
        clearPlayingLine: state.clearPlayingLine,
    }));
    const [hasAudio, setHasAudio] = useState<boolean>(!!line.audioBlobId);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const cvStyles = React.useMemo(() => {
        const currentProject = projects.find(p => p.id === projectId);
        return currentProject?.cvStyles || {};
    }, [projects, projectId]);
    
    useEffect(() => {
        setHasAudio(!!line.audioBlobId);
    }, [line.audioBlobId]);

    const handleDeleteAudio = async () => {
        if (line.audioBlobId) {
            if (playingLineInfo?.line.id === line.id) {
                clearPlayingLine();
            }
            const blobIdToDelete = line.audioBlobId;
            await updateLineAudio(projectId, chapterId, line.id, null);
            await db.audioBlobs.delete(blobIdToDelete);
        }
    };
    
    const isPlaying = playingLineInfo?.line.id === line.id;

    const handlePlayPauseClick = () => {
        if (isPlaying) {
            clearPlayingLine();
        } else if (hasAudio) {
            setPlayingLine(line, character);
        }
    };

    // --- Drag and Drop Handlers ---
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('audio/')) {
            await assignAudioToLine(projectId, chapterId, line.id, file);
        } else {
            alert('请拖拽有效的音频文件 (如 .wav, .mp3)。');
        }
    }, [assignAudioToLine, projectId, chapterId, line.id]);
    // --- End Drag and Drop Handlers ---


    const isNarration = !character || character.name.toLowerCase() === 'narrator';
    
    const rowBgClass = !isNarration && character && !isHexColor(character.color) ? character.color : 'bg-slate-700';
    const rowBgStyle = !isNarration && character && isHexColor(character.color) ? { backgroundColor: character.color } : {};
    
    const getRowTextStyle = () => {
        if (isNarration || !character) {
            return { style: {}, className: 'text-slate-100' };
        }
        
        const rowBgIsHex = isHexColor(character.color);
        const charTextIsHex = isHexColor(character.textColor || '');

        let style: React.CSSProperties = {};
        let className = '';

        if (charTextIsHex) {
            style.color = character.textColor;
        } else {
            className += ` ${character.textColor || ''}`;
        }

        if (!character.textColor) {
            if (rowBgIsHex) {
                style.color = getContrastingTextColor(character.color);
            } else {
                const darkBgPatterns = ['-700', '-800', '-900', 'slate-600', 'gray-600', 'zinc-600', 'stone-600'];
                const isDarkBg = character.color && darkBgPatterns.some(pattern => character.color.includes(pattern));
                className += isDarkBg ? ' text-slate-100' : ' text-slate-800';
            }
        }
        return { style, className };
    };
    const rowTextStyle = getRowTextStyle();
    
    const getCvChipStyle = () => {
        if (!character?.cvName) {
            return { style: {}, className: '' };
        }
        const cvName = character.cvName;
        const cvStyle = cvStyles[cvName];
        let cvBgToUse = cvStyle?.bgColor || 'bg-slate-600';
        let cvTextToUse = cvStyle?.textColor || 'text-slate-200';
        
        const bgIsHex = isHexColor(cvBgToUse);
        const textIsHex = isHexColor(cvTextToUse);
        let style: React.CSSProperties = {};
        let className = 'px-2 py-1 rounded text-xs font-medium';
        if (bgIsHex) {
            style.backgroundColor = cvBgToUse;
        } else {
            className += ` ${cvBgToUse}`;
        }
        if (textIsHex) {
            style.color = cvTextToUse;
        } else {
            className += ` ${cvTextToUse}`;
        }
        if (!cvStyle?.textColor && !textIsHex) {
             if (bgIsHex) {
                 style.color = getContrastingTextColor(cvBgToUse);
             }
        }
        return { style, className };
    };
    const cvChipStyle = getCvChipStyle();
    
    const playingClass = isPlaying ? 'outline outline-4 outline-amber-400 shadow-[0_0_25px_15px_rgba(250,204,21,0.5)]' : 'border-slate-700';
    const dragDropClasses = isDraggingOver ? 'border-sky-500 border-dashed bg-slate-600/50' : playingClass;

    return (
        <div 
            className="flex items-center gap-x-4 relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className={`p-3 rounded-lg border flex-grow flex items-center gap-x-3 transition-all duration-200 ${dragDropClasses} ${rowBgClass}`} style={rowBgStyle}>
                <div className="w-24 flex-shrink-0 flex items-center justify-start">
                    {!isNarration && character && (
                        character.cvName ? (
                            <span 
                                className={`truncate ${cvChipStyle.className}`}
                                style={cvChipStyle.style}
                                title={character.cvName}
                            >
                                {character.cvName}
                            </span>
                        ) : (
                             <span className="text-xs text-slate-400 px-2">无CV</span>
                        )
                    )}
                </div>
                
                <div 
                    className={`w-32 flex-shrink-0 text-sm truncate font-semibold ${rowTextStyle.className}`}
                    style={rowTextStyle.style}
                    title={character?.name || '旁白'}
                >
                    {character?.name || '旁白'}
                </div>

                <div className={`flex-grow ${rowTextStyle.className}`} style={rowTextStyle.style}>
                    {line.text}
                </div>
                <div className="flex-shrink-0 flex items-center space-x-2 z-10">
                    <button
                        onClick={handlePlayPauseClick}
                        disabled={!hasAudio}
                        className="p-2 rounded-full bg-slate-600 hover:bg-sky-500 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
                        title={isPlaying ? "暂停" : "播放"}
                    >
                        {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                    </button>
                    
                    <button
                        onClick={() => onRequestShiftUp(line.id, character)}
                        disabled={!line.audioBlobId}
                        className="p-2 rounded-full bg-slate-600 hover:bg-teal-500 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
                        title="向上顺移音频"
                    >
                        <ArrowUpIcon className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => onRequestShiftDown(line.id, character)}
                        disabled={!line.audioBlobId}
                        className="p-2 rounded-full bg-slate-600 hover:bg-indigo-500 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
                        title="向下顺移音频"
                    >
                        <ArrowDownIcon className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleDeleteAudio}
                        disabled={!line.audioBlobId}
                        className="p-2 rounded-full bg-slate-600 hover:bg-red-500 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
                        title="删除音频"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="w-6 flex-shrink-0 flex items-center justify-center">
              {hasAudio ? (
                  <span title="已有音频">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  </span>
              ) : (
                  <span title="暂无音频">
                    <XMarkIcon className="w-5 h-5 text-red-500" />
                  </span>
              )}
            </div>
            {isDraggingOver && (
                <div className="absolute inset-0 bg-sky-500/20 rounded-lg flex items-center justify-center pointer-events-none border-2 border-dashed border-sky-300">
                    <UploadIcon className="w-8 h-8 text-sky-200" />
                    <span className="ml-3 text-lg font-semibold text-sky-100">拖拽音频到此处以上传</span>
                </div>
            )}
        </div>
    );
};

export default AudioScriptLine;