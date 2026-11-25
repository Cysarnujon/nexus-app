import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
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
import * as ImagePicker from 'expo-image-picker';
import {
  CourseItem,
  CourseLessonItem,
  CourseModuleItem,
  LessonSourceType,
} from '../database/db';
import { EditorTheme } from '../editor/blocks';
import { persistMediaFile } from '../utils/media';
import LessonPlayerView from './LessonPlayerView';

interface CoursesViewProps {
  courses: CourseItem[];
  modules: CourseModuleItem[];
  lessons: CourseLessonItem[];
  initialCourseId?: string | null;
  theme: EditorTheme;
  onBackHome: () => void;
  onOpenDrawer: () => void;
  onCreateCourse: (title: string) => void;
  onRenameCourse: (id: string, title: string) => void;
  onSwapCourseOrder: (idA: string, orderA: number, idB: string, orderB: number) => void;
  onDeleteCourse: (id: string) => void;
  onCreateModule: (courseId: string, title: string) => void;
  onRenameModule: (id: string, title: string) => void;
  onSwapModuleOrder: (idA: string, orderA: number, idB: string, orderB: number) => void;
  onDeleteModule: (id: string) => void;
  onCreateLesson: (params: {
    moduleId: string;
    courseId: string;
    title: string;
    sourceType: LessonSourceType;
    mediaUri: string;
  }) => void;
  onUpdateLesson: (
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
  ) => void;
  onSwapLessonOrder: (idA: string, orderA: number, idB: string, orderB: number) => void;
  onDeleteLesson: (id: string) => void;
  onOpenInBrowser: (url: string, title: string, sourceId: string) => void;
  onExportNotesToNexus: (lesson: CourseLessonItem) => void;
}

type CourseFilter = 'all' | 'in_progress' | 'not_started' | 'completed';

export default function CoursesView({
  courses,
  modules,
  lessons,
  initialCourseId = null,
  theme,
  onBackHome,
  onOpenDrawer,
  onCreateCourse,
  onRenameCourse,
  onSwapCourseOrder,
  onDeleteCourse,
  onCreateModule,
  onRenameModule,
  onSwapModuleOrder,
  onDeleteModule,
  onCreateLesson,
  onUpdateLesson,
  onSwapLessonOrder,
  onDeleteLesson,
  onOpenInBrowser,
  onExportNotesToNexus,
}: CoursesViewProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    initialCourseId
  );
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [courseSearch, setCourseSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState<CourseFilter>('all');
  const [sortByProgress, setSortByProgress] = useState(false);

  // Modal Criar / Renomear Curso ou Módulo
  const [textModalMode, setTextModalMode] = useState<
    | null
    | { kind: 'new_course' }
    | { kind: 'rename_course'; id: string }
    | { kind: 'new_module'; courseId: string }
    | { kind: 'rename_module'; id: string }
    | { kind: 'rename_lesson'; id: string }
  >(null);
  const [textModalValue, setTextModalValue] = useState('');

  // Modal Nova Aula
  const [lessonModalVisible, setLessonModalVisible] = useState(false);
  const [lessonTitleInput, setLessonTitleInput] = useState('');
  const [lessonSourceType, setLessonSourceType] =
    useState<LessonSourceType>('local');
  const [lessonUriInput, setLessonUriInput] = useState('');

  // Menu de Opções (⋮)
  const [actionMenu, setActionMenu] = useState<
    | null
    | { kind: 'course'; id: string; title: string }
    | { kind: 'module'; id: string; title: string }
    | { kind: 'lesson'; id: string; title: string }
  >(null);

  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
      setSelectedModuleId(null);
      setSelectedLessonId(null);
    }
  }, [initialCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) ?? null,
    [modules, selectedModuleId]
  );

  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId]
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (actionMenu) {
        setActionMenu(null);
        return true;
      }
      if (lessonModalVisible) {
        setLessonModalVisible(false);
        return true;
      }
      if (textModalMode) {
        setTextModalMode(null);
        return true;
      }
      if (selectedLessonId) {
        setSelectedLessonId(null);
        return true;
      }
      if (selectedModuleId) {
        setSelectedModuleId(null);
        return true;
      }
      if (selectedCourseId) {
        setSelectedCourseId(null);
        return true;
      }
      onBackHome();
      return true;
    });
    return () => sub.remove();
  }, [
    actionMenu,
    lessonModalVisible,
    textModalMode,
    selectedLessonId,
    selectedModuleId,
    selectedCourseId,
    onBackHome,
  ]);

  const totalCompletedAll = useMemo(
    () => lessons.filter((l) => l.isCompleted).length,
    [lessons]
  );

  const courseStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { modCount: number; total: number; done: number; pct: number }
    >();
    for (const c of courses) {
      const cMods = modules.filter((m) => m.courseId === c.id);
      const cLessons = lessons.filter((l) => l.courseId === c.id);
      const done = cLessons.filter((l) => l.isCompleted).length;
      const total = cLessons.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      map.set(c.id, { modCount: cMods.length, total, done, pct });
    }
    return map;
  }, [courses, modules, lessons]);

  const filteredCourses = useMemo(() => {
    const q = courseSearch.trim().toLowerCase();
    const list = courses.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q)) return false;
      const st = courseStatsMap.get(c.id) ?? {
        modCount: 0,
        total: 0,
        done: 0,
        pct: 0,
      };
      if (courseFilter === 'not_started') return st.done === 0;
      if (courseFilter === 'completed') return st.total > 0 && st.done === st.total;
      if (courseFilter === 'in_progress') {
        return st.done > 0 && st.done < st.total;
      }
      return true;
    });

    if (sortByProgress) {
      return [...list].sort((a, b) => {
        const pa = courseStatsMap.get(a.id)?.pct ?? 0;
        const pb = courseStatsMap.get(b.id)?.pct ?? 0;
        return pb - pa;
      });
    }
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [courses, courseSearch, courseFilter, sortByProgress, courseStatsMap]);

  const submitTextModal = () => {
    const trimmed = textModalValue.trim();
    if (!trimmed || !textModalMode) return;
    if (textModalMode.kind === 'new_course') {
      onCreateCourse(trimmed);
    } else if (textModalMode.kind === 'rename_course') {
      onRenameCourse(textModalMode.id, trimmed);
    } else if (textModalMode.kind === 'new_module') {
      onCreateModule(textModalMode.courseId, trimmed);
    } else if (textModalMode.kind === 'rename_module') {
      onRenameModule(textModalMode.id, trimmed);
    } else if (textModalMode.kind === 'rename_lesson') {
      onUpdateLesson(textModalMode.id, { title: trimmed });
    }
    setTextModalMode(null);
    setTextModalValue('');
  };

  const handlePickLessonLocalVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso aos vídeos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
      });
      if (!res.canceled && res.assets.length > 0) {
        const asset = res.assets[0];
        const saved = await persistMediaFile(
          asset.uri,
          asset.fileName ?? 'aula.mp4'
        );
        setLessonUriInput(saved);
      }
    } catch (err) {
      Alert.alert('Erro ao escolher vídeo', String(err));
    }
  };

  const handleSaveNewLesson = () => {
    const title = lessonTitleInput.trim();
    if (!title || !selectedModule || !selectedCourse) return;

    const finalUri = lessonUriInput.trim();
    const finalType: LessonSourceType = finalUri ? lessonSourceType : 'none';

    onCreateLesson({
      moduleId: selectedModule.id,
      courseId: selectedCourse.id,
      title,
      sourceType: finalType,
      mediaUri: finalUri,
    });
    setLessonModalVisible(false);
    setLessonTitleInput('');
    setLessonUriInput('');
  };

  const handleMoveItem = (
    kind: 'course' | 'module' | 'lesson',
    id: string,
    dir: -1 | 1
  ) => {
    if (kind === 'course') {
      const sorted = [...courses].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((x) => x.id === id);
      const swapIdx = idx + dir;
      if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      onSwapCourseOrder(
        a.id,
        a.sortOrder === b.sortOrder ? idx : a.sortOrder,
        b.id,
        a.sortOrder === b.sortOrder ? swapIdx : b.sortOrder
      );
    } else if (kind === 'module' && selectedCourse) {
      const sorted = modules
        .filter((m) => m.courseId === selectedCourse.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((x) => x.id === id);
      const swapIdx = idx + dir;
      if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      onSwapModuleOrder(
        a.id,
        a.sortOrder === b.sortOrder ? idx : a.sortOrder,
        b.id,
        a.sortOrder === b.sortOrder ? swapIdx : b.sortOrder
      );
    } else if (kind === 'lesson' && selectedModule) {
      const sorted = lessons
        .filter((l) => l.moduleId === selectedModule.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((x) => x.id === id);
      const swapIdx = idx + dir;
      if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      onSwapLessonOrder(
        a.id,
        a.sortOrder === b.sortOrder ? idx : a.sortOrder,
        b.id,
        a.sortOrder === b.sortOrder ? swapIdx : b.sortOrder
      );
    }
  };

  function renderModals() {
    return (
      <>
        {/* Modal Criar / Renomear Curso ou Módulo */}
        <Modal
          visible={!!textModalMode}
          transparent
          animationType="fade"
          onRequestClose={() => setTextModalMode(null)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {textModalMode?.kind === 'new_course'
                  ? 'Criar Novo Curso'
                  : textModalMode?.kind === 'new_module'
                  ? 'Novo Módulo'
                  : 'Renomear'}
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
                value={textModalValue}
                onChangeText={setTextModalValue}
                placeholder="Digite o nome..."
                placeholderTextColor={theme.textDim}
                autoFocus
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setTextModalMode(null)}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitTextModal}
                  style={[styles.saveBtn, { backgroundColor: theme.accent }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>
                    Salvar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Adicionar Aula / Conteúdo (igual ao print!) */}
        <Modal
          visible={lessonModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLessonModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                Adicionar Aula / Conteúdo
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
                value={lessonTitleInput}
                onChangeText={setLessonTitleInput}
                placeholder="Título da Aula / Tópico"
                placeholderTextColor={theme.textDim}
                autoFocus
              />

              <View style={styles.sourceRow}>
                {(
                  [
                    { k: 'local', l: 'Celular' },
                    { k: 'youtube', l: 'YouTube' },
                    { k: 'site', l: 'Site' },
                  ] as const
                ).map((s) => {
                  const active = lessonSourceType === s.k;
                  return (
                    <TouchableOpacity
                      key={s.k}
                      onPress={() => {
                        setLessonSourceType(s.k);
                        setLessonUriInput('');
                      }}
                      style={[
                        styles.sourceChip,
                        {
                          borderColor: active ? theme.accent : theme.border,
                          backgroundColor: active
                            ? theme.isDark
                              ? 'rgba(99, 102, 241, 0.22)'
                              : '#EDE9FE'
                            : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? theme.accent : theme.textMuted,
                          fontWeight: '700',
                          fontSize: 13,
                        }}
                      >
                        {s.l}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {lessonSourceType === 'local' ? (
                <TouchableOpacity
                  style={[styles.pickVideoBtn, { borderColor: theme.border }]}
                  onPress={handlePickLessonLocalVideo}
                >
                  <Text
                    style={{
                      color: lessonUriInput ? '#10B981' : '#2563EB',
                      fontSize: 14,
                      fontWeight: '700',
                    }}
                  >
                    {lessonUriInput
                      ? '✓ Vídeo selecionado (tocar para trocar)'
                      : 'Escolher vídeo do celular'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={lessonUriInput}
                  onChangeText={setLessonUriInput}
                  placeholder={
                    lessonSourceType === 'youtube'
                      ? 'Cole o link do YouTube...'
                      : 'Cole o link do Site...'
                  }
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setLessonModalVisible(false)}
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: '#2563EB', fontWeight: '700' }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!lessonTitleInput.trim()}
                  onPress={handleSaveNewLesson}
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: lessonTitleInput.trim()
                        ? theme.accent
                        : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: lessonTitleInput.trim() ? '#FFF' : theme.textDim,
                      fontWeight: '700',
                    }}
                  >
                    Salvar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Menu ⋮ */}
        <Modal
          visible={!!actionMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setActionMenu(null)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalBox,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text
                style={[styles.modalTitle, { color: theme.text }]}
                numberOfLines={1}
              >
                {actionMenu?.title}
              </Text>

              <TouchableOpacity
                style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
                onPress={() => {
                  if (!actionMenu) return;
                  const { kind, id, title } = actionMenu;
                  setActionMenu(null);
                  setTextModalValue(title);
                  setTextModalMode(
                    kind === 'course'
                      ? { kind: 'rename_course', id }
                      : kind === 'module'
                      ? { kind: 'rename_module', id }
                      : { kind: 'rename_lesson', id }
                  );
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>
                  ✏️ Renomear
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.menuRow,
                    { flex: 1, alignItems: 'center', marginBottom: 0, backgroundColor: theme.surfaceAlt },
                  ]}
                  onPress={() => {
                    if (actionMenu) {
                      handleMoveItem(actionMenu.kind, actionMenu.id, -1);
                      setActionMenu(null);
                    }
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '600' }}>
                    ↑ Subir
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.menuRow,
                    { flex: 1, alignItems: 'center', marginBottom: 0, backgroundColor: theme.surfaceAlt },
                  ]}
                  onPress={() => {
                    if (actionMenu) {
                      handleMoveItem(actionMenu.kind, actionMenu.id, 1);
                      setActionMenu(null);
                    }
                  }}
                >
                  <Text style={{ color: theme.text, fontWeight: '600' }}>
                    ↓ Descer
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.menuRow,
                  { backgroundColor: '#450A0A', borderWidth: 1, borderColor: '#7F1D1D' },
                ]}
                onPress={() => {
                  if (!actionMenu) return;
                  const { kind, id, title } = actionMenu;
                  Alert.alert('Excluir', `Excluir "${title}"?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Excluir',
                      style: 'destructive',
                      onPress: () => {
                        if (kind === 'course') onDeleteCourse(id);
                        if (kind === 'module') onDeleteModule(id);
                        if (kind === 'lesson') onDeleteLesson(id);
                        setActionMenu(null);
                      },
                    },
                  ]);
                }}
              >
                <Text style={{ color: '#FCA5A5', fontWeight: '700' }}>
                  🗑 Excluir
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActionMenu(null)}
                style={{ alignItems: 'center', paddingTop: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Fechar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // NÍVEL 4: SALA DE ESTUDO DA AULA
  if (selectedLesson && selectedModule && selectedCourse) {
    return (
      <LessonPlayerView
        lesson={selectedLesson}
        courseTitle={selectedCourse.title}
        moduleTitle={selectedModule.title}
        theme={theme}
        onBack={() => setSelectedLessonId(null)}
        onUpdateLesson={onUpdateLesson}
        onOpenInBrowser={onOpenInBrowser}
        onExportNotesToNexus={onExportNotesToNexus}
      />
    );
  }

  // NÍVEL 3: AULAS DO MÓDULO
  if (selectedModule && selectedCourse) {
    const modLessons = lessons
      .filter((l) => l.moduleId === selectedModule.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const doneCount = modLessons.filter((l) => l.isCompleted).length;

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.topHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => setSelectedModuleId(null)}
            style={styles.backHit}
          >
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>
              ←
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}
              numberOfLines={1}
            >
              {selectedModule.title}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 12 }}>
              {doneCount}/{modLessons.length} concluídas
            </Text>
          </View>
        </View>

        <ScrollView style={styles.bodyScroll}>
          {modLessons.length === 0 ? (
            <View style={styles.emptyCenter}>
              <Text
                style={{
                  color: theme.textMuted,
                  fontSize: 15,
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                Toque em '+ Nova Aula' para adicionar um vídeo do celular, YouTube ou qualquer site.
              </Text>
            </View>
          ) : (
            modLessons.map((les) => {
              const sourceLabel =
                les.sourceType === 'local'
                  ? '🎬 Vídeo do celular'
                  : les.sourceType === 'youtube'
                  ? '▶ YouTube'
                  : les.sourceType === 'site'
                  ? '🌐 Site'
                  : 'Sem vídeo / link';

              return (
                <View
                  key={les.id}
                  style={[
                    styles.lessonCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() =>
                      onUpdateLesson(les.id, { isCompleted: !les.isCompleted })
                    }
                    style={[
                      styles.circleCheck,
                      {
                        borderColor: les.isCompleted
                          ? '#10B981'
                          : theme.textMuted,
                        backgroundColor: les.isCompleted
                          ? '#10B981'
                          : 'transparent',
                      },
                    ]}
                  >
                    {les.isCompleted && (
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                        ✓
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => setSelectedLessonId(les.id)}
                  >
                    <Text
                      style={{
                        color: theme.text,
                        fontSize: 15,
                        fontWeight: '700',
                        textDecorationLine: les.isCompleted
                          ? 'line-through'
                          : 'none',
                      }}
                    >
                      {les.title}
                    </Text>
                    <Text
                      style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }}
                    >
                      {sourceLabel}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      setActionMenu({
                        kind: 'lesson',
                        id: les.id,
                        title: les.title,
                      })
                    }
                    style={{ padding: 6 }}
                  >
                    <Text style={{ color: theme.textDim, fontSize: 18 }}>⋮</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
          <View style={{ height: 90 }} />
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.fabBtn,
            {
              backgroundColor: theme.isDark ? '#312E81' : '#EDE9FE',
            },
          ]}
          onPress={() => {
            setLessonTitleInput('');
            setLessonSourceType('local');
            setLessonUriInput('');
            setLessonModalVisible(true);
          }}
        >
          <Text
            style={{
              color: theme.isDark ? '#E0E7FF' : '#31105E',
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            +   Nova Aula
          </Text>
        </TouchableOpacity>

        {renderModals()}
      </View>
    );
  }

  // NÍVEL 2: MÓDULOS DO CURSO
  if (selectedCourse) {
    const courseMods = modules
      .filter((m) => m.courseId === selectedCourse.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const stats = courseStatsMap.get(selectedCourse.id) ?? {
      modCount: 0,
      total: 0,
      done: 0,
      pct: 0,
    };

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.topHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => setSelectedCourseId(null)}
            style={styles.backHit}
          >
            <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700' }}>
              ←
            </Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}
              numberOfLines={1}
            >
              {selectedCourse.title}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 12 }}>
              {stats.done} de {stats.total} aulas concluídas
            </Text>
          </View>
        </View>

        <ScrollView style={styles.bodyScroll}>
          {courseMods.length === 0 ? (
            <View style={styles.emptyCenter}>
              <Text
                style={{
                  color: theme.textMuted,
                  fontSize: 15,
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                Toque em '+ Novo Módulo' para começar a organizar seus estudos.
              </Text>
            </View>
          ) : (
            courseMods.map((mod) => {
              const mLessons = lessons.filter((l) => l.moduleId === mod.id);
              const mDone = mLessons.filter((l) => l.isCompleted).length;
              const mTotal = mLessons.length;
              const mPct = mTotal > 0 ? Math.round((mDone / mTotal) * 100) : 0;

              return (
                <TouchableOpacity
                  key={mod.id}
                  activeOpacity={0.85}
                  onPress={() => setSelectedModuleId(mod.id)}
                  style={[
                    styles.moduleCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.moduleTopRow}>
                    <Text style={{ fontSize: 26, color: '#1E40AF' }}>📁</Text>
                    <Text
                      style={{
                        flex: 1,
                        color: theme.text,
                        fontSize: 16,
                        fontWeight: '700',
                      }}
                    >
                      {mod.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setActionMenu({
                          kind: 'module',
                          id: mod.id,
                          title: mod.title,
                        })
                      }
                      style={{ padding: 6 }}
                    >
                      <Text style={{ color: theme.textDim, fontSize: 18 }}>
                        ⋮
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={{
                      color: theme.textDim,
                      fontSize: 12,
                      marginTop: 8,
                      marginBottom: 6,
                    }}
                  >
                    {mDone}/{mTotal} aulas ({mPct}%)
                  </Text>

                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: theme.surfaceAlt },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.max(2, mPct)}%` },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 90 }} />
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.fabBtn,
            { backgroundColor: theme.isDark ? '#312E81' : '#EDE9FE' },
          ]}
          onPress={() => {
            setTextModalValue('');
            setTextModalMode({
              kind: 'new_module',
              courseId: selectedCourse.id,
            });
          }}
        >
          <Text
            style={{
              color: theme.isDark ? '#E0E7FF' : '#31105E',
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            +   Novo Módulo
          </Text>
        </TouchableOpacity>

        {renderModals()}
      </View>
    );
  }

  // NÍVEL 1: GRADE DE MEUS CURSOS
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.topHeader, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={onOpenDrawer} style={styles.backHit}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>
            ☰
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 21, fontWeight: '800' }}>
            Meus Cursos
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 12 }}>
            {totalCompletedAll} de {lessons.length} aulas concluídas
          </Text>
        </View>
        <TouchableOpacity onPress={onBackHome} style={styles.homePillBtn}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
            Início
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled">
        {/* Busca */}
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: theme.textDim, fontSize: 15 }}>🔍</Text>
          <TextInput
            style={{ flex: 1, color: theme.text, fontSize: 14, paddingVertical: 8 }}
            value={courseSearch}
            onChangeText={setCourseSearch}
            placeholder="Buscar cursos, temas..."
            placeholderTextColor={theme.textDim}
          />
        </View>

        {/* Filtros */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 12 }}
        >
          {(
            [
              { k: 'all', l: 'Todos' },
              { k: 'in_progress', l: 'Em andamento' },
              { k: 'not_started', l: 'Não iniciado' },
              { k: 'completed', l: 'Concluído' },
            ] as { k: CourseFilter; l: string }[]
          ).map((f) => {
            const active = courseFilter === f.k;
            return (
              <TouchableOpacity
                key={f.k}
                onPress={() => setCourseFilter(f.k)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? '#1E3A8A' : theme.surface,
                    borderColor: active ? '#1E3A8A' : theme.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: active ? '#FFF' : theme.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {f.l}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Contagem e Ordem */}
        <View style={styles.countSortRow}>
          <Text style={{ color: theme.textDim, fontSize: 12 }}>
            {filteredCourses.length} itens
          </Text>
          <TouchableOpacity onPress={() => setSortByProgress((s) => !s)}>
            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>
              {sortByProgress ? 'Progresso ↓' : 'Ordem manual ↑'}
            </Text>
          </TouchableOpacity>
        </View>

        {filteredCourses.length === 0 ? (
          <View style={styles.emptyCenter}>
            <Text style={{ color: theme.textDim, fontSize: 14, textAlign: 'center' }}>
              Nenhum curso ainda. Toque em "+ Criar Novo Curso" abaixo!
            </Text>
          </View>
        ) : (
          <View style={styles.coursesGrid}>
            {filteredCourses.map((course) => {
              const st = courseStatsMap.get(course.id) ?? {
                modCount: 0,
                total: 0,
                done: 0,
                pct: 0,
              };

              return (
                <TouchableOpacity
                  key={course.id}
                  activeOpacity={0.88}
                  onPress={() => setSelectedCourseId(course.id)}
                  style={[
                    styles.courseCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.courseCover}>
                    <View style={styles.courseCoverTop}>
                      <View style={styles.pctBadge}>
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>
                          {st.pct}%
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          setActionMenu({
                            kind: 'course',
                            id: course.id,
                            title: course.title,
                          })
                        }
                        style={styles.dotsBadge}
                      >
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                          ⋮
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 28, textAlign: 'center' }}>🎓</Text>

                    <Text
                      style={styles.courseCoverTitle}
                      numberOfLines={2}
                    >
                      {course.title}
                    </Text>
                  </View>

                  <View style={styles.courseFooter}>
                    <Text
                      style={{ color: theme.textDim, fontSize: 10, marginBottom: 5 }}
                      numberOfLines={2}
                    >
                      {st.modCount} mód • {st.done}/{st.total} ({st.pct}%)
                    </Text>
                    <View
                      style={[
                        styles.progressTrack,
                        { backgroundColor: theme.surfaceAlt },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${Math.max(3, st.pct)}%` },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.fabBtn,
          { backgroundColor: theme.isDark ? '#312E81' : '#EDE9FE' },
        ]}
        onPress={() => {
          setTextModalValue('');
          setTextModalMode({ kind: 'new_course' });
        }}
      >
        <Text
          style={{
            color: theme.isDark ? '#E0E7FF' : '#31105E',
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          +   Criar Novo Curso
        </Text>
      </TouchableOpacity>

      {renderModals()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 28) : 0,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backHit: {
    padding: 4,
  },
  homePillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bodyScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  countSortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  coursesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  courseCard: {
    width: '31.5%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
  },
  courseCover: {
    backgroundColor: '#102A5C',
    padding: 8,
    height: 112,
    justifyContent: 'space-between',
  },
  courseCoverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pctBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dotsBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseCoverTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  courseFooter: {
    padding: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
  emptyCenter: {
    marginTop: 90,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  moduleCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  moduleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  circleCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabBtn: {
    position: 'absolute',
    right: 16,
    bottom: 22,
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 22,
  },
  modalBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sourceChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pickVideoBtn: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
  },
  menuRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
});
