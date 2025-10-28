import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PlayIcon, PauseIcon, XMarkIcon, ScissorsIcon } from '../../../components/ui/icons';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const WAVE_BG_COLOR = "#475569";
const WAVE_PROGRESS_COLOR = "#38bdf8";
const PLAYHEAD_COLOR = "#f1f5f9";

interface GeneratedAudioPlayerProps {
  audioUrl: string;
  audioContext: AudioContext | null;
  onDelete: () => void;
  isActive: boolean;
  onActivate: () => void;
}

const GeneratedAudioPlayer: React.FC<GeneratedAudioPlayerProps> = ({ audioUrl, audioContext, onDelete, isActive, onActivate }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number | null>(null);

    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shouldPlayOnLoad, setShouldPlayOnLoad] = useState(false);

    useEffect(() => {
        const fetchAndDecodeAudio = async () => {
            if (audioUrl && audioContext && isActive) {
                setIsLoading(true);
                setError(null);
                setAudioBuffer(null);
                if (audioRef.current) audioRef.current.src = audioUrl;

                try {
                    const response = await fetch(audioUrl);
                    if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    setAudioBuffer(decodedBuffer);
                } catch (e) {
                    console.error("Error decoding audio data:", e);
                    setError("无法加载音频");
                    setAudioBuffer(null);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchAndDecodeAudio();
    }, [audioUrl, audioContext, isActive]);

    useEffect(() => {
        if (!isActive && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            audioRef.current.load();
            setAudioBuffer(null);
            setCurrentTime(0);
            setDuration(0);
            setIsPlaying(false);
            setError(null);
        }
    }, [isActive]);

    const drawWaveform = useCallback((buffer: AudioBuffer | null, progress: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if(canvas.width !== rect.width * dpr) canvas.width = rect.width * dpr;
        if(canvas.height !== rect.height * dpr) canvas.height = rect.height * dpr;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.scale(dpr, dpr);
        const width = rect.width;
        const height = rect.height;

        ctx.clearRect(0, 0, width, height);

        if (!buffer) return;
        
        const data = buffer.getChannelData(0);
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.lineWidth = 1;
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
            ctx.moveTo(i + 0.5, (1 + min) * amp);
            ctx.lineTo(i + 0.5, (1 + max) * amp);
        }
        ctx.stroke();

        if (progress > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, width * progress, height);
            ctx.clip();
            ctx.strokeStyle = WAVE_PROGRESS_COLOR;
            ctx.stroke(); // Re-stroke the same path, but clipped
            ctx.restore();
        }
        
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    }, []);

    const animateProgress = useCallback(() => {
        if (!audioRef.current || !audioBuffer || !isActive) return;
        const progress = audioRef.current.currentTime / audioRef.current.duration;
        drawWaveform(audioBuffer, progress);
        animationFrameId.current = requestAnimationFrame(animateProgress);
    }, [audioBuffer, drawWaveform, isActive]);

    useEffect(() => {
        if (audioBuffer) {
            drawWaveform(audioBuffer, 0);
        } else {
            drawWaveform(null, 0);
        }
    }, [audioBuffer, drawWaveform]);

    useEffect(() => {
        if (isPlaying) {
            animationFrameId.current = requestAnimationFrame(animateProgress);
        } else {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            if (audioRef.current && audioBuffer) {
                const progress = audioRef.current.currentTime / audioRef.current.duration;
                drawWaveform(audioBuffer, progress);
            }
        }
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isPlaying, animateProgress, audioBuffer, drawWaveform]);

    const handlePlayPause = () => {
        if (!isActive) {
            setShouldPlayOnLoad(true);
            onActivate();
        } else if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play().catch(e => console.log("Play interrupted or failed:", e));
            }
        }
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!canvasRef.current || !audioRef.current || !duration) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = x / rect.width;
        audioRef.current.currentTime = progress * duration;
    };

    const formatTime = (time: number) => {
        if (isNaN(time) || time < 0) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleCut = () => {
        alert('音频剪辑功能待实现。');
    };

    return (
        <div className="w-full bg-slate-700/50 p-1.5 rounded-lg border border-slate-700 relative">
            <button onClick={onDelete} className="absolute top-1 right-1 p-1 text-slate-500 hover:text-white" title="删除生成的音频">
                <XMarkIcon className="w-4 h-4" />
            </button>
            <div className="w-full flex items-center gap-2 pr-6">
                <audio
                    ref={audioRef}
                    onLoadedMetadata={() => {
                        setDuration(audioRef.current?.duration || 0);
                        if (shouldPlayOnLoad && audioRef.current) {
                            audioRef.current.play().catch(e => console.log("Play on load failed:", e));
                            setShouldPlayOnLoad(false);
                        }
                    }}
                    onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    preload="metadata"
                />
                <button onClick={handlePlayPause} disabled={isLoading || !audioUrl} className="p-2 bg-slate-700 hover:bg-sky-500 rounded-full disabled:opacity-50 disabled:cursor-not-allowed">
                    {isPlaying && isActive ? <PauseIcon className="w-4 h-4 text-white" /> : <PlayIcon className="w-4 h-4 text-white" />}
                </button>
                <div className="flex-grow h-10 relative">
                    {isLoading && isActive && <div className="absolute inset-0 flex items-center justify-center"><LoadingSpinner/></div>}
                    {error && isActive && <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400">{error}</div>}
                    <canvas ref={canvasRef} onClick={handleCanvasClick} className={`w-full h-full cursor-pointer ${isLoading || error ? 'opacity-20' : ''}`} />
                </div>
                <div className="text-xs text-slate-400 font-mono w-16 text-center">
                    {isActive ? formatTime(currentTime) : '-:--'} / {isActive ? formatTime(duration) : '-:--'}
                </div>
                <button onClick={handleCut} className="p-2 text-slate-500 hover:text-white" title="剪辑音频 (待开发)">
                    <ScissorsIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default GeneratedAudioPlayer;
