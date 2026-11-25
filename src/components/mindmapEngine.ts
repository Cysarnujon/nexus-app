import { makeId } from '../editor/blocks';

export type MapLayoutMode =
  | 'radial'
  | 'tree_right'
  | 'org_down'
  | 'balanced'
  | 'manual';

export type MapThemeKey =
  | 'obsidian'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'neon'
  | 'paper'
  | 'royal'
  | 'minimal';

export type NodeShape =
  | 'rounded'
  | 'ellipse'
  | 'diamond'
  | 'hexagon'
  | 'cloud'
  | 'star'
  | 'heart'
  | 'underline';

export type LineStyle =
  | 'curved'
  | 'tapered'
  | 'straight'
  | 'dashed'
  | 'animated';

export interface NodeTodo {
  id: string;
  text: string;
  done: boolean;
}

export interface MindMapNode {
  id: string;
  parentId: string | null;
  title: string;
  emoji?: string;
  shape: NodeShape;
  fillColor: string;
  textColor: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  x: number;
  y: number;
  collapsed?: boolean;
  notes?: string;
  todos?: NodeTodo[];
  imageUri?: string;
  audioUri?: string;
  url?: string;
  connLabel?: string;
}

export interface MindMapDoc {
  id: string;
  title: string;
  theme: MapThemeKey;
  layout: MapLayoutMode;
  lineStyle: LineStyle;
  nodes: MindMapNode[];
  updatedAt: number;
}

export const MAP_THEMES: Record<
  MapThemeKey,
  {
    label: string;
    canvasBg: string;
    gridColor: string;
    lineColor: string;
    rootFill: string;
    branchColors: string[];
    defaultText: string;
  }
> = {
  obsidian: {
    label: 'Obsidian Dark',
    canvasBg: '#090D16',
    gridColor: '#1E293B',
    lineColor: '#6366F1',
    rootFill: '#4F46E5',
    branchColors: ['#0284C7', '#059669', '#D97706', '#9333EA', '#E11D48'],
    defaultText: '#FFFFFF',
  },
  ocean: {
    label: 'Oceano Profundo',
    canvasBg: '#061A2E',
    gridColor: '#123456',
    lineColor: '#38BDF8',
    rootFill: '#0284C7',
    branchColors: ['#0EA5E9', '#06B6D4', '#14B8A6', '#3B82F6', '#6366F1'],
    defaultText: '#FFFFFF',
  },
  forest: {
    label: 'Floresta Zen',
    canvasBg: '#061F18',
    gridColor: '#123D30',
    lineColor: '#34D399',
    rootFill: '#059669',
    branchColors: ['#10B981', '#14B8A6', '#84CC16', '#0D9488', '#22C55E'],
    defaultText: '#FFFFFF',
  },
  sunset: {
    label: 'Pôr do Sol',
    canvasBg: '#1E1118',
    gridColor: '#3B202E',
    lineColor: '#FB923C',
    rootFill: '#EA580C',
    branchColors: ['#F97316', '#EC4899', '#F59E0B', '#EF4444', '#A855F7'],
    defaultText: '#FFFFFF',
  },
  neon: {
    label: 'Neon Cyber',
    canvasBg: '#05050A',
    gridColor: '#1C1B33',
    lineColor: '#E879F9',
    rootFill: '#A21CAF',
    branchColors: ['#06B6D4', '#EC4899', '#8B5CF6', '#22D3EE', '#F43F5E'],
    defaultText: '#FFFFFF',
  },
  paper: {
    label: 'Papel Claro',
    canvasBg: '#F8FAFC',
    gridColor: '#CBD5E1',
    lineColor: '#4F46E5',
    rootFill: '#4F46E5',
    branchColors: ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626'],
    defaultText: '#FFFFFF',
  },
  royal: {
    label: 'Roxo Real',
    canvasBg: '#160B29',
    gridColor: '#2E1854',
    lineColor: '#C084FC',
    rootFill: '#7C3AED',
    branchColors: ['#9333EA', '#6366F1', '#EC4899', '#A855F7', '#3B82F6'],
    defaultText: '#FFFFFF',
  },
  minimal: {
    label: 'Minimal Mono',
    canvasBg: '#18181B',
    gridColor: '#27272A',
    lineColor: '#A1A1AA',
    rootFill: '#3F3F46',
    branchColors: ['#52525B', '#71717A', '#3F3F46', '#52525B', '#71717A'],
    defaultText: '#FFFFFF',
  },
};

export const NODE_SHAPES: { key: NodeShape; label: string; icon: string }[] = [
  { key: 'rounded', label: 'Retângulo', icon: '▭' },
  { key: 'ellipse', label: 'Elipse', icon: '⬭' },
  { key: 'diamond', label: 'Losango', icon: '◆' },
  { key: 'hexagon', label: 'Hexágono', icon: '⬡' },
  { key: 'cloud', label: 'Nuvem', icon: '☁' },
  { key: 'star', label: 'Estrela', icon: '★' },
  { key: 'heart', label: 'Coração', icon: '♥' },
  { key: 'underline', label: 'Ramo', icon: '▁' },
];

export const LINE_STYLES: { key: LineStyle; label: string }[] = [
  { key: 'curved', label: 'Curva Bézier' },
  { key: 'tapered', label: 'Orgânica Afilada' },
  { key: 'straight', label: 'Linha Reta' },
  { key: 'dashed', label: 'Tracejada' },
  { key: 'animated', label: 'Animada ⚡' },
];

export const LAYOUT_MODES: { key: MapLayoutMode; label: string }[] = [
  { key: 'radial', label: 'Radial 360°' },
  { key: 'balanced', label: 'Balanceado' },
  { key: 'tree_right', label: 'Árvore Direita' },
  { key: 'org_down', label: 'Organograma' },
  { key: 'manual', label: 'Manual Livre' },
];

export const COLOR_SWATCHES = [
  '#4F46E5',
  '#0284C7',
  '#059669',
  '#D97706',
  '#DC2626',
  '#9333EA',
  '#EC4899',
  '#334155',
];

export const EMOJI_PRESETS = ['💡', '🎯', '🚀', '📚', '💰', '🔥', '✅', '🧠', '🎨', '⚡'];

export function getVisibleNodeIds(nodes: MindMapNode[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visible = new Set<string>();
  for (const n of nodes) {
    let ok = true;
    let cur: MindMapNode | undefined = n;
    const guard = new Set<string>();
    while (cur && cur.parentId && !guard.has(cur.id)) {
      guard.add(cur.id);
      const p = byId.get(cur.parentId);
      if (!p || p.collapsed) {
        ok = false;
        break;
      }
      cur = p;
    }
    if (ok) visible.add(n.id);
  }
  return visible;
}

export function computeAutoLayout(
  rawNodes: MindMapNode[],
  layout: MapLayoutMode
): MindMapNode[] {
  if (layout === 'manual' || rawNodes.length === 0) return rawNodes;

  const nodes = rawNodes.map((n) => ({ ...n }));
  const visibleSet = getVisibleNodeIds(nodes);
  const root = nodes.find((n) => n.parentId === null) ?? nodes[0];
  if (!root) return nodes;

  const childrenMap = new Map<string, MindMapNode[]>();
  for (const n of nodes) {
    if (n.parentId && visibleSet.has(n.id)) {
      const list = childrenMap.get(n.parentId) ?? [];
      list.push(n);
      childrenMap.set(n.parentId, list);
    }
  }

  const weightMemo = new Map<string, number>();
  const getWeight = (id: string): number => {
    if (weightMemo.has(id)) return weightMemo.get(id)!;
    const ch = childrenMap.get(id) ?? [];
    if (ch.length === 0) {
      weightMemo.set(id, 1);
      return 1;
    }
    const sum = ch.reduce((acc, c) => acc + getWeight(c.id), 0);
    weightMemo.set(id, sum);
    return sum;
  };

  root.x = 0;
  root.y = 0;

  if (layout === 'radial') {
    const placeRadial = (
      node: MindMapNode,
      startAngle: number,
      endAngle: number,
      depth: number
    ) => {
      const ch = childrenMap.get(node.id) ?? [];
      if (ch.length === 0) return;
      const totalW = ch.reduce((acc, c) => acc + getWeight(c.id), 0);
      const radius = depth === 1 ? 210 : 170 + depth * 125;
      let cursor = startAngle;

      for (const child of ch) {
        const w = getWeight(child.id);
        const span = ((endAngle - startAngle) * w) / Math.max(1, totalW);
        const midAngle = cursor + span / 2;
        child.x = Math.round(radius * Math.cos(midAngle));
        child.y = Math.round(radius * Math.sin(midAngle));
        placeRadial(child, cursor, cursor + span, depth + 1);
        cursor += span;
      }
    };
    placeRadial(root, -Math.PI, Math.PI, 1);
  } else if (layout === 'tree_right') {
    const stepX = 215;
    const stepY = 74;
    const placeRight = (node: MindMapNode, depth: number, topY: number): number => {
      const ch = childrenMap.get(node.id) ?? [];
      if (ch.length === 0) {
        node.x = depth * stepX;
        node.y = topY;
        return stepY;
      }
      let curY = topY;
      const childYs: number[] = [];
      for (const child of ch) {
        const h = placeRight(child, depth + 1, curY);
        childYs.push(child.y);
        curY += h;
      }
      node.x = depth * stepX;
      node.y = Math.round((childYs[0] + childYs[childYs.length - 1]) / 2);
      return curY - topY;
    };
    placeRight(root, 0, -((getWeight(root.id) * stepY) / 2));
  } else if (layout === 'org_down') {
    const stepX = 165;
    const stepY = 125;
    const placeDown = (node: MindMapNode, depth: number, leftX: number): number => {
      const ch = childrenMap.get(node.id) ?? [];
      if (ch.length === 0) {
        node.x = leftX;
        node.y = depth * stepY;
        return stepX;
      }
      let curX = leftX;
      const childXs: number[] = [];
      for (const child of ch) {
        const w = placeDown(child, depth + 1, curX);
        childXs.push(child.x);
        curX += w;
      }
      node.x = Math.round((childXs[0] + childXs[childXs.length - 1]) / 2);
      node.y = depth * stepY;
      return curX - leftX;
    };
    placeDown(root, 0, -((getWeight(root.id) * stepX) / 2));
  } else if (layout === 'balanced') {
    const topChildren = childrenMap.get(root.id) ?? [];
    const rightList: MindMapNode[] = [];
    const leftList: MindMapNode[] = [];
    topChildren.forEach((c, i) => {
      if (i % 2 === 0) rightList.push(c);
      else leftList.push(c);
    });

    const stepX = 210;
    const stepY = 74;

    const placeSide = (
      list: MindMapNode[],
      dir: 1 | -1,
      depth: number,
      startY: number
    ): number => {
      let curY = startY;
      for (const item of list) {
        const ch = childrenMap.get(item.id) ?? [];
        if (ch.length === 0) {
          item.x = dir * depth * stepX;
          item.y = curY;
          curY += stepY;
        } else {
          const beforeY = curY;
          const subH = placeSide(ch, dir, depth + 1, curY);
          item.x = dir * depth * stepX;
          item.y = Math.round((ch[0].y + ch[ch.length - 1].y) / 2);
          curY = beforeY + subH;
        }
      }
      return curY - startY;
    };

    const rightWeight = rightList.reduce((a, c) => a + getWeight(c.id), 0);
    const leftWeight = leftList.reduce((a, c) => a + getWeight(c.id), 0);
    placeSide(rightList, 1, 1, -((rightWeight * stepY) / 2));
    placeSide(leftList, -1, 1, -((leftWeight * stepY) / 2));
  }

  return nodes;
}

export function createTemplateDoc(
  templateId: 'blank' | 'study' | 'project' | 'brainstorm' | 'org',
  themeKey: MapThemeKey = 'obsidian'
): MindMapDoc {
  const th = MAP_THEMES[themeKey];
  const rootId = makeId('mm');
  let nodes: MindMapNode[] = [];
  let layout: MapLayoutMode = 'radial';
  let title = 'Novo Mapa Mental';

  if (templateId === 'study') {
    title = 'Plano de Estudos';
    layout = 'balanced';
    const b1 = makeId('mm');
    const b2 = makeId('mm');
    const b3 = makeId('mm');
    nodes = [
      { id: rootId, parentId: null, title: 'Tema de Estudo', emoji: '📚', shape: 'ellipse', fillColor: th.rootFill, textColor: '#FFF', bold: true, fontSize: 15, x: 0, y: 0 },
      { id: b1, parentId: rootId, title: 'Conceitos-Chave', emoji: '💡', shape: 'rounded', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: b1, title: 'Definição 1', shape: 'underline', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: b2, parentId: rootId, title: 'Prática & Exercícios', emoji: '⚡', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0, todos: [{ id: makeId('t'), text: 'Fazer resumo', done: false }] },
      { id: b3, parentId: rootId, title: 'Revisão', emoji: '🔄', shape: 'hexagon', fillColor: th.branchColors[2], textColor: '#FFF', x: 0, y: 0 },
    ];
  } else if (templateId === 'project') {
    title = 'Plano de Projeto';
    layout = 'tree_right';
    const p1 = makeId('mm');
    const p2 = makeId('mm');
    nodes = [
      { id: rootId, parentId: null, title: 'Meu Projeto', emoji: '🚀', shape: 'rounded', fillColor: th.rootFill, textColor: '#FFF', bold: true, fontSize: 15, x: 0, y: 0 },
      { id: p1, parentId: rootId, title: 'Objetivo & Escopo', emoji: '🎯', shape: 'diamond', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: p2, parentId: rootId, title: 'Entregas', emoji: '📦', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: p2, title: 'Protótipo', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: p2, title: 'Lançamento', shape: 'star', fillColor: th.branchColors[2], textColor: '#FFF', x: 0, y: 0 },
    ];
  } else if (templateId === 'brainstorm') {
    title = 'Brainstorming';
    layout = 'radial';
    nodes = [
      { id: rootId, parentId: null, title: 'Ideia Central', emoji: '🧠', shape: 'cloud', fillColor: th.rootFill, textColor: '#FFF', bold: true, fontSize: 15, x: 0, y: 0 },
      { id: makeId('mm'), parentId: rootId, title: 'Oportunidade', emoji: '✨', shape: 'rounded', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: rootId, title: 'Público', emoji: '👥', shape: 'ellipse', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: rootId, title: 'Diferencial', emoji: '🔥', shape: 'star', fillColor: th.branchColors[2], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: rootId, title: 'Riscos', emoji: '⚠️', shape: 'diamond', fillColor: th.branchColors[3], textColor: '#FFF', x: 0, y: 0 },
    ];
  } else if (templateId === 'org') {
    title = 'Organograma';
    layout = 'org_down';
    const d1 = makeId('mm');
    const d2 = makeId('mm');
    nodes = [
      { id: rootId, parentId: null, title: 'Direção Geral', emoji: '👑', shape: 'rounded', fillColor: th.rootFill, textColor: '#FFF', bold: true, fontSize: 15, x: 0, y: 0 },
      { id: d1, parentId: rootId, title: 'Produto & Criação', shape: 'rounded', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: d2, parentId: rootId, title: 'Marketing & Vendas', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: d1, title: 'Design', shape: 'ellipse', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: d2, title: 'Conteúdo', shape: 'ellipse', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
    ];
  } else {
    title = 'Mapa Mental';
    layout = 'radial';
    nodes = [
      { id: rootId, parentId: null, title: 'Ideia Central', emoji: '💡', shape: 'rounded', fillColor: th.rootFill, textColor: '#FFF', bold: true, fontSize: 15, x: 0, y: 0 },
      { id: makeId('mm'), parentId: rootId, title: 'Tópico 1', shape: 'rounded', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: rootId, title: 'Tópico 2', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
    ];
  }

  return {
    id: makeId('doc'),
    title,
    theme: themeKey,
    layout,
    lineStyle: 'curved',
    nodes: computeAutoLayout(nodes, layout),
    updatedAt: Date.now(),
  };
}

export const MINDMAP_SHELL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; user-select: none; -webkit-user-select: none; }
    html, body { width: 100%; height: 100%; overflow: hidden; touch-action: none; font-family: -apple-system, Roboto, sans-serif; }
    svg { width: 100%; height: 100%; display: block; }
    @keyframes dashFlow { to { stroke-dashoffset: -28; } }
    .anim-line { stroke-dasharray: 9 5; animation: dashFlow 0.9s linear infinite; }
    .node-g { cursor: pointer; }
  </style>
</head>
<body>
  <svg id="svg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <g id="world"><g id="edges"></g><g id="nodes"></g></g>
  </svg>
  <script>
    var svg = document.getElementById('svg');
    var world = document.getElementById('world');
    var edgesLayer = document.getElementById('edges');
    var nodesLayer = document.getElementById('nodes');
    var cam = { x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.92 };
    var curData = null;

    function applyCam() {
      world.setAttribute('transform', 'translate(' + cam.x + ',' + cam.y + ') scale(' + cam.scale + ')');
    }
    function send(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
    window.zoomBy = function(factor) {
      var next = Math.max(0.35, Math.min(2.4, cam.scale * factor));
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      cam.x = cx - (cx - cam.x) * (next / cam.scale);
      cam.y = cy - (cy - cam.y) * (next / cam.scale);
      cam.scale = next;
      applyCam();
    };
    window.focusNode = function(nodeId) {
      if (!curData) return;
      var n = curData.nodes.find(function(x) { return x.id === nodeId; });
      if (!n) return;
      cam.x = window.innerWidth / 2 - n.x * cam.scale;
      cam.y = window.innerHeight / 2 - n.y * cam.scale;
      applyCam();
    };
    window.resetView = function() {
      cam.scale = 0.92;
      cam.x = window.innerWidth / 2;
      cam.y = window.innerHeight / 2;
      applyCam();
    };
    function createSvgEl(tag, attrs) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    }
    function nodeDim(n) {
      var fs = n.fontSize || 13;
      var label = (n.emoji ? n.emoji + ' ' : '') + (n.title || 'Nó');
      var w = Math.max(96, Math.min(220, label.length * (fs * 0.58) + 34));
      var h = n.shape === 'diamond' ? 68 : n.shape === 'star' ? 76 : n.shape === 'heart' ? 74 : n.shape === 'cloud' ? 64 : 46;
      if (n.todos && n.todos.length) h += 10;
      return { w: w, h: h };
    }
    function buildShapeEl(n, w, h) {
      var s = n.shape || 'rounded', hw = w / 2, hh = h / 2;
      if (s === 'ellipse') return createSvgEl('ellipse', { cx: 0, cy: 0, rx: hw, ry: hh });
      if (s === 'diamond') return createSvgEl('polygon', { points: '0,' + (-hh) + ' ' + hw + ',0 0,' + hh + ' ' + (-hw) + ',0' });
      if (s === 'hexagon') {
        var off = Math.min(20, hw * 0.35);
        return createSvgEl('polygon', { points: (-hw + off) + ',' + (-hh) + ' ' + (hw - off) + ',' + (-hh) + ' ' + hw + ',0 ' + (hw - off) + ',' + hh + ' ' + (-hw + off) + ',' + hh + ' ' + (-hw) + ',0' });
      }
      if (s === 'cloud') {
        var d = 'M ' + (-hw * 0.6) + ',' + (hh * 0.6) + ' C ' + (-hw) + ',' + (hh * 0.6) + ' ' + (-hw) + ',' + (-hh * 0.4) + ' ' + (-hw * 0.45) + ',' + (-hh * 0.45) + ' C ' + (-hw * 0.25) + ',' + (-hh) + ' ' + (hw * 0.35) + ',' + (-hh) + ' ' + (hw * 0.5) + ',' + (-hh * 0.4) + ' C ' + (hw) + ',' + (-hh * 0.35) + ' ' + (hw) + ',' + (hh * 0.6) + ' ' + (hw * 0.55) + ',' + (hh * 0.6) + ' Z';
        return createSvgEl('path', { d: d });
      }
      if (s === 'star') {
        var pts = [];
        for (var i = 0; i < 10; i++) {
          var ang = (Math.PI / 5) * i - Math.PI / 2;
          var rx = (i % 2 === 0) ? hw : hw * 0.58;
          var ry = (i % 2 === 0) ? hh : hh * 0.58;
          pts.push(Math.round(rx * Math.cos(ang)) + ',' + Math.round(ry * Math.sin(ang)));
        }
        return createSvgEl('polygon', { points: pts.join(' ') });
      }
      if (s === 'heart') {
        var d2 = 'M 0,' + (hh * 0.85) + ' C ' + (-hw * 1.1) + ',' + (hh * 0.15) + ' ' + (-hw * 0.9) + ',' + (-hh * 0.95) + ' 0,' + (-hh * 0.25) + ' C ' + (hw * 0.9) + ',' + (-hh * 0.95) + ' ' + (hw * 1.1) + ',' + (hh * 0.15) + ' 0,' + (hh * 0.85) + ' Z';
        return createSvgEl('path', { d: d2 });
      }
      if (s === 'underline') return createSvgEl('line', { x1: -hw, y1: hh * 0.65, x2: hw, y2: hh * 0.65, 'stroke-width': 3.5 });
      return createSvgEl('rect', { x: -hw, y: -hh, width: w, height: h, rx: 14, ry: 14 });
    }
    window.renderMap = function(data) {
      curData = data;
      document.body.style.background = data.theme.canvasBg;
      edgesLayer.innerHTML = '';
      nodesLayer.innerHTML = '';
      var nodeMap = {};
      data.nodes.forEach(function(n) { nodeMap[n.id] = n; });
      data.nodes.forEach(function(n) {
        if (!n.parentId || !nodeMap[n.parentId]) return;
        var p = nodeMap[n.parentId], x1 = p.x, y1 = p.y, x2 = n.x, y2 = n.y;
        var dx = x2 - x1, dy = y2 - y1, lineColor = n.fillColor || data.theme.lineColor, style = data.lineStyle || 'curved';
        if (style === 'tapered') {
          var len = Math.max(1, Math.hypot(dx, dy)), nx = -dy / len, ny = dx / len;
          var r1 = p.parentId === null ? 6.5 : 4, r2 = 1.4, cx1 = x1 + dx * 0.45, cy1 = y1;
          var d = 'M ' + (x1 + nx * r1) + ',' + (y1 + ny * r1) + ' Q ' + (cx1 + nx * 2.5) + ',' + (cy1 + ny * 2.5) + ' ' + (x2 + nx * r2) + ',' + (y2 + ny * r2) + ' L ' + (x2 - nx * r2) + ',' + (y2 - ny * r2) + ' Q ' + (cx1 - nx * 2.5) + ',' + (cy1 - ny * 2.5) + ' ' + (x1 - nx * r1) + ',' + (y1 - ny * r1) + ' Z';
          edgesLayer.appendChild(createSvgEl('path', { d: d, fill: lineColor, opacity: '0.78' }));
        } else {
          var cx = (x1 + x2) / 2;
          var pathD = style === 'straight' ? ('M ' + x1 + ',' + y1 + ' L ' + x2 + ',' + y2) : ('M ' + x1 + ',' + y1 + ' C ' + cx + ',' + y1 + ' ' + cx + ',' + y2 + ' ' + x2 + ',' + y2);
          var attrs = { d: pathD, fill: 'none', stroke: lineColor, 'stroke-width': p.parentId === null ? '3' : '2.2', opacity: '0.85', 'stroke-linecap': 'round' };
          if (style === 'dashed') attrs['stroke-dasharray'] = '7 5';
          var pEl = createSvgEl('path', attrs);
          if (style === 'animated') pEl.setAttribute('class', 'anim-line');
          edgesLayer.appendChild(pEl);
        }
        if (n.connLabel) {
          var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          var lbl = createSvgEl('text', { x: mx, y: my - 5, 'text-anchor': 'middle', fill: data.theme.canvasBg === '#F8FAFC' ? '#334155' : '#cbd5e1', 'font-size': '10', 'font-weight': '700' });
          lbl.textContent = n.connLabel;
          edgesLayer.appendChild(lbl);
        }
      });
      data.nodes.forEach(function(n) {
        var dim = nodeDim(n);
        var g = createSvgEl('g', { transform: 'translate(' + n.x + ',' + n.y + ')', 'data-id': n.id, class: 'node-g' });
        var isSelected = data.selectedIds.indexOf(n.id) !== -1, isMatch = data.highlightId === n.id;
        if (isSelected || isMatch) {
          g.appendChild(createSvgEl('rect', { x: -dim.w / 2 - 5, y: -dim.h / 2 - 5, width: dim.w + 10, height: dim.h + 10, rx: 18, ry: 18, fill: 'none', stroke: isMatch ? '#FACC15' : '#38BDF8', 'stroke-width': '2.5', 'stroke-dasharray': isSelected ? '' : '4 3' }));
        }
        var shapeEl = buildShapeEl(n, dim.w, dim.h);
        if (n.shape === 'underline') shapeEl.setAttribute('stroke', n.fillColor || data.theme.lineColor);
        else {
          shapeEl.setAttribute('fill', n.fillColor || data.theme.rootFill);
          shapeEl.setAttribute('stroke', isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.22)');
          shapeEl.setAttribute('stroke-width', isSelected ? '2' : '1.2');
          shapeEl.setAttribute('filter', 'url(#shadow)');
        }
        g.appendChild(shapeEl);
        var titleText = (n.emoji ? n.emoji + ' ' : '') + (n.title || 'Nó');
        if (titleText.length > 26) titleText = titleText.slice(0, 25) + '…';
        var txt = createSvgEl('text', { x: 0, y: n.todos && n.todos.length ? -2 : 4, 'text-anchor': 'middle', fill: n.shape === 'underline' ? (data.theme.canvasBg === '#F8FAFC' ? '#0f172a' : '#f8fafc') : (n.textColor || '#FFFFFF'), 'font-size': String(n.fontSize || 13), 'font-weight': n.bold ? '800' : '600', 'font-style': n.italic ? 'italic' : 'normal' });
        txt.textContent = titleText;
        g.appendChild(txt);
        var badges = [];
        if (n.imageUri) badges.push('🖼️');
        if (n.audioUri) badges.push('🎙');
        if (n.url) badges.push('🔗');
        if (n.notes) badges.push('📝');
        if (n.todos && n.todos.length) badges.push('☑' + n.todos.filter(function(t) { return t.done; }).length + '/' + n.todos.length);
        if (n.hiddenCount > 0) badges.push('+' + n.hiddenCount);
        if (badges.length > 0) {
          var bTxt = createSvgEl('text', { x: 0, y: dim.h / 2 - 6, 'text-anchor': 'middle', fill: '#E2E8F0', 'font-size': '10', 'font-weight': '700' });
          bTxt.textContent = badges.join(' ');
          g.appendChild(bTxt);
        }
        nodesLayer.appendChild(g);
      });
      applyCam();
    };
    var mode = 'none', activeNodeId = null, startTouch = { x: 0, y: 0 }, startCam = { x: 0, y: 0, scale: 1 }, startNodePos = { x: 0, y: 0 }, movedDist = 0, pinchStartDist = 0;
    svg.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        mode = 'pinch';
        pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        startCam = { x: cam.x, y: cam.y, scale: cam.scale };
        return;
      }
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      startTouch = { x: t.clientX, y: t.clientY };
      movedDist = 0;
      var target = e.target;
      while (target && target !== svg) {
        if (target.getAttribute && target.getAttribute('data-id')) { activeNodeId = target.getAttribute('data-id'); break; }
        target = target.parentNode;
      }
      if (activeNodeId && curData) {
        var found = curData.nodes.find(function(n) { return n.id === activeNodeId; });
        if (found) { mode = 'dragNode'; startNodePos = { x: found.x, y: found.y }; return; }
      }
      mode = 'pan'; activeNodeId = null; startCam = { x: cam.x, y: cam.y, scale: cam.scale };
    }, { passive: false });
    svg.addEventListener('touchmove', function(e) {
      e.preventDefault();
      if (mode === 'pinch' && e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinchStartDist > 10) {
          var nextScale = Math.max(0.35, Math.min(2.4, startCam.scale * (d / pinchStartDist)));
          var cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          cam.x = cx - (cx - startCam.x) * (nextScale / startCam.scale);
          cam.y = cy - (cy - startCam.y) * (nextScale / startCam.scale);
          cam.scale = nextScale;
          applyCam();
        }
        return;
      }
      if (e.touches.length !== 1) return;
      var t = e.touches[0], dx = t.clientX - startTouch.x, dy = t.clientY - startTouch.y;
      movedDist = Math.hypot(dx, dy);
      if (mode === 'pan') { cam.x = startCam.x + dx; cam.y = startCam.y + dy; applyCam(); }
      else if (mode === 'dragNode' && activeNodeId && movedDist > 5) {
        var nd = curData.nodes.find(function(n) { return n.id === activeNodeId; });
        if (nd) { nd.x = Math.round(startNodePos.x + dx / cam.scale); nd.y = Math.round(startNodePos.y + dy / cam.scale); window.renderMap(curData); }
      }
    }, { passive: false });
    svg.addEventListener('touchend', function() {
      if (mode === 'dragNode' && activeNodeId) {
        if (movedDist <= 7) send({ type: 'SELECT_NODE', id: activeNodeId });
        else {
          var nd = curData.nodes.find(function(n) { return n.id === activeNodeId; });
          if (nd) send({ type: 'MOVE_NODE', id: activeNodeId, x: nd.x, y: nd.y });
        }
      }
      mode = 'none'; activeNodeId = null;
    });
  </script>
</body>
</html>`;
