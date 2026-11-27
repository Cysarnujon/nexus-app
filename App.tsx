import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { StatusBar } from 'expo-status-bar';
import {
  CourseItem,
  CourseLessonItem,
  CourseModuleItem,
  LessonSourceType,
  NexusNode,
  NodeSnapshot,
  deleteCourseCascade,
  deleteCourseLesson,
  deleteCourseModuleCascade,
  deleteNodesByIds,
  exportBackupJson,
  getAllCourseLessons,
  getAllCourseModules,
  getAllCourses,
  getAllNodes,
  getAppMeta,
  getNodeSnapshots,
  importBackupJson,
  initDatabase,
  insertCourse,
  insertCourseLesson,
  insertCourseModule,
  insertNode,
  renameCourse,
  renameCourseModule,
  saveNodeSnapshot,
  setAllNodesExpanded,
  setAppMeta,
  setNodeExpanded,
  setNodeFavorite,
  swapCourseLessonOrder,
  swapCourseModuleOrder,
  swapCourseOrder,
  swapSiblingOrder,
  updateCourseLesson,
  updateNodeContent,
  updateNodeParent,
} from './src/database/db';
import BlockEditor from './src/components/BlockEditor';
import GraphView from './src/components/GraphView';
import { TagsView, TasksView } from './src/components/BrainViews';
import HomeSearchView, {
  SavedSearchItem,
  SearchSource,
} from './src/components/HomeSearchView';
import InAppBrowser from './src/components/InAppBrowser';
import CoursesView from './src/components/CoursesView';
import ProductivityHubView from './src/components/ProductivityHubView';
import InfoHubView, { InfoSubTab } from './src/components/InfoHubView';
import RoutineView from './src/components/RoutineView';
import MediaTrackerView, { TrackerTab } from './src/components/MediaTrackerView';
import AppDrawer, { DrawerDestination } from './src/components/AppDrawer';
import {
  DARK_THEME,
  DEFAULT_EDITOR_PREFS,
  DEFAULT_TOOLBAR_IDS,
  EditorPrefs,
  LIGHT_THEME,
  PAGE_TEMPLATES,
  ToolbarToolId,
  blocksToMarkdown,
  buildTemplateContent,
  createBlock,
  extractPlainTextFromContent,
  parseContentToBlocks,
  serializeBlocks,
} from './src/editor/blocks';
import { exportNoteToPdf, printNote } from './src/utils/media';

type MainTab = 'home' | 'spaces' | 'graph' | 'tags' | 'tasks';

type OverlayScreen =
  | null
  | { kind: 'courses'; courseId?: string | null }
  | { kind: 'productivity' }
  | { kind: 'info'; tab: InfoSubTab }
  | { kind: 'routine' }
  | { kind: 'tracker'; tab: TrackerTab };

interface BrowserSession {
  url: string;
  title: string;
  sourceId: string;
  sourceName: string;
  sourceIcon: string;
  query: string;
}

const ANDROID_BOTTOM_SAFE = Platform.OS === 'android' ? 48 : 0;

function extractTags(rawContent: string): string[] {
  const plain = extractPlainTextFromContent(rawContent);
  const matches = plain.match(/#[a-zA-Z0-9_À-ÿ]+/g) || [];
  return Array.from(new Set(matches));
}

function extractLinks(rawContent: string): string[] {
  const plain = extractPlainTextFromContent(rawContent);
  const matches: string[] = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(plain)) !== null) {
    if (match[1].trim()) matches.push(match[1].trim());
  }
  return Array.from(new Set(matches));
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${formatTime(timestamp)}`;
}

function normalizeTagsString(raw: string): string {
  const tokens = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));
  return Array.from(new Set(tokens)).join(' ');
}

function getDescendantIds(allNodes: NexusNode[], rootId: string): string[] {
  const result: string[] = [];
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const n of allNodes) {
      if (n.parentId === current) queue.push(n.id);
    }
  }
  return result;
}

export default function App() {
  const [nodes, setNodes] = useState<NexusNode[]>([]);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [courseModules, setCourseModules] = useState<CourseModuleItem[]>([]);
  const [courseLessons, setCourseLessons] = useState<CourseLessonItem[]>([]);

  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [overlayScreen, setOverlayScreen] = useState<OverlayScreen>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [editorPrefs, setEditorPrefs] = useState<EditorPrefs>(
    DEFAULT_EDITOR_PREFS
  );
  const [toolbarIds, setToolbarIds] = useState<ToolbarToolId[]>(
    DEFAULT_TOOLBAR_IDS
  );
  const [isZenMode, setIsZenMode] = useState(false);

  const [customSources, setCustomSources] = useState<SearchSource[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<SavedSearchItem[]>([]);
  const [browserSession, setBrowserSession] = useState<BrowserSession | null>(
    null
  );

  // Chave API & Resumo do Dia
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  const [newTopicModalVisible, setNewTopicModalVisible] = useState(false);
  const [newTopicParentId, setNewTopicParentId] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');

  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const [moveNodeId, setMoveNodeId] = useState<string | null>(null);
  const [historyModalNodeId, setHistoryModalNodeId] = useState<string | null>(
    null
  );
  const [snapshots, setSnapshots] = useState<NodeSnapshot[]>([]);
  const [editorRefreshKey, setEditorRefreshKey] = useState(0);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [backupJsonInput, setBackupJsonInput] = useState('');

  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  const reloadCoursesState = () => {
    setCourses(getAllCourses());
    setCourseModules(getAllCourseModules());
    setCourseLessons(getAllCourseLessons());
  };

  useEffect(() => {
    try {
      initDatabase();
      setNodes(getAllNodes());
      reloadCoursesState();

      const savedTheme = getAppMeta('theme');
      if (savedTheme === 'light') setIsDarkMode(false);

      const savedPrefs = getAppMeta('editor_prefs');
      if (savedPrefs) setEditorPrefs(JSON.parse(savedPrefs) as EditorPrefs);

      const savedToolbar = getAppMeta('toolbar_config');
      if (savedToolbar) {
        const parsedIds = JSON.parse(savedToolbar) as ToolbarToolId[];
        if (Array.isArray(parsedIds) && parsedIds.length > 0) {
          setToolbarIds(parsedIds);
        }
      }

      const rawSources = getAppMeta('custom_sources');
      if (rawSources) setCustomSources(JSON.parse(rawSources) as SearchSource[]);

      const rawSaved = getAppMeta('saved_searches');
      if (rawSaved) setSavedSearches(JSON.parse(rawSaved) as SavedSearchItem[]);

      const rawRecent = getAppMeta('recent_searches');
      if (rawRecent) setRecentSearches(JSON.parse(rawRecent) as SavedSearchItem[]);

      const savedKey = getAppMeta('gemini_api_key');
      if (savedKey) setGeminiApiKey(savedKey);
    } catch (error) {
      Alert.alert('Erro ao abrir banco', String(error));
    }
  }, []);

  const currentPageId =
    pageHistory.length > 0 ? pageHistory[pageHistory.length - 1] : null;

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === currentPageId) ?? null,
    [nodes, currentPageId]
  );

  const menuNode = useMemo(
    () => nodes.find((n) => n.id === menuNodeId) ?? null,
    [nodes, menuNodeId]
  );

  const moveNode = useMemo(
    () => nodes.find((n) => n.id === moveNodeId) ?? null,
    [nodes, moveNodeId]
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (browserSession) return false;
      if (summaryModalVisible) {
        setSummaryModalVisible(false);
        return true;
      }
      if (apiKeyModalVisible) {
        setApiKeyModalVisible(false);
        return true;
      }
      if (drawerVisible) {
        setDrawerVisible(false);
        return true;
      }
      if (backupModalVisible) {
        setBackupModalVisible(false);
        return true;
      }
      if (historyModalNodeId) {
        setHistoryModalNodeId(null);
        return true;
      }
      if (moveNodeId) {
        setMoveNodeId(null);
        return true;
      }
      if (menuNodeId) {
        setMenuNodeId(null);
        return true;
      }
      if (newTopicModalVisible) {
        setNewTopicModalVisible(false);
        return true;
      }
      if (
        overlayScreen?.kind === 'courses' ||
        overlayScreen?.kind === 'productivity'
      ) {
        return false;
      }
      if (overlayScreen) {
        setOverlayScreen(null);
        return true;
      }
      if (isZenMode) {
        setIsZenMode(false);
        return true;
      }
      if (pageHistory.length > 0) {
        setPageHistory((prev) => prev.slice(0, -1));
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [
    browserSession,
    summaryModalVisible,
    apiKeyModalVisible,
    drawerVisible,
    overlayScreen,
    backupModalVisible,
    historyModalNodeId,
    moveNodeId,
    menuNodeId,
    newTopicModalVisible,
    isZenMode,
    pageHistory,
    activeTab,
  ]);

  const handleDrawerNavigate = (dest: DrawerDestination) => {
    setPageHistory([]);
    if (dest.kind === 'home') {
      setOverlayScreen(null);
      setActiveTab('home');
    } else if (dest.kind === 'spaces') {
      setOverlayScreen(null);
      setActiveTab('spaces');
    } else if (dest.kind === 'courses') {
      setOverlayScreen({ kind: 'courses', courseId: dest.courseId ?? null });
    } else if (dest.kind === 'productivity') {
      setOverlayScreen({ kind: 'productivity' });
    } else if (dest.kind === 'info') {
      setOverlayScreen({ kind: 'info', tab: dest.tab });
    } else if (dest.kind === 'routine') {
      setOverlayScreen({ kind: 'routine' });
    } else if (dest.kind === 'tracker') {
      setOverlayScreen({ kind: 'tracker', tab: dest.tab });
    }
  };

  const handleGenerateDailySummary = async () => {
    setSummaryModalVisible(true);
    setSummaryLoading(true);

    const d = new Date();
    const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const timelineRaw = getAppMeta('routine_timeline');
    const timeline = timelineRaw
      ? (JSON.parse(timelineRaw) as { time: string; title: string }[])
      : [];

    const monthRaw = getAppMeta('routine_month_events');
    const monthEvents = monthRaw
      ? (JSON.parse(monthRaw) as { dateIso: string; title: string }[]).filter(
          (e) => e.dateIso === todayIso
        )
      : [];

    const dailyRaw = getAppMeta('routine_daily_tasks');
    const dailyPending = dailyRaw
      ? (JSON.parse(dailyRaw) as { title: string; done: boolean }[]).filter(
          (t) => !t.done
        )
      : [];

    const habitsRaw = getAppMeta('prod_habits');
    const habits = habitsRaw
      ? (JSON.parse(habitsRaw) as { title: string; streak: number; lastCheckedDate: string }[])
      : [];

    const offlineBrief = [
      `📅 ${d.toLocaleDateString('pt-BR')} — Seu Resumo do Dia`,
      '',
      `🕒 Linha do Tempo (${timeline.length}): ${
        timeline.length > 0
          ? timeline.map((t) => `${t.time} ${t.title}`).join(' • ')
          : 'Nenhum horário marcado.'
      }`,
      `📌 Agenda de Hoje (${monthEvents.length}): ${
        monthEvents.length > 0
          ? monthEvents.map((e) => e.title).join(', ')
          : 'Livre.'
      }`,
      `☑️ Tarefas Diárias Pendentes (${dailyPending.length}): ${
        dailyPending.length > 0
          ? dailyPending.map((t) => t.title).join(', ')
          : 'Tudo em dia!'
      }`,
      `🔥 Hábitos (${habits.length}): ${
        habits.length > 0
          ? habits
              .map(
                (h) =>
                  `${h.title} (${h.lastCheckedDate === todayIso ? '✓ feito' : 'pendente'}, ${h.streak}d)`
              )
              .join(' • ')
          : 'Nenhum cadastrado.'
      }`,
      `🧠 Segundo Cérebro: ${nodes.length} notas • 🎓 ${courses.length} cursos (${courseLessons.filter((l) => l.isCompleted).length}/${courseLessons.length} aulas concluídas).`,
    ].join('\n');

    if (!geminiApiKey.trim()) {
      setSummaryText(
        `${offlineBrief}\n\n💡 Dica: Adicione uma Chave API do Gemini no botão 🔑 para gerar análises inteligentes personalizadas com IA!`
      );
      setSummaryLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Você é o assistente pessoal do app Nexus. Com base nestes dados reais de hoje, crie um resumo motivador, direto e prático em português com 3 prioridades sugeridas:\n\n${offlineBrief}`,
                  },
                ],
              },
            ],
          }),
        }
      );
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const aiReply = json.candidates?.[0]?.content?.parts?.[0]?.text;
      setSummaryText(aiReply || offlineBrief);
    } catch {
      setSummaryText(offlineBrief);
    } finally {
      setSummaryLoading(false);
    }
  };

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    setAppMeta('theme', nextDark ? 'dark' : 'light');
  };

  const handlePrefsChange = (nextPrefs: EditorPrefs) => {
    setEditorPrefs(nextPrefs);
    setAppMeta('editor_prefs', JSON.stringify(nextPrefs));
  };

  const handleToolbarChange = (nextIds: ToolbarToolId[]) => {
    setToolbarIds(nextIds);
    setAppMeta('toolbar_config', JSON.stringify(nextIds));
  };

  const handleAddCustomSource = (src: SearchSource) => {
    const next = [...customSources, src];
    setCustomSources(next);
    setAppMeta('custom_sources', JSON.stringify(next));
  };

  const handleDeleteCustomSource = (id: string) => {
    const next = customSources.filter((s) => s.id !== id);
    setCustomSources(next);
    setAppMeta('custom_sources', JSON.stringify(next));
  };

  const handleSaveSearch = (item: SavedSearchItem) => {
    const next = [
      item,
      ...savedSearches.filter(
        (s) => !(s.url === item.url && s.query === item.query)
      ),
    ];
    setSavedSearches(next);
    setAppMeta('saved_searches', JSON.stringify(next));
  };

  const handleDeleteSavedSearch = (id: string) => {
    const next = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(next);
    setAppMeta('saved_searches', JSON.stringify(next));
  };

  const handleClearRecentSearches = () => {
    setRecentSearches([]);
    setAppMeta('recent_searches', '[]');
  };

  const handleOpenWebUrl = (
    url: string,
    title: string,
    source: SearchSource,
    query: string
  ) => {
    if (query.trim()) {
      const rec: SavedSearchItem = {
        id: `rec-${Date.now()}`,
        query: query.trim(),
        sourceId: source.id,
        sourceName: source.name,
        sourceIcon: source.icon,
        url,
        createdAt: Date.now(),
      };
      const nextRecent = [
        rec,
        ...recentSearches.filter(
          (r) =>
            !(
              r.query.toLowerCase() === rec.query.toLowerCase() &&
              r.sourceId === rec.sourceId
            )
        ),
      ].slice(0, 10);
      setRecentSearches(nextRecent);
      setAppMeta('recent_searches', JSON.stringify(nextRecent));
    }

    setBrowserSession({
      url,
      title,
      sourceId: source.id,
      sourceName: source.name,
      sourceIcon: source.icon,
      query,
    });
  };

  const handleSaveLinkToSpace = (params: {
    title: string;
    url: string;
    targetNodeId: string | null;
    mode: 'new_page' | 'append_block';
    tagsText: string;
  }) => {
    const cleanTags = normalizeTagsString(params.tagsText);
    const linkBlock = createBlock('bookmark', params.title, { url: params.url });
    const blocksToAdd = cleanTags
      ? [linkBlock, createBlock('paragraph', cleanTags)]
      : [linkBlock];

    if (params.mode === 'append_block' && params.targetNodeId) {
      const target = nodes.find((n) => n.id === params.targetNodeId);
      if (target) {
        const existingBlocks = parseContentToBlocks(target.content);
        const merged = [...existingBlocks, ...blocksToAdd];
        const serialized = serializeBlocks(merged);
        const updatedAt = updateNodeContent(target.id, target.title, serialized);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === target.id
              ? { ...n, content: serialized, updatedAt }
              : n
          )
        );
        setEditorRefreshKey((k) => k + 1);
        return;
      }
    }

    const created = insertNode({
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      parentId: params.targetNodeId,
      title: params.title,
      content: serializeBlocks(blocksToAdd),
      isExpanded: true,
      isFavorite: false,
    });

    if (params.targetNodeId) {
      setNodeExpanded(params.targetNodeId, true);
    }

    setNodes((prev) =>
      prev
        .map((n) =>
          n.id === params.targetNodeId ? { ...n, isExpanded: true } : n
        )
        .concat(created)
    );
  };

  const handleExportProductivityToSpaces = (
    title: string,
    serializedContent: string
  ) => {
    const created = insertNode({
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      parentId: null,
      title,
      content: serializedContent,
      isExpanded: true,
      isFavorite: false,
    });
    setNodes((prev) => [...prev, created]);
    Alert.alert(
      'Salvo nos Espaços!',
      `"${title}" foi adicionado às suas notas do Nexus.`
    );
  };

  const handleCreateCourse = (title: string) => {
    const created = insertCourse(title);
    setCourses((prev) => [...prev, created]);
  };

  const handleRenameCourse = (id: string, title: string) => {
    renameCourse(id, title);
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const handleSwapCourseOrder = (
    idA: string,
    orderA: number,
    idB: string,
    orderB: number
  ) => {
    swapCourseOrder(idA, orderA, idB, orderB);
    setCourses((prev) =>
      prev
        .map((c) => {
          if (c.id === idA) return { ...c, sortOrder: orderB };
          if (c.id === idB) return { ...c, sortOrder: orderA };
          return c;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
  };

  const handleDeleteCourse = (id: string) => {
    deleteCourseCascade(id);
    reloadCoursesState();
  };

  const handleCreateModule = (courseId: string, title: string) => {
    const created = insertCourseModule(courseId, title);
    setCourseModules((prev) => [...prev, created]);
  };

  const handleRenameModule = (id: string, title: string) => {
    renameCourseModule(id, title);
    setCourseModules((prev) =>
      prev.map((m) => (m.id === id ? { ...m, title } : m))
    );
  };

  const handleSwapModuleOrder = (
    idA: string,
    orderA: number,
    idB: string,
    orderB: number
  ) => {
    swapCourseModuleOrder(idA, orderA, idB, orderB);
    setCourseModules((prev) =>
      prev
        .map((m) => {
          if (m.id === idA) return { ...m, sortOrder: orderB };
          if (m.id === idB) return { ...m, sortOrder: orderA };
          return m;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
  };

  const handleDeleteModule = (id: string) => {
    deleteCourseModuleCascade(id);
    reloadCoursesState();
  };

  const handleCreateLesson = (params: {
    moduleId: string;
    courseId: string;
    title: string;
    sourceType: LessonSourceType;
    mediaUri: string;
  }) => {
    const created = insertCourseLesson(params);
    setCourseLessons((prev) => [...prev, created]);
  };

  const handleUpdateLesson = (
    id: string,
    patch: Partial<
      Pick<
        CourseLessonItem,
        | 'title'
        | 'sourceType'
        | 'mediaUri'
        | 'isCompleted'
        | 'notes'
        | 'questions'
        | 'links'
      >
    >
  ) => {
    updateCourseLesson(id, patch);
    setCourseLessons((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  };

  const handleSwapLessonOrder = (
    idA: string,
    orderA: number,
    idB: string,
    orderB: number
  ) => {
    swapCourseLessonOrder(idA, orderA, idB, orderB);
    setCourseLessons((prev) =>
      prev
        .map((l) => {
          if (l.id === idA) return { ...l, sortOrder: orderB };
          if (l.id === idB) return { ...l, sortOrder: orderA };
          return l;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
  };

  const handleDeleteLesson = (id: string) => {
    deleteCourseLesson(id);
    setCourseLessons((prev) => prev.filter((l) => l.id !== id));
  };

  const handleExportLessonNotesToNexus = (lesson: CourseLessonItem) => {
    const blocks = [createBlock('h2', `Resumo: ${lesson.title}`)];
    if (
      lesson.mediaUri &&
      (lesson.sourceType === 'youtube' || lesson.sourceType === 'site')
    ) {
      blocks.push(
        createBlock('bookmark', lesson.title, { url: lesson.mediaUri })
      );
    }
    if (lesson.notes.trim()) {
      blocks.push(createBlock('paragraph', lesson.notes.trim()));
    }
    if (lesson.questions.length > 0) {
      blocks.push(createBlock('h3', 'Perguntas e Dúvidas'));
      for (const q of lesson.questions) {
        blocks.push(
          createBlock(
            'callout',
            `${q.question}${q.answer ? `\nResposta: ${q.answer}` : ''}`,
            { calloutVariant: 'question' }
          )
        );
      }
    }
    blocks.push(createBlock('paragraph', '#cursos #estudos'));

    const parent =
      nodes.find((n) => n.title.toLowerCase() === 'estudos') ?? null;

    const created = insertNode({
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      parentId: parent ? parent.id : null,
      title: `Aula: ${lesson.title}`,
      content: serializeBlocks(blocks),
      isExpanded: true,
      isFavorite: false,
    });

    if (parent) setNodeExpanded(parent.id, true);
    setNodes((prev) =>
      prev
        .map((n) => (n.id === parent?.id ? { ...n, isExpanded: true } : n))
        .concat(created)
    );
    Alert.alert(
      'Enviado para Espaços!',
      `A nota "Aula: ${lesson.title}" foi salva no seu Segundo Cérebro.`
    );
  };

  const openPage = (id: string) => {
    setOverlayScreen(null);
    setPageHistory((prev) => {
      if (prev[prev.length - 1] === id) return prev;
      return [...prev, id];
    });
  };

  const goBackPage = () => {
    setIsZenMode(false);
    setPageHistory((prev) => prev.slice(0, -1));
  };

  const goHome = () => {
    setIsZenMode(false);
    setPageHistory([]);
  };

  const toggleExpand = (id: string) => {
    const target = nodes.find((n) => n.id === id);
    if (!target) return;
    const nextExpanded = !target.isExpanded;
    setNodeExpanded(id, nextExpanded);
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isExpanded: nextExpanded } : n))
    );
  };

  const anyExpanded = useMemo(() => nodes.some((n) => n.isExpanded), [nodes]);

  const toggleExpandAll = () => {
    const nextState = !anyExpanded;
    setAllNodesExpanded(nextState);
    setNodes((prev) => prev.map((n) => ({ ...n, isExpanded: nextState })));
  };

  const openCreateModal = (parentId: string | null) => {
    setNewTopicParentId(parentId);
    setNewTopicTitle('');
    setSelectedTemplateId('blank');
    setNewTopicModalVisible(true);
  };

  const createTopic = () => {
    const trimmed = newTopicTitle.trim();
    if (!trimmed) return;

    const created = insertNode({
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      parentId: newTopicParentId,
      title: trimmed,
      content: buildTemplateContent(selectedTemplateId),
      isExpanded: true,
      isFavorite: false,
    });

    if (newTopicParentId) setNodeExpanded(newTopicParentId, true);

    setNodes((prev) =>
      prev
        .map((n) =>
          n.id === newTopicParentId ? { ...n, isExpanded: true } : n
        )
        .concat(created)
    );
    setNewTopicModalVisible(false);
    setNewTopicTitle('');
  };

  const handleEditPage = (id: string, title: string, content: string) => {
    const updatedAt = updateNodeContent(id, title, content);
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, title, content, updatedAt } : n
      )
    );
  };

  const handleToggleGlobalTask = (nodeId: string, blockId: string) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const blocks = parseContentToBlocks(target.content).map((b) =>
      b.id === blockId ? { ...b, checked: !b.checked } : b
    );
    handleEditPage(target.id, target.title, serializeBlocks(blocks));
  };

  const toggleFavorite = (id: string) => {
    const target = nodes.find((n) => n.id === id);
    if (!target) return;
    const nextFav = !target.isFavorite;
    setNodeFavorite(id, nextFav);
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isFavorite: nextFav } : n))
    );
  };

  const moveSibling = (id: string, direction: 'up' | 'down') => {
    const current = nodes.find((n) => n.id === id);
    if (!current) return;

    const siblings = nodes
      .filter((n) => n.parentId === current.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = siblings.findIndex((s) => s.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || swapIdx < 0 || swapIdx >= siblings.length) return;

    const other = siblings[swapIdx];
    const orderA = current.sortOrder === other.sortOrder ? idx : current.sortOrder;
    const orderB = current.sortOrder === other.sortOrder ? swapIdx : other.sortOrder;

    swapSiblingOrder(current.id, orderA, other.id, orderB);
    setNodes((prev) =>
      prev
        .map((n) => {
          if (n.id === current.id) return { ...n, sortOrder: orderB };
          if (n.id === other.id) return { ...n, sortOrder: orderA };
          return n;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
  };

  const confirmDeleteNode = (node: NexusNode) => {
    const idsToDelete = getDescendantIds(nodes, node.id);
    const subCount = idsToDelete.length - 1;
    const msg =
      subCount > 0
        ? `Tem certeza que deseja excluir "${node.title}" e seus ${subCount} subtópico(s)?`
        : `Tem certeza que deseja excluir "${node.title}"?`;

    Alert.alert('Excluir tópico', msg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteNodesByIds(idsToDelete);
          setNodes((prev) => prev.filter((n) => !idsToDelete.includes(n.id)));
          setPageHistory((prev) =>
            prev.filter((pid) => !idsToDelete.includes(pid))
          );
          setMenuNodeId(null);
        },
      },
    ]);
  };

  const handleMoveToParent = (targetParentId: string | null) => {
    if (!moveNode) return;
    const newOrder = updateNodeParent(moveNode.id, targetParentId);
    if (targetParentId) setNodeExpanded(targetParentId, true);
    setNodes((prev) =>
      prev
        .map((n) => {
          if (n.id === moveNode.id) {
            return { ...n, parentId: targetParentId, sortOrder: newOrder };
          }
          if (n.id === targetParentId) return { ...n, isExpanded: true };
          return n;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
    setMoveNodeId(null);
  };

  const openLinkedNoteByTitle = (title: string) => {
    const found = nodes.find(
      (n) => n.title.toLowerCase() === title.toLowerCase()
    );
    if (found) {
      openPage(found.id);
    } else {
      const created = insertNode({
        id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        parentId: null,
        title,
        content: 'Página criada automaticamente a partir de um link.\n#nova',
        isExpanded: false,
        isFavorite: false,
      });
      setNodes((prev) => [...prev, created]);
      openPage(created.id);
    }
  };

  const getBreadcrumbs = (node: NexusNode): NexusNode[] => {
    const trail: NexusNode[] = [];
    let current: NexusNode | undefined = node;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      trail.unshift(current);
      current = nodes.find((n) => n.id === current?.parentId);
    }
    return trail;
  };

  const getBacklinks = (targetTitle: string, currentId: string): NexusNode[] => {
    const lowerTarget = targetTitle.trim().toLowerCase();
    if (!lowerTarget) return [];
    return nodes.filter((n) => {
      if (n.id === currentId) return false;
      const links = extractLinks(n.content).map((l) => l.toLowerCase());
      return links.includes(lowerTarget);
    });
  };

  const renderTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const children = nodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return children.map((node) => {
      const hasChildren = nodes.some((n) => n.parentId === node.id);
      const tags = extractTags(node.content);

      return (
        <View key={node.id}>
          <View
            style={[
              styles.treeRow,
              { paddingLeft: 10 + depth * 18, borderBottomColor: theme.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => toggleExpand(node.id)}
              style={styles.expandBtn}
            >
              <Text style={[styles.expandIcon, { color: theme.textDim }]}>
                {hasChildren ? (node.isExpanded ? '▾' : '▸') : '•'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.treeTitleArea}
              onPress={() => openPage(node.id)}
            >
              <Text style={[styles.treeTitle, { color: theme.text }]} numberOfLines={1}>
                {node.isFavorite ? '★ ' : ''}
                {node.title}
              </Text>
              {tags.length > 0 && (
                <Text style={styles.treeTagsPreview} numberOfLines={1}>
                  {tags.slice(0, 3).join(' ')}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openCreateModal(node.id)}
              style={[styles.iconActionBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={[styles.iconActionText, { color: theme.textMuted }]}>
                +
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuNodeId(node.id)}
              style={[styles.iconActionBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={[styles.iconActionText, { color: theme.textMuted }]}>
                ⋯
              </Text>
            </TouchableOpacity>
          </View>
          {node.isExpanded && hasChildren && renderTree(node.id, depth + 1)}
        </View>
      );
    });
  };

  const favoriteNodes = useMemo(() => nodes.filter((n) => n.isFavorite), [nodes]);
  const availableNoteTitles = useMemo(() => nodes.map((n) => n.title), [nodes]);
  const invalidMoveTargets = useMemo(() => {
    if (!moveNode) return new Set<string>();
    return new Set(getDescendantIds(nodes, moveNode.id));
  }, [nodes, moveNode]);

  function renderModals() {
    return (
      <>
        {/* Modal Chave API Gemini */}
        <Modal
          visible={apiKeyModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setApiKeyModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                🔑 Chave API do Gemini
              </Text>
              <Text style={{ color: theme.textDim, fontSize: 12, marginBottom: 10 }}>
                Opcional: cole sua chave gratuita do Google AI Studio para o "Resumo do Dia" gerar respostas com inteligência artificial.
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={apiKeyDraft}
                onChangeText={setApiKeyDraft}
                placeholder="AIza..."
                placeholderTextColor={theme.textDim}
                autoCapitalize="none"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setApiKeyModalVisible(false)} style={styles.modalCancel}>
                  <Text style={{ color: theme.textDim }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    const clean = apiKeyDraft.trim();
                    setGeminiApiKey(clean);
                    setAppMeta('gemini_api_key', clean);
                    setApiKeyModalVisible(false);
                    Alert.alert(clean ? 'Chave salva!' : 'Chave removida');
                  }}
                  style={[styles.modalConfirm, { backgroundColor: theme.accent }]}
                >
                  <Text style={styles.modalConfirmText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Resumo do Dia */}
        <Modal
          visible={summaryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSummaryModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '80%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                ✦ Resumo do Dia
              </Text>
              {summaryLoading ? (
                <ActivityIndicator size="large" color={theme.accent} style={{ marginVertical: 24 }} />
              ) : (
                <ScrollView>
                  <Text style={{ color: theme.textMuted, fontSize: 14, lineHeight: 22 }}>
                    {summaryText}
                  </Text>
                </ScrollView>
              )}
              <TouchableOpacity onPress={() => setSummaryModalVisible(false)} style={styles.menuCloseBtn}>
                <Text style={{ color: theme.accent, fontWeight: '700' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={newTopicModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNewTopicModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {newTopicParentId ? 'Novo Subtópico' : 'Novo Espaço'}
              </Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={newTopicTitle}
                onChangeText={setNewTopicTitle}
                placeholder="Digite o nome..."
                placeholderTextColor={theme.textDim}
                autoFocus
              />
              <Text style={[styles.templateHeading, { color: theme.textDim }]}>
                ESCOLHER MODELO:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
                {PAGE_TEMPLATES.map((tpl) => {
                  const active = selectedTemplateId === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[
                        styles.templateChip,
                        {
                          backgroundColor: active ? theme.accent : theme.surfaceAlt,
                          borderColor: active ? theme.accent : theme.border,
                        },
                      ]}
                      onPress={() => setSelectedTemplateId(tpl.id)}
                    >
                      <Text style={{ color: active ? '#FFF' : theme.textMuted, fontSize: 12, fontWeight: '600' }}>
                        {tpl.icon} {tpl.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setNewTopicModalVisible(false)} style={styles.modalCancel}>
                  <Text style={{ color: theme.textDim, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={createTopic} style={[styles.modalConfirm, { backgroundColor: theme.accent }]}>
                  <Text style={styles.modalConfirmText}>Criar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!menuNode}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuNodeId(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '86%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
                {menuNode?.title}
              </Text>
              <ScrollView>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    const id = menuNode.id;
                    setMenuNodeId(null);
                    openPage(id);
                  }}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>📄 Abrir como página</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    const id = menuNode.id;
                    setMenuNodeId(null);
                    openCreateModal(id);
                  }}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>➕ Criar subtópico dentro</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    toggleFavorite(menuNode.id);
                    setMenuNodeId(null);
                  }}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>
                    {menuNode?.isFavorite ? '☆ Remover dos favoritos' : '★ Adicionar aos favoritos'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.menuRowSplit}>
                  <TouchableOpacity
                    style={[styles.menuHalfBtn, { backgroundColor: theme.surfaceAlt }]}
                    onPress={() => { if (menuNode) moveSibling(menuNode.id, 'up'); }}
                  >
                    <Text style={[styles.menuItemText, { color: theme.text }]}>↑ Subir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.menuHalfBtn, { backgroundColor: theme.surfaceAlt }]}
                    onPress={() => { if (menuNode) moveSibling(menuNode.id, 'down'); }}
                  >
                    <Text style={[styles.menuItemText, { color: theme.text }]}>↓ Descer</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    const id = menuNode.id;
                    setMenuNodeId(null);
                    setMoveNodeId(id);
                  }}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>📁 Mover para outro local</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    saveNodeSnapshot(menuNode.id, menuNode.title, menuNode.content);
                    setMenuNodeId(null);
                    Alert.alert('Versão salva!', 'Ponto de restauração salvo no histórico.');
                  }}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>💾 Salvar versão (Snapshot)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    const id = menuNode.id;
                    setMenuNodeId(null);
                    setSnapshots(getNodeSnapshots(id));
                    setHistoryModalNodeId(id);
                  }}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>🕒 Histórico de versões</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    const target = menuNode;
                    setMenuNodeId(null);
                    exportNoteToPdf(target.title, target.content).catch((e) =>
                      Alert.alert('Erro PDF', String(e))
                    );
                  }}
                >
                  <Text style={[styles.menuItemText, { color: '#F43F5E' }]}>📕 Exportar PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    const target = menuNode;
                    setMenuNodeId(null);
                    printNote(target.title, target.content).catch((e) =>
                      Alert.alert('Erro', String(e))
                    );
                  }}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>🖨 Imprimir página</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => {
                    if (!menuNode) return;
                    const target = menuNode;
                    setMenuNodeId(null);
                    Share.share({
                      title: `${target.title}.md`,
                      message: blocksToMarkdown(target.title, target.content),
                    });
                  }}
                >
                  <Text style={[styles.menuItemText, { color: '#38BDF8' }]}>📤 Exportar como Markdown</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, styles.menuDanger]}
                  onPress={() => { if (menuNode) confirmDeleteNode(menuNode); }}
                >
                  <Text style={styles.menuDangerText}>🗑 Excluir tópico</Text>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setMenuNodeId(null)}>
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!moveNode}
          transparent
          animationType="fade"
          onRequestClose={() => setMoveNodeId(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '75%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Mover "{moveNode?.title}" para:
              </Text>
              <ScrollView>
                <TouchableOpacity
                  style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => handleMoveToParent(null)}
                >
                  <Text style={[styles.menuItemText, { color: theme.text }]}>🏠 Início (Raiz)</Text>
                </TouchableOpacity>
                {nodes
                  .filter((candidate) => !invalidMoveTargets.has(candidate.id))
                  .map((candidate) => (
                    <TouchableOpacity
                      key={candidate.id}
                      style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                      onPress={() => handleMoveToParent(candidate.id)}
                    >
                      <Text style={[styles.menuItemText, { color: theme.text }]} numberOfLines={1}>
                        📂 {candidate.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setMoveNodeId(null)}>
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!historyModalNodeId}
          transparent
          animationType="fade"
          onRequestClose={() => setHistoryModalNodeId(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '75%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🕒 Histórico de Versões</Text>
              {snapshots.length === 0 ? (
                <Text style={{ color: theme.textDim, fontSize: 13 }}>
                  Nenhuma versão salva ainda.
                </Text>
              ) : (
                <ScrollView>
                  {snapshots.map((snap) => (
                    <TouchableOpacity
                      key={snap.id}
                      style={[styles.menuItem, { backgroundColor: theme.surfaceAlt }]}
                      onPress={() => {
                        handleEditPage(snap.nodeId, snap.title, snap.content);
                        setEditorRefreshKey((k) => k + 1);
                        setHistoryModalNodeId(null);
                      }}
                    >
                      <Text style={[styles.menuItemText, { color: theme.text }]}>
                        ↺ {formatDateTime(snap.createdAt)}
                      </Text>
                      <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                        {snap.title} — {extractPlainTextFromContent(snap.content)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity style={styles.menuCloseBtn} onPress={() => setHistoryModalNodeId(null)}>
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={backupModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setBackupModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '82%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>💾 Backup Completo</Text>
              <TouchableOpacity
                style={styles.backupExportBtn}
                onPress={() =>
                  Share.share({ title: 'nexus-backup.json', message: exportBackupJson() })
                }
              >
                <Text style={styles.backupExportText}>📤 Exportar / Compartilhar Backup JSON</Text>
              </TouchableOpacity>
              <Text style={[styles.templateHeading, { color: theme.textDim }]}>
                RESTAURAR BACKUP (COLAR JSON):
              </Text>
              <TextInput
                style={[styles.backupInput, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={backupJsonInput}
                onChangeText={setBackupJsonInput}
                multiline
                placeholder="Cole aqui o JSON exportado..."
                placeholderTextColor={theme.textDim}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setBackupModalVisible(false)} style={styles.modalCancel}>
                  <Text style={{ color: theme.textDim }}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    try {
                      const c = importBackupJson(backupJsonInput.trim());
                      setNodes(getAllNodes());
                      reloadCoursesState();
                      setBackupJsonInput('');
                      setBackupModalVisible(false);
                      Alert.alert('Restaurado!', `${c} nota(s) importada(s).`);
                    } catch (e) {
                      Alert.alert('Erro', String(e));
                    }
                  }}
                  style={[styles.modalConfirm, { backgroundColor: theme.accent }]}
                >
                  <Text style={styles.modalConfirmText}>Restaurar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        paddingBottom: ANDROID_BOTTOM_SAFE,
      }}
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {overlayScreen?.kind === 'info' ? (
        <InfoHubView
          initialTab={overlayScreen.tab}
          theme={theme}
          onOpenDrawer={() => setDrawerVisible(true)}
          onBackHome={() => {
            setOverlayScreen(null);
            setActiveTab('home');
          }}
          onOpenInBrowser={(url, title) =>
            setBrowserSession({
              url,
              title,
              sourceId: 'info',
              sourceName: title,
              sourceIcon: '🌐',
              query: title,
            })
          }
        />
      ) : overlayScreen?.kind === 'routine' ? (
        <RoutineView
          theme={theme}
          onOpenDrawer={() => setDrawerVisible(true)}
          onBackHome={() => {
            setOverlayScreen(null);
            setActiveTab('home');
          }}
        />
      ) : overlayScreen?.kind === 'tracker' ? (
        <MediaTrackerView
          initialTab={overlayScreen.tab}
          theme={theme}
          onOpenDrawer={() => setDrawerVisible(true)}
          onBackHome={() => {
            setOverlayScreen(null);
            setActiveTab('home');
          }}
        />
      ) : overlayScreen?.kind === 'productivity' ? (
        <ProductivityHubView
          nodes={nodes}
          courses={courses}
          lessons={courseLessons}
          theme={theme}
          onBackHome={() => {
            setOverlayScreen(null);
            setActiveTab('home');
          }}
          onOpenDrawer={() => setDrawerVisible(true)}
          onGoToTasks={() => {
            setOverlayScreen(null);
            setActiveTab('tasks');
          }}
          onGoToSpaces={() => {
            setOverlayScreen(null);
            setActiveTab('spaces');
          }}
          onOpenInBrowser={(url, title) =>
            setBrowserSession({
              url,
              title,
              sourceId: 'milanote',
              sourceName: title,
              sourceIcon: '🎨',
              query: title,
            })
          }
          onExportToSpaces={handleExportProductivityToSpaces}
        />
      ) : overlayScreen?.kind === 'courses' ? (
        <CoursesView
          courses={courses}
          modules={courseModules}
          lessons={courseLessons}
          initialCourseId={overlayScreen.courseId ?? null}
          theme={theme}
          onBackHome={() => {
            setOverlayScreen(null);
            setActiveTab('home');
          }}
          onOpenDrawer={() => setDrawerVisible(true)}
          onCreateCourse={handleCreateCourse}
          onRenameCourse={handleRenameCourse}
          onSwapCourseOrder={handleSwapCourseOrder}
          onDeleteCourse={handleDeleteCourse}
          onCreateModule={handleCreateModule}
          onRenameModule={handleRenameModule}
          onSwapModuleOrder={handleSwapModuleOrder}
          onDeleteModule={handleDeleteModule}
          onCreateLesson={handleCreateLesson}
          onUpdateLesson={handleUpdateLesson}
          onSwapLessonOrder={handleSwapLessonOrder}
          onDeleteLesson={handleDeleteLesson}
          onOpenInBrowser={(url, title, sourceId) =>
            setBrowserSession({
              url,
              title,
              sourceId,
              sourceName: title,
              sourceIcon: sourceId === 'youtube' ? '▶' : '🌐',
              query: title,
            })
          }
          onExportNotesToNexus={handleExportLessonNotesToNexus}
        />
      ) : selectedNode ? (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
          {!isZenMode && (
            <View style={[styles.pageHeader, { borderBottomColor: theme.border }]}>
              <View style={styles.pageHeaderLeft}>
                <TouchableOpacity onPress={goBackPage} style={styles.backBtn}>
                  <Text style={{ color: theme.accent, fontSize: 15, fontWeight: '600' }}>← Voltar</Text>
                </TouchableOpacity>
                {pageHistory.length > 1 && (
                  <TouchableOpacity
                    onPress={goHome}
                    style={[styles.homeChip, { backgroundColor: theme.surfaceAlt }]}
                  >
                    <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>Início</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.pageHeaderRight}>
                <Text style={styles.savedBadge}>Salvo ✓ {formatTime(selectedNode.updatedAt)}</Text>
                <TouchableOpacity onPress={toggleTheme} style={[styles.favBtn, { backgroundColor: theme.surfaceAlt }]}>
                  <Text style={{ fontSize: 13 }}>{isDarkMode ? '☀' : '🌙'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => toggleFavorite(selectedNode.id)} style={[styles.favBtn, { backgroundColor: theme.surfaceAlt }]}>
                  <Text style={styles.favBtnText}>{selectedNode.isFavorite ? '★' : '☆'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMenuNodeId(selectedNode.id)} style={[styles.favBtn, { backgroundColor: theme.surfaceAlt }]}>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>⋯</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ScrollView style={styles.pageScroll} keyboardShouldPersistTaps="handled">
            {!isZenMode && (
              <View style={styles.breadcrumbRow}>
                {getBreadcrumbs(selectedNode).map((crumb, idx) => (
                  <View key={crumb.id} style={styles.breadcrumbItem}>
                    {idx > 0 && <Text style={{ color: theme.textDim, fontSize: 12 }}> › </Text>}
                    <TouchableOpacity onPress={() => openPage(crumb.id)}>
                      <Text style={{ color: theme.textDim, fontSize: 12 }}>{crumb.title}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TextInput
              style={[styles.pageTitleInput, { color: theme.text }]}
              value={selectedNode.title}
              onChangeText={(text) => handleEditPage(selectedNode.id, text, selectedNode.content)}
              placeholder="Título da página"
              placeholderTextColor={theme.textDim}
            />

            <BlockEditor
              noteId={`${selectedNode.id}-${editorRefreshKey}`}
              rawContent={selectedNode.content}
              availableNoteTitles={availableNoteTitles.filter((t) => t !== selectedNode.title)}
              theme={theme}
              prefs={editorPrefs}
              toolbarIds={toolbarIds}
              isZenMode={isZenMode}
              onChangePrefs={handlePrefsChange}
              onChangeToolbar={handleToolbarChange}
              onToggleZenMode={() => setIsZenMode((z) => !z)}
              onChangeSerialized={(serialized) =>
                handleEditPage(selectedNode.id, selectedNode.title, serialized)
              }
              onPressInternalLink={openLinkedNoteByTitle}
            />

            {!isZenMode && (
              <>
                <View style={[styles.sectionBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
                      Subtópicos ({nodes.filter((n) => n.parentId === selectedNode.id).length})
                    </Text>
                    <TouchableOpacity onPress={() => openCreateModal(selectedNode.id)}>
                      <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                        + Novo subtópico
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {nodes
                    .filter((n) => n.parentId === selectedNode.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((sub) => (
                      <TouchableOpacity
                        key={sub.id}
                        style={[styles.subpageCard, { backgroundColor: theme.surfaceAlt }]}
                        onPress={() => openPage(sub.id)}
                      >
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>📄 {sub.title}</Text>
                      </TouchableOpacity>
                    ))}
                </View>

                {(extractTags(selectedNode.content).length > 0 || extractLinks(selectedNode.content).length > 0) && (
                  <View style={[styles.sectionBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.sectionLabel, { color: theme.textDim }]}>Conexões e Tags</Text>
                    <View style={styles.chipsWrap}>
                      {extractTags(selectedNode.content).map((tag) => (
                        <View key={tag} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag}</Text>
                        </View>
                      ))}
                      {extractLinks(selectedNode.content).map((link) => (
                        <TouchableOpacity key={link} style={styles.linkChip} onPress={() => openLinkedNoteByTitle(link)}>
                          <Text style={styles.linkChipText}>[[{link}]]</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={[styles.sectionBox, { marginBottom: 32, backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.sectionLabel, { color: theme.textDim }]}>
                    Backlinks ({getBacklinks(selectedNode.title, selectedNode.id).length})
                  </Text>
                  {getBacklinks(selectedNode.title, selectedNode.id).length === 0 ? (
                    <Text style={{ color: theme.textDim, fontSize: 13 }}>
                      Nenhuma outra nota cita [[{selectedNode.title}]] ainda.
                    </Text>
                  ) : (
                    getBacklinks(selectedNode.title, selectedNode.id).map((bl) => (
                      <TouchableOpacity
                        key={bl.id}
                        style={[styles.subpageCard, { backgroundColor: theme.surfaceAlt }]}
                        onPress={() => openPage(bl.id)}
                      >
                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>🔗 {bl.title}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      ) : (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity onPress={() => setDrawerVisible(true)} style={{ padding: 4 }}>
                <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>☰</Text>
              </TouchableOpacity>
              <View>
                <Text style={[styles.brand, { color: theme.text }]}>NEXUS</Text>
                <Text style={[styles.subtitle, { color: theme.textDim }]}>
                  v1.0 • {nodes.length} notas • {courses.length} cursos
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.surfaceAlt }]} onPress={toggleTheme}>
                <Text style={{ fontSize: 13 }}>{isDarkMode ? '☀' : '🌙'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.surfaceAlt }]} onPress={() => setBackupModalVisible(true)}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>⚙</Text>
              </TouchableOpacity>
              {activeTab === 'spaces' && (
                <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: theme.surfaceAlt }]} onPress={toggleExpandAll}>
                  <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }}>{anyExpanded ? '▸' : '▾'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={() => openCreateModal(null)}>
                <Text style={styles.primaryBtnText}>+ Espaço</Text>
              </TouchableOpacity>
            </View>
          </View>

          {activeTab === 'home' && (
            <HomeSearchView
              nodes={nodes}
              coursesCount={courses.length}
              hasApiKey={!!geminiApiKey.trim()}
              theme={theme}
              customSources={customSources}
              savedSearches={savedSearches}
              recentSearches={recentSearches}
              onOpenCourses={() => setOverlayScreen({ kind: 'courses', courseId: null })}
              onOpenProductivityHub={() => setOverlayScreen({ kind: 'productivity' })}
              onOpenDailySummary={handleGenerateDailySummary}
              onOpenApiKeyModal={() => {
                setApiKeyDraft(geminiApiKey);
                setApiKeyModalVisible(true);
              }}
              onAddCustomSource={handleAddCustomSource}
              onDeleteCustomSource={handleDeleteCustomSource}
              onOpenWebUrl={handleOpenWebUrl}
              onSaveSearch={handleSaveSearch}
              onDeleteSavedSearch={handleDeleteSavedSearch}
              onClearRecentSearches={handleClearRecentSearches}
              onOpenNode={openPage}
            />
          )}

          {activeTab === 'spaces' && (
            <ScrollView style={styles.scrollArea}>
              {favoriteNodes.length > 0 && (
                <View style={styles.favStripWrap}>
                  <Text style={[styles.sectionHeading, { color: theme.textDim }]}>★ FAVORITOS</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favStripRow}>
                    {favoriteNodes.map((fav) => (
                      <TouchableOpacity
                        key={fav.id}
                        style={[styles.favChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                        onPress={() => openPage(fav.id)}
                      >
                        <Text style={styles.favChipText} numberOfLines={1}>★ {fav.title}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.sectionHeading, { color: theme.textDim }]}>MEUS ESPAÇOS E TÓPICOS</Text>
              <View style={[styles.treeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                {renderTree(null, 0)}
              </View>
              <Text style={[styles.tipText, { color: theme.textDim }]}>
                Abra o menu ☰ no topo para acessar Tempo, Horóscopo, Cotações, Feeds RSS, Minha Rotina, Assistindo e Lendo!
              </Text>
            </ScrollView>
          )}

          {activeTab === 'graph' && <GraphView nodes={nodes} onOpenNode={openPage} />}
          {activeTab === 'tags' && <TagsView nodes={nodes} onOpenNode={openPage} />}
          {activeTab === 'tasks' && (
            <TasksView nodes={nodes} onToggleTask={handleToggleGlobalTask} onOpenNode={openPage} />
          )}

          <View style={[styles.bottomBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            {(
              [
                { key: 'home', icon: '🏠', label: 'Início' },
                { key: 'spaces', icon: '☰', label: 'Espaços' },
                { key: 'graph', icon: '🕸', label: 'Grafo' },
                { key: 'tags', icon: '#', label: 'Tags' },
                { key: 'tasks', icon: '☑', label: 'Tarefas' },
              ] as { key: MainTab; icon: string; label: string }[]
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity key={tab.key} style={styles.tabBtn} onPress={() => setActiveTab(tab.key)}>
                  <Text style={[styles.tabIcon, { color: active ? theme.accent : theme.textDim }]}>{tab.icon}</Text>
                  <Text style={[styles.tabLabel, { color: active ? theme.accent : theme.textDim }]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {browserSession && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: ANDROID_BOTTOM_SAFE,
            zIndex: 50,
            backgroundColor: theme.bg,
          }}
        >
          <InAppBrowser
            initialUrl={browserSession.url}
            initialTitle={browserSession.title}
            sourceId={browserSession.sourceId}
            sourceName={browserSession.sourceName}
            sourceIcon={browserSession.sourceIcon}
            initialQuery={browserSession.query}
            nodes={nodes}
            theme={theme}
            onClose={() => setBrowserSession(null)}
            onSaveSearchBookmark={(params) =>
              handleSaveSearch({
                id: `sv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                query: params.query,
                sourceId: params.sourceId,
                sourceName: params.sourceName,
                sourceIcon: params.sourceIcon,
                url: params.url,
                createdAt: Date.now(),
              })
            }
            onSaveLinkToSpace={handleSaveLinkToSpace}
          />
        </View>
      )}

      <AppDrawer
        visible={drawerVisible}
        theme={theme}
        courses={courses}
        androidBottomSafe={ANDROID_BOTTOM_SAFE}
        onClose={() => setDrawerVisible(false)}
        onNavigate={handleDrawerNavigate}
      />

      {renderModals()}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: { fontSize: 21, fontWeight: '800', letterSpacing: 2 },
  subtitle: { fontSize: 11, marginTop: 2 },
  secondaryBtn: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10 },
  primaryBtn: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  scrollArea: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  favStripWrap: { marginBottom: 14 },
  favStripRow: { gap: 8 },
  favChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 170 },
  favChipText: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
  sectionHeading: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  treeCard: { borderRadius: 14, borderWidth: 1, paddingVertical: 4 },
  treeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingRight: 8, borderBottomWidth: 0.5 },
  expandBtn: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  expandIcon: { fontSize: 15 },
  treeTitleArea: { flex: 1, paddingHorizontal: 4 },
  treeTitle: { fontSize: 15, fontWeight: '600' },
  treeTagsPreview: { color: '#A855F7', fontSize: 11, marginTop: 2 },
  iconActionBtn: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  iconActionText: { fontSize: 15, fontWeight: '700' },
  tipText: { fontSize: 12, marginTop: 14, marginBottom: 24, lineHeight: 18, paddingHorizontal: 4 },
  bottomBar: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 6 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  tabIcon: { fontSize: 16, fontWeight: '700' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backBtn: { paddingVertical: 4, paddingRight: 6 },
  homeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  savedBadge: { color: '#10B981', fontSize: 11, fontWeight: '600', marginRight: 2 },
  favBtn: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  favBtnText: { color: '#F59E0B', fontSize: 14, fontWeight: '700' },
  pageScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  breadcrumbRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  breadcrumbItem: { flexDirection: 'row', alignItems: 'center' },
  pageTitleInput: { fontSize: 25, fontWeight: '800', marginBottom: 10 },
  sectionBox: { marginBottom: 16, borderRadius: 12, borderWidth: 1, padding: 14 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  subpageCard: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, marginTop: 6 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { backgroundColor: '#2E1065', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  tagChipText: { color: '#D8B4FE', fontSize: 12, fontWeight: '600' },
  linkChip: { backgroundColor: '#0C4A6E', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  linkChipText: { color: '#7DD3FC', fontSize: 12, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 },
  modalBox: { borderRadius: 16, borderWidth: 1, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 12 },
  templateHeading: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  templateRow: { gap: 8, marginBottom: 16 },
  templateChip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancel: { paddingVertical: 8, paddingHorizontal: 14 },
  modalConfirm: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '700' },
  menuItem: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 8 },
  menuItemText: { fontSize: 14, fontWeight: '600' },
  menuRowSplit: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  menuHalfBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  menuDanger: { backgroundColor: '#450A0A', borderWidth: 1, borderColor: '#7F1D1D' },
  menuDangerText: { color: '#FCA5A5', fontSize: 14, fontWeight: '700' },
  menuCloseBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  backupExportBtn: { backgroundColor: '#0C4A6E', borderWidth: 1, borderColor: '#0284C7', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 14 },
  backupExportText: { color: '#7DD3FC', fontSize: 14, fontWeight: '700' },
  backupInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 12, height: 110, textAlignVertical: 'top', marginBottom: 14 },
});
