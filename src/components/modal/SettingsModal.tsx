
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { ApiSettings, AiProvider } from '../../store/slices/uiSlice';
import { XMarkIcon } from '../ui/icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const providerDetails: Record<AiProvider, { name: string, fields: ('apiKey' | 'baseUrl' | 'model')[] }> = {
    gemini: { name: 'Gemini', fields: ['apiKey'] },
    openai: { name: 'OpenAI (GPT)', fields: ['apiKey', 'baseUrl', 'model'] },
    moonshot: { name: 'Moonshot (月之暗面)', fields: ['apiKey', 'baseUrl', 'model'] },
    deepseek: { name: 'DeepSeek (深度求索)', fields: ['apiKey', 'baseUrl', 'model'] },
};

const fieldLabels: Record<string, string> = {
    apiKey: 'API Key',
    baseUrl: 'API Base URL',
    model: 'Model Name'
};


const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const storeApiSettings = useStore(state => state.apiSettings);
    const setApiSettings = useStore(state => state.setApiSettings);
    const [localSettings, setLocalSettings] = useState<ApiSettings>(storeApiSettings);
    const [activeTab, setActiveTab] = useState<AiProvider>('gemini');

    useEffect(() => {
        if (isOpen) {
            setLocalSettings(storeApiSettings);
        }
    }, [isOpen, storeApiSettings]);

    const handleSave = () => {
        setApiSettings(localSettings);
        onClose();
    };

    const handleInputChange = (provider: AiProvider, field: keyof ApiSettings[AiProvider], value: string) => {
        setLocalSettings(prev => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                [field]: value
            }
        }));
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-700">
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-2xl font-semibold text-slate-100">API 设置</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-white"><XMarkIcon /></button>
                </div>

                <div className="flex-grow flex md:flex-row flex-col gap-6 overflow-hidden">
                    <div className="flex md:flex-col flex-row border-b md:border-b-0 md:border-r border-slate-700 -mx-6 px-6 md:pr-6 md:-my-6 py-4 md:py-6 overflow-x-auto">
                        {(Object.keys(providerDetails) as AiProvider[]).map(provider => (
                             <button 
                                key={provider} 
                                onClick={() => setActiveTab(provider)}
                                className={`px-4 py-2 text-sm font-medium rounded-md whitespace-nowrap text-left ${activeTab === provider ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                             >
                                {providerDetails[provider].name}
                             </button>
                        ))}
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-2">
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-sky-400">{providerDetails[activeTab].name} 设置</h3>
                            {providerDetails[activeTab].fields.map(field => (
                                <div key={field}>
                                    <label htmlFor={`${activeTab}-${field}`} className="block text-sm font-medium text-slate-300 mb-1">
                                        {fieldLabels[field]}
                                    </label>
                                    <input
                                        type="text"
                                        id={`${activeTab}-${field}`}
                                        value={localSettings[activeTab][field as keyof typeof localSettings[AiProvider]] || ''}
                                        onChange={(e) => handleInputChange(activeTab, field as any, e.target.value)}
                                        className="w-full p-2 bg-slate-700 text-slate-100 rounded-md border border-slate-600 focus:ring-sky-500"
                                        placeholder={
                                            field === 'apiKey' ? 'Enter your API key' :
                                            field === 'baseUrl' ? 'Enter the API endpoint URL' :
                                            'Enter model name (e.g., gpt-4-turbo)'
                                        }
                                    />
                                </div>
                            ))}
                             {activeTab === 'gemini' && (
                                <p className="text-xs text-slate-400">注意：此处填写的 API 密钥将作为备用。官方 Gemini SDK 会自动处理 API 地址，因此无需手动填写 URL。</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 mt-4 border-t border-slate-700 flex-shrink-0 space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md">
                        取消
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md">
                        保存设置
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
