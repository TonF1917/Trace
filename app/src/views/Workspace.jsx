import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ArrowLeft, Plus, Bot, Loader2, Link as LinkIcon, Trash2, ArrowRight } from 'lucide-react';
import { BlameNetwork, DEFAULT_RELATION_COLORS, normalizeRelation } from '../components/BlameNetwork';
import { TimelineView } from '../components/TimelineView';
import { MethodModal } from '../components/MethodModal';
import { ViewControls } from '../components/ViewControls';
import { GraphAnalyticsView } from './GraphAnalyticsView';
import { analyzeArticle, extractMoreRelationships, generateTextForTopic, connectExistingEntities, consolidateEntities } from '../services/LLMService';
import Papa from 'papaparse';
import { toPng, toJpeg } from 'html-to-image';
import { parseFile } from '../utils/fileParser';
import { Paperclip, Search, Sparkles, Network } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';

export function Workspace() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { projects, articles, addArticle, updateArticle, deleteArticle } = useStore();
  
  const project = projects.find(p => p.id === projectId);
  const projectArticles = articles.filter(a => a.projectId === projectId).map(a => ({
    ...a,
    source_name: a.source_name || 'Unknown Source',
    source_id: a.source_id || (a.source_name ? a.source_name.toLowerCase().replace(/\s+/g, '-') : 'unknown-source')
  }));
  
  const [activeView, setActiveView] = useState('topology');
  const [showFrequencies, setShowFrequencies] = useState(false);
  const [hoveredArticle, setHoveredArticle] = useState(null);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showResearchForm, setShowResearchForm] = useState(false);
  const [researchTopic, setResearchTopic] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSettings, setExportSettings] = useState({ nodeScale: 1.9, textScale: 1.25, edgeScale: 1.0, arrowScale: 0.5, spreadScale: 0.8 });
  const hoverTimeoutRef = useRef(null);
  
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedSource, setSelectedSourceState] = useState(() => new URLSearchParams(window.location.search).get('source'));
  const [selectedFrame, setSelectedFrameState] = useState(() => new URLSearchParams(window.location.search).get('frame'));
  const [selectedRelation, setSelectedRelationState] = useState(() => new URLSearchParams(window.location.search).get('relation'));
  const [targetNodeCount, setTargetNodeCount] = useState(10);
  const [showSourceNodes, setShowSourceNodes] = useState(false);
  const [graphMode, setGraphMode] = useState('explore');
  const [showGroupEnclosures, setShowGroupEnclosures] = useState(true);
  const [showCurvedEdges, setShowCurvedEdges] = useState(true);
  const [fontFamily, setFontFamily] = useState('serif');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (project) {
      const currentRels = project.relations || [];
      const DEFAULT_RELS = [
        'Opposes / Blames',
        'Supports / Allies',
        'Influences / Controls',
        'Negotiates / Compromises',
        'Funds / Finances',
        'Represents',
        'Incites / Mobilizes',
        'Belongs To'
      ];
      const missing = DEFAULT_RELS.filter(r => !currentRels.includes(r));
      if (missing.length > 0) {
        useStore.getState().updateProject(project.id, {
          relations: [...currentRels, ...missing]
        });
      }
    }
  }, [project]);

  // Sync state when browser back/forward buttons are clicked
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setSelectedSourceState(params.get('source'));
      setSelectedFrameState(params.get('frame'));
      setSelectedRelationState(params.get('relation'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const setSelectedSource = (sourceId) => {
    setSelectedSourceState(sourceId);
    const url = new URL(window.location);
    if (sourceId) url.searchParams.set('source', sourceId);
    else url.searchParams.delete('source');
    window.history.pushState({}, '', url);
  };

  const setSelectedFrame = (frame) => {
    setSelectedFrameState(frame);
    const url = new URL(window.location);
    if (frame) url.searchParams.set('frame', frame);
    else url.searchParams.delete('frame');
    window.history.pushState({}, '', url);
  };

  const setSelectedRelation = (relation) => {
    setSelectedRelationState(relation);
    const url = new URL(window.location);
    if (relation) url.searchParams.set('relation', relation);
    else url.searchParams.delete('relation');
    window.history.pushState({}, '', url);
  };
  
  const [newArticle, setNewArticle] = useState({
    source_name: '',
    headline: '',
    url: '',
    date: new Date().toISOString().split('T')[0],
    lede: ''
  });

  const [processingId, setProcessingId] = useState(null);

  const processFile = async (file) => {
    setIsUploading(true);
    try {
      const text = await parseFile(file);
      setNewArticle(prev => ({ ...prev, lede: prev.lede ? prev.lede + '\n\n' + text : text }));
    } catch (err) {
      alert(`Failed to parse file: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
    if (isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  // Derive sources from articles dynamically and memoize to prevent graph explosion on hover
  const uniqueSources = React.useMemo(() => {
    return Array.from(new Set(projectArticles.map(a => a.source_name || 'Unknown Source'))).map(name => {
      // Deterministic color from name
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
      const color = '#' + '00000'.substring(0, 6 - c.length) + c;
      return {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name: name,
        color: color
      };
    });
  }, [projectArticles]);
  
  const getMappedRelation = (rawRel) => {
    let rel = rawRel ? rawRel.trim() : 'Opposes / Blames';
    if (/rejects?\s*\/\s*denies?/i.test(rel) || /blames?\s*\/\s*opposes?/i.test(rel)) return 'Opposes / Blames';
    if (/controls?\s*\/\s*dominates?/i.test(rel) || /^influences?$/i.test(rel)) return 'Influences / Controls';
    if (/compromises?\s*with/i.test(rel) || /negotiates?\s*with/i.test(rel)) return 'Negotiates / Compromises';
    return rel;
  };

  const uniqueFrames = React.useMemo(() => Array.from(new Set(projectArticles.flatMap(a => a.frames || []))), [projectArticles]);
  const uniqueRelations = React.useMemo(() => Array.from(new Set(projectArticles.map(a => getMappedRelation(a.relation_type)).filter(Boolean))), [projectArticles]);
  
  const handleAddArticle = (e) => {
    e.preventDefault();
    addArticle({
      projectId,
      ...newArticle,
      source_id: newArticle.source_name.toLowerCase().replace(/\s+/g, '-'),
      frames: [],
      actors: { main_actor: 'Pending', blame_target: 'Pending' },
      tone: 'Neutral',
      keywords: []
    });
    setShowAddForm(false);
    setNewArticle({ source_name: '', headline: '', url: '', date: new Date().toISOString().split('T')[0], lede: '' });
  };

  const handleResearchTopic = async (e) => {
    e.preventDefault();
    if (!researchTopic.trim()) return;
    
    setIsResearching(true);
    try {
      const generatedText = await generateTextForTopic(researchTopic);
      const newId = uuidv4();
      const newArticle = {
        id: newId,
        projectId: projectId,
        source_name: 'AI Researcher',
        source_id: 'ai-researcher',
        headline: `Research: ${researchTopic}`,
        lede: generatedText,
        date: new Date().toISOString(),
        url: '',
        frames: [],
        actors: { main_actor: 'Pending', blame_target: 'Pending' },
        tone: 'Neutral',
        keywords: []
      };
      
      useStore.getState().addArticle(newArticle);
      setShowResearchForm(false);
      setResearchTopic('');
      
      // Auto-analyze
      handleProcessLLM(newArticle);
      
    } catch (err) {
      alert(`Research failed: ${err.message}`);
    } finally {
      setIsResearching(false);
    }
  };

  const handleProcessLLM = async (article) => {
    setProcessingId(article.id);
    try {
      const headlineText = article.headline || article.title || 'Untitled';
      const ledeText = article.lede || article.content || '';
      const textToAnalyze = `${headlineText}\n\n${ledeText}`;
      const safeText = textToAnalyze;
      
      const customRels = project.relations || ['Opposes / Blames'];
      const effectiveCount = targetNodeCount === '' ? 10 : Number(targetNodeCount);
      const result = await analyzeArticle(safeText, project.frames, project.tones, customRels, effectiveCount);
      
      if (result.relationships && result.relationships.length > 0) {
        const first = result.relationships[0];
        
        let newDate = article.date;
        if (first.date) {
          const parsed = new Date(first.date);
          if (!isNaN(parsed)) newDate = parsed.toISOString();
        }

        updateArticle(article.id, {
          isProcessed: true,
          frames: first.frames || [],
          tone: first.tone || 'Neutral',
          date: newDate,
          actors: {
            main_actor: first.main_actor || 'Unknown',
            blame_target: first.blame_target || 'Unknown'
          },
          relation_type: first.relation_type || 'Opposes / Blames',
          keywords: result.keywords || [],
          rationale: first.rationale || '',
          headline: first.quote ? `"${first.quote.substring(0, 60)}..."` : headlineText,
          quote: first.quote || '',
          lede: ledeText // preserve original text
        });

        // Spawn new articles for the rest of the relationships
        for (let i = 1; i < result.relationships.length; i++) {
          const rel = result.relationships[i];
          let relDate = article.date;
          if (rel.date) {
            const parsed = new Date(rel.date);
            if (!isNaN(parsed)) relDate = parsed.toISOString();
          }
          
          useStore.getState().addArticle({
            projectId: article.projectId,
            source_name: article.source_name,
            source_id: article.source_id,
            url: article.url,
            date: relDate,
            headline: rel.quote ? `"${rel.quote.substring(0, 60)}..."` : `Extracted Claim ${i + 1}`,
            quote: rel.quote || '',
            lede: ledeText, // preserve original text
            isProcessed: true,
            frames: rel.frames || [],
            tone: rel.tone || 'Neutral',
            actors: {
              main_actor: rel.main_actor || 'Unknown',
              blame_target: rel.blame_target || 'Unknown'
            },
            relation_type: rel.relation_type || 'Opposes / Blames',
            keywords: result.keywords || [],
            rationale: rel.rationale || ''
          });
        }
      } else {
        // Fallback for older format if LLM fails to return array
        updateArticle(article.id, {
          isProcessed: true,
          frames: result.frames || [],
          tone: result.tone || 'Neutral',
          date: article.date,
          actors: {
            main_actor: result.main_actor || 'Unknown',
            blame_target: result.blame_target || 'Unknown'
          },
          keywords: result.keywords || [],
          rationale: result.rationale || ''
        });
      }
    } catch (err) {
      alert(`Processing failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleExtractMoreAll = async () => {
    const processedSources = Array.from(new Set(projectArticles.filter(a => a.isProcessed && a.lede).map(a => a.lede)));
    if (processedSources.length === 0) {
      alert("No processed texts found to deep-extract. Please run analysis on sources first.");
      return;
    }
    
    setProcessingId('extract_more_all');
    let extractedCount = 0;
    
    try {
      for (const ledeText of processedSources) {
        const safeText = ledeText;
        
        const existingClaims = projectArticles.filter(a => a.lede === ledeText && a.isProcessed);
        const existingRelationshipsContext = existingClaims.map(a => ({
          actor: a.actors.main_actor,
          target: a.actors.blame_target,
          relation_type: a.relation_type || 'Unknown',
          quote: a.quote || a.headline || ''
        }));
        
        const customRels = project.relations || ['Opposes / Blames'];
        const effectiveCount = targetNodeCount === '' ? 10 : Number(targetNodeCount);
        const result = await extractMoreRelationships(safeText, project.frames, project.tones, customRels, existingRelationshipsContext, effectiveCount);
        
        if (result.relationships && result.relationships.length > 0) {
          extractedCount += result.relationships.length;
          const articleInfo = existingClaims[0]; // grab metadata from the first related claim
          
          for (let i = 0; i < result.relationships.length; i++) {
            const rel = result.relationships[i];
            let relDate = articleInfo.date;
            if (rel.date) {
              const parsed = new Date(rel.date);
              if (!isNaN(parsed)) relDate = parsed.toISOString();
            }
            
            useStore.getState().addArticle({
              projectId: articleInfo.projectId,
              source_name: articleInfo.source_name,
              source_id: articleInfo.source_id,
              url: articleInfo.url,
              date: relDate,
              headline: rel.quote ? `"${rel.quote.substring(0, 60)}..."` : `Deep Extracted Claim ${i + 1}`,
              quote: rel.quote || '',
              lede: ledeText,
              isProcessed: true,
              frames: rel.frames || [],
              tone: rel.tone || 'Neutral',
              actors: {
                main_actor: rel.main_actor || 'Unknown',
                blame_target: rel.blame_target || 'Unknown'
              },
              relation_type: rel.relation_type || 'Opposes / Blames',
              keywords: result.keywords || [],
              rationale: rel.rationale || ''
            });
          }
        }
      }
      
      if (extractedCount > 0) {
        alert(`Deep Extract complete! Discovered ${extractedCount} new relationships!`);
      } else {
        alert("Deep Extract complete. No new relationships were found... The tree might be complete!");
      }
      
    } catch (err) {
      alert(`Deep extraction failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConnectExistingAll = async () => {
    if (processingId) return;
    
    const allExistingEntities = new Set();
    const existingRelationshipsStr = new Set();
    
    projectArticles.forEach(a => {
      if (a.actors && a.actors.main_actor && a.actors.main_actor !== 'Unknown') allExistingEntities.add(a.actors.main_actor);
      if (a.actors && a.actors.blame_target && a.actors.blame_target !== 'Unknown') allExistingEntities.add(a.actors.blame_target);
      if (a.actors && a.relation_type) {
        existingRelationshipsStr.add(`${a.actors.main_actor}|${a.actors.blame_target}|${a.relation_type}`);
      }
    });

    const uniqueEntitiesList = Array.from(allExistingEntities);
    if (uniqueEntitiesList.length < 2) {
      alert(t('Not enough existing nodes to connect. Run an initial analysis first.'));
      return;
    }

    setProcessingId('connect_existing_all');
    let extractedCount = 0;

    const processedSources = Array.from(new Set(projectArticles.filter(a => a.isProcessed && a.lede).map(a => a.lede)));

    for (let i = 0; i < processedSources.length; i++) {
      const rawText = processedSources[i];
      if (rawText && rawText.trim().length > 50) {
        try {
          const safeText = rawText.slice(0, 15000);
          const customRels = project.relations || ['Opposes / Blames'];
          const effectiveCount = targetNodeCount === '' ? 10 : Number(targetNodeCount);
          
          const existingContext = projectArticles
            .map(a => `Actor: ${a.actors?.main_actor} | Target: ${a.actors?.blame_target} | Relation: ${a.relation_type}`)
            .join('\n');
          
          const result = await connectExistingEntities(
            safeText, 
            project.frames, 
            project.tones, 
            customRels, 
            uniqueEntitiesList, 
            existingContext,
            effectiveCount
          );
          
          if (result.relationships && result.relationships.length > 0) {
            const newRels = result.relationships.filter(r => !existingRelationshipsStr.has(`${r.main_actor}|${r.blame_target}|${r.relation_type}`));
            extractedCount += newRels.length;
            const articleInfo = projectArticles.find(a => a.lede === rawText) || {};
            for (let j = 0; j < newRels.length; j++) {
              const rel = newRels[j];
              existingRelationshipsStr.add(`${rel.main_actor}|${rel.blame_target}|${rel.relation_type}`);
              addArticle({
                id: uuidv4(),
                projectId: project.id,
                text: null,
                source_name: articleInfo.source_name || 'Deep Extraction',
                source_id: articleInfo.source_id,
                url: articleInfo.url,
                date: rel.date || articleInfo.date || new Date().toISOString().split('T')[0],
                headline: rel.quote ? `"${rel.quote.substring(0, 60)}..."` : `Connected Claim ${j + 1}`,
                quote: rel.quote || '',
                lede: '',
                isProcessed: true,
                frames: rel.frames || [],
                tone: rel.tone || 'Neutral',
                actors: {
                  main_actor: rel.main_actor || 'Unknown',
                  blame_target: rel.blame_target || 'Unknown'
                },
                relation_type: rel.relation_type || 'Opposes / Blames',
                keywords: [],
                rationale: rel.rationale || ''
              });
            }
          }
        } catch (err) {
          console.error(`Failed connecting entities for text starting with ${rawText.substring(0, 20)}:`, err);
        }
      }
    }
    
    setProcessingId(null);
    if (extractedCount > 0) {
      alert(`Connected relationships: ${extractedCount} new relations found!`);
    } else {
      alert("No new relationships found between existing nodes.");
    }
  };

  const handleConsolidateEntities = async () => {
    if (!project) return;
    
    // 1. Gather all unique entities
    const allExistingEntities = new Set();
    projectArticles.forEach(a => {
      if (a.actors && a.actors.main_actor && a.actors.main_actor !== 'Unknown') allExistingEntities.add(a.actors.main_actor);
      if (a.actors && a.actors.blame_target && a.actors.blame_target !== 'Unknown') allExistingEntities.add(a.actors.blame_target);
    });

    const uniqueEntitiesList = Array.from(allExistingEntities);
    if (uniqueEntitiesList.length < 2) {
      alert("Not enough entities to consolidate.");
      return;
    }

    setProcessingId('consolidate_entities');
    try {
      // 2. Call LLM
      const result = await consolidateEntities(uniqueEntitiesList);
      
      if (result && result.mappings && result.mappings.length > 0) {
        // 3. Create a map for fast lookup
        const mergeMap = {};
        result.mappings.forEach(m => {
          if (m.original && m.standardized && m.original !== m.standardized) {
            mergeMap[m.original] = m.standardized;
          }
        });

        let updatedCount = 0;

        // 4. Update articles in store
        projectArticles.forEach(a => {
          let changed = false;
          const newActors = { ...a.actors };
          
          if (mergeMap[newActors.main_actor]) {
            newActors.main_actor = mergeMap[newActors.main_actor];
            changed = true;
          }
          if (mergeMap[newActors.blame_target]) {
            newActors.blame_target = mergeMap[newActors.blame_target];
            changed = true;
          }

          if (changed) {
            updateArticle(a.id, { actors: newActors });
            updatedCount++;
          }
        });

        alert(`Successfully consolidated entities. ${updatedCount} relations updated!`);
      } else {
        alert("No entities needed consolidation according to the AI.");
      }
    } catch (err) {
      console.error("Failed to consolidate entities:", err);
      alert("Error consolidating entities: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const exportCSV = () => {
    const csvData = projectArticles.map(a => ({
      Source: a.source_name,
      Date: a.date,
      Headline: a.headline,
      URL: a.url,
      MainActor: a.actors.main_actor,
      BlameTarget: a.actors.blame_target,
      Frames: a.frames.join('; '),
      Tone: a.tone,
      Keywords: (a.keywords || []).join('; ')
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.replace(/\s+/g, '_')}_export.csv`;
    link.click();
  };

  const exportJSON = () => {
    const dataStr = JSON.stringify({ project, articles: projectArticles }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.name.replace(/\s+/g, '_')}_export.json`;
    link.click();
  };

  const exportImage = (format) => {
    if (activeView !== 'topology') {
      alert('Image export is only available in Topology view.');
      return;
    }
    const container = document.getElementById('topology-export-container');
    if (!container) {
      alert('Graph is not ready yet.');
      return;
    }
    
    setIsExporting(true);
    
    // Wait for React to apply the 2x scale, and for ForceGraph to apply the zoom and re-render the canvas
    setTimeout(async () => {
      try {
        const param = {
          width: container.offsetWidth,
          height: container.offsetHeight,
          style: {
            transform: 'none',
            width: container.offsetWidth + 'px',
            height: container.offsetHeight + 'px'
          },
          backgroundColor: '#ffffff',
          pixelRatio: 1 // We already manually scale the container by 2x, so pixelRatio 1 is fine
        };

        let dataUrl;
        if (format === 'png') {
          dataUrl = await toPng(container, param);
        } else {
          dataUrl = await toJpeg(container, { ...param, quality: 1.0 });
        }
        
        const link = document.createElement('a');
        link.download = `${project.name.replace(/\s+/g, '_')}_topology.${format}`;
        link.href = dataUrl;
        link.click();
      } catch (e) {
        alert(`Failed to export image. Error: ${e.message}\nIf this persists, please restart the local server.`);
      } finally {
        setIsExporting(false);
      }
    }, 800); // 800ms delay to ensure force graph canvas is redrawn and zoomed
  };

  const processedArticles = React.useMemo(() => projectArticles.filter(a => a.isProcessed), [projectArticles]);
  const filteredProcessedArticles = React.useMemo(() => processedArticles.filter(a => 
    (!selectedSource || a.source_id === selectedSource) && 
    (!selectedFrame || a.frames.includes(selectedFrame)) &&
    (!selectedRelation || getMappedRelation(a.relation_type) === selectedRelation)
  ), [processedArticles, selectedSource, selectedFrame, selectedRelation]);

  const handleLinkSelected = React.useCallback((articleIds) => {
    if (!articleIds || articleIds.size === 0) return;
    const firstId = Array.from(articleIds)[0];
    const el = document.getElementById(`article-card-${firstId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Temporary highlight effect
      el.classList.add('ring-2', 'ring-rose-500', 'ring-offset-2', 'bg-rose-50');
      setTimeout(() => el.classList.remove('ring-2', 'ring-rose-500', 'ring-offset-2', 'bg-rose-50'), 1500);
    }
  }, []);

  if (!project) {
    return <div className="p-8">Project not found</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Left Sidebar - Data Manager */}
      <aside className="w-96 bg-white border-r border-slate-200 flex flex-col h-full z-20 shadow-sm transition-all duration-300">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
           <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-800 transition-colors">
             <ArrowLeft className="w-5 h-5" />
           </button>
           <h2 className="font-black text-slate-800 truncate px-3">{project.name}</h2>
           <button onClick={() => setIsMethodModalOpen(true)} className="text-xs font-bold text-rose-600 hover:underline">{t('Method')}</button>
        </div>
        
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {t('Corpus')} ({projectArticles.length})
          </span>
          <div className="flex flex-col gap-1.5 items-end">
            <div className="flex flex-wrap gap-1.5 justify-end">
              <button 
                onClick={handleExtractMoreAll}
                disabled={processingId === 'extract_more_all'}
                className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded hover:bg-amber-200 transition-colors disabled:opacity-50"
                title="Deep extract missing relationships from all processed source texts"
              >
                {processingId === 'extract_more_all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {t('Deep Extract All')}
              </button>
              <button 
                onClick={handleConnectExistingAll}
                disabled={processingId === 'connect_existing_all'}
                className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                title="Connect existing nodes by finding new relations between them"
              >
                {processingId === 'connect_existing_all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Network className="w-3 h-3" />}
                {t('Connect Existing')}
              </button>
              <button 
                onClick={handleConsolidateEntities}
                disabled={processingId === 'consolidate_entities'}
                className="flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-[10px] font-bold rounded hover:bg-teal-200 transition-colors disabled:opacity-50"
                title="Use AI to automatically merge identical entities (e.g., 'Lenin' and 'Vladimir I. Lenin') permanently"
              >
                {processingId === 'consolidate_entities' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {t('AI Merge')}
              </button>
              <button 
                onClick={() => { setShowResearchForm(!showResearchForm); setShowAddForm(false); }}
                className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded hover:bg-purple-200 transition-colors"
              >
                <Search className="w-3 h-3" /> {t('Research')}
              </button>
              <button 
                onClick={() => { setShowAddForm(!showAddForm); setShowResearchForm(false); }}
                className="flex items-center gap-1 px-2 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded hover:bg-rose-200 transition-colors"
              >
                <Plus className="w-3 h-3" /> {t('Add Text')}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase">{t('Target Nodes/Pass:')}</span>
              <input 
                type="number" 
                value={targetNodeCount}
                onChange={e => {
                  const val = e.target.value;
                  setTargetNodeCount(val === '' ? '' : Math.max(1, Number(val)));
                }}
                className="text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 rounded px-1 py-0.5 outline-none w-16"
                min="1"
              />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">{t('Filter by Source')}</span>
            <div className="flex flex-wrap gap-1.5">
              <button 
                onClick={() => setSelectedSource(null)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-colors ${!selectedSource ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              >
                {t('All')}
              </button>
              {uniqueSources.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setSelectedSource(s.id)}
                  style={selectedSource === s.id ? { backgroundColor: s.color, borderColor: s.color, color: '#fff' } : { borderColor: s.color, color: s.color }}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-colors ${selectedSource !== s.id ? 'bg-transparent hover:bg-slate-50' : ''}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">{t('Filter by Frame')}</span>
            <div className="flex flex-wrap gap-1.5">
              <button 
                onClick={() => setSelectedFrame(null)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-colors ${!selectedFrame ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              >
                {t('All')}
              </button>
              {uniqueFrames.map(f => (
                <button 
                  key={f}
                  onClick={() => setSelectedFrame(f)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-colors ${selectedFrame === f ? 'bg-rose-600 text-white border-rose-600' : 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">{t('Filter by Relation')}</span>
            <div className="flex flex-wrap gap-1.5">
              <button 
                onClick={() => setSelectedRelation(null)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-colors ${!selectedRelation ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              >
                {t('All')}
              </button>
              {uniqueRelations.map(r => (
                <button 
                  key={r}
                  onClick={() => setSelectedRelation(r)}
                  className={`px-2 py-1 text-[10px] font-bold rounded-md border transition-colors ${selectedRelation === r ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showResearchForm && (
            <form onSubmit={handleResearchTopic} className="bg-purple-50 border border-purple-200 rounded-lg p-4 shadow-sm relative">
              <h4 className="text-xs font-bold text-slate-800 mb-1 uppercase tracking-wider flex items-center gap-1">
                <Search className="w-3 h-3 text-purple-600" /> {t('Auto-Research Topic')}
              </h4>
              <p className="text-[10px] text-slate-500 mb-3">{t('AI will write a comprehensive essay and extract all narrative relationships automatically.')}</p>
              <input type="text" placeholder={t("e.g. 2024 US Election Polarization")} value={researchTopic} onChange={e => setResearchTopic(e.target.value)} className="w-full text-sm border border-slate-200 rounded p-2 mb-3" required disabled={isResearching} />
              
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowResearchForm(false)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-700" disabled={isResearching}>{t('Cancel')}</button>
                <button type="submit" className="flex items-center gap-1 px-3 py-1 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded disabled:opacity-50" disabled={isResearching || !researchTopic.trim()}>
                  {isResearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                  {isResearching ? t('Generating Essay...') : t('Generate Map')}
                </button>
              </div>
            </form>
          )}

          {showAddForm && (
            <form onSubmit={handleAddArticle} className="bg-white border border-rose-200 rounded-lg p-4 shadow-sm relative">
              <h4 className="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">{t('Ingest New Article')}</h4>
              <input type="text" placeholder={t("Source Name (e.g. NYT)")} value={newArticle.source_name} onChange={e => setNewArticle({...newArticle, source_name: e.target.value})} className="w-full text-sm border border-slate-200 rounded p-2 mb-2" required />
              <input type="text" placeholder={t("Headline")} value={newArticle.headline} onChange={e => setNewArticle({...newArticle, headline: e.target.value})} className="w-full text-sm border border-slate-200 rounded p-2 mb-2 font-bold" required />
              <input type="date" value={newArticle.date} onChange={e => setNewArticle({...newArticle, date: e.target.value})} className="w-full text-sm border border-slate-200 rounded p-2 mb-2" required />
              <input type="url" placeholder={t("URL (Optional)")} value={newArticle.url} onChange={e => setNewArticle({...newArticle, url: e.target.value})} className="w-full text-sm border border-slate-200 rounded p-2 mb-2" />
              
              <div 
                className="relative mb-3"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <textarea 
                  placeholder={isDragging ? t("Drop file here to extract...") : t("Paste Lede / Body Text here... or drag & drop a file (EPUB, PDF, DOCX, XLSX, TXT...)")} 
                  value={newArticle.lede}  
                  onChange={e => setNewArticle({...newArticle, lede: e.target.value})} 
                  className={`w-full text-sm border ${isDragging ? 'border-rose-500 bg-rose-50' : 'border-slate-200'} rounded p-2 h-24 transition-all`} 
                  required 
                  disabled={isUploading}
                  maxLength={400000} 
                />
                
                <div className="absolute bottom-2 right-2 flex gap-2 items-center">
                  <span className="text-[10px] mr-2 bg-white/80 px-1 rounded text-slate-400">
                    {newArticle.lede.length > 0 && `${newArticle.lede.length.toLocaleString()} ${t('chars')}`}
                  </span>
                  <input type="file" ref={fileInputRef} className="hidden" accept="*" onChange={handleFileUpload} />
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-bold rounded shadow-sm transition-colors" title={t("Import from File (PDF, DOCX, TXT...)")}>
                    {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                    {isUploading ? t('Parsing...') : t('Import')}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1 text-xs font-bold text-slate-500">{t('Cancel')}</button>
                <button type="submit" className="px-3 py-1 text-xs font-bold bg-rose-600 text-white rounded">{t('Save')}</button>
              </div>
            </form>
          )}

          {projectArticles
            .filter(a => (!selectedSource || a.source_id === selectedSource) && (!selectedFrame || (a.frames && a.frames.includes(selectedFrame))))
            .map(article => (
            <div 
              key={article.id} 
              id={`article-card-${article.id}`}
              className={`border rounded-lg p-4 transition-all duration-500 ${article.isProcessed ? 'bg-white border-slate-200 hover:border-slate-300 shadow-sm cursor-crosshair' : 'bg-amber-50 border-amber-200'}`}
              onMouseEnter={() => {
                if (article.isProcessed) {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = setTimeout(() => setHoveredArticle(article.id), 40);
                }
              }}
              onMouseLeave={() => {
                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = setTimeout(() => setHoveredArticle(null), 40);
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">{article.source_name}</span>
                <button onClick={() => deleteArticle(article.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug mb-2">{article.headline || article.title || t('Untitled Document')}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                {article.date && <span>{new Date(article.date).toLocaleDateString()}</span>}
                {article.url && (
                  <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-rose-500 transition-colors" title={article.url}>
                    <LinkIcon className="w-3 h-3" />
                    {t('Source')}
                  </a>
                )}
              </div>
              
              {!article.isProcessed ? (
                <div className="mt-3 pt-3 border-t border-amber-200/50 flex justify-between items-center">
                  <span className="text-xs text-amber-600 font-medium">{t('Pending Analysis')}</span>
                  <button 
                    onClick={() => handleProcessLLM(article)}
                    disabled={processingId === article.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded shadow-sm hover:bg-amber-600 disabled:opacity-50"
                  >
                    {processingId === article.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    {t('Analyze')}
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 bg-slate-50 p-2 rounded border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">{t('Actor')}</p>
                      <p 
                        className="text-xs font-bold text-slate-800 truncate cursor-pointer hover:text-rose-600 hover:underline"
                        title="Search Wikipedia"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(article.actors?.main_actor || 'Unknown')}`, '_blank'); }}
                      >
                        {article.actors?.main_actor || 'Unknown'}
                      </p>
                    </div>

                    <div 
                      className="flex flex-col items-center justify-center cursor-pointer hover:opacity-70 px-1"
                      title="Search Interaction on Wikipedia"
                      onClick={(e) => { e.stopPropagation(); window.open(`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(article.actors.main_actor + ' ' + article.actors.blame_target)}`, '_blank'); }}
                    >
                      <span 
                        className="text-[9px] font-bold italic mb-0.5 truncate max-w-[40px] text-center leading-tight"
                        style={{ color: DEFAULT_RELATION_COLORS[normalizeRelation(article.relation_type)] || DEFAULT_RELATION_COLORS['default'] }}
                      >
                        {article.relation_type || 'Opposes'}
                      </span>
                      <ArrowRight 
                        className="w-3 h-3" 
                        style={{ color: DEFAULT_RELATION_COLORS[normalizeRelation(article.relation_type)] || DEFAULT_RELATION_COLORS['default'], opacity: 0.5 }} 
                      />
                    </div>

                    <div className="flex-1 min-w-0 bg-red-50 p-2 rounded border border-red-100">
                      <p className="text-[10px] text-red-400 font-bold uppercase mb-0.5">{t('Target')}</p>
                      <p 
                        className="text-xs font-bold text-red-700 truncate cursor-pointer hover:text-rose-600 hover:underline"
                        title="Search Wikipedia"
                        onClick={(e) => { e.stopPropagation(); window.open(`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(article.actors?.blame_target || 'Unknown')}`, '_blank'); }}
                      >
                        {article.actors?.blame_target || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {article.frames.map(f => (
                      <span key={f} className="text-[9px] font-bold px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded uppercase">{f}</span>
                    ))}
                  </div>

                </div>
              )}
            </div>
          ))}
          {projectArticles.length === 0 && !showAddForm && (
            <p className="text-sm text-slate-400 text-center py-10">{t('No articles in project. Add text to begin.')}</p>
          )}
        </div>
      </aside>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 px-8 py-4 shadow-sm z-10 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setActiveView('topology')}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${activeView === 'topology' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('Topology Network')}
              </button>
              <button 
                onClick={() => setActiveView('analytics')}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${activeView === 'analytics' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('Graph Analytics')}
              </button>
              <button 
                onClick={() => setActiveView('timeline')}
                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-colors ${activeView === 'timeline' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('Timeline Matrix')}
              </button>
            </div>
            {activeView === 'topology' && (
                <ViewControls 
                  graphMode={graphMode}
                  setGraphMode={setGraphMode}
                  showSourceNodes={showSourceNodes}
                  setShowSourceNodes={setShowSourceNodes}
                  showFrequencies={showFrequencies}
                  setShowFrequencies={setShowFrequencies}
                  showGroupEnclosures={showGroupEnclosures}
                  setShowGroupEnclosures={setShowGroupEnclosures}
                  showCurvedEdges={showCurvedEdges}
                  setShowCurvedEdges={setShowCurvedEdges}
                  fontFamily={fontFamily}
                  setFontFamily={setFontFamily}
                  showDebug={showDebug}
                  setShowDebug={setShowDebug}
                />
            )}
          </div>

          <div className="flex items-center gap-4">
             {activeView === 'topology' ? (
                null
             ) : (
               <span className="text-xs text-rose-500/70 font-medium italic hidden xl:block text-right leading-tight">
                 {t('* Export matches current viewport.')}
               </span>
             )}
             <div className="flex items-center gap-2">
               <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1">
                 <span className="text-[10px] font-bold text-slate-400 uppercase px-2">{t('Data')}</span>
                 <button onClick={exportCSV} className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 py-1 rounded">CSV</button>
                 <button onClick={exportJSON} className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 py-1 rounded">JSON</button>
               </div>
               <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm p-1">
                 <span className="text-[10px] font-bold text-slate-400 uppercase px-2">{isExporting ? 'Rendering...' : t('Image')}</span>
                 <button onClick={() => exportImage('png')} disabled={isExporting} className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 py-1 rounded disabled:opacity-50">PNG</button>
                 <button onClick={() => exportImage('jpeg')} disabled={isExporting} className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 py-1 rounded disabled:opacity-50">JPEG</button>
               </div>
             </div>
          </div>
        </header>

        <div className="flex-1 relative bg-slate-50 flex flex-col">
          {processedArticles.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-700">{t('Canvas Empty')}</h3>
                <p className="text-sm text-slate-500 mt-1 max-w-sm">{t('Add articles on the left and run the LLM Analysis pipeline to generate the topology network.')}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative">
              {activeView === 'topology' ? (
                <>
                <BlameNetwork 
                  allArticles={processedArticles}
                  filteredArticles={filteredProcessedArticles} 
                  sources={uniqueSources} 
                  hoveredArticle={hoveredArticle} 
                  showSourceNodes={showSourceNodes}
                  showFrequencies={showFrequencies}
                  showGroupEnclosures={showGroupEnclosures}
                  showCurvedEdges={showCurvedEdges}
                  fontFamily={fontFamily}
                  showDebug={showDebug}
                  graphMode={graphMode}
                  relationColors={project.relationColors || {}}
                  isExporting={isExporting}
                  exportSettings={exportSettings}
                  onColorChange={(relation, color) => {
                    const newColors = { ...(project.relationColors || {}), [relation]: color };
                    useStore.getState().updateProject(project.id, { relationColors: newColors });
                  }}
                  onLinkSelected={handleLinkSelected}
                />
                
                {/* Floating Aesthetics Panel */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/95 backdrop-blur border border-slate-200 rounded-full shadow-lg p-2 px-6 z-40">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{t('Aesthetics:')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">{t('Spread')}</span>
                    <input 
                      type="range" min="0.8" max="2.5" step="0.05" 
                      value={exportSettings.spreadScale ?? 0.8}
                      onChange={e => setExportSettings(p => ({...p, spreadScale: parseFloat(e.target.value) || 0.8}))}
                      className="w-14 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                      title={t('Spread out node distances')}
                    />
                    <input 
                      type="number" min="0.8" max="2.5" step="0.05" 
                      value={exportSettings.spreadScale ?? 0.8}
                      onChange={e => setExportSettings(p => ({...p, spreadScale: parseFloat(e.target.value) || 0.8}))}
                      className="w-11 px-1 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 text-center focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">{t('Nodes')}</span>
                    <input 
                      type="range" min="0.5" max="3" step="0.05" 
                      value={exportSettings.nodeScale ?? 1.9}
                      onChange={e => setExportSettings(p => ({...p, nodeScale: parseFloat(e.target.value) || 1.0}))}
                      className="w-14 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input 
                      type="number" min="0.5" max="3" step="0.05" 
                      value={exportSettings.nodeScale ?? 1.9}
                      onChange={e => setExportSettings(p => ({...p, nodeScale: parseFloat(e.target.value) || 1.0}))}
                      className="w-11 px-1 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 text-center focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">{t('Labels')}</span>
                    <input 
                      type="range" min="0.5" max="3" step="0.05" 
                      value={exportSettings.textScale ?? 1.25}
                      onChange={e => setExportSettings(p => ({...p, textScale: parseFloat(e.target.value) || 1.0}))}
                      className="w-14 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input 
                      type="number" min="0.5" max="3" step="0.05" 
                      value={exportSettings.textScale ?? 1.25}
                      onChange={e => setExportSettings(p => ({...p, textScale: parseFloat(e.target.value) || 1.0}))}
                      className="w-11 px-1 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 text-center focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">{t('Edges')}</span>
                    <input 
                      type="range" min="0.5" max="3" step="0.05" 
                      value={exportSettings.edgeScale ?? 1.0}
                      onChange={e => setExportSettings(p => ({...p, edgeScale: parseFloat(e.target.value) || 1.0}))}
                      className="w-14 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input 
                      type="number" min="0.5" max="3" step="0.05" 
                      value={exportSettings.edgeScale ?? 1.0}
                      onChange={e => setExportSettings(p => ({...p, edgeScale: parseFloat(e.target.value) || 1.0}))}
                      className="w-11 px-1 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 text-center focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400">{t('Arrows')}</span>
                    <input 
                      type="range" min="0.1" max="3" step="0.05" 
                      value={exportSettings.arrowScale ?? 0.5}
                      onChange={e => setExportSettings(p => ({...p, arrowScale: parseFloat(e.target.value) || 0.1}))}
                      className="w-14 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input 
                      type="number" min="0.1" max="3" step="0.05" 
                      value={exportSettings.arrowScale ?? 0.5}
                      onChange={e => setExportSettings(p => ({...p, arrowScale: parseFloat(e.target.value) || 0.1}))}
                      className="w-11 px-1 py-0.5 text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700 text-center focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  </div>
                </div>
                </>
              ) : activeView === 'analytics' ? (
                <GraphAnalyticsView project={project} articles={projectArticles} />
              ) : (
                <TimelineView 
                  articles={filteredProcessedArticles} 
                  sources={uniqueSources} 
                  hoveredArticle={hoveredArticle} 
                />
              )}
            </div>
          )}
        </div>
      </main>

      {isMethodModalOpen && (
        <MethodModal onClose={() => setIsMethodModalOpen(false)} />
      )}
    </div>
  );
}

