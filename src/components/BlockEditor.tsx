import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ALL_TOOLBAR_TOOLS,
  BLOCK_CATEGORIES,
  BlockColor,
  BlockType,
  COLOR_PALETTE,
  CalloutVariant,
  EditorBlock,
  EditorPrefs,
  EditorTheme,
  TextAlignMode,
  ToolbarToolId,
  createBlock,
  detectMarkdownShortcut,
  parseContentToBlocks,
  serializeBlocks,
  stripInlineFormatting,
} from '../editor/blocks';
import AdvancedBlockView from './AdvancedBlocks';
import MediaBlockView from './MediaBlocks';

interface BlockEditorProps {
  noteId: string;
  rawContent: string;
  availableNoteTitles?: string[];
  theme: EditorTheme;
  prefs: EditorPrefs;
  toolbarIds: ToolbarToolId[];
  isZenMode: boolean;
  onChangePrefs: (prefs: EditorPrefs) => void;
  onChangeToolbar: (ids: ToolbarToolId[]) => void;
  onToggleZenMode: () => void;
  onChangeSerialized: (serialized: string) => void;
  onPressInternalLink: (title: string) => void;
}

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { icon: string; bg: string; border: string }
> = {
  info: { icon: 'ℹ️', bg: 'rgba(14, 165, 233, 0.14)', border: '#0284C7' },
  success: { icon: '✅', bg: 'rgba(16, 185, 129, 0.14)', border: '#059669' },
  warning: { icon: '⚠️', bg: 'rgba(245, 158, 11, 0.14)', border: '#D97706' },
  error: { icon: '❌', bg: 'rgba(244, 63, 94, 0.14)', border: '#E11D48' },
  question: { icon: '❓', bg: 'rgba(168, 85, 247, 0.14)', border: '#9333EA' },
  answer: { icon: '💬', bg: 'rgba(99, 102, 241, 0.14)', border: '#4F46E5' },
};

const ADVANCED_TYPES = new Set<BlockType>([
  'table',
  'kanban',
  'chart',
  'tabs',
  'timeline',
  'toc',
  'button',
  'bookmark',
]);

const MEDIA_TYPES = new Set<BlockType>([
  'image',
  'gallery',
  'video',
  'audio',
  'file',
]);

function renderFormattedInline(
  text: string,
  baseColor: string,
  theme: EditorTheme,
  onPressLink: (title: string) => void,
  extraStyle?: object
) {
  if (!text) {
    return <Text style={[styles.previewEmpty, extraStyle]}> </Text>;
  }

  const tokenRegex =
    /(\[\[[^\]]+\]\]|==[^=]+==|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|~[^~]+~|__[^_]+__|\^[^^]+\^|`[^`]+`|#[a-zA-Z0-9_À-ÿ]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={`t-${keyIdx++}`}>
          {text.slice(lastIndex, match.index)}
        </Text>
      );
    }

    const token = match[0];
    if (token.startsWith('[[') && token.endsWith(']]')) {
      const targetTitle = token.slice(2, -2).trim();
      parts.push(
        <Text
          key={`l-${keyIdx++}`}
          style={styles.inlineLink}
          onPress={() => onPressLink(targetTitle)}
        >
          {token}
        </Text>
      );
    } else if (token.startsWith('==') && token.endsWith('==')) {
      parts.push(
        <Text
          key={`hl-${keyIdx++}`}
          style={{
            backgroundColor: 'rgba(250, 204, 21, 0.35)',
            color: theme.text,
          }}
        >
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <Text
          key={`b-${keyIdx++}`}
          style={{ fontWeight: '800', color: theme.text }}
        >
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('__') && token.endsWith('__')) {
      parts.push(
        <Text key={`u-${keyIdx++}`} style={{ textDecorationLine: 'underline' }}>
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <Text key={`i-${keyIdx++}`} style={{ fontStyle: 'italic' }}>
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push(
        <Text
          key={`s-${keyIdx++}`}
          style={{ textDecorationLine: 'line-through', color: theme.textDim }}
        >
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('~') && token.endsWith('~')) {
      parts.push(
        <Text key={`sub-${keyIdx++}`} style={{ fontSize: 11, color: '#38BDF8' }}>
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith('^') && token.endsWith('^')) {
      parts.push(
        <Text key={`sup-${keyIdx++}`} style={{ fontSize: 11, color: '#A855F7' }}>
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <Text
          key={`c-${keyIdx++}`}
          style={{
            fontFamily: 'monospace',
            backgroundColor: theme.surfaceAlt,
            color: '#38BDF8',
          }}
        >
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith('#')) {
      parts.push(
        <Text
          key={`tag-${keyIdx++}`}
          style={{ color: '#A855F7', fontWeight: '700' }}
        >
          {token}
        </Text>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<Text key={`end-${keyIdx++}`}>{text.slice(lastIndex)}</Text>);
  }

  return <Text style={[{ color: baseColor }, extraStyle]}>{parts}</Text>;
}

export default function BlockEditor({
  noteId,
  rawContent,
  availableNoteTitles = [],
  theme,
  prefs,
  toolbarIds,
  isZenMode,
  onChangePrefs,
  onChangeToolbar,
  onToggleZenMode,
  onChangeSerialized,
  onPressInternalLink,
}: BlockEditorProps) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    parseContentToBlocks(rawContent)
  );
  const [undoStack, setUndoStack] = useState<EditorBlock[][]>([]);
  const [redoStack, setRedoStack] = useState<EditorBlock[][]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [insertModalVisible, setInsertModalVisible] = useState(false);
  const [insertMode, setInsertMode] = useState<'add' | 'convert'>('add');
  const [blockSearch, setBlockSearch] = useState('');
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [linkPickerVisible, setLinkPickerVisible] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');
  const [appearanceVisible, setAppearanceVisible] = useState(false);
  const [toolbarConfigVisible, setToolbarConfigVisible] = useState(false);
  const [findModalVisible, setFindModalVisible] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');

  useEffect(() => {
    const parsed = parseContentToBlocks(rawContent);
    setBlocks(parsed);
    setUndoStack([]);
    setRedoStack([]);
    setActiveBlockId(parsed[0]?.id ?? null);
    setIsPreviewMode(false);
  }, [noteId]);

  const commitBlocks = (nextBlocks: EditorBlock[], pushHistory = true) => {
    const safeBlocks =
      nextBlocks.length > 0 ? nextBlocks : [createBlock('paragraph', '')];
    if (pushHistory) {
      setUndoStack((prev) => [...prev.slice(-24), blocks]);
      setRedoStack([]);
    }
    setBlocks(safeBlocks);
    onChangeSerialized(serializeBlocks(safeBlocks));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev.slice(-24), blocks]);
    setUndoStack((prev) => prev.slice(0, -1));
    setBlocks(previous);
    onChangeSerialized(serializeBlocks(previous));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev.slice(-24), blocks]);
    setRedoStack((prev) => prev.slice(0, -1));
    setBlocks(next);
    onChangeSerialized(serializeBlocks(next));
  };

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) ?? blocks[0] ?? null,
    [blocks, activeBlockId]
  );

  const updateBlockPatch = (
    blockId: string,
    patch: Partial<EditorBlock>,
    pushHistory = true
  ) => {
    const updated = blocks.map((b) =>
      b.id === blockId ? { ...b, ...patch } : b
    );
    commitBlocks(updated, pushHistory);
  };

  const handleTextChange = (blockId: string, newText: string) => {
    const shortcut = detectMarkdownShortcut(newText);

    const updated = blocks.map((b) => {
      if (b.id !== blockId) return b;
      if (shortcut && b.type === 'paragraph') {
        return {
          ...b,
          type: shortcut.type,
          text: shortcut.cleanText,
          checked: shortcut.type === 'todo' ? false : b.checked,
          calloutVariant:
            shortcut.type === 'callout'
              ? ('info' as CalloutVariant)
              : b.calloutVariant,
          isOpen: shortcut.type === 'toggle' ? true : b.isOpen,
        };
      }
      return { ...b, text: newText };
    });

    if (shortcut?.type === 'divider') {
      const idx = updated.findIndex((b) => b.id === blockId);
      const nextPara = createBlock('paragraph', '');
      updated.splice(idx + 1, 0, nextPara);
      setActiveBlockId(nextPara.id);
    }

    commitBlocks(updated, false);
  };

  const cycleCalloutVariant = (blockId: string) => {
    const order: CalloutVariant[] = [
      'info',
      'success',
      'warning',
      'error',
      'question',
      'answer',
    ];
    const target = blocks.find((b) => b.id === blockId);
    if (!target) return;
    const cur = target.calloutVariant ?? 'info';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    updateBlockPatch(blockId, { calloutVariant: next }, true);
  };

  const insertBlockAfterActive = (type: BlockType) => {
    const newBlock = createBlock(type, '');
    const idx = blocks.findIndex((b) => b.id === activeBlock?.id);
    const next = [...blocks];
    if (idx === -1) {
      next.push(newBlock);
    } else {
      next.splice(idx + 1, 0, newBlock);
    }
    commitBlocks(next);
    setActiveBlockId(newBlock.id);
    setInsertModalVisible(false);
  };

  const convertActiveBlockType = (type: BlockType) => {
    if (!activeBlock) return;
    const templateDefaults = createBlock(type, activeBlock.text);
    const updated = blocks.map((b) =>
      b.id === activeBlock.id
        ? {
            ...templateDefaults,
            id: b.id,
            color: b.color,
            align: b.align,
            indent: b.indent,
            text: b.text,
          }
        : b
    );
    commitBlocks(updated);
    setInsertModalVisible(false);
  };

  const moveActiveBlock = (dir: 'up' | 'down') => {
    if (!activeBlock) return;
    const idx = blocks.findIndex((b) => b.id === activeBlock.id);
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= blocks.length) return;
    const next = [...blocks];
    const [removed] = next.splice(idx, 1);
    next.splice(targetIdx, 0, removed);
    commitBlocks(next);
  };

  const duplicateActiveBlock = () => {
    if (!activeBlock) return;
    const idx = blocks.findIndex((b) => b.id === activeBlock.id);
    const clone: EditorBlock = {
      ...activeBlock,
      id: createBlock('paragraph').id,
      tableData: activeBlock.tableData
        ? activeBlock.tableData.map((r) => [...r])
        : undefined,
      galleryUris: activeBlock.galleryUris
        ? [...activeBlock.galleryUris]
        : undefined,
    };
    const next = [...blocks];
    next.splice(idx + 1, 0, clone);
    commitBlocks(next);
    setActiveBlockId(clone.id);
  };

  const deleteActiveBlock = () => {
    if (!activeBlock) return;
    const idx = blocks.findIndex((b) => b.id === activeBlock.id);
    const next = blocks.filter((b) => b.id !== activeBlock.id);
    const fallback = next[Math.max(0, idx - 1)]?.id ?? null;
    commitBlocks(next);
    setActiveBlockId(fallback);
  };

  const appendSnippetToActive = (snippet: string) => {
    if (
      !activeBlock ||
      activeBlock.type === 'divider' ||
      activeBlock.type === 'pagebreak' ||
      ADVANCED_TYPES.has(activeBlock.type) ||
      MEDIA_TYPES.has(activeBlock.type)
    ) {
      return;
    }
    const sep =
      activeBlock.text.length === 0 || activeBlock.text.endsWith(' ')
        ? ''
        : ' ';
    updateBlockPatch(
      activeBlock.id,
      { text: `${activeBlock.text}${sep}${snippet}` },
      true
    );
  };

  const cycleAlignment = () => {
    if (!activeBlock) return;
    const order: TextAlignMode[] = ['left', 'center', 'right', 'justify'];
    const cur = activeBlock.align ?? 'left';
    const next = order[(order.indexOf(cur) + 1) % order.length];
    updateBlockPatch(activeBlock.id, { align: next }, true);
  };

  const changeIndent = (delta: number) => {
    if (!activeBlock) return;
    const nextIndent = Math.max(0, Math.min(4, (activeBlock.indent ?? 0) + delta));
    updateBlockPatch(activeBlock.id, { indent: nextIndent }, true);
  };

  const clearFormattingOnActive = () => {
    if (!activeBlock) return;
    updateBlockPatch(
      activeBlock.id,
      {
        text: stripInlineFormatting(activeBlock.text),
        color: 'default',
        align: 'left',
        indent: 0,
      },
      true
    );
  };

  const handleRunButtonAction = async (block: EditorBlock) => {
    const action = block.buttonAction ?? 'todo';
    if (action === 'todo') {
      const idx = blocks.findIndex((b) => b.id === block.id);
      const newTodo = createBlock('todo', block.text || 'Nova tarefa');
      const next = [...blocks];
      next.splice(idx + 1, 0, newTodo);
      commitBlocks(next);
      return;
    }
    if (action === 'note') {
      const target = (block.url ?? '').trim();
      if (target) onPressInternalLink(target);
      return;
    }
    const rawUrl = (block.url ?? '').trim();
    if (!rawUrl) return;
    const normalized = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    try {
      await Linking.openURL(normalized);
    } catch {
      Alert.alert('Erro', 'Link inválido.');
    }
  };

  const handleReplaceAll = () => {
    const q = findQuery;
    if (!q) return;
    let count = 0;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');

    const next = blocks.map((b) => {
      let updatedText = b.text;
      if (regex.test(b.text)) {
        count += (b.text.match(regex) ?? []).length;
        updatedText = b.text.replace(regex, replaceQuery);
      }
      return { ...b, text: updatedText };
    });

    if (count > 0) {
      commitBlocks(next, true);
      Alert.alert('Substituído!', `${count} ocorrência(s) atualizada(s).`);
    } else {
      Alert.alert('Nada encontrado', `Nenhuma ocorrência de "${q}".`);
    }
  };

  const runTool = (toolId: ToolbarToolId) => {
    const now = new Date();
    switch (toolId) {
      case 'add_block':
        setInsertMode('add');
        setBlockSearch('');
        setInsertModalVisible(true);
        break;
      case 'convert_type':
        setInsertMode('convert');
        setBlockSearch('');
        setInsertModalVisible(true);
        break;
      case 'undo':
        handleUndo();
        break;
      case 'redo':
        handleRedo();
        break;
      case 'link':
        setLinkSearch('');
        setLinkPickerVisible(true);
        break;
      case 'tag':
        appendSnippetToActive('#tag');
        break;
      case 'bold':
        appendSnippetToActive('**negrito**');
        break;
      case 'italic':
        appendSnippetToActive('*itálico*');
        break;
      case 'underline':
        appendSnippetToActive('__sublinhado__');
        break;
      case 'strike':
        appendSnippetToActive('~~tachado~~');
        break;
      case 'highlight':
        appendSnippetToActive('==destaque==');
        break;
      case 'inline_code':
        appendSnippetToActive('`código`');
        break;
      case 'sup':
        appendSnippetToActive('^2^');
        break;
      case 'sub':
        appendSnippetToActive('~2~');
        break;
      case 'clear_fmt':
        clearFormattingOnActive();
        break;
      case 'color':
        setColorModalVisible(true);
        break;
      case 'align':
        cycleAlignment();
        break;
      case 'indent_inc':
        changeIndent(1);
        break;
      case 'indent_dec':
        changeIndent(-1);
        break;
      case 'date': {
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        appendSnippetToActive(`${dd}/${mm}/${now.getFullYear()}`);
        break;
      }
      case 'time': {
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        appendSnippetToActive(`${hh}:${min}`);
        break;
      }
      case 'find_replace':
        setFindModalVisible(true);
        break;
      case 'move_up':
        moveActiveBlock('up');
        break;
      case 'move_down':
        moveActiveBlock('down');
        break;
      case 'duplicate':
        duplicateActiveBlock();
        break;
      case 'delete':
        deleteActiveBlock();
        break;
    }
  };

  const filteredCategories = useMemo(() => {
    const q = blockSearch.trim().toLowerCase();
    if (!q) return BLOCK_CATEGORIES;
    return BLOCK_CATEGORIES.map((cat) => ({
      title: cat.title,
      items: cat.items.filter(
        (i) =>
          i.label.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [blockSearch]);

  const filteredNoteTitles = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    if (!q) return availableNoteTitles;
    return availableNoteTitles.filter((t) => t.toLowerCase().includes(q));
  }, [availableNoteTitles, linkSearch]);

  const stats = useMemo(() => {
    const fullText = blocks
      .map((b) => {
        if (b.type === 'table' && b.tableData) {
          return b.tableData.map((r) => r.join(' ')).join(' ');
        }
        return b.toggleBody ? `${b.text} ${b.toggleBody}` : b.text;
      })
      .join(' ')
      .trim();
    const chars = fullText.length;
    const words = fullText ? fullText.split(/\s+/).length : 0;
    return { words, chars };
  }, [blocks]);

  const baseFontSize =
    prefs.fontSize === 'small' ? 13 : prefs.fontSize === 'large' ? 17 : 15;
  const lineMult =
    prefs.lineHeight === 'compact'
      ? 1.25
      : prefs.lineHeight === 'wide'
      ? 1.75
      : 1.48;
  const baseLineHeight = Math.round(baseFontSize * lineMult);
  const customFontFamily =
    prefs.fontFamily === 'serif'
      ? 'serif'
      : prefs.fontFamily === 'mono'
      ? 'monospace'
      : undefined;

  let listCounter = 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.editorTopBar}>
        <View
          style={[
            styles.topLeftGroup,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.modePill,
              !isPreviewMode && { backgroundColor: theme.accent },
            ]}
            onPress={() => setIsPreviewMode(false)}
          >
            <Text
              style={[
                styles.modePillText,
                { color: !isPreviewMode ? '#FFF' : theme.textDim },
              ]}
            >
              ✏️ Blocos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modePill,
              isPreviewMode && { backgroundColor: theme.accent },
            ]}
            onPress={() => setIsPreviewMode(true)}
          >
            <Text
              style={[
                styles.modePillText,
                { color: isPreviewMode ? '#FFF' : theme.textDim },
              ]}
            >
              👁 Leitura
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topRightGroup}>
          <Text style={[styles.statsText, { color: theme.textDim }]}>
            {stats.words}p • {stats.chars}c
          </Text>
          <TouchableOpacity
            style={[styles.iconMiniBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => setAppearanceVisible(true)}
          >
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
              Aa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.iconMiniBtn,
              {
                backgroundColor: isZenMode ? theme.accent : theme.surfaceAlt,
              },
            ]}
            onPress={onToggleZenMode}
          >
            <Text style={{ fontSize: 12 }}>{isZenMode ? '⤢' : '🧘'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconMiniBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={() => setToolbarConfigVisible(true)}
          >
            <Text style={{ fontSize: 12 }}>🔧</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.blocksContainer,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {blocks.map((block) => {
          if (block.type === 'numbered' || block.type === 'steps') {
            listCounter += 1;
          } else {
            listCounter = 0;
          }
          const currentNumber = listCounter;
          const isFocused = !isPreviewMode && activeBlock?.id === block.id;
          const colorInfo =
            COLOR_PALETTE.find((c) => c.key === (block.color ?? 'default')) ??
            COLOR_PALETTE[0];
          const blockTextColor = theme.isDark
            ? colorInfo.textHexDark
            : colorInfo.textHexLight;
          const indentPad = (block.indent ?? 0) * 18;
          const alignStyle = {
            textAlign:
              block.align === 'justify' && Platform.OS === 'ios'
                ? ('justify' as const)
                : ((block.align === 'justify' ? 'left' : block.align ?? 'left') as
                    | 'left'
                    | 'center'
                    | 'right'),
          };

          if (MEDIA_TYPES.has(block.type)) {
            return (
              <View key={block.id} style={{ paddingLeft: indentPad }}>
                <MediaBlockView
                  block={block}
                  isPreviewMode={isPreviewMode}
                  isFocused={isFocused}
                  theme={theme}
                  onFocus={() => setActiveBlockId(block.id)}
                  onUpdateBlock={updateBlockPatch}
                />
              </View>
            );
          }

          if (ADVANCED_TYPES.has(block.type)) {
            return (
              <View key={block.id} style={{ paddingLeft: indentPad }}>
                <AdvancedBlockView
                  block={block}
                  allBlocks={blocks}
                  isPreviewMode={isPreviewMode}
                  isFocused={isFocused}
                  theme={theme}
                  onFocus={() => setActiveBlockId(block.id)}
                  onFocusTargetBlock={(id) => setActiveBlockId(id)}
                  onUpdateBlock={updateBlockPatch}
                  onRunButtonAction={handleRunButtonAction}
                />
              </View>
            );
          }

          if (block.type === 'divider') {
            return (
              <TouchableOpacity
                key={block.id}
                onPress={() => setActiveBlockId(block.id)}
                style={[
                  styles.dividerBlock,
                  isFocused && { borderWidth: 1, borderColor: theme.accent },
                ]}
              >
                <View
                  style={[styles.dividerLine, { backgroundColor: theme.border }]}
                />
              </TouchableOpacity>
            );
          }

          if (block.type === 'pagebreak') {
            return (
              <TouchableOpacity
                key={block.id}
                onPress={() => setActiveBlockId(block.id)}
                style={[
                  styles.pageBreakBox,
                  { borderColor: theme.border },
                  isFocused && { borderColor: theme.accent },
                ]}
              >
                <Text style={{ color: theme.textDim, fontSize: 10, fontWeight: '700' }}>
                  ─── QUEBRA DE PÁGINA ───
                </Text>
              </TouchableOpacity>
            );
          }

          if (block.type === 'callout') {
            const variant = CALLOUT_STYLES[block.calloutVariant ?? 'info'];
            return (
              <View
                key={block.id}
                style={[
                  styles.calloutBox,
                  {
                    marginLeft: indentPad,
                    backgroundColor: variant.bg,
                    borderLeftColor: variant.border,
                  },
                  isFocused && { borderWidth: 1, borderColor: theme.accent },
                ]}
              >
                <TouchableOpacity
                  onPress={() => cycleCalloutVariant(block.id)}
                  style={{ paddingTop: 2 }}
                >
                  <Text style={{ fontSize: 16 }}>{variant.icon}</Text>
                </TouchableOpacity>
                <View style={styles.flexOne}>
                  {isPreviewMode ? (
                    renderFormattedInline(
                      block.text,
                      blockTextColor,
                      theme,
                      onPressInternalLink,
                      [
                        {
                          fontSize: baseFontSize,
                          lineHeight: baseLineHeight,
                          fontFamily: customFontFamily,
                        },
                        alignStyle,
                      ]
                    )
                  ) : (
                    <TextInput
                      style={[
                        {
                          color: blockTextColor,
                          fontSize: baseFontSize,
                          lineHeight: baseLineHeight,
                          fontFamily: customFontFamily,
                        },
                        alignStyle,
                      ]}
                      value={block.text}
                      onFocus={() => setActiveBlockId(block.id)}
                      onChangeText={(t) => handleTextChange(block.id, t)}
                      multiline
                      placeholder="Aviso (toque no ícone para trocar: Info/Erro/Pergunta)..."
                      placeholderTextColor={theme.textDim}
                    />
                  )}
                </View>
              </View>
            );
          }

          if (
            block.type === 'toggle' ||
            block.type === 'toggle_h1' ||
            block.type === 'toggle_h2'
          ) {
            const titleStyle =
              block.type === 'toggle_h1'
                ? { fontSize: baseFontSize + 7, fontWeight: '800' as const }
                : block.type === 'toggle_h2'
                ? { fontSize: baseFontSize + 3, fontWeight: '700' as const }
                : { fontSize: baseFontSize, fontWeight: '700' as const };

            return (
              <View
                key={block.id}
                style={[
                  styles.toggleBox,
                  {
                    marginLeft: indentPad,
                    borderColor: isFocused ? theme.accent : theme.border,
                    backgroundColor:
                      colorInfo.bgHex !== 'transparent'
                        ? colorInfo.bgHex
                        : theme.bg,
                  },
                ]}
              >
                <View style={styles.toggleHeader}>
                  <TouchableOpacity
                    onPress={() =>
                      updateBlockPatch(block.id, { isOpen: !block.isOpen }, false)
                    }
                    style={{ width: 24, alignItems: 'center' }}
                  >
                    <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '700' }}>
                      {block.isOpen ? '▾' : '▸'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.flexOne}>
                    {isPreviewMode ? (
                      renderFormattedInline(
                        block.text,
                        blockTextColor,
                        theme,
                        onPressInternalLink,
                        titleStyle
                      )
                    ) : (
                      <TextInput
                        style={[titleStyle, { color: blockTextColor }]}
                        value={block.text}
                        onFocus={() => setActiveBlockId(block.id)}
                        onChangeText={(t) => handleTextChange(block.id, t)}
                        placeholder="Título do bloco expansível..."
                        placeholderTextColor={theme.textDim}
                      />
                    )}
                  </View>
                </View>

                {block.isOpen && (
                  <View
                    style={[
                      styles.toggleBodyWrap,
                      { borderTopColor: theme.border },
                    ]}
                  >
                    {isPreviewMode ? (
                      renderFormattedInline(
                        block.toggleBody ?? '',
                        theme.textMuted,
                        theme,
                        onPressInternalLink,
                        { fontSize: baseFontSize - 1, lineHeight: baseLineHeight }
                      )
                    ) : (
                      <TextInput
                        style={{
                          color: theme.textMuted,
                          fontSize: baseFontSize - 1,
                          lineHeight: baseLineHeight,
                          minHeight: 36,
                        }}
                        value={block.toggleBody ?? ''}
                        onFocus={() => setActiveBlockId(block.id)}
                        onChangeText={(t) =>
                          updateBlockPatch(block.id, { toggleBody: t }, false)
                        }
                        multiline
                        placeholder="Conteúdo interno recolhível..."
                        placeholderTextColor={theme.textDim}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          }

          if (
            block.type === 'code' ||
            block.type === 'preformatted' ||
            block.type === 'math'
          ) {
            const badge =
              block.type === 'math'
                ? 'EQUAÇÃO ∑'
                : block.type === 'preformatted'
                ? 'PRÉ-FORMATADO'
                : 'CÓDIGO';
            const codeColor = block.type === 'math' ? '#D8B4FE' : '#38BDF8';
            return (
              <View
                key={block.id}
                style={[
                  styles.codeBlock,
                  {
                    marginLeft: indentPad,
                    backgroundColor: theme.isDark ? '#020617' : '#0F172A',
                    borderColor: isFocused ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text style={[styles.codeBadge, { color: '#94A3B8' }]}>
                  {badge}
                </Text>
                {isPreviewMode ? (
                  <Text
                    style={{
                      color: codeColor,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                  >
                    {block.text || ' '}
                  </Text>
                ) : (
                  <TextInput
                    style={{
                      color: codeColor,
                      fontFamily: 'monospace',
                      fontSize: 13,
                      lineHeight: 19,
                    }}
                    value={block.text}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeText={(t) => handleTextChange(block.id, t)}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={
                      block.type === 'math'
                        ? 'Ex: E = m * c^2 ou ∑(x_i)'
                        : '// Digite aqui...'
                    }
                    placeholderTextColor="#475569"
                  />
                )}
              </View>
            );
          }

          if (block.type === 'definition') {
            return (
              <View
                key={block.id}
                style={[
                  styles.defBox,
                  {
                    marginLeft: indentPad,
                    backgroundColor: theme.bg,
                    borderColor: isFocused ? theme.accent : theme.border,
                  },
                ]}
              >
                {isPreviewMode ? (
                  <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 13 }}>
                    {block.defTerm || 'Termo'}:
                  </Text>
                ) : (
                  <TextInput
                    style={{ color: theme.accent, fontWeight: '800', fontSize: 13 }}
                    value={block.defTerm ?? ''}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeText={(t) =>
                      updateBlockPatch(block.id, { defTerm: t }, false)
                    }
                    placeholder="Termo..."
                    placeholderTextColor={theme.textDim}
                  />
                )}
                {isPreviewMode ? (
                  renderFormattedInline(
                    block.text,
                    blockTextColor,
                    theme,
                    onPressInternalLink,
                    { fontSize: baseFontSize - 1, lineHeight: baseLineHeight }
                  )
                ) : (
                  <TextInput
                    style={{
                      color: blockTextColor,
                      fontSize: baseFontSize - 1,
                      lineHeight: baseLineHeight,
                    }}
                    value={block.text}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeText={(t) => handleTextChange(block.id, t)}
                    multiline
                    placeholder="Definição ou explicação..."
                    placeholderTextColor={theme.textDim}
                  />
                )}
              </View>
            );
          }

          const textStyleByType = (() => {
            switch (block.type) {
              case 'h1':
                return { fontSize: baseFontSize + 9, fontWeight: '800' as const, lineHeight: baseLineHeight + 8 };
              case 'h2':
                return { fontSize: baseFontSize + 5, fontWeight: '700' as const, lineHeight: baseLineHeight + 5 };
              case 'h3':
                return { fontSize: baseFontSize + 3, fontWeight: '700' as const, lineHeight: baseLineHeight + 3 };
              case 'h4':
                return { fontSize: baseFontSize + 1, fontWeight: '700' as const, lineHeight: baseLineHeight + 1 };
              case 'h5':
                return { fontSize: baseFontSize, fontWeight: '700' as const, lineHeight: baseLineHeight };
              case 'h6':
                return { fontSize: baseFontSize - 1, fontWeight: '700' as const, lineHeight: baseLineHeight };
              case 'subtitle':
                return { fontSize: baseFontSize + 1, fontStyle: 'italic' as const, lineHeight: baseLineHeight };
              case 'caption':
                return { fontSize: baseFontSize - 2, fontStyle: 'italic' as const, lineHeight: baseLineHeight - 2 };
              case 'small':
                return { fontSize: baseFontSize - 3, lineHeight: baseLineHeight - 3 };
              case 'footnote':
                return { fontSize: baseFontSize - 2, lineHeight: baseLineHeight - 2 };
              case 'todo':
                return {
                  fontSize: baseFontSize,
                  lineHeight: baseLineHeight,
                  textDecorationLine: block.checked
                    ? ('line-through' as const)
                    : ('none' as const),
                };
              default:
                return { fontSize: baseFontSize, lineHeight: baseLineHeight };
            }
          })();

          const resolvedColor =
            block.type === 'todo' && block.checked
              ? theme.textDim
              : block.type === 'caption' ||
                block.type === 'subtitle' ||
                block.type === 'footnote'
              ? theme.textDim
              : blockTextColor;

          return (
            <View
              key={block.id}
              style={[
                styles.blockRow,
                { marginLeft: indentPad },
                block.type === 'quote' && {
                  borderLeftWidth: 3,
                  borderLeftColor: theme.accent,
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  paddingLeft: 10,
                  paddingVertical: 6,
                },
                colorInfo.bgHex !== 'transparent' && {
                  backgroundColor: colorInfo.bgHex,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                },
                isFocused && { borderWidth: 1, borderColor: theme.accent },
              ]}
            >
              {block.type === 'bullet' && (
                <Text style={[styles.bulletMarker, { color: theme.accent }]}>•</Text>
              )}

              {block.type === 'numbered' && (
                <Text style={[styles.numberedMarker, { color: theme.accent }]}>
                  {currentNumber}.
                </Text>
              )}

              {block.type === 'steps' && (
                <View
                  style={[styles.stepBadge, { backgroundColor: theme.accent }]}
                >
                  <Text style={styles.stepBadgeText}>P{currentNumber}</Text>
                </View>
              )}

              {block.type === 'footnote' && (
                <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '700', marginRight: 6 }}>
                  [1]
                </Text>
              )}

              {block.type === 'todo' && (
                <TouchableOpacity
                  onPress={() =>
                    updateBlockPatch(block.id, { checked: !block.checked }, true)
                  }
                  style={styles.checkboxBtn}
                >
                  <Text
                    style={[
                      styles.checkboxIcon,
                      { color: block.checked ? '#34D399' : theme.textDim },
                    ]}
                  >
                    {block.checked ? '☑' : '☐'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.flexOne}>
                {isPreviewMode ? (
                  renderFormattedInline(
                    block.text,
                    resolvedColor,
                    theme,
                    onPressInternalLink,
                    [textStyleByType, { fontFamily: customFontFamily }, alignStyle]
                  )
                ) : (
                  <TextInput
                    style={[
                      styles.baseInput,
                      textStyleByType,
                      { color: resolvedColor, fontFamily: customFontFamily },
                      alignStyle,
                    ]}
                    value={block.text}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeText={(t) => handleTextChange(block.id, t)}
                    multiline
                    placeholder={
                      block.type === 'paragraph'
                        ? 'Escreva ou use #, -, [], >, $$, --- ...'
                        : `Escrever ${block.type}...`
                    }
                    placeholderTextColor={theme.textDim}
                  />
                )}
              </View>
            </View>
          );
        })}

        {!isPreviewMode && (
          <TouchableOpacity
            style={[styles.addBlockBottomBtn, { borderColor: theme.border }]}
            onPress={() => {
              setInsertMode('add');
              setBlockSearch('');
              setInsertModalVisible(true);
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>
              + Inserir bloco (39 tipos disponíveis)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!isPreviewMode && (
        <View
          style={[
            styles.toolbarCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarRow}
          >
            {toolbarIds.map((toolId) => {
              const def = ALL_TOOLBAR_TOOLS.find((t) => t.id === toolId);
              if (!def) return null;
              const isPrimary = toolId === 'add_block';
              const isDanger = toolId === 'delete';
              return (
                <TouchableOpacity
                  key={toolId}
                  style={[
                    styles.toolBtn,
                    { backgroundColor: theme.surfaceAlt },
                    isPrimary && { backgroundColor: theme.accent },
                    isDanger && { backgroundColor: '#450A0A' },
                  ]}
                  onPress={() => runTool(toolId)}
                >
                  <Text
                    style={[
                      styles.toolBtnText,
                      { color: theme.text },
                      isPrimary && { color: '#FFF', fontWeight: '800' },
                      isDanger && { color: '#FCA5A5' },
                    ]}
                  >
                    {isPrimary ? '+ Bloco' : def.icon}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Modal
        visible={insertModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsertModalVisible(false)}
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
              {insertMode === 'add'
                ? '➕ Inserir Bloco'
                : '⇄ Converter Bloco Atual'}
            </Text>
            <TextInput
              style={[
                styles.searchModalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={blockSearch}
              onChangeText={setBlockSearch}
              placeholder="Buscar (imagem, vídeo, áudio, pdf, kanban...)..."
              placeholderTextColor={theme.textDim}
            />

            <ScrollView>
              {filteredCategories.map((cat) => (
                <View key={cat.title} style={{ marginBottom: 14 }}>
                  <Text style={[styles.catHeading, { color: theme.textDim }]}>
                    {cat.title.toUpperCase()}
                  </Text>
                  <View style={styles.blockGrid}>
                    {cat.items.map((opt) => (
                      <TouchableOpacity
                        key={opt.type}
                        style={[
                          styles.blockOptionCard,
                          { backgroundColor: theme.surfaceAlt },
                        ]}
                        onPress={() =>
                          insertMode === 'add'
                            ? insertBlockAfterActive(opt.type)
                            : convertActiveBlockType(opt.type)
                        }
                      >
                        <Text
                          style={[
                            styles.blockOptionIcon,
                            { color: theme.accent },
                          ]}
                        >
                          {opt.icon}
                        </Text>
                        <View style={styles.flexOne}>
                          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                            {opt.label}
                          </Text>
                          <Text style={{ color: theme.textDim, fontSize: 11 }}>
                            {opt.hint}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setInsertModalVisible(false)}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                Fechar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={colorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setColorModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Cor e Destaque do Bloco
            </Text>
            {COLOR_PALETTE.map((c) => {
              const txt = theme.isDark ? c.textHexDark : c.textHexLight;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[
                    styles.colorRow,
                    {
                      backgroundColor:
                        c.bgHex === 'transparent' ? theme.surfaceAlt : c.bgHex,
                    },
                  ]}
                  onPress={() => {
                    if (activeBlock) {
                      updateBlockPatch(activeBlock.id, { color: c.key }, true);
                    }
                    setColorModalVisible(false);
                  }}
                >
                  <View style={[styles.colorDot, { backgroundColor: txt }]} />
                  <Text style={{ color: txt, fontSize: 14, fontWeight: '700' }}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setColorModalVisible(false)}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={linkPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLinkPickerVisible(false)}
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
              Conectar Nota [[...]]
            </Text>
            <TextInput
              style={[
                styles.searchModalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={linkSearch}
              onChangeText={setLinkSearch}
              placeholder="Buscar ou criar nome de nota..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <ScrollView>
              {linkSearch.trim().length > 0 &&
                !availableNoteTitles.some(
                  (t) => t.toLowerCase() === linkSearch.trim().toLowerCase()
                ) && (
                  <TouchableOpacity
                    style={[
                      styles.linkPickerItem,
                      { backgroundColor: '#0C4A6E' },
                    ]}
                    onPress={() => {
                      appendSnippetToActive(`[[${linkSearch.trim()}]]`);
                      setLinkPickerVisible(false);
                    }}
                  >
                    <Text style={{ color: '#7DD3FC', fontSize: 14, fontWeight: '700' }}>
                      ➕ Criar link [[{linkSearch.trim()}]]
                    </Text>
                  </TouchableOpacity>
                )}
              {filteredNoteTitles.map((title) => (
                <TouchableOpacity
                  key={title}
                  style={[
                    styles.linkPickerItem,
                    { backgroundColor: theme.surfaceAlt },
                  ]}
                  onPress={() => {
                    appendSnippetToActive(`[[${title}]]`);
                    setLinkPickerVisible(false);
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                    🔗 {title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setLinkPickerVisible(false)}
            >
              <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={appearanceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppearanceVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Aa Aparência do Texto
            </Text>

            <Text style={[styles.catHeading, { color: theme.textDim }]}>
              TIPO DE FONTE
            </Text>
            <View style={styles.prefRow}>
              {(
                [
                  { k: 'default', l: 'Padrão' },
                  { k: 'serif', l: 'Serifa' },
                  { k: 'mono', l: 'Mono' },
                ] as const
              ).map((f) => (
                <TouchableOpacity
                  key={f.k}
                  style={[
                    styles.prefBtn,
                    {
                      backgroundColor:
                        prefs.fontFamily === f.k
                          ? theme.accent
                          : theme.surfaceAlt,
                    },
                  ]}
                  onPress={() => onChangePrefs({ ...prefs, fontFamily: f.k })}
                >
                  <Text
                    style={{
                      color: prefs.fontFamily === f.k ? '#FFF' : theme.text,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {f.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.catHeading, { color: theme.textDim }]}>
              TAMANHO DA FONTE
            </Text>
            <View style={styles.prefRow}>
              {(
                [
                  { k: 'small', l: 'Pequena' },
                  { k: 'normal', l: 'Normal' },
                  { k: 'large', l: 'Grande' },
                ] as const
              ).map((s) => (
                <TouchableOpacity
                  key={s.k}
                  style={[
                    styles.prefBtn,
                    {
                      backgroundColor:
                        prefs.fontSize === s.k ? theme.accent : theme.surfaceAlt,
                    },
                  ]}
                  onPress={() => onChangePrefs({ ...prefs, fontSize: s.k })}
                >
                  <Text
                    style={{
                      color: prefs.fontSize === s.k ? '#FFF' : theme.text,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {s.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.catHeading, { color: theme.textDim }]}>
              ESPAÇAMENTO ENTRE LINHAS
            </Text>
            <View style={styles.prefRow}>
              {(
                [
                  { k: 'compact', l: 'Compacto' },
                  { k: 'normal', l: 'Normal' },
                  { k: 'wide', l: 'Amplo' },
                ] as const
              ).map((lh) => (
                <TouchableOpacity
                  key={lh.k}
                  style={[
                    styles.prefBtn,
                    {
                      backgroundColor:
                        prefs.lineHeight === lh.k
                          ? theme.accent
                          : theme.surfaceAlt,
                    },
                  ]}
                  onPress={() => onChangePrefs({ ...prefs, lineHeight: lh.k })}
                >
                  <Text
                    style={{
                      color: prefs.lineHeight === lh.k ? '#FFF' : theme.text,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {lh.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setAppearanceVisible(false)}
            >
              <Text style={{ color: theme.accent, fontWeight: '700' }}>
                Concluir
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={toolbarConfigVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setToolbarConfigVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                maxHeight: '82%',
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              🔧 Configurar Barra Móvel
            </Text>
            <ScrollView>
              {ALL_TOOLBAR_TOOLS.map((tool) => {
                const idx = toolbarIds.indexOf(tool.id);
                const enabled = idx !== -1;

                const toggleTool = () => {
                  if (enabled) {
                    if (toolbarIds.length <= 2) return;
                    onChangeToolbar(toolbarIds.filter((id) => id !== tool.id));
                  } else {
                    onChangeToolbar([...toolbarIds, tool.id]);
                  }
                };

                const moveTool = (dir: -1 | 1) => {
                  if (!enabled) return;
                  const target = idx + dir;
                  if (target < 0 || target >= toolbarIds.length) return;
                  const next = [...toolbarIds];
                  const [item] = next.splice(idx, 1);
                  next.splice(target, 0, item);
                  onChangeToolbar(next);
                };

                return (
                  <View
                    key={tool.id}
                    style={[
                      styles.cfgRow,
                      { backgroundColor: theme.surfaceAlt },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={toggleTool}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                    >
                      <Text style={{ fontSize: 16, color: enabled ? '#34D399' : theme.textDim }}>
                        {enabled ? '☑' : '☐'}
                      </Text>
                      <Text style={{ color: theme.accent, fontWeight: '800', width: 32, textAlign: 'center' }}>
                        {tool.icon}
                      </Text>
                      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600', flex: 1 }}>
                        {tool.label}
                      </Text>
                    </TouchableOpacity>

                    {enabled && (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => moveTool(-1)}
                          style={{ paddingHorizontal: 6 }}
                        >
                          <Text style={{ color: theme.textMuted, fontWeight: '700' }}>
                            ↑
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => moveTool(1)}
                          style={{ paddingHorizontal: 6 }}
                        >
                          <Text style={{ color: theme.textMuted, fontWeight: '700' }}>
                            ↓
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setToolbarConfigVisible(false)}
            >
              <Text style={{ color: theme.accent, fontWeight: '700' }}>
                Salvar Barra
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={findModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFindModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              🔍 Localizar e Substituir
            </Text>
            <TextInput
              style={[
                styles.searchModalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={findQuery}
              onChangeText={setFindQuery}
              placeholder="Localizar palavra..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <TextInput
              style={[
                styles.searchModalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={replaceQuery}
              onChangeText={setReplaceQuery}
              placeholder="Substituir por..."
              placeholderTextColor={theme.textDim}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setFindModalVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Fechar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReplaceAll}
                style={{
                  backgroundColor: theme.accent,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>
                  Substituir Tudo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  flexOne: {
    flex: 1,
  },
  editorTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  topLeftGroup: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    gap: 4,
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  modePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  topRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statsText: {
    fontSize: 11,
  },
  iconMiniBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  blocksContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  baseInput: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    textAlignVertical: 'top',
  },
  bulletMarker: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
    lineHeight: 22,
  },
  numberedMarker: {
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
    lineHeight: 22,
    minWidth: 18,
  },
  stepBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
    marginTop: 2,
  },
  stepBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  checkboxBtn: {
    marginRight: 8,
    paddingTop: 1,
  },
  checkboxIcon: {
    fontSize: 18,
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  toggleBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleBodyWrap: {
    marginTop: 6,
    paddingLeft: 24,
    borderTopWidth: 0.5,
    paddingTop: 6,
  },
  codeBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  codeBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 1,
  },
  defBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 2,
  },
  dividerBlock: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  dividerLine: {
    height: 1.5,
  },
  pageBreakBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  addBlockBottomBtn: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  toolbarCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inlineLink: {
    color: '#38BDF8',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  previewEmpty: {
    height: 12,
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
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  searchModalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 10,
  },
  catHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  blockGrid: {
    gap: 6,
  },
  blockOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  blockOptionIcon: {
    fontSize: 15,
    fontWeight: '800',
    width: 34,
    textAlign: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 10,
    marginBottom: 7,
    gap: 10,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  linkPickerItem: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 9,
    marginBottom: 7,
  },
  prefRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  prefBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  cfgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
});
