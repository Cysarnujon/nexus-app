import React, { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CourseItem, getAppMeta, setAppMeta } from '../database/db';
import { EditorTheme } from '../editor/blocks';
import { InfoSubTab } from './InfoHubView';
import { TrackerTab } from './MediaTrackerView';

export type DrawerDestination =
  | { kind: 'home' }
  | { kind: 'info'; tab: InfoSubTab }
  | { kind: 'routine' }
  | { kind: 'courses'; courseId?: string }
  | { kind: 'productivity' }
  | { kind: 'spaces' }
  | { kind: 'bookmarks' }
  | { kind: 'tracker'; tab: TrackerTab };

interface DrawerCategory {
  id: string;
  icon: string;
  title: string;
  items: { icon: string; label: string; dest: DrawerDestination }[];
}

const CATEGORIES_BY_ID: Record<string, DrawerCategory> = {
  info: {
    id: 'info',
    icon: '🌐',
    title: 'Informações & Dia a Dia',
    items: [
      { icon: '☀️', label: 'Previsão do Tempo', dest: { kind: 'info', tab: 'weather' } },
      { icon: '✨', label: 'Horóscopo', dest: { kind: 'info', tab: 'horoscope' } },
      { icon: '📈', label: 'Cotações & Finanças', dest: { kind: 'info', tab: 'quotes' } },
      { icon: '📡', label: 'Feeds RSS', dest: { kind: 'info', tab: 'feeds' } },
    ],
  },
  personal: {
    id: 'personal',
    icon: '📂',
    title: 'Organização Pessoal',
    items: [
      { icon: '✅', label: 'Minha Rotina', dest: { kind: 'routine' } },
      { icon: '🎓', label: 'Meus Cursos', dest: { kind: 'courses' } },
      { icon: '🧰', label: 'Ferramentas Flow', dest: { kind: 'productivity' } },
      { icon: '🧠', label: 'Espaços (Notas)', dest: { kind: 'spaces' } },
    ],
  },
  management: {
    id: 'management',
    icon: '📖',
    title: 'Gerenciamento',
    items: [
      { icon: '🔖', label: 'Marcadores (Bookmarks)', dest: { kind: 'bookmarks' } },
      { icon: '📺', label: 'Assistindo', dest: { kind: 'tracker', tab: 'watching' } },
      { icon: '📚', label: 'Lendo', dest: { kind: 'tracker', tab: 'reading' } },
    ],
  },
};

interface AppDrawerProps {
  visible: boolean;
  theme: EditorTheme;
  courses: CourseItem[];
  androidBottomSafe: number;
  onClose: () => void;
  onNavigate: (dest: DrawerDestination) => void;
}

export default function AppDrawer({
  visible,
  theme,
  courses,
  androidBottomSafe,
  onClose,
  onNavigate,
}: AppDrawerProps) {
  const [catOrder, setCatOrder] = useState<string[]>(() => {
    try {
      const raw = getAppMeta('drawer_cat_order');
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length === 3) return parsed;
      }
    } catch {
      // default
    }
    return ['info', 'personal', 'management'];
  });

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({
    info: true,
    personal: true,
    management: true,
  });

  const [menuCatId, setMenuCatId] = useState<string | null>(null);

  const moveCategory = (catId: string, dir: -1 | 1) => {
    const idx = catOrder.indexOf(catId);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= catOrder.length) return;
    const next = [...catOrder];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed);
    setCatOrder(next);
    setAppMeta('drawer_cat_order', JSON.stringify(next));
    setMenuCatId(null);
  };

  const go = (dest: DrawerDestination) => {
    onClose();
    onNavigate(dest);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.panel,
            {
              backgroundColor: theme.surface,
              borderRightColor: theme.border,
              paddingBottom: androidBottomSafe + 10,
            },
          ]}
        >
          <View style={styles.heroCard}>
            <Text style={{ fontSize: 24, color: '#FFF' }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: '800' }}>
                NEXUS
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                Categorias & Guias
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800' }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              onPress={() => go({ kind: 'home' })}
              style={[
                styles.homeCard,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.accent,
                },
              ]}
            >
              <Text style={{ fontSize: 18, color: theme.accent }}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '800' }}>
                  Início (Pesquisa & IA)
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 11 }}>
                  Pesquisa multi-fontes e assistente
                </Text>
              </View>
            </TouchableOpacity>

            {catOrder.map((catId, catIdx) => {
              const cat = CATEGORIES_BY_ID[catId];
              if (!cat) return null;
              const isOpen = !!expandedMap[cat.id];

              return (
                <View
                  key={cat.id}
                  style={[
                    styles.catCard,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.catHeader}>
                    <TouchableOpacity
                      onPress={() =>
                        setExpandedMap((p) => ({ ...p, [cat.id]: !isOpen }))
                      }
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                    >
                      <Text style={{ fontSize: 20 }}>{cat.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
                          {cat.title}
                        </Text>
                        <Text style={{ color: theme.textDim, fontSize: 11 }}>
                          {cat.items.length} guia(s)
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        setMenuCatId((cur) => (cur === cat.id ? null : cat.id))
                      }
                      style={{ paddingHorizontal: 8, paddingVertical: 4 }}
                    >
                      <Text style={{ color: theme.textDim, fontSize: 16, fontWeight: '800' }}>
                        ⋮
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        setExpandedMap((p) => ({ ...p, [cat.id]: !isOpen }))
                      }
                      style={{ paddingHorizontal: 4 }}
                    >
                      <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '800' }}>
                        {isOpen ? '▴' : '▾'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {menuCatId === cat.id && (
                    <View
                      style={[
                        styles.reorderMenu,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                    >
                      <TouchableOpacity
                        disabled={catIdx === 0}
                        onPress={() => moveCategory(cat.id, -1)}
                        style={styles.reorderItem}
                      >
                        <Text
                          style={{
                            color: catIdx === 0 ? theme.textDim : theme.text,
                            fontSize: 13,
                            fontWeight: '600',
                          }}
                        >
                          ↑ Mover para cima
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={catIdx === catOrder.length - 1}
                        onPress={() => moveCategory(cat.id, 1)}
                        style={styles.reorderItem}
                      >
                        <Text
                          style={{
                            color:
                              catIdx === catOrder.length - 1
                                ? theme.textDim
                                : theme.text,
                            fontSize: 13,
                            fontWeight: '600',
                          }}
                        >
                          ↓ Mover para baixo
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isOpen && (
                    <View style={styles.catItemsWrap}>
                      {cat.items.map((item) => (
                        <TouchableOpacity
                          key={item.label}
                          onPress={() => go(item.dest)}
                          style={[
                            styles.catSubItem,
                            { backgroundColor: theme.surfaceAlt },
                          ]}
                        >
                          <Text style={{ fontSize: 15 }}>{item.icon}</Text>
                          <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {courses.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text
                  style={{
                    color: theme.textDim,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 1,
                    marginBottom: 6,
                    paddingHorizontal: 4,
                  }}
                >
                  ACESSO RÁPIDO — CURSOS
                </Text>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => go({ kind: 'courses', courseId: c.id })}
                    style={[
                      styles.catSubItem,
                      { backgroundColor: theme.bg, marginBottom: 6 },
                    ]}
                  >
                    <Text style={{ fontSize: 15 }}>📁</Text>
                    <Text
                      style={{ color: theme.textMuted, fontSize: 13, fontWeight: '600', flex: 1 }}
                      numberOfLines={1}
                    >
                      {c.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    width: '82%',
    maxWidth: 325,
    height: '100%',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 28) + 10 : 44,
    paddingHorizontal: 14,
    borderRightWidth: 1,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    marginBottom: 14,
  },
  homeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 12,
  },
  catCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reorderMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
  },
  reorderItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  catItemsWrap: {
    marginTop: 10,
    gap: 6,
  },
  catSubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 10,
  },
});
