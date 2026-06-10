import React from 'react';
import { Target, Users, Tag, Clock } from 'lucide-react';

export function TimelineView({ articles, sources, hoveredArticle }) {
  // Sort articles chronologically
  const sortedArticles = [...articles].sort((a, b) => new Date(a.date) - new Date(b.date));

  const toneColors = {
    Alarmed: 'bg-red-100 text-red-800 border-red-200',
    Neutral: 'bg-slate-100 text-slate-800 border-slate-200',
    Sympathetic: 'bg-rose-100 text-rose-800 border-rose-200',
    Critical: 'bg-orange-100 text-orange-800 border-orange-200'
  };

  if (sortedArticles.length === 0) {
    return (
      <div className="absolute inset-0 bg-white flex items-center justify-center p-6 text-slate-400 font-medium">
        No articles to display. Please adjust filters.
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-slate-50 overflow-y-auto p-8 border border-slate-200 rounded-xl shadow-inner">
      <div className="max-w-3xl mx-auto relative">
        {/* Vertical Line */}
        <div className="absolute left-[27px] top-4 bottom-4 w-px bg-slate-300"></div>

        <div className="space-y-10 relative z-10">
          {sortedArticles.map((article, index) => {
            const source = sources.find(s => s.id === article.source_id);
            const isHovered = hoveredArticle === article.id;
            
            return (
              <div 
                key={article.id} 
                className={`flex gap-6 transition-opacity duration-300 ${hoveredArticle && !isHovered ? 'opacity-30' : 'opacity-100'}`}
              >
                {/* Timeline Dot */}
                <div className="mt-1 flex flex-col items-center">
                  <div 
                    className="w-[14px] h-[14px] rounded-full border-2 border-white shadow-sm ring-4 ring-slate-50"
                    style={{ backgroundColor: source?.color || '#cbd5e1' }}
                  ></div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-3 mb-2">
                    <span 
                      className="text-xs font-black uppercase tracking-widest"
                      style={{ color: source?.color || '#475569' }}
                    >
                      {source?.name}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3" />
                      {article.date ? new Date(article.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No date'}
                    </span>
                    <div className="ml-auto">
                       <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${toneColors[article.tone] || toneColors.Neutral}`}>
                         {article.tone}
                       </span>
                    </div>
                  </div>

                  <a 
                    href={article.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block mb-3"
                  >
                    <h3 className="text-xl font-bold text-slate-900 leading-snug group-hover:text-rose-700 group-hover:underline transition-colors">
                      {article.headline || article.title || 'Untitled Document'}
                    </h3>
                  </a>

                  <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                    {article.lede || article.content || ''}
                  </p>

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
                    <div className="flex items-start gap-2">
                      <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <span className="text-slate-500 font-medium block mb-0.5">Main Actor</span>
                        <span className="text-slate-800 font-bold">{article.actors?.main_actor || 'Unknown'}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <span className="text-slate-500 font-medium block mb-0.5">Blame Target</span>
                        <span className="text-red-700 font-bold">{article.actors?.blame_target || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {article.frames.map(frame => (
                      <span 
                        key={frame} 
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider font-bold rounded border border-slate-200"
                      >
                        <Tag className="w-3 h-3" />
                        {frame}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

