import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BLOCK_TYPE_OPTIONS,
  BlockColor,
  BlockType,
  COLOR_PALETTE,
  CalloutVariant,
  EditorBlock,
  createBlock,
  detectMarkdownShortcut,
  parseContentToBlocks,
  serializeBlocks,
} from '../editor/blocks';

interface BlockEditorProps {
  noteId: string;
  rawContent: string;
  onChangeSerialized: (serialized: string) => void;
  onPressInternalLink: (title: string) => void;
}

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { icon: string; bg: string; border: string; label: string }
> = {
  info: {
    icon: 'ℹ️',
    bg: 'rgba(14, 165, 233, 0.12)',
    border: '#0284C7',
    label: 'Info',
  },
  success: {
    icon: '✅',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: '#059669',
    label: 'Sucesso',
  },
  warning: {
    icon: '⚠️',
    bg: 'rgba(245, 158, 11, 0.12)',
    border: '#D97706',
    label: 'Alerta',
  },
  error: {
    icon: '❌',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: '#E11D48',
    label: 'Erro',
  },
};

function renderFormattedInline(
  text: string,
  baseColor: string,
  onPressLink: (title: string) => void,
  extraStyle?: object
) {
  if (!text) {
    return <Text style={[styles.previewEmpty, extraStyle]}> </Text>;
  }

  const tokenRegex =
    /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|__[^_]+__|`[^`]+`|#[a-zA-Z0-9_À-ÿ]+)/g;
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
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <Text key={`b-${keyIdx++}`} style={styles.inlineBold}>
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('__') && token.endsWith('__')) {
      parts.push(
        <Text key={`u-${keyIdx++}`} style={styles.inlineUnderline}>
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <Text key={`i-${keyIdx++}`} style={styles.inlineItalic}>
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith('~~') && token.endsWith('~~')) {
      parts.push(
        <Text key={`s-${keyIdx++}`} style={styles.inlineStrike}>
          {token.slice(2, -2)}
        </Text>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <Text key={`c-${keyIdx++}`} style={styles.inlineCode}>
          {token.slice(1, -1)}
        </Text>
      );
    } else if (token.startsWith('#')) {
      parts.push(
        <Text key={`tag-${keyIdx++}`} style={styles.inlineTag}>
          {token}
        </Text>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(<Text key={`end-${keyIdx++}`}>{text.slice(lastIndex)}</Text>);
  }

  return (
    <Text style={[{ color: baseColor }, extraStyle]}>{parts}</Text>
  );
}

export default function BlockEditor({
  noteId,
  rawContent,
  onChangeSerialized,
  onPressInternalLink,
}: BlockEditorProps) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    parseContentToBlocks(rawContent)
  );
  const [undoStack, setUndoStack] = useState<EditorBlock[][]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Modais do editor
  const [insertModalVisible, setInsertModalVisible] = useState(false);
  const [insertMode, setInsertMode] = useState<'add' | 'convert'>('add');
  const [colorModalVisible, setColorModalVisible] = useState(false);

  // Reinicia estado apenas quando troca de página
  useEffect(() => {
    const parsed = parseContentToBlocks(rawContent);
    setBlocks(parsed);
    setUndoStack([]);
    setActiveBlockId(parsed[0]?.id ?? null);
    setIsPreviewMode(false);
  }, [noteId]);

  const commitBlocks = (nextBlocks: EditorBlock[], pushHistory = true) => {
    const safeBlocks =
      nextBlocks.length > 0 ? nextBlocks : [createBlock('paragraph', '')];
    if (pushHistory) {
      setUndoStack((prev) => [...prev.slice(-24), blocks]);
    }
    setBlocks(safeBlocks);
    onChangeSerialized(serializeBlocks(safeBlocks));
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setBlocks(previous);
    onChangeSerialized(serializeBlocks(previous));
  };

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) ?? blocks[0] ?? null,
    [blocks, activeBlockId]
  );

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
            shortcut.type === 'callout' ? ('info' as CalloutVariant) : b.calloutVariant,
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

  const handleToggleBodyChange = (blockId: string, bodyText: string) => {
    const updated = blocks.map((b) =>
      b.id === blockId ? { ...b, toggleBody: bodyText } : b
    );
    commitBlocks(updated, false);
  };

  const toggleTodoChecked = (blockId: string) => {
    const updated = blocks.map((b) =>
      b.id === blockId ? { ...b, checked: !b.checked } : b
    );
    commitBlocks(updated);
  };

  const toggleCollapsibleOpen = (blockId: string) => {
    const updated = blocks.map((b) =>
      b.id === blockId ? { ...b, isOpen: !b.isOpen } : b
    );
    commitBlocks(updated, false);
  };

  const cycleCalloutVariant = (blockId: string) => {
    const order: CalloutVariant[] = ['info', 'success', 'warning', 'error'];
    const updated = blocks.map((b) => {
      if (b.id !== blockId) return b;
      const cur = b.calloutVariant ?? 'info';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      return { ...b, calloutVariant: next };
    });
    commitBlocks(updated);
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
    const updated = blocks.map((b) =>
      b.id === activeBlock.id
        ? {
            ...b,
            type,
            checked: type === 'todo' ? b.checked ?? false : undefined,
            calloutVariant:
              type === 'callout' ? b.calloutVariant ?? 'info' : undefined,
            toggleBody: type === 'toggle' ? b.toggleBody ?? '' : undefined,
            isOpen: type === 'toggle' ? b.isOpen ?? true : undefined,
          }
        : b
    );
    commitBlocks(updated);
    setInsertModalVisible(false);
  };

  const setActiveBlockColor = (color: BlockColor) => {
    if (!activeBlock) return;
    const updated = blocks.map((b) =>
      b.id === activeBlock.id ? { ...b, color } : b
    );
    commitBlocks(updated);
    setColorModalVisible(false);
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
    const clone = createBlock(activeBlock.type, activeBlock.text, {
      checked: activeBlock.checked,
      color: activeBlock.color,
      calloutVariant: activeBlock.calloutVariant,
      toggleBody: activeBlock.toggleBody,
      isOpen: activeBlock.isOpen,
    });
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
    if (!activeBlock || activeBlock.type === 'divider') return;
    const sep =
      activeBlock.text.length === 0 || activeBlock.text.endsWith(' ')
        ? ''
        : ' ';
    const updated = blocks.map((b) =>
      b.id === activeBlock.id ? { ...b, text: `${b.text}${sep}${snippet}` } : b
    );
    commitBlocks(updated);
  };

  const stats = useMemo(() => {
    const fullText = blocks
      .map((b) => (b.toggleBody ? `${b.text} ${b.toggleBody}` : b.text))
      .join(' ')
      .trim();
    const chars = fullText.length;
    const words = fullText ? fullText.split(/\s+/).length : 0;
    return { words, chars };
  }, [blocks]);

  let numberedCounter = 0;

  return (
    <View style={styles.wrapper}>
      {/* Barra superior do editor */}
      <View style={styles.editorTopBar}>
        <View style={styles.topLeftGroup}>
          <TouchableOpacity
            style={[
              styles.modePill,
              !isPreviewMode && styles.modePillActive,
            ]}
            onPress={() => setIsPreviewMode(false)}
          >
            <Text
              style={[
                styles.modePillText,
                !isPreviewMode && styles.modePillTextActive,
              ]}
            >
              ✏️ Blocos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modePill,
              isPreviewMode && styles.modePillActive,
            ]}
            onPress={() => setIsPreviewMode(true)}
          >
            <Text
              style={[
                styles.modePillText,
                isPreviewMode && styles.modePillTextActive,
              ]}
            >
              👁 Leitura
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topRightGroup}>
          <Text style={styles.statsText}>
            {stats.words} pal • {stats.chars} car
          </Text>
          {!isPreviewMode && (
            <TouchableOpacity
              onPress={handleUndo}
              disabled={undoStack.length === 0}
              style={[
                styles.undoBtn,
                undoStack.length === 0 && styles.undoBtnDisabled,
              ]}
            >
              <Text style={styles.undoBtnText}>↶</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista de Blocos */}
      <View style={styles.blocksContainer}>
        {blocks.map((block) => {
          if (block.type === 'numbered') {
            numberedCounter += 1;
          } else {
            numberedCounter = 0;
          }
          const currentNumber = numberedCounter;
          const isFocused = !isPreviewMode && activeBlock?.id === block.id;
          const colorInfo =
            COLOR_PALETTE.find((c) => c.key === (block.color ?? 'default')) ??
            COLOR_PALETTE[0];

          if (block.type === 'divider') {
            return (
              <TouchableOpacity
                key={block.id}
                onPress={() => setActiveBlockId(block.id)}
                style={[
                  styles.dividerBlock,
                  isFocused && styles.blockFocusedBorder,
                ]}
              >
                <View style={styles.dividerLine} />
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
                    backgroundColor: variant.bg,
                    borderLeftColor: variant.border,
                  },
                  isFocused && styles.blockFocusedBorder,
                ]}
              >
                <TouchableOpacity
                  onPress={() => cycleCalloutVariant(block.id)}
                  style={styles.calloutIconBtn}
                >
                  <Text style={styles.calloutIcon}>{variant.icon}</Text>
                </TouchableOpacity>
                <View style={styles.flexOne}>
                  {isPreviewMode ? (
                    renderFormattedInline(
                      block.text,
                      colorInfo.textHex,
                      onPressInternalLink,
                      styles.paragraphText
                    )
                  ) : (
                    <TextInput
                      style={[styles.paragraphInput, { color: colorInfo.textHex }]}
                      value={block.text}
                      onFocus={() => setActiveBlockId(block.id)}
                      onChangeText={(t) => handleTextChange(block.id, t)}
                      multiline
                      placeholder="Bloco de aviso (toque no ícone para mudar o tipo)..."
                      placeholderTextColor="#64748B"
                    />
                  )}
                </View>
              </View>
            );
          }

          if (block.type === 'toggle') {
            return (
              <View
                key={block.id}
                style={[
                  styles.toggleBox,
                  { backgroundColor: colorInfo.bgHex !== 'transparent' ? colorInfo.bgHex : '#111827' },
                  isFocused && styles.blockFocusedBorder,
                ]}
              >
                <View style={styles.toggleHeader}>
                  <TouchableOpacity
                    onPress={() => toggleCollapsibleOpen(block.id)}
                    style={styles.toggleArrowBtn}
                  >
                    <Text style={styles.toggleArrow}>
                      {block.isOpen ? '▾' : '▸'}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.flexOne}>
                    {isPreviewMode ? (
                      renderFormattedInline(
                        block.text,
                        colorInfo.textHex,
                        onPressInternalLink,
                        styles.toggleTitlePreview
                      )
                    ) : (
                      <TextInput
                        style={[styles.toggleTitleInput, { color: colorInfo.textHex }]}
                        value={block.text}
                        onFocus={() => setActiveBlockId(block.id)}
                        onChangeText={(t) => handleTextChange(block.id, t)}
                        placeholder="Título do bloco expansível..."
                        placeholderTextColor="#64748B"
                      />
                    )}
                  </View>
                </View>

                {block.isOpen && (
                  <View style={styles.toggleBodyWrap}>
                    {isPreviewMode ? (
                      renderFormattedInline(
                        block.toggleBody ?? '',
                        '#94A3B8',
                        onPressInternalLink,
                        styles.paragraphText
                      )
                    ) : (
                      <TextInput
                        style={styles.toggleBodyInput}
                        value={block.toggleBody ?? ''}
                        onFocus={() => setActiveBlockId(block.id)}
                        onChangeText={(t) => handleToggleBodyChange(block.id, t)}
                        multiline
                        placeholder="Conteúdo interno recolhível..."
                        placeholderTextColor="#64748B"
                      />
                    )}
                  </View>
                )}
              </View>
            );
          }

          if (block.type === 'code') {
            return (
              <View
                key={block.id}
                style={[
                  styles.codeBlock,
                  isFocused && styles.blockFocusedBorder,
                ]}
              >
                <Text style={styles.codeBadge}>CODE</Text>
                {isPreviewMode ? (
                  <Text style={styles.codeText}>{block.text || ' '}</Text>
                ) : (
                  <TextInput
                    style={styles.codeInput}
                    value={block.text}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeText={(t) => handleTextChange(block.id, t)}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="// Digite seu código aqui..."
                    placeholderTextColor="#475569"
                  />
                )}
              </View>
            );
          }

          const inputTextStyle =
            block.type === 'h1'
              ? styles.h1Text
              : block.type === 'h2'
              ? styles.h2Text
              : block.type === 'h3'
              ? styles.h3Text
              : block.type === 'todo' && block.checked
              ? styles.todoCheckedText
              : styles.paragraphText;

          return (
            <View
              key={block.id}
              style={[
                styles.blockRow,
                block.type === 'quote' && styles.quoteBlock,
                colorInfo.bgHex !== 'transparent' && {
                  backgroundColor: colorInfo.bgHex,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                },
                isFocused && styles.blockFocusedBorder,
              ]}
            >
              {block.type === 'bullet' && (
                <Text style={styles.bulletMarker}>•</Text>
              )}

              {block.type === 'numbered' && (
                <Text style={styles.numberedMarker}>{currentNumber}.</Text>
              )}

              {block.type === 'todo' && (
                <TouchableOpacity
                  onPress={() => toggleTodoChecked(block.id)}
                  style={styles.checkboxBtn}
                >
                  <Text
                    style={[
                      styles.checkboxIcon,
                      block.checked && styles.checkboxIconChecked,
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
                    block.type === 'todo' && block.checked
                      ? '#64748B'
                      : colorInfo.textHex,
                    onPressInternalLink,
                    inputTextStyle
                  )
                ) : (
                  <TextInput
                    style={[
                      styles.baseInput,
                      inputTextStyle,
                      {
                        color:
                          block.type === 'todo' && block.checked
                            ? '#64748B'
                            : colorInfo.textHex,
                      },
                    ]}
                    value={block.text}
                    onFocus={() => setActiveBlockId(block.id)}
                    onChangeText={(t) => handleTextChange(block.id, t)}
                    multiline
                    placeholder={
                      block.type === 'h1'
                        ? 'Título 1'
                        : block.type === 'h2'
                        ? 'Título 2'
                        : block.type === 'h3'
                        ? 'Título 3'
                        : block.type === 'todo'
                        ? 'Tarefa...'
                        : block.type === 'quote'
                        ? 'Citação...'
                        : 'Escreva algo ou use #, -, [], > ...'
                    }
                    placeholderTextColor="#475569"
                  />
                )}
              </View>
            </View>
          );
        })}

        {!isPreviewMode && (
          <TouchableOpacity
            style={styles.addBlockBottomBtn}
            onPress={() => {
              setInsertMode('add');
              setInsertModalVisible(true);
            }}
          >
            <Text style={styles.addBlockBottomText}>+ Inserir bloco</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Barra de ferramentas de formatação e controle de bloco */}
      {!isPreviewMode && (
        <View style={styles.toolbarCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolbarRow}
          >
            <TouchableOpacity
              style={styles.toolBtnPrimary}
              onPress={() => {
                setInsertMode('add');
                setInsertModalVisible(true);
              }}
            >
              <Text style={styles.toolBtnPrimaryText}>+ Bloco</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => {
                setInsertMode('convert');
                setInsertModalVisible(true);
              }}
            >
              <Text style={styles.toolBtnText}>⇄ Tipo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setColorModalVisible(true)}
            >
              <Text style={styles.toolBtnText}>🎨 Cor</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => appendSnippetToActive('**negrito**')}
            >
              <Text style={[styles.toolBtnText, { fontWeight: '800' }]}>B</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => appendSnippetToActive('*itálico*')}
            >
              <Text style={[styles.toolBtnText, { fontStyle: 'italic' }]}>I</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => appendSnippetToActive('~~tachado~~')}
            >
              <Text
                style={[
                  styles.toolBtnText,
                  { textDecorationLine: 'line-through' },
                ]}
              >
                S
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => appendSnippetToActive('`código`')}
            >
              <Text style={styles.toolBtnText}>{'` `'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => appendSnippetToActive('[[Nota]]')}
            >
              <Text style={[styles.toolBtnText, { color: '#7DD3FC' }]}>
                [[Link]]
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => appendSnippetToActive('#tag')}
            >
              <Text style={[styles.toolBtnText, { color: '#D8B4FE' }]}>
                #tag
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => moveActiveBlock('up')}
            >
              <Text style={styles.toolBtnText}>↑</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => moveActiveBlock('down')}
            >
              <Text style={styles.toolBtnText}>↓</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={duplicateActiveBlock}
            >
              <Text style={styles.toolBtnText}>⎘</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolBtn, styles.toolBtnDanger]}
              onPress={deleteActiveBlock}
            >
              <Text style={styles.toolBtnDangerText}>🗑</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Modal Selecionar / Converter Tipo de Bloco */}
      <Modal
        visible={insertModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInsertModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { maxHeight: '78%' }]}>
            <Text style={styles.modalTitle}>
              {insertMode === 'add'
                ? 'Inserir Novo Bloco'
                : 'Converter Bloco Atual'}
            </Text>
            <ScrollView>
              <View style={styles.blockGrid}>
                {BLOCK_TYPE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.type}
                    style={styles.blockOptionCard}
                    onPress={() =>
                      insertMode === 'add'
                        ? insertBlockAfterActive(opt.type)
                        : convertActiveBlockType(opt.type)
                    }
                  >
                    <Text style={styles.blockOptionIcon}>{opt.icon}</Text>
                    <View style={styles.flexOne}>
                      <Text style={styles.blockOptionLabel}>{opt.label}</Text>
                      <Text style={styles.blockOptionHint}>{opt.hint}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setInsertModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Cor do Bloco */}
      <Modal
        visible={colorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setColorModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Cor do Bloco</Text>
            {COLOR_PALETTE.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.colorRow,
                  {
                    backgroundColor:
                      c.bgHex === 'transparent' ? '#1E293B' : c.bgHex,
                  },
                ]}
                onPress={() => setActiveBlockColor(c.key)}
              >
                <View
                  style={[styles.colorDot, { backgroundColor: c.textHex }]}
                />
                <Text style={[styles.colorLabel, { color: c.textHex }]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setColorModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
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
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 3,
    gap: 4,
  },
  modePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  modePillActive: {
    backgroundColor: '#6366F1',
  },
  modePillText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  modePillTextActive: {
    color: '#FFFFFF',
  },
  topRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsText: {
    color: '#64748B',
    fontSize: 11,
  },
  undoBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  undoBtnDisabled: {
    opacity: 0.4,
  },
  undoBtnText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  blocksContainer: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    gap: 6,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  blockFocusedBorder: {
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.55)',
  },
  baseInput: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    textAlignVertical: 'top',
  },
  paragraphInput: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 2,
  },
  paragraphText: {
    fontSize: 15,
    lineHeight: 22,
  },
  h1Text: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginTop: 4,
  },
  h2Text: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: 2,
  },
  h3Text: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  bulletMarker: {
    color: '#818CF8',
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
    lineHeight: 22,
  },
  numberedMarker: {
    color: '#818CF8',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
    lineHeight: 22,
    minWidth: 18,
  },
  checkboxBtn: {
    marginRight: 8,
    paddingTop: 1,
  },
  checkboxIcon: {
    fontSize: 18,
    color: '#94A3B8',
  },
  checkboxIconChecked: {
    color: '#34D399',
  },
  todoCheckedText: {
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'line-through',
  },
  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: '#818CF8',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    paddingLeft: 10,
    paddingVertical: 6,
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  calloutIconBtn: {
    paddingTop: 2,
  },
  calloutIcon: {
    fontSize: 16,
  },
  toggleBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 8,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleArrowBtn: {
    width: 24,
    alignItems: 'center',
  },
  toggleArrow: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '700',
  },
  toggleTitleInput: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 2,
  },
  toggleTitlePreview: {
    fontSize: 15,
    fontWeight: '700',
  },
  toggleBodyWrap: {
    marginTop: 6,
    paddingLeft: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#1E293B',
    paddingTop: 6,
  },
  toggleBodyInput: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 36,
  },
  codeBlock: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 10,
  },
  codeBadge: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 1,
  },
  codeInput: {
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 19,
  },
  codeText: {
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 19,
  },
  dividerBlock: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  dividerLine: {
    height: 1.5,
    backgroundColor: '#334155',
  },
  addBlockBottomBtn: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBlockBottomText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '600',
  },
  toolbarCard: {
    marginTop: 10,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolBtnPrimary: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toolBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  toolBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toolBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  toolBtnDanger: {
    backgroundColor: '#450A0A',
  },
  toolBtnDangerText: {
    color: '#FCA5A5',
    fontSize: 12,
  },
  inlineBold: {
    fontWeight: '800',
    color: '#F8FAFC',
  },
  inlineItalic: {
    fontStyle: 'italic',
  },
  inlineUnderline: {
    textDecorationLine: 'underline',
  },
  inlineStrike: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  inlineCode: {
    fontFamily: 'monospace',
    backgroundColor: '#1E293B',
    color: '#38BDF8',
  },
  inlineTag: {
    color: '#D8B4FE',
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
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  blockGrid: {
    gap: 8,
  },
  blockOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    gap: 12,
  },
  blockOptionIcon: {
    color: '#818CF8',
    fontSize: 16,
    fontWeight: '800',
    width: 30,
    textAlign: 'center',
  },
  blockOptionLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  blockOptionHint: {
    color: '#94A3B8',
    fontSize: 11,
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
  colorLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  modalCloseText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
});
