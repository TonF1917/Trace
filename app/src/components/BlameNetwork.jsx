import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceX, forceY, forceCollide } from 'd3-force';
import { detectCommunitiesLouvain, COMMUNITY_COLORS, calculateDegreeCentrality } from '../utils/graphAnalytics';

export const DEFAULT_RELATION_COLORS = {
  'Opposes / Blames': '#b2182b',     // Deep Red
  'Supports / Allies': '#2166ac',    // Deep Blue
  'Influences / Controls': '#01665e',// Dark Teal
  'Negotiates / Compromises': '#762a83', // Deep Purple
  'Funds / Finances': '#bf812d',     // Brown/Gold
  'Represents': '#4d9221',           // Forest Green
  'Incites / Mobilizes': '#c51b7d',  // Magenta/Pink
  'Belongs To': '#e08214',           // Orange
  'default': '#808080'               // Standard Gray
};

export const normalizeEntity = (name) => {
  if (!name) return 'Unknown';
  let n = name.trim().toLowerCase();
  
  // Basic cleaning
  n = n.replace(/^the\s+/i, '');
  n = n.replace(/^(a|an)\s+/i, '');
  n = n.replace(/[^\w\s-]/g, ''); // Remove punctuation
  
  return n;
};

export const normalizeRelation = (relationType) => {
  let rawRel = relationType ? relationType.trim() : 'Opposes / Blames';
  if (/rejects?\s*\/\s*denies?/i.test(rawRel) || /blames?\s*\/\s*opposes?/i.test(rawRel)) rawRel = 'Opposes / Blames';
  if (/controls?\s*\/\s*dominates?/i.test(rawRel) || /^influences?$/i.test(rawRel)) rawRel = 'Influences / Controls';
  if (/compromises?\s*with/i.test(rawRel) || /negotiates?\s*with/i.test(rawRel)) rawRel = 'Negotiates / Compromises';
  if (/belongs?\s*to/i.test(rawRel)) rawRel = 'Belongs To';
  return rawRel;
};

const getConvexHull = (points) => {
  if (points.length <= 2) return points;
  const pts = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (let i = 0; i < pts.length; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pts[i]) <= 0) lower.pop();
    lower.push(pts[i]);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pts[i]) <= 0) upper.pop();
    upper.push(pts[i]);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
};

export function BlameNetwork({ allArticles, filteredArticles, sources, hoveredArticle, showSourceNodes, showFrequencies, showGroupEnclosures = true, showCurvedEdges = true, fontFamily = 'serif', showDebug = false, relationColors = {}, onColorChange, isExporting = false, exportSettings = { nodeScale: 1.9, textScale: 1.25, edgeScale: 1.0, arrowScale: 0.5, spreadScale: 0.8 }, graphMode = 'explore', onLinkSelected }) {
  const RELATION_COLORS = useMemo(() => ({ ...DEFAULT_RELATION_COLORS, ...relationColors }), [relationColors]);
  const containerRef = useRef(null);
  // Reference to the ForceGraph component
  const fgRef = useRef();
  const hasFit = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hiddenRelations, setHiddenRelations] = useState(new Set());
  // Community highlight: null = all visible, number/string = only that group is highlighted
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  // Hovered group from legend hover interaction
  const [hoveredGroup, setHoveredGroup] = useState(null);
  // Legend View Modes: 'community' | 'centrality' | 'stance'
  const [legendGroupMode, setLegendGroupMode] = useState('community');
  // Collapsible legend toggle
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  // Per-frame label collision list — cleared at frame start, populated as labels are drawn
  const labelOccupiedRects = useRef([]);

  const toggleRelation = (relationName) => {
    setHiddenRelations(prev => {
      const next = new Set(prev);
      if (next.has(relationName)) next.delete(relationName);
      else next.add(relationName);
      return next;
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const persistentNodes = useRef(new Map());

  const graphData = useMemo(() => {
    const currentNodesMap = new Map();
    const links = [];

    const entityFrequencies = {};
    
    const getRels = (article) => {
      if (article.extractedData && Array.isArray(article.extractedData.relationships) && article.extractedData.relationships.length > 0) {
        return article.extractedData.relationships;
      }
      if (article.actors && article.actors.main_actor && article.actors.blame_target) {
        return [{
          date: article.date,
          main_actor: article.actors.main_actor,
          blame_target: article.actors.blame_target,
          relation_type: article.relation_type || 'Opposes / Blames',
          frames: article.frames || [],
          tone: article.tone || 'Neutral'
        }];
      }
      return [];
    };

    allArticles.forEach(article => {
      const rels = getRels(article);
      rels.forEach(rel => {
        const target = normalizeEntity(rel.blame_target);
        const actor = normalizeEntity(rel.main_actor);
        entityFrequencies[target] = (entityFrequencies[target] || 0) + 1;
        entityFrequencies[actor] = (entityFrequencies[actor] || 0) + 1;
      });
    });

    filteredArticles.forEach(article => {
      const sourceNodeId = `source-${article.source_id}`;
      const rels = getRels(article);

      rels.forEach((rel, relIndex) => {
        const rawActor = (rel.main_actor || 'Unknown').replace(/\s*\(.*?\)\s*/g, '').trim();
        const rawTarget = (rel.blame_target || 'Unknown').replace(/\s*\(.*?\)\s*/g, '').trim();
        const mainActorId = `entity-${normalizeEntity(rawActor)}`;
        const blameTargetId = `entity-${normalizeEntity(rawTarget)}`;
        
        if (showSourceNodes) {
          if (!currentNodesMap.has(sourceNodeId)) {
            if (!persistentNodes.current.has(sourceNodeId)) {
              persistentNodes.current.set(sourceNodeId, { id: sourceNodeId, group: 'source' });
            }
            const sourceInfo = sources.find(s => s.id === article.source_id);
            const sourceNode = persistentNodes.current.get(sourceNodeId);
            sourceNode.name = sourceInfo ? sourceInfo.name : 'Unknown Source';
            sourceNode.color = sourceInfo ? sourceInfo.color : '#cbd5e1';
            sourceNode.val = 15;
            currentNodesMap.set(sourceNodeId, sourceNode);
          }
        }

        if (!currentNodesMap.has(mainActorId)) {
          const existingNode = persistentNodes.current.get(mainActorId);
          if (!existingNode || typeof existingNode.x !== 'number' || !isFinite(existingNode.x) || Math.abs(existingNode.x) > 5000) {
            persistentNodes.current.set(mainActorId, { 
              id: mainActorId, 
              group: 'actor',
              x: Math.random() * 10 - 5,
              y: Math.random() * 10 - 5
            });
          }
          const actorNode = persistentNodes.current.get(mainActorId);
          actorNode.name = rawActor;
          actorNode.color = '#64748b'; 
          const freq = entityFrequencies[normalizeEntity(rawActor)] || 1;
          const baseRadius = Math.max(6, 6 * Math.sqrt(freq)); 
          actorNode.academicRadius = baseRadius;
          actorNode.val = baseRadius * baseRadius; 
          actorNode.rawVal = freq;
          currentNodesMap.set(mainActorId, actorNode);
        }

        if (!currentNodesMap.has(blameTargetId)) {
          const existingNode = persistentNodes.current.get(blameTargetId);
          if (!existingNode || typeof existingNode.x !== 'number' || !isFinite(existingNode.x) || Math.abs(existingNode.x) > 5000) {
            persistentNodes.current.set(blameTargetId, { 
              id: blameTargetId, 
              group: 'target',
              x: Math.random() * 10 - 5,
              y: Math.random() * 10 - 5
            });
          }
          const targetNode = persistentNodes.current.get(blameTargetId);
          targetNode.name = rawTarget;
          targetNode.color = '#64748b'; 
          const freq = entityFrequencies[normalizeEntity(rawTarget)] || 1;
          const baseRadius = Math.max(6, 6 * Math.sqrt(freq));
          targetNode.academicRadius = baseRadius;
          targetNode.val = baseRadius * baseRadius;
          targetNode.rawVal = freq;
          currentNodesMap.set(blameTargetId, targetNode);
        }

        if (showSourceNodes) {
          const sourceToActorId = `${sourceNodeId}-${mainActorId}`;
          if (!links.some(l => l.id === sourceToActorId)) {
            links.push({
              id: sourceToActorId,
              source: sourceNodeId,
              target: mainActorId,
              label: 'mentions',
              color: '#cbd5e1',
              dashed: false,
              articleIds: new Set([article.id])
            });
          }

          const sourceToTargetId = `${sourceNodeId}-${blameTargetId}`;
          if (!links.some(l => l.id === sourceToTargetId)) {
            links.push({
              id: sourceToTargetId,
              source: sourceNodeId,
              target: blameTargetId,
              label: 'mentions target',
              color: '#cbd5e1',
              dashed: true,
              articleIds: new Set([article.id])
            });
          }
        }
        
        let rawRel = rel.relation_type ? rel.relation_type.trim() : 'Opposes / Blames';
        
        if (/rejects?\s*\/\s*denies?/i.test(rawRel) || /blames?\s*\/\s*opposes?/i.test(rawRel)) rawRel = 'Opposes / Blames';
        if (/controls?\s*\/\s*dominates?/i.test(rawRel) || /^influences?$/i.test(rawRel)) rawRel = 'Influences / Controls';
        if (/compromises?\s*with/i.test(rawRel) || /negotiates?\s*with/i.test(rawRel)) rawRel = 'Negotiates / Compromises';
        if (/belongs?\s*to/i.test(rawRel)) rawRel = 'Belongs To';
        
        const relType = rawRel;
        
        if (!hiddenRelations.has(relType)) {
          const linkColor = RELATION_COLORS[relType] || RELATION_COLORS.default;
          const actorToTargetId = `${mainActorId}-${blameTargetId}-${relType}`;
          if (!links.some(l => l.id === actorToTargetId)) {
            links.push({
              id: actorToTargetId,
              source: mainActorId,
              target: blameTargetId,
              label: relType,
              color: linkColor,
              dashed: false,
              articleIds: new Set([article.id])
            });
          } else {
            links.find(l => l.id === actorToTargetId).articleIds.add(article.id);
          }
        }
      });
    });



    const minFreq = exportSettings?.minFreq || 1;
    const freqFilteredNodes = Array.from(currentNodesMap.values()).filter(n => {
      if (n.group === 'source') return true;
      return (n.rawVal >= minFreq);
    });
    
    const validFreqNodeIds = new Set(freqFilteredNodes.map(n => n.id));
    const validFreqLinks = links.filter(l => validFreqNodeIds.has(l.source) && validFreqNodeIds.has(l.target));

    const actorsWithRelations = new Set();
    validFreqLinks.forEach(l => {
      if (l.label !== 'mentions' && l.label !== 'mentions target') {
        actorsWithRelations.add(l.source);
        actorsWithRelations.add(l.target);
      }
    });

    const finalNodes = freqFilteredNodes.filter(n => {
      if (n.group === 'source') {
        return validFreqLinks.some(l => l.source === n.id || l.target === n.id);
      }
      return actorsWithRelations.has(n.id);
    });

    const finalNodeIds = new Set(finalNodes.map(n => n.id));
    const finalLinks = validFreqLinks.filter(l => 
      finalNodeIds.has(l.source) && 
      finalNodeIds.has(l.target) && 
      l.source !== l.target
    );

    // Compute node degrees, inDegree, and outDegree for adaptive D3 forces, fan-out, and stance groups
    const degreeStatsMap = calculateDegreeCentrality(finalNodes, finalLinks);
    finalNodes.forEach(n => {
      const stats = degreeStatsMap.get(n.id) || { degree: 1, inDegree: 0, outDegree: 0 };
      n.degree = stats.degree || 1;
      n.inDegree = stats.inDegree || 0;
      n.outDegree = stats.outDegree || 0;
    });
    const nodeDegreeMap = new Map();
    finalNodes.forEach(n => nodeDegreeMap.set(n.id, n.degree));

    // --- Robust Fan-out Curvature Algorithm ---
    // Step 1: Build a stable per-node edge list, sorted by linkIndex for consistency
    const pairMap = new Map();
    const nodeLinksMap = new Map(); // nodeId -> [{link, isSource}]
    finalNodes.forEach(n => nodeLinksMap.set(n.id, []));

    finalLinks.forEach((l, idx) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      const pairId = [s, t].sort().join('|');
      if (!pairMap.has(pairId)) pairMap.set(pairId, []);
      pairMap.get(pairId).push(l);

      if (nodeLinksMap.has(s)) nodeLinksMap.get(s).push({ link: l, isSource: true });
      if (nodeLinksMap.has(t)) nodeLinksMap.get(t).push({ link: l, isSource: false });
      l.linkIndex = idx;
    });

    // Step 2: For each edge, compute a unique fan-out slot based on its position
    // in the hub node's sorted edge list. This guarantees no two edges get the same curvature.
    finalLinks.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      const pairId = [s, t].sort().join('|');
      const pairGroup = pairMap.get(pairId) || [];

      if (pairGroup.length > 1) {
        // Multi-edge between same pair: fan out symmetrically
        const pairIdx = pairGroup.indexOf(l);
        const sign = pairIdx % 2 === 0 ? 1 : -1;
        const step = Math.ceil((pairIdx + 1) / 2);
        l.dynamicCurvature = sign * Math.min(0.15 + 0.10 * step, 0.38);
        l.fanIndex = pairIdx;
        l.fanTotal = pairGroup.length;
        return;
      }

      // Single edge: use visible, elegant hub fan-out
      const sDegree = nodeDegreeMap.get(s) || 1;
      const tDegree = nodeDegreeMap.get(t) || 1;
      const maxDeg = Math.max(sDegree, tDegree);

      if (!showCurvedEdges || maxDeg < 3) {
        l.dynamicCurvature = 0;
        l.fanIndex = 0;
        l.fanTotal = 1;
        return;
      }

      // Pick the hub node (higher degree) to compute fan slot
      const hubId = sDegree >= tDegree ? s : t;
      const hubEntries = nodeLinksMap.get(hubId) || [];
      // Sort by linkIndex so slot assignment is deterministic
      hubEntries.sort((a, b) => a.link.linkIndex - b.link.linkIndex);
      const hubIdx = hubEntries.findIndex(e => e.link === l);
      const hubTotal = hubEntries.length;

      // Set single edge curvature range to [-0.28, +0.28] for clearly visible, elegant arcs
      const maxCurve = Math.min(0.08 + 0.04 * hubTotal, 0.28);
      const normalizedPos = hubTotal > 1 ? (hubIdx / (hubTotal - 1)) * 2 - 1 : 0; // [-1, 1]
      l.dynamicCurvature = normalizedPos * maxCurve;
      l.fanIndex = hubIdx;
      l.fanTotal = hubTotal;
    });

    // Assign community weights: Opposes/Incites = 0 (don't merge), Supports/Belongs = 1.5 (strongly cohesive)
    finalLinks.forEach(l => {
      const rel = (l.label || '').toLowerCase();
      if (rel.includes('opposes') || rel.includes('blames') || rel.includes('incites')) {
        l.communityWeight = 0; // antagonistic — should NOT pull nodes into same community
      } else if (rel.includes('supports') || rel.includes('allies') || rel.includes('belongs') || rel.includes('represents')) {
        l.communityWeight = 2.0; // strongly cohesive
      } else {
        l.communityWeight = 1.0;
      }
    });

    // Louvain Community Detection
    const { communityMap, communities } = detectCommunitiesLouvain(finalNodes, finalLinks);
    finalNodes.forEach(n => {
      const cId = communityMap.get(n.id) ?? 0;
      n.communityId = cId;
      n.communityColor = COMMUNITY_COLORS[cId % COMMUNITY_COLORS.length];
    });

    return {
      nodes: finalNodes,
      links: finalLinks,
      communities
    };
  }, [allArticles, filteredArticles, sources, showSourceNodes, hiddenRelations, showCurvedEdges, exportSettings?.minFreq]);

  // Active group filter: hovered takes priority over clicked/selected
  const activeGroupFilter = hoveredGroup !== null ? hoveredGroup : selectedCommunity;

  // Helper to check if a node belongs to a given group in the current legend mode
  const isNodeInGroup = useCallback((node, mode, groupId) => {
    if (groupId === null || groupId === undefined || !node) return true;
    if (mode === 'community') {
      return node.communityId === groupId;
    }
    if (mode === 'centrality') {
      const deg = node.degree || 1;
      if (groupId === 'hubs') return deg >= 5;
      if (groupId === 'bridges') return deg >= 3 && deg <= 4;
      if (groupId === 'periphery') return deg <= 2;
    }
    if (mode === 'stance') {
      const inD = node.inDegree || 0;
      const outD = node.outDegree || 0;
      if (groupId === 'blamers') return outD > inD;
      if (groupId === 'targets') return inD > outD;
      if (groupId === 'neutral') return inD === outD;
    }
    return true;
  }, []);

  // Clean, non-overlapping community enclosures
  const enclosureGroups = useMemo(() => {
    if (!showGroupEnclosures || !graphData.communities) return [];

    return graphData.communities
      .filter(comm => comm.members && comm.members.length >= 2)
      .map(comm => ({
        id: comm.id,
        memberIds: comm.members,
        color: comm.color || COMMUNITY_COLORS[comm.id % COMMUNITY_COLORS.length]
      }));
  }, [graphData.communities, showGroupEnclosures]);

  const drawEnclosures = useCallback((ctx, globalScale) => {
    // Clear per-frame label collision list at the start of every frame
    labelOccupiedRects.current = [];

    if (!showGroupEnclosures || enclosureGroups.length === 0) return;

    const nodeMap = new Map();
    persistentNodes.current.forEach(n => nodeMap.set(n.id, n));

    ctx.save();
    enclosureGroups.forEach(group => {
      const points = [];

      group.memberIds.forEach(mId => {
        const node = nodeMap.get(mId);
        if (node && typeof node.x === 'number' && typeof node.y === 'number') {
          const r = (node.academicRadius || 10) * (exportSettings?.nodeScale || 1) + 16;
          points.push({ x: node.x, y: node.y - r });
          points.push({ x: node.x, y: node.y + r });
          points.push({ x: node.x - r, y: node.y });
          points.push({ x: node.x + r, y: node.y });
        }
      });

      if (points.length < 3) return;
      const hull = getConvexHull(points);
      if (hull.length < 3) return;

      const hex = group.color || '#94a3b8';
      let r = 148, g = 163, b = 184;
      if (hex.startsWith('#') && hex.length === 7) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
      }

      const isGroupActive = activeGroupFilter === group.id && legendGroupMode === 'community';
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isGroupActive ? 0.18 : 0.05})`;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isGroupActive ? 0.85 : 0.25})`;

      const edgeScale = exportSettings?.edgeScale || 1;
      ctx.lineWidth = (isGroupActive ? 3.0 : 1.5) * edgeScale;
      ctx.lineJoin = 'round';
      ctx.setLineDash([5 * edgeScale, 5 * edgeScale]);

      ctx.beginPath();
      hull.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }, [enclosureGroups, showGroupEnclosures, exportSettings, persistentNodes]);

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (graphData.nodes.length > 0 && dimensions.width > 0 && dimensions.height > 0 && fgRef.current) {
      try {
        const spread = exportSettings?.spreadScale ?? 0.8;
        const nodeScale = exportSettings?.nodeScale || 1.9;
        const textScale = exportSettings?.textScale || 1.25;

        // 1. Scaled collision radius based on node radius + text padding
        fgRef.current.d3Force('collide', forceCollide().radius(n => {
          const r = (n.academicRadius || 10) * nodeScale;
          return r + 28 * textScale;
        }).strength(1.0).iterations(10));

        // 2. Strong degree-weighted repulsion so hubs & large nodes never overlap
        const chargeForce = fgRef.current.d3Force('charge');
        if (chargeForce && typeof chargeForce.strength === 'function') {
          chargeForce.strength(n => {
            const deg = n.degree || 1;
            const r = (n.academicRadius || 10) * nodeScale;
            return (-500 - 150 * Math.log2(1 + deg) - 15 * r) * spread;
          });
        }

        // 3. Link distance guaranteed to exceed the sum of radii of connected nodes + padding
        const linkForce = fgRef.current.d3Force('link');
        if (linkForce && typeof linkForce.distance === 'function') {
          linkForce.distance(link => {
            const sNode = typeof link.source === 'object' ? link.source : {};
            const tNode = typeof link.target === 'object' ? link.target : {};
            const sR = (sNode.academicRadius || 10) * nodeScale;
            const tR = (tNode.academicRadius || 10) * nodeScale;
            const maxDeg = Math.max(sNode.degree || 1, tNode.degree || 1);
            return Math.max(110 * spread, (sR + tR + 55 * textScale + 8 * Math.min(maxDeg, 8)) * spread);
          });
        }

        const gravityFn = n => {
          const deg = n.degree || 1;
          return Math.max(0.035, 0.035 + 0.035 / deg);
        };
        fgRef.current.d3Force('x', forceX(20).strength(gravityFn));
        fgRef.current.d3Force('y', forceY(0).strength(gravityFn));
        
        if (typeof fgRef.current.d3ReheatSimulation === 'function') {
          fgRef.current.d3ReheatSimulation();
        }
      } catch (err) {
        console.error('Error setting d3 forces:', err);
      }
    }
  }, [graphData.nodes.length, dimensions.width, dimensions.height, exportSettings]);

  const handleEngineStop = useCallback(() => {
    if (!hasFit.current && fgRef.current) {
      fgRef.current.zoomToFit(600, 80);
      hasFit.current = true;
    }
  }, []);

  const activeNodeIds = useMemo(() => {
    const ids = new Set();
    filteredArticles.forEach(a => {
      ids.add(`source-${a.source_id}`);
      ids.add(`entity-${normalizeEntity(a.actors?.main_actor)}`);
      ids.add(`entity-${normalizeEntity(a.actors?.blame_target)}`);
    });
    return ids;
  }, [filteredArticles]);

  const activeArticleIds = useMemo(() => new Set(filteredArticles.map(a => a.id)), [filteredArticles]);

  const nodeCanvasObject = useCallback((node, ctx) => {
    try {
      const isFilteredOut = filteredArticles.length < allArticles.length && !activeNodeIds.has(node.id);
      // Group highlight / dimming: dim nodes outside active group
      const isGroupDimmed = activeGroupFilter !== null && !isNodeInGroup(node, legendGroupMode, activeGroupFilter);
      let isHighlighted = true;
      if (graphMode === 'explore' && hoveredArticle) {
        const activeArticle = allArticles.find(a => a.id === hoveredArticle);
        if (activeArticle) {
          const relatedNodeIds = [
            `source-${activeArticle.source_id}`,
            `entity-${normalizeEntity(activeArticle.actors?.main_actor)}`,
            `entity-${normalizeEntity(activeArticle.actors?.blame_target)}`
          ];
          isHighlighted = relatedNodeIds.includes(node.id);
        }
      }

      const alpha = isHighlighted ? 1 : 0.15;
      // Apply group dimming on top of highlight alpha
      const effectiveAlpha = isGroupDimmed ? Math.min(alpha, 0.08) : alpha;
      const nodeRadius = (node.academicRadius || 10) * (exportSettings?.nodeScale || 1);
      const safeName = node.name || 'Unknown';
      const label = showFrequencies && node.group !== 'source' ? `${safeName} (${node.rawVal || 0})` : safeName;

      ctx.globalAlpha = effectiveAlpha;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.color || '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = isGroupDimmed ? '#cbd5e1' : (activeGroupFilter !== null && !isGroupDimmed ? '#0284c7' : '#334155');
      ctx.lineWidth = activeGroupFilter !== null && !isGroupDimmed ? 2.5 : 1;
      ctx.stroke();

        const shouldDrawLabel = true;
        // Hub nodes (degree ≥ 4) always show their label.
        // Leaf nodes skip if another label is within 30 screen-px to prevent clutter.
        const nodeDegree = node.degree || 1;
        const isHub = nodeDegree >= 4;
        if ((!isFilteredOut || alpha > 0.05) && shouldDrawLabel) {
          const sizeRatio = Math.max(0.75, Math.min(1.8, nodeRadius / 15));
          const baseFontSize = node.group === 'source' ? 12 : (10 * sizeRatio);
          const fontSize = baseFontSize * (exportSettings?.textScale || 1);
          const fontFam = fontFamily === 'serif' ? '"Times New Roman", Times, serif' : 'Inter, -apple-system, sans-serif';
          const fontWeight = isHighlighted ? 'bold' : (sizeRatio > 1.2 ? 'bold' : 'normal');
          ctx.font = `${fontWeight} ${fontSize}px ${fontFam}`;
          
          const words = label.split(' ');
          const lines = [];
          let currentLine = '';
          words.forEach(word => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            if (currentLine && testLine.length > 20) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          if (currentLine) lines.push(currentLine);
          
          const lineHeight = fontSize * 1.25;
          const textX = node.x;
          const startTextY = node.y + nodeRadius + 6 * (exportSettings?.textScale || 1);
          // Label center for collision detection (midpoint of all text lines)
          const labelCenterY = startTextY + (lines.length - 1) * lineHeight / 2;

          // Per-frame label collision check (shared list with edge labels)
          // globalScale is NOT available here; store raw canvas coords.
          // Use a fixed 35-unit canvas distance threshold as proxy.
          const occupied = labelOccupiedRects.current;
          const LABEL_CANVAS_DIST = 35; // approximate canvas units for 30 screen-px at default zoom
          const tooClose = occupied.some(p =>
            Math.hypot(p.x - textX, p.y - labelCenterY) < LABEL_CANVAS_DIST
          );

          // Skip low-degree nodes that would overlap; always draw hubs
          if (!tooClose || isHub) {
            occupied.push({ x: textX, y: labelCenterY });

            ctx.globalAlpha = (isFilteredOut || isGroupDimmed) ? 0.06 : effectiveAlpha;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // White stroke halo to isolate label text from background edge lines
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 8 * (exportSettings?.textScale || 1);
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;

            lines.forEach((line, i) => {
              const y = startTextY + (i * lineHeight);
              ctx.strokeText(line, textX, y);
            });

            ctx.fillStyle = isHighlighted ? '#0f172a' : '#334155';
            lines.forEach((line, i) => {
              const y = startTextY + (i * lineHeight);
              ctx.fillText(line, textX, y);
            });
          }
          
          ctx.shadowBlur = 0;
        }
      ctx.globalAlpha = 1; 
    } catch (err) {
      console.error('Canvas rendering error:', err);
    }
  }, [hoveredArticle, allArticles, filteredArticles, activeNodeIds, exportSettings, showFrequencies, graphMode, fontFamily, activeGroupFilter, legendGroupMode, isNodeInGroup]);

  const linkColor = useCallback(link => {
    let isHighlighted = true;
    if (hoveredArticle) {
      isHighlighted = link.articleIds.has(hoveredArticle);
    }
    const isGroupDimmed = activeGroupFilter !== null && 
      (!isNodeInGroup(link.source, legendGroupMode, activeGroupFilter) && !isNodeInGroup(link.target, legendGroupMode, activeGroupFilter));

    const alpha = isGroupDimmed ? 0.03 : (isHighlighted ? 0.8 : 0.05);
    const hex = link.color.replace('#', '');
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    return `rgba(${r},${g},${b}, ${alpha})`;
  }, [hoveredArticle, activeGroupFilter, legendGroupMode, isNodeInGroup]);

  const linkCanvasObject = useCallback((link, ctx, globalScale) => {
    try {
      if (link.label === 'mentions' || link.label === 'mentions target') return; // Hide source links
      
      let isHighlighted = true;
    if (hoveredArticle) {
      isHighlighted = link.articleIds.has(hoveredArticle);
    }

    const start = link.source;
    const end = link.target;
    
    if (typeof start !== 'object' || typeof end !== 'object') return; // ForceGraph might pass IDs initially

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const scale = exportSettings?.nodeScale || 1;

    // If nodes are too close, skip rendering to avoid clutter
    if (dist < 50 * scale) return;

    const curvature = showCurvedEdges ? (link.dynamicCurvature || 0) : 0;

    // --- Bezier control point (exact formula used by react-force-graph-2d for curved links) ---
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const cX = curvature !== 0 ? midX + dy * curvature : midX;
    const cY = curvature !== 0 ? midY - dx * curvature : midY;

    // --- Compute t-parameter: spread labels along the curve based on fan slot ---
    const fanIndex = link.fanIndex ?? 0;
    const fanTotal = link.fanTotal ?? 1;
    let tParam;
    if (fanTotal <= 1) {
      tParam = 0.5;
    } else {
      // Spread t across [0.36, 0.64] based on fan position
      const tRange = Math.min(0.12 + 0.03 * fanTotal, 0.26);
      tParam = 0.5 + ((fanIndex / (fanTotal - 1)) * 2 - 1) * tRange;
    }
    tParam = Math.max(0.32, Math.min(0.68, tParam));

    // Evaluate point on quadratic Bezier at tParam
    const oneMinusT = 1 - tParam;
    const textPos = {
      x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * tParam * cX + tParam * tParam * end.x,
      y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * tParam * cY + tParam * tParam * end.y,
    };

    // Evaluate exact Bezier curve tangent vector at tParam
    const tangentX = 2 * oneMinusT * (cX - start.x) + 2 * tParam * (end.x - cX);
    const tangentY = 2 * oneMinusT * (cY - start.y) + 2 * tParam * (end.y - cY);

    const relLabel = link.label.split(/[\s/]/)[0]; // Extract 'Opposes' from 'Opposes / Blames'

    const textScale = exportSettings?.textScale || 1.25;

    // --- Strict Edge Label Avoidance ---
    // 1. Skip if edge label lands inside any node circle or near any node text label
    const collidesWithNodeOrLabel = (graphData.nodes || []).some(n => {
      const nr = (n.academicRadius || 10) * scale + 22 * scale;
      // Circle collision check
      if (Math.hypot(n.x - textPos.x, n.y - textPos.y) < nr) return true;

      // Node text label bounding box collision check
      const labelY = n.y + (n.academicRadius || 10) * scale + 10 * textScale;
      const labelHalfW = Math.max(35, (n.name || '').length * 4.8 * textScale);
      const labelHalfH = 14 * textScale;
      if (Math.abs(n.x - textPos.x) < labelHalfW + 18 && Math.abs(labelY - textPos.y) < labelHalfH + 14) {
        return true;
      }
      return false;
    });
    if (collidesWithNodeOrLabel) return;

    // 2. Skip if edge label collides with an already-drawn edge label
    const minCanvasDist = 32 * textScale;
    const occupied = labelOccupiedRects.current;
    if (occupied.some(p => Math.hypot(p.x - textPos.x, p.y - textPos.y) < minCanvasDist)) {
      return; // Skip — too close to another edge label
    }
    occupied.push({ x: textPos.x, y: textPos.y });

    let angle = Math.atan2(tangentY, tangentX);
    // Keep text upright
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      angle += Math.PI;
    }

    ctx.save();
    ctx.translate(textPos.x, textPos.y);
    ctx.rotate(angle);

    const activeFontFam = fontFamily === 'serif' ? '"Times New Roman", Times, serif' : 'Inter, -apple-system, sans-serif';
    ctx.font = `${fontFamily === 'serif' ? 'italic ' : '500 '}${12 * (exportSettings?.textScale || 1)}px ${activeFontFam}`;
    const alpha = isHighlighted ? 0.95 : 0.40;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.globalAlpha = alpha;

    // White text stroke halo to isolate text cleanly from underlying lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5 * (exportSettings?.textScale || 1);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(relLabel, 0, 0);

    ctx.fillStyle = `rgba(15, 23, 42, ${alpha})`;
    ctx.fillText(relLabel, 0, 0);
    
    ctx.restore();
    } catch (err) {}
  }, [hoveredArticle, activeArticleIds, filteredArticles, allArticles, graphMode, showCurvedEdges, fontFamily, exportSettings, labelOccupiedRects]);

  // Find which relations are actually used in the current dataset
  const usedRelations = useMemo(() => {
    const rels = new Set();
    
    filteredArticles.forEach(a => {
        rels.add(normalizeRelation(a.relation_type));
    });

    return rels;
  }, [allArticles, filteredArticles]);

  // Handlers for exploration
  const handleNodeClick = useCallback(node => {
    if (graphMode === 'explore') {
      if (node.group === 'actor') {
        window.open(`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(node.name)}`, '_blank');
      }
    } else if (graphMode === 'manual') {
      // In manual mode, click to unpin
      node.fx = undefined;
      node.fy = undefined;
    }
  }, [graphMode]);

  const handleNodeDragEnd = useCallback(node => {
    if (graphMode === 'manual') {
      // Pin node to its current dragged position
      node.fx = node.x;
      node.fy = node.y;
    }
  }, [graphMode]);

  const handleLinkClick = useCallback(link => {
    if (graphMode !== 'explore') return;
    if (onLinkSelected && link.articleIds) {
      onLinkSelected(link.articleIds);
    }
  }, [graphMode, onLinkSelected]);

  const exportScale = isExporting ? 4 : 1;
  const lastScale = useRef(1);

  useEffect(() => {
    if (fgRef.current && exportScale !== lastScale.current) {
      const currentZoom = fgRef.current.zoom();
      const ratio = exportScale / lastScale.current;
      fgRef.current.zoom(currentZoom * ratio);
      lastScale.current = exportScale;
    }
  }, [exportScale]);

  return (
    <div className="flex-1 h-full relative overflow-hidden" ref={containerRef}>
      <div 
        id="topology-export-container" 
        className="absolute top-0 left-0 w-full h-full bg-white"
        style={{
          width: `${dimensions.width * exportScale}px`,
          height: `${dimensions.height * exportScale}px`,
          transform: `scale(${1 / exportScale})`,
          transformOrigin: 'top left'
        }}
      >
        {/* Modern HTML Legend Overlay — collapsible, responsive, zero overlap */}
        <div 
          className={`absolute top-6 left-6 z-10 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm rounded-xl p-3 max-h-[85vh] overflow-y-auto text-xs select-none transition-all duration-200 ${
            isLegendCollapsed ? 'w-auto' : 'w-[220px]'
          }`}
          style={{ 
            fontFamily: fontFamily === 'serif' ? '"Times New Roman", Times, serif' : 'Inter, -apple-system, sans-serif',
            transform: `scale(${exportScale})`,
            transformOrigin: 'top left'
          }}
        >
          {/* Legend Header with Collapse Toggle */}
          <div className="flex items-center justify-between font-semibold italic text-slate-700 pb-1 mb-1 border-b border-slate-100 gap-3">
            <span>Legend</span>
            {!isExporting && (
              <button 
                onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
                className="px-1.5 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer font-sans not-italic transition-colors shrink-0"
                title={isLegendCollapsed ? "Expand legend" : "Collapse legend"}
              >
                {isLegendCollapsed ? 'Expand ▾' : 'Collapse ▴'}
              </button>
            )}
          </div>

          {!isLegendCollapsed && (
            <>
              {/* Node Types */}
              <div className="space-y-1 my-2">
                {showSourceNodes && (
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-gray-400 border border-slate-700 rounded-sm shrink-0" />
                    <span className="text-slate-800 font-medium">Document Source</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-slate-500 border border-slate-700 rounded-sm shrink-0" />
                  <span className="text-slate-800 font-medium">Actor</span>
                </div>
              </div>

              {/* Edge Types */}
              <div className="border-t border-slate-100 pt-2 space-y-1">
                <div className="text-[11px] font-semibold italic text-slate-600 mb-1">Edge Types:</div>
                {Array.from(usedRelations)
                  .map(name => ({
                    name,
                    color: RELATION_COLORS[name] || RELATION_COLORS.default,
                    displayWord: name === 'default' ? 'Unknown' : name.split(/[\s/]/)[0]
                  }))
                  .filter(item => !isExporting || !hiddenRelations.has(item.name))
                  .map(item => {
                    const isHidden = hiddenRelations.has(item.name);
                    return (
                      <div 
                        key={item.name} 
                        className={`flex items-center justify-between group rounded px-1 py-0.5 transition-colors ${isHidden ? 'opacity-40' : 'hover:bg-slate-50'}`}
                      >
                        <div 
                          className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                          onMouseEnter={() => setHoveredGroup(`rel-${item.name}`)}
                          onMouseLeave={() => setHoveredGroup(null)}
                          onClick={() => toggleRelation(item.name)}
                        >
                          <span 
                            className="w-4 h-[2px] rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className={`truncate text-slate-800 ${isHidden ? 'line-through' : ''}`}>
                            {item.displayWord}
                          </span>
                        </div>
                        {!isExporting && (
                          <div className="relative w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <input 
                              type="color" 
                              value={item.color} 
                              onChange={(e) => onColorChange && onColorChange(item.name, e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title={`Change color for ${item.name}`}
                            />
                            <span className="block w-full h-full rounded-full border border-slate-300 shadow-2xs" style={{ backgroundColor: item.color }} />
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>

              {/* Notes */}
              <div className="border-t border-slate-100 pt-2 mt-2 space-y-1 text-[10.5px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                  <span>Node size is proportional to frequency</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                  <span>Arrows indicate relation direction</span>
                </div>
                {(graphMode === 'explore' || showFrequencies) && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                    <span>Labels (N) indicate appearance count</span>
                  </div>
                )}
              </div>

              {/* Groups Section with View Mode Tabs */}
              <div className="border-t border-slate-100 pt-2 mt-2 space-y-1.5">
                <div className="text-[11px] font-semibold italic text-slate-600 flex items-center justify-between">
                  <span>Group Modes</span>
                  {selectedCommunity !== null && !isExporting && (
                    <button 
                      onClick={() => setSelectedCommunity(null)}
                      className="text-[9.5px] text-indigo-600 hover:underline normal-case font-sans cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Mode Selector Tabs */}
                {!isExporting && (
                  <div className="flex items-center p-0.5 bg-slate-100/90 rounded-md text-[9.5px] font-sans gap-0.5 select-none">
                    <button
                      onClick={() => { setLegendGroupMode('community'); setSelectedCommunity(null); }}
                      className={`flex-1 py-0.5 text-center rounded transition-all cursor-pointer ${
                        legendGroupMode === 'community' ? 'bg-white shadow-2xs font-bold text-slate-800' : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Group by Louvain algorithmic communities"
                    >
                      Louvain
                    </button>
                    <button
                      onClick={() => { setLegendGroupMode('centrality'); setSelectedCommunity(null); }}
                      className={`flex-1 py-0.5 text-center rounded transition-all cursor-pointer ${
                        legendGroupMode === 'centrality' ? 'bg-white shadow-2xs font-bold text-slate-800' : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Group by network centrality tiers (Hubs, Bridges, Periphery)"
                    >
                      Centrality
                    </button>
                    <button
                      onClick={() => { setLegendGroupMode('stance'); setSelectedCommunity(null); }}
                      className={`flex-1 py-0.5 text-center rounded transition-all cursor-pointer ${
                        legendGroupMode === 'stance' ? 'bg-white shadow-2xs font-bold text-slate-800' : 'text-slate-500 hover:text-slate-700'
                      }`}
                      title="Group by actor stance (Blamers, Targets, Neutral)"
                    >
                      Stance
                    </button>
                  </div>
                )}

                {/* Render Items for Current Mode */}
                {(() => {
                  const nodeMap = new Map();
                  (graphData.nodes || []).forEach(n => nodeMap.set(n.id, n));

                  if (legendGroupMode === 'community') {
                    const visibleComms = (graphData.communities || [])
                      .filter(c => c.members && c.members.length >= 2)
                      .slice(0, 8);
                    return (
                      <div className="space-y-0.5 mt-1">
                        {visibleComms.map((comm, i) => {
                          const color = comm.color || COMMUNITY_COLORS[comm.id % COMMUNITY_COLORS.length];
                          const topNodeId = (comm.members || [])
                            .slice()
                            .sort((a, b) => (nodeMap.get(b)?.degree || 0) - (nodeMap.get(a)?.degree || 0))[0];
                          const topName = nodeMap.get(topNodeId)?.name || `Group ${i + 1}`;
                          const isSelected = selectedCommunity === comm.id;
                          const isHovered = hoveredGroup === comm.id;
                          const isActive = isSelected || isHovered;
                          return (
                            <div
                              key={comm.id}
                              onMouseEnter={() => setHoveredGroup(comm.id)}
                              onMouseLeave={() => setHoveredGroup(null)}
                              onClick={() => setSelectedCommunity(isSelected ? null : comm.id)}
                              className={`flex items-center gap-2 px-1.5 py-1 rounded transition-all text-[11px] cursor-pointer ${
                                isActive ? 'bg-indigo-50/80 font-bold text-slate-900 shadow-2xs ring-1 ring-indigo-200' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="w-3.5 h-[3px] rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="text-slate-400 text-[10px] font-mono shrink-0">{`G${i + 1}`}</span>
                              <span className="truncate flex-1">{topName}</span>
                              <span className="text-[9.5px] text-slate-400 font-mono">({comm.members?.length || 0})</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (legendGroupMode === 'centrality') {
                    const centralityItems = [
                      { id: 'hubs', label: 'Hubs (核心节点)', color: '#0284c7', count: (graphData.nodes || []).filter(n => (n.degree || 1) >= 5).length },
                      { id: 'bridges', label: 'Bridges (桥接节点)', color: '#059669', count: (graphData.nodes || []).filter(n => (n.degree || 1) >= 3 && (n.degree || 1) <= 4).length },
                      { id: 'periphery', label: 'Periphery (边缘节点)', color: '#94a3b8', count: (graphData.nodes || []).filter(n => (n.degree || 1) <= 2).length },
                    ];
                    return (
                      <div className="space-y-0.5 mt-1">
                        {centralityItems.map((item) => {
                          const isSelected = selectedCommunity === item.id;
                          const isHovered = hoveredGroup === item.id;
                          const isActive = isSelected || isHovered;
                          return (
                            <div
                              key={item.id}
                              onMouseEnter={() => setHoveredGroup(item.id)}
                              onMouseLeave={() => setHoveredGroup(null)}
                              onClick={() => setSelectedCommunity(isSelected ? null : item.id)}
                              className={`flex items-center gap-2 px-1.5 py-1 rounded transition-all text-[11px] cursor-pointer ${
                                isActive ? 'bg-indigo-50/80 font-bold text-slate-900 shadow-2xs ring-1 ring-indigo-200' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="w-3 h-3 rounded-full shrink-0 border border-slate-300" style={{ backgroundColor: item.color }} />
                              <span className="truncate flex-1 font-medium">{item.label}</span>
                              <span className="text-[9.5px] text-slate-400 font-mono">({item.count})</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (legendGroupMode === 'stance') {
                    const stanceItems = [
                      { id: 'blamers', label: 'Accusers / Blamers (指控方)', color: '#dc2626', count: (graphData.nodes || []).filter(n => (n.outDegree || 0) > (n.inDegree || 0)).length },
                      { id: 'targets', label: 'Targets / Accused (受指控方)', color: '#2563eb', count: (graphData.nodes || []).filter(n => (n.inDegree || 0) > (n.outDegree || 0)).length },
                      { id: 'neutral', label: 'Dual / Neutral (中立/双向)', color: '#7c3aed', count: (graphData.nodes || []).filter(n => (n.inDegree || 0) === (n.outDegree || 0)).length },
                    ];
                    return (
                      <div className="space-y-0.5 mt-1">
                        {stanceItems.map((item) => {
                          const isSelected = selectedCommunity === item.id;
                          const isHovered = hoveredGroup === item.id;
                          const isActive = isSelected || isHovered;
                          return (
                            <div
                              key={item.id}
                              onMouseEnter={() => setHoveredGroup(item.id)}
                              onMouseLeave={() => setHoveredGroup(null)}
                              onClick={() => setSelectedCommunity(isSelected ? null : item.id)}
                              className={`flex items-center gap-2 px-1.5 py-1 rounded transition-all text-[11px] cursor-pointer ${
                                isActive ? 'bg-indigo-50/80 font-bold text-slate-900 shadow-2xs ring-1 ring-indigo-200' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span className="w-3 h-3 rounded-sm shrink-0 border border-slate-300" style={{ backgroundColor: item.color }} />
                              <span className="truncate flex-1 font-medium">{item.label}</span>
                              <span className="text-[9.5px] text-slate-400 font-mono">({item.count})</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </>
          )}
        </div>

          {/* DIAGNOSTIC PANEL FOR DEBUGGING */}
          {showDebug && (
            <div className="absolute top-14 right-4 bg-slate-900/90 text-amber-400 p-3 rounded text-xs font-mono z-50 pointer-events-none whitespace-pre max-w-sm overflow-hidden">
              [DEBUG] Nodes: {graphData.nodes.length} | Links: {graphData.links.length}
              Dim: {Math.round(dimensions.width)}x{Math.round(dimensions.height)}
              Scale: {exportSettings?.nodeScale || 1}
              {graphData.nodes.length > 0 && (
                <>
                  <br/>N0: {graphData.nodes[0].id.substring(0,10)}... 
                  x: {Math.round(graphData.nodes[0].x)} y: {Math.round(graphData.nodes[0].y)}
                  <br/>N1: {graphData.nodes[1]?.id.substring(0,10)}... 
                  x: {Math.round(graphData.nodes[1]?.x)} y: {Math.round(graphData.nodes[1]?.y)}
                </>
              )}
            </div>
          )}
        
        {graphData.nodes.length > 0 ? (
          <ForceGraph2D
            ref={fgRef}
            width={(dimensions.width || 800) * exportScale}
            height={(dimensions.height || 600) * exportScale}
            graphData={graphData}
            nodeLabel="name"
            nodeRelSize={6}
            linkColor={linkColor}
            linkWidth={link => ((hoveredArticle && link.articleIds.has(hoveredArticle)) ? 2 : 0.6) * (exportSettings?.edgeScale || 1) * exportScale}
            linkLineDash={link => link.dashed ? [4, 4] : null}
            linkCurvature={link => showCurvedEdges ? (link.dynamicCurvature !== undefined ? link.dynamicCurvature : 0.15) : 0} // Dynamic curvature so bidirectional arrows don't perfectly overlap and disappear
            linkDirectionalArrowLength={10 * (exportSettings?.arrowScale || 1)} // Clearly visible academic arrows
            linkDirectionalArrowRelPos={1} // Put arrow EXACTLY at target node edge
            nodeRelSize={1} // Forces library to know our exact render radius (because val=r^2)
            linkDirectionalArrowColor={linkColor}
            nodeCanvasObject={nodeCanvasObject}
            linkCanvasObjectMode={() => 'after'}
            linkCanvasObject={linkCanvasObject}
            onRenderFramePre={drawEnclosures}
            onNodeClick={handleNodeClick}
            onNodeDragEnd={handleNodeDragEnd}
            onLinkClick={handleLinkClick}
            onEngineStop={handleEngineStop}
            cooldownTicks={200}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 font-medium">
            No topology data to visualize. Please adjust filters.
          </div>
        )}
      </div>
    </div>
  );
}

