import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAppMeta, setAppMeta } from '../database/db';
import { EditorTheme, makeId } from '../editor/blocks';
import {
  BookmarkCollection,
  BookmarkItem,
  BookmarkNote,
  BookmarkStatus,
  BookmarkViewMode,
  BookmarksStore,
  DEFAULT_BOOKMARKS_STORE,
  bookmarksToCsv,
  bookmarksToHtml,
  extractDomain,
  fetchPageMetadata,
  formatRelativeTimePt,
  normalizeUrl,
  parseImportedTextUrls,
} from './bookmarksTypes';

type BmTab = 'dashboard' | 'collections' | 'bookmarks' | 'notes' | 'tags';

interface BookmarksViewProps {
  theme: EditorTheme;
  onOpenDrawer: () => void;
  onBackHome: () => void;
  onOpenInBrowser: (url: string, title: string) => void;
}

const STORAGE_KEY = 'smarter_bookmarks_v1';

const STATUS_META: Record<BookmarkStatus, { label: string; color: string }> = {
  unread: { label: 'Não Lido', color: '#64748B' },
  read: { label: 'Lido', color: '#38BDF8' },
  in_progress: { label: 'Em Andamento', color: '#F59E0B' },
  completed: { label: 'Concluído', color: '#10B981' },
};

export default function BookmarksView({
  theme,
  onOpenDrawer,
  onBackHome,
  onOpenInBrowser,
}: BookmarksViewProps) {
  const [store, setStore] = useState<BookmarksStore>(() => {
    try {
      const raw = getAppMeta(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as BookmarksStore;
    } catch {
      // default
    }
    return DEFAULT_BOOKMARKS_STORE;
  });

  const [activeTab, setActiveTab] = useState<BmTab>('bookmarks');
  const [viewMode, setViewMode] = useState<BookmarkViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookmarkStatus>('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [collectionStack, setCollectionStack] = useState<(string | null)[]>([null]);

  // Seleção em lote
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modal Novo / Editar Marcador
  const [bmModalVisible, setBmModalVisible] = useState(false);
  const [editingBmId, setEditingBmId] = useState<string | null>(null);
  const [bmUrlInput, setBmUrlInput] = useState('');
  const [bmTitleInput, setBmTitleInput] = useState('');
  const [bmDescInput, setBmDescInput] = useState('');
  const [bmStatus, setBmStatus] = useState<BookmarkStatus>('unread');
  const [bmFav, setBmFav] = useState(false);
  const [bmPin, setBmPin] = useState(false);
  const [bmColId, setBmColId] = useState<string | null>(null);
  const [bmTags, setBmTags] = useState<string[]>([]);
  const [bmTagInput, setBmTagInput] = useState('');
  const [bmMoreOptions, setBmMoreOptions] = useState(true);
  const [bmExpiryDays, setBmExpiryDays] = useState<number | null>(null);
  const [fetchingMeta, setFetchingMeta] = useState(false);

  // Modais Coleção, Nota, Lixeira/Arquivos, Import/Export
  const [colModalVisible, setColModalVisible] = useState(false);
  const [colNameInput, setColNameInput] = useState('');
  const [renamingColId, setRenamingColId] = useState<string | null>(null);

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitleInput, setNoteTitleInput] = useState('');
  const [noteBodyInput, setNoteBodyInput] = useState('');

  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [binMode, setBinMode] = useState<'none' | 'archived' | 'trash'>('none');
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [bmMenuId, setBmMenuId] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagModalVisible, setNewTagModalVisible] = useState(false);

  const persistStore = (next: BookmarksStore) => {
    setStore(next);
    setAppMeta(STORAGE_KEY, JSON.stringify(next));
  };

  const currentCollectionId = collectionStack[collectionStack.length - 1] ?? null;

  const activeBookmarks = useMemo(() => {
    if (binMode === 'trash') {
      return store.bookmarks.filter((b) => b.isTrashed);
    }
    if (binMode === 'archived') {
      return store.bookmarks.filter((b) => !b.isTrashed && b.isArchived);
    }
    return store.bookmarks.filter((b) => !b.isTrashed && !b.isArchived);
  }, [store.bookmarks, binMode]);

  const filteredBookmarks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = activeBookmarks.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (activeTagFilter && !b.tags.includes(activeTagFilter)) return false;
      if (q) {
        const hay = `${b.title} ${b.url} ${b.description} ${b.domain} ${b.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...list].sort(
      (a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt - a.createdAt
    );
  }, [activeBookmarks, statusFilter, activeTagFilter, searchQuery]);

  const openNewBookmarkModal = (prefillColId: string | null = null) => {
    setEditingBmId(null);
    setBmUrlInput('');
    setBmTitleInput('');
    setBmDescInput('');
    setBmStatus('unread');
    setBmFav(false);
    setBmPin(false);
    setBmColId(prefillColId);
    setBmTags([]);
    setBmTagInput('');
    setBmExpiryDays(null);
    setBmMoreOptions(true);
    setBmModalVisible(true);
  };

  const openEditBookmarkModal = (bm: BookmarkItem) => {
    setEditingBmId(bm.id);
    setBmUrlInput(bm.url);
    setBmTitleInput(bm.title);
    setBmDescInput(bm.description);
    setBmStatus(bm.status);
    setBmFav(bm.isFavorite);
    setBmPin(bm.isPinned);
    setBmColId(bm.collectionId);
    setBmTags(bm.tags);
    setBmTagInput('');
    setBmExpiryDays(null);
    setBmMoreOptions(true);
    setBmModalVisible(true);
  };

  const handleFetchMeta = async () => {
    const firstLine = bmUrlInput.split('\n')[0]?.trim();
    if (!firstLine) return;
    setFetchingMeta(true);
    try {
      const meta = await fetchPageMetadata(firstLine);
      if (meta.title) setBmTitleInput(meta.title);
      if (meta.description) setBmDescInput(meta.description);
    } catch {
      Alert.alert('Aviso', 'Não foi possível ler o título automático desta URL.');
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleSaveBookmark = () => {
    const rawLines = bmUrlInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (rawLines.length === 0) {
      Alert.alert('URL obrigatória', 'Digite ou cole pelo menos um link.');
      return;
    }

    const mergedTags = Array.from(
      new Set([
        ...bmTags,
        ...bmTagInput
          .split(/[\s,]+/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ])
    );

    const nextAllTags = Array.from(new Set([...store.tags, ...mergedTags]));
    const expiresAt = bmExpiryDays
      ? Date.now() + bmExpiryDays * 86400000
      : null;

    if (editingBmId) {
      const url = normalizeUrl(rawLines[0]);
      const next = store.bookmarks.map((b) =>
        b.id === editingBmId
          ? {
              ...b,
              url,
              domain: extractDomain(url),
              title: bmTitleInput.trim() || extractDomain(url),
              description: bmDescInput.trim(),
              status: bmStatus,
              isFavorite: bmFav,
              isPinned: bmPin,
              collectionId: bmColId,
              tags: mergedTags,
              expiresAt: expiresAt ?? b.expiresAt,
            }
          : b
      );
      persistStore({ ...store, bookmarks: next, tags: nextAllTags });
    } else {
      const created: BookmarkItem[] = rawLines.map((line, i) => {
        const url = normalizeUrl(line);
        const dom = extractDomain(url);
        return {
          id: makeId('bm'),
          url,
          domain: dom,
          title:
            rawLines.length === 1 && bmTitleInput.trim()
              ? bmTitleInput.trim()
              : dom,
          description: rawLines.length === 1 ? bmDescInput.trim() : '',
          collectionId: bmColId,
          tags: mergedTags,
          status: bmStatus,
          isPinned: bmPin,
          isFavorite: bmFav,
          isArchived: false,
          isTrashed: false,
          expiresAt,
          openCount: 0,
          lastOpenedAt: null,
          notes: '',
          createdAt: Date.now() + i,
        };
      });
      persistStore({
        ...store,
        bookmarks: [...created, ...store.bookmarks],
        tags: nextAllTags,
      });
    }
    setBmModalVisible(false);
  };

  const openBookmarkUrl = (bm: BookmarkItem, external = false) => {
    const next = store.bookmarks.map((x) =>
      x.id === bm.id
        ? { ...x, openCount: x.openCount + 1, lastOpenedAt: Date.now() }
        : x
    );
    persistStore({ ...store, bookmarks: next });
    if (external) {
      Linking.openURL(bm.url).catch(() =>
        Alert.alert('Erro', 'Não foi possível abrir no app externo.')
      );
    } else {
      onOpenInBrowser(bm.url, bm.title);
    }
  };

  const openRandomBookmark = () => {
    if (filteredBookmarks.length === 0) {
      Alert.alert('Sem marcadores', 'Adicione marcadores primeiro.');
      return;
    }
    const pick =
      filteredBookmarks[Math.floor(Math.random() * filteredBookmarks.length)];
    openBookmarkUrl(pick);
  };

  const handleSaveCollection = () => {
    const name = colNameInput.trim();
    if (!name) return;
    if (renamingColId) {
      persistStore({
        ...store,
        collections: store.collections.map((c) =>
          c.id === renamingColId ? { ...c, name } : c
        ),
      });
    } else {
      const created: BookmarkCollection = {
        id: makeId('col'),
        parentId: currentCollectionId,
        name,
        isPinned: false,
        isFavorite: false,
        createdAt: Date.now(),
      };
      persistStore({
        ...store,
        collections: [...store.collections, created],
      });
    }
    setColNameInput('');
    setRenamingColId(null);
    setColModalVisible(false);
  };

  const handleSaveNote = () => {
    const title = noteTitleInput.trim() || 'Sem título';
    const body = noteBodyInput.trim();
    if (editingNoteId) {
      persistStore({
        ...store,
        notes: store.notes.map((n) =>
          n.id === editingNoteId
            ? { ...n, title, body, updatedAt: Date.now() }
            : n
        ),
      });
    } else {
      const created: BookmarkNote = {
        id: makeId('bmn'),
        title,
        body,
        tags: [],
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      persistStore({ ...store, notes: [created, ...store.notes] });
    }
    setNoteModalVisible(false);
  };

  const handleBatchDelete = () => {
    const setIds = new Set(selectedIds);
    persistStore({
      ...store,
      bookmarks: store.bookmarks.map((b) =>
        setIds.has(b.id) ? { ...b, isTrashed: true } : b
      ),
    });
    setSelectedIds([]);
    setBatchMode(false);
  };

  const bmMenuTarget = useMemo(
    () => store.bookmarks.find((b) => b.id === bmMenuId) ?? null,
    [store.bookmarks, bmMenuId]
  );

  const visibleCollections = useMemo(
    () =>
      store.collections
        .filter((c) => c.parentId === currentCollectionId)
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned)),
    [store.collections, currentCollectionId]
  );

  const currentColBookmarks = useMemo(() => {
    if (!currentCollectionId) return [];
    return activeBookmarks.filter((b) => b.collectionId === currentCollectionId);
  }, [activeBookmarks, currentCollectionId]);

  const headerTitle =
    binMode === 'trash'
      ? 'Lixeira'
      : binMode === 'archived'
      ? 'Arquivados'
      : activeTab === 'dashboard'
      ? 'Painel Marcadores'
      : activeTab === 'collections'
      ? 'Coleções'
      : activeTab === 'bookmarks'
      ? activeTagFilter
        ? `Tag: ${activeTagFilter}`
        : 'Marcadores'
      : activeTab === 'notes'
      ? 'Notas'
      : 'Etiquetas';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            if (binMode !== 'none') setBinMode('none');
            else if (activeTagFilter) setActiveTagFilter(null);
            else onOpenDrawer();
          }}
          style={{ padding: 4 }}
        >
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>
            {binMode !== 'none' || activeTagFilter ? '←' : '☰'}
          </Text>
        </TouchableOpacity>
        <Text
          style={{ flex: 1, color: theme.text, fontSize: 19, fontWeight: '800' }}
          numberOfLines={1}
        >
          {headerTitle}
        </Text>
        <TouchableOpacity
          onPress={() => setBatchMode((b) => !b)}
          style={{ paddingHorizontal: 6 }}
        >
          <Text style={{ color: batchMode ? theme.accent : theme.textDim, fontSize: 13, fontWeight: '700' }}>
            {batchMode ? `Lote (${selectedIds.length})` : '☑'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMoreMenuVisible(true)}
          style={{ paddingHorizontal: 6 }}
        >
          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
            ⋮
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBackHome} style={{ paddingHorizontal: 6 }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
            Início
          </Text>
        </TouchableOpacity>
      </View>

      {/* Barra de Lote quando ativa */}
      {batchMode && selectedIds.length > 0 && (
        <View style={[styles.batchBar, { backgroundColor: theme.surfaceAlt }]}>
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700', flex: 1 }}>
            {selectedIds.length} selecionado(s)
          </Text>
          <TouchableOpacity onPress={handleBatchDelete}>
            <Text style={{ color: '#F87171', fontSize: 12, fontWeight: '800' }}>
              🗑 Mover p/ Lixeira
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CONTEÚDO DAS 5 ABAS */}
      <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled">
        {/* ABA 1: PAINEL */}
        {activeTab === 'dashboard' && binMode === 'none' && (
          <View style={{ gap: 14 }}>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginBottom: 10 }}>
                Acesso Rápido Web
              </Text>
              <View style={styles.quickGrid}>
                {[
                  { icon: '▶', label: 'YouTube', url: 'https://m.youtube.com' },
                  { icon: 'G', label: 'Google', url: 'https://www.google.com' },
                  { icon: '✦', label: 'Gemini', url: 'https://gemini.google.com/app' },
                  { icon: '🤖', label: 'ChatGPT', url: 'https://chatgpt.com' },
                ].map((s) => (
                  <TouchableOpacity
                    key={s.label}
                    onPress={() => onOpenInBrowser(s.url, s.label)}
                    style={[styles.quickTile, { backgroundColor: theme.surfaceAlt }]}
                  >
                    <Text style={{ fontSize: 22 }}>{s.icon}</Text>
                    <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginBottom: 10 }}>
                📌 Coleções Fixadas
              </Text>
              {store.collections.filter((c) => c.isPinned).length === 0 ? (
                <Text style={{ color: theme.textDim, fontSize: 12 }}>
                  Fixe coleções na aba Coleções para acessá-las aqui.
                </Text>
              ) : (
                store.collections
                  .filter((c) => c.isPinned)
                  .map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        setCollectionStack([null, c.id]);
                        setActiveTab('collections');
                      }}
                      style={styles.pinColRow}
                    >
                      <Text style={{ fontSize: 16 }}>📁</Text>
                      <Text style={{ color: theme.text, fontWeight: '700', flex: 1 }}>
                        {c.name}
                      </Text>
                      <Text style={{ color: theme.textDim, fontSize: 12 }}>
                        {activeBookmarks.filter((b) => b.collectionId === c.id).length} itens ›
                      </Text>
                    </TouchableOpacity>
                  ))
              )}
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginBottom: 8 }}>
                📊 Resumo
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                🔖 {activeBookmarks.length} marcadores • 📁 {store.collections.length} coleções • 📄 {store.notes.length} notas • 🏷 {store.tags.length} etiquetas
              </Text>
            </View>
          </View>
        )}

        {/* ABA 2: COLEÇÕES (ANINHADAS) */}
        {activeTab === 'collections' && binMode === 'none' && (
          <View style={{ gap: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                {collectionStack.map((cid, idx) => {
                  const label =
                    cid === null
                      ? '/ Início'
                      : store.collections.find((c) => c.id === cid)?.name ?? 'Pasta';
                  return (
                    <TouchableOpacity
                      key={`${cid ?? 'root'}-${idx}`}
                      onPress={() =>
                        setCollectionStack((prev) => prev.slice(0, idx + 1))
                      }
                      style={[styles.crumbChip, { backgroundColor: theme.surfaceAlt }]}
                    >
                      <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
                        {label} ›
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {visibleCollections.map((col) => {
              const count = activeBookmarks.filter(
                (b) => b.collectionId === col.id
              ).length;
              return (
                <View
                  key={col.id}
                  style={[
                    styles.card,
                    styles.rowBetween,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    onPress={() => setCollectionStack((prev) => [...prev, col.id])}
                  >
                    <Text style={{ fontSize: 24 }}>📁</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
                        {col.isPinned ? '📌 ' : ''}
                        {col.name}
                      </Text>
                      <Text style={{ color: theme.textDim, fontSize: 12 }}>
                        {count} favorito(s)
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      persistStore({
                        ...store,
                        collections: store.collections.map((c) =>
                          c.id === col.id ? { ...c, isPinned: !c.isPinned } : c
                        ),
                      })
                    }
                    style={{ padding: 6 }}
                  >
                    <Text style={{ fontSize: 15 }}>{col.isPinned ? '📌' : '📍'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setRenamingColId(col.id);
                      setColNameInput(col.name);
                      setColModalVisible(true);
                    }}
                    style={{ padding: 6 }}
                  >
                    <Text style={{ fontSize: 14 }}>✏️</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            {currentColBookmarks.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={[styles.sectionLbl, { color: theme.textDim }]}>
                  MARCADORES NESTA COLEÇÃO ({currentColBookmarks.length})
                </Text>
                {currentColBookmarks.map((bm) => (
                  <TouchableOpacity
                    key={bm.id}
                    onPress={() => openBookmarkUrl(bm)}
                    style={[
                      styles.card,
                      { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 8 },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                      {bm.title}
                    </Text>
                    <Text style={{ color: '#38BDF8', fontSize: 11 }} numberOfLines={1}>
                      {bm.url}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ABA 3: MARCADORES (OU LIXEIRA/ARQUIVADOS) */}
        {(activeTab === 'bookmarks' || binMode !== 'none') && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    flex: 1,
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar marcadores, tags, domínio..."
                placeholderTextColor={theme.textDim}
              />
              <TouchableOpacity
                onPress={() =>
                  setViewMode((v) =>
                    v === 'list' ? 'card' : v === 'card' ? 'compact' : 'list'
                  )
                }
                style={[styles.viewModeBtn, { backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                  {viewMode === 'list'
                    ? '☰'
                    : viewMode === 'card'
                    ? '⊞'
                    : '≡'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {(
                [
                  { k: 'all', l: 'Todos' },
                  { k: 'unread', l: 'Não Lido' },
                  { k: 'in_progress', l: 'Em Andamento' },
                  { k: 'read', l: 'Lido' },
                  { k: 'completed', l: 'Concluído' },
                ] as const
              ).map((st) => {
                const active = statusFilter === st.k;
                return (
                  <TouchableOpacity
                    key={st.k}
                    onPress={() => setStatusFilter(st.k)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? theme.accent : theme.surface,
                        borderColor: active ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? '#FFF' : theme.textMuted, fontSize: 11, fontWeight: '700' }}>
                      {st.l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {filteredBookmarks.length === 0 ? (
              <View style={styles.emptyCenter}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🔖</Text>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                  {binMode === 'trash'
                    ? 'Lixeira vazia'
                    : binMode === 'archived'
                    ? 'Nenhum arquivado'
                    : 'Sem marcadores ainda'}
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                  Toque no botão 🔗+ abaixo para salvar links com tags, coleções e status!
                </Text>
              </View>
            ) : (
              filteredBookmarks.map((bm) => {
                const colObj = store.collections.find(
                  (c) => c.id === bm.collectionId
                );
                const stMeta = STATUS_META[bm.status];
                const isSel = selectedIds.includes(bm.id);

                return (
                  <TouchableOpacity
                    key={bm.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (batchMode) {
                        setSelectedIds((prev) =>
                          prev.includes(bm.id)
                            ? prev.filter((x) => x !== bm.id)
                            : [...prev, bm.id]
                        );
                      } else {
                        openBookmarkUrl(bm);
                      }
                    }}
                    style={[
                      styles.card,
                      {
                        backgroundColor: theme.surface,
                        borderColor: isSel ? theme.accent : theme.border,
                        borderWidth: isSel ? 2 : 1,
                        paddingVertical: viewMode === 'compact' ? 9 : 13,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={[styles.domainBadge, { backgroundColor: theme.surfaceAlt }]}>
                        <Text style={{ fontSize: 16 }}>
                          {bm.isFavorite ? '❤️' : '🌐'}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}
                          numberOfLines={viewMode === 'compact' ? 1 : 2}
                        >
                          {bm.isPinned ? '📌 ' : ''}
                          {bm.title}
                        </Text>
                        {viewMode !== 'compact' && bm.description ? (
                          <Text
                            style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}
                            numberOfLines={2}
                          >
                            {bm.description}
                          </Text>
                        ) : null}

                        <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 3 }}>
                          {bm.domain} • {formatRelativeTimePt(bm.createdAt)} • {bm.openCount}x aberto
                        </Text>

                        {viewMode !== 'compact' && (
                          <View style={styles.badgesWrap}>
                            <View style={[styles.tinyChip, { borderColor: stMeta.color }]}>
                              <Text style={{ color: stMeta.color, fontSize: 10, fontWeight: '700' }}>
                                {stMeta.label}
                              </Text>
                            </View>
                            {colObj && (
                              <View style={[styles.tinyChip, { borderColor: theme.border }]}>
                                <Text style={{ color: theme.text, fontSize: 10, fontWeight: '700' }}>
                                  📁 {colObj.name}
                                </Text>
                              </View>
                            )}
                            {bm.tags.map((tg) => (
                              <View key={tg} style={[styles.tinyChip, { borderColor: theme.border }]}>
                                <Text style={{ color: '#A855F7', fontSize: 10, fontWeight: '600' }}>
                                  {tg}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => setBmMenuId(bm.id)}
                        style={{ padding: 4 }}
                      >
                        <Text style={{ color: theme.textDim, fontSize: 18 }}>⋮</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ABA 4: NOTAS */}
        {activeTab === 'notes' && binMode === 'none' && (
          <View style={{ gap: 10 }}>
            {store.notes.length === 0 ? (
              <View style={styles.emptyCenter}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>📄</Text>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                  Sem notas
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 13, marginTop: 4 }}>
                  Comece a tomar notas tocando em + abaixo.
                </Text>
              </View>
            ) : (
              store.notes
                .slice()
                .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
                .map((nt) => (
                  <View
                    key={nt.id}
                    style={[
                      styles.card,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => {
                          setEditingNoteId(nt.id);
                          setNoteTitleInput(nt.title);
                          setNoteBodyInput(nt.body);
                          setNoteModalVisible(true);
                        }}
                      >
                        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                          {nt.isPinned ? '📌 ' : ''}
                          {nt.title}
                        </Text>
                        <Text style={{ color: theme.textDim, fontSize: 11, marginBottom: 6 }}>
                          {formatRelativeTimePt(nt.updatedAt)}
                        </Text>
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                          {nt.body}
                        </Text>
                      </TouchableOpacity>
                      <View style={{ gap: 10 }}>
                        <TouchableOpacity
                          onPress={() =>
                            persistStore({
                              ...store,
                              notes: store.notes.map((x) =>
                                x.id === nt.id
                                  ? { ...x, isPinned: !x.isPinned }
                                  : x
                              ),
                            })
                          }
                        >
                          <Text>{nt.isPinned ? '📌' : '📍'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() =>
                            persistStore({
                              ...store,
                              notes: store.notes.filter((x) => x.id !== nt.id),
                            })
                          }
                        >
                          <Text style={{ color: '#F87171' }}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
            )}
          </View>
        )}

        {/* ABA 5: ETIQUETAS (TAGS GRID) */}
        {activeTab === 'tags' && binMode === 'none' && (
          <View style={{ gap: 12 }}>
            <View style={styles.rowBetween}>
              <Text style={{ color: theme.textDim, fontSize: 12, fontWeight: '700' }}>
                {store.tags.length} etiqueta(s)
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNewTagInput('');
                  setNewTagModalVisible(true);
                }}
              >
                <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
                  + Nova Etiqueta
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {store.tags.map((tag) => {
                const count = activeBookmarks.filter((b) =>
                  b.tags.includes(tag)
                ).length;
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => {
                      setActiveTagFilter(tag);
                      setActiveTab('bookmarks');
                    }}
                    style={[
                      styles.tagCloudPill,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                      {tag}
                      {count > 0 ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Botões Flutuantes (Aleatório + Adicionar) */}
      {binMode === 'none' && (
        <View style={styles.fabStack}>
          {activeTab === 'bookmarks' && (
            <TouchableOpacity
              onPress={openRandomBookmark}
              style={[styles.fabSmall, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ fontSize: 18 }}>🔀</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              if (activeTab === 'collections') {
                setRenamingColId(null);
                setColNameInput('');
                setColModalVisible(true);
              } else if (activeTab === 'notes') {
                setEditingNoteId(null);
                setNoteTitleInput('');
                setNoteBodyInput('');
                setNoteModalVisible(true);
              } else if (activeTab === 'tags') {
                setNewTagInput('');
                setNewTagModalVisible(true);
              } else {
                openNewBookmarkModal(currentCollectionId);
              }
            }}
            style={[styles.fabMain, { backgroundColor: theme.accent }]}
          >
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>
              {activeTab === 'bookmarks' ? '🔗+' : '+'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Barra de 5 Abas Inferiores */}
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.surface, borderTopColor: theme.border },
        ]}
      >
        {(
          [
            { k: 'dashboard', icon: '⊞', label: 'Painel' },
            { k: 'collections', icon: '📁', label: 'Coleções' },
            { k: 'bookmarks', icon: '🔖', label: 'Marcadores' },
            { k: 'notes', icon: '📄', label: 'Notas' },
            { k: 'tags', icon: '🏷', label: 'Etiquetas' },
          ] as { k: BmTab; icon: string; label: string }[]
        ).map((tab) => {
          const active = activeTab === tab.k && binMode === 'none';
          return (
            <TouchableOpacity
              key={tab.k}
              onPress={() => {
                setBinMode('none');
                setActiveTab(tab.k);
              }}
              style={styles.tabBtn}
            >
              <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
              <Text
                style={{
                  color: active ? theme.accent : theme.textDim,
                  fontSize: 10,
                  fontWeight: active ? '800' : '600',
                  marginTop: 2,
                }}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* MODAL: Novo / Editar Marcador */}
      <Modal
        visible={bmModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBmModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { maxHeight: '88%', backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingBmId ? '✏️ Editar Marcador' : '🔗 Novo Marcador'}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: '#38BDF8',
                    minHeight: editingBmId ? 44 : 68,
                    textAlignVertical: 'top',
                  },
                ]}
                value={bmUrlInput}
                onChangeText={setBmUrlInput}
                multiline={!editingBmId}
                placeholder="Cole 1 URL ou várias (1 por linha)..."
                placeholderTextColor={theme.textDim}
                autoCapitalize="none"
              />

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, marginBottom: 0, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                  ]}
                  value={bmTitleInput}
                  onChangeText={setBmTitleInput}
                  placeholder="Título"
                  placeholderTextColor={theme.textDim}
                />
                <TouchableOpacity
                  onPress={handleFetchMeta}
                  style={[styles.fetchBtn, { backgroundColor: theme.surfaceAlt }]}
                >
                  {fetchingMeta ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Text style={{ color: theme.accent, fontWeight: '800' }}>⬇</Text>
                  )}
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={bmDescInput}
                onChangeText={setBmDescInput}
                placeholder="Descrição (opcional)"
                placeholderTextColor={theme.textDim}
              />

              <TouchableOpacity
                onPress={() => setBmMoreOptions((m) => !m)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}
              >
                <Text style={{ fontSize: 16, color: theme.accent }}>
                  {bmMoreOptions ? '☑' : '☐'}
                </Text>
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
                  Mais opções (Tags, Coleção, Status)
                </Text>
              </TouchableOpacity>

              {bmMoreOptions && (
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setBmFav((f) => !f)}
                      style={[styles.optPill, { backgroundColor: bmFav ? '#500724' : theme.surfaceAlt }]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
                        {bmFav ? '❤️ Favorito' : '🤍 Favoritar'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setBmPin((p) => !p)}
                      style={[styles.optPill, { backgroundColor: bmPin ? theme.accent : theme.surfaceAlt }]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
                        {bmPin ? '📌 Fixado' : '📍 Fixar'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {(Object.keys(STATUS_META) as BookmarkStatus[]).map((sk) => (
                      <TouchableOpacity
                        key={sk}
                        onPress={() => setBmStatus(sk)}
                        style={[
                          styles.optPill,
                          {
                            backgroundColor:
                              bmStatus === sk ? STATUS_META[sk].color : theme.surfaceAlt,
                          },
                        ]}
                      >
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                          {STATUS_META[sk].label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={{ color: theme.textDim, fontSize: 11, fontWeight: '700' }}>
                    COLEÇÃO:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={() => setBmColId(null)}
                      style={[
                        styles.optPill,
                        { backgroundColor: bmColId === null ? theme.accent : theme.surfaceAlt },
                      ]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                        Nenhuma
                      </Text>
                    </TouchableOpacity>
                    {store.collections.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setBmColId(c.id)}
                        style={[
                          styles.optPill,
                          { backgroundColor: bmColId === c.id ? theme.accent : theme.surfaceAlt },
                        ]}
                      >
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                          📁 {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TextInput
                    style={[styles.input, { marginBottom: 4, backgroundColor: theme.bg, borderColor: theme.border, color: '#A855F7' }]}
                    value={bmTagInput}
                    onChangeText={setBmTagInput}
                    placeholder="Adicionar etiquetas (ex: estudo, filmes)..."
                    placeholderTextColor={theme.textDim}
                    autoCapitalize="none"
                  />

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                    {store.tags.slice(0, 14).map((tg) => {
                      const active = bmTags.includes(tg);
                      return (
                        <TouchableOpacity
                          key={tg}
                          onPress={() =>
                            setBmTags((prev) =>
                              active ? prev.filter((x) => x !== tg) : [...prev, tg]
                            )
                          }
                          style={[
                            styles.optPill,
                            { backgroundColor: active ? '#7C3AED' : theme.surfaceAlt },
                          ]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11 }}>{tg}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setBmModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveBookmark}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>
                  {editingBmId ? 'Salvar' : 'Criar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Opções do Marcador (⋮) */}
      <Modal
        visible={!!bmMenuTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setBmMenuId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
              {bmMenuTarget?.title}
            </Text>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                if (!bmMenuTarget) return;
                const t = bmMenuTarget;
                setBmMenuId(null);
                openBookmarkUrl(t, false);
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>🌐 Abrir no Navegador do App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                if (!bmMenuTarget) return;
                const t = bmMenuTarget;
                setBmMenuId(null);
                openBookmarkUrl(t, true);
              }}
            >
              <Text style={{ color: '#38BDF8', fontWeight: '700' }}>↗ Abrir em App Externo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                if (!bmMenuTarget) return;
                const t = bmMenuTarget;
                setBmMenuId(null);
                openEditBookmarkModal(t);
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>✏️ Editar Marcador</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                if (!bmMenuTarget) return;
                persistStore({
                  ...store,
                  bookmarks: store.bookmarks.map((b) =>
                    b.id === bmMenuTarget.id
                      ? { ...b, isArchived: !b.isArchived, isTrashed: false }
                      : b
                  ),
                });
                setBmMenuId(null);
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>
                {bmMenuTarget?.isArchived ? '📤 Desarquivar' : '📦 Arquivar'}
              </Text>
            </TouchableOpacity>
            {bmMenuTarget?.isTrashed ? (
              <>
                <TouchableOpacity
                  style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    persistStore({
                      ...store,
                      bookmarks: store.bookmarks.map((b) =>
                        b.id === bmMenuTarget.id ? { ...b, isTrashed: false } : b
                      ),
                    });
                    setBmMenuId(null);
                  }}
                >
                  <Text style={{ color: '#10B981', fontWeight: '700' }}>↺ Restaurar da Lixeira</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuRow, { backgroundColor: '#450A0A' }]}
                  onPress={() => {
                    persistStore({
                      ...store,
                      bookmarks: store.bookmarks.filter((b) => b.id !== bmMenuTarget.id),
                    });
                    setBmMenuId(null);
                  }}
                >
                  <Text style={{ color: '#FCA5A5', fontWeight: '700' }}>🗑 Excluir Definitivamente</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.menuRow, { backgroundColor: '#450A0A' }]}
                onPress={() => {
                  if (!bmMenuTarget) return;
                  persistStore({
                    ...store,
                    bookmarks: store.bookmarks.map((b) =>
                      b.id === bmMenuTarget.id ? { ...b, isTrashed: true } : b
                    ),
                  });
                  setBmMenuId(null);
                }}
              >
                <Text style={{ color: '#FCA5A5', fontWeight: '700' }}>🗑 Mover para Lixeira</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setBmMenuId(null)} style={{ alignItems: 'center', paddingTop: 8 }}>
              <Text style={{ color: theme.textDim }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Menu Mais (Lixeira, Arquivados, Importar, Exportar) */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ⚙️ Gerenciar Dados (Marcadores)
            </Text>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setMoreMenuVisible(false);
                setBinMode('archived');
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>📦 Ver Arquivados</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setMoreMenuVisible(false);
                setBinMode('trash');
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>🗑 Ver Lixeira</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setMoreMenuVisible(false);
                setImportText('');
                setImportModalVisible(true);
              }}
            >
              <Text style={{ color: '#10B981', fontWeight: '700' }}>📥 Importar TXT / CSV / URLs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setMoreMenuVisible(false);
                Share.share({
                  title: 'marcadores.csv',
                  message: bookmarksToCsv(activeBookmarks),
                });
              }}
            >
              <Text style={{ color: '#38BDF8', fontWeight: '700' }}>📤 Exportar CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setMoreMenuVisible(false);
                Share.share({
                  title: 'marcadores.html',
                  message: bookmarksToHtml(activeBookmarks),
                });
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>🌐 Exportar HTML</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setMoreMenuVisible(false);
                Share.share({
                  title: 'marcadores.json',
                  message: JSON.stringify(store, null, 2),
                });
              }}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>💾 Exportar JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMoreMenuVisible(false)} style={{ alignItems: 'center', paddingTop: 8 }}>
              <Text style={{ color: theme.textDim }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Nova Coleção / Renomear */}
      <Modal
        visible={colModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setColModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {renamingColId ? 'Renomear Coleção' : 'Nova Coleção'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={colNameInput}
              onChangeText={setColNameInput}
              placeholder="Nome da coleção..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setColModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveCollection} style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Nota */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingNoteId ? 'Editar Nota' : 'Nova Nota'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={noteTitleInput}
              onChangeText={setNoteTitleInput}
              placeholder="Título..."
              placeholderTextColor={theme.textDim}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, minHeight: 100, textAlignVertical: 'top' }]}
              value={noteBodyInput}
              onChangeText={setNoteBodyInput}
              multiline
              placeholder="Conteúdo da nota..."
              placeholderTextColor={theme.textDim}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setNoteModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveNote} style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Importar URLs */}
      <Modal
        visible={importModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>📥 Importar Links (TXT/CSV)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, minHeight: 110, textAlignVertical: 'top' }]}
              value={importText}
              onChangeText={setImportText}
              multiline
              placeholder="Cole links separados por linha ou vírgula..."
              placeholderTextColor={theme.textDim}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setImportModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const urls = parseImportedTextUrls(importText);
                  if (urls.length === 0) return;
                  const newItems: BookmarkItem[] = urls.map((u, idx) => ({
                    id: makeId('bm'),
                    url: u,
                    domain: extractDomain(u),
                    title: extractDomain(u),
                    description: '',
                    collectionId: null,
                    tags: [],
                    status: 'unread',
                    isPinned: false,
                    isFavorite: false,
                    isArchived: false,
                    isTrashed: false,
                    expiresAt: null,
                    openCount: 0,
                    lastOpenedAt: null,
                    notes: '',
                    createdAt: Date.now() + idx,
                  }));
                  persistStore({
                    ...store,
                    bookmarks: [...newItems, ...store.bookmarks],
                  });
                  setImportModalVisible(false);
                  Alert.alert('Importado!', `${newItems.length} marcador(es) adicionado(s).`);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Importar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Nova Etiqueta */}
      <Modal
        visible={newTagModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewTagModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>🏷 Nova Etiqueta</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={newTagInput}
              onChangeText={setNewTagInput}
              placeholder="Nome da etiqueta..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setNewTagModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const t = newTagInput.trim().toLowerCase();
                  if (!t) return;
                  persistStore({
                    ...store,
                    tags: Array.from(new Set([...store.tags, t])),
                  });
                  setNewTagModalVisible(false);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 28) : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bodyScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTile: {
    width: '23%',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pinColRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  crumbChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  sectionLbl: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  viewModeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  emptyCenter: {
    marginTop: 95,
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  domainBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 7,
  },
  tinyChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagCloudPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  fabStack: {
    position: 'absolute',
    right: 16,
    bottom: 66,
    gap: 10,
    alignItems: 'center',
  },
  fabSmall: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabMain: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
  },
  fetchBtn: {
    width: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9 },
  menuRow: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
});
