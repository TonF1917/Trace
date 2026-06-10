import React from 'react';
import { useTranslation } from 'react-i18next';

export function ViewControls({ 
  graphMode, setGraphMode,
  showSourceNodes, setShowSourceNodes,
  showFrequencies, setShowFrequencies,
  showGroupEnclosures, setShowGroupEnclosures,
  showCurvedEdges, setShowCurvedEdges,
  showDebug, setShowDebug
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center ml-2 bg-white rounded-lg shadow-sm border border-slate-200 p-1">
      <div className="flex bg-slate-100 p-0.5 rounded-md mr-3">
        <button 
          onClick={() => setGraphMode('explore')}
          className={`px-3 py-1 text-xs font-bold rounded transition-all ${graphMode === 'explore' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('Explore')}
        </button>
        <button 
          onClick={() => setGraphMode('manual')}
          className={`px-3 py-1 text-xs font-bold rounded transition-all ${graphMode === 'manual' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
          title={t('Drag nodes to pin them. Click a pinned node to unpin.')}
        >
          {t('Manual')}
        </button>
        <button 
          onClick={() => setGraphMode('figure')}
          className={`px-3 py-1 text-xs font-bold rounded transition-all ${graphMode === 'figure' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t('Figure')}
        </button>
      </div>

      <div className="flex items-center gap-3 px-2 border-l border-slate-200">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-800">
          <input 
            type="checkbox" 
            checked={showSourceNodes} 
            onChange={(e) => setShowSourceNodes(e.target.checked)}
            className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
          />
          {t('Sources')}
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-800">
          <input 
            type="checkbox" 
            checked={showFrequencies} 
            onChange={(e) => setShowFrequencies(e.target.checked)}
            className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
          />
          {t('Freq')}
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-800">
          <input 
            type="checkbox" 
            checked={showGroupEnclosures} 
            onChange={(e) => setShowGroupEnclosures(e.target.checked)}
            className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
          />
          {t('Groups')}
        </label>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-800">
          <input 
            type="checkbox" 
            checked={showCurvedEdges} 
            onChange={(e) => setShowCurvedEdges(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          {t('Curve')}
        </label>
        <div className="w-px h-4 bg-slate-200 mx-1"></div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-700">
          <input 
            type="checkbox" 
            checked={showDebug} 
            onChange={(e) => setShowDebug(e.target.checked)}
            className="rounded text-slate-400 focus:ring-slate-400 cursor-pointer"
          />
          🐞 {t('Debug')}
        </label>
      </div>
    </div>
  );
}
