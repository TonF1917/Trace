import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { Layers, Plus, Settings as SettingsIcon, Trash2, ArrowRight, Sparkles, Loader2, ArrowLeft, AlertCircle, Paperclip, Mail, Key } from 'lucide-react';
import { generateProjectOntology, aiCompressText, generateTextForTopic } from '../services/LLMService';
import { parseFile } from '../utils/fileParser';
import { useTranslation } from 'react-i18next';

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { projects, createProject, deleteProject, setActiveProject, apiConfig, initializeFromDatabase, loadExampleProject } = useStore();
  
  // Creation States
  const [isCreating, setIsCreating] = useState(false);
  const [creationStep, setCreationStep] = useState(1);
  const [sourceText, setSourceText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'topic'
  const [researchTopic, setResearchTopic] = useState('');
  const [topicSourceName, setTopicSourceName] = useState('AI Researcher');
  
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(null);
  const [compressChunks, setCompressChunks] = useState(4);

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    frames: '',
    tones: '',
    relations: ''
  });

  useEffect(() => {
    initializeFromDatabase();
  }, [initializeFromDatabase]);

  const resetCreation = () => {
    setIsCreating(false);
    setCreationStep(1);
    setSourceText('');
    setResearchTopic('');
    setGenerationError(null);
    setNewProject({ name: '', description: '', frames: '', tones: '', relations: '' });
  };

  const processFile = async (file) => {
    setIsUploading(true);
    setGenerationError(null);
    try {
      const text = await parseFile(file);
      setSourceText(prev => prev ? prev + '\n\n' + text : text);
    } catch (err) {
      setGenerationError(`Failed to parse file: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAiCompress = async () => {
    setIsCompressing(true);
    setGenerationError(null);
    try {
      const compressed = await aiCompressText(sourceText, (current, total) => {
        setCompressProgress(`${current} / ${total}`);
      }, compressChunks);
      setSourceText(compressed);
    } catch (err) {
      setGenerationError(err.message);
    } finally {
      setIsCompressing(false);
      setCompressProgress(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (isGenerating || isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  const handleGenerateOntology = async () => {
    if (inputMode === 'text' && !sourceText.trim()) return;
    if (inputMode === 'topic' && !researchTopic.trim()) return;
    
    setIsGenerating(true);
    setGenerationError(null);
    try {
      let textToProcess = sourceText;
      if (inputMode === 'topic') {
        const result = await generateTextForTopic(researchTopic);
        textToProcess = result.text || '';
        setTopicSourceName(result.source_name || 'AI Researcher');
        setSourceText(textToProcess); // Save generated essay as source text
      }
      
      const ontology = await generateProjectOntology(textToProcess);
      setNewProject({
        name: ontology.name || '',
        description: ontology.description || '',
        frames: Array.isArray(ontology.frames) ? ontology.frames.join(', ') : '',
        tones: Array.isArray(ontology.tones) ? ontology.tones.join(', ') : ''
      });
      setCreationStep(2);
    } catch (err) {
      setGenerationError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    const framesList = newProject.frames.split(',').map(f => f.trim()).filter(Boolean);
    const tonesList = newProject.tones.split(',').map(t => t.trim()).filter(Boolean);
    const relationsList = newProject.relations ? newProject.relations.split(',').map(r => r.trim()).filter(Boolean) : [];
    
    createProject({
      name: newProject.name,
      description: newProject.description,
      frames: framesList.length ? framesList : ['Security', 'Morality', 'Conflict', 'Economy'],
      tones: tonesList.length ? tonesList : ['Neutral', 'Alarmed', 'Sympathetic', 'Critical'],
      relations: relationsList.length ? relationsList : [
        'Opposes / Blames',
        'Supports / Allies',
        'Influences / Controls',
        'Negotiates / Compromises',
        'Funds / Finances',
        'Represents',
        'Incites / Mobilizes',
        'Belongs To'
      ]
    });
    
    const { activeProjectId, addArticle } = useStore.getState();
    
    if (sourceText.trim()) {
      addArticle({
        projectId: activeProjectId,
        headline: inputMode === 'topic' ? `Research: ${researchTopic}` : "Source Document",
        lede: sourceText,
        source_name: inputMode === 'topic' ? topicSourceName : "Upload",
        date: new Date().toISOString()
      });
    }

    resetCreation();
    navigate(`/project/${activeProjectId}`);
  };

  const openProject = (id) => {
    setActiveProject(id);
    navigate(`/project/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-6">
      <div className="max-w-4xl w-full">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3 text-slate-900">
            <img src="/logo.png" alt="Trace Logo" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-3xl font-black tracking-tight">Trace</h1>
              <p className="text-sm font-medium text-slate-500">{t('Compare how different sources frame the same event')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={i18n.language?.startsWith('zh') ? 'zh' : 'en'}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              <option value="en">EN</option>
              <option value="zh">中文</option>
            </select>
            <button 
              onClick={() => navigate('/settings')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-sm transition-colors"
              title={t('Default: FreeLLMAPI (Swappable/Configurable)')}
            >
              <SettingsIcon className="w-4 h-4 text-rose-600" />
              <span>{apiConfig.provider === 'freellmapi' || !apiConfig.provider ? 'FreeLLMAPI (' + t('Default') + ')' : apiConfig.provider}</span>
              <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase font-bold">{t('Change API')}</span>
            </button>
          </div>
        </div>

        {/* Create Form */}
        {isCreating && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden mb-10 transition-all">
             <div className="bg-rose-600 px-8 py-5 text-white flex justify-between items-center">
               <div className="flex items-center gap-3">
                 {creationStep === 2 && (
                   <button onClick={() => setCreationStep(1)} className="hover:bg-rose-700 p-1 rounded-full transition-colors">
                     <ArrowLeft className="w-5 h-5" />
                   </button>
                 )}
                 <h2 className="text-xl font-bold">{t('New Research Project')}</h2>
               </div>
               <button onClick={resetCreation} className="text-rose-200 hover:text-white">{t('Cancel')}</button>
             </div>

             {/* Step 1: Auto Generate */}
             {creationStep === 1 && (
               <div className="p-8">
                 <div 
                   className="mb-6 relative"
                   onDragOver={handleDragOver}
                   onDragLeave={handleDragLeave}
                   onDrop={handleDrop}
                 >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs">1</span>
                        <h3 className="text-sm font-bold text-slate-800">{t('Source Material')}</h3>
                      </div>
                      
                      <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                          type="button"
                          onClick={() => setInputMode('text')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${inputMode === 'text' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          {t('Paste Text')}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setInputMode('topic')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${inputMode === 'topic' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <Sparkles className="w-3 h-3" /> {t('Auto-Research')}
                        </button>
                      </div>
                    </div>
                    
                    {inputMode === 'topic' ? (
                      <div className="mb-4">
                        <input 
                          type="text" 
                          value={researchTopic}
                          onChange={e => setResearchTopic(e.target.value)}
                          placeholder={t('e.g. The 18th Brumaire of Louis Bonaparte')}
                          className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all text-sm"
                          disabled={isGenerating}
                        />
                        <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-500"/> {t('AI will act as a historian, write a comprehensive essay about this topic, and auto-generate the project structure.')}
                        </p>
                      </div>
                    ) : (
                      <textarea 
                        value={sourceText}
                        onChange={e => setSourceText(e.target.value)}
                        className={`w-full px-4 py-3 bg-slate-50 border ${isDragging ? 'border-rose-500 ring-2 ring-rose-200 bg-rose-50' : 'border-slate-200'} rounded-lg h-48 focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all text-sm`}
                        placeholder={isDragging ? t("Drop file here to extract text...") : t("Paste source text here... or drag & drop a file (supports 20+ formats: EPUB, PDF, DOCX, XLSX, TXT, HTML...)")}
                        disabled={isGenerating || isUploading || isCompressing}
                        maxLength={400000}
                      />
                    )}
                   
                   {inputMode === 'text' && (
                     <div className="flex justify-between items-center mt-2">
                     <span className="text-xs text-slate-400">
                       {sourceText.length > 0 && `${sourceText.length.toLocaleString()} ${t('chars')}`}
                     </span>
                     <div className="flex gap-2">
                       {sourceText.length > 50000 && (
                         <div className="flex items-center gap-1 bg-indigo-50 p-1 rounded border border-indigo-100">
                           <button
                             type="button"
                             onClick={handleAiCompress}
                             disabled={isCompressing || isGenerating}
                             className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-100 rounded transition-colors disabled:opacity-50"
                           >
                             {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : '✨'}
                             {isCompressing ? t('AI Compressing...') + ` (${compressProgress})` : t('AI Map-Reduce Compress')}
                           </button>
                           <select
                             value={compressChunks}
                             onChange={e => setCompressChunks(parseInt(e.target.value))}
                             disabled={isCompressing || isGenerating}
                             className="text-xs bg-white text-indigo-700 border-l border-indigo-200 outline-none px-1 py-1 rounded-r cursor-pointer disabled:opacity-50"
                             title="Number of chunks to split the text into for parallel processing"
                           >
                             <option value={4}>4 Chunks</option>
                             <option value={8}>8 Chunks</option>
                             <option value={16}>16 Chunks</option>
                             <option value={32}>32 Chunks</option>
                             <option value={64}>64 Chunks (Safest)</option>
                           </select>
                         </div>
                       )}
                       <input 
                         type="file"  
                       ref={fileInputRef} 
                       className="hidden" 
                       accept="*" 
                       onChange={handleFileUpload} 
                     />
                     <button
                       type="button"
                       onClick={() => fileInputRef.current?.click()}
                       disabled={isUploading || isGenerating}
                       className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
                     >
                       {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                       {isUploading ? t('Parsing File...') : t('Import from File (PDF, DOCX...)')}
                     </button>
                    </div>
                  </div>
                   )}
                </div>

                 {generationError && (
                   <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex gap-3 items-start">
                     <AlertCircle className="w-5 h-5 shrink-0" />
                     <p>{generationError}</p>
                   </div>
                 )}

                 <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                   <button 
                     type="button" 
                     onClick={() => setCreationStep(2)}
                     className="text-sm font-bold text-slate-500 hover:text-slate-800"
                     disabled={isGenerating}
                   >
                     {t('Skip & Setup Manually')}
                   </button>

                   <button 
                     onClick={handleGenerateOntology}
                     disabled={isGenerating || isUploading || isCompressing || (inputMode === 'text' && !sourceText.trim()) || (inputMode === 'topic' && !researchTopic.trim())}
                     className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                   >
                     {isGenerating ? (
                       <>
                         <Loader2 className="w-5 h-5 animate-spin" />
                         {inputMode === 'topic' ? t('Generating Essay & Ontology...') : t('Analyzing Text...')}
                       </>
                     ) : (
                       <>
                         <Sparkles className="w-5 h-5" />
                         {t('Generate Ontology')}
                       </>
                     )}
                   </button>
                 </div>
               </div>
             )}

             {/* Step 2: Review & Edit */}
             {creationStep === 2 && (
               <form onSubmit={handleCreate} className="p-8 space-y-6">
                 <div>
                   <h3 className="text-lg font-bold text-slate-800 mb-2">{t('Step 2: Review & Edit')}</h3>
                   <p className="text-sm text-slate-500">{t('Review the generated ontology below. You can freely edit or add comma-separated values.')}</p>
                 </div>

                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-sm font-bold text-slate-700">Project Name</label>
                     <input 
                       type="text" 
                       value={newProject.name}
                       onChange={e => setNewProject({...newProject, name: e.target.value})}
                       className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                       required
                     />
                   </div>
                   
                   <div className="space-y-2">
                     <label className="text-sm font-bold text-slate-700">Description</label>
                     <input 
                       type="text" 
                       value={newProject.description}
                       onChange={e => setNewProject({...newProject, description: e.target.value})}
                       className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                     />
                   </div>
                   
                   <div className="grid grid-cols-2 gap-6 pt-2">
                     <div className="space-y-2">
                       <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                         {t('Custom Frames')}
                         <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wide">{t('Comma Separated')}</span>
                       </label>
                       <textarea 
                         value={newProject.frames}
                         onChange={e => setNewProject({...newProject, frames: e.target.value})}
                         className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg h-28 focus:ring-2 focus:ring-rose-500 leading-relaxed"
                         placeholder={t("e.g. Patriarchy, Victimhood, Agency, Systemic Bias")}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-sm font-bold text-slate-700 flex items-center justify-between">
                         {t('Custom Tones')}
                         <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wide">{t('Comma Separated')}</span>
                       </label>
                       <textarea 
                         value={newProject.tones}
                         onChange={e => setNewProject({...newProject, tones: e.target.value})}
                         className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg h-28 focus:ring-2 focus:ring-rose-500 leading-relaxed"
                         placeholder={t("e.g. Empathetic, Hostile, Objective")}
                       />
                     </div>
                   </div>
                 </div>

                 <div className="flex justify-end pt-6 border-t border-slate-100">
                   <button type="submit" className="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm">
                     {t('Create & Enter Workspace')}
                   </button>
                 </div>
               </form>
             )}
          </div>
        )}

        {/* Project List */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">{t('Your Projects')}</h2>
          {!isCreating && (
            <div className="flex items-center gap-3">
              <button 
                onClick={loadExampleProject}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 text-sm font-bold rounded-lg transition-colors"
                title={t('Restore pre-configured NEP 1921 example project')}
              >
                <Sparkles className="w-4 h-4" />
                {t('Restore Example Project')}
              </button>
              <button 
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 shadow-sm transition-transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {t('New Project')}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-2 text-center py-16 bg-white rounded-2xl border border-slate-200 border-dashed">
              <p className="text-slate-400 font-medium mb-4">{t('No projects found in local storage.')}</p>
              <button 
                onClick={() => setIsCreating(true)}
                className="text-rose-600 font-bold hover:underline"
              >
                {t('Create your first project')}
              </button>
            </div>
          ) : (
            projects.map(project => (
              <div key={project.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-all relative group cursor-pointer" onClick={() => openProject(project.id)}>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteProject(project.id); }}
                  className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-red-50"
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <h3 className="text-xl font-bold text-slate-900 mb-2 pr-8 flex items-center gap-2">
                  {project.name}
                  {(project.isExample || project.name?.includes('New Economic Policy')) && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] uppercase font-bold rounded">{t('Example')}</span>}
                </h3>
                {project.description && <p className="text-sm text-slate-500 mb-4 line-clamp-2">{project.description}</p>}
                {!project.description && <p className="text-xs text-slate-400 mb-4">{new Date(project.createdAt).toLocaleDateString()}</p>}
                
                <div className="flex flex-wrap gap-1.5 mb-6 mt-auto pt-4">
                  {project.frames.slice(0, 3).map(f => (
                    <span key={f} className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] uppercase font-bold rounded border border-rose-100">
                      {f}
                    </span>
                  ))}
                  {project.frames.length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[10px] font-bold rounded border border-slate-200">
                      +{project.frames.length - 3} {t('more')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="mt-20 pb-8 text-center">
          <div className="flex flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500 mb-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              {t('If you do not have an API key, you can find free APIs at:')} <a href="https://github.com/tashfeenahmed/freellmapi" target="_blank" rel="noopener noreferrer" className="hover:text-rose-600 transition-colors underline decoration-slate-200 underline-offset-2">https://github.com/tashfeenahmed/freellmapi</a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-1">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {t('Project Address')}: <a href="https://github.com/TonF1917/Trace" target="_blank" rel="noopener noreferrer" className="hover:text-rose-600 transition-colors underline decoration-slate-200 underline-offset-2">https://github.com/TonF1917/Trace</a>
              </div>
              <span className="hidden sm:inline text-slate-300">&bull;</span>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {t('Contact')}: <a href="mailto:tonf.academic@gmail.com" className="hover:text-rose-600 transition-colors underline decoration-slate-200 underline-offset-2">tonf.academic@gmail.com</a>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {t('Trace')} v1.0.0 &copy; {new Date().getFullYear()}
          </p>
        </footer>

      </div>
    </div>
  );
}

