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
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 text-slate-800 space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-rose-600" />
            {t('Graph Analytics')}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {project.name} — {t('Graph Metrics & Louvain Communities')}
          </p>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating || nodes.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-sm transition disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          {isGenerating ? t('Generating Report...') : t('Generate AI Analysis Report')}
        </button>
      </div>

      {/* Global Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('Total Nodes')}</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.numNodes}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('Total Edges')}</span>
            <Network className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.numLinks}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('Network Density')}</span>
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.density}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('Avg Degree')}</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.avgDegree}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">{t('Communities Count')}</span>
            <Users className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.communityCount}</div>
        </div>
      </div>

      {/* Top Rankings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Hubs */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-blue-700 font-black border-b border-slate-100 pb-3">
            <Award className="w-5 h-5 text-blue-600" />
            <span>{t('Top Hubs')} (Highest Degree)</span>
          </div>
          <div className="space-y-2.5">
            {metrics.topHubs.length === 0 ? (
              <p className="text-xs text-slate-400">No data available</p>
            ) : (
              metrics.topHubs.map((hub, idx) => (
                <div key={hub.id} className="flex items-center justify-between text-sm bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-800 truncate max-w-[160px]">{idx + 1}. {hub.name}</span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-md">
                    Degree {hub.degree}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Bridges */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-purple-700 font-black border-b border-slate-100 pb-3">
            <Share2 className="w-5 h-5 text-purple-600" />
            <span>{t('Top Bridges')} (Betweenness)</span>
          </div>
          <div className="space-y-2.5">
            {metrics.topBridges.length === 0 ? (
              <p className="text-xs text-slate-400">No data available</p>
            ) : (
              metrics.topBridges.map((bridge, idx) => (
                <div key={bridge.id} className="flex items-center justify-between text-sm bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-800 truncate max-w-[160px]">{idx + 1}. {bridge.name}</span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-md">
                    {bridge.betweenness}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Targets */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-rose-700 font-black border-b border-slate-100 pb-3">
            <Target className="w-5 h-5 text-rose-600" />
            <span>{t('Top Targets')} (In-Degree)</span>
          </div>
          <div className="space-y-2.5">
            {metrics.topTargets.length === 0 ? (
              <p className="text-xs text-slate-400">No data available</p>
            ) : (
              metrics.topTargets.map((target, idx) => (
                <div key={target.id} className="flex items-center justify-between text-sm bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                  <span className="font-bold text-slate-800 truncate max-w-[160px]">{idx + 1}. {target.name}</span>
                  <span className="text-xs font-bold font-mono px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-md">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-600" />
              {t('AI Topology Briefing Report')}
            </h2>

            {aiReport && (
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition"
              >
                <Download className="w-3.5 h-3.5" />
                {t('Export Markdown')}
              </button>
            )}
          </div>

          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
              <Sparkles className="w-8 h-8 text-rose-600 animate-spin" />
              <p className="text-sm font-bold">{t('Generating Report...')}</p>
            </div>
          ) : reportError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium">
              {reportError}
            </div>
          ) : (
            <div className="prose prose-slate max-w-none text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 p-6 rounded-xl border border-slate-200 font-sans text-slate-800">
              {aiReport}
            </div>
          )}
        </div>
      )}

      {/* Centrality Rankings Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
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
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('degree')}>
                  <div className="flex items-center gap-1">
                    {t('Degree')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('inDegree')}>
                  <div className="flex items-center gap-1">
                    {t('In-Degree')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('outDegree')}>
                  <div className="flex items-center gap-1">
                    {t('Out-Degree')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 cursor-pointer hover:text-slate-900" onClick={() => handleSort('betweenness')}>
                  <div className="flex items-center gap-1">
                    {t('Betweenness')}
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">{t('Community')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No nodes found matching your query.
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-sans font-bold text-slate-800">{row.name}</td>
                    <td className="py-3 px-4 text-blue-600 font-extrabold">{row.degree}</td>
                    <td className="py-3 px-4 text-rose-600 font-bold">{row.inDegree}</td>
                    <td className="py-3 px-4 text-cyan-600 font-bold">{row.outDegree}</td>
                    <td className="py-3 px-4 text-purple-600 font-bold">{row.betweenness}</td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-sans font-bold"
                        style={{ backgroundColor: row.communityColor + '1a', color: row.communityColor, border: `1px solid ${row.communityColor}44` }}
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
