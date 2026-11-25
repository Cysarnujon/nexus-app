import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  EditorBlock,
  EditorTheme,
  makeId,
} from '../editor/blocks';

interface AdvancedBlockProps {
  block: EditorBlock;
  allBlocks: EditorBlock[];
  isPreviewMode: boolean;
  isFocused: boolean;
  theme: EditorTheme;
  onFocus: () => void;
  onFocusTargetBlock: (blockId: string) => void;
  onUpdateBlock: (
    blockId: string,
    patch: Partial<EditorBlock>,
    pushHistory?: boolean
  ) => void;
  onRunButtonAction: (block: EditorBlock) => void;
}

const CHART_COLORS = ['#6366F1', '#38BDF8', '#34D399', '#F59E0B', '#A855F7', '#F43F5E'];

export default function AdvancedBlockView({
  block,
  allBlocks,
  isPreviewMode,
  isFocused,
  theme,
  onFocus,
  onFocusTargetBlock,
  onUpdateBlock,
  onRunButtonAction,
}: AdvancedBlockProps) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [tableFilter, setTableFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const focusBorder = isFocused
    ? { borderWidth: 1.5, borderColor: theme.accent }
    : { borderWidth: 1, borderColor: theme.border };

  // 1. ÍNDICE AUTOMÁTICO (TOC)
  if (block.type === 'toc') {
    const headings = allBlocks.filter(
      (b) =>
        b.type === 'h1' ||
        b.type === 'h2' ||
        b.type === 'h3' ||
        b.type === 'h4' ||
        b.type === 'h5' ||
        b.type === 'h6' ||
        b.type === 'toggle_h1' ||
        b.type === 'toggle_h2'
    );

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onFocus}
        style={[
          styles.box,
          { backgroundColor: theme.bg },
          focusBorder,
        ]}
      >
        <Text style={[styles.boxTitle, { color: theme.textDim }]}>
          📑 ÍNDICE AUTOMÁTICO ({headings.length})
        </Text>
        {headings.length === 0 ? (
          <Text style={{ color: theme.textDim, fontSize: 12 }}>
            Adicione títulos (H1–H6) para gerar o índice automaticamente.
          </Text>
        ) : (
          headings.map((h) => {
            const level =
              h.type === 'h1' || h.type === 'toggle_h1'
                ? 0
                : h.type === 'h2' || h.type === 'toggle_h2'
                ? 1
                : h.type === 'h3'
                ? 2
                : 3;
            return (
              <TouchableOpacity
                key={h.id}
                onPress={() => onFocusTargetBlock(h.id)}
                style={{ paddingLeft: level * 14, paddingVertical: 3 }}
              >
                <Text style={{ color: '#38BDF8', fontSize: 13, fontWeight: '600' }}>
                  • {h.text || '(Título vazio)'}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </TouchableOpacity>
    );
  }

  // 2. TABELA AVANÇADA (Alinhamento, Ordenação, Filtro)
  if (block.type === 'table') {
    const rows = block.tableData ?? [
      ['Coluna 1', 'Coluna 2'],
      ['', ''],
    ];
    const align = block.tableAlign ?? 'left';
    const headerRow = rows[0] ?? [];
    const bodyRows = rows.slice(1);
    const filterLower = tableFilter.trim().toLowerCase();

    const displayedBody = filterLower
      ? bodyRows
          .map((r, originalIdx) => ({ r, originalIdx: originalIdx + 1 }))
          .filter(({ r }) =>
            r.some((cell) => cell.toLowerCase().includes(filterLower))
          )
      : bodyRows.map((r, originalIdx) => ({ r, originalIdx: originalIdx + 1 }));

    const updateCell = (rIdx: number, cIdx: number, val: string) => {
      const next = rows.map((row) => [...row]);
      if (next[rIdx]) next[rIdx][cIdx] = val;
      onUpdateBlock(block.id, { tableData: next }, false);
    };

    const modifyTable = (action: 'addRow' | 'remRow' | 'addCol' | 'remCol') => {
      const next = rows.map((row) => [...row]);
      const cols = next[0]?.length ?? 2;
      if (action === 'addRow') next.push(Array(cols).fill(''));
      if (action === 'remRow' && next.length > 2) next.pop();
      if (action === 'addCol' && cols < 6) {
        next.forEach((r, idx) => r.push(idx === 0 ? `Col ${cols + 1}` : ''));
      }
      if (action === 'remCol' && cols > 1) {
        next.forEach((r) => r.pop());
      }
      onUpdateBlock(block.id, { tableData: next }, true);
    };

    const sortTableByFirstCol = () => {
      const sortedBody = [...bodyRows].sort((a, b) => {
        const cmp = (a[0] ?? '').localeCompare(b[0] ?? '');
        return sortAsc ? cmp : -cmp;
      });
      setSortAsc(!sortAsc);
      onUpdateBlock(block.id, { tableData: [headerRow, ...sortedBody] }, true);
    };

    const cycleAlign = () => {
      const nextAlign =
        align === 'left' ? 'center' : align === 'center' ? 'right' : 'left';
      onUpdateBlock(block.id, { tableAlign: nextAlign }, true);
    };

    return (
      <View
        style={[
          styles.box,
          { backgroundColor: theme.bg },
          focusBorder,
        ]}
      >
        <TextInput
          style={[
            styles.miniSearch,
            {
              color: theme.text,
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          value={tableFilter}
          onChangeText={setTableFilter}
          placeholder="🔍 Filtrar linhas da tabela..."
          placeholderTextColor={theme.textDim}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View
              style={[
                styles.tableRow,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              {headerRow.map((cell, cIdx) => (
                <View
                  key={`h-${cIdx}`}
                  style={[styles.tableCell, { borderRightColor: theme.border }]}
                >
                  {isPreviewMode ? (
                    <Text
                      style={[
                        styles.tableHeaderText,
                        { color: theme.text, textAlign: align },
                      ]}
                    >
                      {cell || ' '}
                    </Text>
                  ) : (
                    <TextInput
                      style={[
                        styles.tableInput,
                        styles.tableHeaderText,
                        { color: theme.text, textAlign: align },
                      ]}
                      value={cell}
                      onFocus={onFocus}
                      onChangeText={(v) => updateCell(0, cIdx, v)}
                      placeholder="Título"
                      placeholderTextColor={theme.textDim}
                    />
                  )}
                </View>
              ))}
            </View>

            {displayedBody.map(({ r, originalIdx }) => (
              <View
                key={`r-${originalIdx}`}
                style={[styles.tableRow, { borderBottomColor: theme.border }]}
              >
                {r.map((cell, cIdx) => (
                  <View
                    key={`c-${cIdx}`}
                    style={[styles.tableCell, { borderRightColor: theme.border }]}
                  >
                    {isPreviewMode ? (
                      <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: align }}>
                        {cell || ' '}
                      </Text>
                    ) : (
                      <TextInput
                        style={[
                          styles.tableInput,
                          { color: theme.textMuted, textAlign: align },
                        ]}
                        value={cell}
                        onFocus={onFocus}
                        onChangeText={(v) => updateCell(originalIdx, cIdx, v)}
                        placeholder="..."
                        placeholderTextColor={theme.textDim}
                      />
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>

        {!isPreviewMode && (
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => modifyTable('addRow')}
            >
              <Text style={[styles.ctrlText, { color: theme.textMuted }]}>+ Lin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => modifyTable('remRow')}
            >
              <Text style={[styles.ctrlText, { color: theme.textMuted }]}>− Lin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => modifyTable('addCol')}
            >
              <Text style={[styles.ctrlText, { color: theme.textMuted }]}>+ Col</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => modifyTable('remCol')}
            >
              <Text style={[styles.ctrlText, { color: theme.textMuted }]}>− Col</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={sortTableByFirstCol}
            >
              <Text style={[styles.ctrlText, { color: '#38BDF8' }]}>↕ Ordenar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, { backgroundColor: theme.surfaceAlt }]}
              onPress={cycleAlign}
            >
              <Text style={[styles.ctrlText, { color: '#A855F7' }]}>
                ⇄ {align === 'left' ? 'Esq' : align === 'center' ? 'Centro' : 'Dir'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // 3. QUADRO KANBAN
  if (block.type === 'kanban') {
    const columns = block.kanbanData?.columns ?? [];

    const updateCols = (nextCols: typeof columns, pushHistory = true) => {
      onUpdateBlock(block.id, { kanbanData: { columns: nextCols } }, pushHistory);
    };

    const addCard = (colIdx: number) => {
      const next = columns.map((c, idx) =>
        idx === colIdx
          ? { ...c, cards: [...c.cards, { id: makeId('crd'), text: 'Novo cartão' }] }
          : c
      );
      updateCols(next);
    };

    const moveCard = (fromCol: number, cardIdx: number, dir: -1 | 1) => {
      const toCol = fromCol + dir;
      if (toCol < 0 || toCol >= columns.length) return;
      const next = columns.map((c) => ({ ...c, cards: [...c.cards] }));
      const [card] = next[fromCol].cards.splice(cardIdx, 1);
      if (card) next[toCol].cards.push(card);
      updateCols(next);
    };

    const deleteCard = (colIdx: number, cardIdx: number) => {
      const next = columns.map((c, idx) =>
        idx === colIdx
          ? { ...c, cards: c.cards.filter((_, i) => i !== cardIdx) }
          : c
      );
      updateCols(next);
    };

    const addColumn = () => {
      if (columns.length >= 6) return;
      updateCols([
        ...columns,
        { id: makeId('col'), title: `Coluna ${columns.length + 1}`, cards: [] },
      ]);
    };

    return (
      <View
        style={[
          styles.box,
          { backgroundColor: theme.bg },
          focusBorder,
        ]}
      >
        <View style={styles.rowBetween}>
          <Text style={[styles.boxTitle, { color: theme.textDim }]}>
            ▥ QUADRO KANBAN
          </Text>
          {!isPreviewMode && (
            <TouchableOpacity onPress={addColumn}>
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                + Coluna
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {columns.map((col, colIdx) => (
              <View
                key={col.id}
                style={[
                  styles.kanbanCol,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                {isPreviewMode ? (
                  <Text style={[styles.kanbanColTitle, { color: theme.text }]}>
                    {col.title} ({col.cards.length})
                  </Text>
                ) : (
                  <TextInput
                    style={[styles.kanbanColTitle, { color: theme.text }]}
                    value={col.title}
                    onFocus={onFocus}
                    onChangeText={(txt) => {
                      const next = columns.map((c, i) =>
                        i === colIdx ? { ...c, title: txt } : c
                      );
                      updateCols(next, false);
                    }}
                  />
                )}

                {col.cards.map((card, cardIdx) => (
                  <View
                    key={card.id}
                    style={[
                      styles.kanbanCard,
                      {
                        backgroundColor: theme.surfaceAlt,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    {isPreviewMode ? (
                      <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                        {card.text}
                      </Text>
                    ) : (
                      <>
                        <TextInput
                          style={{ color: theme.textMuted, fontSize: 13 }}
                          value={card.text}
                          onFocus={onFocus}
                          multiline
                          onChangeText={(txt) => {
                            const next = columns.map((c, i) =>
                              i === colIdx
                                ? {
                                    ...c,
                                    cards: c.cards.map((cd, ci) =>
                                      ci === cardIdx ? { ...cd, text: txt } : cd
                                    ),
                                  }
                                : c
                            );
                            updateCols(next, false);
                          }}
                        />
                        <View style={styles.kanbanCardActions}>
                          <TouchableOpacity
                            disabled={colIdx === 0}
                            onPress={() => moveCard(colIdx, cardIdx, -1)}
                          >
                            <Text
                              style={[
                                styles.kanbanActionText,
                                {
                                  color: colIdx === 0 ? theme.textDim : '#38BDF8',
                                },
                              ]}
                            >
                              ←
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={colIdx === columns.length - 1}
                            onPress={() => moveCard(colIdx, cardIdx, 1)}
                          >
                            <Text
                              style={[
                                styles.kanbanActionText,
                                {
                                  color:
                                    colIdx === columns.length - 1
                                      ? theme.textDim
                                      : '#38BDF8',
                                },
                              ]}
                            >
                              →
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => deleteCard(colIdx, cardIdx)}
                            style={{ marginLeft: 'auto' }}
                          >
                            <Text style={{ color: '#F87171', fontSize: 12 }}>
                              ✕
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                ))}

                {!isPreviewMode && (
                  <TouchableOpacity
                    style={styles.kanbanAddBtn}
                    onPress={() => addCard(colIdx)}
                  >
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>
                      + Cartão
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  // 4. GRÁFICO DE BARRAS
  if (block.type === 'chart') {
    const items = block.chartData ?? [];
    const maxVal = Math.max(1, ...items.map((i) => Math.abs(i.value)));

    return (
      <View
        style={[
          styles.box,
          { backgroundColor: theme.bg },
          focusBorder,
        ]}
      >
        <View style={styles.rowBetween}>
          <Text style={[styles.boxTitle, { color: theme.textDim }]}>
            📊 GRÁFICO DE DADOS
          </Text>
          {!isPreviewMode && (
            <TouchableOpacity
              onPress={() => {
                const next = [
                  ...items,
                  {
                    id: makeId('ch'),
                    label: `Item ${items.length + 1}`,
                    value: 50,
                    color: CHART_COLORS[items.length % CHART_COLORS.length],
                  },
                ];
                onUpdateBlock(block.id, { chartData: next }, true);
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                + Barra
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {items.map((item, idx) => {
          const pct = Math.max(4, Math.round((Math.abs(item.value) / maxVal) * 100));
          return (
            <View key={item.id} style={{ marginBottom: 10 }}>
              <View style={styles.rowBetween}>
                {isPreviewMode ? (
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                    {item.label}
                  </Text>
                ) : (
                  <TextInput
                    style={{ color: theme.text, fontSize: 13, fontWeight: '600', flex: 1 }}
                    value={item.label}
                    onFocus={onFocus}
                    onChangeText={(txt) => {
                      const next = items.map((x, i) =>
                        i === idx ? { ...x, label: txt } : x
                      );
                      onUpdateBlock(block.id, { chartData: next }, false);
                    }}
                  />
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isPreviewMode ? (
                    <Text style={{ color: item.color, fontWeight: '700', fontSize: 13 }}>
                      {item.value}
                    </Text>
                  ) : (
                    <>
                      <TextInput
                        style={[
                          styles.chartNumInput,
                          { color: item.color, borderColor: theme.border },
                        ]}
                        value={String(item.value)}
                        keyboardType="numeric"
                        onFocus={onFocus}
                        onChangeText={(txt) => {
                          const num = Number(txt.replace(/[^0-9.-]/g, '')) || 0;
                          const next = items.map((x, i) =>
                            i === idx ? { ...x, value: num } : x
                          );
                          onUpdateBlock(block.id, { chartData: next }, false);
                        }}
                      />
                      {items.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            const next = items.filter((_, i) => i !== idx);
                            onUpdateBlock(block.id, { chartData: next }, true);
                          }}
                        >
                          <Text style={{ color: '#F87171', fontSize: 12 }}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>

              <View
                style={[
                  styles.chartTrack,
                  { backgroundColor: theme.surfaceAlt },
                ]}
              >
                <View
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    backgroundColor: item.color,
                    borderRadius: 6,
                  }}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  // 5. GUIAS / ABAS
  if (block.type === 'tabs') {
    const tabs = block.tabsData ?? [];
    const safeIdx = Math.min(activeTabIdx, Math.max(0, tabs.length - 1));
    const currentTab = tabs[safeIdx];

    return (
      <View
        style={[
          styles.box,
          { backgroundColor: theme.bg },
          focusBorder,
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
            {tabs.map((tab, idx) => {
              const active = idx === safeIdx;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => setActiveTabIdx(idx)}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: active ? theme.accent : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#FFFFFF' : theme.textMuted,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {tab.title || `Aba ${idx + 1}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {!isPreviewMode && tabs.length < 6 && (
              <TouchableOpacity
                onPress={() => {
                  const next = [
                    ...tabs,
                    {
                      id: makeId('tb'),
                      title: `Aba ${tabs.length + 1}`,
                      body: '',
                    },
                  ];
                  onUpdateBlock(block.id, { tabsData: next }, true);
                  setActiveTabIdx(next.length - 1);
                }}
                style={[styles.tabPill, { backgroundColor: theme.surface }]}
              >
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                  + Aba
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {currentTab && (
          <View
            style={[
              styles.tabBodyBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {isPreviewMode ? (
              <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 20 }}>
                {currentTab.body || 'Sem conteúdo nesta aba.'}
              </Text>
            ) : (
              <>
                <TextInput
                  style={[
                    styles.tabTitleEdit,
                    { color: theme.text, borderBottomColor: theme.border },
                  ]}
                  value={currentTab.title}
                  onFocus={onFocus}
                  onChangeText={(txt) => {
                    const next = tabs.map((t, i) =>
                      i === safeIdx ? { ...t, title: txt } : t
                    );
                    onUpdateBlock(block.id, { tabsData: next }, false);
                  }}
                  placeholder="Nome da aba..."
                  placeholderTextColor={theme.textDim}
                />
                <TextInput
                  style={{ color: theme.textMuted, fontSize: 14, minHeight: 54 }}
                  value={currentTab.body}
                  onFocus={onFocus}
                  multiline
                  onChangeText={(txt) => {
                    const next = tabs.map((t, i) =>
                      i === safeIdx ? { ...t, body: txt } : t
                    );
                    onUpdateBlock(block.id, { tabsData: next }, false);
                  }}
                  placeholder="Conteúdo desta aba..."
                  placeholderTextColor={theme.textDim}
                />
              </>
            )}
          </View>
        )}
      </View>
    );
  }

  // 6. LINHA DO TEMPO
  if (block.type === 'timeline') {
    const items = block.timelineData ?? [];

    return (
      <View
        style={[
          styles.box,
          { backgroundColor: theme.bg },
          focusBorder,
        ]}
      >
        <View style={styles.rowBetween}>
          <Text style={[styles.boxTitle, { color: theme.textDim }]}>
            ⏳ LINHA DO TEMPO
          </Text>
          {!isPreviewMode && (
            <TouchableOpacity
              onPress={() => {
                const next = [
                  ...items,
                  {
                    id: makeId('tl'),
                    date: `Etapa ${items.length + 1}`,
                    title: 'Novo marco',
                  },
                ];
                onUpdateBlock(block.id, { timelineData: next }, true);
              }}
            >
              <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                + Evento
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {items.map((item, idx) => (
          <View key={item.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: theme.accent }]} />
              {idx < items.length - 1 && (
                <View
                  style={[styles.timelineLine, { backgroundColor: theme.border }]}
                />
              )}
            </View>
            <View style={{ flex: 1, paddingBottom: 12 }}>
              {isPreviewMode ? (
                <>
                  <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '700' }}>
                    {item.date}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>
                    {item.title}
                  </Text>
                </>
              ) : (
                <View style={{ gap: 2 }}>
                  <View style={styles.rowBetween}>
                    <TextInput
                      style={{ color: theme.accent, fontSize: 12, fontWeight: '700', flex: 1 }}
                      value={item.date}
                      onFocus={onFocus}
                      onChangeText={(txt) => {
                        const next = items.map((x, i) =>
                          i === idx ? { ...x, date: txt } : x
                        );
                        onUpdateBlock(block.id, { timelineData: next }, false);
                      }}
                      placeholder="Data / Etapa"
                      placeholderTextColor={theme.textDim}
                    />
                    {items.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const next = items.filter((_, i) => i !== idx);
                          onUpdateBlock(block.id, { timelineData: next }, true);
                        }}
                      >
                        <Text style={{ color: '#F87171', fontSize: 12 }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}
                    value={item.title}
                    onFocus={onFocus}
                    onChangeText={(txt) => {
                      const next = items.map((x, i) =>
                        i === idx ? { ...x, title: txt } : x
                      );
                      onUpdateBlock(block.id, { timelineData: next }, false);
                    }}
                    placeholder="Descrição do evento..."
                    placeholderTextColor={theme.textDim}
                  />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  }

  // 7. BOTÃO DE AÇÃO
  if (block.type === 'button') {
    const actionType = block.buttonAction ?? 'todo';
    return (
      <View
        style={[
          styles.box,
          { backgroundColor: theme.bg },
          focusBorder,
        ]}
      >
        {!isPreviewMode && (
          <View style={{ gap: 6, marginBottom: 8 }}>
            <TextInput
              style={[
                styles.miniSearch,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  marginBottom: 0,
                },
              ]}
              value={block.text}
              onFocus={onFocus}
              onChangeText={(txt) =>
                onUpdateBlock(block.id, { text: txt }, false)
              }
              placeholder="Texto do botão (ex: Nova Tarefa)..."
              placeholderTextColor={theme.textDim}
            />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(
                [
                  { k: 'todo', label: '+ Tarefa' },
                  { k: 'note', label: '📄 Nota' },
                  { k: 'url', label: '🌐 Link' },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.k}
                  onPress={() =>
                    onUpdateBlock(block.id, { buttonAction: opt.k }, true)
                  }
                  style={[
                    styles.ctrlBtn,
                    {
                      backgroundColor:
                        actionType === opt.k ? theme.accent : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: actionType === opt.k ? '#FFF' : theme.textMuted,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {actionType !== 'todo' && (
              <TextInput
                style={[
                  styles.miniSearch,
                  {
                    color: '#38BDF8',
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    marginBottom: 0,
                  },
                ]}
                value={block.url ?? ''}
                onFocus={onFocus}
                onChangeText={(txt) =>
                  onUpdateBlock(block.id, { url: txt }, false)
                }
                placeholder={
                  actionType === 'url'
                    ? 'https://exemplo.com'
                    : 'Nome da nota para abrir...'
                }
                placeholderTextColor={theme.textDim}
                autoCapitalize="none"
              />
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.accent }]}
          onPress={() => onRunButtonAction(block)}
        >
          <Text style={styles.actionButtonText}>
            ⚡ {block.text || 'Executar Ação'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 8. LINK EXTERNO / MARCADOR WEB (BOOKMARK)
  const openUrl = async () => {
    const raw = (block.url ?? '').trim();
    if (!raw || raw === 'https://') {
      Alert.alert('URL vazia', 'Digite um endereço válido como https://youtube.com');
      return;
    }
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      await Linking.openURL(normalized);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir este link.');
    }
  };

  return (
    <View
      style={[
        styles.box,
        { backgroundColor: theme.bg },
        focusBorder,
      ]}
    >
      {!isPreviewMode ? (
        <View style={{ gap: 6 }}>
          <TextInput
            style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}
            value={block.text}
            onFocus={onFocus}
            onChangeText={(txt) =>
              onUpdateBlock(block.id, { text: txt }, false)
            }
            placeholder="Título do link / site..."
            placeholderTextColor={theme.textDim}
          />
          <TextInput
            style={[
              styles.miniSearch,
              {
                color: '#38BDF8',
                backgroundColor: theme.surface,
                borderColor: theme.border,
                marginBottom: 4,
              },
            ]}
            value={block.url ?? ''}
            onFocus={onFocus}
            onChangeText={(txt) => onUpdateBlock(block.id, { url: txt }, false)}
            placeholder="https://..."
            placeholderTextColor={theme.textDim}
            autoCapitalize="none"
          />
        </View>
      ) : null}

      <TouchableOpacity
        style={[
          styles.bookmarkCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
        onPress={openUrl}
      >
        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
          🌐 {block.text || 'Abrir Link Externo'}
        </Text>
        <Text style={{ color: '#38BDF8', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {block.url || 'https://'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 12,
    padding: 10,
  },
  boxTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniSearch: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableCell: {
    width: 114,
    borderRightWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tableInput: {
    fontSize: 13,
    paddingVertical: 2,
  },
  tableHeaderText: {
    fontWeight: '700',
    fontSize: 13,
  },
  controlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  ctrlBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  ctrlText: {
    fontSize: 11,
    fontWeight: '600',
  },
  kanbanCol: {
    width: 175,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
  },
  kanbanColTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  kanbanCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    marginBottom: 6,
  },
  kanbanCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    alignItems: 'center',
  },
  kanbanActionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  kanbanAddBtn: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 2,
  },
  chartNumInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 46,
    textAlign: 'center',
  },
  chartTrack: {
    height: 10,
    borderRadius: 6,
    marginTop: 4,
    overflow: 'hidden',
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tabBodyBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  tabTitleEdit: {
    fontSize: 13,
    fontWeight: '700',
    borderBottomWidth: 1,
    paddingBottom: 4,
    marginBottom: 6,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineRail: {
    alignItems: 'center',
    width: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bookmarkCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
});
