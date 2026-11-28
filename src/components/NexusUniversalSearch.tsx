import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getAppMeta, setAppMeta } from '../database/db';

type JellyfinItem = {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  ImageTags?: { Primary?: string };
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
};
type ServerConfig = { url: string; userId: string; token: string; username: string };
const readConfig = (): ServerConfig => {
  try { const raw=getAppMeta('nexus_jellyfin_config'); const parsed=raw?JSON.parse(raw):null; return parsed&&parsed.url&&parsed.userId&&parsed.token?parsed:{url:'',userId:'',token:'',username:''}; }
  catch { return {url:'',userId:'',token:'',username:''}; }
};
const readJourney = (): any[] => { try { const v=getAppMeta('nexus_media_journey'); const p=v?JSON.parse(v):[]; return Array.isArray(p)?p:[]; } catch { return []; } };
const cleanUrl = (value:string) => value.trim().replace(/\/+$/,'');
const authHeader = (token:string) => 'MediaBrowser Client="Nexus Media", Device="Android", DeviceId="nexus-media", Version="1.0.0", Token="'+token+'"';

export default function NexusUniversalSearch() {
  const saved=readConfig();
  const [serverUrl,setServerUrl]=useState(saved.url);
  const [username,setUsername]=useState(saved.username);
  const [password,setPassword]=useState('');
  const [config,setConfig]=useState<ServerConfig>(saved);
  const [showConfig,setShowConfig]=useState(!saved.token);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'Todos'|'Filmes'|'Séries'|'Episódios'>('Todos');
  const [results,setResults]=useState<JellyfinItem[]>([]);
  const [loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false);
  const [selected,setSelected]=useState<JellyfinItem|null>(null);

  const connect=async()=>{
    const url=cleanUrl(serverUrl);
    if(!/^https?:\/\//i.test(url)){Alert.alert('Endereço inválido','Informe o endereço completo do Jellyfin, começando com http:// ou https://.');return;}
    if(!username.trim()||!password){Alert.alert('Dados incompletos','Informe seu usuário e sua senha do Jellyfin.');return;}
    setLoading(true);
    try{
      const response=await fetch(url+'/Users/AuthenticateByName',{method:'POST',headers:{'Content-Type':'application/json','X-Emby-Authorization':'MediaBrowser Client="Nexus Media", Device="Android", DeviceId="nexus-media", Version="1.0.0"'},body:JSON.stringify({Username:username.trim(),Pw:password})});
      if(!response.ok) throw new Error(response.status===401?'Usuário ou senha incorretos.':'O Jellyfin respondeu com HTTP '+response.status+'. Confira o endereço e se o servidor está acessível.');
      const data=await response.json();
      if(!data.AccessToken||!data.User?.Id) throw new Error('O servidor não retornou um token de acesso válido.');
      const next={url,userId:data.User.Id,token:data.AccessToken,username:username.trim()};
      setAppMeta('nexus_jellyfin_config',JSON.stringify(next));
      setConfig(next);setPassword('');setShowConfig(false);
      Alert.alert('Jellyfin conectado','Conexão realizada. Agora você pode pesquisar sua biblioteca.');
    }catch(e:any){Alert.alert('Não foi possível conectar',e?.message||'Verifique a rede e os dados do servidor.');}
    finally{setLoading(false);}
  };

  const disconnect=()=>{
    Alert.alert('Desconectar Jellyfin?','O endereço e o token salvos neste aparelho serão apagados.',[
      {text:'Cancelar',style:'cancel'},
      {text:'Desconectar',style:'destructive',onPress:()=>{const empty={url:'',userId:'',token:'',username:''};setAppMeta('nexus_jellyfin_config',JSON.stringify(empty));setConfig(empty);setServerUrl('');setUsername('');setResults([]);setSelected(null);setSearched(false);setShowConfig(true);}}
    ]);
  };

  const search=async()=>{
    if(!config.token){setShowConfig(true);Alert.alert('Conecte o Jellyfin','Configure o endereço do seu servidor e entre com sua conta.');return;}
    if(!query.trim()){Alert.alert('Digite uma pesquisa','Informe o nome de um filme, série ou episódio.');return;}
    setLoading(true);setSearched(true);setSelected(null);
    try{
      const types=filter==='Filmes'?'Movie':filter==='Séries'?'Series':filter==='Episódios'?'Episode':'Movie,Series,Episode';
      const params='Recursive=true&SearchTerm='+encodeURIComponent(query.trim())+'&IncludeItemTypes='+encodeURIComponent(types)+'&Fields=Overview,Genres,DateCreated,ProviderIds&ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop&Limit=60';
      const response=await fetch(config.url+'/Users/'+encodeURIComponent(config.userId)+'/Items?'+params,{headers:{'X-Emby-Token':config.token,'X-Emby-Authorization':authHeader(config.token),Accept:'application/json'}});
      if(response.status===401||response.status===403) throw new Error('A sessão do Jellyfin expirou ou não tem permissão. Desconecte e conecte novamente.');
      if(!response.ok) throw new Error('Erro ao consultar a biblioteca (HTTP '+response.status+').');
      const data=await response.json();
      setResults(Array.isArray(data.Items)?data.Items:[]);
    }catch(e:any){Alert.alert('Falha na busca',e?.message||'Verifique se o servidor está online.');setResults([]);}
    finally{setLoading(false);}
  };

  const imageUrl=(item:JellyfinItem)=>item.ImageTags?.Primary?config.url+'/Items/'+item.Id+'/Images/Primary?maxWidth=260&tag='+encodeURIComponent(item.ImageTags.Primary)+'&api_key='+encodeURIComponent(config.token):'';
  const addToJourney=(item:JellyfinItem)=>{
    const items=readJourney();
    if(items.some(x=>String(x.jellyfinId||'')===String(item.Id))){Alert.alert('Já está na jornada','Esse conteúdo já foi adicionado.');return;}
    const category=item.Type==='Movie'?'Filme':item.Type==='Episode'?'Série':/anime/i.test(item.Name)?'Anime':'Série';
    const title=item.Type==='Episode'&&item.SeriesName?item.SeriesName+' — '+item.Name:item.Name;
    const next={id:String(Date.now()),title,category,status:'Quero assistir',season:item.ParentIndexNumber?String(item.ParentIndexNumber):'',episode:item.IndexNumber?String(item.IndexNumber):'',rating:'',notes:'Adicionado pela biblioteca Jellyfin • ID: '+item.Id,updatedAt:Date.now(),jellyfinId:item.Id};
    setAppMeta('nexus_media_journey',JSON.stringify([next,...items]));
    Alert.alert('Adicionado à Minha Jornada',title+' foi salvo na sua lista.');
  };

  const typeLabel=(type:string)=>type==='Movie'?'Filme':type==='Series'?'Série':type==='Episode'?'Episódio':type;
  return <ScrollView style={styles.root} contentContainerStyle={{paddingBottom:30}} keyboardShouldPersistTaps="handled">
    <Text style={styles.kicker}>NEXUS MEDIA • SUA BIBLIOTECA</Text>
    <Text style={styles.title}>Buscar no Jellyfin</Text>
    <Text style={styles.copy}>Pesquise somente os filmes, séries e episódios disponíveis no seu servidor Jellyfin. Não usamos TMDB, IMDb nem catálogos externos.</Text>
    <View style={styles.connection}>
      <View style={{flex:1}}><Text style={styles.connectionTitle}>{config.token?'● Jellyfin conectado':'○ Jellyfin não conectado'}</Text><Text style={styles.connectionSub}>{config.token?config.url:'Configure seu servidor para começar'}</Text></View>
      <TouchableOpacity onPress={()=>setShowConfig(v=>!v)} style={styles.smallButton}><Text style={styles.smallButtonText}>{showConfig?'Fechar':'Configurar'}</Text></TouchableOpacity>
    </View>
    {showConfig?<View style={styles.config}>
      <Text style={styles.configTitle}>Conectar ao seu servidor</Text>
      <Text style={styles.configCopy}>Use o endereço local ou remoto do seu Jellyfin, por exemplo http://192.168.0.10:8096. O celular precisa conseguir acessar esse endereço. Sua senha é usada apenas para autenticar e não é salva pelo Nexus.</Text>
      <TextInput value={serverUrl} onChangeText={setServerUrl} placeholder="Endereço do servidor (ex.: http://192.168.0.10:8096)" placeholderTextColor="#898397" autoCapitalize="none" keyboardType="url" style={styles.input}/>
      <TextInput value={username} onChangeText={setUsername} placeholder="Usuário Jellyfin" placeholderTextColor="#898397" autoCapitalize="none" style={styles.input}/>
      <TextInput value={password} onChangeText={setPassword} placeholder="Senha Jellyfin" placeholderTextColor="#898397" secureTextEntry style={styles.input}/>
      <TouchableOpacity onPress={connect} disabled={loading} style={styles.primary}><Text style={styles.primaryText}>{loading?'Conectando…':'Conectar Jellyfin'}</Text></TouchableOpacity>
      {!!config.token&&<TouchableOpacity onPress={disconnect} style={styles.disconnect}><Text style={styles.disconnectText}>Desconectar e apagar acesso salvo</Text></TouchableOpacity>}
    </View>:null}
    <View style={styles.searchRow}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" placeholder="Buscar na sua biblioteca…" placeholderTextColor="#898397" style={styles.searchInput}/><TouchableOpacity onPress={search} disabled={loading} style={styles.searchButton}><Text style={styles.searchButtonText}>⌕</Text></TouchableOpacity></View>
    <View style={styles.filters}>{(['Todos','Filmes','Séries','Episódios'] as const).map(x=><TouchableOpacity key={x} onPress={()=>setFilter(x)} style={[styles.filter,x===filter&&styles.filterActive]}><Text style={[styles.filterText,x===filter&&styles.filterTextActive]}>{x}</Text></TouchableOpacity>)}</View>
    {loading?<View style={styles.loading}><ActivityIndicator color="#A78BFA"/><Text style={styles.copy}>Consultando seu Jellyfin…</Text></View>:null}
    {searched&&!loading?<Text style={styles.section}>RESULTADOS • {results.length}</Text>:null}
    {results.map(item=><TouchableOpacity key={item.Id} onPress={()=>setSelected(item)} style={styles.result}>
      {imageUrl(item)?<Image source={{uri:imageUrl(item)}} style={styles.poster}/>:<View style={[styles.poster,styles.noPoster]}><Text style={{fontSize:22}}>🎬</Text></View>}
      <View style={{flex:1}}><Text style={styles.resultTitle}>{item.Name}</Text><Text style={styles.meta}>{typeLabel(item.Type)}{item.ProductionYear?' • '+item.ProductionYear:''}{typeof item.CommunityRating==='number'?' • ★ '+item.CommunityRating.toFixed(1):''}</Text><Text numberOfLines={3} style={styles.overview}>{item.Overview||'Sem sinopse cadastrada no Jellyfin.'}</Text><Text style={styles.detailLink}>Ver detalhes ›</Text></View>
    </TouchableOpacity>)}
    {searched&&!loading&&!results.length?<View style={styles.empty}><Text style={styles.emptyTitle}>Nenhum resultado encontrado</Text><Text style={styles.copy}>Esse título não foi localizado na biblioteca do Jellyfin. Confira se a mídia foi adicionada ao servidor e tente outro nome.</Text></View>:null}
    {selected?<View style={styles.detail}>
      <TouchableOpacity onPress={()=>setSelected(null)} style={styles.close}><Text style={styles.detailLink}>Fechar ✕</Text></TouchableOpacity>
      <Text style={styles.detailTitle}>{selected.Name}</Text><Text style={styles.meta}>{typeLabel(selected.Type)}{selected.ProductionYear?' • '+selected.ProductionYear:''}</Text>
      {imageUrl(selected)?<Image source={{uri:imageUrl(selected)}} style={styles.detailPoster} resizeMode="cover"/>:null}
      <Text style={styles.overviewFull}>{selected.Overview||'Sinopse não cadastrada no Jellyfin.'}</Text>
      <TouchableOpacity onPress={()=>addToJourney(selected)} style={styles.addButton}><Text style={styles.addText}>＋ Adicionar à Minha Jornada</Text></TouchableOpacity>
    </View>:null}
    <Text style={styles.foot}>O Nexus consulta apenas seu servidor Jellyfin. Capas, sinopses e avaliações dependem dos metadados existentes na biblioteca. A reprodução continuará sendo feita pelo Jellyfin ou por um player compatível.</Text>
  </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1},kicker:{color:'#A78BFA',fontSize:9,fontWeight:'900',letterSpacing:1.2,marginBottom:7},title:{color:'#F7F4FC',fontSize:25,fontWeight:'900'},copy:{color:'#A39AAF',fontSize:11,lineHeight:17,marginTop:6,marginBottom:12},connection:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#191624',borderWidth:1,borderColor:'#403052',borderRadius:13,padding:12,marginBottom:12},connectionTitle:{color:'#F4F0FA',fontSize:12,fontWeight:'900'},connectionSub:{color:'#A39AAF',fontSize:9,marginTop:4},smallButton:{backgroundColor:'#302247',paddingHorizontal:12,paddingVertical:9,borderRadius:9},smallButtonText:{color:'#E9D5FF',fontSize:10,fontWeight:'900'},config:{backgroundColor:'#191624',borderWidth:1,borderColor:'#403052',borderRadius:13,padding:12,marginBottom:14},configTitle:{color:'#F4F0FA',fontSize:13,fontWeight:'900'},configCopy:{color:'#A39AAF',fontSize:10,lineHeight:15,marginTop:7,marginBottom:10},input:{color:'#FFF',backgroundColor:'#100E17',borderWidth:1,borderColor:'#4B3470',borderRadius:10,padding:11,fontSize:11,marginBottom:8},primary:{backgroundColor:'#7C3AED',borderRadius:10,padding:12,alignItems:'center',marginTop:2},primaryText:{color:'#FFF',fontSize:11,fontWeight:'900'},disconnect:{alignItems:'center',padding:9,marginTop:5},disconnectText:{color:'#FCA5A5',fontSize:10,fontWeight:'800'},searchRow:{flexDirection:'row',gap:8,marginBottom:10},searchInput:{flex:1,color:'#FFF',backgroundColor:'#191624',borderWidth:1,borderColor:'#4B3470',borderRadius:12,paddingHorizontal:13,paddingVertical:12,fontSize:12},searchButton:{width:48,backgroundColor:'#7C3AED',borderRadius:12,alignItems:'center',justifyContent:'center'},searchButtonText:{color:'#FFF',fontSize:24},filters:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:14},filter:{paddingHorizontal:10,paddingVertical:7,borderRadius:18,backgroundColor:'#242039',borderWidth:1,borderColor:'#3B3448'},filterActive:{backgroundColor:'#5B21B6',borderColor:'#A78BFA'},filterText:{color:'#C4B5D2',fontSize:9,fontWeight:'700'},filterTextActive:{color:'#FFF'},loading:{alignItems:'center',padding:20},section:{color:'#B8AEC9',fontSize:10,fontWeight:'900',letterSpacing:1.2,marginBottom:10},result:{flexDirection:'row',gap:11,backgroundColor:'#171421',borderWidth:1,borderColor:'#2B2638',borderRadius:12,padding:10,marginBottom:9},poster:{width:76,height:112,borderRadius:8,backgroundColor:'#302247'},noPoster:{alignItems:'center',justifyContent:'center'},resultTitle:{color:'#F4F0FA',fontSize:13,fontWeight:'900'},meta:{color:'#A78BFA',fontSize:9,marginTop:4},overview:{color:'#B8B0C4',fontSize:10,lineHeight:15,marginTop:7},detailLink:{color:'#C4B5FD',fontSize:10,fontWeight:'900',marginTop:7},empty:{padding:22,alignItems:'center',backgroundColor:'#15121E',borderRadius:13},emptyTitle:{color:'#FFF',fontWeight:'900',fontSize:14},detail:{backgroundColor:'#191624',borderWidth:1,borderColor:'#5B3A84',borderRadius:15,padding:14,marginTop:12},close:{alignItems:'flex-end'},detailTitle:{color:'#FFF',fontSize:19,fontWeight:'900',marginTop:4},detailPoster:{width:130,height:190,borderRadius:10,marginTop:12,alignSelf:'center'},overviewFull:{color:'#D7D0E0',fontSize:11,lineHeight:17,marginTop:12},addButton:{backgroundColor:'#7C3AED',borderRadius:10,padding:12,alignItems:'center',marginTop:14},addText:{color:'#FFF',fontSize:11,fontWeight:'900'},foot:{color:'#81788E',fontSize:9,lineHeight:15,marginTop:18}
});
