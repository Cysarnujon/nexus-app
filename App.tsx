import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

interface NexusNode {
  id: string;
  parentId: string | null;
  title: string;
  content: string;
  isExpanded: boolean;
  isFavorite?: boolean;
}

const INITIAL_NODES: NexusNode[] = [
  {
    id: '1',
    parentId: null,
    title: 'Estudos',
    content: 'Central de aprendizado contínuo.\n\nConectado com [[Teoria musical]] e [[Investimentos]].\n\n#estudos #foco',
    isExpanded: true,
    isFavorite: true,
  },
  {
    id: '2',
    parentId: null,
    title: 'Produção musical',
    content: 'Projetos de áudio, beats e mixagem.\n\n#musica #producao',
    isExpanded: true,
    isFavorite: true,
  },
  {
    id: '3',
    parentId: '2',
    title: 'FL Studio',
    content: '- Atalhos de Piano Roll\n- Cadeia de masterização\n- Aplicar conceitos de [[Teoria musical]] nos acordes.\n\n#daw #flstudio',
    isExpanded: false,
  },
  {
    id: '4',
    parentId: '2',
    title: 'Teoria musical',
    content: 'Escalas maiores, menores e campo harmônico.\n\nPraticar progressões II-V-I no [[FL Studio]].\n\n#teoria #harmonia',
    isExpanded: false,
  },
  {
    id: '5',
    parentId: '2',
    title: 'Videoaulas',
    content: 'Lista de aulas pendentes sobre sound design e compressão paralela.\n\n#aulas #estudos',
    isExpanded: false,
  },
  {
    id: '6',
    parentId: null,
    title: 'Investimentos',
    content: 'Reserva de emergência, renda fixa e metas de longo prazo.\n\n#financas #metas',
    isExpanded: false,
  },
];

function extractTags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_À-ÿ]+/g) || [];
  return Array.from(new Set(matches));
}

function extractLinks(text: string): string[] {
  const matches: string[] = [];
  const regex = /\[\[(.*?)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1].trim()) {
      matches.push(match[1].trim());
    }
  }
  return Array.from(new Set(matches));
}

function NexusAppContent() {
  const [nodes, setNodes] = useState<NexusNode[]>(INITIAL_NODES);
  const [activeTab, setActiveTab] = useState<'spaces' | 'search'>('spaces');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTopicModalVisible, setNewTopicModalVisible] = useState(false);
  const [newTopicParentId, setNewTopicParentId] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const toggleExpand = (id: string) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id ? { ...node, isExpanded: !node.isExpanded } : node
      )
    );
  };

  const openCreateModal = (parentId: string | null) => {
    setNewTopicParentId(parentId);
    setNewTopicTitle('');
    setNewTopicModalVisible(true);
  };

  const createTopic = () => {
    const trimmed = newTopicTitle.trim();
    if (!trimmed) return;

    const newNode: NexusNode = {
      id: Date.now().toString(),
      parentId: newTopicParentId,
      title: trimmed,
      content: 'Escreva suas ideias aqui...\n\nUse #tags ou [[Nome de outra nota]] para conectar.',
      isExpanded: true,
    };

    setNodes((prev) =>
      prev
        .map((n) => (n.id === newTopicParentId ? { ...n, isExpanded: true } : n))
        .concat(newNode)
    );
    setNewTopicModalVisible(false);
    setNewTopicTitle('');
  };

  const updateNodeField = (id: string, field: 'title' | 'content', value: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: value } : n))
    );
  };

  const toggleFavorite = (id: string) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isFavorite: !n.isFavorite } : n))
    );
  };

  const getBreadcrumbs = (node: NexusNode): NexusNode[] => {
    const trail: NexusNode[] = [];
    let current: NexusNode | undefined = node;
    while (current) {
      trail.unshift(current);
      current = nodes.find((n) => n.id === current?.parentId);
    }
    return trail;
  };

  const getBacklinks = (targetTitle: string, currentId: string): NexusNode[] => {
    const lowerTarget = targetTitle.toLowerCase();
    return nodes.filter((n) => {
      if (n.id === currentId) return false;
      const links = extractLinks(n.content).map((l) => l.toLowerCase());
      return links.includes(lowerTarget);
    });
  };

  const openLinkedNoteByTitle = (title: string) => {
    const found = nodes.find(
      (n) => n.title.toLowerCase() === title.toLowerCase()
    );
    if (found) {
      setSelectedNodeId(found.id);
    } else {
      const created: NexusNode = {
        id: Date.now().toString(),
        parentId: null,
        title,
        content: `Página criada automaticamente a partir de um link.\n\n#nova`,
        isExpanded: false,
      };
      setNodes((prev) => [...prev, created]);
      setSelectedNodeId(created.id);
    }
  };

  const renderTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const children = nodes.filter((n) => n.parentId === parentId);
    return children.map((node) => {
      const hasChildren = nodes.some((n) => n.parentId === node.id);
      const tags = extractTags(node.content);

      return (
        <View key={node.id}>
          <View style={[styles.treeRow, { paddingLeft: 12 + depth * 20 }]}>
            <TouchableOpacity
              onPress={() => toggleExpand(node.id)}
              style={styles.expandBtn}
            >
              <Text style={styles.expandIcon}>
                {hasChildren ? (node.isExpanded ? '▾' : '▸') : '•'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.treeTitleArea}
              onPress={() => setSelectedNodeId(node.id)}
            >
              <Text style={styles.treeTitle} numberOfLines={1}>
                {node.isFavorite ? '★ ' : ''}
                {node.title}
              </Text>
              {tags.length > 0 && (
                <Text style={styles.treeTagsPreview} numberOfLines={1}>
                  {tags.slice(0, 2).join(' ')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openCreateModal(node.id)}
              style={styles.addSubBtn}
            >
              <Text style={styles.addSubText}>+</Text>
            </TouchableOpacity>
          </View>

          {node.isExpanded && hasChildren && renderTree(node.id, depth + 1)}
        </View>
      );
    });
  };

  const filteredSearchNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [nodes, searchQuery]);

  // Tela de Página Completa (Estilo Notion + Obsidian)
  if (selectedNode) {
    const breadcrumbs = getBreadcrumbs(selectedNode);
    const subpages = nodes.filter((n) => n.parentId === selectedNode.id);
    const tags = extractTags(selectedNode.content);
    const links = extractLinks(selectedNode.content);
    const backlinks = getBacklinks(selectedNode.title, selectedNode.id);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.pageHeader}>
          <TouchableOpacity
            onPress={() => setSelectedNodeId(null)}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>← Início</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => toggleFavorite(selectedNode.id)}
            style={styles.favBtn}
          >
            <Text style={styles.favBtnText}>
              {selectedNode.isFavorite ? '★ Favorito' : '☆ Favoritar'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.pageScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.breadcrumbRow}>
            {breadcrumbs.map((crumb, idx) => (
              <View key={crumb.id} style={styles.breadcrumbItem}>
                {idx > 0 && <Text style={styles.breadcrumbSep}> › </Text>}
                <TouchableOpacity onPress={() => setSelectedNodeId(crumb.id)}>
                  <Text style={styles.breadcrumbText}>{crumb.title}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TextInput
            style={styles.pageTitleInput}
            value={selectedNode.title}
            onChangeText={(text) => updateNodeField(selectedNode.id, 'title', text)}
            placeholder="Título da página"
            placeholderTextColor="#64748B"
          />

          <TextInput
            style={styles.pageContentInput}
            value={selectedNode.content}
            onChangeText={(text) => updateNodeField(selectedNode.id, 'content', text)}
            multiline
            textAlignVertical="top"
            placeholder="Comece a escrever... Use #tags ou [[Links]]"
            placeholderTextColor="#64748B"
          />

          {/* Subpáginas */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Subtópicos ({subpages.length})</Text>
              <TouchableOpacity onPress={() => openCreateModal(selectedNode.id)}>
                <Text style={styles.sectionAction}>+ Novo subtópico</Text>
              </TouchableOpacity>
            </View>
            {subpages.length === 0 ? (
              <Text style={styles.emptyHint}>Nenhum subtópico ainda.</Text>
            ) : (
              subpages.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.subpageCard}
                  onPress={() => setSelectedNodeId(sub.id)}
                >
                  <Text style={styles.subpageTitle}>📄 {sub.title}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Tags & Links */}
          {(tags.length > 0 || links.length > 0) && (
            <View style={styles.sectionBox}>
              <Text style={styles.sectionLabel}>Conexões e Tags</Text>
              <View style={styles.chipsWrap}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{tag}</Text>
                  </View>
                ))}
                {links.map((link) => (
                  <TouchableOpacity
                    key={link}
                    style={styles.linkChip}
                    onPress={() => openLinkedNoteByTitle(link)}
                  >
                    <Text style={styles.linkChipText}>[[{link}]]</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Backlinks */}
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>
              Backlinks ({backlinks.length})
            </Text>
            {backlinks.length === 0 ? (
              <Text style={styles.emptyHint}>
                Nenhuma outra nota cita [[{selectedNode.title}]] ainda.
              </Text>
            ) : (
              backlinks.map((bl) => (
                <TouchableOpacity
                  key={bl.id}
                  style={styles.subpageCard}
                  onPress={() => setSelectedNodeId(bl.id)}
                >
                  <Text style={styles.subpageTitle}>🔗 {bl.title}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>NEXUS</Text>
          <Text style={styles.subtitle}>Segundo Cérebro • v0.1</Text>
        </View>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => openCreateModal(null)}
        >
          <Text style={styles.primaryBtnText}>+ Espaço</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'spaces' ? (
        <ScrollView style={styles.scrollArea}>
          <Text style={styles.sectionHeading}>MEUS ESPAÇOS E TÓPICOS</Text>
          <View style={styles.treeCard}>{renderTree(null, 0)}</View>
          <Text style={styles.tipText}>
            Dica: Toque na seta (▸) para expandir, no texto para abrir como página ou no (+) para criar subtópicos.
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.scrollArea}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar notas, #tags ou conteúdo..."
            placeholderTextColor="#64748B"
            autoFocus
          />
          <ScrollView>
            {filteredSearchNodes.map((node) => (
              <TouchableOpacity
                key={node.id}
                style={styles.searchResultCard}
                onPress={() => setSelectedNodeId(node.id)}
              >
                <Text style={styles.searchResultTitle}>{node.title}</Text>
                <Text style={styles.searchResultSnippet} numberOfLines={2}>
                  {node.content}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Barra Inferior */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => setActiveTab('spaces')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'spaces' && styles.tabTextActive,
            ]}
          >
            ☰ Espaços
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => setActiveTab('search')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'search' && styles.tabTextActive,
            ]}
          >
            ⌕ Busca Global
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal Novo Tópico */}
      <Modal
        visible={newTopicModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewTopicModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {newTopicParentId ? 'Novo Subtópico' : 'Novo Espaço'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newTopicTitle}
              onChangeText={setNewTopicTitle}
              placeholder="Digite o nome..."
              placeholderTextColor="#64748B"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setNewTopicModalVisible(false)}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={createTopic} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NexusAppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
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
  treeCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 6,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E293B',
  },
  expandBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandIcon: {
    color: '#94A3B8',
    fontSize: 15,
  },
  treeTitleArea: {
    flex: 1,
    paddingHorizontal: 4,
  },
  treeTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '600',
  },
  treeTagsPreview: {
    color: '#A855F7',
    fontSize: 11,
    marginTop: 2,
  },
  addSubBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSubText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  tipText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 14,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#818CF8',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '600',
  },
  favBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  favBtnText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },
  pageScroll: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbSep: {
    color: '#475569',
    fontSize: 12,
  },
  breadcrumbText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  pageTitleInput: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 14,
  },
  pageContentInput: {
    minHeight: 170,
    fontSize: 15,
    lineHeight: 23,
    color: '#CBD5E1',
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    marginBottom: 18,
  },
  sectionBox: {
    marginBottom: 20,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionAction: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyHint: {
    color: '#64748B',
    fontSize: 13,
  },
  subpageCard: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginTop: 6,
  },
  subpageTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: '#2E1065',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagChipText: {
    color: '#D8B4FE',
    fontSize: 12,
    fontWeight: '600',
  },
  linkChip: {
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  linkChipText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 14,
  },
  searchResultCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  searchResultTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  searchResultSnippet: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 18,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#0B0F17',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 15,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalConfirm: {
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
