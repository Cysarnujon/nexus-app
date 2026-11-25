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
import { NexusNode } from '../database/db';
import { EditorTheme, extractPlainTextFromContent } from '../editor/blocks';

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
  theme: EditorTheme;
  customSources: SearchSource[];
  savedSearches: SavedSearchItem[];
  recentSearches: SavedSearchItem[];
  onAddCustomSource: (source: SearchSource) => void;
  onDeleteCustomSource: (id: string) => void;
  onOpenWebUrl: (url: string, title: string, source: SearchSource, query: string) => void;
  onSaveSearch: (item: SavedSearchItem) => void;
  onDeleteSavedSearch: (id: string) => void;
  onClearRecentSearches: () => void;
  onOpenNode: (id: string) => void;
}

export default function HomeSearchView({
  nodes,
  theme,
  customSources,
  savedSearches,
  recentSearches,
  onAddCustomSource,
  onDeleteCustomSource,
  onOpenWebUrl,
  onSaveSearch,
  onDeleteSavedSearch,
  onClearRecentSearches,
  onOpenNode,
}: HomeSearchViewProps) {
  const allSources = useMemo(
    () => [...DEFAULT_SOURCES, ...customSources],
    [customSources]
  );

  const [selectedSourceId, setSelectedSourceId] = useState<string>('google');
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [addSourceVisible, setAddSourceVisible] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');

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

  const executeSearch = () => {
    setDropdownOpen(false);
    if (selectedSource.id === 'nexus') {
      if (!query.trim()) {
        Alert.alert('Busca no Nexus', 'Digite uma palavra para buscar em suas notas.');
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
      Alert.alert('Digite uma pesquisa', 'Escreva algo na barra antes de salvar.');
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
      createdAt: Date.now(),
    });
    Alert.alert('Pesquisa salva!', `"${trimmed}" foi salva nos seus atalhos.`);
  };

  const handleCreateCustomSource = () => {
    const name = newSourceName.trim();
    let url = newSourceUrl.trim();
    if (!name || !url) {
      Alert.alert('Campos obrigatórios', 'Preencha o nome e o endereço do site.');
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
    onOpenWebUrl(item.url, `${item.sourceName}: ${item.query}`, src, item.query);
  };

  return (
    <ScrollView
      style={styles.scrollArea}
      keyboardShouldPersistTaps="handled"
    >
      {/* Barra de Pesquisa Principal (estilo do print) */}
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

      {/* Dropdown Flutuante de Fontes (estilo do print, sem Spotify!) */}
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

      {/* Resultados ao vivo do Nexus quando fonte = Nexus */}
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

      {/* Pesquisas Salvas */}
      <View style={{ marginBottom: 18 }}>
        <Text style={[styles.sectionHeading, { color: theme.textDim }]}>
          ⭐ PESQUISAS SALVAS ({savedSearches.length})
        </Text>
        {savedSearches.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={{ color: theme.textDim, fontSize: 12, lineHeight: 18 }}>
              Pesquise algo e toque em "💾 Salvar pesquisa" para fixar seus temas de estudo aqui.
            </Text>
          </View>
        ) : (
          savedSearches.map((item) => (
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
                <Text style={{ fontSize: 15, color: theme.accent, fontWeight: '800', width: 22, textAlign: 'center' }}>
                  {item.sourceIcon}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}
                    numberOfLines={1}
                  >
                    {item.query}
                  </Text>
                  <Text style={{ color: theme.textDim, fontSize: 11 }}>
                    {item.sourceName}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onDeleteSavedSearch(item.id)}
                style={{ paddingHorizontal: 8, paddingVertical: 4 }}
              >
                <Text style={{ color: '#F87171', fontSize: 13 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Histórico Recente */}
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

      {/* Favoritos do Segundo Cérebro */}
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

      {/* Modal Adicionar Nova Fonte */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
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
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
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
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
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
