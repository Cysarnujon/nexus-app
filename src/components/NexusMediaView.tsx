import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getAppMeta, setAppMeta } from '../database/db';
import NexusWatchTracker from './NexusWatchTracker';
import NexusLiveTV from './NexusLiveTV';
import NexusUniversalSearch from './NexusUniversalSearch';

type MediaTheme = { bg: string; surface: string; surfaceAlt: string; text: string; textDim: string; border: string; accent: string };
type Props = { theme: MediaTheme; onBackHome: () => void };
type MediaItem = { id: string; title: string; category: string; description: string; url: string; createdAt: number };

const categories = [
  { icon: '🎬', title: 'Filmes', subtitle: 'Descubra filmes' },
  { icon: '📺', title: 'Séries', subtitle: 'Continue de onde parou' },
  { icon: '🍥', title: 'Animes', subtitle: 'Universos e temporadas' },
  { icon: '🎭', title: 'Novelas', subtitle: 'Histórias e capítulos' },
  { icon: '📡', title: 'TV ao vivo', subtitle: 'Canais e programação' },
  { icon: '🎵', title: 'Música', subtitle: 'Áudio e playlists' },
];
const readLibrary = (): MediaItem[] => {
  try { const raw = getAppMeta('nexus_media_library'); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};

export default function NexusMediaView({ theme, onBackHome }: Props) {
  const [section, setSection] = useState<'home' | 'search' | 'addons' | 'library' | 'journey' | 'live'>('home');
  const [query, setQuery] = useState('');
  const [library, setLibrary] = useState<MediaItem[]>(readLibrary);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Filmes');
  const [newDescription, setNewDescription] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const persist = (items: MediaItem[]) => { setLibrary(items); setAppMeta('nexus_media_library', JSON.stringify(items)); };
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    if (!q) return [];
    return library.filter(item => [item.title, item.category, item.description].join(' ').toLocaleLowerCase('pt-BR').includes(q));
  }, [query, library]);

  const addItem = () => {
    if (!newTitle.trim()) { Alert.alert('Título obrigatório', 'Digite o nome do filme, série ou mídia.'); return; }
    const item: MediaItem = { id: String(Date.now()), title: newTitle.trim(), category: newCategory, description: newDescription.trim(), url: newUrl.trim(), createdAt: Date.now() };
    persist([item, ...library]);
    setNewTitle(''); setNewDescription(''); setNewUrl('');
    Alert.alert('Adicionado', 'O item foi salvo na sua biblioteca do Nexus Media.');
  };
  const removeItem = (id: string) => Alert.alert('Remover item?', 'Este item será retirado da biblioteca local.', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => persist(library.filter(item => item.id !== id)) },
  ]);

  const nav = (key: typeof section, label: string, icon: string) => (
    <TouchableOpacity onPress={() => setSection(key)} style={[styles.navItem, { backgroundColor: section === key ? '#39265F' : theme.surfaceAlt }]}>
      <Text style={styles.navIcon}>{icon}</Text><Text style={[styles.navText, { color: section === key ? '#FFFFFF' : theme.textDim }]}>{label}</Text>
    </TouchableOpacity>
  );

  const itemCard = (item: MediaItem) => (
    <View key={item.id} style={styles.mediaCard}>
      <View style={styles.mediaIcon}><Text style={{ fontSize: 22 }}>{categories.find(c => c.title === item.category)?.icon || '🎞️'}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.connectionTitle}>{item.title}</Text>
        <Text style={styles.connectionSub}>{item.category}{item.description ? ' • ' + item.description : ''}</Text>
        {!!item.url && <Text style={styles.urlText} numberOfLines={1}>{item.url}</Text>}
      </View>
      <TouchableOpacity onPress={() => removeItem(item.id)}><Text style={styles.remove}>✕</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: '#0B0A12' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹  Nexus</Text></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.brand}>NEXUS <Text style={{ color: '#A78BFA' }}>MEDIA</Text></Text><Text style={styles.tagline}>SEU UNIVERSO DE ENTRETENIMENTO</Text></View>
        <Text style={styles.status}>●</Text>
      </View>
      <View style={styles.content}>
        {section === 'home' && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>BEM-VINDO AO SEU CENTRO MULTIMÍDIA</Text>
            <Text style={styles.heroTitle}>Tudo o que você gosta. Em um só lugar.</Text>
            <Text style={styles.heroCopy}>Catálogos, bibliotecas pessoais, canais, música e suas fontes favoritas.</Text>
            <TouchableOpacity onPress={() => setSection('search')} style={styles.searchButton}><Text style={styles.searchButtonText}>⌕  Buscar no Nexus Media</Text></TouchableOpacity>
          </View>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>EXPLORAR</Text><Text style={styles.sectionMeta}>CATEGORIAS</Text></View>
          <View style={styles.grid}>{categories.map(item => <TouchableOpacity key={item.title} onPress={() => { if (item.title === 'TV ao vivo') setSection('live'); else { setQuery(item.title); setSection('search'); } }} style={styles.category}><Text style={styles.categoryIcon}>{item.icon}</Text><Text style={styles.categoryTitle}>{item.title}</Text><Text style={styles.categorySub}>{item.subtitle}</Text></TouchableOpacity>)}</View>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>SUAS CONEXÕES</Text></View>
          <TouchableOpacity onPress={() => setSection('addons')} style={styles.connection}><View style={styles.connectionIcon}><Text style={{ fontSize: 22 }}>🧩</Text></View><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>Central de add-ons Kodi</Text><Text style={styles.connectionSub}>Compatibilidade e gerenciamento de extensões</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSection('library')} style={styles.connection}><View style={styles.connectionIcon}><Text style={{ fontSize: 22 }}>🗂️</Text></View><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>Minha biblioteca</Text><Text style={styles.connectionSub}>{library.length} itens salvos neste aparelho</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSection('live')} style={styles.connection}><View style={styles.connectionIcon}><Text style={{ fontSize: 22 }}>📡</Text></View><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>TV ao Vivo</Text><Text style={styles.connectionSub}>Listas M3U públicas e guia de programação</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSection('journey')} style={styles.connection}><View style={styles.connectionIcon}><Text style={{ fontSize: 22 }}>🎯</Text></View><View style={{ flex: 1 }}><Text style={styles.connectionTitle}>Minha Jornada</Text><Text style={styles.connectionSub}>Watchlist, progresso de episódios e avaliações</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
          <Text style={styles.footnote}>Sua biblioteca fica salva localmente no banco do Nexus. Integrações externas serão adicionadas em etapas.</Text>
        </ScrollView>}

        {section === 'search' && <NexusUniversalSearch />}
        {false && <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={styles.pageTitle}>Busca do Nexus Media</Text><Text style={styles.pageCopy}>Pesquise nos itens que você já adicionou à sua biblioteca. A busca em catálogos externos será conectada nas próximas etapas.</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder="Ex.: Interestelar, Naruto, novela..." placeholderTextColor="#898397" style={styles.input} />
          <View style={styles.filterPill}><Text style={styles.filterText}>● Biblioteca local • {library.length} itens</Text></View>
          {query.trim() ? <><Text style={[styles.sectionTitle, { marginTop: 22 }]}>RESULTADOS ({results.length})</Text>{results.length ? results.map(itemCard) : <View style={styles.emptyState}><Text style={{ fontSize: 30 }}>⌕</Text><Text style={styles.emptyTitle}>Nenhum item encontrado</Text><Text style={styles.emptyCopy}>Adicione esse conteúdo à sua biblioteca ou tente outro termo.</Text><TouchableOpacity onPress={() => setSection('library')} style={styles.searchButton}><Text style={styles.searchButtonText}>Adicionar à biblioteca</Text></TouchableOpacity></View>}</> : <View style={styles.emptyState}><Text style={{ fontSize: 30 }}>⌕</Text><Text style={styles.emptyTitle}>Comece sua pesquisa</Text><Text style={styles.emptyCopy}>Os resultados da sua biblioteca aparecerão aqui.</Text></View>}
        </ScrollView>}

        {section === 'addons' && <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={styles.pageTitle}>Add-ons Kodi</Text><Text style={styles.pageCopy}>Área dedicada à compatibilidade com extensões do Kodi.</Text>
          <View style={styles.infoCard}><Text style={styles.infoIcon}>🧩</Text><Text style={styles.infoTitle}>Integração Kodi</Text><Text style={styles.infoCopy}>A instalação e execução de add-ons Kodi exigem um ambiente compatível. Estamos preparando uma ponte de integração; esta tela ainda não instala nem executa extensões.</Text><View style={styles.coming}><Text style={styles.comingText}>INTEGRAÇÃO EM DESENVOLVIMENTO</Text></View></View>
          <Text style={styles.sectionTitle}>PRÓXIMOS RECURSOS</Text>{['Detectar o Kodi instalado','Consultar add-ons disponíveis','Ativar ou desativar extensões','Verificar atualizações e permissões'].map(x => <View key={x} style={styles.featureRow}><Text style={{ color: '#A78BFA' }}>✓</Text><Text style={styles.featureText}>{x}</Text></View>)}
        </ScrollView>}

        {section === 'journey' && <NexusWatchTracker />}
        {section === 'live' && <NexusLiveTV />}

        {section === 'library' && <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={styles.pageTitle}>Minha biblioteca</Text><Text style={styles.pageCopy}>Cadastre e organize mídias pessoais. Os dados ficam salvos no aparelho, mesmo ao fechar o aplicativo.</Text>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>＋ Adicionar mídia</Text>
            <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Nome do conteúdo *" placeholderTextColor="#898397" style={styles.input} />
            <Text style={styles.fieldLabel}>CATEGORIA</Text><View style={styles.categoryChoices}>{categories.map(c => <TouchableOpacity key={c.title} onPress={() => setNewCategory(c.title)} style={[styles.choice, newCategory === c.title && styles.choiceActive]}><Text style={[styles.choiceText, newCategory === c.title && { color: '#FFFFFF' }]}>{c.icon} {c.title}</Text></TouchableOpacity>)}</View>
            <TextInput value={newDescription} onChangeText={setNewDescription} placeholder="Sinopse ou observações (opcional)" placeholderTextColor="#898397" style={[styles.input, { marginTop: 10 }]} />
            <TextInput value={newUrl} onChangeText={setNewUrl} placeholder="Link da mídia (opcional)" placeholderTextColor="#898397" autoCapitalize="none" style={[styles.input, { marginTop: 10 }]} />
            <TouchableOpacity onPress={addItem} style={styles.searchButton}><Text style={styles.searchButtonText}>Salvar na biblioteca</Text></TouchableOpacity>
          </View>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>ITENS SALVOS</Text><Text style={styles.sectionMeta}>{library.length} ITENS</Text></View>
          {library.length ? library.map(itemCard) : <View style={styles.emptyState}><Text style={{ fontSize: 30 }}>🗂️</Text><Text style={styles.emptyTitle}>Sua biblioteca está vazia</Text><Text style={styles.emptyCopy}>Adicione seu primeiro filme, série, anime ou outro conteúdo.</Text></View>}
        </ScrollView>}
      </View>
      <View style={styles.bottomNav}>{nav('home', 'Início', '⌂')}{nav('search', 'Buscar', '⌕')}{nav('addons', 'Add-ons', '🧩')}{nav('library', 'Biblioteca', '▤')}{nav('journey', 'Jornada', '🎯')}{nav('live', 'TV', '📡')}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { minHeight: 68, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#292438' },
  back: { paddingRight: 12, paddingVertical: 8 }, backText: { color: '#C4B5FD', fontSize: 14, fontWeight: '700' }, brand: { color: '#F5F3FF', fontSize: 19, fontWeight: '900', letterSpacing: 1.5 }, tagline: { color: '#8F879F', fontSize: 8, letterSpacing: 1.4, marginTop: 3 }, status: { color: '#8B5CF6', fontSize: 12 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 18 }, hero: { padding: 20, borderRadius: 20, backgroundColor: '#211638', borderWidth: 1, borderColor: '#4B3470', marginBottom: 24 }, eyebrow: { color: '#C4B5FD', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 }, heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 12 }, heroCopy: { color: '#C5BDD2', fontSize: 13, lineHeight: 19, marginTop: 9 }, searchButton: { marginTop: 14, backgroundColor: '#7C3AED', padding: 13, borderRadius: 12, alignItems: 'center' }, searchButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 }, sectionTitle: { color: '#B8AEC9', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 10 }, sectionMeta: { color: '#746B83', fontSize: 9, letterSpacing: 1 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 22 }, category: { width: '48.5%', backgroundColor: '#171421', borderColor: '#2B2638', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, minHeight: 108 }, categoryIcon: { fontSize: 22, marginBottom: 8 }, categoryTitle: { color: '#F4F0FA', fontSize: 14, fontWeight: '800' }, categorySub: { color: '#92899F', fontSize: 10, marginTop: 4 },
  connection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171421', borderWidth: 1, borderColor: '#2B2638', borderRadius: 13, padding: 13, marginBottom: 9 }, connectionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#302247', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, connectionTitle: { color: '#F4F0FA', fontSize: 13, fontWeight: '800' }, connectionSub: { color: '#92899F', fontSize: 10, marginTop: 4 }, chevron: { color: '#A78BFA', fontSize: 24, paddingHorizontal: 5 }, footnote: { color: '#81788E', fontSize: 10, lineHeight: 16, marginTop: 12, marginBottom: 12 },
  pageTitle: { color: '#F7F4FC', fontSize: 24, fontWeight: '900', marginBottom: 7 }, pageCopy: { color: '#A39AAF', fontSize: 12, lineHeight: 18, marginBottom: 18 }, input: { color: '#FFFFFF', backgroundColor: '#191624', borderWidth: 1, borderColor: '#4B3470', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 }, filterPill: { alignSelf: 'flex-start', backgroundColor: '#242039', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8, marginTop: 12 }, filterText: { color: '#C4B5FD', fontSize: 10, fontWeight: '700' },
  emptyState: { marginTop: 24, borderWidth: 1, borderColor: '#302A3D', borderRadius: 16, padding: 24, alignItems: 'center', backgroundColor: '#15121E' }, emptyTitle: { color: '#F4F0FA', fontSize: 16, fontWeight: '800', marginTop: 10 }, emptyCopy: { color: '#9A91A6', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 }, infoCard: { backgroundColor: '#191624', borderWidth: 1, borderColor: '#403052', borderRadius: 16, padding: 18, marginBottom: 22 }, infoIcon: { fontSize: 30, marginBottom: 10 }, infoTitle: { color: '#F4F0FA', fontSize: 17, fontWeight: '900', marginBottom: 8 }, infoCopy: { color: '#A39AAF', fontSize: 12, lineHeight: 19 }, coming: { alignSelf: 'flex-start', backgroundColor: '#302342', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, marginTop: 15 }, comingText: { color: '#C4B5FD', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, featureRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#282334' }, featureText: { color: '#D7D0E0', fontSize: 12 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 9, paddingBottom: 10, backgroundColor: '#13111B', borderTopWidth: 1, borderTopColor: '#2A2536' }, navItem: { minWidth: 70, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 11 }, navIcon: { color: '#C4B5FD', fontSize: 16 }, navText: { fontSize: 9, fontWeight: '700', marginTop: 3 },
  formCard: { backgroundColor: '#191624', borderWidth: 1, borderColor: '#403052', borderRadius: 16, padding: 14, marginBottom: 22 }, formTitle: { color: '#F4F0FA', fontSize: 15, fontWeight: '900', marginBottom: 12 }, fieldLabel: { color: '#A39AAF', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 14, marginBottom: 8 }, categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { borderWidth: 1, borderColor: '#3B3448', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#211D2B' }, choiceActive: { backgroundColor: '#5B21B6', borderColor: '#8B5CF6' }, choiceText: { color: '#B8AEC9', fontSize: 10, fontWeight: '700' }, mediaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171421', borderWidth: 1, borderColor: '#2B2638', borderRadius: 13, padding: 12, marginBottom: 9 }, mediaIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#302247', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, urlText: { color: '#8B5CF6', fontSize: 9, marginTop: 4 }, remove: { color: '#C4B5FD', fontSize: 18, padding: 8 },
});
