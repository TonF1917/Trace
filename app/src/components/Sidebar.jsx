import React from 'react';
import { Newspaper, Filter, Layers, Info } from 'lucide-react';

export function Sidebar({ events, sources, selectedEvent, setSelectedEvent, selectedSources, toggleSource, openMethodModal }) {
  return (
    <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col h-full shadow-xl z-20">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-center gap-3 text-white mb-8">
          <img src="/logo.png" alt="Trace Logo" className="w-8 h-8 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
          <span className="text-2xl font-bold tracking-tight">Trace</span>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <Filter className="w-4 h-4" />
            <h3 className="text-xs uppercase font-semibold tracking-wider">Select Event</h3>
          </div>
          <div className="space-y-2">
            {events.map(event => (
              <button
                key={event.id}
                onClick={() => setSelectedEvent(event.id)}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
                  selectedEvent === event.id 
                    ? 'bg-rose-600 text-white font-medium shadow-md' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                {event.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-auto">
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <Newspaper className="w-4 h-4" />
            <h3 className="text-xs uppercase font-semibold tracking-wider">Media Sources</h3>
          </div>
          <div className="space-y-3">
            {sources.map(source => (
              <label key={source.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source.id)}
                  onChange={() => toggleSource(source.id)}
                  className="w-4 h-4 rounded border-slate-600 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900 bg-slate-800"
                />
                <span className="text-sm font-medium group-hover:text-white transition-colors" style={{ color: selectedSources.includes(source.id) ? source.color : '#94a3b8' }}>
                  {source.name}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Methodology Button */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <button 
            onClick={openMethodModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-sm font-medium transition-colors"
          >
            <Info className="w-4 h-4" />
            Methodology Note
          </button>
        </div>
      </div>
    </aside>
  );
}

