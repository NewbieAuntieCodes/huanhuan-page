import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../../store/useStore';
import { db } from '../../../db';
import { PlayIcon, PauseIcon, XMarkIcon, SpeakerWaveIcon, SpeakerXMarkIcon, ScissorsIcon, ChevronDoubleDownIcon } from '../../../components/ui/icons';
import { isHexColor, getContrastingTextColor } from '../../../lib/colorUtils';
import { ScriptLine, Character } from '../../../types';


// --- Constants for Waveform Drawing ---
const WAVE_BG_COLOR = "#475569"; // slate-600
const WAVE_PROGRESS_COLOR = "#38bdf8"; // sky-400
const PLAYHEAD_COLOR = "#f1f5f9"; // slate-100

interface GlobalAudioPlayerProps {
    onSplitRequest: (splitTime: number, lineInfo: { line: ScriptLine; character: Character | undefined; }) => void;
    onMergeRequest: (lineInfo: { line: ScriptLine; character: Character | undefined; }) => void;
    canMerge: boolean;
    mergeDisabledReason: string;
}


const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({ onSplitRequest, onMergeRequest, canMerge, mergeDisabledReason }) => {
    const { playingLineInfo, clearPlayingLine } = useStore(state => ({
        playingLineInfo: state.playingLineInfo,
        clearPlayingLine: state.clearPlayingLine,
    }));

    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const animationFrameId = useRef<number | null>(null);
    
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    // Initialize AudioContext on component mount
    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return () => {
            audioContextRef.current?.close();
        };
    }, []);

    // Effect to handle loading and decoding audio when playingLineInfo changes
    useEffect(() => {
        let objectUrl: string | null = null;
        
        const fetchAndDecodeAudio = async () => {
            if (playingLineInfo?.line.audioBlobId) {
                const audioBlob = await db.audioBlobs.get(playingLineInfo.line.audioBlobId);
                if (audioBlob && audioContextRef.current) {
                    objectUrl = URL.createObjectURL(audioBlob.data);
                    setAudioSrc(objectUrl);
                    
                    const arrayBuffer = await audioBlob.data.arrayBuffer();
                    audioContextRef.current.decodeAudioData(arrayBuffer)
                        .then(decodedBuffer => {
                            setAudioBuffer(decodedBuffer);
                        })
                        .catch(e => console.error("Error decoding audio data", e));

                } else {
                    console.error("Audio blob not found in DB or AudioContext not ready.");
                    clearPlayingLine();
                }
            } else {
                setAudioSrc(null);
                setAudioBuffer(null);
            }
        };

        fetchAndDecodeAudio();

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [playingLineInfo, clearPlayingLine]);


    // Drawing function for the waveform
    const drawWaveform = useCallback((buffer: AudioBuffer | null, progress: number) => {
        const canvas = canvasRef.current;
        if (!canvas || !buffer) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.clearRect(0, 0, width, height);
        
        // Draw background waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = WAVE_BG_COLOR;
        ctx.beginPath();
        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.moveTo(i, (1 + min) * amp);
            ctx.lineTo(i, (1 + max) * amp);
        }
        ctx.stroke();

        // Draw progress waveform
        if (progress > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width * progress, height);
            ctx.clip();
            ctx.strokeStyle = WAVE_PROGRESS_COLOR;
            ctx.beginPath();
             for (let i = 0; i < width; i++) {
                let min = 1.0;
                let max = -1.0;
                for (let j = 0; j < step; j++) {
                    const datum = data[(i * step) + j];
                    if (datum < min) min = datum;
                    if (datum > max) max = datum;
                }
                ctx.moveTo(i, (1 + min) * amp);
                ctx.lineTo(i, (1 + max) * amp);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Draw playhead
        if (progress > 0 && progress < 1) {
            ctx.beginPath();
            ctx.moveTo(width * progress, 0);
            ctx.lineTo(width * progress, height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = PLAYHEAD_COLOR;
            ctx.stroke();
        }

    }, []);

    // Animation loop for drawing progress
    const animateProgress = useCallback(() => {
        if (!audioRef.current || !audioBuffer) return;
        const progress = audioRef.current.currentTime / audioRef.current.duration;
        drawWaveform(audioBuffer, progress);
        animationFrameId.current = requestAnimationFrame(animateProgress);
    }, [audioBuffer, drawWaveform]);

    // Effect to start/stop animation
    useEffect(() => {
        if (isPlaying && audioBuffer) {
            animationFrameId.current = requestAnimationFrame(animateProgress);
        } else if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            // Draw one last time to ensure correct state is shown when paused
            if(audioRef.current && audioBuffer){
                const progress = audioRef.current.currentTime / audioRef.current.duration;
                drawWaveform(audioBuffer, progress);
            }
        }
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isPlaying, audioBuffer, animateProgress, drawWaveform]);

    // Effect to manually update waveform when seeking while paused
    useEffect(() => {
        // Redraw waveform if currentTime is changed manually while paused
        if (audioRef.current?.paused && audioBuffer && duration > 0) {
            const progress = currentTime / duration;
            if (!isNaN(progress)) {
                drawWaveform(audioBuffer, progress);
            }
        }
    }, [currentTime, duration, audioBuffer, drawWaveform]);


    // Initial draw when audio buffer is ready
    useEffect(() => {
        if (audioBuffer && canvasRef.current) {
            // Set canvas size based on its display size for high-DPI screens
            const canvas = canvasRef.current;
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            const ctx = canvas.getContext('2d');
            ctx?.scale(dpr, dpr);

            drawWaveform(audioBuffer, 0);
        }
    }, [audioBuffer, drawWaveform]);
    

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };
    
    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
            // Programmatically play and handle promise, instead of using autoPlay attribute
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    // This is expected if the user navigates away or plays another audio quickly.
                    console.log("Audio auto-play was prevented or interrupted:", error);
                });
            }
        }
    };

    const handlePlayPause = () => {
        if (audioRef.current) {
            if (audioRef.current.paused) {
                const playPromise = audioRef.current.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Manual play was interrupted or failed:", error);
                    });
                }
            } else {
                audioRef.current.pause();
            }
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
        if (newVolume > 0) {
            setIsMuted(false);
        }
    };

    const handleMuteToggle = () => {
        setIsMuted(prev => {
            const newMutedState = !prev;
            if (audioRef.current) {
                audioRef.current.muted = newMutedState;
            }
            if (!newMutedState && volume === 0) {
                setVolume(1);
                 if (audioRef.current) audioRef.current.volume = 1;
            }
            return newMutedState;
        });
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !audioRef.current || !duration) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = x / rect.width;
        const newTime = progress * duration;
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || time === 0) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!playingLineInfo) {
        return null;
    }

    const { line, character } = playingLineInfo;
    const isNarration = !character || character.name.toLowerCase() === 'narrator';
    
    const getPanelStyle = () => {
        if (isNarration || !character) {
            return { style: {}, className: 'bg-slate-700 text-slate-100' };
        }
        const bgIsHex = isHexColor(character.color);
        let style: React.CSSProperties = {};
        let className = '';
        if (bgIsHex) style.backgroundColor = character.color;
        else className += ` ${character.color || 'bg-slate-700'}`;
        if (character.textColor) {
            if (isHexColor(character.textColor)) style.color = character.textColor;
            else className += ` ${character.textColor}`;
        } else {
            if (bgIsHex) style.color = getContrastingTextColor(character.color);
            else className += ' text-white';
        }
        return { style, className };
    };
    const panelStyle = getPanelStyle();

    const canSplit = playingLineInfo && duration > 0 && currentTime > 0.1 && currentTime < duration - 0.1;

    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 h-28 bg-slate-800 border-t border-slate-700 shadow-lg z-50 flex items-center p-4 transition-transform duration-300 ease-in-out ${playingLineInfo ? 'translate-y-0' : 'translate-y-full'}`}
            aria-label="Global Audio Player"
            role="region"
        >
            <audio
                ref={audioRef}
                src={audioSrc || ''}
                onEnded={() => {
                    setIsPlaying(false);
                }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                muted={isMuted}
            />

            <button onClick={handlePlayPause} className="p-3 bg-slate-600 hover:bg-sky-500 rounded-full mr-4" aria-label={isPlaying ? "Pause audio" : "Play audio"}>
                {isPlaying ? <PauseIcon className="w-6 h-6 text-white" /> : <PlayIcon className="w-6 h-6 text-white" />}
            </button>
            <button onClick={() => canSplit && playingLineInfo && onSplitRequest(currentTime, playingLineInfo)} disabled={!canSplit} className="p-3 bg-slate-600 hover:bg-orange-500 rounded-full mr-4 disabled:opacity-50 disabled:cursor-not-allowed" aria-label={"Split audio at current position"}>
                <ScissorsIcon className="w-6 h-6 text-white" />
            </button>
            <button 
                onClick={() => canMerge && playingLineInfo && onMergeRequest(playingLineInfo)} 
                disabled={!canMerge} 
                className={`p-3 rounded-full mr-4 transition-colors disabled:cursor-not-allowed ${canMerge ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 opacity-60'}`}
                title={mergeDisabledReason}
                aria-label={mergeDisabledReason}
            >
                <ChevronDoubleDownIcon className="w-6 h-6 text-white" />
            </button>


            <div className="flex-grow flex flex-col justify-center space-y-2 overflow-hidden h-full">
                <div 
                    className="text-sm text-slate-300 truncate"
                    title={line.text}
                >
                    <span 
                        className={`font-bold mr-2 py-0.5 px-2 rounded-md ${panelStyle.className}`} 
                        style={panelStyle.style}
                    >
                       {character?.name || '旁白'}
                    </span>
                    {line.text}
                </div>

                <div className="flex items-center space-x-2 w-full h-12">
                    <span className="text-xs text-slate-400 w-10 text-right" aria-label="Current time">{formatTime(currentTime)}</span>
                    <canvas 
                        ref={canvasRef}
                        className="flex-grow h-full cursor-pointer"
                        onClick={handleCanvasClick}
                        aria-label="Audio waveform and progress"
                    />
                    <span className="text-xs text-slate-400 w-10" aria-label="Total duration">{formatTime(duration)}</span>
                </div>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
                <button onClick={handleMuteToggle} className="p-1 text-slate-400 hover:text-white" aria-label={isMuted ? "Unmute" : "Mute"}>
                    {isMuted || volume === 0 ? <SpeakerXMarkIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                </button>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:bg-sky-400"
                    aria-label="Volume control"
                />
            </div>

            <button onClick={clearPlayingLine} className="p-2 ml-2 text-slate-400 hover:text-white" aria-label="Close player">
                <XMarkIcon className="w-5 h-5" />
            </button>
        </div>
    );
};

export default GlobalAudioPlayer;