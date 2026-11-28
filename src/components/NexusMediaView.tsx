import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type MediaTheme = {
  bg: string; surface: string; surfaceAlt: string; text: string;
  textDim: string; border: string; accent: string;
};

type Props = { theme: MediaTheme; onBackHome: () => void };

const categories = [
  { icon: '🎬', title: 'Filmes', subtitle: 'Descubra filmes' },
  { icon: '📺', title: 'Séries', subtitle: 'Continue de onde parou' },
  { icon: '🍥', title: 'Animes', subtitle: 'Universos e temporadas' },
  { icon: '🎭', title: 'Novelas', subtitle: 'Histórias e capítulos' },
  { icon: '📡', title: 'TV ao vivo', subtitle: 'Canais e programação' },
  { icon: '🎵', title: 'Música', subtitle: 'Áudio e playlists' },
];

export default function NexusMediaView({ theme, onBackHome }: Props) {
  const [section, setSection] = useState<'home' | 'search' | 'addons' | 'library'>('home');
  const [query, setQuery] = useState('');

  const searchHint = useMemo(() => query.trim()
    ? 'A busca universal será conectada às fontes e extensões configuradas nesta etapa de integração.'
    : 'Pesquise filmes, séries, animes, novelas e muito mais.', [query]);

  const nav = (key: typeof section, label: string, icon: string) => (
    <TouchableOpacity onPress={() => setSection(key)} style={[styles.navItem, { backgroundColor: section === key ? '#39265F' : theme.surfaceAlt }]}>
      <Text style={styles.navIcon}>{icon}</Text>
      <Text style={[styles.navText, { color: section === key ? '#FFFFFF' : theme.textDim }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: '#0B0A12' }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹  Nexus</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>NEXUS <Text style={{ color: '#A78BFA' }}>MEDIA</Text></Text>
          <Text style={styles.tagline}>SEU UNIVERSO DE ENTRETENIMENTO</Text>
        </View>
        <Text style={styles.status}>●</Text>
      </View>

      <View style={styles.content}>
        {section === 'home' && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>BEM-VINDO AO SEU CENTRO MULTIMÍDIA</Text>
              <Text style={styles.heroTitle}>Tudo o que você gosta. Em um só lugar.</Text>
              <Text style={styles.heroCopy}>Catálogos, bibliotecas pessoais, canais, música e suas fontes favoritas.</Text>
              <TouchableOpacity onPress={() => setSection('search')} style={styles.searchButton}>
                <Text style={styles.searchButtonText}>⌕  Buscar em todas as fontes</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>EXPLORAR</Text><Text style={styles.sectionMeta}>CATEGORIAS</Text></View>
            <View style={styles.grid}>
              {categories.map(item => (
                <TouchableOpacity key={item.title} onPress={() => { setQuery(item.title); setSection('search'); }} style={styles.category}>
                  <Text style={styles.categoryIcon}>{item.icon}</Text>
                  <Text style={styles.categoryTitle}>{item.title}</Text>
                  <Text style={styles.categorySub}>{item.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>SUAS CONEXÕES</Text></View>
            <TouchableOpacity onPress={() => setSection('addons')} style={styles.connection}>
              <View style={styles.connectionIcon}><Text style={{ fontSize: 22 }}>🧩</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectionTitle}>Central de add-ons Kodi</Text>
                <Text style={styles.connectionSub}>Compatibilidade e gerenciamento de extensões</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSection('library')} style={styles.connection}>
              <View style={styles.connectionIcon}><Text style={{ fontSize: 22 }}>🗂️</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectionTitle}>Minha biblioteca</Text>
                <Text style={styles.connectionSub}>Coleções e servidores pessoais</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <Text style={styles.footnote}>O Nexus Media está sendo construído por etapas. As conexões e reproduções serão habilitadas conforme cada integração for implementada.</Text>
          </ScrollView>
        )}

        {section === 'search' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            <Text style={styles.pageTitle}>Busca universal</Text>
            <Text style={styles.pageCopy}>Uma pesquisa para encontrar conteúdo nas fontes que você instalar e conectar.</Text>
            <TextInput value={query} onChangeText={setQuery} placeholder="Ex.: Interestelar, Naruto, novela..." placeholderTextColor="#898397" style={styles.input} />
            <View style={styles.filterPill}><Text style={styles.filterText}>✓  Todas as fontes ativas (modo automático planejado)</Text></View>
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 34 }}>⌕</Text>
              <Text style={styles.emptyTitle}>{query.trim() ? 'Pesquisa preparada' : 'Comece sua pesquisa'}</Text>
              <Text style={styles.emptyCopy}>{searchHint}</Text>
            </View>
          </ScrollView>
        )}

        {section === 'addons' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            <Text style={styles.pageTitle}>Add-ons Kodi</Text>
            <Text style={styles.pageCopy}>Área dedicada à compatibilidade com extensões do Kodi.</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>🧩</Text>
              <Text style={styles.infoTitle}>Integração Kodi</Text>
              <Text style={styles.infoCopy}>A instalação e execução de add-ons Kodi exigem o ambiente Kodi compatível. Nesta primeira etapa, estamos preparando a área de gerenciamento; a ponte de integração será desenvolvida separadamente.</Text>
              <View style={styles.coming}><Text style={styles.comingText}>INTEGRAÇÃO EM DESENVOLVIMENTO</Text></View>
            </View>
            <Text style={styles.sectionTitle}>O que esta central deverá oferecer</Text>
            {['Adicionar repositórios','Consultar add-ons instalados','Ativar ou desativar extensões','Verificar atualizações e permissões'].map(x => <View key={x} style={styles.featureRow}><Text style={{ color: '#A78BFA' }}>✓</Text><Text style={styles.featureText}>{x}</Text></View>)}
          </ScrollView>
        )}

        {section === 'library' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            <Text style={styles.pageTitle}>Minha biblioteca</Text>
            <Text style={styles.pageCopy}>Reúna suas mídias pessoais e servidores conectados.</Text>
            <View style={styles.infoCard}><Text style={styles.infoIcon}>🗃️</Text><Text style={styles.infoTitle}>Biblioteca pessoal</Text><Text style={styles.infoCopy}>A integração com Jellyfin e outras bibliotecas será conectada aqui, preservando os dados e recursos existentes do Nexus.</Text></View>
          </ScrollView>
        )}
      </View>

      <View style={styles.bottomNav}>
        {nav('home', 'Início', '⌂')}
        {nav('search', 'Buscar', '⌕')}
        {nav('addons', 'Add-ons', '🧩')}
        {nav('library', 'Biblioteca', '▤')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 68, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#292438' },
  back: { paddingRight: 12, paddingVertical: 8 },
  backText: { color: '#C4B5FD', fontSize: 14, fontWeight: '700' },
  brand: { color: '#F5F3FF', fontSize: 19, fontWeight: '900', letterSpacing: 1.5 },
  tagline: { color: '#8F879F', fontSize: 8, letterSpacing: 1.4, marginTop: 3 },
  status: { color: '#8B5CF6', fontSize: 12 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 18 },
  hero: { padding: 20, borderRadius: 20, backgroundColor: '#211638', borderWidth: 1, borderColor: '#4B3470', marginBottom: 24 },
  eyebrow: { color: '#C4B5FD', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 12 },
  heroCopy: { color: '#C5BDD2', fontSize: 13, lineHeight: 19, marginTop: 9 },
  searchButton: { marginTop: 18, backgroundColor: '#7C3AED', padding: 13, borderRadius: 12, alignItems: 'center' },
  searchButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 4 },
  sectionTitle: { color: '#B8AEC9', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 10 },
  sectionMeta: { color: '#746B83', fontSize: 9, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 22 },
  category: { width: '48.5%', backgroundColor: '#171421', borderColor: '#2B2638', borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10, minHeight: 108 },
  categoryIcon: { fontSize: 22, marginBottom: 8 },
  categoryTitle: { color: '#F4F0FA', fontSize: 14, fontWeight: '800' },
  categorySub: { color: '#92899F', fontSize: 10, marginTop: 4 },
  connection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171421', borderWidth: 1, borderColor: '#2B2638', borderRadius: 13, padding: 13, marginBottom: 9 },
  connectionIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#302247', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  connectionTitle: { color: '#F4F0FA', fontSize: 13, fontWeight: '800' },
  connectionSub: { color: '#92899F', fontSize: 10, marginTop: 4 },
  chevron: { color: '#A78BFA', fontSize: 24, paddingHorizontal: 5 },
  footnote: { color: '#81788E', fontSize: 10, lineHeight: 16, marginTop: 12, marginBottom: 12 },
  pageTitle: { color: '#F7F4FC', fontSize: 24, fontWeight: '900', marginBottom: 7 },
  pageCopy: { color: '#A39AAF', fontSize: 12, lineHeight: 18, marginBottom: 18 },
  input: { color: '#FFFFFF', backgroundColor: '#191624', borderWidth: 1, borderColor: '#4B3470', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 },
  filterPill: { alignSelf: 'flex-start', backgroundColor: '#242039', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8, marginTop: 12 },
  filterText: { color: '#C4B5FD', fontSize: 10, fontWeight: '700' },
  emptyState: { marginTop: 24, borderWidth: 1, borderColor: '#302A3D', borderRadius: 16, padding: 24, alignItems: 'center', backgroundColor: '#15121E' },
  emptyTitle: { color: '#F4F0FA', fontSize: 16, fontWeight: '800', marginTop: 10 },
  emptyCopy: { color: '#9A91A6', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 },
  infoCard: { backgroundColor: '#191624', borderWidth: 1, borderColor: '#403052', borderRadius: 16, padding: 18, marginBottom: 22 },
  infoIcon: { fontSize: 30, marginBottom: 10 },
  infoTitle: { color: '#F4F0FA', fontSize: 17, fontWeight: '900', marginBottom: 8 },
  infoCopy: { color: '#A39AAF', fontSize: 12, lineHeight: 19 },
  coming: { alignSelf: 'flex-start', backgroundColor: '#302342', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, marginTop: 15 },
  comingText: { color: '#C4B5FD', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#282334' },
  featureText: { color: '#D7D0E0', fontSize: 12 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 9, paddingBottom: 10, backgroundColor: '#13111B', borderTopWidth: 1, borderTopColor: '#2A2536' },
  navItem: { minWidth: 70, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 11 },
  navIcon: { color: '#C4B5FD', fontSize: 16 },
  navText: { fontSize: 9, fontWeight: '700', marginTop: 3 },
});
