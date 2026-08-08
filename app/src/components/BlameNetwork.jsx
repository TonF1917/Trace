import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceX, forceY, forceCollide } from 'd3-force';
import { detectCommunitiesLouvain, COMMUNITY_COLORS } from '../utils/graphAnalytics';

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

export function BlameNetwork({ allArticles, filteredArticles, sources, hoveredArticle, showSourceNodes, showFrequencies, showGroupEnclosures = true, showCurvedEdges = true, showDebug = false, relationColors = {}, onColorChange, isExporting, exportSettings = { nodeScale: 1, textScale: 1 }, graphMode = 'explore', onLinkSelected }) {
  const RELATION_COLORS = useMemo(() => ({ ...DEFAULT_RELATION_COLORS, ...relationColors }), [relationColors]);
  const containerRef = useRef(null);
  // Reference to the ForceGraph component
  const fgRef = useRef();
  const hasFit = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hiddenRelations, setHiddenRelations] = useState(new Set());

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



    const minFreq = exportSettings.minFreq || 1;
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

    // Calculate dynamic curvature to prevent overlapping edges between same nodes
    const pairMap = new Map();
    finalLinks.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      const pairId = [s, t].sort().join('|');
      if (!pairMap.has(pairId)) pairMap.set(pairId, []);
      pairMap.get(pairId).push(l);
    });
    
    pairMap.forEach(group => {
      if (group.length > 1) {
        group.forEach((l, i) => {
          const sign = i % 2 === 0 ? 1 : -1;
          const step = Math.ceil((i + 1) / 2);
          l.dynamicCurvature = sign * Math.min(0.22 * step, 0.6);
        });
      } else {
        group[0].dynamicCurvature = 0; // Keep single directed links straight and clean
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
  }, [allArticles, filteredArticles, sources, showSourceNodes, hiddenRelations, exportSettings.minFreq]);

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

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.04)`;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;

      const edgeScale = exportSettings?.edgeScale || 1;
      ctx.lineWidth = 1.5 * edgeScale;
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
        const chargeForce = fgRef.current.d3Force('charge');
        if (chargeForce && typeof chargeForce.strength === 'function') {
          chargeForce.strength(-450);
        }

        const linkForce = fgRef.current.d3Force('link');
        if (linkForce && typeof linkForce.distance === 'function') {
          linkForce.distance(130);
        }

        fgRef.current.d3Force('x', forceX(0).strength(0.04));
        fgRef.current.d3Force('y', forceY(0).strength(0.04));
        fgRef.current.d3Force('collide', forceCollide().radius(n => (n.academicRadius || 10) * (exportSettings?.nodeScale || 1) + 25).strength(1.0).iterations(5));
        
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
      const nodeRadius = (node.academicRadius || 10) * (exportSettings?.nodeScale || 1);
      const safeName = node.name || 'Unknown';
      const label = showFrequencies && node.group !== 'source' ? `${safeName} (${node.rawVal || 0})` : safeName;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
      ctx.fillStyle = node.color || '#94a3b8';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      const shouldDrawLabel = true;
      if ((!isFilteredOut || alpha > 0.05) && shouldDrawLabel) {
        const sizeRatio = Math.max(0.75, Math.min(1.8, nodeRadius / 15));
        const baseFontSize = node.group === 'source' ? 12 : (10 * sizeRatio);
        const fontSize = baseFontSize * (exportSettings?.textScale || 1);
        const fontWeight = sizeRatio > 1.2 ? 'bold' : 'normal';
        
        ctx.font = `${fontWeight} ${fontSize}px "Times New Roman", Times, serif`;
        
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
        
        ctx.globalAlpha = isFilteredOut ? 0.1 : alpha;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = `${isHighlighted ? 'bold ' : ''}${fontSize}px Inter, -apple-system, sans-serif`;

        // White stroke halo to completely isolate label text from background edge lines
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5 * (exportSettings?.textScale || 1);
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
        
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1; 
    } catch (err) {
      console.error('Canvas rendering error:', err);
    }
  }, [hoveredArticle, allArticles, filteredArticles, activeNodeIds, exportSettings, showFrequencies, graphMode]);

  const linkColor = useCallback(link => {
    let isHighlighted = true;
    if (hoveredArticle) {
      isHighlighted = link.articleIds.has(hoveredArticle);
    }
    
    const alpha = isHighlighted ? 0.8 : 0.05;
    const hex = link.color.replace('#', '');
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    return `rgba(${r},${g},${b}, ${alpha})`;
  }, [hoveredArticle]);

  const linkCanvasObject = useCallback((link, ctx) => {
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

    // If nodes are too close, hide the text so it doesn't overlap with the Actor circles/labels
    if (dist < 80 * exportSettings.nodeScale) return;

    let textPos = {
      x: start.x + dx / 2,
      y: start.y + dy / 2
    };

    // If the edge is curved, shift the text outward to perfectly sit on the apex of the bezier curve
    if (showCurvedEdges && link.dynamicCurvature) {
      textPos.x += dy * link.dynamicCurvature * 0.5;
      textPos.y += -dx * link.dynamicCurvature * 0.5;
    }

    const relLabel = link.label.split(/[\s/]/)[0]; // Extract 'Opposes' from 'Opposes / Blames'

    let angle = Math.atan2(dy, dx);
    // Keep text upright
    if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
      angle += Math.PI;
    }

    ctx.save();
    ctx.translate(textPos.x, textPos.y);
    ctx.rotate(angle);

    ctx.font = `italic ${9 * exportSettings.textScale}px "Times New Roman", Times, serif`;
    const alpha = isHighlighted ? 0.9 : 0.4;
    
    // Completely opaque white background to "cut" the relationship line
    const textWidth = ctx.measureText(relLabel).width;
    const bckgDimensions = [textWidth, 10 * exportSettings.textScale].map(n => n + 4);
    ctx.fillStyle = '#ffffff';
    // Center it exactly on the axis (0 offset) to cut through the line
    ctx.fillRect(-bckgDimensions[0] / 2, -bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw a white halo to ensure curved lines are fully cut out around the text
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeText(relLabel, 0, 0);

    ctx.fillStyle = `rgba(100, 116, 139, ${alpha})`;
    ctx.fillText(relLabel, 0, 0);
    
    ctx.restore();
    } catch (err) {}
  }, [hoveredArticle, activeArticleIds, filteredArticles, allArticles, graphMode, exportSettings]);

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
        <div 
          className={`absolute top-6 left-6 z-10 ${graphMode === 'figure' ? 'bg-white/80 backdrop-blur-md border border-slate-200 shadow-sm rounded-xl p-3' : 'p-2'}`} 
          style={{ 
            resize: isExporting ? 'none' : 'both',
            overflow: 'hidden',
            width: '230px', 
            minWidth: '100px',
            maxWidth: '50vw',
            background: 'transparent', 
            padding: '8px',
            transform: `scale(${exportScale})`,
            transformOrigin: 'top left'
          }}
        >
          <svg 
            width="100%" 
            height="auto" 
            style={{ display: 'block', fontFamily: '"Times New Roman", Times, serif' }}
            viewBox={`0 0 230 ${100 + Object.keys(RELATION_COLORS).filter(n => !hiddenRelations.has(n)).length * 15}`} 
            preserveAspectRatio="xMinYMin meet"
          >
            {showSourceNodes && (
              <g transform="translate(0, -5)">
                <rect x="10" y="28" width="6" height="6" fill="#9ca3af" stroke="black" strokeWidth="0.5" />
                <text x="24" y="35" fontSize="11" fill="black">Document Source</text>
              </g>
            )}
            
            <g transform={`translate(0, ${showSourceNodes ? 10 : -5})`}>
              <rect x="10" y="28" width="6" height="6" fill="#6b7280" stroke="black" strokeWidth="0.5" />
              <text x="24" y="35" fontSize="11" fill="black">Actor</text>
              
              <text x="10" y="56" fontSize="10" fontStyle="italic" fill="black">Edge Types:</text>
              
              {Array.from(usedRelations)
                .map((name, index) => {
                  const color = RELATION_COLORS[name] || RELATION_COLORS.default;
                  const displayWord = name === 'default' ? 'Unknown' : name.split(/[\s/]/)[0];
                  return { name, color, displayWord };
                })
                .filter(item => !isExporting || !hiddenRelations.has(item.name))
                .map((item, idx) => {
                  const isHidden = hiddenRelations.has(item.name);
                  return (
                    <g key={item.name} transform={`translate(0, ${68 + idx * 15})`} style={{ opacity: isHidden ? 0.4 : 1 }}>
                      <line x1="10" y1="-3" x2="26" y2="-3" stroke={item.color} strokeWidth="1.5" strokeDasharray={isHidden ? "2,2" : "none"} />
                      {!isExporting && (
                        <foreignObject x="6" y="-8" width="24" height="10">
                          <input 
                            type="color" 
                            value={item.color} 
                            onChange={(e) => onColorChange && onColorChange(item.name, e.target.value)}
                            style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', display: 'block' }}
                            title={`Click to change color for ${item.name}`}
                          />
                        </foreignObject>
                      )}
                      <text 
                        x="34" y="0" 
                        fontSize="11" 
                        fill="black"
                        style={{ cursor: 'pointer', textDecoration: isHidden ? 'line-through' : 'none' }}
                        onClick={() => toggleRelation(item.name)}
                      >
                        {item.displayWord}
                      </text>
                    </g>
                  );
                })
              }
            </g>

            {(() => {
              const activeRelations = Array.from(usedRelations).filter(n => !isExporting || !hiddenRelations.has(n));
              const totalRelations = activeRelations.length > 0 ? activeRelations.length : 1;
              const baseY = (showSourceNodes ? 10 : -5) + 68 + totalRelations * 15 + 5;
              return (
                <g transform={`translate(0, ${baseY})`}>
                  <circle cx="14" cy="5" r="1.5" fill="black" />
                  <text x="20" y="8" fontSize="9" fill="black">Node size is proportional to frequency.</text>
                  <circle cx="14" cy="18" r="1.5" fill="black" />
                  <text x="20" y="21" fontSize="9" fill="black">Arrows indicate relation direction.</text>
                  {(graphMode === 'explore' || showFrequencies) && (
                    <>
                      <circle cx="14" cy="31" r="1.5" fill="black" />
                      <text x="20" y="34" fontSize="9" fill="black">Labels (N) indicate appearance count.</text>
                    </>
                  )}
                </g>
              );
            })()}
          </svg>

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
        </div>
        
        {graphData.nodes.length > 0 ? (
          <ForceGraph2D
            ref={fgRef}
            width={(dimensions.width || 800) * exportScale}
            height={(dimensions.height || 600) * exportScale}
            graphData={graphData}
            nodeLabel="name"
            nodeRelSize={6}
            linkColor={linkColor}
            linkWidth={link => ((hoveredArticle && link.articleIds.has(hoveredArticle)) ? 2 : 0.6) * (exportSettings.edgeScale || 1) * exportScale}
            linkLineDash={link => link.dashed ? [4, 4] : null}
            linkCurvature={link => showCurvedEdges ? (link.dynamicCurvature !== undefined ? link.dynamicCurvature : 0.15) : 0} // Dynamic curvature so bidirectional arrows don't perfectly overlap and disappear
            linkDirectionalArrowLength={10 * (exportSettings.arrowScale || 1)} // Clearly visible academic arrows
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

