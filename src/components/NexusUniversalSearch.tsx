import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getAppMeta, setAppMeta } from '../database/db';

type Result = { id: number; media_type: 'movie' | 'tv'; title: string; overview?: string; poster_path?: string | null; release_date?: string; first_air_date?: string; vote_average?: number };
const API = 'https://api.themoviedb.org/3';
const IMAGE = 'https://image.tmdb.org/t/p/w342';
const readKey = () => { try { return getAppMeta('nexus_tmdb_api_key') || ''; } catch { return ''; } };
const readJourney = (): any[] => { try { const v=getAppMeta('nexus_media_journey'); const p=v?JSON.parse(v):[]; return Array.isArray(p)?p:[]; } catch { return []; } };

export default function NexusUniversalSearch() {
  const [query,setQuery]=useState('');
  const [apiKey,setApiKey]=useState(readKey);
  const [showKey,setShowKey]=useState(false);
  const [results,setResults]=useState<Result[]>([]);
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [selected,setSelected]=useState<Result|null>(null);
  const saveKey=()=>{ if(!apiKey.trim()){Alert.alert('Chave vazia','Cole sua chave da API do TMDB.');return;} setAppMeta('nexus_tmdb_api_key',apiKey.trim()); Alert.alert('Chave salva','A chave foi guardada localmente neste aparelho.'); };
  const search=async()=>{
    if(!query.trim()){Alert.alert('Digite uma pesquisa','Informe o nome de um filme, série ou anime.');return;}
    if(!apiKey.trim()){Alert.alert('Configure o TMDB','Adicione sua chave da API do TMDB na área de configuração.');return;}
    setLoading(true);setSearched(true);setSelected(null);
    try{
      const url=API+'/search/multi?query='+encodeURIComponent(query.trim())+'&language=pt-BR&include_adult=false&api_key='+encodeURIComponent(apiKey.trim());
      const response=await fetch(url);
      if(!response.ok) throw new Error(response.status===401?'Chave da API inválida ou não autorizada.':'Não foi possível consultar o catálogo (HTTP '+response.status+').');
      const data=await response.json();
      setResults((data.results||[]).filter((x:any)=>x.media_type==='movie'||x.media_type==='tv').slice(0,40));
    }catch(e:any){Alert.alert('Falha na busca',e?.message||'Verifique sua conexão e a chave do TMDB.');setResults([]);}
    finally{setLoading(false);}
  };
  const addToJourney=(item:Result)=>{
    const items=readJourney();
    if(items.some(x=>String(x.tmdbId||'')===String(item.id)&&x.mediaType===item.media_type)){Alert.alert('Já está na jornada','Esse título já foi adicionado.');return;}
    const category=item.media_type==='movie'?'Filme':/anime/i.test(item.title)?'Anime':'Série';
    const next={id:String(Date.now()),title:item.title,category,status:'Quero assistir',season:'',episode:'',rating:'',notes:'Adicionado pela Busca Universal • TMDB ID: '+item.id,updatedAt:Date.now(),tmdbId:item.id,mediaType:item.media_type,posterPath:item.poster_path||''};
    setAppMeta('nexus_media_journey',JSON.stringify([next,...items]));
    Alert.alert('Adicionado à Minha Jornada',item.title+' foi salvo na sua lista.');
  };
  const titleOf=(x:Result)=>x.title;
  const dateOf=(x:Result)=>x.release_date||x.first_air_date||'';
  return <ScrollView style={styles.root} contentContainerStyle={{paddingBottom:30}} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>NEXUS MEDIA • DESCOBERTA</Text>
    <Text style={styles.title}>Busca Universal</Text>
    <Text style={styles.copy}>Pesquise filmes e séries em um só lugar. Os resultados vêm do catálogo de metadados TMDB; a disponibilidade para assistir depende das suas fontes e serviços conectados.</Text>
    <View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" placeholder="Ex.: Interestelar, Naruto, The Last of Us..." placeholderTextColor="#898397" style={styles.searchInput}/><TouchableOpacity onPress={search} disabled={loading} style={styles.searchButton}><Text style={styles.searchButtonText}>⌕</Text></TouchableOpacity></View>
    <View style={styles.config}>
      <TouchableOpacity onPress={()=>setShowKey(v=>!v)} style={styles.configHead}><Text style={styles.configTitle}>⚙ Configurar catálogo TMDB</Text><Text style={styles.configAction}>{showKey?'Fechar':'Configurar'}</Text></TouchableOpacity>
      {showKey?<><Text style={styles.configCopy}>A busca externa precisa da sua chave pessoal gratuita da API do TMDB. Crie uma conta e solicite uma chave em themoviedb.org. Ela não está embutida no APK; fica salva localmente neste aparelho.</Text><TextInput value={apiKey} onChangeText={setApiKey} placeholder="Cole aqui sua chave API (v3 auth)" placeholderTextColor="#898397" secureTextEntry={!showKey} autoCapitalize="none" style={styles.keyInput}/><TouchableOpacity onPress={saveKey} style={styles.saveButton}><Text style={styles.saveText}>Salvar chave neste aparelho</Text></TouchableOpacity></>:<Text style={styles.configCopy}>{apiKey?'Chave configurada neste aparelho.':'Configure uma chave para ativar as pesquisas externas.'}</Text>}
    </View>
    {loading?<View style={styles.loading}><ActivityIndicator color="#A78BFA"/><Text style={styles.copy}>Pesquisando no catálogo…</Text></View>:null}
    {searched&&!loading?<Text style={styles.section}>RESULTADOS • {results.length}</Text>:null}
    {results.map(item=><TouchableOpacity key={item.media_type+'-'+item.id} onPress={()=>setSelected(item)} style={styles.result}>
      {item.poster_path?<Image source={{uri:IMAGE+item.poster_path}} style={styles.poster}/>:<View style={[styles.poster,styles.noPoster]}><Text style={{fontSize:22}}>🎬</Text></View>}
      <View style={{flex:1}}><Text style={styles.resultTitle}>{titleOf(item)}</Text><Text style={styles.meta}>{item.media_type==='movie'?'Filme':'Série'}{dateOf(item)?' • '+dateOf(item).slice(0,4):''}{typeof item.vote_average==='number'&&item.vote_average>0?' • ★ '+item.vote_average.toFixed(1):''}</Text><Text numberOfLines={3} style={styles.overview}>{item.overview||'Sinopse não disponível em português.'}</Text><Text style={styles.detailLink}>Ver detalhes ›</Text></View>
    </TouchableOpacity>)}
    {searched&&!loading&&!results.length?<View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum resultado encontrado</Text><Text style={styles.copy}>Tente outro nome ou confira a chave e a conexão.</Text></View>:null}
    {selected?<View style={styles.detail}>
      <TouchableOpacity onPress={()=>setSelected(null)} style={styles.close}><Text style={styles.detailLink}>Fechar ✕</Text></TouchableOpacity>
      <Text style={styles.detailTitle}>{selected.title}</Text><Text style={styles.meta}>{selected.media_type==='movie'?'Filme':'Série'}{dateOf(selected)?' • '+dateOf(selected).slice(0,4):''}</Text>
      {selected.poster_path?<Image source={{uri:IMAGE+selected.poster_path}} style={styles.detailPoster} resizeMode="cover"/>:null}
      <Text style={styles.overviewFull}>{selected.overview||'Sinopse não disponível.'}</Text>
      <TouchableOpacity onPress={()=>addToJourney(selected)} style={styles.addButton}><Text style={styles.addText}>＋ Adicionar à Minha Jornada</Text></TouchableOpacity>
    </View>:null}
    <Text style={styles.foot}>NEXUS MEDIA usa o TMDB apenas para informações e imagens de catálogo. Não é endossado nem certificado pelo TMDB. A busca não garante onde o conteúdo pode ser reproduzido.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1},kicker:{color:'#A78BFA',fontSize:9,fontWeight:'900',letterSpacing:1.2,marginBottom:7},title:{color:'#F7F4FC',fontSize:25,fontWeight:'900'},copy:{color:'#A39AAF',fontSize:11,lineHeight:17,marginTop:6,marginBottom:12},searchRow:{flexDirection:'row',gap:8,marginBottom:12},searchInput:{flex:1,color:'#FFF',backgroundColor:'#191624',borderWidth:1,borderColor:'#4B3470',borderRadius:12,paddingHorizontal:13,paddingVertical:12,fontSize:12},searchButton:{width:48,backgroundColor:'#7C3AED',borderRadius:12,alignItems:'center',justifyContent:'center'},searchButtonText:{color:'#FFF',fontSize:24},config:{backgroundColor:'#191624',borderWidth:1,borderColor:'#403052',borderRadius:13,padding:12,marginBottom:15},configHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},configTitle:{color:'#F4F0FA',fontSize:12,fontWeight:'900'},configAction:{color:'#C4B5FD',fontSize:10,fontWeight:'800'},configCopy:{color:'#A39AAF',fontSize:10,lineHeight:15,marginTop:8},keyInput:{color:'#FFF',backgroundColor:'#100E17',borderWidth:1,borderColor:'#4B3470',borderRadius:10,padding:11,fontSize:11,marginTop:10},saveButton:{backgroundColor:'#302247',borderRadius:9,padding:10,alignItems:'center',marginTop:8},saveText:{color:'#E9D5FF',fontSize:10,fontWeight:'900'},loading:{alignItems:'center',padding:20},section:{color:'#B8AEC9',fontSize:10,fontWeight:'900',letterSpacing:1.2,marginBottom:10},result:{flexDirection:'row',gap:11,backgroundColor:'#171421',borderWidth:1,borderColor:'#2B2638',borderRadius:12,padding:10,marginBottom:9},poster:{width:76,height:112,borderRadius:8,backgroundColor:'#302247'},noPoster:{alignItems:'center',justifyContent:'center'},resultTitle:{color:'#F4F0FA',fontSize:13,fontWeight:'900'},meta:{color:'#A78BFA',fontSize:9,marginTop:4},overview:{color:'#B8B0C4',fontSize:10,lineHeight:15,marginTop:7},detailLink:{color:'#C4B5FD',fontSize:10,fontWeight:'900',marginTop:7},empty:{padding:22,alignItems:'center',backgroundColor:'#15121E',borderRadius:13},emptyTitle:{color:'#FFF',fontWeight:'900',fontSize:14},detail:{backgroundColor:'#191624',borderWidth:1,borderColor:'#5B3A84',borderRadius:15,padding:14,marginTop:12},close:{alignItems:'flex-end'},detailTitle:{color:'#FFF',fontSize:19,fontWeight:'900',marginTop:4},detailPoster:{width:130,height:190,borderRadius:10,marginTop:12,alignSelf:'center'},overviewFull:{color:'#D7D0E0',fontSize:11,lineHeight:17,marginTop:12},addButton:{backgroundColor:'#7C3AED',borderRadius:10,padding:12,alignItems:'center',marginTop:14},addText:{color:'#FFF',fontSize:11,fontWeight:'900'},foot:{color:'#81788E',fontSize:9,lineHeight:15,marginTop:18}
});
