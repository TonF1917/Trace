import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ArrowLeft, Save, Key, Server, Cpu, ShieldCheck, Box, ChevronDown, Bot, Database, Search, Zap, Network, Brain, Sparkles, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { apiConfig, setApiConfig } = useStore();
  
  const [formData, setFormData] = useState({
    provider: apiConfig.provider || 'freellmapi',
    baseUrl: apiConfig.baseUrl || 'http://localhost:8000/v1/chat/completions',
    apiKey: apiConfig.apiKey || 'freellmapi-96146ee70cfe916f131303a9dee491c45f5c979f6e9fe93c',
    model: apiConfig.model || 'auto',
    customSystemPrompt: apiConfig.customSystemPrompt || ''
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imgErrors, setImgErrors] = useState({});

  const renderIcon = (id, className) => {
    if (id === 'lmstudio') return <Cpu className={className} />;
    if (id === 'siliconflow') return <Zap className={className} />;
    
    const urlMap = {
      openai: 'openai.svg',
      ollama: 'ollama.svg',
      deepseek: 'deepseek-color.svg',
      openrouter: 'openrouter.svg',
      anthropic: 'anthropic.svg',
      gemini: 'gemini-color.svg'
    };
    
    if (urlMap[id] && !imgErrors[id]) {
      return (
        <img 
          src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${urlMap[id]}`} 
          className={className} 
          onError={() => setImgErrors(prev => ({ ...prev, [id]: true }))}
          alt={id} 
        />
      );
    }
    
    const Fallback = { openai: Bot, ollama: Database, deepseek: Search, openrouter: Network, anthropic: Brain, gemini: Sparkles }[id] || Bot;
    return <Fallback className={className} />;
  };

  const getProviderDefaults = (provider) => {
    switch(provider) {
      case 'freellmapi':
        return {
          url: 'http://localhost:8000/v1/chat/completions',
          model: 'auto',
          apiKey: 'freellmapi-96146ee70cfe916f131303a9dee491c45f5c979f6e9fe93c',
          desc: t('FreeLLMAPI (Default) - Unified key pre-configured. Pools free providers (Cohere, Gemini, GitHub, Mistral, Zhipu, etc.). You can switch API provider, key, or base URL at any time.')
        };
      case 'lmstudio':
        return {
          url: 'http://localhost:1234/v1/chat/completions',
          model: 'local-model',
          apiKey: 'lm-studio',
          desc: 'Connects directly to your local LM Studio instance. Make sure the local server is running on port 1234.'
        };
      case 'ollama':
        return {
          url: 'http://localhost:11434/v1/chat/completions',
          model: 'llama3',
          apiKey: 'ollama',
          desc: 'Connects directly to your local Ollama instance. Make sure Ollama is running on port 11434.'
        };
      case 'deepseek':
        return {
          url: 'https://api.deepseek.com/chat/completions',
          model: 'deepseek-chat',
          apiKey: '',
          desc: 'Connects to DeepSeek API.'
        };
      case 'openrouter':
        return {
          url: 'https://openrouter.ai/api/v1/chat/completions',
          model: 'openai/gpt-4o-mini',
          apiKey: '',
          desc: 'Connects to OpenRouter. Allows routing to hundreds of different LLMs.'
        };
      case 'siliconflow':
        return {
          url: 'https://api.siliconflow.cn/v1/chat/completions',
          model: 'deepseek-ai/DeepSeek-V3',
          apiKey: '',
          desc: 'Connects to SiliconFlow API.'
        };
      case 'anthropic':
        return {
          url: 'https://api.anthropic.com/v1/messages',
          model: 'claude-3-5-sonnet-20240620',
          apiKey: '',
          desc: 'Connects directly to the official Anthropic Claude API.'
        };
      case 'gemini':
        return {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/',
          model: 'gemini-1.5-pro',
          apiKey: '',
          desc: 'Connects directly to the official Google Gemini API.'
        };
      case 'openai':
      default:
        return {
          url: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4o-mini',
          apiKey: '',
          desc: 'Supports any OpenAI-compatible API.'
        };
    }
  };

  const handleProviderSelect = (newProvider) => {
    const defaults = getProviderDefaults(newProvider);
    setFormData({
      ...formData,
      provider: newProvider,
      baseUrl: defaults.url,
      model: defaults.model,
      apiKey: defaults.apiKey || formData.apiKey
    });
    setIsDropdownOpen(false);
  };

  const providersList = [
    { id: 'freellmapi', name: t('FreeLLMAPI (Default API)'), icon: Key },
    { id: 'openai', name: t('OpenAI & Compatible (Standard)'), icon: Bot },
    { id: 'lmstudio', name: t('LM Studio (Local)'), icon: Cpu },
    { id: 'ollama', name: t('Ollama (Local)'), icon: Database },
    { id: 'deepseek', name: 'DeepSeek', icon: Search },
    { id: 'siliconflow', name: t('SiliconFlow'), icon: Zap },
    { id: 'openrouter', name: 'OpenRouter', icon: Network },
    { id: 'anthropic', name: 'Anthropic (Claude)', icon: Brain },
    { id: 'gemini', name: 'Google (Gemini)', icon: Sparkles },
  ];

  const currentDefaults = getProviderDefaults(formData.provider);
  
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setApiConfig(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-6">
      <div className="max-w-2xl w-full">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-8 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('Back to Dashboard')}
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-8 py-6">
            <h1 className="text-2xl font-bold text-white tracking-tight">{t('API Configuration')}</h1>
            <p className="text-slate-400 mt-2 text-sm">{t('Trace processes all data locally on your device. Configure your LLM provider here to enable automated framing analysis.')}</p>
          </div>
          
          <form onSubmit={handleSave} className="p-8 space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex gap-3 items-start">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-800">{t('Privacy & Security Guarantee')}</h4>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                  {t('This is a fully local open-source project with ')}<strong>{t('no hidden telemetry or data collection')}</strong>{t('. Aside from direct requests to the API endpoint you provide below, your data and API Key never leave your local browser. There is zero risk of your API Key being leaked.')}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Box className="w-4 h-4 text-rose-500" />
                  {t('API Provider')}
                </label>
              </div>
              
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none flex items-center justify-between hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {renderIcon(formData.provider, "w-5 h-5 object-contain")}
                    <span className="text-slate-700 font-bold text-sm">
                      {providersList.find(p => p.id === formData.provider)?.name || t('Select Provider')}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[18rem] overflow-auto overflow-x-hidden">
                    {providersList.map((p) => {
                      const isSelected = formData.provider === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProviderSelect(p.id)}
                          className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0 ${isSelected ? 'bg-rose-50' : 'hover:bg-slate-50'}`}
                        >
                          {renderIcon(p.id, `w-4 h-4 object-contain ${isSelected ? 'opacity-100' : 'opacity-60 grayscale'}`)}
                          <span className={`text-sm ${isSelected ? 'text-rose-700 font-bold' : 'text-slate-700 font-medium'}`}>{p.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Server className="w-4 h-4 text-rose-500" />
                    {t('Base URL')}
                  </label>
                  <input 
                    type="text" 
                    value={formData.baseUrl}
                    onChange={e => setFormData({...formData, baseUrl: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    placeholder={currentDefaults.url}
                    required
                  />
                  <p className="text-xs text-slate-500">{currentDefaults.desc}</p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Key className="w-4 h-4 text-rose-500" />
                    {t('API Key')}
                  </label>
                  <input 
                    type="password" 
                    value={formData.apiKey}
                    onChange={e => setFormData({...formData, apiKey: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono"
                    placeholder="Your API Key..."
                  />
                  <p className="text-xs text-slate-500">{t("Your key is never sent to our servers. It is stored securely in your browser's Local Storage.")}</p>
                </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Cpu className="w-4 h-4 text-rose-500" />
                {t('Model Name')}
              </label>
              <input 
                type="text" 
                value={formData.model}
                onChange={e => setFormData({...formData, model: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                placeholder={currentDefaults.model}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('Tip: Type auto to omit the model parameter. Useful for triggering auto-routing/load balancing on compatible routers.')}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                🌐 {t('VPN System Proxy')} <span className="text-slate-400 font-normal ml-1">{t('(Optional)')}</span>
              </label>
              <input 
                type="text" 
                value={formData.systemProxy || ''}
                onChange={e => setFormData({...formData, systemProxy: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono text-sm"
                placeholder="e.g. http://127.0.0.1:7890 (for Clash/V2ray)"
              />
              <p className="text-xs text-slate-500 mt-1">
                {t("If using overseas APIs (like OpenAI) in China, the built-in proxy needs your VPN's local HTTP proxy address to bypass the Great Firewall.")}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Brain className="w-4 h-4 text-rose-500" />
                {t('Custom System Prompt')} <span className="text-slate-400 font-normal ml-1">{t('(Optional)')}</span>
              </label>
              <textarea 
                rows={4}
                value={formData.customSystemPrompt || ''}
                onChange={e => setFormData({...formData, customSystemPrompt: e.target.value})}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono text-xs text-slate-700 leading-relaxed"
                placeholder="Leave blank to use default system prompt for extraction & AI report..."
              />
            </div>

            <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between">
              <span className={`text-sm font-bold text-green-600 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
                {t('Configuration Saved!')}
              </span>
              <button 
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                {t('Save Settings')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

