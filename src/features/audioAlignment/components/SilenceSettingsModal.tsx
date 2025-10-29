import React, { useState, useEffect } from 'react';
import { Project, SilenceSettings, SilencePairing } from '../../../types';
import { useStore } from '../../../store/useStore';
import { XMarkIcon } from '../../../components/ui/icons';
import NumberInput from '../../../components/ui/NumberInput';
import { defaultSilenceSettings } from '../../../lib/defaultSilenceSettings';

interface SilenceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

const pairLabels: { key: SilencePairing, labels: [string, string] }[] = [
    { key: 'narration-to-narration', labels: ['旁白', '旁白'] },
    { key: 'narration-to-dialogue', labels: ['旁白', '对白'] },
    { key: 'narration-to-sfx', labels: ['旁白', '音效'] },
    { key: 'dialogue-to-dialogue', labels: ['对白', '对白'] },
    { key: 'dialogue-to-narration', labels: ['对白', '旁白'] },
    { key: 'dialogue-to-sfx', labels: ['对白', '音效'] },
    { key: 'sfx-to-dialogue', labels: ['音效', '对白'] },
    { key: 'sfx-to-narration', labels: ['音效', '旁白'] },
    { key: 'sfx-to-sfx', labels: ['音效', '音效'] },
];

const typeColors: Record<string, string> = {
    '旁白': 'bg-purple-800 text-purple-200',
    '对白': 'bg-sky-800 text-sky-200',
    '音效': 'bg-amber-800 text-amber-200'
};

const SilenceSettingsModal: React.FC<SilenceSettingsModalProps> = ({ isOpen, onClose, project }) => {
    const { updateProjectSilenceSettings } = useStore();
    const [settings, setSettings] = useState<SilenceSettings>(project.silenceSettings || defaultSilenceSettings);

    useEffect(() => {
        if (isOpen) {
            setSettings(project.silenceSettings || defaultSilenceSettings);
        }
    }, [isOpen, project.silenceSettings]);
    
    const handleSave = () => {
        updateProjectSilenceSettings(project.id, settings);
        onClose();
    };
    
    const handlePairChange = (key: SilencePairing, value: number) => {
        setSettings(prev => ({
            ...prev,
            pairs: {
                ...prev.pairs,
                [key]: value
            }
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-slate-100">间隔配置</h2>
                     <div className="flex items-center gap-x-2">
                        <label htmlFor="preset-select" className="text-sm text-slate-400">配置:</label>
                        <select id="preset-select" className="bg-slate-700 border border-slate-600 text-white text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 p-2">
                            <option>默认</option>
                        </select>
                    </div>
                </div>
                
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-md">
                        <span className="font-medium text-slate-200">起始留白</span>
                        <div className="flex items-center gap-x-2">
                            <NumberInput
                                value={settings.startPadding}
                                onChange={val => setSettings(prev => ({ ...prev, startPadding: val }))}
                                step={0.1}
                                min={0}
                                precision={1}
                            />
                             <span className="text-sm text-slate-400 w-4">s</span>
                        </div>
                    </div>
                    {pairLabels.map(({ key, labels }) => (
                         <div key={key} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-md">
                            <div className="flex items-center gap-x-2">
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${typeColors[labels[0]]}`}>{labels[0]}</span>
                                <span className="text-slate-400">-</span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${typeColors[labels[1]]}`}>{labels[1]}</span>
                                <span className="ml-4 text-sm text-slate-400">间隔时间</span>
                            </div>
                             <div className="flex items-center gap-x-2">
                                <NumberInput 
                                    value={settings.pairs[key]}
                                    onChange={(val) => handlePairChange(key, val)}
                                    step={0.1}
                                    min={0}
                                    precision={1}
                                />
                                <span className="text-sm text-slate-400 w-4">s</span>
                            </div>
                        </div>
                    ))}
                     <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-md">
                        <span className="font-medium text-slate-200">结束留白</span>
                        <div className="flex items-center gap-x-2">
                            <NumberInput
                                value={settings.endPadding}
                                onChange={val => setSettings(prev => ({ ...prev, endPadding: val }))}
                                step={0.1}
                                min={0}
                                precision={1}
                            />
                            <span className="text-sm text-slate-400 w-4">s</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md">
                        取消
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SilenceSettingsModal;
