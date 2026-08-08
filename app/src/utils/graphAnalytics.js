/**
 * Graph Analytics Utility for Trace
 * Provides Louvain community detection, Brandes betweenness centrality,
 * degree centralities (in/out/total), and overall network statistics.
 */

// Morandi academic palette — muted, dignified, suitable for scholarly publications.
// Each color is visually distinct yet harmonious on a white background.
export const COMMUNITY_COLORS = [
  '#6d8fad', // Steel blue
  '#7a9e87', // Sage green
  '#b89c7a', // Warm taupe
  '#9d849e', // Dusty mauve
  '#7a9ea8', // Soft teal
  '#ad8e6d', // Warm sand
  '#8a8fb8', // Periwinkle
  '#a89d84', // Warm stone
  '#8aada2', // Pale jade
  '#b08a8a', // Dusty rose
  '#8fa88a', // Olive sage
  '#a68aad', // Soft lavender
];

/**
 * Calculates Degree, In-Degree, and Out-Degree centrality for nodes.
 */
export function calculateDegreeCentrality(nodes, links) {
  const degreeMap = new Map();

  // Initialize
  nodes.forEach(node => {
    const id = typeof node === 'object' ? node.id : node;
    degreeMap.set(id, {
      degree: 0,
      inDegree: 0,
      outDegree: 0
    });
  });

  // Count links
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (degreeMap.has(sourceId)) {
      const s = degreeMap.get(sourceId);
      s.outDegree += 1;
      s.degree += 1;
    }

    if (degreeMap.has(targetId)) {
      const t = degreeMap.get(targetId);
      t.inDegree += 1;
      t.degree += 1;
    }
  });

  return degreeMap;
}

/**
 * Calculates Betweenness Centrality using Brandes' Algorithm (O(V * E)).
 */
export function calculateBetweennessCentrality(nodes, links) {
  const nodeIds = nodes.map(n => typeof n === 'object' ? n.id : n);
  const CB = new Map();
  nodeIds.forEach(id => CB.set(id, 0));

  // Build adjacency list
  const adj = new Map();
  nodeIds.forEach(id => adj.set(id, []));

  links.forEach(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (adj.has(s) && adj.has(t)) {
      adj.get(s).push(t);
      adj.get(t).push(s); // Treat as undirected for betweenness balance
    }
  });

  nodeIds.forEach(s => {
    const S = []; // Stack
    const P = new Map(); // Predecessors
    const sigma = new Map(); // Number of shortest paths
    const d = new Map(); // Distance from s

    nodeIds.forEach(v => {
      P.set(v, []);
      sigma.set(v, 0);
      d.set(v, -1);
    });

    sigma.set(s, 1);
    d.set(s, 0);

    const Q = [s]; // Queue

    while (Q.length > 0) {
      const v = Q.shift();
      S.push(v);

      const neighbors = adj.get(v) || [];
      neighbors.forEach(w => {
        // Path discovery
        if (d.get(w) < 0) {
          Q.push(w);
          d.set(w, d.get(v) + 1);
        }

        // Path counting
        if (d.get(w) === d.get(v) + 1) {
          sigma.set(w, sigma.get(w) + sigma.get(v));
          P.get(w).push(v);
        }
      });
    }

    const delta = new Map();
    nodeIds.forEach(v => delta.set(v, 0));

    // Accumulation
    while (S.length > 0) {
      const w = S.pop();
      const predecessors = P.get(w) || [];
      predecessors.forEach(v => {
        const coeff = (sigma.get(v) / (sigma.get(w) || 1)) * (1 + delta.get(w));
        delta.set(v, delta.get(v) + coeff);
      });

      if (w !== s) {
        CB.set(w, CB.get(w) + delta.get(w));
      }
    }
  });

  // Normalize betweenness centrality for undirected graphs: 2 / ((n-1)(n-2))
  const n = nodeIds.length;
  const normFactor = n > 2 ? 2 / ((n - 1) * (n - 2)) : 1;
  const normalizedCB = new Map();
  CB.forEach((val, key) => {
    // For undirected graph each pair counted twice in algorithm
    normalizedCB.set(key, (val / 2) * normFactor);
  });

  return normalizedCB;
}

/**
 * Louvain Community Detection algorithm implementation.
 */
export function detectCommunitiesLouvain(nodes, links) {
  const nodeIds = nodes.map(n => typeof n === 'object' ? n.id : n);
  if (nodeIds.length === 0) return { communityMap: new Map(), communities: [] };

  // Map node -> community id
  const communityMap = new Map();
  nodeIds.forEach((id, idx) => communityMap.set(id, idx));

  // Build weighted adjacency map
  const adj = new Map();
  nodeIds.forEach(id => adj.set(id, new Map()));

  let totalWeight = 0;
  links.forEach(link => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;
    if (s === t) return;

    if (adj.has(s) && adj.has(t)) {
      // communityWeight allows BlameNetwork to downweight antagonistic edges (Opposes → 0)
      const w = Math.max(0, link.communityWeight !== undefined ? link.communityWeight : (link.weight || 1));
      if (w === 0) return; // Skip edges that shouldn't contribute to community cohesion
      adj.get(s).set(t, (adj.get(s).get(t) || 0) + w);
      adj.get(t).set(s, (adj.get(t).get(s) || 0) + w);
      totalWeight += w;
    }
  });

  if (totalWeight === 0) {
    const communities = nodeIds.map((id, i) => ({
      id: i,
      color: COMMUNITY_COLORS[i % COMMUNITY_COLORS.length],
      members: [id]
    }));
    return { communityMap, communities };
  }

  // Calculate degrees (sum of weights)
  const k = new Map();
  nodeIds.forEach(u => {
    let sum = 0;
    adj.get(u).forEach(w => { sum += w; });
    k.set(u, sum);
  });

  const m2 = 2 * totalWeight;

  // Perform community optimization passes
  let improvement = true;
  let maxPasses = 15;

  while (improvement && maxPasses > 0) {
    improvement = false;
    maxPasses--;

    // Group current community totals
    const totMap = new Map(); // Community -> sum of degrees of nodes in community
    nodeIds.forEach(u => {
      const c = communityMap.get(u);
      totMap.set(c, (totMap.get(c) || 0) + k.get(u));
    });

    nodeIds.forEach(u => {
      const currentC = communityMap.get(u);
      const ki = k.get(u);

      // Find neighbor communities
      const neighborComms = new Map();
      adj.get(u).forEach((w, v) => {
        const vc = communityMap.get(v);
        neighborComms.set(vc, (neighborComms.get(vc) || 0) + w);
      });

      // Best community evaluation
      let bestC = currentC;
      let maxDeltaQ = 0;

      // Remove u from current community total for calculation
      totMap.set(currentC, (totMap.get(currentC) || 0) - ki);

      neighborComms.forEach((k_i_in, c) => {
        const tot_c = totMap.get(c) || 0;
        // Modularity delta formula
        const deltaQ = k_i_in - (tot_c * ki) / m2;
        if (deltaQ > maxDeltaQ) {
          maxDeltaQ = deltaQ;
          bestC = c;
        }
      });

      // Restore if not changed, else assign bestC
      totMap.set(bestC, (totMap.get(bestC) || 0) + ki);
      if (bestC !== currentC) {
        communityMap.set(u, bestC);
        improvement = true;
      }
    });
  }

  // Renumber communities 0, 1, 2...
  const uniqueComms = Array.from(new Set(communityMap.values()));
  const remappedMap = new Map();
  uniqueComms.forEach((oldC, newC) => remappedMap.set(oldC, newC));

  const finalCommunityMap = new Map();
  const communityGroupsMap = new Map();

  nodeIds.forEach(u => {
    const rawC = communityMap.get(u);
    const cleanC = remappedMap.get(rawC);
    finalCommunityMap.set(u, cleanC);

    if (!communityGroupsMap.has(cleanC)) {
      communityGroupsMap.set(cleanC, []);
    }
    communityGroupsMap.get(cleanC).push(u);
  });

  const communities = Array.from(communityGroupsMap.entries()).map(([cId, members]) => ({
    id: cId,
    name: `Community ${cId + 1}`,
    color: COMMUNITY_COLORS[cId % COMMUNITY_COLORS.length],
    members
  })).sort((a, b) => b.members.length - a.members.length);

  return { communityMap: finalCommunityMap, communities };
}

/**
 * Calculates global topological network stats.
 */
export function getGraphGlobalMetrics(nodes, links) {
  const numNodes = nodes.length;
  const numLinks = links.length;

  if (numNodes === 0) {
    return {
      numNodes: 0,
      numLinks: 0,
      density: 0,
      avgDegree: 0,
      communityCount: 0,
      communities: [],
      communityMap: new Map(),
      nodeMetrics: [],
      topHubs: [],
      topBridges: [],
      topTargets: []
    };
  }

  const degrees = calculateDegreeCentrality(nodes, links);
  const betweenness = calculateBetweennessCentrality(nodes, links);
  const { communityMap, communities } = detectCommunitiesLouvain(nodes, links);

  const maxPossibleLinks = numNodes > 1 ? (numNodes * (numNodes - 1)) / 2 : 1;
  const density = Number((numLinks / maxPossibleLinks).toFixed(4));
  const avgDegree = Number(((numLinks * 2) / numNodes).toFixed(2));

  // Node metrics table
  const nodeMetrics = nodes.map(n => {
    const id = typeof n === 'object' ? n.id : n;
    const name = typeof n === 'object' ? (n.name || n.id) : n;
    const deg = degrees.get(id) || { degree: 0, inDegree: 0, outDegree: 0 };
    const bet = betweenness.get(id) || 0;
    const commId = communityMap.get(id) || 0;
    const comm = communities.find(c => c.id === commId);

    return {
      id,
      name,
      degree: deg.degree,
      inDegree: deg.inDegree,
      outDegree: deg.outDegree,
      betweenness: Number(bet.toFixed(4)),
      communityId: commId,
      communityColor: comm ? comm.color : COMMUNITY_COLORS[0],
      sourceArticlesCount: n.sources ? n.sources.length : 1
    };
  });

  // Top rankings
  const topHubs = [...nodeMetrics].sort((a, b) => b.degree - a.degree).slice(0, 5);
  const topBridges = [...nodeMetrics].sort((a, b) => b.betweenness - a.betweenness).slice(0, 5);
  const topTargets = [...nodeMetrics].sort((a, b) => b.inDegree - a.inDegree).slice(0, 5);

  return {
    numNodes,
    numLinks,
    density,
    avgDegree,
    communityCount: communities.length,
    communities,
    communityMap,
    nodeMetrics,
    topHubs,
    topBridges,
    topTargets
  };
}
