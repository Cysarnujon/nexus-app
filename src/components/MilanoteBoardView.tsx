import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  LayoutChangeEvent,
  Linking,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { getAppMeta, setAppMeta } from '../database/db';
import {
  EditorBlock,
  EditorTheme,
  createBlock,
  makeId,
  serializeBlocks,
} from '../editor/blocks';
import {
  formatFileSize,
  persistMediaFile,
  shareLocalFile,
} from '../utils/media';

export type BoardBgStyle = 'dots' | 'cork' | 'blueprint' | 'dark' | 'light';

export type MilanoteCardType =
  | 'note'
  | 'todo'
  | 'image'
  | 'sketch'
  | 'link'
  | 'column'
  | 'subboard'
  | 'swatch'
  | 'file'
  | 'comment';

export type CardColorKey =
  | 'default'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'purple'
  | 'pink'
  | 'orange';

export interface MilanoteTodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MilanoteCard {
  id: string;
  boardId: string;
  type: MilanoteCardType;
  x: number;
  y: number;
  width: number;
  title: string;
  text: string;
  color: CardColorKey;
  todos?: MilanoteTodoItem[];
  columnItems?: { id: string; text: string }[];
  isCollapsed?: boolean;
  mediaUri?: string;
  mediaName?: string;
  mediaSize?: number;
  url?: string;
  swatchHex?: string;
  subBoardId?: string;
  reactions?: string[];
  commentText?: string;
}

export interface MilanoteConnection {
  id: string;
  boardId: string;
  fromId: string;
  toId: string;
  label: string;
  color: string;
}

export interface MilanoteBoard {
  id: string;
  parentId: string | null;
  title: string;
  bgStyle: BoardBgStyle;
}

interface MilanoteState {
  boards: MilanoteBoard[];
  cards: MilanoteCard[];
  connections: MilanoteConnection[];
}

interface MilanoteBoardViewProps {
  theme: EditorTheme;
  onOpenInBrowser?: (url: string, title: string) => void;
  onExportToSpaces: (title: string, serializedContent: string) => void;
}

const STORAGE_KEY = 'prod_milanote_v1';
const WORLD_SIZE = 1600;

const CARD_COLORS: Record<
  CardColorKey,
  { label: string; bgDark: string; bgLight: string; border: string }
> = {
  default: { label: 'Padrão', bgDark: '#1E293B', bgLight: '#FFFFFF', border: '#475569' },
  yellow: { label: 'Amarelo', bgDark: '#422006', bgLight: '#FEF9C3', border: '#EAB308' },
  blue: { label: 'Azul', bgDark: '#0C4A6E', bgLight: '#E0F2FE', border: '#0EA5E9' },
  green: { label: 'Verde', bgDark: '#064E3B', bgLight: '#DCFCE7', border: '#10B981' },
  purple: { label: 'Roxo', bgDark: '#3B0764', bgLight: '#F3E8FF', border: '#A855F7' },
  pink: { label: 'Rosa', bgDark: '#500724', bgLight: '#FCE7F3', border: '#EC4899' },
  orange: { label: 'Laranja', bgDark: '#431407', bgLight: '#FFEDD5', border: '#F97316' },
};

const SWATCH_PRESETS = [
  '#6366F1',
  '#38BDF8',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#EF4444',
  '#A855F7',
  '#0F172A',
];

const BG_OPTIONS: { key: BoardBgStyle; label: string; bg: string }[] = [
  { key: 'dots', label: 'Pontilhado (Milanote)', bg: '#131722' },
  { key: 'cork', label: 'Cortiça Quente', bg: '#2B2118' },
  { key: 'blueprint', label: 'Blueprint Azul', bg: '#0B1D3A' },
  { key: 'dark', label: 'Liso Escuro', bg: '#090D16' },
  { key: 'light', label: 'Liso Claro', bg: '#F1F5F9' },
];

const SKETCH_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f172a; font-family: sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .bar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: #1e293b; flex-wrap: wrap; }
    .dot { width: 24px; height: 24px; border-radius: 12px; border: 2px solid #fff; }
    .btn { background: #334155; color: #fff; border: none; padding: 6px 10px; border-radius: 8px; font-weight: bold; font-size: 12px; }
    .save { background: #6366f1; margin-left: auto; }
    canvas { flex: 1; background: #ffffff; touch-action: none; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="bar">
    <button class="dot" style="background:#0f172a" onclick="setColor('#0f172a')"></button>
    <button class="dot" style="background:#ef4444" onclick="setColor('#ef4444')"></button>
    <button class="dot" style="background:#3b82f6" onclick="setColor('#3b82f6')"></button>
    <button class="dot" style="background:#10b981" onclick="setColor('#10b981')"></button>
    <button class="dot" style="background:#a855f7" onclick="setColor('#a855f7')"></button>
    <button class="btn" onclick="clearPad()">Limpar</button>
    <button class="btn save" onclick="savePad()">Salvar</button>
  </div>
  <canvas id="pad"></canvas>
  <script>
    var canvas = document.getElementById('pad');
    var ctx = canvas.getContext('2d');
    var color = '#0f172a';
    var drawing = false;
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 48;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    resize();
    function setColor(c) { color = c; }
    function clearPad() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    function getPos(e) {
      var rect = canvas.getBoundingClientRect();
      var t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      drawing = true;
      var p = getPos(e);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('touchmove', function(e) {
      if (!drawing) return;
      e.preventDefault();
      var p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }, { passive: false });
    canvas.addEventListener('touchend', function() { drawing = false; });
    function savePad() {
      var dataUrl = canvas.toDataURL('image/png');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SKETCH_SAVE', dataUrl: dataUrl }));
    }
  </script>
</body>
</html>`;

function createStarterMilanoteState(): MilanoteState {
  const rootId = 'board-root';
  const subId = 'board-sub-insp';
  const c1 = 'crd-1';
  const c2 = 'crd-2';
  const c3 = 'crd-3';
  const c4 = 'crd-4';

  return {
    boards: [
      { id: rootId, parentId: null, title: 'Meu Quadro de Visão', bgStyle: 'dots' },
      { id: subId, parentId: rootId, title: 'Inspirações & Sonhos', bgStyle: 'cork' },
    ],
    cards: [
      {
        id: c1,
        boardId: rootId,
        type: 'note',
        x: 680,
        y: 660,
        width: 195,
        title: '🎯 Visão Principal',
        text: 'Arraste qualquer cartão pela barra ⋮⋮ no topo!\n\nToque em + abaixo para adicionar notas, fotos, desenhos, colunas e sub-quadros.',
        color: 'yellow',
        reactions: ['🔥', '💡'],
      },
      {
        id: c2,
        boardId: rootId,
        type: 'todo',
        x: 905,
        y: 660,
        width: 195,
        title: 'Metas do Trimestre',
        text: '',
        color: 'blue',
        todos: [
          { id: 'td-1', text: 'Organizar rotina diária', done: true },
          { id: 'td-2', text: 'Concluir curso principal', done: false },
          { id: 'td-3', text: 'Lançar novo projeto', done: false },
        ],
      },
      {
        id: c3,
        boardId: rootId,
        type: 'subboard',
        x: 680,
        y: 865,
        width: 185,
        title: 'Inspirações & Sonhos',
        text: 'Toque para abrir o sub-quadro',
        color: 'purple',
        subBoardId: subId,
      },
      {
        id: c4,
        boardId: rootId,
        type: 'swatch',
        x: 905,
        y: 865,
        width: 170,
        title: 'Cor Tema',
        text: 'Índigo Criativo',
        color: 'default',
        swatchHex: '#6366F1',
      },
      {
        id: 'crd-sub-1',
        boardId: subId,
        type: 'column',
        x: 700,
        y: 680,
        width: 215,
        title: '📌 Pilares da Visão',
        text: '',
        color: 'default',
        columnItems: [
          { id: 'ci-1', text: 'Saúde & Energia' },
          { id: 'ci-2', text: 'Liberdade Financeira' },
          { id: 'ci-3', text: 'Projetos Criativos' },
        ],
      },
    ],
    connections: [
      {
        id: 'con-1',
        boardId: rootId,
        fromId: c1,
        toId: c2,
        label: 'Ações',
        color: '#38BDF8',
      },
    ],
  };
}

interface DraggableCardProps {
  card: MilanoteCard;
  zoom: number;
  isLightBg: boolean;
  isConnectSource: boolean;
  isConnectMode: boolean;
  children: React.ReactNode;
  onPressCardConnect: () => void;
  onMoveEnd: (id: string, x: number, y: number) => void;
  onOpenOptions: () => void;
  onLayoutCard: (id: string, w: number, h: number) => void;
}

function DraggableCard({
  card,
  zoom,
  isLightBg,
  isConnectSource,
  isConnectMode,
  children,
  onPressCardConnect,
  onMoveEnd,
  onOpenOptions,
  onLayoutCard,
}: DraggableCardProps) {
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const startRef = useRef({ x: card.x, y: card.y });
  const zoomRef = useRef(zoom);
  const onMoveEndRef = useRef(onMoveEnd);

  zoomRef.current = zoom;
  onMoveEndRef.current = onMoveEnd;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = { x: card.x, y: card.y };
        setDragPos({ x: card.x, y: card.y });
      },
      onPanResponderMove: (_, g) => {
        const z = Math.max(0.4, zoomRef.current);
        const nx = Math.max(
          20,
          Math.min(WORLD_SIZE - 180, startRef.current.x + g.dx / z)
        );
        const ny = Math.max(
          20,
          Math.min(WORLD_SIZE - 120, startRef.current.y + g.dy / z)
        );
        setDragPos({ x: nx, y: ny });
      },
      onPanResponderRelease: (_, g) => {
        const z = Math.max(0.4, zoomRef.current);
        const fx = Math.max(
          20,
          Math.min(WORLD_SIZE - 180, startRef.current.x + g.dx / z)
        );
        const fy = Math.max(
          20,
          Math.min(WORLD_SIZE - 120, startRef.current.y + g.dy / z)
        );
        setDragPos(null);
        onMoveEndRef.current(card.id, Math.round(fx), Math.round(fy));
      },
    })
  ).current;

  // Atualiza startRef caso card.x/y mude externamente
  useEffect(() => {
    if (!dragPos) {
      startRef.current = { x: card.x, y: card.y };
    }
  }, [card.x, card.y, dragPos]);

  const posX = (dragPos ? dragPos.x : card.x) * zoom;
  const posY = (dragPos ? dragPos.y : card.y) * zoom;
  const palette = CARD_COLORS[card.color] ?? CARD_COLORS.default;
  const cardBg = isLightBg ? palette.bgLight : palette.bgDark;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) =>
        onLayoutCard(card.id, e.nativeEvent.layout.width, e.nativeEvent.layout.height)
      }
      style={[
        styles.cardOuter,
        {
          left: posX,
          top: posY,
          width: card.width * Math.max(0.75, Math.min(1.25, zoom)),
          backgroundColor: cardBg,
          borderColor: isConnectSource ? '#38BDF8' : palette.border,
          borderWidth: isConnectSource ? 2.5 : 1.5,
        },
      ]}
    >
      {/* Alça de Arrastar (Drag Handle) estilo Milanote */}
      <View
        style={[
          styles.dragHandleBar,
          { borderBottomColor: `${palette.border}55` },
        ]}
      >
        <View
          {...panResponder.panHandlers}
          style={styles.dragGripArea}
        >
          <Text style={{ color: palette.border, fontSize: 12, fontWeight: '800' }}>
            ⋮⋮
          </Text>
          <Text
            style={{
              color: isLightBg ? '#475569' : '#94A3B8',
              fontSize: 10,
              fontWeight: '700',
              textTransform: 'uppercase',
            }}
          >
            {card.type === 'subboard'
              ? 'Sub-Quadro'
              : card.type === 'swatch'
              ? 'Cor'
              : card.type === 'sketch'
              ? 'Desenho'
              : card.type === 'todo'
              ? 'Tarefas'
              : card.type === 'column'
              ? 'Coluna'
              : card.type === 'comment'
              ? 'Comentário'
              : card.type}
          </Text>
        </View>

        {isConnectMode ? (
          <TouchableOpacity
            onPress={onPressCardConnect}
            style={styles.connectTargetChip}
          >
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>
              {isConnectSource ? 'Origem' : 'Conectar aqui'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onOpenOptions} style={{ paddingHorizontal: 6 }}>
            <Text style={{ color: isLightBg ? '#334155' : '#CBD5E1', fontSize: 15, fontWeight: '800' }}>
              ⋯
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={isConnectMode ? 0.7 : 1}
        onPress={isConnectMode ? onPressCardConnect : undefined}
        style={styles.cardBody}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
}

export default function MilanoteBoardView({
  theme,
  onOpenInBrowser,
  onExportToSpaces,
}: MilanoteBoardViewProps) {
  const [state, setState] = useState<MilanoteState>(() => {
    try {
      const raw = getAppMeta(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MilanoteState;
        if (Array.isArray(parsed.boards) && parsed.boards.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback starter
    }
    return createStarterMilanoteState();
  });

  const [boardStack, setBoardStack] = useState<string[]>(() => [
    state.boards[0]?.id ?? 'board-root',
  ]);
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState({ x: -560, y: -580 });
  const [canvasSize, setCanvasSize] = useState({ width: 340, height: 480 });
  const [hasCentered, setHasCentered] = useState(false);

  const [cardSizes, setCardSizes] = useState<
    Record<string, { w: number; h: number }>
  >({});

  // Modo Conectar Setas
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);

  // Modais
  const [editingCard, setEditingCard] = useState<MilanoteCard | null>(null);
  const [menuCardId, setMenuCardId] = useState<string | null>(null);
  const [bgModalVisible, setBgModalVisible] = useState(false);
  const [templatesModalVisible, setTemplatesModalVisible] = useState(false);
  const [sketchModalVisible, setSketchModalVisible] = useState(false);
  const [fullscreenImgUri, setFullscreenImgUri] = useState<string | null>(null);
  const [editingConn, setEditingConn] = useState<MilanoteConnection | null>(
    null
  );
  const [newTodoInputs, setNewTodoInputs] = useState<Record<string, string>>({});

  const panRef = useRef({ x: -560, y: -580 });
  const dragStartRef = useRef({ x: -560, y: -580 });

  const canvasPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
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

  const persistState = (next: MilanoteState) => {
    setState(next);
    setAppMeta(STORAGE_KEY, JSON.stringify(next));
  };

  const currentBoardId = boardStack[boardStack.length - 1];
  const currentBoard = useMemo(
    () =>
      state.boards.find((b) => b.id === currentBoardId) ?? state.boards[0],
    [state.boards, currentBoardId]
  );

  const boardCards = useMemo(
    () => state.cards.filter((c) => c.boardId === currentBoard.id),
    [state.cards, currentBoard.id]
  );

  const boardConnections = useMemo(
    () => state.connections.filter((c) => c.boardId === currentBoard.id),
    [state.connections, currentBoard.id]
  );

  const recenter = (
    w = canvasSize.width,
    h = canvasSize.height,
    targetZoom = zoom
  ) => {
    let cx = WORLD_SIZE / 2;
    let cy = WORLD_SIZE / 2;
    if (boardCards.length > 0) {
      const avgX =
        boardCards.reduce((acc, c) => acc + c.x + c.width / 2, 0) /
        boardCards.length;
      const avgY =
        boardCards.reduce((acc, c) => acc + c.y + 70, 0) / boardCards.length;
      cx = avgX;
      cy = avgY;
    }
    const next = {
      x: w / 2 - cx * targetZoom,
      y: h / 2 - cy * targetZoom,
    };
    panRef.current = next;
    setPan(next);
  };

  const handleCanvasLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
    if (!hasCentered) {
      setHasCentered(true);
      recenter(width, height, zoom);
    }
  };

  const getNewCardCoords = () => {
    const centerX = Math.round((canvasSize.width / 2 - pan.x) / zoom - 95);
    const centerY = Math.round((canvasSize.height / 2 - pan.y) / zoom - 60);
    const jitter = ((boardCards.length * 19) % 70) - 35;
    return {
      x: Math.max(40, Math.min(WORLD_SIZE - 220, centerX + jitter)),
      y: Math.max(40, Math.min(WORLD_SIZE - 180, centerY + jitter)),
    };
  };

  const addCard = (
    type: MilanoteCardType,
    extra?: Partial<MilanoteCard>
  ) => {
    const coords = getNewCardCoords();
    let createdSubBoard: MilanoteBoard | null = null;
    let subBoardId: string | undefined;

    if (type === 'subboard') {
      subBoardId = makeId('brd');
      createdSubBoard = {
        id: subBoardId,
        parentId: currentBoard.id,
        title: extra?.title ?? 'Novo Sub-Quadro',
        bgStyle: currentBoard.bgStyle,
      };
    }

    const newCard: MilanoteCard = {
      id: makeId('mc'),
      boardId: currentBoard.id,
      type,
      x: coords.x,
      y: coords.y,
      width: type === 'column' ? 215 : type === 'swatch' ? 165 : 195,
      title:
        type === 'note'
          ? 'Nova Nota'
          : type === 'todo'
          ? 'Lista de Tarefas'
          : type === 'column'
          ? 'Nova Coluna'
          : type === 'subboard'
          ? 'Novo Sub-Quadro'
          : type === 'link'
          ? 'Link Salvo'
          : type === 'swatch'
          ? 'Cor da Paleta'
          : type === 'comment'
          ? 'Comentário'
          : type === 'sketch'
          ? 'Esboço'
          : 'Anexo',
      text: '',
      color: type === 'comment' ? 'yellow' : 'default',
      todos:
        type === 'todo'
          ? [{ id: makeId('td'), text: 'Nova tarefa', done: false }]
          : undefined,
      columnItems:
        type === 'column'
          ? [{ id: makeId('ci'), text: 'Primeiro item' }]
          : undefined,
      swatchHex: type === 'swatch' ? '#6366F1' : undefined,
      url: type === 'link' ? 'https://' : undefined,
      subBoardId,
      ...extra,
    };

    persistState({
      ...state,
      boards: createdSubBoard
        ? [...state.boards, createdSubBoard]
        : state.boards,
      cards: [...state.cards, newCard],
    });

    if (
      type === 'note' ||
      type === 'link' ||
      type === 'swatch' ||
      type === 'comment'
    ) {
      setEditingCard(newCard);
    }
  };

  const addImageCard = async (fromCamera: boolean) => {
    try {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso às imagens.');
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
          });
      if (!res.canceled && res.assets.length > 0) {
        const asset = res.assets[0];
        const saved = await persistMediaFile(
          asset.uri,
          asset.fileName ?? 'milanote.jpg'
        );
        addCard('image', {
          title: asset.fileName ?? 'Imagem',
          mediaUri: saved,
          mediaName: asset.fileName ?? 'Imagem',
        });
      }
    } catch (err) {
      Alert.alert('Erro na imagem', String(err));
    }
  };

  const addFileCard = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const saved = await persistMediaFile(asset.uri, asset.name);
        addCard('file', {
          title: asset.name,
          mediaUri: saved,
          mediaName: asset.name,
          mediaSize: asset.size,
        });
      }
    } catch (err) {
      Alert.alert('Erro no arquivo', String(err));
    }
  };

  const updateCard = (id: string, patch: Partial<MilanoteCard>) => {
    const nextCards = state.cards.map((c) =>
      c.id === id ? { ...c, ...patch } : c
    );
    let nextBoards = state.boards;
    if (patch.title) {
      const card = state.cards.find((c) => c.id === id);
      if (card?.type === 'subboard' && card.subBoardId) {
        nextBoards = state.boards.map((b) =>
          b.id === card.subBoardId ? { ...b, title: patch.title! } : b
        );
      }
    }
    persistState({ ...state, boards: nextBoards, cards: nextCards });
  };

  const deleteCard = (id: string) => {
    const target = state.cards.find((c) => c.id === id);
    const subIdsToRemove = new Set<string>();
    if (target?.type === 'subboard' && target.subBoardId) {
      subIdsToRemove.add(target.subBoardId);
    }

    persistState({
      boards: state.boards.filter((b) => !subIdsToRemove.has(b.id)),
      cards: state.cards.filter(
        (c) => c.id !== id && !subIdsToRemove.has(c.boardId)
      ),
      connections: state.connections.filter(
        (con) => con.fromId !== id && con.toId !== id
      ),
    });
    setMenuCardId(null);
  };

  const handleCardConnectTap = (targetId: string) => {
    if (!connectSourceId) return;
    if (connectSourceId === targetId) {
      setConnectSourceId(null);
      return;
    }
    const exists = state.connections.some(
      (c) =>
        c.boardId === currentBoard.id &&
        c.fromId === connectSourceId &&
        c.toId === targetId
    );
    if (!exists) {
      const newConn: MilanoteConnection = {
        id: makeId('con'),
        boardId: currentBoard.id,
        fromId: connectSourceId,
        toId: targetId,
        label: '',
        color: '#38BDF8',
      };
      persistState({
        ...state,
        connections: [...state.connections, newConn],
      });
    }
    setConnectSourceId(null);
  };

  const applyBoardTemplate = (templateId: 'vision' | 'moodboard' | 'project' | 'clear') => {
    const others = state.cards.filter((c) => c.boardId !== currentBoard.id);
    const otherConns = state.connections.filter(
      (c) => c.boardId !== currentBoard.id
    );

    if (templateId === 'clear') {
      persistState({ ...state, cards: others, connections: otherConns });
      setTemplatesModalVisible(false);
      return;
    }

    const bId = currentBoard.id;
    let newCards: MilanoteCard[] = [];
    let newConns: MilanoteConnection[] = [];

    if (templateId === 'vision') {
      const a = makeId('mc');
      const b = makeId('mc');
      const c = makeId('mc');
      newCards = [
        {
          id: a,
          boardId: bId,
          type: 'note',
          x: 680,
          y: 640,
          width: 205,
          title: '🌟 Onde Quero Chegar',
          text: 'Descreva aqui sua grande visão de vida e carreira para este ano.',
          color: 'purple',
        },
        {
          id: b,
          boardId: bId,
          type: 'column',
          x: 910,
          y: 640,
          width: 210,
          title: '💎 Valores & Pilares',
          text: '',
          color: 'default',
          columnItems: [
            { id: makeId('ci'), text: 'Disciplina diária' },
            { id: makeId('ci'), text: 'Foco no essencial' },
            { id: makeId('ci'), text: 'Saúde em primeiro lugar' },
          ],
        },
        {
          id: c,
          boardId: bId,
          type: 'todo',
          x: 680,
          y: 840,
          width: 205,
          title: 'Próximos Passos',
          text: '',
          color: 'green',
          todos: [
            { id: makeId('td'), text: 'Definir meta financeira', done: false },
            { id: makeId('td'), text: 'Adicionar fotos de inspiração', done: false },
          ],
        },
      ];
      newConns = [
        { id: makeId('cn'), boardId: bId, fromId: a, toId: c, label: 'Plano', color: '#38BDF8' },
      ];
    } else if (templateId === 'moodboard') {
      newCards = [
        {
          id: makeId('mc'),
          boardId: bId,
          type: 'note',
          x: 680,
          y: 660,
          width: 195,
          title: '🎨 Conceito Visual',
          text: 'Estilo minimalista, escuro e futurista com tons de índigo e ciano.',
          color: 'default',
        },
        {
          id: makeId('mc'),
          boardId: bId,
          type: 'swatch',
          x: 900,
          y: 660,
          width: 155,
          title: 'Primária',
          text: 'Índigo Vibrante',
          color: 'default',
          swatchHex: '#6366F1',
        },
        {
          id: makeId('mc'),
          boardId: bId,
          type: 'swatch',
          x: 900,
          y: 790,
          width: 155,
          title: 'Destaque',
          text: 'Ciano Neon',
          color: 'default',
          swatchHex: '#38BDF8',
        },
      ];
    } else {
      const col1 = makeId('mc');
      const col2 = makeId('mc');
      newCards = [
        {
          id: col1,
          boardId: bId,
          type: 'column',
          x: 660,
          y: 650,
          width: 210,
          title: '💡 Ideias & Pesquisa',
          text: '',
          color: 'blue',
          columnItems: [
            { id: makeId('ci'), text: 'Referências principais' },
            { id: makeId('ci'), text: 'Problemas a resolver' },
          ],
        },
        {
          id: col2,
          boardId: bId,
          type: 'column',
          x: 895,
          y: 650,
          width: 210,
          title: '🚀 Execução',
          text: '',
          color: 'green',
          columnItems: [
            { id: makeId('ci'), text: 'Protótipo inicial' },
            { id: makeId('ci'), text: 'Revisão e lançamento' },
          ],
        },
      ];
      newConns = [
        { id: makeId('cn'), boardId: bId, fromId: col1, toId: col2, label: 'Avança', color: '#10B981' },
      ];
    }

    persistState({
      ...state,
      cards: [...others, ...newCards],
      connections: [...otherConns, ...newConns],
    });
    setTemplatesModalVisible(false);
    setTimeout(() => recenter(), 80);
  };

  const exportBoardToNexusSpaces = () => {
    const blocks: EditorBlock[] = [
      createBlock('callout', `Exportado do Quadro de Visão (Milanote): ${currentBoard.title}`),
    ];
    for (const c of boardCards) {
      if (c.type === 'column') {
        blocks.push(createBlock('h2', `📋 ${c.title}`));
        (c.columnItems ?? []).forEach((item) => {
          blocks.push(createBlock('bullet', item.text));
        });
      } else if (c.type === 'todo') {
        blocks.push(createBlock('h3', c.title));
        (c.todos ?? []).forEach((t) => {
          blocks.push(createBlock('todo', t.text, { checked: t.done }));
        });
      } else if (c.type === 'link') {
        blocks.push(createBlock('bookmark', c.title, { url: c.url ?? '' }));
      } else if (c.type === 'swatch') {
        blocks.push(
          createBlock('paragraph', `🎨 ${c.title}: ${c.swatchHex} — ${c.text}`)
        );
      } else {
        blocks.push(createBlock('h3', c.title));
        if (c.text) blocks.push(createBlock('paragraph', c.text));
      }
    }
    blocks.push(createBlock('paragraph', '#quadrodevisao #milanote'));
    onExportToSpaces(currentBoard.title, serializeBlocks(blocks));
  };

  const bgInfo =
    BG_OPTIONS.find((b) => b.key === currentBoard.bgStyle) ?? BG_OPTIONS[0];
  const isLightBoard = currentBoard.bgStyle === 'light';

  const menuCard = useMemo(
    () => state.cards.find((c) => c.id === menuCardId) ?? null,
    [state.cards, menuCardId]
  );

  const breadcrumbs = useMemo(
    () =>
      boardStack
        .map((id) => state.boards.find((b) => b.id === id))
        .filter((b): b is MilanoteBoard => !!b),
    [boardStack, state.boards]
  );

  return (
    <View style={styles.container}>
      {/* Barra Superior do Quadro (Breadcrumbs + Controles) */}
      <View
        style={[
          styles.topStrip,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', gap: 4 }}
        >
          {breadcrumbs.map((b, idx) => (
            <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {idx > 0 && (
                <Text style={{ color: theme.textDim, fontSize: 12 }}> › </Text>
              )}
              <TouchableOpacity
                onPress={() => setBoardStack((prev) => prev.slice(0, idx + 1))}
              >
                <Text
                  style={{
                    color:
                      idx === breadcrumbs.length - 1
                        ? theme.accent
                        : theme.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {b.title}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.topActionBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => setBgModalVisible(true)}
          >
            <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
              🎨 Fundo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topActionBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => setTemplatesModalVisible(true)}
          >
            <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
              📋 Modelos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topActionBtn, { backgroundColor: theme.accent }]}
            onPress={exportBoardToNexusSpaces}
          >
            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
              📄 Espaços
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Zoom / Modo Conectar */}
      <View
        style={[
          styles.subStrip,
          { backgroundColor: theme.bg, borderBottomColor: theme.border },
        ]}
      >
        {connectSourceId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700', flex: 1 }}>
              ↗ Toque em outro cartão para conectar a seta!
            </Text>
            <TouchableOpacity onPress={() => setConnectSourceId(null)}>
              <Text style={{ color: '#F87171', fontSize: 12, fontWeight: '700' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={{ color: theme.textDim, fontSize: 11, flex: 1 }}>
            {boardCards.length} cartões • {boardConnections.length} conexões • Arraste por ⋮⋮
          </Text>
        )}

        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() =>
              setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))
            }
            style={[styles.zoomBtn, { backgroundColor: theme.surfaceAlt }]}
          >
            <Text style={{ color: theme.text, fontWeight: '800' }}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => recenter()}
            style={[styles.zoomBtn, { backgroundColor: theme.surfaceAlt }]}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>
              ⌖
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              setZoom((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))))
            }
            style={[styles.zoomBtn, { backgroundColor: theme.surfaceAlt }]}
          >
            <Text style={{ color: theme.text, fontWeight: '800' }}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas Infinito */}
      <View
        style={[styles.canvas, { backgroundColor: bgInfo.bg }]}
        onLayout={handleCanvasLayout}
        {...canvasPanResponder.panHandlers}
      >
        <View
          style={{
            position: 'absolute',
            left: pan.x,
            top: pan.y,
            width: WORLD_SIZE * zoom,
            height: WORLD_SIZE * zoom,
          }}
        >
          {/* Textura sutil de grade/pontilhado */}
          {currentBoard.bgStyle === 'blueprint' && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.12)' },
              ]}
            />
          )}

          {/* Setas de Conexão entre Cartões */}
          {boardConnections.map((conn) => {
            const fromCard = boardCards.find((c) => c.id === conn.fromId);
            const toCard = boardCards.find((c) => c.id === conn.toId);
            if (!fromCard || !toCard) return null;

            const sFrom = cardSizes[fromCard.id] ?? { w: fromCard.width, h: 110 };
            const sTo = cardSizes[toCard.id] ?? { w: toCard.width, h: 110 };

            const x1 = fromCard.x * zoom + sFrom.w / 2;
            const y1 = fromCard.y * zoom + sFrom.h / 2;
            const x2 = toCard.x * zoom + sTo.w / 2;
            const y2 = toCard.y * zoom + sTo.h / 2;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const length = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            const cx = (x1 + x2) / 2;
            const cy = (y1 + y2) / 2;

            return (
              <React.Fragment key={conn.id}>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: cx - length / 2,
                    top: cy - 1.2,
                    width: length,
                    height: 2.4,
                    backgroundColor: conn.color,
                    transform: [{ rotate: `${angle}rad` }],
                  }}
                />
                <TouchableOpacity
                  onPress={() => setEditingConn(conn)}
                  style={[
                    styles.connBadge,
                    {
                      left: cx - 34,
                      top: cy - 11,
                      borderColor: conn.color,
                    },
                  ]}
                >
                  <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
                    {conn.label ? `${conn.label} ➤` : '➤'}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}

          {/* Cartões do Quadro */}
          {boardCards.map((card) => {
            const textColor = isLightBoard ? '#0F172A' : '#F8FAFC';
            const mutedColor = isLightBoard ? '#475569' : '#CBD5E1';

            return (
              <DraggableCard
                key={card.id}
                card={card}
                zoom={zoom}
                isLightBg={isLightBoard}
                isConnectSource={connectSourceId === card.id}
                isConnectMode={!!connectSourceId}
                onPressCardConnect={() => handleCardConnectTap(card.id)}
                onMoveEnd={(id, nx, ny) => updateCard(id, { x: nx, y: ny })}
                onOpenOptions={() => setMenuCardId(card.id)}
                onLayoutCard={(id, w, h) => {
                  setCardSizes((prev) => {
                    const cur = prev[id];
                    if (cur && Math.abs(cur.w - w) < 2 && Math.abs(cur.h - h) < 2) {
                      return prev;
                    }
                    return { ...prev, [id]: { w, h } };
                  });
                }}
              >
                {/* Conteúdo específico por tipo de cartão */}
                {card.type === 'note' || card.type === 'comment' ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setEditingCard(card)}
                  >
                    <Text style={[styles.cardTitle, { color: textColor }]}>
                      {card.type === 'comment' ? '💬 ' : ''}
                      {card.title}
                    </Text>
                    {card.text ? (
                      <Text style={{ color: mutedColor, fontSize: 12, lineHeight: 17 }}>
                        {card.text}
                      </Text>
                    ) : (
                      <Text style={{ color: '#64748B', fontSize: 11, fontStyle: 'italic' }}>
                        Toque para editar...
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : card.type === 'todo' ? (
                  <View>
                    <TouchableOpacity onPress={() => setEditingCard(card)}>
                      <Text style={[styles.cardTitle, { color: textColor }]}>
                        {card.title}
                      </Text>
                    </TouchableOpacity>
                    {(card.todos ?? []).map((td) => (
                      <TouchableOpacity
                        key={td.id}
                        onPress={() => {
                          const nextTodos = (card.todos ?? []).map((t) =>
                            t.id === td.id ? { ...t, done: !t.done } : t
                          );
                          updateCard(card.id, { todos: nextTodos });
                        }}
                        style={styles.todoItemRow}
                      >
                        <Text style={{ fontSize: 14, color: td.done ? '#10B981' : mutedColor }}>
                          {td.done ? '☑' : '☐'}
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            color: td.done ? '#64748B' : textColor,
                            fontSize: 12,
                            textDecorationLine: td.done ? 'line-through' : 'none',
                          }}
                        >
                          {td.text}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <View style={styles.inlineAddRow}>
                      <TextInput
                        style={[styles.inlineAddInput, { color: textColor }]}
                        value={newTodoInputs[card.id] ?? ''}
                        onChangeText={(txt) =>
                          setNewTodoInputs((p) => ({ ...p, [card.id]: txt }))
                        }
                        placeholder="+ tarefa..."
                        placeholderTextColor="#64748B"
                      />
                      <TouchableOpacity
                        onPress={() => {
                          const txt = (newTodoInputs[card.id] ?? '').trim();
                          if (!txt) return;
                          updateCard(card.id, {
                            todos: [
                              ...(card.todos ?? []),
                              { id: makeId('td'), text: txt, done: false },
                            ],
                          });
                          setNewTodoInputs((p) => ({ ...p, [card.id]: '' }));
                        }}
                      >
                        <Text style={{ color: '#38BDF8', fontWeight: '800', fontSize: 15 }}>
                          +
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : card.type === 'column' ? (
                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => setEditingCard(card)} style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: textColor }]}>
                          {card.title} ({(card.columnItems ?? []).length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          updateCard(card.id, { isCollapsed: !card.isCollapsed })
                        }
                      >
                        <Text style={{ color: mutedColor, fontSize: 13 }}>
                          {card.isCollapsed ? '▸' : '▾'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {!card.isCollapsed && (
                      <>
                        {(card.columnItems ?? []).map((item, idx) => (
                          <View
                            key={item.id}
                            style={[
                              styles.colSubCard,
                              {
                                backgroundColor: isLightBoard
                                  ? 'rgba(0,0,0,0.06)'
                                  : 'rgba(0,0,0,0.28)',
                              },
                            ]}
                          >
                            <Text style={{ color: textColor, fontSize: 12, flex: 1 }}>
                              {item.text}
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                const nextItems = (card.columnItems ?? []).filter(
                                  (_, i) => i !== idx
                                );
                                updateCard(card.id, { columnItems: nextItems });
                              }}
                            >
                              <Text style={{ color: '#F87171', fontSize: 11 }}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                        <View style={styles.inlineAddRow}>
                          <TextInput
                            style={[styles.inlineAddInput, { color: textColor }]}
                            value={newTodoInputs[card.id] ?? ''}
                            onChangeText={(txt) =>
                              setNewTodoInputs((p) => ({ ...p, [card.id]: txt }))
                            }
                            placeholder="+ item na coluna..."
                            placeholderTextColor="#64748B"
                          />
                          <TouchableOpacity
                            onPress={() => {
                              const txt = (newTodoInputs[card.id] ?? '').trim();
                              if (!txt) return;
                              updateCard(card.id, {
                                columnItems: [
                                  ...(card.columnItems ?? []),
                                  { id: makeId('ci'), text: txt },
                                ],
                              });
                              setNewTodoInputs((p) => ({ ...p, [card.id]: '' }));
                            }}
                          >
                            <Text style={{ color: '#38BDF8', fontWeight: '800', fontSize: 15 }}>
                              +
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                ) : card.type === 'subboard' ? (
                  <TouchableOpacity
                    onPress={() => {
                      if (card.subBoardId) {
                        setBoardStack((prev) => [...prev, card.subBoardId!]);
                        setTimeout(() => recenter(), 60);
                      }
                    }}
                    style={{ alignItems: 'center', paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 32 }}>📁</Text>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: textColor, textAlign: 'center', marginTop: 4 },
                      ]}
                    >
                      {card.title}
                    </Text>
                    <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700' }}>
                      Abrir Sub-Quadro →
                    </Text>
                  </TouchableOpacity>
                ) : card.type === 'image' || card.type === 'sketch' ? (
                  <View>
                    {card.mediaUri && (
                      <TouchableOpacity
                        onPress={() => setFullscreenImgUri(card.mediaUri ?? null)}
                      >
                        <Image
                          source={{ uri: card.mediaUri }}
                          style={styles.cardImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setEditingCard(card)}>
                      <Text style={[styles.cardTitle, { color: textColor, marginTop: 6, marginBottom: 0 }]}>
                        {card.title}
                      </Text>
                      {card.text ? (
                        <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2 }}>
                          {card.text}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  </View>
                ) : card.type === 'link' ? (
                  <TouchableOpacity
                    onPress={() => {
                      const raw = (card.url ?? '').trim();
                      if (!raw || raw === 'https://') {
                        setEditingCard(card);
                        return;
                      }
                      const normalized = /^https?:\/\//i.test(raw)
                        ? raw
                        : `https://${raw}`;
                      if (onOpenInBrowser) {
                        onOpenInBrowser(normalized, card.title);
                      } else {
                        Linking.openURL(normalized);
                      }
                    }}
                  >
                    <Text style={[styles.cardTitle, { color: textColor }]}>
                      🌐 {card.title}
                    </Text>
                    <Text style={{ color: '#38BDF8', fontSize: 11 }} numberOfLines={2}>
                      {card.url || 'Toque para configurar URL'}
                    </Text>
                  </TouchableOpacity>
                ) : card.type === 'swatch' ? (
                  <TouchableOpacity onPress={() => setEditingCard(card)}>
                    <View
                      style={[
                        styles.swatchBlock,
                        { backgroundColor: card.swatchHex || '#6366F1' },
                      ]}
                    />
                    <Text style={[styles.cardTitle, { color: textColor, marginTop: 6 }]}>
                      {card.title}
                    </Text>
                    <Text style={{ color: mutedColor, fontSize: 11, fontFamily: 'monospace' }}>
                      {card.swatchHex || '#6366F1'} {card.text ? `• ${card.text}` : ''}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (card.mediaUri) {
                        shareLocalFile(card.mediaUri);
                      }
                    }}
                  >
                    <Text style={[styles.cardTitle, { color: textColor }]}>
                      📎 {card.mediaName || card.title}
                    </Text>
                    <Text style={{ color: '#38BDF8', fontSize: 11 }}>
                      {card.mediaSize ? `${formatFileSize(card.mediaSize)} • ` : ''}
                      Toque para abrir
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Reações e Comentário Rápido no rodapé do cartão */}
                {((card.reactions && card.reactions.length > 0) ||
                  card.commentText) && (
                  <View style={styles.footerBadges}>
                    {card.reactions && card.reactions.length > 0 && (
                      <Text style={{ fontSize: 12 }}>
                        {card.reactions.join(' ')}
                      </Text>
                    )}
                    {card.commentText ? (
                      <Text style={{ color: '#FBBF24', fontSize: 10, marginTop: 2 }}>
                        💬 {card.commentText}
                      </Text>
                    ) : null}
                  </View>
                )}
              </DraggableCard>
            );
          })}
        </View>
      </View>

      {/* Dock Inferior estilo Milanote */}
      <View
        style={[
          styles.dockBar,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dockRow}
        >
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addCard('note')}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>📝 Nota</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addCard('todo')}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>☑️ Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addImageCard(false)}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>🖼️ Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addImageCard(true)}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>📷 Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => setSketchModalVisible(true)}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>✏️ Desenho</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addCard('column')}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>📋 Coluna</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addCard('subboard')}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>📁 Sub-Quadro</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addCard('link')}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>🌐 Link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addCard('swatch')}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>🎨 Cor</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={addFileCard}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>📎 Arquivo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dockBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => addCard('comment')}
          >
            <Text style={[styles.dockText, { color: theme.text }]}>💬 Nota Rápida</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Modal Opções do Cartão (⋯) */}
      <Modal
        visible={!!menuCard}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuCardId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
              {menuCard?.title}
            </Text>

            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                if (!menuCard) return;
                const target = menuCard;
                setMenuCardId(null);
                setEditingCard(target);
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                ✏️ Editar conteúdo / cor / comentário
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                if (!menuCard) return;
                setConnectSourceId(menuCard.id);
                setMenuCardId(null);
              }}
            >
              <Text style={{ color: '#38BDF8', fontWeight: '700' }}>
                ↗ Conectar com seta a outro cartão
              </Text>
            </TouchableOpacity>

            <Text style={{ color: theme.textDim, fontSize: 11, fontWeight: '700', marginVertical: 6 }}>
              REAÇÃO RÁPIDA:
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {['❤️', '🔥', '💡', '✅'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiBtn, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuCard) return;
                    const cur = menuCard.reactions ?? [];
                    const has = cur.includes(emoji);
                    const next = has
                      ? cur.filter((e) => e !== emoji)
                      : [...cur, emoji];
                    updateCard(menuCard.id, { reactions: next });
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.menuBtn,
                { backgroundColor: '#450A0A', borderWidth: 1, borderColor: '#7F1D1D' },
              ]}
              onPress={() => {
                if (menuCard) deleteCard(menuCard.id);
              }}
            >
              <Text style={{ color: '#FCA5A5', fontWeight: '700' }}>
                🗑 Excluir cartão
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMenuCardId(null)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Cartão */}
      <Modal
        visible={!!editingCard}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingCard(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { maxHeight: '85%', backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ✏️ Editar Cartão
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                ]}
                value={editingCard?.title ?? ''}
                onChangeText={(t) =>
                  setEditingCard((c) => (c ? { ...c, title: t } : null))
                }
                placeholder="Título..."
                placeholderTextColor={theme.textDim}
              />

              {editingCard?.type === 'link' && (
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.bg, borderColor: theme.border, color: '#38BDF8' },
                  ]}
                  value={editingCard.url ?? ''}
                  onChangeText={(u) =>
                    setEditingCard((c) => (c ? { ...c, url: u } : null))
                  }
                  placeholder="https://..."
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                />
              )}

              {editingCard?.type === 'swatch' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {SWATCH_PRESETS.map((hex) => (
                    <TouchableOpacity
                      key={hex}
                      onPress={() =>
                        setEditingCard((c) => (c ? { ...c, swatchHex: hex } : null))
                      }
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: hex,
                        borderWidth: editingCard.swatchHex === hex ? 2.5 : 0,
                        borderColor: '#FFF',
                      }}
                    />
                  ))}
                </View>
              )}

              {editingCard?.type !== 'todo' && editingCard?.type !== 'column' && (
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                      minHeight: 85,
                      textAlignVertical: 'top',
                    },
                  ]}
                  value={editingCard?.text ?? ''}
                  onChangeText={(txt) =>
                    setEditingCard((c) => (c ? { ...c, text: txt } : null))
                  }
                  multiline
                  placeholder="Conteúdo / descrição..."
                  placeholderTextColor={theme.textDim}
                />
              )}

              <Text style={{ color: theme.textDim, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                COMENTÁRIO / ANOTAÇÃO EXTRA:
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.bg, borderColor: theme.border, color: '#FBBF24' },
                ]}
                value={editingCard?.commentText ?? ''}
                onChangeText={(cm) =>
                  setEditingCard((c) => (c ? { ...c, commentText: cm } : null))
                }
                placeholder="Comentário rápido..."
                placeholderTextColor={theme.textDim}
              />

              <Text style={{ color: theme.textDim, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                COR DO CARTÃO:
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, marginBottom: 14 }}
              >
                {(Object.keys(CARD_COLORS) as CardColorKey[]).map((ck) => {
                  const active = editingCard?.color === ck;
                  return (
                    <TouchableOpacity
                      key={ck}
                      onPress={() =>
                        setEditingCard((c) => (c ? { ...c, color: ck } : null))
                      }
                      style={[
                        styles.colorChoice,
                        {
                          backgroundColor: CARD_COLORS[ck].bgDark,
                          borderColor: active ? '#FFF' : CARD_COLORS[ck].border,
                          borderWidth: active ? 2 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                        {CARD_COLORS[ck].label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setEditingCard(null)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (editingCard) {
                    updateCard(editingCard.id, editingCard);
                  }
                  setEditingCard(null);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Seta */}
      <Modal
        visible={!!editingConn}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingConn(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ↗ Editar Conexão
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
              ]}
              value={editingConn?.label ?? ''}
              onChangeText={(l) =>
                setEditingConn((c) => (c ? { ...c, label: l } : null))
              }
              placeholder="Rótulo da seta (opcional)..."
              placeholderTextColor={theme.textDim}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  if (!editingConn) return;
                  persistState({
                    ...state,
                    connections: state.connections.filter(
                      (x) => x.id !== editingConn.id
                    ),
                  });
                  setEditingConn(null);
                }}
                style={{ padding: 8 }}
              >
                <Text style={{ color: '#F87171', fontWeight: '700' }}>
                  🗑 Excluir Seta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  if (!editingConn) return;
                  persistState({
                    ...state,
                    connections: state.connections.map((x) =>
                      x.id === editingConn.id ? editingConn : x
                    ),
                  });
                  setEditingConn(null);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Fundo do Quadro */}
      <Modal
        visible={bgModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBgModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              🎨 Fundo do Quadro
            </Text>
            {BG_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.menuBtn, { backgroundColor: opt.bg, borderWidth: 1, borderColor: theme.border }]}
                onPress={() => {
                  persistState({
                    ...state,
                    boards: state.boards.map((b) =>
                      b.id === currentBoard.id ? { ...b, bgStyle: opt.key } : b
                    ),
                  });
                  setBgModalVisible(false);
                }}
              >
                <Text style={{ color: opt.key === 'light' ? '#0F172A' : '#FFF', fontWeight: '700' }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setBgModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Modelos Milanote */}
      <Modal
        visible={templatesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTemplatesModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              📋 Modelos para este Quadro
            </Text>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => applyBoardTemplate('vision')}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                🌟 Quadro de Visão / Sonhos
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => applyBoardTemplate('moodboard')}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                🎨 Moodboard Criativo & Cores
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => applyBoardTemplate('project')}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                🚀 Planejamento de Projeto (Colunas)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { backgroundColor: '#450A0A' }]}
              onPress={() => applyBoardTemplate('clear')}
            >
              <Text style={{ color: '#FCA5A5', fontWeight: '700' }}>
                🧹 Limpar Quadro Atual
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTemplatesModalVisible(false)}
              style={{ alignItems: 'center', paddingTop: 8 }}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Lousa de Desenho Livre */}
      <Modal
        visible={sketchModalVisible}
        animationType="slide"
        onRequestClose={() => setSketchModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
          <View style={styles.sketchTopBar}>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>
              ✏️ Lousa de Desenho Livre
            </Text>
            <TouchableOpacity onPress={() => setSketchModalVisible(false)}>
              <Text style={{ color: '#F87171', fontSize: 15, fontWeight: '700' }}>
                ✕ Fechar
              </Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: SKETCH_HTML }}
            style={{ flex: 1 }}
            javaScriptEnabled
            originWhitelist={['*']}
            onMessage={(e: WebViewMessageEvent) => {
              try {
                const payload = JSON.parse(e.nativeEvent.data) as {
                  type?: string;
                  dataUrl?: string;
                };
                if (payload.type === 'SKETCH_SAVE' && payload.dataUrl) {
                  addCard('sketch', {
                    title: 'Esboço Livre',
                    mediaUri: payload.dataUrl,
                  });
                  setSketchModalVisible(false);
                }
              } catch {
                // ignore
              }
            }}
          />
        </View>
      </Modal>

      {/* Modal Zoom Imagem */}
      <Modal
        visible={!!fullscreenImgUri}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImgUri(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setFullscreenImgUri(null)}
          >
            <Text style={{ color: '#FFF', fontWeight: '800' }}>✕ Fechar</Text>
          </TouchableOpacity>
          {fullscreenImgUri && (
            <Image
              source={{ uri: fullscreenImgUri }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  topActionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  subStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  zoomBtn: {
    width: 28,
    height: 26,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
  },
  cardOuter: {
    position: 'absolute',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  dragHandleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
  },
  dragGripArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  connectTargetChip: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardBody: {
    padding: 9,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  todoItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  inlineAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(148,163,184,0.25)',
    paddingTop: 4,
  },
  inlineAddInput: {
    flex: 1,
    fontSize: 11,
    paddingVertical: 2,
  },
  colSubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 5,
    gap: 6,
  },
  cardImage: {
    width: '100%',
    height: 110,
    borderRadius: 8,
  },
  swatchBlock: {
    width: '100%',
    height: 54,
    borderRadius: 8,
  },
  footerBadges: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(148,163,184,0.25)',
  },
  connBadge: {
    position: 'absolute',
    width: 68,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  dockBar: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  dockRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dockBtn: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dockText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 12,
  },
  menuBtn: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  emojiBtn: {
    padding: 8,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
  },
  colorChoice: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sketchTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 42,
    paddingBottom: 12,
    backgroundColor: '#1E293B',
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fullscreenClose: {
    position: 'absolute',
    top: 44,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(30,41,59,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
