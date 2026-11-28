import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NexusNode } from '../database/db';
import { extractPlainTextFromContent } from '../editor/blocks';

interface GraphViewProps {
  nodes: NexusNode[];
  onOpenNode: (id: string) => void;
}

type EdgeKind = 'link' | 'hierarchy';
type FilterMode = 'all' | 'links' | 'hierarchy';

interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

interface GraphNodePos {
  id: string;
  x: number;
  y: number;
  degree: number;
}

const WORLD_SIZE = 900;

function extractLinkTargets(rawContent: string): string[] {
  const plain = extractPlainTextFromContent(rawContent);
  const results: string[] = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(plain)) !== null) {
    if (match[1].trim()) {
      results.push(match[1].trim().toLowerCase());
    }
  }
  return Array.from(new Set(results));
}

function extractTagList(rawContent: string): string[] {
  const plain = extractPlainTextFromContent(rawContent);
  return Array.from(new Set(plain.match(/#[a-zA-Z0-9_À-ÿ]+/g) || []));
}

function computeGraphLayout(
  nodes: NexusNode[],
  edges: GraphEdge[]
): Record<string, GraphNodePos> {
  const count = nodes.length;
  const positions: Record<string, GraphNodePos> = {};
  if (count === 0) return positions;

  const degreeMap: Record<string, number> = {};
  for (const n of nodes) degreeMap[n.id] = 0;
  for (const e of edges) {
    degreeMap[e.from] = (degreeMap[e.from] ?? 0) + 1;
    degreeMap[e.to] = (degreeMap[e.to] ?? 0) + 1;
  }

  const center = WORLD_SIZE / 2;
  const radius = Math.min(260, Math.max(90, count * 22));

  nodes.forEach((n, idx) => {
    const angle = (2 * Math.PI * idx) / count;
    positions[n.id] = {
      id: n.id,
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      degree: degreeMap[n.id] ?? 0,
    };
  });

  if (count === 1) return positions;

  const iterations = 75;
  const repulsion = 18000;
  const springLen = 135;
  const springK = 0.045;
  const gravity = 0.018;

  for (let step = 0; step < iterations; step++) {
    const forces: Record<string, { fx: number; fy: number }> = {};
    for (const n of nodes) {
      forces[n.id] = { fx: 0, fy: 0 };
    }

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = positions[nodes[i].id];
        const b = positions[nodes[j].id];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = Math.max(100, dx * dx + dy * dy);
        const dist = Math.sqrt(distSq);
        const f = repulsion / distSq;
        const ux = dx / dist;
        const uy = dy / dist;

        forces[a.id].fx -= ux * f;
        forces[a.id].fy -= uy * f;
        forces[b.id].fx += ux * f;
        forces[b.id].fy += uy * f;
      }
    }

    for (const e of edges) {
      const a = positions[e.from];
      const b = positions[e.to];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (dist - springLen) * springK;
      const ux = dx / dist;
      const uy = dy / dist;

      forces[a.id].fx += ux * f;
      forces[a.id].fy += uy * f;
      forces[b.id].fx -= ux * f;
      forces[b.id].fy -= uy * f;
    }

    for (const n of nodes) {
      const p = positions[n.id];
      const f = forces[n.id];
      f.fx += (center - p.x) * gravity;
      f.fy += (center - p.y) * gravity;

      const stepDx = Math.max(-22, Math.min(22, f.fx * 0.45));
      const stepDy = Math.max(-22, Math.min(22, f.fy * 0.45));

      p.x = Math.max(70, Math.min(WORLD_SIZE - 70, p.x + stepDx));
      p.y = Math.max(70, Math.min(WORLD_SIZE - 70, p.y + stepDy));
    }
  }

  return positions;
}

export default function GraphView({ nodes, onOpenNode }: GraphViewProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [canvasSize, setCanvasSize] = useState({ width: 340, height: 460 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hasCentered, setHasCentered] = useState(false);

  const panRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        dragStartRef.current = { ...panRef.current };
      },
      onPanResponderMove: (_, g) => {
        const next = {
          x: dragStartRef.current.x + g.dx,
          y: dragStartRef.current.y + g.dy,
        };
        panRef.current = next;
        setPan(next);
      },
    })
  ).current;

  const edges = useMemo(() => {
    const titleToId = new Map<string, string>();
    for (const n of nodes) {
      titleToId.set(n.title.trim().toLowerCase(), n.id);
    }

    const list: GraphEdge[] = [];
    const seen = new Set<string>();

    for (const n of nodes) {
      if (filterMode !== 'links' && n.parentId) {
        const existsParent = nodes.some((p) => p.id === n.parentId);
        if (existsParent) {
          const key = `h:${n.parentId}->${n.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            list.push({ from: n.parentId, to: n.id, kind: 'hierarchy' });
          }
        }
      }

      if (filterMode !== 'hierarchy') {
        const targets = extractLinkTargets(n.content);
        for (const t of targets) {
          const targetId = titleToId.get(t);
          if (targetId && targetId !== n.id) {
            const key = `l:${n.id}->${targetId}`;
            if (!seen.has(key)) {
              seen.add(key);
              list.push({ from: n.id, to: targetId, kind: 'link' });
            }
          }
        }
      }
    }

    return list;
  }, [nodes, filterMode]);

  const positions = useMemo(
    () => computeGraphLayout(nodes, edges),
    [nodes, edges]
  );

  const recenter = (
    width = canvasSize.width,
    height = canvasSize.height,
    targetZoom = zoom
  ) => {
    const next = {
      x: width / 2 - (WORLD_SIZE / 2) * targetZoom,
      y: height / 2 - (WORLD_SIZE / 2) * targetZoom,
    };
    panRef.current = next;
    setPan(next);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
    if (!hasCentered) {
      setHasCentered(true);
      recenter(width, height, zoom);
    }
  };

  const changeZoom = (delta: number) => {
    const nextZoom = Math.max(
      0.45,
      Math.min(1.65, Number((zoom + delta).toFixed(2)))
    );
    setZoom(nextZoom);
    recenter(canvasSize.width, canvasSize.height, nextZoom);
  };

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  const neighborIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    set.add(selectedId);
    for (const e of edges) {
      if (e.from === selectedId) set.add(e.to);
      if (e.to === selectedId) set.add(e.from);
    }
    return set;
  }, [edges, selectedId]);

  const selectedStats = useMemo(() => {
    if (!selectedNode) return { linksCount: 0, outgoingLinks: 0, backlinks: 0, tags: [] as string[] };
    const linksCount = edges.filter(
      (e) => e.from === selectedNode.id || e.to === selectedNode.id
    ).length;
    const outgoingLinks = edges.filter(
      (e) => e.kind === 'link' && e.from === selectedNode.id
    ).length;
    const backlinks = edges.filter(
      (e) => e.kind === 'link' && e.to === selectedNode.id
    ).length;
    return {
      linksCount,
      outgoingLinks,
      backlinks,
      tags: extractTagList(selectedNode.content),
    };
  }, [selectedNode, edges]);

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <View style={styles.filterGroup}>
          {(
            [
              { key: 'all', label: 'Tudo' },
              { key: 'links', label: '[[Links]]' },
              { key: 'hierarchy', label: 'Hierarquia' },
            ] as { key: FilterMode; label: string }[]
          ).map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterPill,
                filterMode === f.key && styles.filterPillActive,
              ]}
              onPress={() => setFilterMode(f.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  filterMode === f.key && styles.filterTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.zoomGroup}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => changeZoom(-0.15)}
          >
            <Text style={styles.zoomBtnText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.zoomBtn} onPress={() => recenter()}>
            <Text style={styles.zoomBtnText}>⌖</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => changeZoom(0.15)}
          >
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#38BDF8' }]} />
          <Text style={styles.legendText}>Citações [[Link]]</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#6366F1' }]} />
          <Text style={styles.legendText}>Subtópicos</Text>
        </View>
        <Text style={styles.legendCount}>
          {nodes.length} nós • {edges.length} conexões
        </Text>
      </View>

      <View
        style={styles.canvas}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {nodes.length === 0 ? (
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyText}>
              Crie notas e conecte usando [[Links]] para ver o grafo aqui.
            </Text>
          </View>
        ) : (
          <View
            style={{
              position: 'absolute',
              left: pan.x,
              top: pan.y,
              width: WORLD_SIZE * zoom,
              height: WORLD_SIZE * zoom,
            }}
          >
            {edges.map((edge, idx) => {
              const p1 = positions[edge.from];
              const p2 = positions[edge.to];
              if (!p1 || !p2) return null;

              const x1 = p1.x * zoom;
              const y1 = p1.y * zoom;
              const x2 = p2.x * zoom;
              const y2 = p2.y * zoom;
              const dx = x2 - x1;
              const dy = y2 - y1;
              const length = Math.hypot(dx, dy);
              const angle = Math.atan2(dy, dx);
              const cx = (x1 + x2) / 2;
              const cy = (y1 + y2) / 2;

              const isHighlighted =
                !selectedId ||
                edge.from === selectedId ||
                edge.to === selectedId;

              const color =
                edge.kind === 'link'
                  ? isHighlighted
                    ? 'rgba(56, 189, 248, 0.85)'
                    : 'rgba(56, 189, 248, 0.15)'
                  : isHighlighted
                  ? 'rgba(129, 140, 248, 0.55)'
                  : 'rgba(129, 140, 248, 0.12)';

              const thickness =
                edge.kind === 'link' && selectedId && isHighlighted ? 2.4 : 1.5;

              return (
                <View
                  key={`${edge.from}-${edge.to}-${idx}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: cx - length / 2,
                    top: cy - thickness / 2,
                    width: length,
                    height: thickness,
                    backgroundColor: color,
                    transform: [{ rotate: `${angle}rad` }],
                  }}
                />
              );
            })}

            {nodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;

              const isSelected = selectedId === node.id;
              const isDimmed = selectedId !== null && !neighborIds.has(node.id);
              const baseSize = Math.min(34, 18 + pos.degree * 3);
              const size = baseSize * Math.max(0.78, zoom);

              const nodeBg = isSelected
                ? '#38BDF8'
                : node.isFavorite
                ? '#F59E0B'
                : pos.degree >= 3
                ? '#A855F7'
                : '#6366F1';

              return (
                <TouchableOpacity
                  key={node.id}
                  activeOpacity={0.85}
                  onPress={() =>
                    setSelectedId((prev) => (prev === node.id ? null : node.id))
                  }
                  style={[
                    styles.nodeWrapper,
                    {
                      left: pos.x * zoom - 55,
                      top: pos.y * zoom - size / 2,
                      opacity: isDimmed ? 0.25 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.nodeCircle,
                      {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: nodeBg,
                        borderWidth: isSelected ? 2.5 : 1.5,
                        borderColor: isSelected ? '#FFFFFF' : '#0B0F17',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.nodeLabel,
                      isSelected && styles.nodeLabelSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {node.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {selectedNode && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedTitle} numberOfLines={1}>
                {selectedNode.isFavorite ? '★ ' : ''}
                {selectedNode.title}
              </Text>
              <Text style={styles.selectedMeta} numberOfLines={2}>
                {selectedStats.linksCount} conexões • {selectedStats.outgoingLinks} links criados • {selectedStats.backlinks} referências recebidas
                {selectedStats.tags.length > 0
                  ? ` • ${selectedStats.tags.slice(0, 3).join(' ')}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => onOpenNode(selectedNode.id)}
            >
              <Text style={styles.openBtnText}>Abrir →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  filterPill: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  zoomGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  zoomBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomBtnText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendLine: {
    width: 14,
    height: 2.5,
    borderRadius: 2,
  },
  legendText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  legendCount: {
    marginLeft: 'auto',
    color: '#64748B',
    fontSize: 11,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#070A10',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    marginBottom: 8,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
  },
  nodeWrapper: {
    position: 'absolute',
    width: 110,
    alignItems: 'center',
  },
  nodeCircle: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  nodeLabel: {
    marginTop: 4,
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(11, 15, 23, 0.78)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    textAlign: 'center',
  },
  nodeLabelSelected: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(2, 132, 199, 0.85)',
  },
  selectedCard: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  selectedMeta: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  openBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
