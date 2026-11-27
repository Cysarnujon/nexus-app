import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export type InfoSubTab = 'weather' | 'horoscope' | 'quotes' | 'feeds';

interface InfoHubViewProps {
  initialTab?: InfoSubTab;
  theme: EditorTheme;
  onOpenDrawer: () => void;
  onBackHome: () => void;
  onOpenInBrowser: (url: string, title: string) => void;
}

// ==========================================
// 1. PREVISÃO DO TEMPO (Open-Meteo Gratuita)
// ==========================================
interface WeatherState {
  cityLabel: string;
  tempC: number;
  apparentC: number;
  humidity: number;
  windKmh: number;
  precipProb: number;
  weatherCode: number;
  hourly: { hour: string; tempC: number; code: number; rainProb: number }[];
  daily: { dayLabel: string; maxC: number; minC: number; code: number; rainProb: number }[];
}

function weatherLabelAndIcon(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Céu limpo', icon: '☀️' };
  if (code <= 3) return { label: 'Parcialmente nublado', icon: '⛅' };
  if (code <= 48) return { label: 'Neblina', icon: '🌫️' };
  if (code <= 67) return { label: 'Chuva', icon: '🌧️' };
  if (code <= 77) return { label: 'Neve / Granizo', icon: '❄️' };
  if (code <= 82) return { label: 'Pancadas de chuva', icon: '🌦️' };
  return { label: 'Tempestade', icon: '⛈️' };
}

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ==========================================
// 2. HORÓSCOPO (12 Signos)
// ==========================================
const ZODIAC_SIGNS = [
  { key: 'aries', name: 'Áries', dates: '21/03 – 19/04', elem: 'Fogo', planet: 'Marte', icon: '♈' },
  { key: 'touro', name: 'Touro', dates: '20/04 – 20/05', elem: 'Terra', planet: 'Vênus', icon: '♉' },
  { key: 'gemeos', name: 'Gêmeos', dates: '21/05 – 20/06', elem: 'Ar', planet: 'Mercúrio', icon: '♊' },
  { key: 'cancer', name: 'Câncer', dates: '21/06 – 22/07', elem: 'Água', planet: 'Lua', icon: '♋' },
  { key: 'leao', name: 'Leão', dates: '23/07 – 22/08', elem: 'Fogo', planet: 'Sol', icon: '♌' },
  { key: 'virgem', name: 'Virgem', dates: '23/08 – 22/09', elem: 'Terra', planet: 'Mercúrio', icon: '♍' },
  { key: 'libra', name: 'Libra', dates: '23/09 – 22/10', elem: 'Ar', planet: 'Vênus', icon: '♎' },
  { key: 'escorpiao', name: 'Escorpião', dates: '23/10 – 21/11', elem: 'Água', planet: 'Plutão', icon: '♏' },
  { key: 'sagitario', name: 'Sagitário', dates: '22/11 – 21/12', elem: 'Fogo', planet: 'Júpiter', icon: '♐' },
  { key: 'capricornio', name: 'Capricórnio', dates: '22/12 – 19/01', elem: 'Terra', planet: 'Saturno', icon: '♑' },
  { key: 'aquario', name: 'Aquário', dates: '20/01 – 18/02', elem: 'Ar', planet: 'Urano', icon: '♒' },
  { key: 'peixes', name: 'Peixes', dates: '19/02 – 20/03', elem: 'Água', planet: 'Netuno', icon: '♓' },
];

const HOROSCOPE_TEMPLATES = [
  'O momento pede clareza antes de tomar decisões importantes. Dê um passo atrás, observe os sinais ao seu redor e confie na sua intuição prática para organizar prioridades.',
  'Excelente energia para tirar ideias do papel e avançar em projetos pessoais. Conversas produtivas podem abrir portas inesperadas ainda hoje.',
  'Foque em manter o equilíbrio entre produtividade e descanso. Pequenos ajustes na sua rotina vão trazer grande alívio mental e foco renovado.',
  'Sua criatividade estará em alta. Aproveite para anotar insights, revisar metas financeiras e fortalecer laços com quem compartilha dos mesmos valores.',
];

// ==========================================
// 3. COTAÇÕES (AwesomeAPI)
// ==========================================
interface QuoteAsset {
  id: string;
  code: string;
  name: string;
  category: 'moeda' | 'cripto' | 'acao';
  priceBrl: number;
  pctChange: number;
  high: number;
  low: number;
  history7d: number[];
}

const DEFAULT_QUOTES: QuoteAsset[] = [
  { id: 'USD-BRL', code: 'USD', name: 'Dólar Americano', category: 'moeda', priceBrl: 5.65, pctChange: -0.45, high: 5.72, low: 5.61, history7d: [5.74, 5.71, 5.72, 5.69, 5.68, 5.66, 5.65] },
  { id: 'EUR-BRL', code: 'EUR', name: 'Euro', category: 'moeda', priceBrl: 6.15, pctChange: 0.22, high: 6.19, low: 6.10, history7d: [6.09, 6.11, 6.12, 6.10, 6.13, 6.14, 6.15] },
  { id: 'GBP-BRL', code: 'GBP', name: 'Libra Esterlina', category: 'moeda', priceBrl: 7.28, pctChange: 0.18, high: 7.31, low: 7.22, history7d: [7.20, 7.22, 7.24, 7.25, 7.26, 7.27, 7.28] },
  { id: 'BTC-BRL', code: 'BTC', name: 'Bitcoin', category: 'cripto', priceBrl: 525000, pctChange: 1.85, high: 532000, low: 512000, history7d: [498000, 504000, 510000, 508000, 515000, 520000, 525000] },
  { id: 'ETH-BRL', code: 'ETH', name: 'Ethereum', category: 'cripto', priceBrl: 18400, pctChange: 1.12, high: 18750, low: 17900, history7d: [17500, 17800, 17950, 18100, 18050, 18250, 18400] },
  { id: 'PETR4', code: 'PETR4', name: 'Petrobras PN', category: 'acao', priceBrl: 38.4, pctChange: 0.65, high: 38.9, low: 37.9, history7d: [37.4, 37.8, 37.9, 38.1, 38.0, 38.2, 38.4] },
  { id: 'VALE3', code: 'VALE3', name: 'Vale ON', category: 'acao', priceBrl: 61.2, pctChange: -0.35, high: 62.0, low: 60.8, history7d: [62.1, 61.8, 61.9, 61.5, 61.6, 61.4, 61.2] },
];

// ==========================================
// 4. FEEDS RSS
// ==========================================
interface RssSource {
  id: string;
  name: string;
  url: string;
}

interface RssArticle {
  id: string;
  sourceName: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

const DEFAULT_RSS_SOURCES: RssSource[] = [
  { id: 'g1', name: 'G1 Brasil', url: 'https://g1.globo.com/rss/g1/' },
  { id: 'tb', name: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },
];

function cleanXmlText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXml(xml: string, sourceName: string): RssArticle[] {
  const items: RssArticle[] = [];
  const itemRegex = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = itemRegex.exec(xml)) !== null && idx < 12) {
    const block = match[1];
    const titleMatch = block.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i);
    const linkMatch = block.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i);
    const descMatch = block.match(/<description[\s\S]*?>([\s\S]*?)<\/description>/i);
    const dateMatch = block.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i);

    const title = cleanXmlText(titleMatch?.[1] ?? '');
    const link = cleanXmlText(linkMatch?.[1] ?? '');
    const desc = cleanXmlText(descMatch?.[1] ?? '');
    const pubDate = cleanXmlText(dateMatch?.[1] ?? '').slice(0, 16);

    if (title && link) {
      items.push({
        id: `${sourceName}-${idx}-${Date.now()}`,
        sourceName,
        title,
        description: desc.slice(0, 140),
        link,
        pubDate,
      });
      idx += 1;
    }
  }
  return items;
}

export default function InfoHubView({
  initialTab = 'weather',
  theme,
  onOpenDrawer,
  onBackHome,
  onOpenInBrowser,
}: InfoHubViewProps) {
  const [activeTab, setActiveTab] = useState<InfoSubTab>(initialTab);

  // Weather State
  const [cityName, setCityName] = useState<string>(
    () => getAppMeta('info_weather_city') || 'São Paulo'
  );
  const [isFahrenheit, setIsFahrenheit] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [cityDraft, setCityDraft] = useState('');
  const [weather, setWeather] = useState<WeatherState>({
    cityLabel: cityName,
    tempC: 23,
    apparentC: 24,
    humidity: 68,
    windKmh: 11,
    precipProb: 25,
    weatherCode: 2,
    hourly: [
      { hour: 'Agora', tempC: 23, code: 2, rainProb: 15 },
      { hour: '+2h', tempC: 24, code: 1, rainProb: 10 },
      { hour: '+4h', tempC: 22, code: 2, rainProb: 20 },
      { hour: '+6h', tempC: 19, code: 3, rainProb: 35 },
    ],
    daily: [
      { dayLabel: 'Hoje', maxC: 26, minC: 17, code: 2, rainProb: 30 },
      { dayLabel: 'Amanhã', maxC: 27, minC: 18, code: 1, rainProb: 15 },
      { dayLabel: 'Dia +2', maxC: 25, minC: 16, code: 61, rainProb: 60 },
      { dayLabel: 'Dia +3', maxC: 28, minC: 18, code: 0, rainProb: 5 },
    ],
  });

  // Horoscope State
  const [signIdx, setSignIdx] = useState<number>(() => {
    const raw = getAppMeta('info_zodiac_idx');
    return raw ? Number(raw) || 6 : 6;
  });
  const [horoscopePeriod, setHoroscopePeriod] = useState<'today' | 'week' | 'month'>('today');
  const [signPickerVisible, setSignPickerVisible] = useState(false);

  // Quotes State
  const [quotes, setQuotes] = useState<QuoteAsset[]>(DEFAULT_QUOTES);
  const [quoteFilter, setQuoteFilter] = useState<'all' | 'moeda' | 'cripto' | 'acao'>('all');
  const [selectedQuoteId, setSelectedQuoteId] = useState('USD-BRL');
  const [convertAmount, setConvertAmount] = useState('100');
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Feeds State
  const [rssSources, setRssSources] = useState<RssSource[]>(() => {
    try {
      const raw = getAppMeta('info_rss_sources');
      return raw ? (JSON.parse(raw) as RssSource[]) : DEFAULT_RSS_SOURCES;
    } catch {
      return DEFAULT_RSS_SOURCES;
    }
  });
  const [articles, setArticles] = useState<RssArticle[]>([]);
  const [rssFilter, setRssFilter] = useState<string>('all');
  const [rssLoading, setRssLoading] = useState(false);
  const [addRssVisible, setAddRssVisible] = useState(false);
  const [newRssName, setNewRssName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchWeather = async (targetCity = cityName) => {
    setWeatherLoading(true);
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(targetCity)}&count=1&language=pt`
      );
      const geoJson = (await geoRes.json()) as {
        results?: { latitude: number; longitude: number; name: string; admin1?: string }[];
      };
      const place = geoJson.results?.[0];
      if (!place) {
        setWeatherLoading(false);
        return;
      }

      const label = place.admin1 ? `${place.name}, ${place.admin1}` : place.name;
      const fRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`
      );
      const fJson = (await fRes.json()) as {
        current?: {
          temperature_2m: number;
          relative_humidity_2m: number;
          apparent_temperature: number;
          weather_code: number;
          wind_speed_10m: number;
        };
        hourly?: {
          time: string[];
          temperature_2m: number[];
          weather_code: number[];
          precipitation_probability: number[];
        };
        daily?: {
          time: string[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          weather_code: number[];
          precipitation_probability_max: number[];
        };
      };

      const cur = fJson.current;
      const hr = fJson.hourly;
      const dy = fJson.daily;

      if (cur && hr && dy) {
        const nowHr = new Date().getHours();
        const hourlyItems = hr.time.slice(nowHr, nowHr + 8).map((t, i) => ({
          hour: `${t.slice(11, 13)}h`,
          tempC: Math.round(hr.temperature_2m[nowHr + i] ?? cur.temperature_2m),
          code: hr.weather_code[nowHr + i] ?? cur.weather_code,
          rainProb: hr.precipitation_probability[nowHr + i] ?? 0,
        }));

        const dailyItems = dy.time.slice(0, 4).map((t, i) => {
          const d = new Date(`${t}T12:00:00`);
          return {
            dayLabel: i === 0 ? 'Hoje' : WEEKDAYS_PT[d.getDay()],
            maxC: Math.round(dy.temperature_2m_max[i] ?? 25),
            minC: Math.round(dy.temperature_2m_min[i] ?? 16),
            code: dy.weather_code[i] ?? 0,
            rainProb: dy.precipitation_probability_max[i] ?? 0,
          };
        });

        setWeather({
          cityLabel: label,
          tempC: Math.round(cur.temperature_2m),
          apparentC: Math.round(cur.apparent_temperature),
          humidity: Math.round(cur.relative_humidity_2m),
          windKmh: Math.round(cur.wind_speed_10m),
          precipProb: dailyItems[0]?.rainProb ?? 0,
          weatherCode: cur.weather_code,
          hourly: hourlyItems,
          daily: dailyItems,
        });
      }
    } catch {
      // Mantém cache em caso de offline
    } finally {
      setWeatherLoading(false);
    }
  };

  const fetchQuotes = async () => {
    setQuotesLoading(true);
    try {
      const res = await fetch(
        'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL,ETH-BRL'
      );
      const data = (await res.json()) as Record<
        string,
        { code: string; name: string; bid: string; pctChange: string; high: string; low: string }
      >;

      const histRes = await fetch(
        'https://economia.awesomeapi.com.br/json/daily/USD-BRL/7'
      );
      const histArr = (await histRes.json()) as { bid: string }[];
      const usdHist = Array.isArray(histArr)
        ? histArr.map((h) => Number(h.bid) || 5.6).reverse()
        : DEFAULT_QUOTES[0].history7d;

      const pairs: { key: string; id: string; cat: 'moeda' | 'cripto' }[] = [
        { key: 'USDBRL', id: 'USD-BRL', cat: 'moeda' },
        { key: 'EURBRL', id: 'EUR-BRL', cat: 'moeda' },
        { key: 'GBPBRL', id: 'GBP-BRL', cat: 'moeda' },
        { key: 'BTCBRL', id: 'BTC-BRL', cat: 'cripto' },
        { key: 'ETHBRL', id: 'ETH-BRL', cat: 'cripto' },
      ];

      const updated = DEFAULT_QUOTES.map((q) => {
        const matchDef = pairs.find((p) => p.id === q.id);
        if (!matchDef || !data[matchDef.key]) return q;
        const item = data[matchDef.key];
        const bid = Number(item.bid) || q.priceBrl;
        return {
          ...q,
          priceBrl: bid,
          pctChange: Number(item.pctChange) || 0,
          high: Number(item.high) || bid,
          low: Number(item.low) || bid,
          history7d: q.id === 'USD-BRL' ? usdHist : q.history7d.slice(0, 6).concat(bid),
        };
      });
      setQuotes(updated);
    } catch {
      // Fallback offline
    } finally {
      setQuotesLoading(false);
    }
  };

  const fetchRssFeeds = async (sourcesList = rssSources) => {
    setRssLoading(true);
    try {
      const collected: RssArticle[] = [];
      for (const src of sourcesList) {
        try {
          const res = await fetch(src.url);
          const xml = await res.text();
          collected.push(...parseRssXml(xml, src.name));
        } catch {
          // Pula feed com erro
        }
      }
      setArticles(collected);
    } finally {
      setRssLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'weather') fetchWeather();
    if (activeTab === 'quotes') fetchQuotes();
    if (activeTab === 'feeds' && articles.length === 0) fetchRssFeeds();
  }, [activeTab]);

  const fmtTemp = (c: number) =>
    isFahrenheit ? `${Math.round((c * 9) / 5 + 32)}°F` : `${c}°`;

  const selectedSign = ZODIAC_SIGNS[signIdx] ?? ZODIAC_SIGNS[6];
  const horoscopeText = useMemo(() => {
    const daySeed = new Date().getDate() + signIdx + (horoscopePeriod === 'week' ? 1 : horoscopePeriod === 'month' ? 2 : 0);
    return HOROSCOPE_TEMPLATES[daySeed % HOROSCOPE_TEMPLATES.length];
  }, [signIdx, horoscopePeriod]);

  const activeQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) ?? quotes[0],
    [quotes, selectedQuoteId]
  );

  const visibleQuotes = useMemo(() => {
    if (quoteFilter === 'all') return quotes;
    return quotes.filter((q) => q.category === quoteFilter);
  }, [quotes, quoteFilter]);

  const visibleArticles = useMemo(() => {
    if (rssFilter === 'all') return articles;
    return articles.filter((a) => a.sourceName === rssFilter);
  }, [articles, rssFilter]);

  const headerTitle =
    activeTab === 'weather'
      ? 'Previsão do Tempo'
      : activeTab === 'horoscope'
      ? `Horóscopo - ${selectedSign.name}`
      : activeTab === 'quotes'
      ? 'Cotações & Finanças'
      : 'Feeds RSS';

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
        <Text style={{ flex: 1, color: theme.text, fontSize: 19, fontWeight: '800' }} numberOfLines={1}>
          {headerTitle}
        </Text>
        <TouchableOpacity onPress={onBackHome} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '700' }}>
            Início
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4 Abas Superiores */}
      <View
        style={[
          styles.subTabsBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        {(
          [
            { k: 'weather', l: 'Tempo' },
            { k: 'horoscope', l: selectedSign.name },
            { k: 'quotes', l: 'Cotações' },
            { k: 'feeds', l: 'Feeds' },
          ] as { k: InfoSubTab; l: string }[]
        ).map((t) => {
          const active = activeTab === t.k;
          return (
            <TouchableOpacity
              key={t.k}
              onPress={() => setActiveTab(t.k)}
              style={[
                styles.subTabBtn,
                active && { borderBottomWidth: 2.5, borderBottomColor: theme.accent },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.accent : theme.textDim,
                  fontSize: 13,
                  fontWeight: active ? '800' : '600',
                }}
              >
                {t.l}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.bodyScroll} keyboardShouldPersistTaps="handled">
        {/* ABA 1: TEMPO */}
        {activeTab === 'weather' && (
          <View style={{ gap: 14 }}>
            <View style={styles.rowBetween}>
              <TouchableOpacity
                onPress={() => {
                  setCityDraft(cityName);
                  setCityModalVisible(true);
                }}
                style={{ flex: 1 }}
              >
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>
                  📍 {weather.cityLabel}
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 12 }}>
                  Toque para trocar a cidade
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => fetchWeather()}>
                {weatherLoading ? (
                  <ActivityIndicator color={theme.accent} />
                ) : (
                  <Text style={{ color: theme.text, fontSize: 20 }}>↻</Text>
                )}
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 44, fontWeight: '800', color: theme.text }}>
                    {fmtTemp(weather.tempC)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsFahrenheit((f) => !f)}
                    style={[styles.miniPill, { backgroundColor: theme.surfaceAlt }]}
                  >
                    <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '800' }}>
                      °C | °F
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 26 }}>
                    {weatherLabelAndIcon(weather.weatherCode).icon}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                    {weatherLabelAndIcon(weather.weatherCode).label}
                  </Text>
                  <Text style={{ color: theme.textDim, fontSize: 11 }}>
                    Máx {fmtTemp(weather.daily[0]?.maxC ?? 25)} • Mín {fmtTemp(weather.daily[0]?.minC ?? 16)}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 16, marginTop: 16 }}
              >
                {weather.hourly.map((h, i) => (
                  <View key={`${h.hour}-${i}`} style={{ alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>
                      {fmtTemp(h.tempC)}
                    </Text>
                    <Text style={{ color: theme.accent, fontSize: 10 }}>
                      {h.rainProb}%
                    </Text>
                    <Text style={{ fontSize: 18 }}>
                      {weatherLabelAndIcon(h.code).icon}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 11 }}>
                      {h.hour}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {weather.daily.map((d, i) => (
                <View
                  key={d.dayLabel}
                  style={[
                    styles.dayBox,
                    {
                      backgroundColor: theme.surface,
                      borderColor: i === 0 ? theme.accent : theme.border,
                      borderWidth: i === 0 ? 1.5 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: i === 0 ? theme.accent : theme.text,
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {d.dayLabel}
                  </Text>
                  <Text style={{ fontSize: 20, marginVertical: 6 }}>💧</Text>
                  <Text style={{ color: theme.textDim, fontSize: 11 }}>
                    {fmtTemp(d.maxC)}/{fmtTemp(d.minC)}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border, gap: 10 },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={{ color: theme.textDim }}>Sensação térmica</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {fmtTemp(weather.apparentC)}
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={{ color: theme.textDim }}>Chance de chuva</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {weather.precipProb}%
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={{ color: theme.textDim }}>Vento</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {weather.windKmh} km/h
                </Text>
              </View>
              <View style={styles.rowBetween}>
                <Text style={{ color: theme.textDim }}>Umidade</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {weather.humidity}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ABA 2: HORÓSCOPO */}
        {activeTab === 'horoscope' && (
          <View style={{ gap: 14 }}>
            <TouchableOpacity
              onPress={() => setSignPickerVisible(true)}
              style={[
                styles.card,
                styles.rowBetween,
                { backgroundColor: theme.surface, borderColor: theme.accent },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[styles.signCircle, { backgroundColor: theme.accent }]}>
                  <Text style={{ fontSize: 24, color: '#FFF' }}>{selectedSign.icon}</Text>
                </View>
                <View>
                  <Text style={{ color: theme.accent, fontSize: 20, fontWeight: '800' }}>
                    {selectedSign.name}
                  </Text>
                  <Text style={{ color: theme.textDim, fontSize: 12 }}>
                    {selectedSign.dates} • {selectedSign.elem} • {selectedSign.planet}
                  </Text>
                </View>
              </View>
              <Text style={{ color: theme.accent, fontSize: 18, fontWeight: '800' }}>
                ⇄
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {(
                [
                  { k: 'today', l: 'Hoje' },
                  { k: 'week', l: 'Semana' },
                  { k: 'month', l: 'Mês' },
                ] as const
              ).map((p) => {
                const active = horoscopePeriod === p.k;
                return (
                  <TouchableOpacity
                    key={p.k}
                    onPress={() => setHoroscopePeriod(p.k)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? theme.surfaceAlt : theme.surface,
                        borderColor: active ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? theme.accent : theme.textDim, fontWeight: '700' }}>
                      {active ? '✓ ' : ''}
                      {p.l}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={[styles.rowBetween, { marginBottom: 10 }]}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                  Previsão ({horoscopePeriod === 'today' ? 'Hoje' : horoscopePeriod === 'week' ? 'Semana' : 'Mês'})
                </Text>
                <Text style={{ color: theme.textDim, fontSize: 12 }}>
                  {new Date().toLocaleDateString('pt-BR')}
                </Text>
              </View>
              <Text style={{ color: theme.textMuted, fontSize: 15, lineHeight: 23 }}>
                {horoscopeText}
              </Text>
            </View>
          </View>
        )}

        {/* ABA 3: COTAÇÕES */}
        {activeTab === 'quotes' && (
          <View style={{ gap: 14 }}>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }}>
                  {activeQuote.code} • {activeQuote.name}
                </Text>
                <TouchableOpacity onPress={fetchQuotes}>
                  {quotesLoading ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Text style={{ color: theme.text, fontSize: 18 }}>↻</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 }}>
                <Text style={{ color: theme.text, fontSize: 30, fontWeight: '800' }}>
                  R$ {activeQuote.priceBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <View
                  style={[
                    styles.pctBadge,
                    {
                      backgroundColor:
                        activeQuote.pctChange >= 0
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: activeQuote.pctChange >= 0 ? '#10B981' : '#EF4444',
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    {activeQuote.pctChange >= 0 ? '+' : ''}
                    {activeQuote.pctChange.toFixed(2)}%
                  </Text>
                </View>
              </View>

              <Text style={{ color: theme.textDim, fontSize: 12, marginBottom: 10 }}>
                Máx: R$ {activeQuote.high.toFixed(2)} • Mín: R$ {activeQuote.low.toFixed(2)}
              </Text>

              {/* Mini Gráfico de Barras 7 dias */}
              <View style={styles.miniChartRow}>
                {activeQuote.history7d.map((val, idx) => {
                  const minV = Math.min(...activeQuote.history7d);
                  const maxV = Math.max(...activeQuote.history7d);
                  const span = Math.max(0.0001, maxV - minV);
                  const hPct = 25 + Math.round(((val - minV) / span) * 70);
                  return (
                    <View key={idx} style={styles.miniBarCol}>
                      <View
                        style={{
                          width: 14,
                          height: `${hPct}%`,
                          backgroundColor:
                            activeQuote.pctChange >= 0 ? '#10B981' : '#EF4444',
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
              <Text style={{ color: theme.textDim, fontSize: 11, marginBottom: 10 }}>
                Últimos 7 dias
              </Text>

              {/* Conversor */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextInput
                  style={[
                    styles.convInput,
                    { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                  ]}
                  value={convertAmount}
                  onChangeText={setConvertAmount}
                  keyboardType="numeric"
                />
                <Text style={{ color: theme.textDim, fontWeight: '700' }}>
                  {activeQuote.code} →
                </Text>
                <Text style={{ color: theme.accent, fontSize: 17, fontWeight: '800' }}>
                  R$ {((Number(convertAmount.replace(',', '.')) || 0) * activeQuote.priceBrl).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(
                [
                  { k: 'all', l: 'Tudo' },
                  { k: 'moeda', l: 'Moeda' },
                  { k: 'cripto', l: 'Cripto' },
                  { k: 'acao', l: 'Ação B3' },
                ] as const
              ).map((f) => (
                <TouchableOpacity
                  key={f.k}
                  onPress={() => setQuoteFilter(f.k)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: quoteFilter === f.k ? theme.surfaceAlt : theme.surface,
                      borderColor: quoteFilter === f.k ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: quoteFilter === f.k ? theme.accent : theme.textMuted, fontWeight: '700', fontSize: 12 }}>
                    {f.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {visibleQuotes.map((q) => (
              <TouchableOpacity
                key={q.id}
                onPress={() => setSelectedQuoteId(q.id)}
                style={[
                  styles.card,
                  styles.rowBetween,
                  {
                    backgroundColor: theme.surface,
                    borderColor: selectedQuoteId === q.id ? theme.accent : theme.border,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.codeBadge, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800' }}>
                      {q.code}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
                      {q.name}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 11 }}>
                      {q.code} • {q.category.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: theme.text, fontWeight: '800', fontSize: 15 }}>
                    R$ {q.priceBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text
                    style={{
                      color: q.pctChange >= 0 ? '#10B981' : '#EF4444',
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {q.pctChange >= 0 ? '+' : ''}
                    {q.pctChange.toFixed(2)}%
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ABA 4: FEEDS RSS */}
        {activeTab === 'feeds' && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setRssFilter('all')}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: rssFilter === 'all' ? theme.surfaceAlt : theme.surface,
                      borderColor: rssFilter === 'all' ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={{ color: rssFilter === 'all' ? theme.accent : theme.textMuted, fontWeight: '700', fontSize: 12 }}>
                    Todos
                  </Text>
                </TouchableOpacity>
                {rssSources.map((src) => (
                  <TouchableOpacity
                    key={src.id}
                    onPress={() => setRssFilter(src.name)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: rssFilter === src.name ? theme.surfaceAlt : theme.surface,
                        borderColor: rssFilter === src.name ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text style={{ color: rssFilter === src.name ? theme.accent : theme.textMuted, fontWeight: '700', fontSize: 12 }}>
                      {src.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setAddRssVisible(true)}
                style={[styles.miniPill, { backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={{ color: theme.accent, fontWeight: '800' }}>🔗+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => fetchRssFeeds()}
                style={[styles.miniPill, { backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={{ color: theme.text, fontWeight: '800' }}>↻</Text>
              </TouchableOpacity>
            </View>

            {rssLoading ? (
              <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 30 }} />
            ) : visibleArticles.length === 0 ? (
              <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={{ color: theme.textDim, textAlign: 'center' }}>
                  Nenhuma notícia carregada. Toque em ↻ para atualizar ou verifique sua conexão.
                </Text>
              </View>
            ) : (
              visibleArticles.map((art) => (
                <TouchableOpacity
                  key={art.id}
                  onPress={() => onOpenInBrowser(art.link, art.title)}
                  style={[
                    styles.card,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '800' }}>
                      {art.sourceName}
                    </Text>
                    <Text style={{ color: theme.textDim, fontSize: 11 }}>
                      {art.pubDate}
                    </Text>
                  </View>
                  <Text style={{ color: theme.text, fontSize: 15, fontWeight: '800', marginVertical: 5 }}>
                    {art.title}
                  </Text>
                  {art.description ? (
                    <Text style={{ color: theme.textMuted, fontSize: 13 }} numberOfLines={2}>
                      {art.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal Trocar Cidade */}
      <Modal
        visible={cityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              📍 Cidade da Previsão
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={cityDraft}
              onChangeText={setCityDraft}
              placeholder="Ex: Florianópolis, Curitiba, São Paulo..."
              placeholderTextColor={theme.textDim}
              autoFocus
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setCityModalVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const c = cityDraft.trim();
                  if (!c) return;
                  setCityName(c);
                  setAppMeta('info_weather_city', c);
                  setCityModalVisible(false);
                  fetchWeather(c);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Buscar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Escolher Signo */}
      <Modal
        visible={signPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { maxHeight: '78%', backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              ✨ Escolha seu Signo
            </Text>
            <ScrollView>
              {ZODIAC_SIGNS.map((s, idx) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => {
                    setSignIdx(idx);
                    setAppMeta('info_zodiac_idx', String(idx));
                    setSignPickerVisible(false);
                  }}
                  style={[
                    styles.signOptionRow,
                    { backgroundColor: idx === signIdx ? theme.accent : theme.surfaceAlt },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{s.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>{s.name}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                      {s.dates} • {s.elem}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setSignPickerVisible(false)} style={{ alignItems: 'center', paddingTop: 8 }}>
              <Text style={{ color: theme.textDim }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Adicionar RSS */}
      <Modal
        visible={addRssVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddRssVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              📡 Adicionar Feed RSS
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={newRssName}
              onChangeText={setNewRssName}
              placeholder="Nome do site (ex: UOL, Canaltech)"
              placeholderTextColor={theme.textDim}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text }]}
              value={newRssUrl}
              onChangeText={setNewRssUrl}
              placeholder="URL do RSS (https://...)"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity onPress={() => setAddRssVisible(false)} style={{ padding: 8 }}>
                <Text style={{ color: theme.textDim }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const name = newRssName.trim();
                  const url = newRssUrl.trim();
                  if (!name || !url) {
                    Alert.alert('Preencha os campos');
                    return;
                  }
                  const next = [...rssSources, { id: `rss-${Date.now()}`, name, url }];
                  setRssSources(next);
                  setAppMeta('info_rss_sources', JSON.stringify(next));
                  setNewRssName('');
                  setNewRssUrl('');
                  setAddRssVisible(false);
                  fetchRssFeeds(next);
                }}
                style={[styles.saveBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar</Text>
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
  subTabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  subTabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
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
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  dayBox: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  signCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pctBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  miniChartRow: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  miniBarCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  convInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 90,
    fontSize: 15,
    fontWeight: '700',
  },
  codeBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 10,
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  signOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
    borderRadius: 10,
    marginBottom: 6,
    gap: 12,
  },
});
