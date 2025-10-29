import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScriptLine, Character, LineType, SilencePairing } from '../../../types';
import { useStore } from '../../../store/useStore';
import { db } from '../../../db';
import { isHexColor, getContrastingTextColor } from '../../../lib/colorUtils';
import { TrashIcon, UploadIcon, PlayIcon, PauseIcon, CheckCircleIcon, XMarkIcon, ArrowDownIcon, ArrowUpIcon, ReturnIcon, ArrowPathIcon } from '../../../components/ui/icons';
import NumberInput from '../../../components/ui/NumberInput';

interface AudioScriptLineProps {
    line: ScriptLine;
    nextLine?: ScriptLine;
    character: Character | undefined;
    projectId: string;
    chapterId: string;
    onRequestShiftDown: (lineId: string, character: Character | undefined) => void;
    onRequestShiftUp: (lineId: string, character: Character | undefined) => void;
}

const getLineType = (line: ScriptLine | undefined, characters: Character[]): LineType => {
    if (!line || !line.characterId) return 'narration';
    const character = characters.find(c => c.id === line.characterId);
    if (!character || character.name === 'Narrator' || character.name === '[静音]') return 'narration';
    if (character.name === '音效') return 'sfx';
    return 'dialogue';
};

const SilenceEditor: React.FC<{
    line: ScriptLine,
    nextLine?: ScriptLine,
}> = ({ line, nextLine }) => {
    const { projects, characters, updateLinePostSilence, selectedProjectId, selectedChapterId } = useStore();
    const [isEditing, setIsEditing] = useState(false);
    const [editingValue, setEditingValue] = useState(0);

    const project = projects.find(p => p.id === selectedProjectId);
    const silenceSettings = project?.silenceSettings;

    const effectiveSilence = useMemo(() => {
        if (line.postSilence !== undefined && line.postSilence !== null) {
            return line.postSilence;
        }
        if (!silenceSettings) return 1.0;
        if (!nextLine) return silenceSettings.endPadding;

        const currentType = getLineType(line, characters);
        const nextType = getLineType(nextLine, characters);
        const pairKey = `${currentType}-to-${nextType}` as SilencePairing;
        return silenceSettings.pairs[pairKey] ?? 1.0;
    }, [line, nextLine, characters, silenceSettings]);

    const handleSave = () => {
        if (selectedProjectId && selectedChapterId) {
            updateLinePostSilence(selectedProjectId, selectedChapterId, line.id, editingValue);
        }
        setIsEditing(false);
    };
    
    const handleReset = () => {
        if (selectedProjectId && selectedChapterId) {
            updateLinePostSilence(selectedProjectId, selectedChapterId, line.id, undefined);
        }
        setIsEditing(false);
    }
    
    if (isEditing) {
        return (
            <div className="flex items-center gap-x-1" onBlur={handleSave}>
                <NumberInput 
                    value={editingValue} 
                    onChange={setEditingValue} 
                    step={0.1}
                    min={0}
                    precision={1}
                />
                 <span className="text-xs text-slate-400">s</span>
                 <button onClick={handleReset} className="p-1 text-slate-400 hover:text-sky-300" title="恢复默认值">
                    <ArrowPathIcon className="w-4 h-4" />
                 </button>
            </div>
        );
    }

    const isOverridden = line.postSilence !== undefined && line.postSilence !== null;

    return (
        <button 
            onClick={() => {
                setEditingValue(effectiveSilence);
                setIsEditing(true);
            }}
            className={`px-2 py-1 rounded-md text-sm transition-colors ${isOverridden ? 'bg-sky-800 text-sky-200 font-semibold' : 'bg-slate-800/50 text-slate-400'}`}
            title={isOverridden ? "自定义间隔 (点击编辑)" : "默认间隔 (点击编辑)"}
        >
            {effectiveSilence.toFixed(1)}s
        </button>
    );
}


const AudioScriptLine: React.FC<AudioScriptLineProps> = ({ line, nextLine, character, projectId, chapterId, onRequestShiftDown, onRequestShiftUp }) => {
    const { 
        assignAudioToLine, 
        updateLineAudio, 
        projects, 
        playingLineInfo, 
        setPlayingLine, 
        clearPlayingLine,
        toggleLineReturnMark,
        updateLineFeedback,
    } = useStore(state => ({
        assignAudioToLine: state.assignAudioToLine,
        updateLineAudio: state.updateLineAudio,
        projects: state.projects,
        playingLineInfo: state.playingLineInfo,
        setPlayingLine: state.setPlayingLine,
        clearPlayingLine: state.clearPlayingLine,
        toggleLineReturnMark: state.toggleLineReturnMark,
        updateLineFeedback: state.updateLineFeedback,
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

    const handleFeedbackBlur = (e: React.FocusEvent<HTMLDivElement>) => {
        const newFeedback = e.currentTarget.innerText;
        if (newFeedback !== (line.feedback || '')) {
            updateLineFeedback(projectId, chapterId, line.id, newFeedback);
        }
    };

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
            className="relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div className="flex items-center gap-x-2">
                <div className={`p-3 rounded-lg border flex-grow flex items-center gap-x-2 transition-all duration-200 ${dragDropClasses} ${rowBgClass}`} style={rowBgStyle}>
                    <div className="w-20 flex-shrink-0 flex items-center justify-start">
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
                        className={`w-24 flex-shrink-0 text-sm truncate font-semibold ${rowTextStyle.className}`}
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
                <div className="flex-shrink-0 flex items-center justify-end gap-x-2">
                  {hasAudio ? (
                      <span title="已有音频">
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                      </span>
                  ) : (
                      <span title="暂无音频">
                        <XMarkIcon className="w-5 h-5 text-red-500" />
                      </span>
                  )}
                   <button
                        onClick={() => toggleLineReturnMark(projectId, chapterId, line.id)}
                        title={line.isMarkedForReturn ? "取消返工标记" : "标记为返工"}
                        className={`transition-colors p-1 rounded-full ${line.isMarkedForReturn ? 'text-red-500 hover:text-red-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                      <ReturnIcon className="w-5 h-5" />
                   </button>
                   <SilenceEditor line={line} nextLine={nextLine} />
                </div>
            </div>
            <div 
                className={`transition-all duration-300 ease-in-out overflow-hidden ${line.isMarkedForReturn ? 'max-h-40 mt-1.5' : 'max-h-0'}`}
            >
                {line.isMarkedForReturn && (
                    <div className="pl-[12.75rem] pr-[8.5rem]">
                         <div className="bg-slate-800/70 border border-dashed border-red-500/50 rounded-md p-2">
                            {/* FIX: Replaced the invalid 'placeholder' attribute on a content-editable div with a 'data-placeholder' attribute and Tailwind CSS utilities. The 'empty:before:' pseudo-class is used to display the placeholder text when the div is empty, fixing the TypeScript error while preserving functionality. */}
                            <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={handleFeedbackBlur}
                                className="w-full text-sm text-red-300 outline-none focus:ring-0 whitespace-pre-wrap min-h-[24px] empty:before:content-[attr(data-placeholder)] empty:before:text-red-300/50"
                                data-placeholder="在此处输入反馈意见..."
                                dangerouslySetInnerHTML={{ __html: line.feedback || '' }}
                            />
                        </div>
                    </div>
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