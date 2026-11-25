import React, { useState } from 'react';
import {
  Alert,
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
import { VideoView, useVideoPlayer } from 'expo-video';
import { WebView } from 'react-native-webview';
import {
  CourseLessonItem,
  LessonLink,
  LessonQuestion,
  LessonSourceType,
} from '../database/db';
import { EditorTheme } from '../editor/blocks';
import { persistMediaFile } from '../utils/media';

interface LessonPlayerViewProps {
  lesson: CourseLessonItem;
  courseTitle: string;
  moduleTitle: string;
  theme: EditorTheme;
  onBack: () => void;
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
  onOpenInBrowser: (url: string, title: string, sourceId: string) => void;
  onExportNotesToNexus: (lesson: CourseLessonItem) => void;
}

type LessonTab = 'notes' | 'questions' | 'links' | 'ai';

function normalizeYouTubeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (shortMatch) {
    return `https://m.youtube.com/watch?v=${shortMatch[1]}`;
  }
  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watchMatch) {
    return `https://m.youtube.com/watch?v=${watchMatch[1]}`;
  }
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (shortsMatch) {
    return `https://m.youtube.com/watch?v=${shortsMatch[1]}`;
  }
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeSiteUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function LocalLessonVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      style={styles.videoBox}
      player={player}
      nativeControls
      contentFit="contain"
    />
  );
}

export default function LessonPlayerView({
  lesson,
  courseTitle,
  moduleTitle,
  theme,
  onBack,
  onUpdateLesson,
  onOpenInBrowser,
  onExportNotesToNexus,
}: LessonPlayerViewProps) {
  const [activeTab, setActiveTab] = useState<LessonTab>('notes');

  // Modal Adicionar / Trocar Vídeo ou Link
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [pickType, setPickType] = useState<LessonSourceType>(
    lesson.sourceType === 'none' ? 'local' : lesson.sourceType
  );
  const [urlInput, setUrlInput] = useState(
    lesson.sourceType === 'youtube' || lesson.sourceType === 'site'
      ? lesson.mediaUri
      : ''
  );

  // Modal Nova Pergunta
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');

  // Modal Novo Link
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Aba IA
  const [aiPrompt, setAiPrompt] = useState(
    `Explique de forma clara e com exemplos práticos o tema "${lesson.title}" (do curso ${courseTitle}).`
  );

  const handlePickLocalVideo = async () => {
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
        const savedUri = await persistMediaFile(
          asset.uri,
          asset.fileName ?? 'aula.mp4'
        );
        onUpdateLesson(lesson.id, {
          sourceType: 'local',
          mediaUri: savedUri,
        });
        setMediaModalVisible(false);
      }
    } catch (err) {
      Alert.alert('Erro ao carregar vídeo', String(err));
    }
  };

  const handleSaveMediaUrl = () => {
    const clean =
      pickType === 'youtube'
        ? normalizeYouTubeUrl(urlInput)
        : normalizeSiteUrl(urlInput);
    if (!clean) {
      Alert.alert('Link vazio', 'Cole o endereço do YouTube ou Site.');
      return;
    }
    onUpdateLesson(lesson.id, {
      sourceType: pickType,
      mediaUri: clean,
    });
    setMediaModalVisible(false);
  };

  const handleAddQuestion = () => {
    const q = newQuestionText.trim();
    if (!q) return;
    const item: LessonQuestion = {
      id: `q-${Date.now()}`,
      question: q,
      answer: '',
      resolved: false,
    };
    onUpdateLesson(lesson.id, {
      questions: [...lesson.questions, item],
    });
    setNewQuestionText('');
    setQuestionModalVisible(false);
  };

  const handleAddLink = () => {
    const u = normalizeSiteUrl(newLinkUrl);
    if (!u) return;
    const item: LessonLink = {
      id: `lnk-${Date.now()}`,
      title: newLinkTitle.trim() || u,
      url: u,
    };
    onUpdateLesson(lesson.id, {
      links: [...lesson.links, item],
    });
    setNewLinkTitle('');
    setNewLinkUrl('');
    setLinkModalVisible(false);
  };

  const openAiInBrowser = (provider: 'gemini' | 'chatgpt') => {
    const q = encodeURIComponent(
      aiPrompt.trim() || `Resuma e explique: ${lesson.title}`
    );
    const url =
      provider === 'chatgpt'
        ? `https://chatgpt.com/?q=${q}`
        : 'https://gemini.google.com/app';
    onOpenInBrowser(
      url,
      provider === 'chatgpt' ? 'ChatGPT • Estudo' : 'Gemini • Estudo',
      provider
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header da Aula */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>
            ←
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}
            numberOfLines={1}
          >
            {lesson.title}
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 11 }} numberOfLines={1}>
            {courseTitle} › {moduleTitle}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() =>
            onUpdateLesson(lesson.id, { isCompleted: !lesson.isCompleted })
          }
          style={[
            styles.completeCircle,
            {
              borderColor: lesson.isCompleted ? '#10B981' : theme.textMuted,
              backgroundColor: lesson.isCompleted ? '#10B981' : 'transparent',
            },
          ]}
        >
          {lesson.isCompleted && (
            <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>
              ✓
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Player Escuro no Topo */}
      <View style={styles.playerSection}>
        {lesson.sourceType === 'local' && lesson.mediaUri ? (
          <LocalLessonVideo uri={lesson.mediaUri} />
        ) : (lesson.sourceType === 'youtube' || lesson.sourceType === 'site') &&
          lesson.mediaUri ? (
          <WebView
            source={{ uri: lesson.mediaUri }}
            style={styles.videoBox}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            sharedCookiesEnabled
          />
        ) : (
          <View style={styles.emptyPlayer}>
            <Text style={{ color: '#E2E8F0', fontSize: 14, marginBottom: 14 }}>
              Nenhum vídeo ou link adicionado ainda
            </Text>
            <TouchableOpacity
              style={styles.addMediaBtn}
              onPress={() => {
                setPickType('local');
                setUrlInput('');
                setMediaModalVisible(true);
              }}
            >
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>
                Adicionar Vídeo / Link
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {lesson.sourceType !== 'none' && lesson.mediaUri ? (
          <View style={styles.playerFooterBar}>
            <TouchableOpacity
              onPress={() => {
                setPickType(lesson.sourceType);
                setUrlInput(
                  lesson.sourceType === 'local' ? '' : lesson.mediaUri
                );
                setMediaModalVisible(true);
              }}
            >
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>
                🔄 Trocar Vídeo / Link
              </Text>
            </TouchableOpacity>

            {(lesson.sourceType === 'youtube' ||
              lesson.sourceType === 'site') && (
              <TouchableOpacity
                onPress={() =>
                  onOpenInBrowser(
                    lesson.mediaUri,
                    lesson.title,
                    lesson.sourceType
                  )
                }
              >
                <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '700' }}>
                  ⤢ Tela Cheia
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {/* Barra de 4 Abas: Anotações | Perguntas | Links | IA */}
      <View
        style={[
          styles.tabsBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        {(
          [
            { key: 'notes', label: 'Anotações' },
            { key: 'questions', label: `Perguntas` },
            { key: 'links', label: 'Links' },
            { key: 'ai', label: 'IA' },
          ] as { key: LessonTab; label: string }[]
        ).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabItem,
                active && { borderBottomWidth: 2.5, borderBottomColor: '#1D4ED8' },
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={{
                  color: active ? '#2563EB' : theme.textDim,
                  fontSize: 13,
                  fontWeight: active ? '800' : '600',
                }}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Conteúdo das Abas */}
      <ScrollView
        style={styles.tabBody}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'notes' && (
          <View>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Anotações da Aula
              </Text>
              <TouchableOpacity
                onPress={() => onExportNotesToNexus(lesson)}
                style={[styles.miniPill, { backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '700' }}>
                  📄 Enviar p/ Espaços
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.notesBox,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={lesson.notes}
              onChangeText={(txt) => onUpdateLesson(lesson.id, { notes: txt })}
              multiline
              textAlignVertical="top"
              placeholder="Escreva suas anotações aqui..."
              placeholderTextColor={theme.textDim}
            />
          </View>
        )}

        {activeTab === 'questions' && (
          <View>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Perguntas / Dúvidas
              </Text>
              <TouchableOpacity
                style={[
                  styles.addPillBtn,
                  {
                    backgroundColor: theme.isDark ? '#2E1065' : '#EDE9FE',
                  },
                ]}
                onPress={() => {
                  setNewQuestionText('');
                  setQuestionModalVisible(true);
                }}
              >
                <Text
                  style={{
                    color: theme.isDark ? '#D8B4FE' : '#5B21B6',
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  + Nova Pergunta
                </Text>
              </TouchableOpacity>
            </View>

            {lesson.questions.length === 0 ? (
              <Text
                style={{
                  color: theme.textDim,
                  textAlign: 'center',
                  marginTop: 42,
                  fontSize: 14,
                }}
              >
                Nenhuma pergunta adicionada nesta aula.
              </Text>
            ) : (
              lesson.questions.map((q) => (
                <View
                  key={q.id}
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <TouchableOpacity
                      onPress={() => {
                        const next = lesson.questions.map((item) =>
                          item.id === q.id
                            ? { ...item, resolved: !item.resolved }
                            : item
                        );
                        onUpdateLesson(lesson.id, { questions: next });
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}
                    >
                      <Text
                        style={{
                          fontSize: 17,
                          color: q.resolved ? '#10B981' : theme.textDim,
                        }}
                      >
                        {q.resolved ? '☑' : '☐'}
                      </Text>
                      <Text
                        style={{
                          color: theme.text,
                          fontSize: 14,
                          fontWeight: '700',
                          flex: 1,
                        }}
                      >
                        ❓ {q.question}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        const next = lesson.questions.filter(
                          (item) => item.id !== q.id
                        );
                        onUpdateLesson(lesson.id, { questions: next });
                      }}
                    >
                      <Text style={{ color: '#F87171', fontSize: 13 }}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[
                      styles.answerInput,
                      {
                        backgroundColor: theme.bg,
                        borderColor: theme.border,
                        color: theme.textMuted,
                      },
                    ]}
                    value={q.answer}
                    onChangeText={(txt) => {
                      const next = lesson.questions.map((item) =>
                        item.id === q.id ? { ...item, answer: txt } : item
                      );
                      onUpdateLesson(lesson.id, { questions: next });
                    }}
                    multiline
                    placeholder="Escreva a resposta quando descobrir..."
                    placeholderTextColor={theme.textDim}
                  />
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'links' && (
          <View>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Links da Aula
              </Text>
              <TouchableOpacity
                style={[
                  styles.addPillBtn,
                  {
                    backgroundColor: theme.isDark ? '#2E1065' : '#EDE9FE',
                  },
                ]}
                onPress={() => {
                  setNewLinkTitle('');
                  setNewLinkUrl('');
                  setLinkModalVisible(true);
                }}
              >
                <Text
                  style={{
                    color: theme.isDark ? '#D8B4FE' : '#5B21B6',
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  + Novo Link
                </Text>
              </TouchableOpacity>
            </View>

            {lesson.links.length === 0 ? (
              <Text
                style={{
                  color: theme.textDim,
                  textAlign: 'center',
                  marginTop: 42,
                  fontSize: 14,
                }}
              >
                Nenhum link extra salvo nesta aula.
              </Text>
            ) : (
              lesson.links.map((lnk) => (
                <View
                  key={lnk.id}
                  style={[
                    styles.card,
                    styles.rowBetween,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => onOpenInBrowser(lnk.url, lnk.title, 'site')}
                  >
                    <Text
                      style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}
                    >
                      🔗 {lnk.title}
                    </Text>
                    <Text
                      style={{ color: '#38BDF8', fontSize: 12, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {lnk.url}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      const next = lesson.links.filter((l) => l.id !== lnk.id);
                      onUpdateLesson(lesson.id, { links: next });
                    }}
                    style={{ paddingLeft: 10 }}
                  >
                    <Text style={{ color: '#F87171', fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'ai' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Assistente IA de Estudo
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
              {[
                {
                  label: '✨ Resumir tema',
                  prompt: `Resuma os principais conceitos e pontos práticos sobre "${lesson.title}" (curso ${courseTitle}).`,
                },
                {
                  label: '🧠 Quiz de revisão',
                  prompt: `Crie 5 perguntas de revisão com respostas sobre "${lesson.title}".`,
                },
                {
                  label: '💡 Explicar simples',
                  prompt: `Explique "${lesson.title}" de forma bem simples, como para um iniciante, com analogias.`,
                },
              ].map((preset) => (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.miniPill, { backgroundColor: theme.surfaceAlt }]}
                  onPress={() => setAiPrompt(preset.prompt)}
                >
                  <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[
                styles.aiInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              value={aiPrompt}
              onChangeText={setAiPrompt}
              multiline
              placeholder="Pergunte algo sobre esta aula..."
              placeholderTextColor={theme.textDim}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.aiBtn, { backgroundColor: '#2563EB' }]}
                onPress={() => openAiInBrowser('gemini')}
              >
                <Text style={styles.aiBtnText}>✦ Abrir Gemini</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.aiBtn, { backgroundColor: '#10B981' }]}
                onPress={() => openAiInBrowser('chatgpt')}
              >
                <Text style={styles.aiBtnText}>🤖 Abrir ChatGPT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal Adicionar Vídeo / Link */}
      <Modal
        visible={mediaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMediaModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Adicionar Vídeo / Link
            </Text>

            <View style={styles.sourceRow}>
              {(
                [
                  { k: 'local', l: 'Celular' },
                  { k: 'youtube', l: 'YouTube' },
                  { k: 'site', l: 'Site' },
                ] as const
              ).map((s) => {
                const active = pickType === s.k;
                return (
                  <TouchableOpacity
                    key={s.k}
                    onPress={() => setPickType(s.k)}
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

            {pickType === 'local' ? (
              <TouchableOpacity
                style={[styles.pickVideoBtn, { borderColor: theme.border }]}
                onPress={handlePickLocalVideo}
              >
                <Text style={{ color: '#2563EB', fontSize: 14, fontWeight: '700' }}>
                  Escolher vídeo do celular
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
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder={
                  pickType === 'youtube'
                    ? 'Cole o link do YouTube...'
                    : 'Cole o link do site/plataforma...'
                }
                placeholderTextColor={theme.textDim}
                autoCapitalize="none"
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setMediaModalVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: '#2563EB', fontWeight: '700' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              {pickType !== 'local' && (
                <TouchableOpacity
                  onPress={handleSaveMediaUrl}
                  style={[styles.modalSaveBtn, { backgroundColor: theme.accent }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Nova Pergunta */}
      <Modal
        visible={questionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuestionModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Nova Pergunta / Dúvida
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
              value={newQuestionText}
              onChangeText={setNewQuestionText}
              placeholder="Qual é a sua dúvida sobre a aula?"
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setQuestionModalVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddQuestion}
                style={[styles.modalSaveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>
                  Adicionar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Novo Link */}
      <Modal
        visible={linkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLinkModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Adicionar Link de Referência
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
              value={newLinkTitle}
              onChangeText={setNewLinkTitle}
              placeholder="Título (ex: Material complementar)"
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
              value={newLinkUrl}
              onChangeText={setNewLinkUrl}
              placeholder="https://..."
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setLinkModalVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddLink}
                style={[styles.modalSaveBtn, { backgroundColor: theme.accent }]}
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
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  completeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerSection: {
    backgroundColor: '#111827',
  },
  videoBox: {
    width: '100%',
    height: 215,
    backgroundColor: '#000',
  },
  emptyPlayer: {
    height: 180,
    backgroundColor: '#162033',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addMediaBtn: {
    backgroundColor: '#1D4ED8',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
  },
  playerFooterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
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
  tabBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  notesBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 260,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  answerInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  aiInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    marginBottom: 12,
  },
  aiBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  aiBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
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
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
  },
});
