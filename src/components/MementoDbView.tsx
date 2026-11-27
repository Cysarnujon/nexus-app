import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { getAppMeta, setAppMeta } from '../database/db';
import {
  EditorBlock,
  EditorTheme,
  createBlock,
  makeId,
  serializeBlocks,
} from '../editor/blocks';
import { persistMediaFile } from '../utils/media';
import {
  DEFAULT_MEMENTO_STORE,
  FIELD_TYPE_LABELS,
  MementoDatabase,
  MementoField,
  MementoFieldType,
  MementoRecord,
  MementoRule,
  MementoStore,
  VibeMiniApp,
  applyAutomationRules,
  buildLocalDatabaseFromPrompt,
  buildStarterMiniAppHtml,
  createDbFromTemplate,
  databaseToCsv,
  evaluateFormula,
} from './mementoTypes';

interface MementoDbViewProps {
  theme: EditorTheme;
  geminiApiKey: string;
  onOpenDrawer: () => void;
  onBackHome: () => void;
  onExportToSpaces: (title: string, serializedContent: string) => void;
}

type HubSection = 'databases' | 'vibe';
type DbViewMode = 'list' | 'table' | 'cards' | 'charts' | 'calendar';

const STORAGE_KEY = 'memento_database_v1';

export default function MementoDbView({
  theme,
  geminiApiKey,
  onOpenDrawer,
  onBackHome,
  onExportToSpaces,
}: MementoDbViewProps) {
  const [store, setStore] = useState<MementoStore>(() => {
    try {
      const raw = getAppMeta(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MementoStore;
        if (Array.isArray(parsed.databases)) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_MEMENTO_STORE;
  });

  const [hubSection, setHubSection] = useState<HubSection>('databases');
  const [selectedDbId, setSelectedDbId] = useState<string | null>(null);
  const [dbViewMode, setDbViewMode] = useState<DbViewMode>('list');
  const [dbSearch, setDbSearch] = useState('');

  // Vibe Mini-App state
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [vibeTab, setVibeTab] = useState<'run' | 'code' | 'versions'>('run');
  const [codeDraft, setCodeDraft] = useState('');
  const [vibeChatPrompt, setVibeChatPrompt] = useState('');
  const [vibeLoading, setVibeLoading] = useState(false);

  // Modais Criar Banco / Criar Mini-App
  const [newDbModal, setNewDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [aiDbPrompt, setAiDbPrompt] = useState('');
  const [aiDbLoading, setAiDbLoading] = useState(false);

  const [newAppModal, setNewAppModal] = useState(false);
  const [newAppTitle, setNewAppTitle] = useState('');
  const [newAppPrompt, setNewAppPrompt] = useState('');

  // Modal Registro
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [recordValues, setRecordValues] = useState<
    Record<string, string | number | boolean>
  >({});

  // Modais Campos, Regras, Assistente IA, Importar CSV
  const [fieldsModalVisible, setFieldsModalVisible] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<MementoFieldType>('text');
  const [newFieldExtra, setNewFieldExtra] = useState('');
  const [newFieldTargetDb, setNewFieldTargetDb] = useState('');

  const [rulesModalVisible, setRulesModalVisible] = useState(false);
  const [rTriggerKey, setRTriggerKey] = useState('');
  const [rOp, setROp] = useState<MementoRule['operator']>('gt');
  const [rTriggerVal, setRTriggerVal] = useState('');
  const [rActionKey, setRActionKey] = useState('');
  const [rActionVal, setRActionVal] = useState('');

  const [aiChatModalVisible, setAiChatModalVisible] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);

  const [csvModalVisible, setCsvModalVisible] = useState(false);
  const [csvInput, setCsvInput] = useState('');

  const persistStore = (next: MementoStore) => {
    setStore(next);
    setAppMeta(STORAGE_KEY, JSON.stringify(next));
  };

  const selectedDb = useMemo(
    () => store.databases.find((d) => d.id === selectedDbId) ?? null,
    [store.databases, selectedDbId]
  );

  const activeApp = useMemo(
    () => store.miniApps.find((a) => a.id === activeAppId) ?? null,
    [store.miniApps, activeAppId]
  );

  const updateDatabase = (updated: MementoDatabase) => {
    persistStore({
      ...store,
      databases: store.databases.map((d) =>
        d.id === updated.id ? updated : d
      ),
    });
  };

  const formatCellDisplay = (
    field: MementoField,
    values: Record<string, string | number | boolean>
  ): string => {
    if (field.type === 'formula') {
      return String(evaluateFormula(field.formulaExpr ?? '', values));
    }
    const raw = values[field.key];
    if (field.type === 'checkbox') return raw ? '☑ Sim' : '☐ Não';
    if (field.type === 'currency') {
      const n = Number(raw) || 0;
      return `R$ ${n.toFixed(2)}`;
    }
    if (field.type === 'rating') {
      const stars = Math.max(0, Math.min(5, Number(raw) || 0));
      return '★'.repeat(stars) + '☆'.repeat(5 - stars);
    }
    if (field.type === 'relation' && field.targetDbId) {
      const targetDb = store.databases.find((d) => d.id === field.targetDbId);
      const targetRec = targetDb?.records.find((r) => r.id === raw);
      const firstField = targetDb?.fields[0];
      return targetRec && firstField
        ? String(targetRec.values[firstField.key] ?? raw)
        : String(raw ?? '—');
    }
    return String(raw ?? '');
  };

  const filteredRecords = useMemo(() => {
    if (!selectedDb) return [];
    const q = dbSearch.trim().toLowerCase();
    if (!q) return selectedDb.records;
    return selectedDb.records.filter((r) =>
      selectedDb.fields.some((f) =>
        formatCellDisplay(f, r.values).toLowerCase().includes(q)
      )
    );
  }, [selectedDb, dbSearch]);

  // Gerar Banco por IA (Gemini ou Local)
  const handleAiBuildDatabase = async () => {
    const prompt = aiDbPrompt.trim();
    if (!prompt) return;
    setAiDbLoading(true);
    try {
      if (geminiApiKey.trim()) {
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
                      text: `Crie apenas um JSON válido (sem markdown) de esquema de banco de dados para "${prompt}" no formato: {"name":"Nome","icon":"📦","fields":[{"key":"campo","label":"Rótulo","type":"text|number|currency|date|checkbox|select|rating","options":["A","B"]}]}.`,
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
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned) as {
          name?: string;
          icon?: string;
          fields?: { key: string; label: string; type: MementoFieldType; options?: string[] }[];
        };
        if (parsed.name && Array.isArray(parsed.fields) && parsed.fields.length > 0) {
          const newDb: MementoDatabase = {
            id: makeId('mdb'),
            name: parsed.name,
            icon: parsed.icon || '✨',
            description: prompt,
            fields: parsed.fields.map((f) => ({
              id: makeId('f'),
              key: f.key || makeId('k'),
              label: f.label || f.key,
              type: f.type || 'text',
              options: f.options,
            })),
            records: [],
            rules: [],
            createdAt: Date.now(),
          };
          persistStore({ ...store, databases: [newDb, ...store.databases] });
          setAiDbPrompt('');
          setNewDbModal(false);
          setSelectedDbId(newDb.id);
          return;
        }
      }
    } catch {
      // fallback offline abaixo
    } finally {
      setAiDbLoading(false);
    }

    const fallbackDb = buildLocalDatabaseFromPrompt(prompt);
    persistStore({ ...store, databases: [fallbackDb, ...store.databases] });
    setAiDbPrompt('');
    setNewDbModal(false);
    setSelectedDbId(fallbackDb.id);
  };

  // Criar ou Melhorar Mini-App Vibe (HTML/JS)
  const generateVibeHtmlWithAi = async (
    title: string,
    instruction: string,
    baseHtml?: string
  ): Promise<string> => {
    if (!geminiApiKey.trim()) {
      return buildStarterMiniAppHtml(title, instruction);
    }
    try {
      const prompt = baseHtml
        ? `Melhore este mini-app HTML/CSS/JS único arquivo com a instrução "${instruction}". Retorne APENAS o código HTML completo sem blocos markdown:\n\n${baseHtml}`
        : `Crie um mini-app funcional e bonito em um único arquivo HTML+CSS+JS (tema escuro moderno, responsivo para celular) para: "${title} — ${instruction}". Retorne APENAS o código HTML completo começando com <!DOCTYPE html>.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey.trim())}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw.replace(/```html|```/g, '').trim();
      if (cleaned.includes('<html') || cleaned.includes('<body')) {
        return cleaned;
      }
    } catch {
      // fallback
    }
    return baseHtml || buildStarterMiniAppHtml(title, instruction);
  };

  const handleCreateMiniApp = async () => {
    const t = newAppTitle.trim() || 'Meu App Vibe';
    setVibeLoading(true);
    const html = await generateVibeHtmlWithAi(t, newAppPrompt.trim());
    setVibeLoading(false);
    const created: VibeMiniApp = {
      id: makeId('vibe'),
      title: t,
      description: newAppPrompt.trim() || 'App criado no Nexus Vibe',
      htmlCode: html,
      versions: [{ htmlCode: html, savedAt: Date.now() }],
      updatedAt: Date.now(),
    };
    persistStore({ ...store, miniApps: [created, ...store.miniApps] });
    setNewAppTitle('');
    setNewAppPrompt('');
    setNewAppModal(false);
    setActiveAppId(created.id);
    setCodeDraft(html);
    setVibeTab('run');
  };

  const handleImproveActiveApp = async () => {
    if (!activeApp || !vibeChatPrompt.trim()) return;
    setVibeLoading(true);
    const nextHtml = await generateVibeHtmlWithAi(
      activeApp.title,
      vibeChatPrompt.trim(),
      activeApp.htmlCode
    );
    setVibeLoading(false);
    const nextVersions = [
      { htmlCode: activeApp.htmlCode, savedAt: Date.now() },
      ...activeApp.versions,
    ].slice(0, 15);
    const updated: VibeMiniApp = {
      ...activeApp,
      htmlCode: nextHtml,
      versions: nextVersions,
      updatedAt: Date.now(),
    };
    persistStore({
      ...store,
      miniApps: store.miniApps.map((a) => (a.id === updated.id ? updated : a)),
    });
    setCodeDraft(nextHtml);
    setVibeChatPrompt('');
    setVibeTab('run');
  };

  const openRecordModal = (rec?: MementoRecord) => {
    if (!selectedDb) return;
    if (rec) {
      setEditingRecordId(rec.id);
      setRecordValues({ ...rec.values });
    } else {
      setEditingRecordId(null);
      const initVals: Record<string, string | number | boolean> = {};
      for (const f of selectedDb.fields) {
        if (f.type === 'date') initVals[f.key] = new Date().toISOString().slice(0, 10);
        else if (f.type === 'checkbox') initVals[f.key] = false;
        else if (f.type === 'rating') initVals[f.key] = 5;
        else if (f.type === 'select' && f.options?.[0]) initVals[f.key] = f.options[0];
        else initVals[f.key] = '';
      }
      setRecordValues(initVals);
    }
    setRecordModalVisible(true);
  };

  const saveRecord = () => {
    if (!selectedDb) return;
    const processed = applyAutomationRules(selectedDb, recordValues);
    const now = Date.now();
    const nextRecords = editingRecordId
      ? selectedDb.records.map((r) =>
          r.id === editingRecordId
            ? { ...r, values: processed, updatedAt: now }
            : r
        )
      : [
          {
            id: makeId('rec'),
            values: processed,
            createdAt: now,
            updatedAt: now,
          },
          ...selectedDb.records,
        ];
    updateDatabase({ ...selectedDb, records: nextRecords });
    setRecordModalVisible(false);
  };

  const askAiAboutDatabase = async () => {
    if (!selectedDb) return;
    setAiChatLoading(true);

    // Agregação local exata
    const numFields = selectedDb.fields.filter(
      (f) => f.type === 'number' || f.type === 'currency' || f.type === 'formula'
    );
    const summaryLines: string[] = [
      `📊 Banco "${selectedDb.name}" — ${selectedDb.records.length} registro(s)`,
    ];
    for (const nf of numFields) {
      const vals = selectedDb.records.map((r) =>
        nf.type === 'formula'
          ? evaluateFormula(nf.formulaExpr ?? '', r.values)
          : Number(r.values[nf.key]) || 0
      );
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = vals.length ? sum / vals.length : 0;
      const prefix = nf.type === 'currency' ? 'R$ ' : '';
      summaryLines.push(
        `• ${nf.label}: Total ${prefix}${sum.toFixed(2)} | Média ${prefix}${avg.toFixed(2)}`
      );
    }

    if (geminiApiKey.trim() && aiQuestion.trim()) {
      try {
        const csvSample = databaseToCsv(selectedDb).slice(0, 3500);
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
                      text: `Analise estes dados do banco "${selectedDb.name}" (em CSV) e responda em português à pergunta "${aiQuestion}":\n\n${csvSample}`,
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
        const reply = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          setAiAnswer(reply);
          setAiChatLoading(false);
          return;
        }
      } catch {
        // fallback local
      }
    }

    setAiAnswer(summaryLines.join('\n'));
    setAiChatLoading(false);
  };

  // ==========================================
  // TELA 1: EXECUTOR DE MINI-APP VIBE (HTML/JS)
  // ==========================================
  if (activeApp) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <TouchableOpacity onPress={() => setActiveAppId(null)} style={{ padding: 4 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
              ⚡ {activeApp.title}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 11 }}>
              Programação Vibe • {activeApp.versions.length} versão(ões)
            </Text>
          </View>
        </View>

        <View style={[styles.tabsBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          {(
            [
              { k: 'run', l: '▶ Executar' },
              { k: 'code', l: '</> Código & IA' },
              { k: 'versions', l: '🕒 Versões' },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.k}
              onPress={() => setVibeTab(t.k)}
              style={[
                styles.tabItem,
                vibeTab === t.k && { borderBottomWidth: 2.5, borderBottomColor: theme.accent },
              ]}
            >
              <Text style={{ color: vibeTab === t.k ? theme.accent : theme.textDim, fontWeight: '700', fontSize: 12 }}>
                {t.l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {vibeTab === 'run' && (
          <WebView
            key={`${activeApp.id}-${activeApp.updatedAt}`}
            source={{ html: activeApp.htmlCode }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
          />
        )}

        {vibeTab === 'code' && (
          <ScrollView style={{ flex: 1, padding: 14 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sectionLbl, { color: theme.textDim }]}>
              MELHORAR POR BATE-PAPO (IA)
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                value={vibeChatPrompt}
                onChangeText={setVibeChatPrompt}
                placeholder='Ex: "Aumente os botões" ou "Mude a cor para verde"'
                placeholderTextColor={theme.textDim}
              />
              <TouchableOpacity
                onPress={handleImproveActiveApp}
                style={[styles.saveBtn, { backgroundColor: theme.accent, justifyContent: 'center' }]}
              >
                {vibeLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>✨</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionLbl, { color: theme.textDim }]}>
              CÓDIGO FONTE (HTML / CSS / JS)
            </Text>
            <TextInput
              style={[
                styles.codeEditor,
                { backgroundColor: '#020617', borderColor: theme.border, color: '#38BDF8' },
              ]}
              value={codeDraft}
              onChangeText={setCodeDraft}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              onPress={() => {
                const updated: VibeMiniApp = {
                  ...activeApp,
                  htmlCode: codeDraft,
                  versions: [
                    { htmlCode: activeApp.htmlCode, savedAt: Date.now() },
                    ...activeApp.versions,
                  ].slice(0, 15),
                  updatedAt: Date.now(),
                };
                persistStore({
                  ...store,
                  miniApps: store.miniApps.map((a) =>
                    a.id === updated.id ? updated : a
                  ),
                });
                setVibeTab('run');
              }}
              style={[styles.saveBtn, { backgroundColor: '#10B981', alignItems: 'center', marginTop: 10 }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '800' }}>💾 Salvar & Executar</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {vibeTab === 'versions' && (
          <ScrollView style={{ flex: 1, padding: 14 }}>
            {activeApp.versions.map((v, idx) => (
              <TouchableOpacity
                key={`${v.savedAt}-${idx}`}
                onPress={() => {
                  const updated: VibeMiniApp = {
                    ...activeApp,
                    htmlCode: v.htmlCode,
                    updatedAt: Date.now(),
                  };
                  persistStore({
                    ...store,
                    miniApps: store.miniApps.map((a) =>
                      a.id === updated.id ? updated : a
                    ),
                  });
                  setCodeDraft(v.htmlCode);
                  setVibeTab('run');
                }}
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 8 }]}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  ↺ Restaurar versão ({new Date(v.savedAt).toLocaleString('pt-BR')})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ==========================================
  // TELA 2: DENTRO DE UM BANCO DE DADOS
  // ==========================================
  if (selectedDb) {
    const firstField = selectedDb.fields[0];
    const numFields = selectedDb.fields.filter(
      (f) => f.type === 'number' || f.type === 'currency' || f.type === 'formula'
    );
    const selectField = selectedDb.fields.find((f) => f.type === 'select');
    const dateField = selectedDb.fields.find((f) => f.type === 'date');

    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: theme.surface, borderBottomColor: theme.border },
          ]}
        >
          <TouchableOpacity onPress={() => setSelectedDbId(null)} style={{ padding: 4 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 20 }}>{selectedDb.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>
              {selectedDb.name}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 11 }}>
              {selectedDb.records.length} registro(s) • {selectedDb.fields.length} campo(s)
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setAiQuestion('');
              setAiAnswer('');
              setAiChatModalVisible(true);
            }}
            style={[styles.miniBtn, { backgroundColor: '#6D28D9' }]}
          >
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>🤖 IA</Text>
          </TouchableOpacity>
        </View>

        {/* Barra de Visualizações + Ferramentas do Banco */}
        <View style={[styles.subBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {(
              [
                { k: 'list', l: '📋 Lista' },
                { k: 'table', l: '⊞ Tabela' },
                { k: 'cards', l: '🗂 Cartões' },
                { k: 'charts', l: '📊 Gráficos' },
                { k: 'calendar', l: '📅 Calendário' },
              ] as { k: DbViewMode; l: string }[]
            ).map((v) => (
              <TouchableOpacity
                key={v.k}
                onPress={() => setDbViewMode(v.k)}
                style={[
                  styles.subChip,
                  { backgroundColor: dbViewMode === v.k ? theme.accent : theme.surfaceAlt },
                ]}
              >
                <Text style={{ color: dbViewMode === v.k ? '#FFF' : theme.text, fontSize: 11, fontWeight: '700' }}>
                  {v.l}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setFieldsModalVisible(true)}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>⚙ Campos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setRTriggerKey(selectedDb.fields[0]?.key ?? '');
                setRActionKey(selectedDb.fields[selectedDb.fields.length - 1]?.key ?? '');
                setRulesModalVisible(true);
              }}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>
                ⚡ Regras ({selectedDb.rules.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setCsvInput('');
                setCsvModalVisible(true);
              }}
              style={[styles.subChip, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700' }}>📥/📤 CSV</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
          <TextInput
            style={[styles.input, { marginBottom: 8, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            value={dbSearch}
            onChangeText={setDbSearch}
            placeholder="🔍 Pesquisar registros..."
            placeholderTextColor={theme.textDim}
          />
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 14 }}>
          {/* VISUALIZAÇÃO: LISTA / CARTÕES */}
          {(dbViewMode === 'list' || dbViewMode === 'cards') &&
            filteredRecords.map((rec) => {
              const imgField = selectedDb.fields.find((f) => f.type === 'image');
              const imgUri = imgField ? String(rec.values[imgField.key] ?? '') : '';

              return (
                <TouchableOpacity
                  key={rec.id}
                  onPress={() => openRecordModal(rec)}
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 10 },
                  ]}
                >
                  {dbViewMode === 'cards' && imgUri ? (
                    <Image
                      source={{ uri: imgUri }}
                      style={{ width: '100%', height: 140, borderRadius: 10, marginBottom: 8 }}
                      resizeMode="cover"
                    />
                  ) : null}

                  <View style={styles.rowBetween}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800', flex: 1 }}>
                      {firstField ? formatCellDisplay(firstField, rec.values) || '(Sem título)' : 'Registro'}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        updateDatabase({
                          ...selectedDb,
                          records: selectedDb.records.filter((x) => x.id !== rec.id),
                        })
                      }
                    >
                      <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ marginTop: 6, gap: 3 }}>
                    {selectedDb.fields.slice(1).map((f) => {
                      if (f.type === 'image') return null;
                      return (
                        <Text key={f.id} style={{ color: theme.textMuted, fontSize: 12 }}>
                          <Text style={{ color: theme.textDim, fontWeight: '700' }}>{f.label}: </Text>
                          {formatCellDisplay(f, rec.values)}
                        </Text>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            })}

          {/* VISUALIZAÇÃO: TABELA */}
          {dbViewMode === 'table' && (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={[styles.tableBox, { borderColor: theme.border }]}>
                <View style={[styles.tableRow, { backgroundColor: theme.surfaceAlt }]}>
                  {selectedDb.fields.map((f) => (
                    <View key={f.id} style={[styles.tableCell, { borderColor: theme.border }]}>
                      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>
                        {f.label}
                      </Text>
                    </View>
                  ))}
                </View>
                {filteredRecords.map((rec) => (
                  <TouchableOpacity
                    key={rec.id}
                    onPress={() => openRecordModal(rec)}
                    style={[styles.tableRow, { backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.border }]}
                  >
                    {selectedDb.fields.map((f) => (
                      <View key={f.id} style={[styles.tableCell, { borderColor: theme.border }]}>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }} numberOfLines={1}>
                          {formatCellDisplay(f, rec.values)}
                        </Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* VISUALIZAÇÃO: GRÁFICOS & AGREGAÇÃO */}
          {dbViewMode === 'charts' && (
            <View style={{ gap: 12 }}>
              {numFields.map((nf) => {
                const vals = selectedDb.records.map((r) =>
                  nf.type === 'formula'
                    ? evaluateFormula(nf.formulaExpr ?? '', r.values)
                    : Number(r.values[nf.key]) || 0
                );
                const sum = vals.reduce((a, b) => a + b, 0);
                const avg = vals.length ? sum / vals.length : 0;
                const max = vals.length ? Math.max(...vals) : 0;
                const pre = nf.type === 'currency' ? 'R$ ' : '';
                return (
                  <View key={nf.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={{ color: theme.text, fontWeight: '800', marginBottom: 6 }}>
                      📊 Agregação: {nf.label}
                    </Text>
                    <Text style={{ color: '#10B981', fontWeight: '700' }}>Soma: {pre}{sum.toFixed(2)}</Text>
                    <Text style={{ color: '#38BDF8', fontWeight: '700' }}>Média: {pre}{avg.toFixed(2)}</Text>
                    <Text style={{ color: '#F59E0B', fontWeight: '700' }}>Máximo: {pre}{max.toFixed(2)}</Text>
                  </View>
                );
              })}

              {selectField && (
                <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={{ color: theme.text, fontWeight: '800', marginBottom: 10 }}>
                    Por {selectField.label}
                  </Text>
                  {(selectField.options ?? []).map((opt) => {
                    const count = selectedDb.records.filter(
                      (r) => String(r.values[selectField.key]) === opt
                    ).length;
                    const pct =
                      selectedDb.records.length > 0
                        ? Math.round((count / selectedDb.records.length) * 100)
                        : 0;
                    return (
                      <View key={opt} style={{ marginBottom: 8 }}>
                        <View style={styles.rowBetween}>
                          <Text style={{ color: theme.textMuted, fontSize: 12 }}>{opt}</Text>
                          <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 12 }}>
                            {count} ({pct}%)
                          </Text>
                        </View>
                        <View style={[styles.barTrack, { backgroundColor: theme.surfaceAlt }]}>
                          <View style={{ width: `${Math.max(3, pct)}%`, height: '100%', backgroundColor: theme.accent }} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* VISUALIZAÇÃO: CALENDÁRIO (AGRUPADO POR DATA) */}
          {dbViewMode === 'calendar' && (
            <View style={{ gap: 10 }}>
              {!dateField ? (
                <Text style={{ color: theme.textDim }}>
                  Adicione um campo tipo "Data" em ⚙ Campos para agrupar por calendário.
                </Text>
              ) : (
                filteredRecords
                  .slice()
                  .sort((a, b) =>
                    String(b.values[dateField.key] ?? '').localeCompare(
                      String(a.values[dateField.key] ?? '')
                    )
                  )
                  .map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => openRecordModal(r)}
                      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    >
                      <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800' }}>
                        📅 {String(r.values[dateField.key] || 'Sem data')}
                      </Text>
                      <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700', marginTop: 2 }}>
                        {firstField ? formatCellDisplay(firstField, r.values) : 'Registro'}
                      </Text>
                    </TouchableOpacity>
                  ))
              )}
            </View>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>

        <TouchableOpacity
          onPress={() => openRecordModal()}
          style={[styles.fabBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>
            + Novo Registro
          </Text>
        </TouchableOpacity>

        {/* MODAL: Novo / Editar Registro */}
        <Modal
          visible={recordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRecordModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '88%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingRecordId ? '✏️ Editar Registro' : '+ Novo Registro'}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {selectedDb.fields.map((f) => {
                  const val = recordValues[f.key];
                  return (
                    <View key={f.id} style={{ marginBottom: 12 }}>
                      <Text style={{ color: theme.textDim, fontSize: 11, fontWeight: '800', marginBottom: 4 }}>
                        {f.label.toUpperCase()}
                      </Text>

                      {f.type === 'formula' ? (
                        <View style={[styles.input, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                          <Text style={{ color: '#10B981', fontWeight: '800' }}>
                            = {evaluateFormula(f.formulaExpr ?? '', recordValues)} ({f.formulaExpr})
                          </Text>
                        </View>
                      ) : f.type === 'checkbox' ? (
                        <TouchableOpacity
                          onPress={() =>
                            setRecordValues((p) => ({ ...p, [f.key]: !p[f.key] }))
                          }
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                          <Text style={{ fontSize: 22, color: val ? '#10B981' : theme.textDim }}>
                            {val ? '☑' : '☐'}
                          </Text>
                          <Text style={{ color: theme.text }}>{val ? 'Sim' : 'Não'}</Text>
                        </TouchableOpacity>
                      ) : f.type === 'rating' ? (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          {[1, 2, 3, 4, 5].map((st) => (
                            <TouchableOpacity
                              key={st}
                              onPress={() =>
                                setRecordValues((p) => ({ ...p, [f.key]: st }))
                              }
                            >
                              <Text style={{ fontSize: 24, color: (Number(val) || 0) >= st ? '#F59E0B' : theme.textDim }}>
                                ★
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : f.type === 'select' ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {(f.options ?? []).map((opt) => (
                            <TouchableOpacity
                              key={opt}
                              onPress={() =>
                                setRecordValues((p) => ({ ...p, [f.key]: opt }))
                              }
                              style={[
                                styles.subChip,
                                {
                                  backgroundColor:
                                    val === opt ? theme.accent : theme.surfaceAlt,
                                },
                              ]}
                            >
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{opt}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      ) : f.type === 'relation' && f.targetDbId ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {(
                            store.databases.find((d) => d.id === f.targetDbId)?.records ??
                            []
                          ).map((relRec) => {
                            const targetDb = store.databases.find((d) => d.id === f.targetDbId);
                            const lblField = targetDb?.fields[0];
                            const lbl = lblField
                              ? String(relRec.values[lblField.key] ?? relRec.id)
                              : relRec.id;
                            return (
                              <TouchableOpacity
                                key={relRec.id}
                                onPress={() =>
                                  setRecordValues((p) => ({ ...p, [f.key]: relRec.id }))
                                }
                                style={[
                                  styles.subChip,
                                  {
                                    backgroundColor:
                                      val === relRec.id ? theme.accent : theme.surfaceAlt,
                                  },
                                ]}
                              >
                                <Text style={{ color: '#FFF', fontSize: 12 }}>🔗 {lbl}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      ) : f.type === 'image' ? (
                        <View>
                          {val ? (
                            <Image
                              source={{ uri: String(val) }}
                              style={{ width: '100%', height: 110, borderRadius: 8, marginBottom: 6 }}
                            />
                          ) : null}
                          <TouchableOpacity
                            onPress={async () => {
                              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                              if (!perm.granted) return;
                              const res = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ['images'],
                                quality: 0.8,
                              });
                              if (!res.canceled && res.assets.length > 0) {
                                const saved = await persistMediaFile(res.assets[0].uri, 'memento.jpg');
                                setRecordValues((p) => ({ ...p, [f.key]: saved }));
                              }
                            }}
                            style={[styles.subChip, { backgroundColor: theme.surfaceAlt, alignSelf: 'flex-start' }]}
                          >
                            <Text style={{ color: theme.text, fontWeight: '700' }}>🖼️ Escolher Foto</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TextInput
                          style={[styles.input, { marginBottom: 0, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                          value={String(val ?? '')}
                          onChangeText={(txt) =>
                            setRecordValues((p) => ({
                              ...p,
                              [f.key]:
                                f.type === 'number' || f.type === 'currency'
                                  ? txt.replace(',', '.')
                                  : txt,
                            }))
                          }
                          keyboardType={
                            f.type === 'number' || f.type === 'currency'
                              ? 'numeric'
                              : 'default'
                          }
                          placeholder={f.type === 'date' ? 'AAAA-MM-DD' : f.label}
                          placeholderTextColor={theme.textDim}
                        />
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <TouchableOpacity onPress={() => setRecordModalVisible(false)} style={{ padding: 8 }}>
                  <Text style={{ color: theme.textDim }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveRecord} style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL: Campos */}
        <Modal
          visible={fieldsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFieldsModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '86%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>⚙ Campos da Tabela</Text>
              <ScrollView>
                {selectedDb.fields.map((f) => (
                  <View key={f.id} style={[styles.rowBetween, { paddingVertical: 8, borderBottomWidth: 0.5, borderColor: theme.border }]}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>
                      {f.label} ({f.type})
                    </Text>
                    {selectedDb.fields.length > 1 && (
                      <TouchableOpacity
                        onPress={() =>
                          updateDatabase({
                            ...selectedDb,
                            fields: selectedDb.fields.filter((x) => x.id !== f.id),
                          })
                        }
                      >
                        <Text style={{ color: '#F87171' }}>🗑</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <Text style={[styles.sectionLbl, { color: theme.textDim, marginTop: 14 }]}>
                  + ADICIONAR CAMPO
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  value={newFieldLabel}
                  onChangeText={setNewFieldLabel}
                  placeholder="Nome do campo..."
                  placeholderTextColor={theme.textDim}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                  {FIELD_TYPE_LABELS.map((ft) => (
                    <TouchableOpacity
                      key={ft.type}
                      onPress={() => setNewFieldType(ft.type)}
                      style={[
                        styles.subChip,
                        { backgroundColor: newFieldType === ft.type ? theme.accent : theme.surfaceAlt },
                      ]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                        {ft.icon} {ft.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {(newFieldType === 'select' || newFieldType === 'formula') && (
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                    value={newFieldExtra}
                    onChangeText={setNewFieldExtra}
                    placeholder={
                      newFieldType === 'select'
                        ? 'Opções separadas por vírgula (A, B, C)'
                        : 'Fórmula (ex: qtd * preco)'
                    }
                    placeholderTextColor={theme.textDim}
                  />
                )}

                {newFieldType === 'relation' && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                    {store.databases
                      .filter((d) => d.id !== selectedDb.id)
                      .map((d) => (
                        <TouchableOpacity
                          key={d.id}
                          onPress={() => setNewFieldTargetDb(d.id)}
                          style={[
                            styles.subChip,
                            { backgroundColor: newFieldTargetDb === d.id ? theme.accent : theme.surfaceAlt },
                          ]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11 }}>{d.name}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                )}

                <TouchableOpacity
                  onPress={() => {
                    const lbl = newFieldLabel.trim();
                    if (!lbl) return;
                    const key = lbl
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '_')
                      .slice(0, 16) || makeId('k');
                    const created: MementoField = {
                      id: makeId('f'),
                      key,
                      label: lbl,
                      type: newFieldType,
                      options:
                        newFieldType === 'select'
                          ? newFieldExtra.split(',').map((s) => s.trim()).filter(Boolean)
                          : undefined,
                      formulaExpr:
                        newFieldType === 'formula' ? newFieldExtra : undefined,
                      targetDbId:
                        newFieldType === 'relation' ? newFieldTargetDb : undefined,
                    };
                    updateDatabase({
                      ...selectedDb,
                      fields: [...selectedDb.fields, created],
                    });
                    setNewFieldLabel('');
                    setNewFieldExtra('');
                  }}
                  style={[styles.saveBtn, { backgroundColor: theme.accent, alignItems: 'center' }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>+ Adicionar Campo</Text>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity onPress={() => setFieldsModalVisible(false)} style={{ alignItems: 'center', paddingTop: 10 }}>
                <Text style={{ color: theme.textDim }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: Regras de Automação */}
        <Modal
          visible={rulesModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRulesModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '85%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>⚡ Automação Sem Código</Text>
              <ScrollView>
                {selectedDb.rules.map((rl) => (
                  <View key={rl.id} style={[styles.rowBetween, { padding: 8, backgroundColor: theme.surfaceAlt, borderRadius: 8, marginBottom: 6 }]}>
                    <Text style={{ color: theme.text, fontSize: 12, flex: 1 }}>
                      Se "{rl.triggerFieldKey}" {rl.operator} "{rl.triggerValue}" → definir "{rl.actionFieldKey}" = "{rl.actionValue}"
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        updateDatabase({
                          ...selectedDb,
                          rules: selectedDb.rules.filter((x) => x.id !== rl.id),
                        })
                      }
                    >
                      <Text style={{ color: '#F87171' }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.sectionLbl, { color: theme.textDim, marginTop: 10 }]}>
                  NOVA REGRA (QUANDO SALVAR):
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  value={rTriggerKey}
                  onChangeText={setRTriggerKey}
                  placeholder="Chave do campo gatilho (ex: valor)"
                  placeholderTextColor={theme.textDim}
                />
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                  {(['gt', 'lt', 'equals', 'contains'] as const).map((op) => (
                    <TouchableOpacity
                      key={op}
                      onPress={() => setROp(op)}
                      style={[styles.subChip, { backgroundColor: rOp === op ? theme.accent : theme.surfaceAlt }]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11 }}>{op}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  value={rTriggerVal}
                  onChangeText={setRTriggerVal}
                  placeholder="Valor condição (ex: 100)"
                  placeholderTextColor={theme.textDim}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  value={rActionKey}
                  onChangeText={setRActionKey}
                  placeholder="Campo a alterar (ex: pago)"
                  placeholderTextColor={theme.textDim}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                  value={rActionVal}
                  onChangeText={setRActionVal}
                  placeholder="Novo valor (ex: true)"
                  placeholderTextColor={theme.textDim}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (!rTriggerKey.trim() || !rActionKey.trim()) return;
                    const rule: MementoRule = {
                      id: makeId('rl'),
                      triggerFieldKey: rTriggerKey.trim(),
                      operator: rOp,
                      triggerValue: rTriggerVal.trim(),
                      actionFieldKey: rActionKey.trim(),
                      actionValue: rActionVal.trim(),
                    };
                    updateDatabase({
                      ...selectedDb,
                      rules: [...selectedDb.rules, rule],
                    });
                    setRTriggerVal('');
                    setRActionVal('');
                  }}
                  style={[styles.saveBtn, { backgroundColor: theme.accent, alignItems: 'center' }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>+ Criar Regra</Text>
                </TouchableOpacity>
              </ScrollView>
              <TouchableOpacity onPress={() => setRulesModalVisible(false)} style={{ alignItems: 'center', paddingTop: 10 }}>
                <Text style={{ color: theme.textDim }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: Assistente IA de Dados */}
        <Modal
          visible={aiChatModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAiChatModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { maxHeight: '80%', backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🤖 Assistente do Banco</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={aiQuestion}
                onChangeText={setAiQuestion}
                placeholder='Ex: "Quanto gastei no total?"'
                placeholderTextColor={theme.textDim}
              />
              <TouchableOpacity
                onPress={askAiAboutDatabase}
                style={[styles.saveBtn, { backgroundColor: theme.accent, alignItems: 'center', marginBottom: 12 }]}
              >
                {aiChatLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>✨ Analisar Dados</Text>
                )}
              </TouchableOpacity>
              <ScrollView>
                <Text style={{ color: theme.textMuted, fontSize: 13, lineHeight: 20 }}>
                  {aiAnswer || 'Toque em "Analisar Dados" para ver somas, médias ou perguntar via Gemini.'}
                </Text>
              </ScrollView>
              <TouchableOpacity onPress={() => setAiChatModalVisible(false)} style={{ alignItems: 'center', paddingTop: 10 }}>
                <Text style={{ color: theme.textDim }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL: Importar / Exportar CSV & Espaços */}
        <Modal
          visible={csvModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCsvModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>📥 / 📤 Dados & CSV</Text>
              <TouchableOpacity
                style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
                onPress={() =>
                  Share.share({
                    title: `${selectedDb.name}.csv`,
                    message: databaseToCsv(selectedDb),
                  })
                }
              >
                <Text style={{ color: '#38BDF8', fontWeight: '700' }}>📤 Exportar CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
                onPress={() => {
                  const rows = [
                    selectedDb.fields.map((f) => f.label),
                    ...selectedDb.records.map((r) =>
                      selectedDb.fields.map((f) => formatCellDisplay(f, r.values))
                    ),
                  ];
                  const blocks: EditorBlock[] = [
                    createBlock('callout', `Tabela Memento: ${selectedDb.name}`),
                    createBlock('table', '', { tableData: rows }),
                  ];
                  onExportToSpaces(selectedDb.name, serializeBlocks(blocks));
                  setCsvModalVisible(false);
                }}
              >
                <Text style={{ color: theme.text, fontWeight: '700' }}>📄 Enviar Tabela para Espaços</Text>
              </TouchableOpacity>

              <Text style={[styles.sectionLbl, { color: theme.textDim, marginTop: 8 }]}>
                IMPORTAR LINHAS CSV (SEPARADAS POR VÍRGULA):
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, minHeight: 80, textAlignVertical: 'top' }]}
                value={csvInput}
                onChangeText={setCsvInput}
                multiline
                placeholder="Ex: Café, 12.50, Alimentação"
                placeholderTextColor={theme.textDim}
              />
              <TouchableOpacity
                onPress={() => {
                  const lines = csvInput.split('\n').map((l) => l.trim()).filter(Boolean);
                  if (lines.length === 0) return;
                  const newRecs: MementoRecord[] = lines.map((line, idx) => {
                    const parts = line.split(',').map((p) => p.trim());
                    const vals: Record<string, string | number | boolean> = {};
                    selectedDb.fields.forEach((f, fi) => {
                      if (f.type !== 'formula' && parts[fi] !== undefined) {
                        vals[f.key] = parts[fi];
                      }
                    });
                    return {
                      id: makeId('r'),
                      values: vals,
                      createdAt: Date.now() + idx,
                      updatedAt: Date.now() + idx,
                    };
                  });
                  updateDatabase({
                    ...selectedDb,
                    records: [...newRecs, ...selectedDb.records],
                  });
                  setCsvModalVisible(false);
                }}
                style={[styles.saveBtn, { backgroundColor: '#10B981', alignItems: 'center' }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>📥 Importar CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCsvModalVisible(false)} style={{ alignItems: 'center', paddingTop: 10 }}>
                <Text style={{ color: theme.textDim }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ==========================================
  // TELA PRINCIPAL DO MEMENTO DATABASE & VIBE
  // ==========================================
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={onOpenDrawer} style={{ padding: 4 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>☰</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 19, fontWeight: '800' }}>
            Memento Database
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 11 }}>
            Bancos relacionais + Programação Vibe IA
          </Text>
        </View>
        <TouchableOpacity onPress={onBackHome} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>Início</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.tabsBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => setHubSection('databases')}
          style={[
            styles.tabItem,
            hubSection === 'databases' && { borderBottomWidth: 2.5, borderBottomColor: theme.accent },
          ]}
        >
          <Text style={{ color: hubSection === 'databases' ? theme.accent : theme.textDim, fontWeight: '800', fontSize: 13 }}>
            🗄 Bancos ({store.databases.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setHubSection('vibe')}
          style={[
            styles.tabItem,
            hubSection === 'vibe' && { borderBottomWidth: 2.5, borderBottomColor: theme.accent },
          ]}
        >
          <Text style={{ color: hubSection === 'vibe' ? theme.accent : theme.textDim, fontWeight: '800', fontSize: 13 }}>
            ⚡ Apps Vibe ({store.miniApps.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, padding: 14 }}>
        {hubSection === 'databases' ? (
          <View style={{ gap: 10 }}>
            {store.databases.map((db) => (
              <TouchableOpacity
                key={db.id}
                onPress={() => {
                  setDbSearch('');
                  setDbViewMode('list');
                  setSelectedDbId(db.id);
                }}
                style={[
                  styles.card,
                  styles.rowBetween,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Text style={{ fontSize: 28 }}>{db.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                      {db.name}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 12 }} numberOfLines={1}>
                      {db.records.length} registro(s) • {db.fields.length} campos
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Excluir Banco', `Excluir "${db.name}"?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: () =>
                          persistStore({
                            ...store,
                            databases: store.databases.filter((x) => x.id !== db.id),
                          }),
                      },
                    ])
                  }
                >
                  <Text style={{ color: '#F87171', fontSize: 15 }}>🗑</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {store.miniApps.map((app) => (
              <TouchableOpacity
                key={app.id}
                onPress={() => {
                  setActiveAppId(app.id);
                  setCodeDraft(app.htmlCode);
                  setVibeTab('run');
                }}
                style={[
                  styles.card,
                  styles.rowBetween,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <Text style={{ fontSize: 26 }}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                      {app.title}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 12 }} numberOfLines={1}>
                      {app.description}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    persistStore({
                      ...store,
                      miniApps: store.miniApps.filter((x) => x.id !== app.id),
                    })
                  }
                >
                  <Text style={{ color: '#F87171', fontSize: 15 }}>🗑</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ height: 95 }} />
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          if (hubSection === 'databases') {
            setNewDbName('');
            setAiDbPrompt('');
            setNewDbModal(true);
          } else {
            setNewAppTitle('');
            setNewAppPrompt('');
            setNewAppModal(true);
          }
        }}
        style={[styles.fabBtn, { backgroundColor: theme.accent }]}
      >
        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 14 }}>
          {hubSection === 'databases' ? '+ Novo Banco / IA' : '+ Criar App Vibe'}
        </Text>
      </TouchableOpacity>

      {/* MODAL: Criar Novo Banco (Modelos ou IA) */}
      <Modal
        visible={newDbModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNewDbModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { maxHeight: '86%', backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>🗄 Novo Banco de Dados</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.sectionLbl, { color: theme.textDim }]}>
                ✨ CONSTRUTOR POR IA (DESCREVA O QUE PRECISA):
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={aiDbPrompt}
                onChangeText={setAiDbPrompt}
                placeholder='Ex: "Controle de treinos de academia"'
                placeholderTextColor={theme.textDim}
              />
              <TouchableOpacity
                onPress={handleAiBuildDatabase}
                style={[styles.saveBtn, { backgroundColor: '#6D28D9', alignItems: 'center', marginBottom: 14 }]}
              >
                {aiDbLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>✨ Gerar Banco Automaticamente</Text>
                )}
              </TouchableOpacity>

              <Text style={[styles.sectionLbl, { color: theme.textDim }]}>
                OU ESCOLHA UM MODELO PRONTO:
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
                value={newDbName}
                onChangeText={setNewDbName}
                placeholder="Nome personalizado (opcional)..."
                placeholderTextColor={theme.textDim}
              />
              {(
                [
                  { k: 'expenses', l: '💰 Controle de Despesas' },
                  { k: 'inventory', l: '📦 Estoque & Inventário (c/ Fórmula)' },
                  { k: 'crm', l: '👥 CRM & Contatos' },
                  { k: 'catalog', l: '📚 Catálogo / Coleção' },
                  { k: 'blank', l: '📄 Banco em Branco' },
                ] as const
              ).map((tpl) => (
                <TouchableOpacity
                  key={tpl.k}
                  onPress={() => {
                    const created = createDbFromTemplate(tpl.k, newDbName.trim() || undefined);
                    persistStore({ ...store, databases: [created, ...store.databases] });
                    setNewDbModal(false);
                    setSelectedDbId(created.id);
                  }}
                  style={[styles.menuRow, { backgroundColor: theme.surfaceAlt }]}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>{tpl.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setNewDbModal(false)} style={{ alignItems: 'center', paddingTop: 8 }}>
              <Text style={{ color: theme.textDim }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: Criar App Vibe */}
      <Modal
        visible={newAppModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNewAppModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>⚡ Programação Vibe (IA)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={newAppTitle}
              onChangeText={setNewAppTitle}
              placeholder="Nome do Mini-App (ex: Rastreador de Água)"
              placeholderTextColor={theme.textDim}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text, minHeight: 80, textAlignVertical: 'top' }]}
              value={newAppPrompt}
              onChangeText={setNewAppPrompt}
              multiline
              placeholder="Descreva o que o app deve fazer..."
              placeholderTextColor={theme.textDim}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setNewAppModal(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateMiniApp}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                {vibeLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>✨ Criar App</Text>
                )}
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
  tabsBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  subBar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  subChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tableBox: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 14 },
  tableRow: { flexDirection: 'row' },
  tableCell: { width: 112, borderRightWidth: 1, paddingHorizontal: 8, paddingVertical: 8 },
  barTrack: { height: 7, borderRadius: 4, marginTop: 4, overflow: 'hidden' },
  codeEditor: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 230,
    fontFamily: 'monospace',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  fabBtn: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 18,
    elevation: 5,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 18 },
  modalBox: { borderRadius: 16, borderWidth: 1, padding: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12 },
  sectionLbl: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, marginBottom: 10 },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9 },
  menuRow: { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginBottom: 8 },
});
