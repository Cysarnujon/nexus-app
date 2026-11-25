import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
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
  getAppMeta,
  setAppMeta,
} from '../database/db';
import {
  EditorBlock,
  EditorTheme,
  createBlock,
  extractPlainTextFromContent,
  parseContentToBlocks,
  serializeBlocks,
} from '../editor/blocks';
import { ProductivityToolDef } from '../data/productivityCatalog';

interface ToolRunnerProps {
  tool: ProductivityToolDef;
  nodes: NexusNode[];
  courses: CourseItem[];
  lessons: CourseLessonItem[];
  theme: EditorTheme;
  onExportToSpaces: (title: string, serializedContent: string) => void;
}

// 1. POMODORO REAL
function PomodoroTool({ theme }: { theme: EditorTheme }) {
  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionsDone, setSessionsDone] = useState<number>(() => {
    const raw = getAppMeta('prod_pomodoro_count');
    return raw ? Number(raw) || 0 : 0;
  });

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          if (mode === 'focus') {
            setSessionsDone((c) => {
              const next = c + 1;
              setAppMeta('prod_pomodoro_count', String(next));
              return next;
            });
            Alert.alert('Pomodoro concluído!', 'Hora de fazer uma pausa.');
          } else {
            Alert.alert('Pausa encerrada!', 'Pronto para voltar ao foco?');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, mode]);

  const switchMode = (nextMode: 'focus' | 'short' | 'long') => {
    setRunning(false);
    setMode(nextMode);
    setSecondsLeft(
      nextMode === 'focus' ? 25 * 60 : nextMode === 'short' ? 5 * 60 : 15 * 60
    );
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.rowGap}>
        {(
          [
            { k: 'focus', l: 'Foco (25m)' },
            { k: 'short', l: 'Pausa (5m)' },
            { k: 'long', l: 'Longa (15m)' },
          ] as const
        ).map((m) => (
          <TouchableOpacity
            key={m.k}
            onPress={() => switchMode(m.k)}
            style={[
              styles.pillBtn,
              {
                flex: 1,
                backgroundColor: mode === m.k ? '#EF4444' : theme.surface,
                borderColor: mode === m.k ? '#EF4444' : theme.border,
              },
            ]}
          >
            <Text
              style={{
                color: mode === m.k ? '#FFF' : theme.textMuted,
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {m.l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View
        style={[
          styles.bigCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={{ fontSize: 56, fontWeight: '800', color: theme.text }}>
          {mm}:{ss}
        </Text>
        <Text style={{ color: theme.textDim, fontSize: 13, marginTop: 4 }}>
          🍅 {sessionsDone} sessão(ões) de foco concluídas
        </Text>

        <View style={[styles.rowGap, { marginTop: 20, width: '100%' }]}>
          <TouchableOpacity
            onPress={() => setRunning((r) => !r)}
            style={[
              styles.primaryBtn,
              { flex: 1, backgroundColor: running ? '#F59E0B' : '#10B981' },
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {running ? '⏸ Pausar' : '▶ Iniciar'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => switchMode(mode)}
            style={[
              styles.primaryBtn,
              { backgroundColor: theme.surfaceAlt, paddingHorizontal: 18 },
            ]}
          >
            <Text style={{ color: theme.text, fontWeight: '700' }}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// 2. CONTAGEM REGRESSIVA
interface CountdownItem {
  id: string;
  title: string;
  dateBr: string;
}

function CountdownTool({ theme }: { theme: EditorTheme }) {
  const [items, setItems] = useState<CountdownItem[]>(() => {
    try {
      const raw = getAppMeta('prod_countdowns');
      return raw ? (JSON.parse(raw) as CountdownItem[]) : [];
    } catch {
      return [];
    }
  });
  const [title, setTitle] = useState('');
  const [dateBr, setDateBr] = useState('');

  const saveItems = (next: CountdownItem[]) => {
    setItems(next);
    setAppMeta('prod_countdowns', JSON.stringify(next));
  };

  const addItem = () => {
    const t = title.trim();
    const d = dateBr.trim();
    if (!t || !/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
      Alert.alert(
        'Formato inválido',
        'Digite um título e a data no formato DD/MM/AAAA (ex: 31/12/2026).'
      );
      return;
    }
    saveItems([...items, { id: `cd-${Date.now()}`, title: t, dateBr: d }]);
    setTitle('');
    setDateBr('');
  };

  const getDaysDiff = (br: string): string => {
    const [dd, mm, yyyy] = br.split('/').map(Number);
    const target = new Date(yyyy, mm - 1, dd);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (isNaN(diff)) return 'Data inválida';
    if (diff === 0) return '🔥 É hoje!';
    if (diff > 0) return `⏳ Faltam ${diff} dia(s)`;
    return `✅ Passou há ${Math.abs(diff)} dia(s)`;
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder="Evento / Meta (ex: Prova, Lançamento)"
          placeholderTextColor={theme.textDim}
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
          value={dateBr}
          onChangeText={setDateBr}
          placeholder="Data (DD/MM/AAAA)"
          placeholderTextColor={theme.textDim}
          keyboardType="numeric"
        />
        <TouchableOpacity
          onPress={addItem}
          style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.primaryBtnText}>+ Adicionar Contagem</Text>
        </TouchableOpacity>
      </View>

      {items.map((item) => (
        <View
          key={item.id}
          style={[
            styles.card,
            styles.rowBetween,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>
              {item.title}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 12 }}>
              Data: {item.dateBr}
            </Text>
            <Text style={{ color: '#8B5CF6', fontSize: 13, fontWeight: '800', marginTop: 4 }}>
              {getDaysDiff(item.dateBr)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => saveItems(items.filter((x) => x.id !== item.id))}
          >
            <Text style={{ color: '#F87171', fontSize: 15 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// 3. RODA DA VIDA (8 Áreas)
const WHEEL_AREAS = [
  { key: 'health', label: 'Saúde & Energia', color: '#10B981' },
  { key: 'career', label: 'Carreira & Trabalho', color: '#3B82F6' },
  { key: 'finance', label: 'Finanças', color: '#F59E0B' },
  { key: 'study', label: 'Estudos & Mente', color: '#6366F1' },
  { key: 'family', label: 'Família & Amor', color: '#EC4899' },
  { key: 'social', label: 'Amigos & Social', color: '#0EA5E9' },
  { key: 'leisure', label: 'Lazer & Diversão', color: '#A855F7' },
  { key: 'purpose', label: 'Espiritualidade & Propósito', color: '#14B8A6' },
];

function WheelOfLifeTool({
  theme,
  onExportToSpaces,
}: {
  theme: EditorTheme;
  onExportToSpaces: (title: string, serialized: string) => void;
}) {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    try {
      const raw = getAppMeta('prod_wheel');
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  const updateScore = (key: string, delta: number) => {
    const cur = scores[key] ?? 5;
    const nextVal = Math.max(1, Math.min(10, cur + delta));
    const next = { ...scores, [key]: nextVal };
    setScores(next);
    setAppMeta('prod_wheel', JSON.stringify(next));
  };

  const avg = useMemo(() => {
    const sum = WHEEL_AREAS.reduce((acc, a) => acc + (scores[a.key] ?? 5), 0);
    return (sum / WHEEL_AREAS.length).toFixed(1);
  }, [scores]);

  const exportWheel = () => {
    const rows = [
      ['Área da Vida', 'Nota (1-10)'],
      ...WHEEL_AREAS.map((a) => [a.label, String(scores[a.key] ?? 5)]),
    ];
    const blocks = [
      createBlock('callout', `Média Geral da Roda da Vida: ${avg}/10`),
      createBlock('table', '', { tableData: rows }),
      createBlock('paragraph', '#rodadavida #equilibrio'),
    ];
    onExportToSpaces('Minha Roda da Vida', serializeBlocks(blocks));
  };

  return (
    <View style={{ gap: 10 }}>
      <View
        style={[
          styles.card,
          styles.rowBetween,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View>
          <Text style={{ color: theme.textDim, fontSize: 11, fontWeight: '700' }}>
            MÉDIA GERAL
          </Text>
          <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>
            {avg} / 10
          </Text>
        </View>
        <TouchableOpacity
          onPress={exportWheel}
          style={[styles.pillBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
        >
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>
            📄 Salvar nos Espaços
          </Text>
        </TouchableOpacity>
      </View>

      {WHEEL_AREAS.map((area) => {
        const val = scores[area.key] ?? 5;
        return (
          <View
            key={area.key}
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
                {area.label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => updateScore(area.key, -1)}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceAlt }]}
                >
                  <Text style={{ color: theme.text, fontWeight: '800' }}>−</Text>
                </TouchableOpacity>
                <Text style={{ color: area.color, fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' }}>
                  {val}
                </Text>
                <TouchableOpacity
                  onPress={() => updateScore(area.key, 1)}
                  style={[styles.stepBtn, { backgroundColor: theme.surfaceAlt }]}
                >
                  <Text style={{ color: theme.text, fontWeight: '800' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.surfaceAlt }]}>
              <View
                style={{
                  width: `${val * 10}%`,
                  height: '100%',
                  backgroundColor: area.color,
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// 4. RASTREADOR DE HÁBITOS
interface HabitItem {
  id: string;
  title: string;
  streak: number;
  lastCheckedDate: string;
}

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function HabitsTool({ theme }: { theme: EditorTheme }) {
  const [habits, setHabits] = useState<HabitItem[]>(() => {
    try {
      const raw = getAppMeta('prod_habits');
      return raw ? (JSON.parse(raw) as HabitItem[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const today = getTodayIso();

  const saveHabits = (next: HabitItem[]) => {
    setHabits(next);
    setAppMeta('prod_habits', JSON.stringify(next));
  };

  const addHabit = () => {
    const t = input.trim();
    if (!t) return;
    saveHabits([
      ...habits,
      { id: `hab-${Date.now()}`, title: t, streak: 0, lastCheckedDate: '' },
    ]);
    setInput('');
  };

  const toggleHabitToday = (id: string) => {
    const next = habits.map((h) => {
      if (h.id !== id) return h;
      if (h.lastCheckedDate === today) {
        return {
          ...h,
          streak: Math.max(0, h.streak - 1),
          lastCheckedDate: '',
        };
      }
      return {
        ...h,
        streak: h.streak + 1,
        lastCheckedDate: today,
      };
    });
    saveHabits(next);
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'row', gap: 8 },
        ]}
      >
        <TextInput
          style={[
            styles.input,
            { flex: 1, marginBottom: 0, backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Novo hábito (ex: Ler 20 min, Treinar)..."
          placeholderTextColor={theme.textDim}
        />
        <TouchableOpacity
          onPress={addHabit}
          style={[styles.primaryBtn, { backgroundColor: theme.accent, paddingHorizontal: 16 }]}
        >
          <Text style={styles.primaryBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {habits.length === 0 ? (
        <Text style={{ color: theme.textDim, textAlign: 'center', marginTop: 20 }}>
          Adicione seus hábitos diários acima para acompanhar sua constância!
        </Text>
      ) : (
        habits.map((h) => {
          const doneToday = h.lastCheckedDate === today;
          return (
            <View
              key={h.id}
              style={[
                styles.card,
                styles.rowBetween,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggleHabitToday(h.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
              >
                <Text style={{ fontSize: 20, color: doneToday ? '#10B981' : theme.textDim }}>
                  {doneToday ? '☑' : '☐'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '700' }}>
                    {h.title}
                  </Text>
                  <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '700' }}>
                    🔥 {h.streak} dia(s)
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => saveHabits(habits.filter((x) => x.id !== h.id))}
              >
                <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}

// 5. FLASHCARDS INTERATIVOS
interface FlashcardItem {
  id: string;
  front: string;
  back: string;
}

function FlashcardsTool({ theme }: { theme: EditorTheme }) {
  const [cards, setCards] = useState<FlashcardItem[]>(() => {
    try {
      const raw = getAppMeta('prod_flashcards');
      return raw
        ? (JSON.parse(raw) as FlashcardItem[])
        : [
            {
              id: 'fc-demo',
              front: 'O que é Revisão Espaçada?',
              back: 'Técnica de revisar conteúdos em intervalos crescentes para fixar na memória de longo prazo.',
            },
          ];
    } catch {
      return [];
    }
  });
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');

  const saveCards = (next: FlashcardItem[]) => {
    setCards(next);
    setAppMeta('prod_flashcards', JSON.stringify(next));
  };

  const addCard = () => {
    if (!front.trim() || !back.trim()) return;
    saveCards([
      ...cards,
      { id: `fc-${Date.now()}`, front: front.trim(), back: back.trim() },
    ]);
    setFront('');
    setBack('');
  };

  const safeIdx = cards.length > 0 ? idx % cards.length : 0;
  const activeCard = cards[safeIdx];

  return (
    <View style={{ gap: 14 }}>
      {activeCard && (
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setFlipped((f) => !f)}
            style={[
              styles.flashcardBox,
              {
                backgroundColor: flipped
                  ? theme.isDark
                    ? '#1E1B4B'
                    : '#EDE9FE'
                  : theme.surface,
                borderColor: theme.accent,
              },
            ]}
          >
            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800', marginBottom: 8 }}>
              {flipped ? 'VERSO (RESPOSTA)' : 'FRENTE (PERGUNTA)'} • {safeIdx + 1}/{cards.length}
            </Text>
            <Text
              style={{
                color: theme.text,
                fontSize: 18,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {flipped ? activeCard.back : activeCard.front}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 11, marginTop: 14 }}>
              Toque no cartão para virar ↻
            </Text>
          </TouchableOpacity>

          <View style={styles.rowGap}>
            <TouchableOpacity
              onPress={() => {
                setFlipped(false);
                setIdx((i) => (i - 1 + cards.length) % cards.length);
              }}
              style={[styles.pillBtn, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text, fontWeight: '700' }}>← Anterior</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setFlipped(false);
                setIdx((i) => (i + 1) % cards.length);
              }}
              style={[styles.pillBtn, { flex: 1, backgroundColor: theme.accent, borderColor: theme.accent }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Próximo →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={{ color: theme.text, fontWeight: '800', marginBottom: 8 }}>
          + Novo Flashcard
        </Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
          value={front}
          onChangeText={setFront}
          placeholder="Frente (Pergunta ou Conceito)..."
          placeholderTextColor={theme.textDim}
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
          value={back}
          onChangeText={setBack}
          placeholder="Verso (Resposta)..."
          placeholderTextColor={theme.textDim}
          multiline
        />
        <TouchableOpacity
          onPress={addCard}
          style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.primaryBtnText}>Salvar Cartão</Text>
        </TouchableOpacity>
      </View>

      {cards.map((c, cIdx) => (
        <View
          key={c.id}
          style={[
            styles.card,
            styles.rowBetween,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => {
              setIdx(cIdx);
              setFlipped(false);
            }}
          >
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>
              {c.front}
            </Text>
            <Text style={{ color: theme.textDim, fontSize: 12 }} numberOfLines={1}>
              {c.back}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => saveCards(cards.filter((x) => x.id !== c.id))}
          >
            <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// 6. PLANILHA DE ORÇAMENTO
interface BudgetEntry {
  id: string;
  label: string;
  amount: number;
  kind: 'in' | 'out';
}

function BudgetTool({ theme }: { theme: EditorTheme }) {
  const [entries, setEntries] = useState<BudgetEntry[]>(() => {
    try {
      const raw = getAppMeta('prod_budget');
      return raw ? (JSON.parse(raw) as BudgetEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [label, setLabel] = useState('');
  const [amountText, setAmountText] = useState('');
  const [kind, setKind] = useState<'in' | 'out'>('out');

  const saveEntries = (next: BudgetEntry[]) => {
    setEntries(next);
    setAppMeta('prod_budget', JSON.stringify(next));
  };

  const addEntry = () => {
    const val = Number(amountText.replace(',', '.').replace(/[^0-9.]/g, ''));
    if (!label.trim() || !val || val <= 0) {
      Alert.alert('Dados inválidos', 'Informe descrição e um valor maior que zero.');
      return;
    }
    saveEntries([
      { id: `bg-${Date.now()}`, label: label.trim(), amount: val, kind },
      ...entries,
    ]);
    setLabel('');
    setAmountText('');
  };

  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const e of entries) {
      if (e.kind === 'in') totalIn += e.amount;
      else totalOut += e.amount;
    }
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [entries]);

  return (
    <View style={{ gap: 12 }}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border, gap: 8 },
        ]}
      >
        <View style={styles.rowBetween}>
          <View>
            <Text style={{ color: theme.textDim, fontSize: 11 }}>Entradas</Text>
            <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '800' }}>
              R$ {totals.totalIn.toFixed(2)}
            </Text>
          </View>
          <View>
            <Text style={{ color: theme.textDim, fontSize: 11 }}>Saídas</Text>
            <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '800' }}>
              R$ {totals.totalOut.toFixed(2)}
            </Text>
          </View>
          <View>
            <Text style={{ color: theme.textDim, fontSize: 11 }}>Saldo</Text>
            <Text
              style={{
                color: totals.balance >= 0 ? '#38BDF8' : '#EF4444',
                fontSize: 16,
                fontWeight: '800',
              }}
            >
              R$ {totals.balance.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={[styles.rowGap, { marginBottom: 8 }]}>
          <TouchableOpacity
            onPress={() => setKind('in')}
            style={[
              styles.pillBtn,
              {
                flex: 1,
                backgroundColor: kind === 'in' ? '#10B981' : theme.bg,
                borderColor: kind === 'in' ? '#10B981' : theme.border,
              },
            ]}
          >
            <Text style={{ color: kind === 'in' ? '#FFF' : theme.textMuted, fontWeight: '700' }}>
              + Entrada
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setKind('out')}
            style={[
              styles.pillBtn,
              {
                flex: 1,
                backgroundColor: kind === 'out' ? '#EF4444' : theme.bg,
                borderColor: kind === 'out' ? '#EF4444' : theme.border,
              },
            ]}
          >
            <Text style={{ color: kind === 'out' ? '#FFF' : theme.textMuted, fontWeight: '700' }}>
              − Saída
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
          value={label}
          onChangeText={setLabel}
          placeholder="Descrição (ex: Salário, Mercado)..."
          placeholderTextColor={theme.textDim}
        />
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
          ]}
          value={amountText}
          onChangeText={setAmountText}
          placeholder="Valor (ex: 150.00)"
          placeholderTextColor={theme.textDim}
          keyboardType="numeric"
        />
        <TouchableOpacity
          onPress={addEntry}
          style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
        >
          <Text style={styles.primaryBtnText}>Lançar</Text>
        </TouchableOpacity>
      </View>

      {entries.map((e) => (
        <View
          key={e.id}
          style={[
            styles.card,
            styles.rowBetween,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }}>
              {e.label}
            </Text>
            <Text
              style={{
                color: e.kind === 'in' ? '#10B981' : '#EF4444',
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {e.kind === 'in' ? '+' : '−'} R$ {e.amount.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => saveEntries(entries.filter((x) => x.id !== e.id))}
          >
            <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// 7. NUVEM DE PALAVRAS
const STOP_WORDS = new Set([
  'para', 'como', 'mais', 'aqui', 'seus', 'suas', 'sobre', 'entre', 'com',
  'que', 'uma', 'das', 'dos', 'por', 'isso', 'essa', 'esse', 'esta', 'este',
  'onde', 'quando', 'voce', 'você', 'tudo', 'cada', 'pelo', 'pela', 'nota',
]);

function WordCloudTool({
  nodes,
  theme,
}: {
  nodes: NexusNode[];
  theme: EditorTheme;
}) {
  const words = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) {
      const full = `${n.title} ${extractPlainTextFromContent(n.content)}`;
      const tokens = full.toLowerCase().match(/#?[a-zA-ZÀ-ÿ0-9_]{4,}/g) || [];
      for (const t of tokens) {
        if (STOP_WORDS.has(t)) continue;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 32);
  }, [nodes]);

  const maxCount = words[0]?.[1] ?? 1;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Text style={{ color: theme.textDim, fontSize: 11, fontWeight: '700', marginBottom: 12 }}>
        TERMOS E #TAGS MAIS FREQUENTES NO NEXUS
      </Text>
      {words.length === 0 ? (
        <Text style={{ color: theme.textDim }}>Crie notas para gerar sua nuvem!</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {words.map(([word, count]) => {
            const size = 12 + Math.round((count / maxCount) * 12);
            const isTag = word.startsWith('#');
            return (
              <View
                key={word}
                style={{
                  backgroundColor: isTag ? '#2E1065' : theme.surfaceAlt,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: size,
                    fontWeight: '700',
                    color: isTag ? '#D8B4FE' : theme.text,
                  }}
                >
                  {word} ({count})
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// 8. KPIs & ESTATÍSTICAS
function StatsTool({
  nodes,
  courses,
  lessons,
  theme,
}: {
  nodes: NexusNode[];
  courses: CourseItem[];
  lessons: CourseLessonItem[];
  theme: EditorTheme;
}) {
  const stats = useMemo(() => {
    let totalTasks = 0;
    let doneTasks = 0;
    for (const n of nodes) {
      const blocks = parseContentToBlocks(n.content);
      for (const b of blocks) {
        if (b.type === 'todo') {
          totalTasks += 1;
          if (b.checked) doneTasks += 1;
        }
      }
    }
    const doneLessons = lessons.filter((l) => l.isCompleted).length;
    const pomodoros = Number(getAppMeta('prod_pomodoro_count') || 0) || 0;
    return { totalTasks, doneTasks, doneLessons, pomodoros };
  }, [nodes, lessons]);

  const metrics = [
    { label: 'Notas no Segundo Cérebro', value: String(nodes.length), color: '#6366F1' },
    { label: 'Tarefas Concluídas', value: `${stats.doneTasks}/${stats.totalTasks}`, color: '#10B981' },
    { label: 'Cursos Criados', value: String(courses.length), color: '#3B82F6' },
    { label: 'Aulas Concluídas', value: `${stats.doneLessons}/${lessons.length}`, color: '#8B5CF6' },
    { label: 'Sessões Pomodoro', value: `🍅 ${stats.pomodoros}`, color: '#EF4444' },
    { label: 'Notas Favoritas', value: `★ ${nodes.filter((n) => n.isFavorite).length}`, color: '#F59E0B' },
  ];

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {metrics.map((m) => (
        <View
          key={m.label}
          style={[
            styles.statTile,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={{ color: m.color, fontSize: 22, fontWeight: '800' }}>
            {m.value}
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 12, marginTop: 4 }}>
            {m.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// 9. ESTÚDIO DE FRAMEWORKS (SWOT, 5W2H, OKR, Ikigai, SMART, Gantt, Canvas, etc.)
function FrameworkStudioTool({
  tool,
  theme,
  onExportToSpaces,
}: {
  tool: ProductivityToolDef;
  theme: EditorTheme;
  onExportToSpaces: (title: string, serialized: string) => void;
}) {
  const storageKey = `prod_fw_${tool.id}`;
  const [values, setValues] = useState<Record<string, string>>(() => {
    try {
      const raw = getAppMeta(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const raw = getAppMeta(`prod_fw_${tool.id}`);
      setValues(raw ? (JSON.parse(raw) as Record<string, string>) : {});
    } catch {
      setValues({});
    }
  }, [tool.id]);

  const updateField = (key: string, text: string) => {
    const next = { ...values, [key]: text };
    setValues(next);
    setAppMeta(storageKey, JSON.stringify(next));
  };

  const exportFramework = () => {
    const sections = tool.sections ?? [];
    const blocks: EditorBlock[] = [
      createBlock('callout', `Ferramenta: ${tool.title} — ${tool.subtitle}`),
    ];
    for (const sec of sections) {
      blocks.push(createBlock('h2', sec.title));
      blocks.push(createBlock('paragraph', values[sec.key] || '(Em branco)'));
    }
    blocks.push(createBlock('paragraph', `#produtividade #${tool.id}`));
    onExportToSpaces(tool.title, serializeBlocks(blocks));
  };

  return (
    <View style={{ gap: 12 }}>
      <TouchableOpacity
        onPress={exportFramework}
        style={[
          styles.primaryBtn,
          { backgroundColor: theme.accent, marginBottom: 4 },
        ]}
      >
        <Text style={styles.primaryBtnText}>
          📄 Salvar {tool.title} nos Espaços do Nexus
        </Text>
      </TouchableOpacity>

      {(tool.sections ?? []).map((sec) => (
        <View
          key={sec.key}
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderLeftWidth: 4,
              borderLeftColor: sec.color,
            },
          ]}
        >
          <Text
            style={{
              color: sec.color,
              fontSize: 13,
              fontWeight: '800',
              marginBottom: 8,
            }}
          >
            {sec.title}
          </Text>
          <TextInput
            style={[
              styles.fwInput,
              {
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            value={values[sec.key] ?? ''}
            onChangeText={(txt) => updateField(sec.key, txt)}
            multiline
            textAlignVertical="top"
            placeholder={sec.hint}
            placeholderTextColor={theme.textDim}
          />
        </View>
      ))}
    </View>
  );
}

export default function ProductivityToolRunner({
  tool,
  nodes,
  courses,
  lessons,
  theme,
  onExportToSpaces,
}: ToolRunnerProps) {
  return (
    <ScrollView
      style={{ flex: 1, paddingHorizontal: 16, paddingTop: 14 }}
      keyboardShouldPersistTaps="handled"
    >
      {tool.kind === 'pomodoro' && <PomodoroTool theme={theme} />}
      {tool.kind === 'countdown' && <CountdownTool theme={theme} />}
      {tool.kind === 'wheel' && (
        <WheelOfLifeTool
          theme={theme}
          onExportToSpaces={onExportToSpaces}
        />
      )}
      {tool.kind === 'habits' && <HabitsTool theme={theme} />}
      {tool.kind === 'flashcards' && <FlashcardsTool theme={theme} />}
      {tool.kind === 'budget' && <BudgetTool theme={theme} />}
      {tool.kind === 'wordcloud' && (
        <WordCloudTool nodes={nodes} theme={theme} />
      )}
      {tool.kind === 'stats' && (
        <StatsTool
          nodes={nodes}
          courses={courses}
          lessons={lessons}
          theme={theme}
        />
      )}
      {tool.kind === 'framework' && (
        <FrameworkStudioTool
          tool={tool}
          theme={theme}
          onExportToSpaces={onExportToSpaces}
        />
      )}
      <View style={{ height: 36 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rowGap: {
    flexDirection: 'row',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  bigCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    marginBottom: 8,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    marginTop: 8,
    overflow: 'hidden',
  },
  flashcardBox: {
    borderWidth: 2,
    borderRadius: 18,
    padding: 26,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTile: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  fwInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 74,
    fontSize: 14,
    lineHeight: 20,
  },
});
