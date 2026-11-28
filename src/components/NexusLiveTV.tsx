import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

type Channel = { id: string; name: string; url: string; logo: string; group: string; tvgId: string };
type Programme = { title: string; start: number; stop: number; description: string };
type Source = { label: string; url: string };
const SOURCES: Source[] = [
  { label: 'Brasil', url: 'https://iptv-org.github.io/iptv/countries/br.m3u' },
  { label: 'Mundo', url: 'https://iptv-org.github.io/iptv/index.country.m3u' },
  { label: 'Notícias', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
  { label: 'Esportes', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
  { label: 'Infantil', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
  { label: 'Documentários', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' },
  { label: 'Música', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
];
const DEFAULT_EPG = 'https://iptv-org.github.io/epg/guides/br/mi.tv.epg.xml';
const attr = (line: string, key: string) => {
  const m = line.match(new RegExp(key + '="([^"]*)"'));
  return m?.[1] || '';
};
function parseM3U(raw: string): Channel[] {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const found: Channel[] = [];
  let info = '';
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) info = line;
    else if (info && line.trim() && !line.startsWith('#')) {
      const comma = info.indexOf(',');
      const name = comma >= 0 ? info.slice(comma + 1).trim() : attr(info, 'tvg-name') || 'Canal';
      const url = line.trim();
      if (/^https?:\/\//i.test(url)) found.push({
        id: String(found.length) + '-' + name,
        name, url, logo: attr(info, 'tvg-logo'), group: attr(info, 'group-title') || 'Outros', tvgId: attr(info, 'tvg-id'),
      });
      info = '';
    }
  }
  return found;
}
function parseXmltv(xml: string, tvgId: string): Programme[] {
  if (!tvgId) return [];
  const safe = tvgId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out: Programme[] = [];
  const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && out.length < 1500) {
    if (!new RegExp('channel="' + safe + '"').test(m[1])) continue;
    const start = m[1].match(/start="(\d{14})/);
    const stop = m[1].match(/stop="(\d{14})/);
    const title = m[2].match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || 'Programação';
    const desc = m[2].match(/<desc[^>]*>([\s\S]*?)<\/desc>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || '';
    const toTime = (v?: string) => v ? Date.UTC(+v.slice(0,4), +v.slice(4,6)-1, +v.slice(6,8), +v.slice(8,10), +v.slice(10,12), +v.slice(12,14)) : 0;
    const a = toTime(start?.[1]); const b = toTime(stop?.[1]);
    if (a && b) out.push({ title, start: a, stop: b, description: desc });
  }
  return out.sort((a,b)=>a.start-b.start);
}
function LivePlayer({ channel }: { channel: Channel }) {
  const player = useVideoPlayer(channel.url, p => { p.play(); });
  return <View style={styles.player}><VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" /></View>;
}
function clock(ms: number) { return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

export default function NexusLiveTV() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [source, setSource] = useState(SOURCES[0]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [epgUrl, setEpgUrl] = useState(DEFAULT_EPG);
  const [epgXml, setEpgXml] = useState('');
  const [epgLoading, setEpgLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const loadPlaylist = async (item: Source) => {
    setSource(item); setLoading(true); setError(''); setSelected(null);
    try {
      const response = await fetch(item.url);
      if (!response.ok) throw new Error('Servidor respondeu ' + response.status);
      const text = await response.text();
      const parsed = parseM3U(text);
      if (!parsed.length) throw new Error('A lista não retornou canais em formato M3U.');
      setChannels(parsed);
    } catch (e) { setChannels([]); setError('Não foi possível carregar esta lista. Verifique a conexão ou tente outra fonte.'); }
    finally { setLoading(false); }
  };
  const loadEpg = async () => {
    setEpgLoading(true);
    try {
      const response = await fetch(epgUrl.trim());
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const xml = await response.text();
      setEpgXml(xml);
      Alert.alert('Guia atualizado', 'Dados de programação carregados. A grade depende da correspondência tvg-id de cada canal.');
    } catch { Alert.alert('Não foi possível carregar o guia', 'Confira o endereço XMLTV ou tente novamente.'); }
    finally { setEpgLoading(false); }
  };
  useEffect(() => { loadPlaylist(SOURCES[0]); }, []);
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    return channels.filter(c => !q || (c.name + ' ' + c.group).toLocaleLowerCase('pt-BR').includes(q));
  }, [channels, search]);
  const programmes = useMemo(() => selected ? parseXmltv(epgXml, selected.tvgId) : [], [epgXml, selected]);
  const now = Date.now();
  const current = programmes.find(p => p.start <= now && p.stop > now);
  const next = programmes.filter(p => p.start > now).slice(0, 5);
  return <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
    <Text style={styles.kicker}>NEXUS MEDIA • TRANSMISSÃO AO VIVO</Text>
    <Text style={styles.title}>TV ao Vivo</Text>
    <Text style={styles.sub}>Canais públicos da comunidade IPTV-org. A disponibilidade pode variar por emissora, região e horário.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {SOURCES.map(s => <TouchableOpacity key={s.label} onPress={() => loadPlaylist(s)} style={[styles.sourceChip, source.label === s.label && styles.sourceActive]}><Text style={[styles.sourceText, source.label === s.label && { color: '#FFF' }]}>{s.label}</Text></TouchableOpacity>)}
    </ScrollView>
    <View style={styles.sourceInfo}><Text style={styles.sourceLabel}>LISTA ATIVA</Text><Text style={styles.sourceName}>{source.label} • {channels.length} canais carregados</Text><Text style={styles.sourceUrl}>{source.url}</Text></View>
    {loading ? <View style={styles.loading}><ActivityIndicator color="#A78BFA"/><Text style={styles.sub}>Carregando canais…</Text></View> : null}
    {!!error && <Text style={styles.error}>{error}</Text>}
    {selected ? <View style={styles.nowPlaying}>
      <View style={styles.rowBetween}><Text style={styles.section}>REPRODUZINDO</Text><TouchableOpacity onPress={() => setSelected(null)}><Text style={styles.link}>Fechar player ✕</Text></TouchableOpacity></View>
      <Text style={styles.channelTitle}>{selected.name}</Text><LivePlayer channel={selected}/>
      <TouchableOpacity onPress={() => setGuideOpen(v=>!v)} style={styles.guideButton}><Text style={styles.guideButtonText}>▦ {guideOpen ? 'Ocultar guia de programação' : 'Abrir guia de programação'}</Text></TouchableOpacity>
      {guideOpen ? <View style={styles.guideBox}>
        <Text style={styles.section}>AGORA</Text>
        {current ? <><Text style={styles.programTitle}>{current.title}</Text><Text style={styles.programTime}>{clock(current.start)} – {clock(current.stop)}</Text>{!!current.description && <Text style={styles.programDesc}>{current.description}</Text>}</> : <Text style={styles.sub}>Sem programa atual encontrado para este canal.</Text>}
        <Text style={[styles.section,{marginTop:14}]}>A SEGUIR</Text>
        {next.length ? next.map((p,i)=><View key={String(p.start)+i} style={styles.programRow}><Text style={styles.programTime}>{clock(p.start)}</Text><Text style={styles.programTitle}>{p.title}</Text></View>) : <Text style={styles.sub}>Sem próximos programas disponíveis.</Text>}
      </View> : null}
    </View> : null}
    <View style={styles.epgCard}>
      <View style={styles.rowBetween}><Text style={styles.section}>GUIA DE PROGRAMAÇÃO (XMLTV)</Text><Text style={styles.epgTag}>EPG</Text></View>
      <Text style={styles.sub}>Carregue um guia compatível para mostrar o programa atual e os próximos. A ligação é feita pelo código tvg-id.</Text>
      <TextInput value={epgUrl} onChangeText={setEpgUrl} autoCapitalize="none" placeholder="URL do guia XMLTV" placeholderTextColor="#8C8498" style={styles.input}/>
      <TouchableOpacity onPress={loadEpg} style={styles.guideButton} disabled={epgLoading}><Text style={styles.guideButtonText}>{epgLoading ? 'Carregando guia…' : 'Atualizar guia de programação'}</Text></TouchableOpacity>
    </View>
    <TextInput value={search} onChangeText={setSearch} placeholder="Buscar canal ou categoria…" placeholderTextColor="#8C8498" style={styles.input}/>
    <View style={styles.rowBetween}><Text style={styles.section}>CANAIS</Text><Text style={styles.count}>{visible.length} resultados</Text></View>
    {visible.slice(0, 350).map(c=><TouchableOpacity key={c.id} onPress={()=>setSelected(c)} style={styles.channelRow}>
      <View style={styles.channelIcon}><Text style={{fontSize:18}}>📺</Text></View><View style={{flex:1}}><Text style={styles.channelName}>{c.name}</Text><Text style={styles.channelGroup}>{c.group}</Text></View><Text style={styles.play}>▶</Text>
    </TouchableOpacity>)}
    {visible.length > 350 ? <Text style={styles.sub}>Exibindo os primeiros 350 canais. Use a busca para localizar os demais.</Text> : null}
    <Text style={styles.foot}>Listas comunitárias podem conter links temporariamente indisponíveis. O Nexus não hospeda os canais. Use apenas transmissões autorizadas pelas emissoras.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
 root:{flex:1}, kicker:{color:'#A78BFA',fontSize:9,fontWeight:'900',letterSpacing:1.2,marginBottom:7}, title:{color:'#F7F4FC',fontSize:25,fontWeight:'900'}, sub:{color:'#A39AAF',fontSize:11,lineHeight:17,marginTop:6,marginBottom:10}, sourceChip:{backgroundColor:'#242039',borderRadius:18,paddingHorizontal:13,paddingVertical:9,marginRight:7,borderWidth:1,borderColor:'#3B3448'},sourceActive:{backgroundColor:'#5B21B6',borderColor:'#A78BFA'},sourceText:{color:'#C4B5D2',fontSize:11,fontWeight:'800'},sourceInfo:{backgroundColor:'#191624',borderRadius:13,borderWidth:1,borderColor:'#332A43',padding:12,marginBottom:12},sourceLabel:{color:'#A39AAF',fontSize:8,fontWeight:'900',letterSpacing:1},sourceName:{color:'#F4F0FA',fontSize:13,fontWeight:'900',marginTop:4},sourceUrl:{color:'#8B5CF6',fontSize:9,marginTop:5},loading:{alignItems:'center',padding:20,gap:8},error:{color:'#FCA5A5',fontSize:11,marginBottom:12},nowPlaying:{backgroundColor:'#171421',borderRadius:15,borderWidth:1,borderColor:'#5B3A84',padding:12,marginBottom:14},rowBetween:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},section:{color:'#B8AEC9',fontSize:9,fontWeight:'900',letterSpacing:1.2,marginBottom:8},link:{color:'#C4B5FD',fontSize:10,fontWeight:'800'},channelTitle:{color:'#FFF',fontSize:16,fontWeight:'900',marginBottom:10},player:{width:'100%',height:210,backgroundColor:'#000',borderRadius:10,overflow:'hidden'},guideButton:{backgroundColor:'#5B21B6',borderRadius:10,padding:11,alignItems:'center',marginTop:10},guideButtonText:{color:'#FFF',fontSize:11,fontWeight:'900'},guideBox:{backgroundColor:'#100E17',borderRadius:10,padding:12,marginTop:10},programTitle:{color:'#F4F0FA',fontSize:12,fontWeight:'800'},programTime:{color:'#A78BFA',fontSize:10,marginTop:3},programDesc:{color:'#A39AAF',fontSize:10,lineHeight:15,marginTop:5},programRow:{flexDirection:'row',gap:10,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#282334'},epgCard:{backgroundColor:'#191624',borderRadius:14,borderWidth:1,borderColor:'#403052',padding:12,marginBottom:14},epgTag:{color:'#C4B5FD',fontSize:9,fontWeight:'900'},input:{color:'#FFF',backgroundColor:'#191624',borderWidth:1,borderColor:'#4B3470',borderRadius:11,paddingHorizontal:12,paddingVertical:11,fontSize:12,marginBottom:12},count:{color:'#8C8498',fontSize:9},channelRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#171421',borderWidth:1,borderColor:'#2B2638',borderRadius:11,padding:10,marginBottom:7},channelIcon:{width:36,height:36,borderRadius:10,backgroundColor:'#302247',alignItems:'center',justifyContent:'center',marginRight:10},channelName:{color:'#F4F0FA',fontSize:12,fontWeight:'800'},channelGroup:{color:'#92899F',fontSize:9,marginTop:3},play:{color:'#C4B5FD',fontSize:14,paddingHorizontal:8},foot:{color:'#81788E',fontSize:9,lineHeight:15,marginTop:14}
});
