import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { getAppMeta, setAppMeta } from '../database/db';
import {
  EditorBlock,
  EditorTheme,
  createBlock,
  makeId,
  serializeBlocks,
} from '../editor/blocks';
import { persistMediaFile } from '../utils/media';
import {
  COLOR_SWATCHES,
  EMOJI_PRESETS,
  LAYOUT_MODES,
  LINE_STYLES,
  MAP_THEMES,
  MINDMAP_SHELL_HTML,
  MapThemeKey,
  MindMapDoc,
  MindMapNode,
  NODE_SHAPES,
  computeAutoLayout,
  createTemplateDoc,
  getVisibleNodeIds,
} from './mindmapEngine';

interface MindMapViewProps {
  theme: EditorTheme;
  onOpenInBrowser?: (url: string, title: string) => void;
  onExportToSpaces: (title: string, serializedContent: string) => void;
}

const STORAGE_KEY = 'prod_mindmaps_v1';

function NodeAudioPlayer({ uri, theme }: { uri: string; theme: EditorTheme }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const toggle = async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (status.playing) {
        player.pause();
      } else {
        if (
          status.didJustFinish ||
          (status.duration > 0 && status.currentTime >= status.duration - 0.1)
        ) {
          player.seekTo(0);
        }
        player.play();
      }
    } catch (err) {
      Alert.alert('Erro no áudio', String(err));
    }
  };

  return (
    <TouchableOpacity
      onPress={toggle}
      style={[
        styles.audioChip,
        { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
      ]}
    >
      <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 13 }}>
        {status.playing ? '⏸ Pausar Voz' : '▶ Ouvir Nota de Voz'}
      </Text>
    </TouchableOpacity>
  );
}

export default function MindMapView({
  theme,
  onOpenInBrowser,
  onExportToSpaces,
}: MindMapViewProps) {
  const webViewRef = useRef<WebView>(null);

  const [docs, setDocs] = useState<MindMapDoc[]>(() => {
    try {
      const raw = getAppMeta(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MindMapDoc[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [createTemplateDoc('brainstorm', 'obsidian')];
  });

  const [activeDocId, setActiveDocId] = useState<string>(() => docs[0].id);
  const [undoStack, setUndoStack] = useState<MindMapDoc[]>([]);
  const [redoStack, setRedoStack] = useState<MindMapDoc[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => [
    docs[0].nodes[0]?.id ?? '',
  ]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [viewMode, setViewMode] = useState<'map' | 'outline'>('map');
  const [presentationIndex, setPresentationIndex] = useState<number | null>(
    null
  );

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [mapsModalVisible, setMapsModalVisible] = useState(false);
  const [layoutModalVisible, setLayoutModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [lineModalVisible, setLineModalVisible] = useState(false);
  const [editNodeModalVisible, setEditNodeModalVisible] = useState(false);
  const [reattachModalVisible, setReattachModalVisible] = useState(false);
  const [aiImportModalVisible, setAiImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  const [draftNode, setDraftNode] = useState<MindMapNode | null>(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [aiTopicInput, setAiTopicInput] = useState('');
  const [importMarkdownText, setImportMarkdownText] = useState('');

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeDocId) ?? docs[0],
    [docs, activeDocId]
  );

  const primaryNodeId = selectedIds[0] ?? activeDoc.nodes[0]?.id ?? '';
  const selectedNode = useMemo(
    () => activeDoc.nodes.find((n) => n.id === primaryNodeId) ?? null,
    [activeDoc.nodes, primaryNodeId]
  );

  const persistDocs = (nextDocs: MindMapDoc[]) => {
    setDocs(nextDocs);
    setAppMeta(STORAGE_KEY, JSON.stringify(nextDocs));
  };

  const commitActiveDoc = (nextDoc: MindMapDoc, pushHistory = true) => {
    if (pushHistory) {
      setUndoStack((prev) => [...prev.slice(-20), activeDoc]);
      setRedoStack([]);
    }
    const updated = { ...nextDoc, updatedAt: Date.now() };
    persistDocs(docs.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prevDoc = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r.slice(-20), activeDoc]);
    setUndoStack((u) => u.slice(0, -1));
    persistDocs(docs.map((d) => (d.id === prevDoc.id ? prevDoc : d)));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextDoc = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u.slice(-20), activeDoc]);
    setRedoStack((r) => r.slice(0, -1));
    persistDocs(docs.map((d) => (d.id === nextDoc.id ? nextDoc : d)));
  };

  const pushToWebView = () => {
    if (viewMode !== 'map') return;
    const visibleSet = getVisibleNodeIds(activeDoc.nodes);
    const hiddenCounts: Record<string, number> = {};
    for (const n of activeDoc.nodes) {
      if (n.collapsed) {
        const countDesc = (pid: string): number => {
          const ch = activeDoc.nodes.filter((x) => x.parentId === pid);
          return ch.reduce((acc, c) => acc + 1 + countDesc(c.id), 0);
        };
        hiddenCounts[n.id] = countDesc(n.id);
      }
    }

    const visibleNodes = activeDoc.nodes
      .filter((n) => visibleSet.has(n.id))
      .map((n) => ({ ...n, hiddenCount: hiddenCounts[n.id] ?? 0 }));

    const payload = {
      theme: MAP_THEMES[activeDoc.theme],
      lineStyle: activeDoc.lineStyle,
      selectedIds,
      highlightId,
      nodes: visibleNodes,
    };

    webViewRef.current?.injectJavaScript(
      `if (window.renderMap) { window.renderMap(${JSON.stringify(payload)}); } true;`
    );
  };

  useEffect(() => {
    pushToWebView();
  }, [activeDoc, selectedIds, highlightId, viewMode]);

  const handleWebMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as {
        type?: string;
        id?: string;
        x?: number;
        y?: number;
      };
      if (msg.type === 'SELECT_NODE' && msg.id) {
        if (multiSelectMode) {
          setSelectedIds((prev) =>
            prev.includes(msg.id!)
              ? prev.length > 1
                ? prev.filter((x) => x !== msg.id)
                : prev
              : [...prev, msg.id!]
          );
        } else {
          setSelectedIds([msg.id]);
        }
      } else if (
        msg.type === 'MOVE_NODE' &&
        msg.id &&
        typeof msg.x === 'number' &&
        typeof msg.y === 'number'
      ) {
        const nextNodes = activeDoc.nodes.map((n) =>
          n.id === msg.id ? { ...n, x: msg.x!, y: msg.y! } : n
        );
        commitActiveDoc(
          { ...activeDoc, layout: 'manual', nodes: nextNodes },
          true
        );
      }
    } catch {
      // ignore
    }
  };

  const addChildNode = (parentId: string) => {
    const parent = activeDoc.nodes.find((n) => n.id === parentId);
    const mapTheme = MAP_THEMES[activeDoc.theme];
    const siblingsCount = activeDoc.nodes.filter(
      (n) => n.parentId === parentId
    ).length;
    const color =
      parent && parent.parentId !== null
        ? parent.fillColor
        : mapTheme.branchColors[siblingsCount % mapTheme.branchColors.length];

    const newNode: MindMapNode = {
      id: makeId('mm'),
      parentId,
      title: 'Nova Ideia',
      shape: 'rounded',
      fillColor: color,
      textColor: '#FFFFFF',
      x: (parent?.x ?? 0) + 180,
      y: (parent?.y ?? 0) + siblingsCount * 65,
    };

    const uncollapsed = activeDoc.nodes
      .map((n) => (n.id === parentId ? { ...n, collapsed: false } : n))
      .concat(newNode);

    const laidOut = computeAutoLayout(uncollapsed, activeDoc.layout);
    commitActiveDoc({ ...activeDoc, nodes: laidOut }, true);
    setSelectedIds([newNode.id]);
  };

  const addSiblingNode = () => {
    if (!selectedNode) return;
    if (!selectedNode.parentId) {
      addChildNode(selectedNode.id);
      return;
    }
    addChildNode(selectedNode.parentId);
  };

  const deleteSelectedNodes = () => {
    const toRemove = new Set<string>();
    for (const id of selectedIds) {
      const target = activeDoc.nodes.find((n) => n.id === id);
      if (!target || target.parentId === null) continue;
      const queue = [id];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        toRemove.add(cur);
        activeDoc.nodes
          .filter((n) => n.parentId === cur)
          .forEach((c) => queue.push(c.id));
      }
    }
    if (toRemove.size === 0) {
      Alert.alert('Aviso', 'O nó central principal não pode ser excluído.');
      return;
    }
    const remaining = activeDoc.nodes.filter((n) => !toRemove.has(n.id));
    const laidOut = computeAutoLayout(remaining, activeDoc.layout);
    commitActiveDoc({ ...activeDoc, nodes: laidOut }, true);
    setSelectedIds([laidOut[0]?.id ?? '']);
  };

  const duplicateSelectedNode = () => {
    if (!selectedNode || !selectedNode.parentId) return;
    const clone: MindMapNode = {
      ...selectedNode,
      id: makeId('mm'),
      title: `${selectedNode.title} (Cópia)`,
      x: selectedNode.x + 30,
      y: selectedNode.y + 50,
      todos: selectedNode.todos
        ? selectedNode.todos.map((t) => ({ ...t, id: makeId('td') }))
        : undefined,
    };
    const next = computeAutoLayout([...activeDoc.nodes, clone], activeDoc.layout);
    commitActiveDoc({ ...activeDoc, nodes: next }, true);
    setSelectedIds([clone.id]);
  };

  const batchStyleSelected = (patch: Partial<MindMapNode>) => {
    const selSet = new Set(selectedIds);
    const nextNodes = activeDoc.nodes.map((n) =>
      selSet.has(n.id) ? { ...n, ...patch } : n
    );
    commitActiveDoc({ ...activeDoc, nodes: nextNodes }, true);
  };

  const openEditModal = (node: MindMapNode) => {
    setDraftNode({
      ...node,
      todos: node.todos ? node.todos.map((t) => ({ ...t })) : [],
    });
    setNewTodoText('');
    setEditNodeModalVisible(true);
  };

  const pickNodeImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!res.canceled && res.assets.length > 0) {
        const saved = await persistMediaFile(
          res.assets[0].uri,
          res.assets[0].fileName ?? 'mindmap_img.jpg'
        );
        setDraftNode((d) => (d ? { ...d, imageUri: saved } : null));
      }
    } catch (err) {
      Alert.alert('Erro', String(err));
    }
  };

  const toggleRecordNodeAudio = async () => {
    try {
      if (recorderState.isRecording) {
        await audioRecorder.stop();
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        if (audioRecorder.uri) {
          const saved = await persistMediaFile(audioRecorder.uri, 'no_voz.m4a');
          setDraftNode((d) => (d ? { ...d, audioUri: saved } : null));
        }
      } else {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão', 'Autorize o microfone.');
          return;
        }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      }
    } catch (err) {
      Alert.alert('Erro no áudio', String(err));
    }
  };

  const orderedPresentationNodes = useMemo(() => {
    const visible = getVisibleNodeIds(activeDoc.nodes);
    const list: MindMapNode[] = [];
    const visit = (pid: string | null) => {
      activeDoc.nodes
        .filter((n) => n.parentId === pid && visible.has(n.id))
        .forEach((n) => {
          list.push(n);
          visit(n.id);
        });
    };
    visit(null);
    return list;
  }, [activeDoc.nodes]);

  const jumpPresentation = (nextIdx: number) => {
    if (orderedPresentationNodes.length === 0) return;
    const bounded =
      (nextIdx + orderedPresentationNodes.length) %
      orderedPresentationNodes.length;
    setPresentationIndex(bounded);
    const target = orderedPresentationNodes[bounded];
    setSelectedIds([target.id]);
    webViewRef.current?.injectJavaScript(
      `if (window.focusNode) { window.focusNode(${JSON.stringify(target.id)}); } true;`
    );
  };

  const generateSmartMapFromTopic = () => {
    const topic = aiTopicInput.trim();
    if (!topic) return;
    const th = MAP_THEMES[activeDoc.theme];
    const rootId = makeId('mm');
    const c1 = makeId('mm');
    const c2 = makeId('mm');
    const c3 = makeId('mm');
    const c4 = makeId('mm');

    const newNodes: MindMapNode[] = [
      { id: rootId, parentId: null, title: topic, emoji: '🧠', shape: 'ellipse', fillColor: th.rootFill, textColor: '#FFF', bold: true, fontSize: 15, x: 0, y: 0 },
      { id: c1, parentId: rootId, title: 'Fundamentos', emoji: '📚', shape: 'rounded', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: c1, title: `O que é ${topic}`, shape: 'underline', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: c1, title: 'Por que importa', shape: 'underline', fillColor: th.branchColors[0], textColor: '#FFF', x: 0, y: 0 },
      { id: c2, parentId: rootId, title: 'Estratégia & Passos', emoji: '🎯', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: c2, title: 'Passo 1: Planejar', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
      { id: makeId('mm'), parentId: c2, title: 'Passo 2: Executar', shape: 'rounded', fillColor: th.branchColors[1], textColor: '#FFF', x: 0, y: 0 },
      { id: c3, parentId: rootId, title: 'Ferramentas & Recursos', emoji: '🧰', shape: 'rounded', fillColor: th.branchColors[2], textColor: '#FFF', x: 0, y: 0 },
      { id: c4, parentId: rootId, title: 'Desafios & Soluções', emoji: '⚡', shape: 'diamond', fillColor: th.branchColors[3], textColor: '#FFF', x: 0, y: 0 },
    ];

    const newDoc: MindMapDoc = {
      id: makeId('doc'),
      title: topic,
      theme: activeDoc.theme,
      layout: 'radial',
      lineStyle: 'curved',
      nodes: computeAutoLayout(newNodes, 'radial'),
      updatedAt: Date.now(),
    };
    persistDocs([newDoc, ...docs]);
    setActiveDocId(newDoc.id);
    setSelectedIds([rootId]);
    setAiTopicInput('');
    setAiImportModalVisible(false);
    setTimeout(
      () =>
        webViewRef.current?.injectJavaScript(
          'window.resetView && window.resetView(); true;'
        ),
      120
    );
  };

  const importFromIndentedMarkdown = () => {
    const lines = importMarkdownText
      .split('\n')
      .map((l) => l.replace(/\t/g, '  '))
      .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    const th = MAP_THEMES[activeDoc.theme];
    const parsedNodes: MindMapNode[] = [];
    const stack: { indent: number; id: string }[] = [];

    lines.forEach((rawLine, idx) => {
      const indentMatch = rawLine.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      const cleanTitle = rawLine.trim().replace(/^[-*•#]+\s*/, '');

      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      const parentId =
        idx === 0
          ? null
          : stack[stack.length - 1]?.id ?? parsedNodes[0]?.id ?? null;

      const nodeId = makeId('mm');
      const color =
        parentId === null
          ? th.rootFill
          : th.branchColors[idx % th.branchColors.length];

      parsedNodes.push({
        id: nodeId,
        parentId,
        title: cleanTitle || 'Tópico',
        shape: parentId === null ? 'ellipse' : 'rounded',
        fillColor: color,
        textColor: '#FFFFFF',
        bold: parentId === null,
        x: 0,
        y: 0,
      });
      stack.push({ indent, id: nodeId });
    });

    const newDoc: MindMapDoc = {
      id: makeId('doc'),
      title: parsedNodes[0]?.title ?? 'Mapa Importado',
      theme: activeDoc.theme,
      layout: 'balanced',
      lineStyle: 'curved',
      nodes: computeAutoLayout(parsedNodes, 'balanced'),
      updatedAt: Date.now(),
    };
    persistDocs([newDoc, ...docs]);
    setActiveDocId(newDoc.id);
    setSelectedIds([parsedNodes[0].id]);
    setImportMarkdownText('');
    setAiImportModalVisible(false);
  };

  const buildOutlineMarkdown = (): string => {
    const lines: string[] = [];
    const walk = (pid: string | null, depth: number) => {
      activeDoc.nodes
        .filter((n) => n.parentId === pid)
        .forEach((n) => {
          const prefix = depth === 0 ? '# ' : `${'  '.repeat(depth - 1)}- `;
          lines.push(`${prefix}${n.emoji ? `${n.emoji} ` : ''}${n.title}`);
          if (n.notes) lines.push(`${'  '.repeat(depth)}  > ${n.notes}`);
          walk(n.id, depth + 1);
        });
    };
    walk(null, 0);
    return lines.join('\n');
  };

  const handleExportPdf = async () => {
    try {
      const mdLines = buildOutlineMarkdown()
        .split('\n')
        .map(
          (l) =>
            `<div style="margin:4px 0;white-space:pre-wrap;">${l.replace(/</g, '&lt;')}</div>`
        )
        .join('');
      const html = `<html><body style="font-family:sans-serif;padding:28px;"><h1>🧠 ${activeDoc.title}</h1>${mdLines}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (err) {
      Alert.alert('Erro PDF', String(err));
    }
  };

  const handleExportSpaces = () => {
    const blocks: EditorBlock[] = [
      createBlock(
        'callout',
        `Exportado do Mapa Mental (miMind): ${activeDoc.title}`
      ),
    ];
    const walk = (pid: string | null, depth: number) => {
      activeDoc.nodes
        .filter((n) => n.parentId === pid)
        .forEach((n) => {
          const label = `${n.emoji ? `${n.emoji} ` : ''}${n.title}`;
          if (depth === 0) blocks.push(createBlock('h1', label));
          else if (depth === 1) blocks.push(createBlock('h2', label));
          else
            blocks.push(
              createBlock('bullet', label, { indent: Math.min(3, depth - 2) })
            );
          if (n.notes) blocks.push(createBlock('paragraph', n.notes));
          (n.todos ?? []).forEach((t) =>
            blocks.push(createBlock('todo', t.text, { checked: t.done }))
          );
          if (n.url) blocks.push(createBlock('bookmark', n.title, { url: n.url }));
          walk(n.id, depth + 1);
        });
    };
    walk(null, 0);
    blocks.push(createBlock('paragraph', '#mapamental #mimind'));
    onExportToSpaces(activeDoc.title, serializeBlocks(blocks));
    setExportModalVisible(false);
  };

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return activeDoc.nodes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.notes ?? '').toLowerCase().includes(q)
    );
  }, [activeDoc.nodes, searchQuery]);

  const renderOutline = (pid: string | null = null, depth = 0): React.ReactNode => {
    const list = activeDoc.nodes.filter((n) => n.parentId === pid);
    return list.map((n) => {
      const hasChildren = activeDoc.nodes.some((c) => c.parentId === n.id);
      const isSel = selectedIds.includes(n.id);
      return (
        <View key={n.id}>
          <View
            style={[
              styles.outlineRow,
              {
                paddingLeft: 12 + depth * 18,
                backgroundColor: isSel
                  ? theme.isDark
                    ? 'rgba(99, 102, 241, 0.22)'
                    : '#EDE9FE'
                  : 'transparent',
                borderBottomColor: theme.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                const nextNodes = activeDoc.nodes.map((x) =>
                  x.id === n.id ? { ...x, collapsed: !x.collapsed } : x
                );
                commitActiveDoc({ ...activeDoc, nodes: nextNodes }, false);
              }}
              style={{ width: 24 }}
            >
              <Text style={{ color: theme.textDim, fontSize: 14 }}>
                {hasChildren ? (n.collapsed ? '▸' : '▾') : '•'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setSelectedIds([n.id])}
              onLongPress={() => openEditModal(n)}
            >
              <Text
                style={{
                  color: theme.text,
                  fontSize: 14,
                  fontWeight: n.parentId === null ? '800' : '600',
                }}
              >
                {n.emoji ? `${n.emoji} ` : ''}
                {n.title}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => addChildNode(n.id)}
              style={[styles.miniSquare, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.accent, fontWeight: '800' }}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openEditModal(n)}
              style={[styles.miniSquare, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ fontSize: 12 }}>✏️</Text>
            </TouchableOpacity>
          </View>
          {!n.collapsed && hasChildren && renderOutline(n.id, depth + 1)}
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => setMapsModalVisible(true)}
          style={[styles.mapPickerPill, { backgroundColor: theme.surfaceAlt }]}
        >
          <Text
            style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}
            numberOfLines={1}
          >
            🧠 {activeDoc.title} ▾
          </Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={handleUndo}
            disabled={undoStack.length === 0}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.surfaceAlt,
                opacity: undoStack.length ? 1 : 0.4,
              },
            ]}
          >
            <Text style={{ color: theme.text, fontWeight: '700' }}>↶</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleRedo}
            disabled={redoStack.length === 0}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.surfaceAlt,
                opacity: redoStack.length ? 1 : 0.4,
              },
            ]}
          >
            <Text style={{ color: theme.text, fontWeight: '700' }}>↷</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              setViewMode((v) => (v === 'map' ? 'outline' : 'map'))
            }
            style={[
              styles.pillTag,
              {
                backgroundColor:
                  viewMode === 'outline' ? theme.accent : theme.surfaceAlt,
              },
            ]}
          >
            <Text
              style={{
                color: viewMode === 'outline' ? '#FFF' : theme.text,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {viewMode === 'map' ? '☰ Outline' : '🕸 Mapa'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (presentationIndex !== null) {
                setPresentationIndex(null);
              } else {
                setViewMode('map');
                jumpPresentation(0);
              }
            }}
            style={[
              styles.pillTag,
              {
                backgroundColor:
                  presentationIndex !== null ? '#10B981' : theme.surfaceAlt,
              },
            ]}
          >
            <Text
              style={{
                color: presentationIndex !== null ? '#FFF' : theme.text,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {presentationIndex !== null ? '■ Sair' : '▶'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {presentationIndex === null && (
        <View
          style={[
            styles.subBar,
            { backgroundColor: theme.bg, borderBottomColor: theme.border },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, alignItems: 'center' }}
          >
            <TouchableOpacity
              onPress={() => setLayoutModalVisible(true)}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                📐 {LAYOUT_MODES.find((l) => l.key === activeDoc.layout)?.label}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setThemeModalVisible(true)}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                🎨 {MAP_THEMES[activeDoc.theme].label}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLineModalVisible(true)}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                〰 Linha
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMultiSelectMode((m) => !m);
                if (multiSelectMode && selectedIds.length > 1) {
                  setSelectedIds([selectedIds[0]]);
                }
              }}
              style={[
                styles.subChip,
                {
                  backgroundColor: multiSelectMode
                    ? '#0284C7'
                    : theme.surfaceAlt,
                },
              ]}
            >
              <Text
                style={{
                  color: multiSelectMode ? '#FFF' : theme.text,
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                ☑ Multi ({selectedIds.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setSearchVisible((s) => !s);
                setSearchQuery('');
                setHighlightId(null);
              }}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                🔍 Buscar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAiImportModalVisible(true)}
              style={[styles.subChip, { backgroundColor: '#6D28D9' }]}
            >
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                ✨ IA / Importar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExportModalVisible(true)}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700' }}>
                📤 Exportar
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {searchVisible && (
        <View
          style={[
            styles.searchStrip,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Encontrar nó no mapa..."
            placeholderTextColor={theme.textDim}
            autoFocus
          />
          {searchMatches.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {searchMatches.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      setHighlightId(m.id);
                      setSelectedIds([m.id]);
                      webViewRef.current?.injectJavaScript(
                        `if (window.focusNode) { window.focusNode(${JSON.stringify(m.id)}); } true;`
                      );
                    }}
                    style={[styles.subChip, { backgroundColor: theme.accent }]}
                  >
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                      {m.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          <WebView
            ref={webViewRef}
            source={{ html: MINDMAP_SHELL_HTML }}
            style={{ flex: 1 }}
            javaScriptEnabled
            originWhitelist={['*']}
            onLoadEnd={pushToWebView}
            onMessage={handleWebMessage}
          />

          <View style={styles.zoomFloat}>
            <TouchableOpacity
              onPress={() =>
                webViewRef.current?.injectJavaScript('window.zoomBy(1.2); true;')
              }
              style={styles.zoomCircle}
            >
              <Text style={styles.zoomTxt}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                webViewRef.current?.injectJavaScript('window.resetView(); true;')
              }
              style={styles.zoomCircle}
            >
              <Text style={styles.zoomTxt}>⌖</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                webViewRef.current?.injectJavaScript('window.zoomBy(0.82); true;')
              }
              style={styles.zoomCircle}
            >
              <Text style={styles.zoomTxt}>−</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={{ flex: 1, backgroundColor: theme.bg }}>
          {renderOutline(null, 0)}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {presentationIndex !== null ? (
        <View
          style={[
            styles.presentBar,
            { backgroundColor: theme.surface, borderTopColor: theme.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800' }}>
              APRESENTAÇÃO • {presentationIndex + 1} /{' '}
              {orderedPresentationNodes.length}
            </Text>
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
              {selectedNode?.emoji ? `${selectedNode.emoji} ` : ''}
              {selectedNode?.title}
            </Text>
            {selectedNode?.notes ? (
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                {selectedNode.notes}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => jumpPresentation(presentationIndex - 1)}
              style={[styles.presentBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.text, fontWeight: '800' }}>◀</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => jumpPresentation(presentationIndex + 1)}
              style={[styles.presentBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '800' }}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        selectedNode && (
          <View
            style={[
              styles.bottomActionBar,
              { backgroundColor: theme.surface, borderTopColor: theme.border },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, alignItems: 'center' }}
            >
              <TouchableOpacity
                onPress={() => addChildNode(selectedNode.id)}
                style={[styles.actBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                  + Filho
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={addSiblingNode}
                style={[styles.actBtn, { backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                  + Irmão
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openEditModal(selectedNode)}
                style={[styles.actBtn, { backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
                  ✏️ Editar Nó
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const nextNodes = activeDoc.nodes.map((n) =>
                    n.id === selectedNode.id
                      ? { ...n, collapsed: !n.collapsed }
                      : n
                  );
                  const laid = computeAutoLayout(nextNodes, activeDoc.layout);
                  commitActiveDoc({ ...activeDoc, nodes: laid }, false);
                }}
                style={[styles.actBtn, { backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                  {selectedNode.collapsed ? '▸ Expandir' : '▾ Recolher'}
                </Text>
              </TouchableOpacity>
              {selectedNode.parentId !== null && (
                <>
                  <TouchableOpacity
                    onPress={() => setReattachModalVisible(true)}
                    style={[styles.actBtn, { backgroundColor: theme.surfaceAlt }]}
                  >
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                      🔀 Mover
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={duplicateSelectedNode}
                    style={[styles.actBtn, { backgroundColor: theme.surfaceAlt }]}
                  >
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                      ⎘ Duplicar
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={deleteSelectedNodes}
                    style={[styles.actBtn, { backgroundColor: '#450A0A' }]}
                  >
                    <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>
                      🗑
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        )
      )}

      {/* MODAL: Editar Nó Rico */}
      <Modal
        visible={editNodeModalVisible && !!draftNode}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNodeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                maxHeight: '88%',
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ✏️ Editar Nó{' '}
              {selectedIds.length > 1 ? `(${selectedIds.length} selecionados)` : ''}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={draftNode?.title ?? ''}
                onChangeText={(t) =>
                  setDraftNode((d) => (d ? { ...d, title: t } : null))
                }
                placeholder="Texto do nó..."
                placeholderTextColor={theme.textDim}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginBottom: 10 }}
              >
                <TouchableOpacity
                  onPress={() =>
                    setDraftNode((d) => (d ? { ...d, emoji: undefined } : null))
                  }
                  style={[styles.emojiChip, { backgroundColor: theme.surfaceAlt }]}
                >
                  <Text style={{ color: theme.textDim, fontSize: 11 }}>
                    Sem emoji
                  </Text>
                </TouchableOpacity>
                {EMOJI_PRESETS.map((em) => (
                  <TouchableOpacity
                    key={em}
                    onPress={() =>
                      setDraftNode((d) => (d ? { ...d, emoji: em } : null))
                    }
                    style={[
                      styles.emojiChip,
                      {
                        backgroundColor:
                          draftNode?.emoji === em ? theme.accent : theme.surfaceAlt,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 16 }}>{em}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.fieldLbl, { color: theme.textDim }]}>
                FORMATO DO NÓ
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginBottom: 10 }}
              >
                {NODE_SHAPES.map((sh) => {
                  const active = draftNode?.shape === sh.key;
                  return (
                    <TouchableOpacity
                      key={sh.key}
                      onPress={() =>
                        setDraftNode((d) => (d ? { ...d, shape: sh.key } : null))
                      }
                      style={[
                        styles.shapePill,
                        {
                          backgroundColor: active ? theme.accent : theme.surfaceAlt,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#FFF' : theme.text,
                          fontSize: 12,
                          fontWeight: '700',
                        }}
                      >
                        {sh.icon} {sh.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  flexWrap: 'wrap',
                }}
              >
                {COLOR_SWATCHES.map((hex) => (
                  <TouchableOpacity
                    key={hex}
                    onPress={() =>
                      setDraftNode((d) => (d ? { ...d, fillColor: hex } : null))
                    }
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: hex,
                      borderWidth: draftNode?.fillColor === hex ? 2.5 : 0,
                      borderColor: '#FFF',
                    }}
                  />
                ))}
                <TouchableOpacity
                  onPress={() =>
                    setDraftNode((d) => (d ? { ...d, bold: !d.bold } : null))
                  }
                  style={[
                    styles.miniSquare,
                    {
                      backgroundColor: draftNode?.bold
                        ? theme.accent
                        : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '800' }}>B</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setDraftNode((d) => (d ? { ...d, italic: !d.italic } : null))
                  }
                  style={[
                    styles.miniSquare,
                    {
                      backgroundColor: draftNode?.italic
                        ? theme.accent
                        : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text style={{ color: '#FFF', fontStyle: 'italic', fontWeight: '700' }}>
                    I
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={draftNode?.connLabel ?? ''}
                onChangeText={(cl) =>
                  setDraftNode((d) => (d ? { ...d, connLabel: cl } : null))
                }
                placeholder="Rótulo na linha de conexão (opcional)..."
                placeholderTextColor={theme.textDim}
              />

              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      marginBottom: 0,
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: '#38BDF8',
                    },
                  ]}
                  value={draftNode?.url ?? ''}
                  onChangeText={(u) =>
                    setDraftNode((d) => (d ? { ...d, url: u } : null))
                  }
                  placeholder="Link URL (https://...)..."
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                />
                {!!draftNode?.url && (
                  <TouchableOpacity
                    onPress={() => {
                      const raw = draftNode.url!.trim();
                      const url = /^https?:\/\//i.test(raw)
                        ? raw
                        : `https://${raw}`;
                      setEditNodeModalVisible(false);
                      if (onOpenInBrowser) {
                        onOpenInBrowser(url, draftNode.title);
                      } else {
                        Linking.openURL(url);
                      }
                    }}
                    style={[
                      styles.actBtn,
                      { backgroundColor: '#0284C7', justifyContent: 'center' },
                    ]}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>
                      Abrir
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                  onPress={pickNodeImage}
                  style={[
                    styles.actBtn,
                    {
                      flex: 1,
                      backgroundColor: theme.surfaceAlt,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                    {draftNode?.imageUri ? '🖼️ Trocar Foto' : '🖼️ Anexar Foto'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={toggleRecordNodeAudio}
                  style={[
                    styles.actBtn,
                    {
                      flex: 1,
                      backgroundColor: recorderState.isRecording
                        ? '#DC2626'
                        : theme.surfaceAlt,
                      alignItems: 'center',
                    },
                  ]}
                >
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
                    {recorderState.isRecording ? '■ Parar Voz' : '🎙 Gravar Voz'}
                  </Text>
                </TouchableOpacity>
              </View>

              {draftNode?.imageUri && (
                <Image
                  source={{ uri: draftNode.imageUri }}
                  style={{
                    width: '100%',
                    height: 130,
                    borderRadius: 10,
                    marginBottom: 10,
                  }}
                  resizeMode="cover"
                />
              )}

              {draftNode?.audioUri && (
                <NodeAudioPlayer uri={draftNode.audioUri} theme={theme} />
              )}

              <Text style={[styles.fieldLbl, { color: theme.textDim }]}>
                LISTA DE TAREFAS DO NÓ
              </Text>
              {(draftNode?.todos ?? []).map((td, idx) => (
                <View
                  key={td.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setDraftNode((d) =>
                        d
                          ? {
                              ...d,
                              todos: (d.todos ?? []).map((t, i) =>
                                i === idx ? { ...t, done: !t.done } : t
                              ),
                            }
                          : null
                      )
                    }
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        color: td.done ? '#10B981' : theme.textDim,
                      }}
                    >
                      {td.done ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ flex: 1, color: theme.text, fontSize: 13 }}>
                    {td.text}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setDraftNode((d) =>
                        d
                          ? {
                              ...d,
                              todos: (d.todos ?? []).filter((_, i) => i !== idx),
                            }
                          : null
                      )
                    }
                  >
                    <Text style={{ color: '#F87171', fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      marginBottom: 0,
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={newTodoText}
                  onChangeText={setNewTodoText}
                  placeholder="+ Adicionar tarefa ao nó..."
                  placeholderTextColor={theme.textDim}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!newTodoText.trim()) return;
                    setDraftNode((d) =>
                      d
                        ? {
                            ...d,
                            todos: [
                              ...(d.todos ?? []),
                              {
                                id: makeId('td'),
                                text: newTodoText.trim(),
                                done: false,
                              },
                            ],
                          }
                        : null
                    );
                    setNewTodoText('');
                  }}
                  style={[
                    styles.actBtn,
                    { backgroundColor: theme.accent, justifyContent: 'center' },
                  ]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '800' }}>+</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLbl, { color: theme.textDim }]}>
                ANOTAÇÕES DETALHADAS
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                    minHeight: 74,
                    textAlignVertical: 'top',
                  },
                ]}
                value={draftNode?.notes ?? ''}
                onChangeText={(nt) =>
                  setDraftNode((d) => (d ? { ...d, notes: nt } : null))
                }
                multiline
                placeholder="Notas longas sobre este tópico..."
                placeholderTextColor={theme.textDim}
              />
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: 12,
                marginTop: 8,
              }}
            >
              <TouchableOpacity
                onPress={() => setEditNodeModalVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!draftNode) return;
                  if (selectedIds.length > 1) {
                    batchStyleSelected({
                      shape: draftNode.shape,
                      fillColor: draftNode.fillColor,
                      bold: draftNode.bold,
                      italic: draftNode.italic,
                    });
                  } else {
                    const nextNodes = activeDoc.nodes.map((n) =>
                      n.id === draftNode.id ? draftNode : n
                    );
                    commitActiveDoc({ ...activeDoc, nodes: nextNodes }, true);
                  }
                  setEditNodeModalVisible(false);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Meus Mapas & Modelos */}
      <Modal
        visible={mapsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMapsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                maxHeight: '84%',
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              🧠 Meus Mapas Mentais ({docs.length})
            </Text>
            <ScrollView>
              {docs.map((d) => (
                <View
                  key={d.id}
                  style={[
                    styles.mapRow,
                    {
                      backgroundColor:
                        d.id === activeDoc.id ? theme.accent : theme.surfaceAlt,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      setActiveDocId(d.id);
                      setSelectedIds([d.nodes[0]?.id ?? '']);
                      setUndoStack([]);
                      setRedoStack([]);
                      setMapsModalVisible(false);
                      setTimeout(
                        () =>
                          webViewRef.current?.injectJavaScript(
                            'window.resetView && window.resetView(); true;'
                          ),
                        100
                      );
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                      {d.title}
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                      {d.nodes.length} nós • {MAP_THEMES[d.theme].label}
                    </Text>
                  </TouchableOpacity>
                  {docs.length > 1 && (
                    <TouchableOpacity
                      onPress={() => {
                        const filtered = docs.filter((x) => x.id !== d.id);
                        persistDocs(filtered);
                        if (activeDocId === d.id) {
                          setActiveDocId(filtered[0].id);
                        }
                      }}
                    >
                      <Text style={{ color: '#FCA5A5', fontSize: 14 }}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <Text style={[styles.fieldLbl, { color: theme.textDim, marginTop: 12 }]}>
                CRIAR NOVO MAPA COM MODELO:
              </Text>
              {(
                [
                  { k: 'blank', l: '📄 Mapa em Branco' },
                  { k: 'brainstorm', l: '🧠 Brainstorming Radial' },
                  { k: 'study', l: '📚 Plano de Estudos Balanceado' },
                  { k: 'project', l: '🚀 Plano de Projeto (Árvore)' },
                  { k: 'org', l: '👑 Organograma' },
                ] as const
              ).map((tpl) => (
                <TouchableOpacity
                  key={tpl.k}
                  onPress={() => {
                    const newDoc = createTemplateDoc(tpl.k, activeDoc.theme);
                    persistDocs([newDoc, ...docs]);
                    setActiveDocId(newDoc.id);
                    setSelectedIds([newDoc.nodes[0].id]);
                    setMapsModalVisible(false);
                  }}
                  style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>
                    {tpl.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setMapsModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Layout */}
      <Modal
        visible={layoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLayoutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              📐 Esquema de Layout
            </Text>
            {LAYOUT_MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.menuBtn,
                  {
                    backgroundColor:
                      activeDoc.layout === m.key
                        ? theme.accent
                        : theme.surfaceAlt,
                  },
                ]}
                onPress={() => {
                  const laidOut = computeAutoLayout(activeDoc.nodes, m.key);
                  commitActiveDoc(
                    { ...activeDoc, layout: m.key, nodes: laidOut },
                    true
                  );
                  setLayoutModalVisible(false);
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setLayoutModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Temas */}
      <Modal
        visible={themeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                maxHeight: '78%',
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              🎨 Tema do Mapa Mental
            </Text>
            <ScrollView>
              {(Object.keys(MAP_THEMES) as MapThemeKey[]).map((tk) => {
                const info = MAP_THEMES[tk];
                return (
                  <TouchableOpacity
                    key={tk}
                    style={[
                      styles.menuBtn,
                      {
                        backgroundColor: info.canvasBg,
                        borderWidth: 1.5,
                        borderColor:
                          activeDoc.theme === tk ? '#38BDF8' : info.lineColor,
                      },
                    ]}
                    onPress={() => {
                      const nextNodes = activeDoc.nodes.map((n, idx) => ({
                        ...n,
                        fillColor:
                          n.parentId === null
                            ? info.rootFill
                            : info.branchColors[idx % info.branchColors.length],
                      }));
                      commitActiveDoc(
                        { ...activeDoc, theme: tk, nodes: nextNodes },
                        true
                      );
                      setThemeModalVisible(false);
                    }}
                  >
                    <Text
                      style={{
                        color: tk === 'paper' ? '#0F172A' : '#FFFFFF',
                        fontWeight: '800',
                      }}
                    >
                      {info.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setThemeModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Estilo das Linhas */}
      <Modal
        visible={lineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLineModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              〰 Estilo das Conexões
            </Text>
            {LINE_STYLES.map((ls) => (
              <TouchableOpacity
                key={ls.key}
                style={[
                  styles.menuBtn,
                  {
                    backgroundColor:
                      activeDoc.lineStyle === ls.key
                        ? theme.accent
                        : theme.surfaceAlt,
                  },
                ]}
                onPress={() => {
                  commitActiveDoc({ ...activeDoc, lineStyle: ls.key }, true);
                  setLineModalVisible(false);
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>
                  {ls.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setLineModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Re-anexar Nó */}
      <Modal
        visible={reattachModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReattachModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                maxHeight: '75%',
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              🔀 Mover "{selectedNode?.title}" para:
            </Text>
            <ScrollView>
              {activeDoc.nodes
                .filter((n) => n.id !== selectedNode?.id)
                .map((candidate) => (
                  <TouchableOpacity
                    key={candidate.id}
                    style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
                    onPress={() => {
                      if (!selectedNode) return;
                      const nextNodes = activeDoc.nodes.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, parentId: candidate.id }
                          : n
                      );
                      const laid = computeAutoLayout(nextNodes, activeDoc.layout);
                      commitActiveDoc({ ...activeDoc, nodes: laid }, true);
                      setReattachModalVisible(false);
                    }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '700' }}>
                      {candidate.emoji ? `${candidate.emoji} ` : ''}
                      {candidate.title}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setReattachModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Assistente IA & Importar */}
      <Modal
        visible={aiImportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAiImportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                maxHeight: '86%',
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ✨ Assistente IA & Importar Mapa
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.fieldLbl, { color: theme.textDim }]}>
                1. GERAR MAPA INSTANTÂNEO DE UM TÓPICO
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={aiTopicInput}
                onChangeText={setAiTopicInput}
                placeholder="Digite o tema (ex: Produção Musical, Marketing)..."
                placeholderTextColor={theme.textDim}
              />
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
                <TouchableOpacity
                  onPress={generateSmartMapFromTopic}
                  style={[
                    styles.saveBtn,
                    { flex: 1, backgroundColor: theme.accent, alignItems: 'center' },
                  ]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>
                    ⚡ Gerar Agora
                  </Text>
                </TouchableOpacity>
                {onOpenInBrowser && (
                  <TouchableOpacity
                    onPress={() => {
                      const prompt = encodeURIComponent(
                        `Analise o meu mapa mental "${activeDoc.title}" (${buildOutlineMarkdown()}) e sugira novos ramos e ideias que estou esquecendo em formato de lista com recuo.`
                      );
                      setAiImportModalVisible(false);
                      onOpenInBrowser(
                        `https://chatgpt.com/?q=${prompt}`,
                        'ChatGPT • Mapa Mental'
                      );
                    }}
                    style={[
                      styles.saveBtn,
                      { backgroundColor: '#10B981', alignItems: 'center' },
                    ]}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>
                      🤖 ChatGPT
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.fieldLbl, { color: theme.textDim }]}>
                2. IMPORTAR ESTRUTURA / MARKDOWN (COLE TÓPICOS COM RECUO)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                    minHeight: 110,
                    textAlignVertical: 'top',
                  },
                ]}
                value={importMarkdownText}
                onChangeText={setImportMarkdownText}
                multiline
                placeholder={'Tema Central\n  Ramo 1\n    Subtópico A\n  Ramo 2'}
                placeholderTextColor={theme.textDim}
              />
              <TouchableOpacity
                onPress={importFromIndentedMarkdown}
                style={[
                  styles.saveBtn,
                  { backgroundColor: '#0284C7', alignItems: 'center' },
                ]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>
                  📥 Converter Texto em Mapa Mental
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setAiImportModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 10 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Exportar */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              📤 Exportar Mapa Mental
            </Text>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={handleExportSpaces}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                📄 Enviar para Espaços do Nexus
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setExportModalVisible(false);
                handleExportPdf();
              }}
            >
              <Text style={{ color: '#F43F5E', fontWeight: '700' }}>
                📕 Exportar PDF
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                Share.share({
                  title: `${activeDoc.title}.md`,
                  message: buildOutlineMarkdown(),
                });
              }}
            >
              <Text style={{ color: '#38BDF8', fontWeight: '700' }}>
                📝 Exportar Markdown / Tópicos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                Share.share({
                  title: `${activeDoc.title}.json`,
                  message: JSON.stringify(activeDoc, null, 2),
                });
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                💾 Exportar JSON
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExportModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  mapPickerPill: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillTag: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subBar: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  subChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  searchStrip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  zoomFloat: {
    position: 'absolute',
    right: 12,
    bottom: 14,
    gap: 6,
  },
  zoomCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomTxt: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  outlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 10,
    borderBottomWidth: 0.5,
    gap: 6,
  },
  miniSquare: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActionBar: {
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actBtn: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 9,
  },
  presentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  presentBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 18,
  },
  modalBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  fieldLbl: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
  },
  emojiChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  shapePill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  audioChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9 },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  menuBtn: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
});
