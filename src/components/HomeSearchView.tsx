import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAppMeta, NexusNode } from '../database/db';
import { EditorTheme, extractPlainTextFromContent, parseContentToBlocks } from '../editor/blocks';

export interface SearchSource {
  id: string;
  name: string;
  icon: string;
  urlTemplate: string;
  isCustom?: boolean;
}

export interface SavedSearchItem {
  id: string;
  query: string;
  sourceId: string;
  sourceName: string;
  sourceIcon: string;
  url: string;
  tags?: string;
  createdAt: number;
}

export const DEFAULT_SOURCES: SearchSource[] = [
  {
    id: 'nexus',
    name: 'Nexus (Notas)',
    icon: '🧠',
    urlTemplate: 'nexus://search',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: '✦',
    urlTemplate: 'https://gemini.google.com/app',
  },
  {
    id: 'google',
    name: 'Google',
    icon: 'G',
    urlTemplate: 'https://www.google.com/search?q={query}',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶',
    urlTemplate: 'https://m.youtube.com/results?search_query={query}',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: '🤖',
    urlTemplate: 'https://chatgpt.com/?q={query}',
  },
];

export function buildSourceSearchUrl(
  source: SearchSource,
  query: string
): string {
  const q = encodeURIComponent(query.trim());
  if (!query.trim()) {
    return source.urlTemplate
      .replace('?q={query}', '')
      .replace('?search_query={query}', '')
      .replace('{query}', '');
  }
  if (source.urlTemplate.includes('{query}')) {
    return source.urlTemplate.replace('{query}', q);
  }
  if (source.id === 'gemini') {
    return 'https://gemini.google.com/app';
  }
  const sep = source.urlTemplate.includes('?') ? '&' : '?';
  return `${source.urlTemplate}${sep}q=${q}`;
}

interface HomeSearchViewProps {
  nodes: NexusNode[];
  hasApiKey: boolean;
  theme: EditorTheme;
  customSources: SearchSource[];
  savedSearches: SavedSearchItem[];
  recentSearches: SavedSearchItem[];
  onOpenDailySummary: () => void;
  onOpenApiKeyModal: () => void;
  onAddCustomSource: (source: SearchSource) => void;
  onDeleteCustomSource: (id: string) => void;
  onOpenWebUrl: (
    url: string,
    title: string,
    source: SearchSource,
    query: string
  ) => void;
  onSaveSearch: (item: SavedSearchItem) => void;
  onDeleteSavedSearch: (id: string) => void;
  onClearRecentSearches: () => void;
  onOpenNode: (id: string) => void;
  coursesCount: number;
  lessonsCount: number;
  completedLessonsCount: number;
  onNavigateTo: (target: 'spaces' | 'tasks' | 'graph' | 'tags' | 'routine' | 'courses' | 'productivity' | 'bookmarks') => void;
}

export default function HomeSearchView({
  nodes,
  hasApiKey,
  theme,
  customSources,
  savedSearches,
  recentSearches,
  onOpenDailySummary,
  onOpenApiKeyModal,
  onAddCustomSource,
  onDeleteCustomSource,
  onOpenWebUrl,
  onSaveSearch,
  onDeleteSavedSearch,
  onClearRecentSearches,
  onOpenNode,
  coursesCount,
  lessonsCount,
  completedLessonsCount,
  onNavigateTo,
}: HomeSearchViewProps) {
  const allSources = useMemo(
    () => [...DEFAULT_SOURCES, ...customSources],
    [customSources]
  );

  const [selectedSourceId, setSelectedSourceId] = useState<string>('google');
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSavedTag, setSelectedSavedTag] = useState<string>('all');

  const [addSourceVisible, setAddSourceVisible] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');

  const [newLinkModalVisible, setNewLinkModalVisible] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualTags, setManualTags] = useState('');

  const selectedSource = useMemo(
    () => allSources.find((s) => s.id === selectedSourceId) ?? DEFAULT_SOURCES[2],
    [allSources, selectedSourceId]
  );

  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return nodes.filter((n) => {
      const plain = extractPlainTextFromContent(n.content).toLowerCase();
      return n.title.toLowerCase().includes(q) || plain.includes(q);
    });
  }, [nodes, query]);

  const favoriteNodes = useMemo(
    () => nodes.filter((n) => n.isFavorite),
    [nodes]
  );

  const taskSummary = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const node of nodes) {
      for (const block of parseContentToBlocks(node.content)) {
        if (block.type === 'todo') {
          total += 1;
          if (block.checked) done += 1;
        }
      }
    }
    let routineTotal = 0;
    let routineDone = 0;
    try {
      const raw = getAppMeta('routine_daily_tasks');
      const routineTasks = raw ? JSON.parse(raw) as { done?: boolean }[] : [];
      routineTotal = routineTasks.length;
      routineDone = routineTasks.filter((task) => !!task.done).length;
    } catch {
      // Mantém a contagem das checklists das notas se os dados antigos estiverem inválidos.
    }
    return {
      total: total + routineTotal,
      done: done + routineDone,
      pending: (total - done) + (routineTotal - routineDone),
    };
  }, [nodes]);

  const savedTagsList = useMemo(() => {
    const set = new Set<string>();
    for (const s of savedSearches) {
      const matches = (s.tags ?? '').match(/#[a-zA-Z0-9_À-ÿ]+/g) || [];
      for (const m of matches) set.add(m);
    }
    return Array.from(set);
  }, [savedSearches]);

  const filteredSavedSearches = useMemo(() => {
    if (selectedSavedTag === 'all') return savedSearches;
    const lower = selectedSavedTag.toLowerCase();
    return savedSearches.filter((s) =>
      (s.tags ?? '').toLowerCase().includes(lower)
    );
  }, [savedSearches, selectedSavedTag]);

  const executeSearch = () => {
    setDropdownOpen(false);
    if (selectedSource.id === 'nexus') {
      if (!query.trim()) {
        Alert.alert(
          'Busca no Nexus',
          'Digite uma palavra para buscar em suas notas.'
        );
      }
      return;
    }
    const targetUrl = buildSourceSearchUrl(selectedSource, query);
    const label = query.trim()
      ? `${selectedSource.name}: ${query.trim()}`
      : selectedSource.name;
    onOpenWebUrl(targetUrl, label, selectedSource, query.trim());
  };

  const handleSaveCurrentSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      Alert.alert(
        'Digite uma pesquisa',
        'Escreva algo na barra antes de salvar.'
      );
      return;
    }
    const url =
      selectedSource.id === 'nexus'
        ? `nexus://search?q=${encodeURIComponent(trimmed)}`
        : buildSourceSearchUrl(selectedSource, trimmed);

    onSaveSearch({
      id: `sv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      query: trimmed,
      sourceId: selectedSource.id,
      sourceName: selectedSource.name,
      sourceIcon: selectedSource.icon,
      url,
      tags: `#${selectedSource.name.split(' ')[0]}`,
      createdAt: Date.now(),
    });
    Alert.alert('Pesquisa salva!', `"${trimmed}" foi salva nos seus atalhos.`);
  };

  const handleSaveManualLink = () => {
    const title = manualTitle.trim();
    let url = manualUrl.trim();
    if (!title || !url) {
      Alert.alert('Campos obrigatórios', 'Preencha o título e o link.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const cleanTags = manualTags
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`))
      .join(' ');

    onSaveSearch({
      id: `sv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      query: title,
      sourceId: 'custom_link',
      sourceName: 'Link Salvo',
      sourceIcon: '🔗',
      url,
      tags: cleanTags || undefined,
      createdAt: Date.now(),
    });
    setManualTitle('');
    setManualUrl('');
    setManualTags('');
    setNewLinkModalVisible(false);
  };

  const handleCreateCustomSource = () => {
    const name = newSourceName.trim();
    let url = newSourceUrl.trim();
    if (!name || !url) {
      Alert.alert(
        'Campos obrigatórios',
        'Preencha o nome e o endereço do site.'
      );
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const created: SearchSource = {
      id: `src-${Date.now()}`,
      name,
      icon: '🌐',
      urlTemplate: url,
      isCustom: true,
    };
    onAddCustomSource(created);
    setSelectedSourceId(created.id);
    setNewSourceName('');
    setNewSourceUrl('');
    setAddSourceVisible(false);
  };

  const handleOpenSavedOrRecent = (item: SavedSearchItem) => {
    if (item.sourceId === 'nexus') {
      setSelectedSourceId('nexus');
      setQuery(item.query);
      return;
    }
    const src =
      allSources.find((s) => s.id === item.sourceId) ?? {
        id: item.sourceId,
        name: item.sourceName,
        icon: item.sourceIcon,
        urlTemplate: item.url,
      };
    onOpenWebUrl(
      item.url,
      `${item.sourceName}: ${item.query}`,
      src,
      item.query
    );
  };

  return (
    <ScrollView
      style={styles.scrollArea}
      keyboardShouldPersistTaps="handled"
    >

      <View style={[styles.dashboardCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.dashboardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900' }}>Seu painel</Text>
            <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 3 }}>Uma visão rápida do que está acontecendo no Nexus</Text>
          </View>
          <TouchableOpacity onPress={onOpenDailySummary} style={[styles.dashboardSummaryBtn, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800' }}>✦ Resumo</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dashboardStatsGrid}>
          {[
            { icon: '🧠', label: 'Notas', value: String(nodes.length), target: 'spaces' as const },
            { icon: '☑', label: 'Pendentes', value: String(taskSummary.pending), target: 'tasks' as const },
            { icon: '🎓', label: 'Cursos', value: String(coursesCount), target: 'courses' as const },
            { icon: '▶', label: 'Aulas concluídas', value: `${completedLessonsCount}/${lessonsCount}`, target: 'courses' as const },
          ].map((item) => (
            <TouchableOpacity key={item.label} onPress={() => onNavigateTo(item.target)} style={[styles.dashboardStat, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={{ fontSize: 17 }}>{item.icon}</Text>
              <Text style={{ color: theme.text, fontSize: 19, fontWeight: '900', marginTop: 5 }}>{item.value}</Text>
              <Text style={{ color: theme.textDim, fontSize: 10, marginTop: 2 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.dashboardQuickActions}>
          {[
            { icon: '☑', label: 'Tarefas', target: 'tasks' as const },
            { icon: '🗓', label: 'Rotina', target: 'routine' as const },
            { icon: '🕸', label: 'Grafo', target: 'graph' as const },
            { icon: '🔖', label: 'Marcadores', target: 'bookmarks' as const },
            { icon: '⚙', label: 'Ferramentas', target: 'productivity' as const },
          ].map((item) => (
            <TouchableOpacity key={item.target} onPress={() => onNavigateTo(item.target)} style={[styles.dashboardQuickBtn, { borderColor: theme.border }]}>
              <Text style={{ fontSize: 16 }}>{item.icon}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '700' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View
        style={[
          styles.searchPill,
          {
            backgroundColor: theme.surface,
            borderColor: dropdownOpen ? theme.accent : theme.border,
          },
        ]}
      >
        <TouchableOpacity onPress={executeSearch} style={styles.searchIconBtn}>
          <Text style={{ fontSize: 17, color: theme.accent }}>🔍</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={executeSearch}
          returnKeyType="search"
          placeholder={`Pesquisar em ${selectedSource.name}...`}
          placeholderTextColor={theme.textDim}
        />

        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            style={{ paddingHorizontal: 6 }}
          >
            <Text style={{ color: theme.textDim, fontSize: 15 }}>✕</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.sourcePillBtn,
            { backgroundColor: theme.surfaceAlt },
          ]}
          onPress={() => setDropdownOpen((o) => !o)}
        >
          <Text style={[styles.sourcePillIcon, { color: theme.accent }]}>
            {selectedSource.icon}
          </Text>
          <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800' }}>
            {dropdownOpen ? '▴' : '▾'}
          </Text>
        </TouchableOpacity>
      </View>

      {dropdownOpen && (
        <View
          style={[
            styles.dropdownCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          {allSources.map((src) => {
            const active = src.id === selectedSource.id;
            return (
              <View
                key={src.id}
                style={[
                  styles.dropdownRow,
                  active && {
                    backgroundColor: theme.isDark
                      ? 'rgba(99, 102, 241, 0.2)'
                      : 'rgba(99, 102, 241, 0.12)',
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.dropdownItemTouch}
                  onPress={() => {
                    setSelectedSourceId(src.id);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownIcon, { color: theme.accent }]}>
                    {src.icon}
                  </Text>
                  <Text
                    style={[
                      styles.dropdownLabel,
                      { color: theme.text },
                      active && { fontWeight: '800' },
                    ]}
                  >
                    {src.name}
                  </Text>
                </TouchableOpacity>

                {src.isCustom && (
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedSourceId === src.id) {
                        setSelectedSourceId('google');
                      }
                      onDeleteCustomSource(src.id);
                    }}
                    style={{ paddingHorizontal: 8 }}
                  >
                    <Text style={{ color: '#F87171', fontSize: 12 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <View
            style={[styles.dropdownDivider, { backgroundColor: theme.border }]}
          />

          <TouchableOpacity
            style={styles.addSourceRow}
            onPress={() => {
              setDropdownOpen(false);
              setAddSourceVisible(true);
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 17, fontWeight: '700' }}>
              ⊕
            </Text>
            <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '700' }}>
              Adicionar nova fonte
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Botões Resumo do Dia e Chave API */}
      <View style={styles.aiSummaryRow}>
        <TouchableOpacity
          onPress={onOpenDailySummary}
          style={[
            styles.summaryBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.accent, fontSize: 15 }}>✦</Text>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
            Resumo do Dia
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenApiKeyModal}
          style={[
            styles.apiKeyBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ fontSize: 14 }}>🔑</Text>
          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
            {hasApiKey ? 'API ✓' : 'Chave API'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botões rápidos abaixo da barra */}
      <View style={styles.quickActionRow}>
        {selectedSource.id !== 'nexus' && (
          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: theme.accent }]}
            onPress={executeSearch}
          >
            <Text style={styles.primaryActionText}>
              {query.trim()
                ? `Pesquisar no ${selectedSource.name}`
                : `Abrir ${selectedSource.name}`}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.saveSearchBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={handleSaveCurrentSearch}
        >
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
            💾 Salvar pesquisa
          </Text>
        </TouchableOpacity>
      </View>

      {selectedSource.id === 'nexus' && query.trim().length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.sectionHeading, { color: theme.textDim }]}>
            NOTAS ENCONTRADAS ({localMatches.length})
          </Text>
          {localMatches.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.textDim, fontSize: 13 }}>
                Nenhuma nota encontrada para "{query}".
              </Text>
            </View>
          ) : (
            localMatches.map((node) => (
              <TouchableOpacity
                key={node.id}
                style={[
                  styles.resultCard,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => onOpenNode(node.id)}
              >
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>
                  {node.isFavorite ? '★ ' : '📄 '}
                  {node.title}
                </Text>
                <Text
                  style={{ color: theme.textDim, fontSize: 12, marginTop: 3 }}
                  numberOfLines={2}
                >
                  {extractPlainTextFromContent(node.content)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <View style={{ marginBottom: 18 }}>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionHeading, { color: theme.textDim }]}>
            PESQUISAS SALVAS ({savedSearches.length})
          </Text>
          <TouchableOpacity
            onPress={() => {
              setManualTitle('');
              setManualUrl('');
              setManualTags('');
              setNewLinkModalVisible(true);
            }}
          >
            <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              + Novo Link
            </Text>
          </TouchableOpacity>
        </View>

        {savedTagsList.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, marginBottom: 10 }}
          >
            <TouchableOpacity
              onPress={() => setSelectedSavedTag('all')}
              style={[
                styles.tagFilterPill,
                {
                  backgroundColor:
                    selectedSavedTag === 'all' ? '#EDE9FE' : theme.surface,
                  borderColor:
                    selectedSavedTag === 'all' ? '#C4B5FD' : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color:
                    selectedSavedTag === 'all' ? '#31105E' : theme.textMuted,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                Todas
              </Text>
            </TouchableOpacity>

            {savedTagsList.map((tg) => {
              const active = selectedSavedTag === tg;
              return (
                <TouchableOpacity
                  key={tg}
                  onPress={() => setSelectedSavedTag(tg)}
                  style={[
                    styles.tagFilterPill,
                    {
                      backgroundColor: active ? '#EDE9FE' : theme.surface,
                      borderColor: active ? '#C4B5FD' : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? '#31105E' : theme.textMuted,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {tg}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {filteredSavedSearches.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={{ color: theme.textDim, fontSize: 12, lineHeight: 18 }}>
              Pesquise algo e toque em "💾 Salvar pesquisa" ou adicione com "+ Novo Link".
            </Text>
          </View>
        ) : (
          filteredSavedSearches.map((item) => (
            <View
              key={item.id}
              style={[
                styles.savedItemCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                onPress={() => handleOpenSavedOrRecent(item)}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: '#1E40AF',
                    fontWeight: '800',
                    width: 24,
                    textAlign: 'center',
                  }}
                >
                  {item.sourceIcon}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}
                    numberOfLines={1}
                  >
                    {item.query}
                  </Text>
                  <Text
                    style={{ color: '#2563EB', fontSize: 11, marginTop: 1 }}
                    numberOfLines={1}
                  >
                    {item.url}
                  </Text>
                  {item.tags ? (
                    <View style={styles.savedTagBadge}>
                      <Text style={{ color: '#334155', fontSize: 10, fontWeight: '700' }}>
                        {item.tags}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onDeleteSavedSearch(item.id)}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {recentSearches.length > 0 && (
        <View style={{ marginBottom: 18 }}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionHeading, { color: theme.textDim }]}>
              🕒 PESQUISAS RECENTES
            </Text>
            <TouchableOpacity onPress={onClearRecentSearches}>
              <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
                Limpar
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipsWrap}>
            {recentSearches.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.recentChip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => handleOpenSavedOrRecent(item)}
              >
                <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                  {item.sourceIcon}
                </Text>
                <Text
                  style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600', maxWidth: 160 }}
                  numberOfLines={1}
                >
                  {item.query}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {favoriteNodes.length > 0 && (
        <View style={{ marginBottom: 26 }}>
          <Text style={[styles.sectionHeading, { color: theme.textDim }]}>
            ★ NOTAS FAVORITAS
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {favoriteNodes.map((fav) => (
              <TouchableOpacity
                key={fav.id}
                style={[
                  styles.favChip,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
                onPress={() => onOpenNode(fav.id)}
              >
                <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                  ★ {fav.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Modal
        visible={addSourceVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddSourceVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ⊕ Adicionar Nova Fonte
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={newSourceName}
              onChangeText={setNewSourceName}
              placeholder="Nome (ex: Wikipédia, Perplexity, GitHub)"
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={newSourceUrl}
              onChangeText={setNewSourceUrl}
              placeholder="URL (ex: https://pt.wikipedia.org/wiki/Special:Search?search={query})"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
            />
            <Text style={{ color: theme.textDim, fontSize: 11, marginBottom: 14 }}>
              Dica: Use {'{query}'} onde o texto da busca deve entrar, ou coloque apenas o link inicial do site.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setAddSourceVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateCustomSource}
                style={[styles.modalConfirm, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={newLinkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewLinkModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              🔗 Salvar Novo Link
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={manualTitle}
              onChangeText={setManualTitle}
              placeholder="Título (ex: Aula Beatmaker)"
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={manualUrl}
              onChangeText={setManualUrl}
              placeholder="https://..."
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
            />
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.border,
                  color: '#A855F7',
                  fontWeight: '700',
                },
              ]}
              value={manualTags}
              onChangeText={setManualTags}
              placeholder="Tags (ex: #YouTube #Estudos)"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setNewLinkModalVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveManualLink}
                style={[styles.modalConfirm, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  dashboardCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 },
  dashboardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 13 },
  dashboardSummaryBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  dashboardStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dashboardStat: { width: '48%', flexGrow: 1, borderRadius: 12, padding: 10, minHeight: 83 },
  dashboardQuickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  dashboardQuickBtn: { flexGrow: 1, minWidth: '18%', alignItems: 'center', gap: 4, paddingVertical: 9, paddingHorizontal: 5, borderWidth: 1, borderRadius: 11 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1.5,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  searchIconBtn: {
    paddingRight: 8,
    paddingVertical: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 6,
  },
  sourcePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  sourcePillIcon: {
    fontSize: 14,
    fontWeight: '800',
  },
  dropdownCard: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 2,
  },
  dropdownItemTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 14,
  },
  dropdownIcon: {
    fontSize: 16,
    fontWeight: '800',
    width: 24,
    textAlign: 'center',
  },
  dropdownLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownDivider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 8,
  },
  addSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 12,
  },
  aiSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  summaryBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    gap: 8,
  },
  apiKeyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    gap: 6,
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 18,
  },
  primaryActionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  saveSearchBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagFilterPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  savedItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  savedTagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 6,
    gap: 6,
  },
  favChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 180,
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
    padding: 18,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  modalConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
