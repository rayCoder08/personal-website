// Relationship indexing from Aerochronix src/lib/graph.ts (blob 59c93dfb).
export function indexGraph(nodes, edges) {
    const nodeById = new Map(nodes.map((node)=>[
            node.id,
            node
        ]));
    const neighbors = new Map(nodes.map((node)=>[
            node.id,
            new Set()
        ]));
    const edgesByNode = new Map(nodes.map((node)=>[
            node.id,
            []
        ]));
    for (const edge of edges){
        if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
        neighbors.get(edge.source).add(edge.target);
        neighbors.get(edge.target).add(edge.source);
        edgesByNode.get(edge.source).push(edge);
        edgesByNode.get(edge.target).push(edge);
    }
    return {
        nodeById,
        neighbors,
        edgesByNode
    };
}
export function connectedNodeIds(nodeId, neighbors) {
    const visible = new Set([
        nodeId
    ]);
    const incidentIds = nodeId.startsWith('factor:') ? neighbors.get(nodeId) ?? [] : [
        nodeId
    ];
    for (const incidentId of incidentIds){
        visible.add(incidentId);
        for (const factorId of neighbors.get(incidentId) ?? [])visible.add(factorId);
    }
    return visible;
}

// Edge geometry from Aerochronix src/lib/graph-edge-paths.ts (blob 40ed09ae).
export function graphEdgePaths(nodes, edges) {
    const byId = new Map(nodes.map((node)=>[
            node.id,
            node
        ]));
    return edges.map((edge)=>{
        const source = byId.get(edge.source), target = byId.get(edge.target);
        const dx = target.x - source.x, dy = target.y - source.y;
        const length = Math.hypot(dx, dy) || 1;
        const sourceRadius = source.kind === 'incident' ? 34 : 27;
        const targetRadius = target.kind === 'incident' ? 34 : 27;
        const start = {
            x: source.x + dx / length * sourceRadius,
            y: source.y + dy / length * sourceRadius
        };
        const end = {
            x: target.x - dx / length * targetRadius,
            y: target.y - dy / length * targetRadius
        };
        return {
            edge,
            path: `M${start.x},${start.y} L${end.x},${end.y}`
        };
    });
}

// Camera bounds and overview from Aerochronix src/lib/graph-camera.ts (blob 16f77223).
export const GRAPH_ZOOM_LIMITS = [
    0.55,
    4.5
];
export function graphCameraVisibleTarget(count, scale) {
    return Math.max(1, Math.ceil(count * .2 * Math.min(1, (GRAPH_ZOOM_LIMITS[0] / scale) ** 2)));
}
const neighborOrders = new WeakMap();
const panRegions = new WeakMap();
function graphPanRegions(points, width, height, k, anchor) {
    const cached = panRegions.get(points);
    if (cached?.width === width && cached.height === height && cached.k === k && cached.anchor === anchor) return cached;
    const aspect = width / height;
    let ordered = neighborOrders.get(points);
    if (ordered?.aspect !== aspect) {
        ordered = {
            aspect,
            orders: points.map((seed)=>[
                    ...points
                ].sort((a, b)=>Math.max(Math.abs(a.x - seed.x) / width, Math.abs(a.y - seed.y) / height) - Math.max(Math.abs(b.x - seed.x) / width, Math.abs(b.y - seed.y) / height)))
        };
        neighborOrders.set(points, ordered);
    }
    const target = graphCameraVisibleTarget(points.length, k);
    let count = 0;
    const regions = [];
    const groups = anchor ? [
        ordered.orders[points.indexOf(anchor)]
    ] : ordered.orders;
    for (const neighbors of groups){
        let minX = neighbors[0].x, maxX = minX, minY = neighbors[0].y, maxY = minY, included = 0;
        for (const point of neighbors){
            const x1 = Math.min(minX, point.x), x2 = Math.max(maxX, point.x);
            const y1 = Math.min(minY, point.y), y2 = Math.max(maxY, point.y);
            if ((x2 - x1) * k > width || (y2 - y1) * k > height) continue;
            minX = x1;
            maxX = x2;
            minY = y1;
            maxY = y2;
            included++;
            if (included === target) break;
        }
        if (included < count) continue;
        if (included > count) {
            count = included;
            regions.length = 0;
        }
        regions.push({
            minX,
            maxX,
            minY,
            maxY
        });
    }
    const result = {
        width,
        height,
        k,
        anchor,
        count,
        regions
    };
    panRegions.set(points, result);
    return result;
}
export function constrainGraphCamera(camera, extent, points, anchor) {
    const k = Math.max(GRAPH_ZOOM_LIMITS[0], Math.min(GRAPH_ZOOM_LIMITS[1], camera.k));
    if (!points.length) return {
        ...camera,
        k
    };
    const [[left, top], [right, bottom]] = extent;
    const width = right - left, height = bottom - top;
    const marginX = Math.min(width / 4, Math.max(40 * k, width * .1));
    const marginY = Math.min(height / 4, Math.max(40 * k, height * .1));
    const x1 = left + marginX, x2 = right - marginX, y1 = top + marginY, y2 = bottom - marginY;
    const isVisible = (point)=>{
        const x = point.x * k + camera.x, y = point.y * k + camera.y;
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    };
    const visible = points.filter(isVisible).length;
    const anchorVisible = !anchor || isVisible(anchor);
    if (anchorVisible && visible >= graphCameraVisibleTarget(points.length, k)) return {
        ...camera,
        k
    };
    const bounds = graphPanRegions(points, x2 - x1, y2 - y1, k, anchor);
    if (anchorVisible && visible >= bounds.count) return {
        ...camera,
        k
    };
    let best = {
        ...camera,
        k
    }, distance = Infinity;
    for (const region of bounds.regions){
        const x = Math.max(x1 - region.minX * k, Math.min(x2 - region.maxX * k, camera.x));
        const y = Math.max(y1 - region.minY * k, Math.min(y2 - region.maxY * k, camera.y));
        const score = (x - camera.x) ** 2 + (y - camera.y) ** 2;
        if (score < distance) {
            best = {
                x,
                y,
                k
            };
            distance = score;
        }
    }
    return best;
}
export function overviewGraphCamera(extent, points) {
    if (!points.length) return {
        x: 0,
        y: 0,
        k: 1
    };
    const [[left, top], [right, bottom]] = extent;
    const minX = Math.min(...points.map((point)=>point.x)), maxX = Math.max(...points.map((point)=>point.x));
    const minY = Math.min(...points.map((point)=>point.y)), maxY = Math.max(...points.map((point)=>point.y));
    const k = Math.max(GRAPH_ZOOM_LIMITS[0], Math.min(1, (right - left) / Math.max(1, maxX - minX + 140), (bottom - top) / Math.max(1, maxY - minY + 140)));
    return constrainGraphCamera({
        x: (left + right) / 2 - (minX + maxX) / 2 * k,
        y: (top + bottom) / 2 - (minY + maxY) / 2 * k,
        k
    }, extent, points);
}
