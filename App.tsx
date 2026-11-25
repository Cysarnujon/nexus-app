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
import { StatusBar } from 'expo-status-bar';
import {
  NexusNode,
  deleteNodesByIds,
  getAllNodes,
  initDatabase,
  insertNode,
  setAllNodesExpanded,
  setNodeExpanded,
  setNodeFavorite,
  swapSiblingOrder,
  updateNodeContent,
  updateNodeParent,
} from './src/database/db';
import BlockEditor from './src/components/BlockEditor';
import { extractPlainTextFromContent } from './src/editor/blocks';

type MainTab = 'spaces' | 'favorites' | 'search';

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
    if (match[1].trim()) {
      matches.push(match[1].trim());
    }
  }
  return Array.from(new Set(matches));
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getDescendantIds(allNodes: NexusNode[], rootId: string): string[] {
  const result: string[] = [];
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const n of allNodes) {
      if (n.parentId === current) {
        queue.push(n.id);
      }
    }
  }
  return result;
}

export default function App() {
  const [nodes, setNodes] = useState<NexusNode[]>([]);
  const [activeTab, setActiveTab] = useState<MainTab>('spaces');
  const [pageHistory, setPageHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [newTopicModalVisible, setNewTopicModalVisible] = useState(false);
  const [newTopicParentId, setNewTopicParentId] = useState<string | null>(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');

  const [menuNodeId, setMenuNodeId] = useState<string | null>(null);
  const [moveNodeId, setMoveNodeId] = useState<string | null>(null);

  useEffect(() => {
    try {
      initDatabase();
      setNodes(getAllNodes());
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
      if (pageHistory.length > 0) {
        setPageHistory((prev) => prev.slice(0, -1));
        return true;
      }
      if (activeTab !== 'spaces') {
        setActiveTab('spaces');
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, [moveNodeId, menuNodeId, newTopicModalVisible, pageHistory, activeTab]);

  const openPage = (id: string) => {
    setPageHistory((prev) => {
      if (prev[prev.length - 1] === id) return prev;
      return [...prev, id];
    });
  };

  const goBackPage = () => {
    setPageHistory((prev) => prev.slice(0, -1));
  };

  const goHome = () => {
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
    setNewTopicModalVisible(true);
  };

  const createTopic = () => {
    const trimmed = newTopicTitle.trim();
    if (!trimmed) return;

    const created = insertNode({
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      parentId: newTopicParentId,
      title: trimmed,
      content:
        'Escreva suas ideias aqui...\n- [ ] Primeira tarefa\n#nova',
      isExpanded: true,
      isFavorite: false,
    });

    if (newTopicParentId) {
      setNodeExpanded(newTopicParentId, true);
    }

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
    if (targetParentId) {
      setNodeExpanded(targetParentId, true);
    }
    setNodes((prev) =>
      prev
        .map((n) => {
          if (n.id === moveNode.id) {
            return { ...n, parentId: targetParentId, sortOrder: newOrder };
          }
          if (n.id === targetParentId) {
            return { ...n, isExpanded: true };
          }
          return n;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder)
    );
    setMoveNodeId(null);
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

  const renderTree = (parentId: string | null = null, depth = 0): React.ReactNode => {
    const children = nodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return children.map((node) => {
      const hasChildren = nodes.some((n) => n.parentId === node.id);
      const tags = extractTags(node.content);

      return (
        <View key={node.id}>
          <View style={[styles.treeRow, { paddingLeft: 10 + depth * 18 }]}>
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
              onPress={() => openPage(node.id)}
            >
              <Text style={styles.treeTitle} numberOfLines={1}>
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
              style={styles.iconActionBtn}
            >
              <Text style={styles.iconActionText}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMenuNodeId(node.id)}
              style={styles.iconActionBtn}
            >
              <Text style={styles.iconActionText}>⋯</Text>
            </TouchableOpacity>
          </View>

          {node.isExpanded && hasChildren && renderTree(node.id, depth + 1)}
        </View>
      );
    });
  };

  const favoriteNodes = useMemo(
    () => nodes.filter((n) => n.isFavorite),
    [nodes]
  );

  const filteredSearchNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter((n) => {
      const plain = extractPlainTextFromContent(n.content).toLowerCase();
      return n.title.toLowerCase().includes(q) || plain.includes(q);
    });
  }, [nodes, searchQuery]);

  const invalidMoveTargets = useMemo(() => {
    if (!moveNode) return new Set<string>();
    return new Set(getDescendantIds(nodes, moveNode.id));
  }, [nodes, moveNode]);

  function renderModals() {
    return (
      <>
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
                <TouchableOpacity
                  onPress={createTopic}
                  style={styles.modalConfirm}
                >
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
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {menuNode?.title}
              </Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (!menuNode) return;
                  const id = menuNode.id;
                  setMenuNodeId(null);
                  openPage(id);
                }}
              >
                <Text style={styles.menuItemText}>📄 Abrir como página</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (!menuNode) return;
                  const id = menuNode.id;
                  setMenuNodeId(null);
                  openCreateModal(id);
                }}
              >
                <Text style={styles.menuItemText}>➕ Criar subtópico dentro</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (!menuNode) return;
                  toggleFavorite(menuNode.id);
                  setMenuNodeId(null);
                }}
              >
                <Text style={styles.menuItemText}>
                  {menuNode?.isFavorite
                    ? '☆ Remover dos favoritos'
                    : '★ Adicionar aos favoritos'}
                </Text>
              </TouchableOpacity>

              <View style={styles.menuRowSplit}>
                <TouchableOpacity
                  style={styles.menuHalfBtn}
                  onPress={() => {
                    if (menuNode) moveSibling(menuNode.id, 'up');
                  }}
                >
                  <Text style={styles.menuItemText}>↑ Subir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuHalfBtn}
                  onPress={() => {
                    if (menuNode) moveSibling(menuNode.id, 'down');
                  }}
                >
                  <Text style={styles.menuItemText}>↓ Descer</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  if (!menuNode) return;
                  const id = menuNode.id;
                  setMenuNodeId(null);
                  setMoveNodeId(id);
                }}
              >
                <Text style={styles.menuItemText}>📁 Mover para outro local</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, styles.menuDanger]}
                onPress={() => {
                  if (menuNode) confirmDeleteNode(menuNode);
                }}
              >
                <Text style={styles.menuDangerText}>🗑 Excluir tópico</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuCloseBtn}
                onPress={() => setMenuNodeId(null)}
              >
                <Text style={styles.modalCancelText}>Fechar</Text>
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
            <View style={[styles.modalBox, { maxHeight: '75%' }]}>
              <Text style={styles.modalTitle}>
                Mover "{moveNode?.title}" para:
              </Text>
              <ScrollView>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMoveToParent(null)}
                >
                  <Text style={styles.menuItemText}>🏠 Início (Raiz)</Text>
                </TouchableOpacity>

                {nodes
                  .filter((candidate) => !invalidMoveTargets.has(candidate.id))
                  .map((candidate) => (
                    <TouchableOpacity
                      key={candidate.id}
                      style={styles.menuItem}
                      onPress={() => handleMoveToParent(candidate.id)}
                    >
                      <Text style={styles.menuItemText} numberOfLines={1}>
                        📂 {candidate.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.menuCloseBtn}
                onPress={() => setMoveNodeId(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  if (selectedNode) {
    const breadcrumbs = getBreadcrumbs(selectedNode);
    const subpages = nodes
      .filter((n) => n.parentId === selectedNode.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const tags = extractTags(selectedNode.content);
    const links = extractLinks(selectedNode.content);
    const backlinks = getBacklinks(selectedNode.title, selectedNode.id);

    return (
      <View style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLeft}>
            <TouchableOpacity onPress={goBackPage} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Voltar</Text>
            </TouchableOpacity>
            {pageHistory.length > 1 && (
              <TouchableOpacity onPress={goHome} style={styles.homeChip}>
                <Text style={styles.homeChipText}>Início</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.pageHeaderRight}>
            <Text style={styles.savedBadge}>
              Salvo ✓ {formatTime(selectedNode.updatedAt)}
            </Text>
            <TouchableOpacity
              onPress={() => toggleFavorite(selectedNode.id)}
              style={styles.favBtn}
            >
              <Text style={styles.favBtnText}>
                {selectedNode.isFavorite ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuNodeId(selectedNode.id)}
              style={styles.favBtn}
            >
              <Text style={styles.menuDotsText}>⋯</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.pageScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.breadcrumbRow}>
            {breadcrumbs.map((crumb, idx) => (
              <View key={crumb.id} style={styles.breadcrumbItem}>
                {idx > 0 && <Text style={styles.breadcrumbSep}> › </Text>}
                <TouchableOpacity onPress={() => openPage(crumb.id)}>
                  <Text style={styles.breadcrumbText}>{crumb.title}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TextInput
            style={styles.pageTitleInput}
            value={selectedNode.title}
            onChangeText={(text) =>
              handleEditPage(selectedNode.id, text, selectedNode.content)
            }
            placeholder="Título da página"
            placeholderTextColor="#64748B"
          />

          <BlockEditor
            noteId={selectedNode.id}
            rawContent={selectedNode.content}
            onChangeSerialized={(serialized) =>
              handleEditPage(selectedNode.id, selectedNode.title, serialized)
            }
            onPressInternalLink={openLinkedNoteByTitle}
          />

          <View style={styles.sectionBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>
                Subtópicos ({subpages.length})
              </Text>
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
                  onPress={() => openPage(sub.id)}
                >
                  <Text style={styles.subpageTitle}>📄 {sub.title}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>

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

          <View style={[styles.sectionBox, { marginBottom: 32 }]}>
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
                  onPress={() => openPage(bl.id)}
                >
                  <Text style={styles.subpageTitle}>🔗 {bl.title}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {renderModals()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>NEXUS</Text>
          <Text style={styles.subtitle}>
            v0.3 • Editor de Blocos ({nodes.length} notas)
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={toggleExpandAll}
          >
            <Text style={styles.secondaryBtnText}>
              {anyExpanded ? '▸ Recolher' : '▾ Expandir'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => openCreateModal(null)}
          >
            <Text style={styles.primaryBtnText}>+ Espaço</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'spaces' && (
        <ScrollView style={styles.scrollArea}>
          <Text style={styles.sectionHeading}>MEUS ESPAÇOS E TÓPICOS</Text>
          {nodes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyHint}>
                Nenhum tópico criado ainda. Toque em "+ Espaço" para começar!
              </Text>
            </View>
          ) : (
            <View style={styles.treeCard}>{renderTree(null, 0)}</View>
          )}
          <Text style={styles.tipText}>
            Tudo salvo automaticamente no seu celular. Toque em qualquer tópico para abrir o Editor de Blocos.
          </Text>
        </ScrollView>
      )}

      {activeTab === 'favorites' && (
        <ScrollView style={styles.scrollArea}>
          <Text style={styles.sectionHeading}>PÁGINAS FAVORITAS</Text>
          {favoriteNodes.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyHint}>
                Você ainda não favoritou nenhuma nota. Toque na estrela ☆ dentro de uma página para fixá-la aqui.
              </Text>
            </View>
          ) : (
            favoriteNodes.map((node) => {
              const path = getBreadcrumbs(node)
                .map((b) => b.title)
                .join(' › ');
              return (
                <TouchableOpacity
                  key={node.id}
                  style={styles.searchResultCard}
                  onPress={() => openPage(node.id)}
                >
                  <Text style={styles.searchResultTitle}>★ {node.title}</Text>
                  <Text style={styles.favPathText} numberOfLines={1}>
                    {path}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {activeTab === 'search' && (
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
                onPress={() => openPage(node.id)}
              >
                <Text style={styles.searchResultTitle}>{node.title}</Text>
                <Text style={styles.searchResultSnippet} numberOfLines={2}>
                  {extractPlainTextFromContent(node.content)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

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
          onPress={() => setActiveTab('favorites')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'favorites' && styles.tabTextActive,
            ]}
          >
            ★ Favoritos
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
            ⌕ Busca
          </Text>
        </TouchableOpacity>
      </View>

      {renderModals()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17',
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 28) : 0,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  secondaryBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#CBD5E1',
    fontWeight: '600',
    fontSize: 12,
  },
  primaryBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
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
    paddingVertical: 4,
  },
  treeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 8,
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
  iconActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  iconActionText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '700',
  },
  tipText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 14,
    marginBottom: 24,
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  emptyBox: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 18,
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
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#818CF8',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  pageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 6,
  },
  backBtnText: {
    color: '#818CF8',
    fontSize: 15,
    fontWeight: '600',
  },
  homeChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  homeChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  savedBadge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 4,
  },
  favBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  favBtnText: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
  },
  menuDotsText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  pageScroll: {
    flex: 1,
    paddingHorizontal: 16,
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
    fontSize: 25,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 10,
  },
  sectionBox: {
    marginBottom: 16,
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
    lineHeight: 19,
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
  favPathText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 22,
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
  menuItem: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  menuItemText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  menuRowSplit: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  menuHalfBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  menuDanger: {
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  menuDangerText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '700',
  },
  menuCloseBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
});
