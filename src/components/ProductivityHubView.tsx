import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CourseItem,
  CourseLessonItem,
  NexusNode,
} from '../database/db';
import { EditorTheme } from '../editor/blocks';
import {
  PRODUCTIVITY_CATEGORIES,
  ProductivityToolDef,
} from '../data/productivityCatalog';
import ProductivityToolRunner from './ProductivityTools';

interface ProductivityHubViewProps {
  nodes: NexusNode[];
  courses: CourseItem[];
  lessons: CourseLessonItem[];
  theme: EditorTheme;
  onBackHome: () => void;
  onOpenDrawer: () => void;
  onGoToTasks: () => void;
  onGoToSpaces: () => void;
  onOpenInBrowser?: (url: string, title: string) => void;
  onExportToSpaces: (title: string, serializedContent: string) => void;
}

export default function ProductivityHubView({
  nodes,
  courses,
  lessons,
  theme,
  onBackHome,
  onOpenDrawer,
  onGoToTasks,
  onGoToSpaces,
  onOpenInBrowser,
  onExportToSpaces,
}: ProductivityHubViewProps) {
  const [selectedTool, setSelectedTool] = useState<ProductivityToolDef | null>(
    null
  );
  const [search, setSearch] = useState('');

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedTool) {
        setSelectedTool(null);
        return true;
      }
      onBackHome();
      return true;
    });
    return () => sub.remove();
  }, [selectedTool, onBackHome]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PRODUCTIVITY_CATEGORIES;
    return PRODUCTIVITY_CATEGORIES.map((cat) => ({
      ...cat,
      tools: cat.tools.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.subtitle.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.tools.length > 0);
  }, [search]);

  const milanoteTool = useMemo(() => {
    for (const cat of PRODUCTIVITY_CATEGORIES) {
      const found = cat.tools.find((t) => t.kind === 'milanote');
      if (found) return found;
    }
    return null;
  }, []);

  const handlePressTool = (tool: ProductivityToolDef) => {
    if (tool.kind === 'tasks_link') {
      onGoToTasks();
      return;
    }
    if (tool.kind === 'spaces_link') {
      onGoToSpaces();
      return;
    }
    setSelectedTool(tool);
  };

  // Tela da ferramenta selecionada
  if (selectedTool) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => setSelectedTool(null)}
            style={styles.iconHit}
          >
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>
              ←
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22 }}>{selectedTool.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}
              numberOfLines={1}
            >
              {selectedTool.title}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 11 }} numberOfLines={1}>
              {selectedTool.subtitle}
            </Text>
          </View>
        </View>

        <ProductivityToolRunner
          tool={selectedTool}
          nodes={nodes}
          courses={courses}
          lessons={lessons}
          theme={theme}
          onOpenInBrowser={onOpenInBrowser}
          onExportToSpaces={onExportToSpaces}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={onOpenDrawer} style={styles.iconHit}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>
            ☰
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 19, fontWeight: '800' }}>
            Ferramentas Flow
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 11 }}>
            Métodos, estratégia, foco e métricas
          </Text>
        </View>
        <TouchableOpacity onPress={onBackHome} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
            Início
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.bodyScroll}
        keyboardShouldPersistTaps="handled"
      >
        {milanoteTool && (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => setSelectedTool(milanoteTool)}
            style={[
              styles.milanoteBanner,
              {
                backgroundColor: theme.isDark ? '#4A044E' : '#FCE7F3',
                borderColor: '#EC4899',
              },
            ]}
          >
            <Text style={{ fontSize: 24 }}>🎨</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: theme.isDark ? '#FBCFE8' : '#831843',
                  fontSize: 15,
                  fontWeight: '800',
                }}
              >
                Quadro de Visão (Estilo Milanote)
              </Text>
              <Text
                style={{
                  color: theme.isDark ? '#F472B6' : '#9D174D',
                  fontSize: 11,
                }}
              >
                Arraste cartões, desenhos, colunas, setas e sub-quadros
              </Text>
            </View>
            <Text
              style={{
                color: theme.isDark ? '#FBCFE8' : '#831843',
                fontSize: 18,
                fontWeight: '800',
              }}
            >
              ›
            </Text>
          </TouchableOpacity>
        )}

        <View
          style={[
            styles.searchPill,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ fontSize: 15, color: theme.textDim }}>🔍</Text>
          <TextInput
            style={{ flex: 1, color: theme.text, fontSize: 14, paddingVertical: 8 }}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar ferramenta (SWOT, Pomodoro, Ikigai...)..."
            placeholderTextColor={theme.textDim}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: theme.textDim, fontSize: 14 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {filteredCategories.map((cat) => (
          <View
            key={cat.id}
            style={[
              styles.categoryCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.catTitle, { color: theme.text }]}>
              {cat.title}
            </Text>

            <View style={styles.toolsGrid}>
              {cat.tools.map((tool) => (
                <TouchableOpacity
                  key={tool.id}
                  activeOpacity={0.85}
                  onPress={() => handlePressTool(tool)}
                  style={[
                    styles.toolTile,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconBadge,
                      { backgroundColor: `${tool.color}22` },
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{tool.icon}</Text>
                  </View>
                  <Text
                    style={{
                      color: theme.text,
                      fontSize: 12,
                      fontWeight: '700',
                      textAlign: 'center',
                      marginTop: 6,
                    }}
                    numberOfLines={2}
                  >
                    {tool.title}
                  </Text>
                  <Text
                    style={{
                      color: theme.textDim,
                      fontSize: 10,
                      textAlign: 'center',
                      marginTop: 2,
                    }}
                    numberOfLines={2}
                  >
                    {tool.subtitle}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
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
  iconHit: {
    padding: 4,
  },
  bodyScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  milanoteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 12,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 14,
  },
  categoryCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  catTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolTile: {
    width: '31.5%',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
