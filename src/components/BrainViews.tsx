import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAppMeta, NexusNode, setAppMeta } from '../database/db';
import {
  extractPlainTextFromContent,
  parseContentToBlocks,
} from '../editor/blocks';

interface TagsViewProps {
  nodes: NexusNode[];
  onOpenNode: (id: string) => void;
}

export function TagsView({ nodes, onOpenNode }: TagsViewProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const tagGroups = useMemo(() => {
    const map = new Map<string, { display: string; nodeIds: Set<string> }>();

    for (const node of nodes) {
      const plain = extractPlainTextFromContent(node.content);
      const matches = plain.match(/#[a-zA-Z0-9_À-ÿ]+/g) || [];
      for (const rawTag of matches) {
        const key = rawTag.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.nodeIds.add(node.id);
        } else {
          map.set(key, { display: rawTag, nodeIds: new Set([node.id]) });
        }
      }
    }

    return Array.from(map.entries())
      .map(([key, info]) => ({
        key,
        display: info.display,
        count: info.nodeIds.size,
        nodeIds: Array.from(info.nodeIds),
      }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [nodes]);

  const activeGroup = useMemo(() => {
    if (!selectedTag) return tagGroups[0] ?? null;
    return (
      tagGroups.find((g) => g.key === selectedTag) ?? tagGroups[0] ?? null
    );
  }, [tagGroups, selectedTag]);

  const taggedNodes = useMemo(() => {
    if (!activeGroup) return [];
    const idSet = new Set(activeGroup.nodeIds);
    return nodes.filter((n) => idSet.has(n.id));
  }, [nodes, activeGroup]);

  return (
    <ScrollView style={styles.scrollArea}>
      <Text style={styles.sectionHeading}>
        EXPLORADOR DE #TAGS ({tagGroups.length})
      </Text>

      {tagGroups.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            Nenhuma #tag encontrada ainda. Escreva algo como #estudos ou #ideias dentro de qualquer nota!
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.tagsWrap}>
            {tagGroups.map((group) => {
              const isSelected = activeGroup?.key === group.key;
              return (
                <TouchableOpacity
                  key={group.key}
                  style={[styles.tagChip, isSelected && styles.tagChipActive]}
                  onPress={() => setSelectedTag(group.key)}
                >
                  <Text
                    style={[
                      styles.tagChipText,
                      isSelected && styles.tagChipTextActive,
                    ]}
                  >
                    {group.display}
                  </Text>
                  <View style={styles.tagCountBadge}>
                    <Text style={styles.tagCountText}>{group.count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeGroup && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionHeading}>
                NOTAS COM {activeGroup.display.toUpperCase()}
              </Text>
              {taggedNodes.map((node) => (
                <TouchableOpacity
                  key={node.id}
                  style={styles.card}
                  onPress={() => onOpenNode(node.id)}
                >
                  <Text style={styles.cardTitle}>
                    {node.isFavorite ? '★ ' : '📄 '}
                    {node.title}
                  </Text>
                  <Text style={styles.cardSnippet} numberOfLines={2}>
                    {extractPlainTextFromContent(node.content)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

interface TasksViewProps {
  nodes: NexusNode[];
  onToggleTask: (nodeId: string, blockId: string) => void;
  onOpenNode: (id: string) => void;
}

interface RoutineTaskItem {
  id: string;
  title: string;
  done: boolean;
}

interface GlobalTaskItem {
  nodeId: string;
  nodeTitle: string;
  blockId: string;
  text: string;
  checked: boolean;
}

export function TasksView({
  nodes,
  onToggleTask,
  onOpenNode,
}: TasksViewProps) {
  const [filter, setFilter] = useState<'pending' | 'done' | 'all'>('pending');
  const [routineTasks, setRoutineTasks] = useState<RoutineTaskItem[]>(() => {
    try {
      const raw = getAppMeta('routine_daily_tasks');
      return raw ? (JSON.parse(raw) as RoutineTaskItem[]) : [];
    } catch {
      return [];
    }
  });

  const toggleRoutineTask = (id: string) => {
    setRoutineTasks((current) => {
      const next = current.map((task) => task.id === id ? { ...task, done: !task.done } : task);
      setAppMeta('routine_daily_tasks', JSON.stringify(next));
      return next;
    });
  };

  const allTasks = useMemo(() => {
    const items: GlobalTaskItem[] = [];
    for (const node of nodes) {
      const blocks = parseContentToBlocks(node.content);
      for (const b of blocks) {
        if (b.type === 'todo') {
          items.push({
            nodeId: node.id,
            nodeTitle: node.title,
            blockId: b.id,
            text: b.text || '(Tarefa sem texto)',
            checked: !!b.checked,
          });
        }
      }
    }
    return items;
  }, [nodes]);

  const doneCount = allTasks.filter((t) => t.checked).length + routineTasks.filter((t) => t.done).length;
  const totalCount = allTasks.length + routineTasks.length;
  const pendingCount = totalCount - doneCount;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const visibleTasks = useMemo(() => {
    if (filter === 'pending') return allTasks.filter((t) => !t.checked);
    if (filter === 'done') return allTasks.filter((t) => t.checked);
    return allTasks;
  }, [allTasks, filter]);
  const visibleRoutineTasks = routineTasks.filter((task) =>
    filter === 'all' || (filter === 'done' ? task.done : !task.done)
  );
  const hasVisibleTasks = visibleTasks.length + visibleRoutineTasks.length > 0;

  return (
    <ScrollView style={styles.scrollArea}>
      <Text style={styles.sectionHeading}>CENTRAL DE TAREFAS</Text>

      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>
            {doneCount} de {totalCount} concluídas
          </Text>
          <Text style={styles.progressPct}>{progressPct}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressPct}%` }]}
          />
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'pending' && styles.filterBtnActive]}
          onPress={() => setFilter('pending')}
        >
          <Text
            style={[
              styles.filterBtnText,
              filter === 'pending' && styles.filterBtnTextActive,
            ]}
          >
            Pendentes ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'done' && styles.filterBtnActive]}
          onPress={() => setFilter('done')}
        >
          <Text
            style={[
              styles.filterBtnText,
              filter === 'done' && styles.filterBtnTextActive,
            ]}
          >
            Concluídas ({doneCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text
            style={[
              styles.filterBtnText,
              filter === 'all' && styles.filterBtnTextActive,
            ]}
          >
            Todas ({totalCount})
          </Text>
        </TouchableOpacity>
      </View>

      {!hasVisibleTasks ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {totalCount === 0
              ? 'Nenhuma tarefa cadastrada. Crie checklists nas notas ou tarefas diárias na área Minha Rotina.'
              : 'Nenhuma tarefa nesta categoria!'}
          </Text>
        </View>
      ) : (
        visibleTasks.map((task) => (
          <View key={`${task.nodeId}-${task.blockId}`} style={styles.taskCard}>
            <TouchableOpacity
              onPress={() => onToggleTask(task.nodeId, task.blockId)}
              style={styles.checkboxHit}
            >
              <Text
                style={[
                  styles.checkboxIcon,
                  task.checked && styles.checkboxChecked,
                ]}
              >
                {task.checked ? '☑' : '☐'}
              </Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.taskText,
                  task.checked && styles.taskTextDone,
                ]}
              >
                {task.text}
              </Text>
              <TouchableOpacity onPress={() => onOpenNode(task.nodeId)}>
                <Text style={styles.taskOrigin}>📄 {task.nodeTitle} →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {visibleRoutineTasks.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionHeading}>📅 TAREFAS DIÁRIAS DA ROTINA ({routineTasks.length})</Text>
          {visibleRoutineTasks.map((task) => (
            <View key={`routine-${task.id}`} style={styles.taskCard}>
              <TouchableOpacity onPress={() => toggleRoutineTask(task.id)} style={styles.checkboxHit}>
                <Text style={[styles.checkboxIcon, task.done && styles.checkboxChecked]}>{task.done ? '☑' : '☐'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskText, task.done && styles.taskTextDone]}>{task.title}</Text>
                <Text style={styles.taskOrigin}>Minha Rotina · tarefa diária</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 18,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#312E81',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
  },
  tagChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#A855F7',
  },
  tagChipText: {
    color: '#D8B4FE',
    fontSize: 13,
    fontWeight: '600',
  },
  tagChipTextActive: {
    color: '#FFFFFF',
  },
  tagCountBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagCountText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSnippet: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  progressCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  progressPct: {
    color: '#34D399',
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterBtn: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  checkboxHit: {
    paddingTop: 1,
  },
  checkboxIcon: {
    fontSize: 20,
    color: '#94A3B8',
  },
  checkboxChecked: {
    color: '#34D399',
  },
  taskText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  taskTextDone: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  taskOrigin: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
