import React, { useMemo, useState } from 'react';
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

type RoutineTab = 'today' | 'month' | 'habits' | 'daily_tasks';

interface TimelineEvent {
  id: string;
  time: string;
  title: string;
}

interface MonthAgendaEvent {
  id: string;
  dateIso: string;
  title: string;
}

interface HabitItem {
  id: string;
  title: string;
  streak: number;
  lastCheckedDate: string;
}

interface DailyTaskItem {
  id: string;
  title: string;
  done: boolean;
}

interface RoutineViewProps {
  theme: EditorTheme;
  onOpenDrawer: () => void;
  onBackHome: () => void;
}

const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RoutineView({
  theme,
  onOpenDrawer,
  onBackHome,
}: RoutineViewProps) {
  const [activeTab, setActiveTab] = useState<RoutineTab>('today');
  const todayIso = getTodayIso();

  // 1. Hoje (Linha do tempo)
  const [timeline, setTimeline] = useState<TimelineEvent[]>(() => {
    try {
      const raw = getAppMeta('routine_timeline');
      return raw
        ? (JSON.parse(raw) as TimelineEvent[])
        : [{ id: 'tl-1', time: '09:00', title: 'Planejar o dia' }];
    } catch {
      return [];
    }
  });
  const [tlModalVisible, setTlModalVisible] = useState(false);
  const [tlTime, setTlTime] = useState('16:00');
  const [tlTitle, setTlTitle] = useState('');

  // 2. Mês (Calendário)
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [monthEvents, setMonthEvents] = useState<MonthAgendaEvent[]>(() => {
    try {
      const raw = getAppMeta('routine_month_events');
      return raw ? (JSON.parse(raw) as MonthAgendaEvent[]) : [];
    } catch {
      return [];
    }
  });
  const [monthModalVisible, setMonthModalVisible] = useState(false);
  const [monthEventTitle, setMonthEventTitle] = useState('');

  // 3. Hábitos (sincronizado com prod_habits)
  const [habits, setHabits] = useState<HabitItem[]>(() => {
    try {
      const raw = getAppMeta('prod_habits');
      return raw ? (JSON.parse(raw) as HabitItem[]) : [];
    } catch {
      return [];
    }
  });
  const [habitModalVisible, setHabitModalVisible] = useState(false);
  const [habitInput, setHabitInput] = useState('');

  // 4. Tarefas Diárias
  const [dailyTasks, setDailyTasks] = useState<DailyTaskItem[]>(() => {
    try {
      const raw = getAppMeta('routine_daily_tasks');
      return raw ? (JSON.parse(raw) as DailyTaskItem[]) : [];
    } catch {
      return [];
    }
  });
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskInput, setTaskInput] = useState('');

  const saveTimeline = (next: TimelineEvent[]) => {
    const sorted = [...next].sort((a, b) => a.time.localeCompare(b.time));
    setTimeline(sorted);
    setAppMeta('routine_timeline', JSON.stringify(sorted));
  };

  const selectedDateIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

  const calendarCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calYear, calMonth]);

  const dayEvents = useMemo(
    () => monthEvents.filter((e) => e.dateIso === selectedDateIso),
    [monthEvents, selectedDateIso]
  );

  const changeMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedDay(1);
  };

  const saveMonthEvents = (next: MonthAgendaEvent[]) => {
    setMonthEvents(next);
    setAppMeta('routine_month_events', JSON.stringify(next));
  };

  const saveHabits = (next: HabitItem[]) => {
    setHabits(next);
    setAppMeta('prod_habits', JSON.stringify(next));
  };

  const saveDailyTasks = (next: DailyTaskItem[]) => {
    setDailyTasks(next);
    setAppMeta('routine_daily_tasks', JSON.stringify(next));
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
          Minha Rotina
        </Text>
        <TouchableOpacity onPress={onBackHome} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
            Início
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4 Abas */}
      <View
        style={[
          styles.tabsBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        {(
          [
            { k: 'today', l: 'Hoje' },
            { k: 'month', l: 'Mês' },
            { k: 'habits', l: 'Hábitos' },
            { k: 'daily_tasks', l: 'Tarefas Diárias' },
          ] as { k: RoutineTab; l: string }[]
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
                  fontSize: 12,
                  fontWeight: active ? '800' : '600',
                }}
                numberOfLines={1}
              >
                {t.l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled">
        {/* ABA 1: HOJE (LINHA DO TEMPO) */}
        {activeTab === 'today' && (
          <View>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>
              Minha Linha do Tempo
            </Text>

            {timeline.length === 0 ? (
              <Text style={{ color: theme.textDim, textAlign: 'center', marginTop: 40 }}>
                Nenhum evento na linha do tempo hoje. Toque em "+ Adicionar Evento".
              </Text>
            ) : (
              timeline.map((ev, idx) => (
                <View key={ev.id} style={styles.tlRow}>
                  <View style={styles.tlRail}>
                    <View style={[styles.tlDot, { backgroundColor: theme.accent }]} />
                    {idx < timeline.length - 1 && (
                      <View style={[styles.tlLine, { backgroundColor: theme.border }]} />
                    )}
                  </View>
                  <View
                    style={[
                      styles.tlCard,
                      styles.rowBetween,
                      { backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>
                        {ev.time}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <Text style={{ fontSize: 16 }}>📅</Text>
                        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', flex: 1 }}>
                          {ev.title}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        saveTimeline(timeline.filter((x) => x.id !== ev.id))
                      }
                      style={{ padding: 6 }}
                    >
                      <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            <View style={{ height: 90 }} />
          </View>
        )}

        {/* ABA 2: MÊS (CALENDÁRIO + AGENDA) */}
        {activeTab === 'month' && (
          <View style={{ gap: 14 }}>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800', marginBottom: 10 }}>
                Mês
              </Text>
              <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                <TouchableOpacity onPress={() => changeMonth(-1)} style={{ padding: 6 }}>
                  <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
                    ‹
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                  {MONTHS_PT[calMonth]} {calYear}
                </Text>
                <TouchableOpacity onPress={() => changeMonth(1)} style={{ padding: 6 }}>
                  <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
                    ›
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weekHeaderRow}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                  <Text key={d} style={[styles.weekCellText, { color: theme.textDim }]}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {calendarCells.map((dayNum, i) => {
                  if (!dayNum) {
                    return <View key={`empty-${i}`} style={styles.dayCell} />;
                  }
                  const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const hasEv = monthEvents.some((e) => e.dateIso === iso);
                  const isSel = dayNum === selectedDay;

                  return (
                    <TouchableOpacity
                      key={`d-${dayNum}`}
                      onPress={() => setSelectedDay(dayNum)}
                      style={styles.dayCell}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          isSel && { backgroundColor: theme.accent },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSel ? '#FFF' : theme.text,
                            fontWeight: isSel ? '800' : '600',
                            fontSize: 14,
                          }}
                        >
                          {dayNum}
                        </Text>
                      </View>
                      {hasEv && (
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: isSel ? '#FFF' : theme.accent,
                            marginTop: 2,
                          }}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.rowBetween, { marginBottom: 12 }]}>
                <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>
                  Agenda do Dia {selectedDay}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setMonthEventTitle('');
                    setMonthModalVisible(true);
                  }}
                >
                  <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '700' }}>
                    + Novo
                  </Text>
                </TouchableOpacity>
              </View>

              {dayEvents.length === 0 ? (
                <Text style={{ color: theme.textDim, fontSize: 14 }}>
                  Nenhum lembrete neste dia. Toque em + Novo.
                </Text>
              ) : (
                dayEvents.map((ev) => (
                  <View
                    key={ev.id}
                    style={[
                      styles.itemRow,
                      { backgroundColor: theme.bg, borderColor: theme.border },
                    ]}
                  >
                    <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600', flex: 1 }}>
                      📌 {ev.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        saveMonthEvents(monthEvents.filter((x) => x.id !== ev.id))
                      }
                    >
                      <Text style={{ color: '#F87171', fontSize: 13 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ABA 3: HÁBITOS */}
        {activeTab === 'habits' && (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border, minHeight: 360 },
            ]}
          >
            <View style={[styles.rowBetween, { marginBottom: 14 }]}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
                Meus Hábitos
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setHabitInput('');
                  setHabitModalVisible(true);
                }}
              >
                <Text style={{ color: theme.accent, fontSize: 22, fontWeight: '800' }}>
                  ⊕
                </Text>
              </TouchableOpacity>
            </View>

            {habits.length === 0 ? (
              <Text style={{ color: theme.textDim, textAlign: 'center', marginTop: 80 }}>
                Nenhum hábito ainda. Toque em ⊕ para criar.
              </Text>
            ) : (
              habits.map((h) => {
                const doneToday = h.lastCheckedDate === todayIso;
                return (
                  <View
                    key={h.id}
                    style={[
                      styles.itemRow,
                      { backgroundColor: theme.bg, borderColor: theme.border },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        const next = habits.map((item) => {
                          if (item.id !== h.id) return item;
                          if (item.lastCheckedDate === todayIso) {
                            return {
                              ...item,
                              streak: Math.max(0, item.streak - 1),
                              lastCheckedDate: '',
                            };
                          }
                          return {
                            ...item,
                            streak: item.streak + 1,
                            lastCheckedDate: todayIso,
                          };
                        });
                        saveHabits(next);
                      }}
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
        )}

        {/* ABA 4: TAREFAS DIÁRIAS */}
        {activeTab === 'daily_tasks' && (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border, minHeight: 360 },
            ]}
          >
            <View style={[styles.rowBetween, { marginBottom: 14 }]}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
                Tarefas Diárias
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {dailyTasks.some((t) => t.done) && (
                  <TouchableOpacity
                    onPress={() =>
                      saveDailyTasks(dailyTasks.map((t) => ({ ...t, done: false })))
                    }
                  >
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
                      ↻ Resetar
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setTaskInput('');
                    setTaskModalVisible(true);
                  }}
                >
                  <Text style={{ color: theme.accent, fontSize: 22, fontWeight: '800' }}>
                    ⊕
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {dailyTasks.length === 0 ? (
              <Text style={{ color: theme.textDim, textAlign: 'center', marginTop: 80 }}>
                Nenhuma tarefa ainda. Toque em ⊕ para criar.
              </Text>
            ) : (
              dailyTasks.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.itemRow,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() =>
                      saveDailyTasks(
                        dailyTasks.map((x) =>
                          x.id === t.id ? { ...x, done: !x.done } : x
                        )
                      )
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                  >
                    <Text style={{ fontSize: 20, color: t.done ? '#10B981' : theme.textDim }}>
                      {t.done ? '☑' : '☐'}
                    </Text>
                    <Text
                      style={{
                        color: t.done ? theme.textDim : theme.text,
                        fontSize: 15,
                        fontWeight: '600',
                        textDecorationLine: t.done ? 'line-through' : 'none',
                      }}
                    >
                      {t.title}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      saveDailyTasks(dailyTasks.filter((x) => x.id !== t.id))
                    }
                  >
                    <Text style={{ color: '#F87171', fontSize: 14 }}>🗑</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {activeTab === 'today' && (
        <TouchableOpacity
          onPress={() => {
            setTlTime('16:00');
            setTlTitle('');
            setTlModalVisible(true);
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
            +   Adicionar Evento
          </Text>
        </TouchableOpacity>
      )}

      {/* Modal Adicionar Evento Hoje */}
      <Modal
        visible={tlModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTlModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Adicionar Evento na Linha do Tempo
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={tlTime}
              onChangeText={setTlTime}
              placeholder="Horário (ex: 16:00)"
              placeholderTextColor={theme.textDim}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={tlTitle}
              onChangeText={setTlTitle}
              placeholder="Descrição do evento..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setTlModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!tlTitle.trim()) return;
                  saveTimeline([
                    ...timeline,
                    { id: `tl-${Date.now()}`, time: tlTime.trim() || '12:00', title: tlTitle.trim() },
                  ]);
                  setTlModalVisible(false);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Lembrete do Mês */}
      <Modal
        visible={monthModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Lembrete — Dia {selectedDay}/{calMonth + 1}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={monthEventTitle}
              onChangeText={setMonthEventTitle}
              placeholder="Compromisso ou meta..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setMonthModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!monthEventTitle.trim()) return;
                  saveMonthEvents([
                    ...monthEvents,
                    { id: `me-${Date.now()}`, dateIso: selectedDateIso, title: monthEventTitle.trim() },
                  ]);
                  setMonthModalVisible(false);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Novo Hábito */}
      <Modal
        visible={habitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHabitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Novo Hábito
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={habitInput}
              onChangeText={setHabitInput}
              placeholder="Ex: Ler 15 minutos, Beber água..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setHabitModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!habitInput.trim()) return;
                  saveHabits([
                    ...habits,
                    { id: `hab-${Date.now()}`, title: habitInput.trim(), streak: 0, lastCheckedDate: '' },
                  ]);
                  setHabitModalVisible(false);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Nova Tarefa Diária */}
      <Modal
        visible={taskModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Nova Tarefa Diária
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={taskInput}
              onChangeText={setTaskInput}
              placeholder="Ex: Revisar agenda, Responder e-mails..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setTaskModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!taskInput.trim()) return;
                  saveDailyTasks([
                    ...dailyTasks,
                    { id: `dt-${Date.now()}`, title: taskInput.trim(), done: false },
                  ]);
                  setTaskModalVisible(false);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Criar</Text>
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
    paddingHorizontal: 4,
  },
  bodyScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tlRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tlRail: {
    width: 18,
    alignItems: 'center',
  },
  tlDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    marginTop: 18,
  },
  tlLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  tlCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekCellText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 8,
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
