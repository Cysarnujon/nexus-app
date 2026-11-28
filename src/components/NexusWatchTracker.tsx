import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getAppMeta, setAppMeta } from '../database/db';

type WatchStatus = 'Quero assistir' | 'Assistindo' | 'Assistido' | 'Pausado' | 'Abandonado';
type WatchItem = { id: string; title: string; category: string; status: WatchStatus; season: string; episode: string; rating: string; notes: string; updatedAt: number };
const statuses: WatchStatus[] = ['Quero assistir', 'Assistindo', 'Assistido', 'Pausado', 'Abandonado'];
const categories = ['Filme', 'Série', 'Anime', 'Novela', 'Documentário'];
const readItems = (): WatchItem[] => {
  try { const raw = getAppMeta('nexus_media_journey'); const data = raw ? JSON.parse(raw) : []; return Array.isArray(data) ? data : []; }
  catch { return []; }
};

export default function NexusWatchTracker() {
  const [items, setItems] = useState<WatchItem[]>(readItems);
  const [filter, setFilter] = useState<'Todos' | WatchStatus>('Todos');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Filme');
  const [status, setStatus] = useState<WatchStatus>('Quero assistir');
  const [season, setSeason] = useState('');
  const [episode, setEpisode] = useState('');
  const [rating, setRating] = useState('');
  const [notes, setNotes] = useState('');
  const persist = (next: WatchItem[]) => { setItems(next); setAppMeta('nexus_media_journey', JSON.stringify(next)); };
  const visible = useMemo(() => filter === 'Todos' ? items : items.filter(x => x.status === filter), [items, filter]);
  const add = () => {
    if (!title.trim()) { Alert.alert('Falta o título', 'Digite o nome do conteúdo que deseja acompanhar.'); return; }
    const item: WatchItem = { id: String(Date.now()), title: title.trim(), category, status, season: season.trim(), episode: episode.trim(), rating: rating.trim(), notes: notes.trim(), updatedAt: Date.now() };
    persist([item, ...items]); setTitle(''); setSeason(''); setEpisode(''); setRating(''); setNotes('');
    Alert.alert('Adicionado à jornada', 'Seu conteúdo foi salvo neste aparelho.');
  };
  const update = (id: string, patch: Partial<WatchItem>) => persist(items.map(x => x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x));
  const remove = (id: string) => Alert.alert('Remover da jornada?', 'O registro será apagado.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => persist(items.filter(x => x.id !== id)) }]);
  const count = (s: WatchStatus) => items.filter(x => x.status === s).length;
  const chip = (label: string, active: boolean, onPress: () => void) => <TouchableOpacity key={label} onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && { color: '#FFF' }]}>{label}</Text></TouchableOpacity>;
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
    <Text style={styles.kicker}>SEU HISTÓRICO DE ENTRETENIMENTO</Text>
    <Text style={styles.title}>Minha Jornada</Text>
    <Text style={styles.copy}>Organize o que deseja assistir, acompanhe episódios e registre suas avaliações.</Text>
    <View style={styles.stats}>
      <View style={styles.stat}><Text style={styles.statNum}>{items.length}</Text><Text style={styles.statLabel}>Na jornada</Text></View>
      <View style={styles.stat}><Text style={styles.statNum}>{count('Assistindo')}</Text><Text style={styles.statLabel}>Assistindo</Text></View>
      <View style={styles.stat}><Text style={styles.statNum}>{count('Assistido')}</Text><Text style={styles.statLabel}>Concluídos</Text></View>
    </View>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>＋ Adicionar conteúdo</Text>
      <TextInput value={title} onChangeText={setTitle} placeholder="Nome do filme, série ou anime" placeholderTextColor="#898397" style={styles.input}/>
      <Text style={styles.label}>TIPO</Text><View style={styles.wrap}>{categories.map(x => chip(x, category === x, () => setCategory(x)))}</View>
      <Text style={styles.label}>STATUS</Text><View style={styles.wrap}>{statuses.map(x => chip(x, status === x, () => setStatus(x)))}</View>
      <View style={styles.row}><TextInput value={season} onChangeText={setSeason} placeholder="Temporada" placeholderTextColor="#898397" style={[styles.input, styles.half]}/><TextInput value={episode} onChangeText={setEpisode} placeholder="Episódio" placeholderTextColor="#898397" style={[styles.input, styles.half]}/></View>
      <TextInput value={rating} onChangeText={setRating} placeholder="Sua nota (ex.: 9/10)" placeholderTextColor="#898397" style={styles.input}/>
      <TextInput value={notes} onChangeText={setNotes} placeholder="Anotações (opcional)" placeholderTextColor="#898397" style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}/>
      <TouchableOpacity onPress={add} style={styles.primary}><Text style={styles.primaryText}>Salvar na Minha Jornada</Text></TouchableOpacity>
    </View>
    <Text style={styles.section}>MINHA LISTA</Text><View style={styles.wrap}>{chip('Todos', filter === 'Todos', () => setFilter('Todos'))}{statuses.map(x => chip(x, filter === x, () => setFilter(x)))}</View>
    {visible.length ? visible.map(item => <View key={item.id} style={styles.item}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemMeta}>{item.category} {item.rating ? ' • Nota ' + item.rating : ''}</Text>
        {(item.season || item.episode) ? <Text style={styles.itemMeta}>Temporada {item.season || '—'} • Episódio {item.episode || '—'}</Text> : null}
        {!!item.notes && <Text style={styles.notes}>{item.notes}</Text>}
        <View style={styles.wrap}>{statuses.map(s => chip(s, item.status === s, () => update(item.id, { status: s })))}</View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => update(item.id, { episode: String(Math.max(0, Number(item.episode || 0)) + 1), status: 'Assistindo' })} style={styles.smallAction}><Text style={styles.smallText}>＋ Próximo episódio</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => remove(item.id)} style={styles.smallAction}><Text style={[styles.smallText, { color: '#FCA5A5' }]}>Remover</Text></TouchableOpacity>
        </View>
      </View>
    </View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nada por aqui ainda</Text><Text style={styles.copy}>Adicione um conteúdo acima ou escolha outro filtro.</Text></View>}
    <Text style={styles.foot}>Os registros ficam salvos localmente no aparelho. Sincronização com Trakt e integração com serviços serão etapas futuras.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  kicker: { color: '#A78BFA', fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 7 }, title: { color: '#F7F4FC', fontSize: 25, fontWeight: '900' }, copy: { color: '#A39AAF', fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 14 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 16 }, stat: { flex: 1, backgroundColor: '#191624', borderRadius: 13, borderWidth: 1, borderColor: '#332A43', padding: 12 }, statNum: { color: '#C4B5FD', fontSize: 22, fontWeight: '900' }, statLabel: { color: '#A39AAF', fontSize: 10, marginTop: 3 },
  panel: { backgroundColor: '#191624', borderWidth: 1, borderColor: '#403052', borderRadius: 16, padding: 14, marginBottom: 22 }, panelTitle: { color: '#F4F0FA', fontSize: 15, fontWeight: '900', marginBottom: 12 }, input: { color: '#FFF', backgroundColor: '#100E17', borderWidth: 1, borderColor: '#4B3470', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, fontSize: 12, marginBottom: 9 }, label: { color: '#A39AAF', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 4, marginBottom: 7 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }, chip: { backgroundColor: '#242039', borderRadius: 18, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: '#3B3448' }, chipActive: { backgroundColor: '#5B21B6', borderColor: '#A78BFA' }, chipText: { color: '#C4B5D2', fontSize: 9, fontWeight: '700' }, row: { flexDirection: 'row', gap: 8 }, half: { flex: 1 }, primary: { backgroundColor: '#7C3AED', borderRadius: 11, padding: 13, alignItems: 'center', marginTop: 3 }, primaryText: { color: '#FFF', fontSize: 12, fontWeight: '900' },
  section: { color: '#B8AEC9', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginBottom: 12 }, item: { backgroundColor: '#171421', borderWidth: 1, borderColor: '#332A43', borderRadius: 14, padding: 13, marginBottom: 9 }, itemTitle: { color: '#F4F0FA', fontSize: 14, fontWeight: '900' }, itemMeta: { color: '#A39AAF', fontSize: 10, marginTop: 4 }, notes: { color: '#D7D0E0', fontSize: 11, marginTop: 8 }, actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }, smallAction: { paddingVertical: 7, paddingHorizontal: 9, backgroundColor: '#282238', borderRadius: 8 }, smallText: { color: '#C4B5FD', fontSize: 10, fontWeight: '800' }, empty: { alignItems: 'center', backgroundColor: '#15121E', borderRadius: 14, padding: 22, borderWidth: 1, borderColor: '#302A3D' }, emptyTitle: { color: '#F4F0FA', fontSize: 15, fontWeight: '800' }, foot: { color: '#81788E', fontSize: 10, lineHeight: 16, marginTop: 16 }
});
