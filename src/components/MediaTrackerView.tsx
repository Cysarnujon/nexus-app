import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAppMeta, setAppMeta } from '../database/db';
import { EditorTheme } from '../editor/blocks';

export type TrackerTab = 'watching' | 'reading';
export type TrackerStatus = 'active' | 'paused' | 'done';

interface TrackerItem {
  id: string;
  kind: TrackerTab;
  title: string;
  category: string;
  current: number;
  total: number;
  status: TrackerStatus;
}

interface MediaTrackerViewProps {
  initialTab?: TrackerTab;
  theme: EditorTheme;
  onOpenDrawer: () => void;
  onBackHome: () => void;
}

const STORAGE_KEY = 'media_tracker_v1';

export default function MediaTrackerView({
  initialTab = 'watching',
  theme,
  onOpenDrawer,
  onBackHome,
}: MediaTrackerViewProps) {
  const [activeTab, setActiveTab] = useState<TrackerTab>(initialTab);
  const [statusFilter, setStatusFilter] = useState<'all' | TrackerStatus>('all');
  const [items, setItems] = useState<TrackerItem[]>(() => {
    try {
      const raw = getAppMeta(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as TrackerItem[]) : [];
    } catch {
      return [];
    }
  });

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [totalInput, setTotalInput] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const saveItems = (next: TrackerItem[]) => {
    setItems(next);
    setAppMeta(STORAGE_KEY, JSON.stringify(next));
  };

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (it.kind !== activeTab) return false;
      if (statusFilter !== 'all' && it.status !== statusFilter) return false;
      return true;
    });
  }, [items, activeTab, statusFilter]);

  const activeStatusLabel = activeTab === 'watching' ? 'Assistindo' : 'Lendo';
  const filterDisplayName =
    statusFilter === 'all'
      ? 'Todos'
      : statusFilter === 'active'
      ? activeStatusLabel
      : statusFilter === 'paused'
      ? 'Pausado'
      : 'Concluído';

  const handleAddItem = () => {
    const t = titleInput.trim();
    if (!t) return;
    const totalNum = Math.max(1, Number(totalInput) || 10);
    const created: TrackerItem = {
      id: `trk-${Date.now()}`,
      kind: activeTab,
      title: t,
      category:
        categoryInput.trim() ||
        (activeTab === 'watching' ? 'Série / Filme' : 'Livro / Artigo'),
      current: 0,
      total: totalNum,
      status: 'active',
    };
    saveItems([created, ...items]);
    setTitleInput('');
    setCategoryInput('');
    setTotalInput('');
    setAddModalVisible(false);
  };

  const changeProgress = (id: string, delta: number) => {
    const next = items.map((it) => {
      if (it.id !== id) return it;
      const nextCur = Math.max(0, Math.min(it.total, it.current + delta));
      const nextStatus: TrackerStatus =
        nextCur >= it.total ? 'done' : it.status === 'done' ? 'active' : it.status;
      return { ...it, current: nextCur, status: nextStatus };
    });
    saveItems(next);
  };

  const cycleStatus = (id: string) => {
    const order: TrackerStatus[] = ['active', 'paused', 'done'];
    const next = items.map((it) => {
      if (it.id !== id) return it;
      const nextSt = order[(order.indexOf(it.status) + 1) % order.length];
      return { ...it, status: nextSt };
    });
    saveItems(next);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={onOpenDrawer} style={{ padding: 4 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>
            ☰
          </Text>
        </TouchableOpacity>
        <Text style={{ flex: 1, color: theme.text, fontSize: 20, fontWeight: '800' }}>
          {activeTab === 'watching' ? 'Assistindo' : 'Lendo'}
        </Text>
        <TouchableOpacity onPress={onBackHome} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
            Início
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2 Abas Superiores */}
      <View
        style={[
          styles.tabsBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        {(
          [
            { k: 'watching', l: 'Assistindo' },
            { k: 'reading', l: 'Lendo' },
          ] as { k: TrackerTab; l: string }[]
        ).map((t) => {
          const active = activeTab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              onPress={() => setActiveTab(t.k)}
              style={[
                styles.tabItem,
                active && { borderBottomWidth: 2.5, borderBottomColor: theme.accent },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.accent : theme.textDim,
                  fontSize: 14,
                  fontWeight: active ? '800' : '600',
                }}
              >
                {t.l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.bodyScroll}>
        {/* Chips de Filtro */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 16 }}
        >
          {(
            [
              { k: 'all', l: 'Todos' },
              { k: 'active', l: activeStatusLabel },
              { k: 'paused', l: 'Pausado' },
              { k: 'done', l: 'Concluído' },
            ] as const
          ).map((f) => {
            const active = statusFilter === f.k;
            return (
              <TouchableOpacity
                key={f.k}
                onPress={() => setStatusFilter(f.k)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active
                      ? theme.isDark
                        ? '#2E1065'
                        : '#EDE9FE'
                      : theme.surface,
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? theme.accent : theme.textMuted,
                    fontSize: 13,
                    fontWeight: '700',
                  }}
                >
                  {active ? '✓ ' : ''}
                  {f.l}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filteredItems.length === 0 ? (
          <View style={styles.emptyCenter}>
            <Text
              style={{
                color: theme.textDim,
                fontSize: 15,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              Nada em "{filterDisplayName}" ainda.{'\n'}Toque em + Adicionar para começar.
            </Text>
          </View>
        ) : (
          filteredItems.map((it) => {
            const pct = Math.round((it.current / Math.max(1, it.total)) * 100);
            const statusText =
              it.status === 'done'
                ? 'Concluído'
                : it.status === 'paused'
                ? 'Pausado'
                : activeStatusLabel;
            const statusColor =
              it.status === 'done'
                ? '#10B981'
                : it.status === 'paused'
                ? '#F59E0B'
                : theme.accent;

            return (
              <View
                key={it.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                      {it.kind === 'watching' ? '📺 ' : '📖 '}
                      {it.title}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }}>
                      {it.category}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => cycleStatus(it.id)}
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${statusColor}22`, borderColor: statusColor },
                    ]}
                  >
                    <Text style={{ color: statusColor, fontSize: 11, fontWeight: '800' }}>
                      {statusText}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => saveItems(items.filter((x) => x.id !== it.id))}
                    style={{ paddingLeft: 10 }}
                  >
                    <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.rowBetween, { marginTop: 12 }]}>
                  <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>
                    {it.kind === 'watching' ? 'Episódio' : 'Página'}: {it.current} / {it.total} ({pct}%)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => changeProgress(it.id, -1)}
                      style={[styles.stepBtn, { backgroundColor: theme.surfaceAlt }]}
                    >
                      <Text style={{ color: theme.text, fontWeight: '800' }}>−</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => changeProgress(it.id, 1)}
                      style={[styles.stepBtn, { backgroundColor: theme.accent }]}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '800' }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.barTrack, { backgroundColor: theme.surfaceAlt }]}>
                  <View
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      height: '100%',
                      backgroundColor: statusColor,
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 95 }} />
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          setTitleInput('');
          setCategoryInput('');
          setTotalInput('');
          setAddModalVisible(true);
        }}
        style={[
          styles.fabBtn,
          { backgroundColor: theme.isDark ? '#312E81' : '#EDE9FE' },
        ]}
      >
        <Text
          style={{
            color: theme.isDark ? '#E0E7FF' : '#31105E',
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          +   {activeTab === 'watching' ? 'Adicionar Mídia' : 'Adicionar Leitura'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {activeTab === 'watching' ? '📺 Nova Mídia' : '📖 Nova Leitura'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={titleInput}
              onChangeText={setTitleInput}
              placeholder={
                activeTab === 'watching'
                  ? 'Nome da série, filme ou anime...'
                  : 'Nome do livro, mangá ou artigo...'
              }
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={categoryInput}
              onChangeText={setCategoryInput}
              placeholder={
                activeTab === 'watching'
                  ? 'Categoria (ex: Série, Documentário)'
                  : 'Categoria (ex: Livro, Artigo)'
              }
              placeholderTextColor={theme.textDim}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={totalInput}
              onChangeText={setTotalInput}
              placeholder={
                activeTab === 'watching'
                  ? 'Total de episódios (ex: 12)'
                  : 'Total de páginas (ex: 240)'
              }
              placeholderTextColor={theme.textDim}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddItem}
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
    gap: 10,
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  bodyScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  emptyCenter: {
    marginTop: 140,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  fabBtn: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
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
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 12,
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
});
