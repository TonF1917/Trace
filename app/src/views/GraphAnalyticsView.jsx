import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGraphGlobalMetrics } from '../utils/graphAnalytics';
import { generateTopologyReport } from '../services/LLMService';
import { 
  Network, 
  Share2, 
  Users, 
  Award, 
  FileText, 
  Download, 
  Sparkles, 
  Search, 
  ArrowUpDown,
  Layers,
  Zap,
  Target
} from 'lucide-react';

export function GraphAnalyticsView({ project, articles }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('degree');
  const [sortAsc, setSortAsc] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [reportError, setReportError] = useState('');

  // Extract nodes and links from processed articles
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map();
    const linkList = [];

    articles.forEach(article => {
      if (!article.isProcessed || !article.extractedData) return;
      const data = article.extractedData;
      const rels = data.relationships || data.relations || [];

      rels.forEach(rel => {
        const actor = rel.main_actor || rel.actor || rel.source;
        const target = rel.blame_target || rel.target;
        if (!actor || !target) return;

        const normActor = actor.trim();
        const normTarget = target.trim();

        if (!nodeMap.has(normActor)) {
          nodeMap.set(normActor, { id: normActor, name: normActor, sources: [article.id] });
        } else {
          nodeMap.get(normActor).sources.push(article.id);
        }

        if (!nodeMap.has(normTarget)) {
          nodeMap.set(normTarget, { id: normTarget, name: normTarget, sources: [article.id] });
        } else {
          nodeMap.get(normTarget).sources.push(article.id);
        }

        linkList.push({
          source: normActor,
          target: normTarget,
          relation: rel.relation_type || rel.relation || 'Opposes / Blames',
          weight: 1
        });
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: linkList
    };
  }, [articles]);

  // Compute graph metrics
  const metrics = useMemo(() => {
    return getGraphGlobalMetrics(nodes, links);
  }, [nodes, links]);

  // Filtered & Sorted Node Metrics
  const filteredMetrics = useMemo(() => {
    let list = metrics.nodeMetrics || [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(term));
    }

    return list.sort((a, b) => {
      let valA = a[sortField] ?? 0;
      let valB = b[sortField] ?? 0;
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [metrics.nodeMetrics, searchTerm, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleGenerateReport = async () => {
    if (nodes.length === 0) return;
    setIsGenerating(true);
    setReportError('');
    try {
      const report = await generateTopologyReport(project, metrics);
      setAiReport(report);
    } catch (err) {
      setReportError(err.message || 'Failed to generate AI topology report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!aiReport) return;
    const blob = new Blob([aiReport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_Topology_Report.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-6 text-slate-100 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-cyan-400" />
            {t('Graph Analytics')}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {project.name} — {t('Graph Metrics & Louvain Communities')}
          </p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || nodes.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? t('Generating Report...') : t('Generate AI Analysis Report')}
        </button>
      </div>

      {/* Global Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Total Nodes')}</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.numNodes}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Total Edges')}</span>
            <Network className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.numLinks}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Network Density')}</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.density}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Avg Degree')}</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.avgDegree}</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{t('Communities Count')}</span>
            <Users className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{metrics.communityCount}</div>
        </div>
      </div>

      {/* Top Rankings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Hubs */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 text-blue-400 font-semibold border-b border-slate-800 pb-3">
            <Award className="w-5 h-5" />
            <span>{t('Top Hubs')} (Highest Degree)</span>
          </div>
          <div className="space-y-3">
            {metrics.topHubs.length === 0 ? (
              <p className="text-xs text-slate-500">No data available</p>
            ) : (
              metrics.topHubs.map((hub, idx) => (
                <div key={hub.id} className="flex items-center justify-between text-sm bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
                  <span className="font-medium text-slate-200 truncate max-w-[160px]">{idx + 1}. {hub.name}</span>
                  <span className="text-xs font-mono px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                    Degree {hub.degree}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Bridges */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 text-violet-400 font-semibold border-b border-slate-800 pb-3">
            <Share2 className="w-5 h-5" />
            <span>{t('Top Bridges')} (Betweenness)</span>
          </div>
          <div className="space-y-3">
            {metrics.topBridges.length === 0 ? (
              <p className="text-xs text-slate-500">No data available</p>
            ) : (
              metrics.topBridges.map((bridge, idx) => (
                <div key={bridge.id} className="flex items-center justify-between text-sm bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
                  <span className="font-medium text-slate-200 truncate max-w-[160px]">{idx + 1}. {bridge.name}</span>
                  <span className="text-xs font-mono px-2 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded">
                    {bridge.betweenness}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Targets */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-2 text-rose-400 font-semibold border-b border-slate-800 pb-3">
            <Target className="w-5 h-5" />
            <span>{t('Top Targets')} (In-Degree)</span>
          </div>
          <div className="space-y-3">
            {metrics.topTargets.length === 0 ? (
              <p className="text-xs text-slate-500">No data available</p>
            ) : (
              metrics.topTargets.map((target, idx) => (
                <div key={target.id} className="flex items-center justify-between text-sm bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
                  <span className="font-medium text-slate-200 truncate max-w-[160px]">{idx + 1}. {target.name}</span>
                  <span className="text-xs font-mono px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                    In-Degree {target.inDegree}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Topology Briefing Report Section */}
      {(aiReport || isGenerating || reportError) && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              {t('AI Topology Briefing Report')}
            </h2>

            {aiReport && (
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5" />
                {t('Export Markdown')}
              </button>
            )}
          </div>

          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm font-medium">{t('Generating Report...')}</p>
            </div>
          ) : reportError ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
              {reportError}
            </div>
          ) : (
            <div className="prose prose-invert max-w-none prose-slate text-sm leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-6 rounded-xl border border-slate-800/80">
              {aiReport}
            </div>
          )}
        </div>
      )}

      {/* Centrality Rankings Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            {t('Node Centrality Ranking')}
          </h2>

          {/* Search filter */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search entity..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('degree')}>
                  <div className="flex items-center gap-1">
                    {t('Degree')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('inDegree')}>
                  <div className="flex items-center gap-1">
                    {t('In-Degree')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('outDegree')}>
                  <div className="flex items-center gap-1">
                    {t('Out-Degree')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-white" onClick={() => handleSort('betweenness')}>
                  <div className="flex items-center gap-1">
                    {t('Betweenness')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">{t('Community')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No nodes found matching your query.
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-sans font-medium text-slate-200">{row.name}</td>
                    <td className="py-3 px-4 text-blue-400 font-bold">{row.degree}</td>
                    <td className="py-3 px-4 text-rose-400">{row.inDegree}</td>
                    <td className="py-3 px-4 text-cyan-400">{row.outDegree}</td>
                    <td className="py-3 px-4 text-violet-400">{row.betweenness}</td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold text-white"
                        style={{ backgroundColor: row.communityColor + '33', color: row.communityColor, border: `1px solid ${row.communityColor}66` }}
                      >
                        Community {row.communityId + 1}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
