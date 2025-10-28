import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScriptLine, Character, AudioBlob } from '../../../types';
import { useStore } from '../../../store/useStore';
import { db } from '../../../db';
import { isHexColor, getContrastingTextColor } from '../../../lib/colorUtils';
import { TrashIcon, UploadIcon, PlayIcon, PauseIcon, CheckCircleIcon, XMarkIcon, ArrowDownOnSquareIcon, ArrowUpOnSquareIcon } from '../../../components/ui/icons';

interface AudioScriptLineProps {
    line: ScriptLine;
    character: Character | undefined;
    projectId: string;
    chapterId: string;
    onRequestShiftDown: (lineId: string, character: Character | undefined) => void;
    onRequestShiftUp: (lineId: string, character: Character | undefined) => void;
}

const AudioScriptLine: React.FC<AudioScriptLineProps> = ({ line, character, projectId, chapterId, onRequestShiftDown, onRequestShiftUp }) => {
    const { assignAudioToLine, updateLineAudio, cvStyles, playingLineInfo, setPlayingLine, clearPlayingLine } = useStore(state => ({
        assignAudioToLine: state.assignAudioToLine,
        updateLineAudio: state.updateLineAudio,
        cvStyles: state.cvStyles,
        playingLineInfo: state.playingLineInfo,
        setPlayingLine: state.setPlayingLine,
        clearPlayingLine: state.clearPlayingLine,
    }));
    const [hasAudio, setHasAudio] = useState<boolean>(!!line.audioBlobId);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    
    useEffect(() => {
        setHasAudio(!!line.audioBlobId);
    }, [line.audioBlobId]);


    const handleAudioData = async (blob: Blob) => {
        await assignAudioToLine(projectId, chapterId, line.id, blob);
    };

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

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleAudioData(file);
        }
        if(fileInputRef.current) fileInputRef.current.value = "";
    };
    
    const isPlaying = playingLineInfo?.line.id === line.id;

    const handlePlayPauseClick = () => {
        if (isPlaying) {
            clearPlayingLine();
        } else if (hasAudio) {
            setPlayingLine(line, character);
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

    return (
        <div className="flex items-center gap-x-4">
            <div className={`p-3 rounded-lg border flex-grow flex items-center gap-x-3 transition-all duration-200 ${playingClass} ${rowBgClass}`} style={rowBgStyle}>
                <div className="w-24 flex-shrink-0 flex items-center justify-start">
                    {!isNarration && (
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
                <div className="flex-shrink-0 flex items-center space-x-2">
                    <button
                        onClick={handlePlayPauseClick}
                        disabled={!hasAudio}
                        className="p-2 rounded-full bg-slate-600 hover:bg-sky-500 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
                        title={isPlaying ? "暂停" : "播放"}
                    >
                        {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
                    </button>
                    
                    <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-full bg-slate-600 hover:bg-green-500 text-slate-200 hover:text-white transition-colors"
                        title="上传音频文件"
                    >
                        <UploadIcon className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => onRequestShiftUp(line.id, character)}
                        disabled={!line.audioBlobId}
                        className="p-2 rounded-full bg-slate-600 hover:bg-teal-500 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
                        title="向上顺移音频"
                    >
                        <ArrowUpOnSquareIcon className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => onRequestShiftDown(line.id, character)}
                        disabled={!line.audioBlobId}
                        className="p-2 rounded-full bg-slate-600 hover:bg-indigo-500 text-slate-200 hover:text-white transition-colors disabled:opacity-50"
                        title="向下顺移音频"
                    >
                        <ArrowDownOnSquareIcon className="w-4 h-4" />
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
        </div>
    );
};

export default AudioScriptLine;