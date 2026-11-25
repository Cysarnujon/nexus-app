import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  WebView,
  WebViewMessageEvent,
  WebViewNavigation,
} from 'react-native-webview';
import { NexusNode } from '../database/db';
import { EditorTheme, extractPlainTextFromContent } from '../editor/blocks';

interface InAppBrowserProps {
  initialUrl: string;
  initialTitle: string;
  sourceId: string;
  sourceName: string;
  sourceIcon: string;
  initialQuery: string;
  nodes: NexusNode[];
  theme: EditorTheme;
  onClose: () => void;
  onSaveSearchBookmark: (params: {
    query: string;
    url: string;
    sourceId: string;
    sourceName: string;
    sourceIcon: string;
  }) => void;
  onSaveLinkToSpace: (params: {
    title: string;
    url: string;
    targetNodeId: string | null;
    mode: 'new_page' | 'append_block';
    tagsText: string;
  }) => void;
}

const LONG_PRESS_SCRIPT = `
(function() {
  if (window.__nexusLongPressInstalled) return;
  window.__nexusLongPressInstalled = true;

  var pressTimer = null;
  var startX = 0;
  var startY = 0;

  function findAnchor(el) {
    while (el && el !== document.body) {
      if (el.tagName && el.tagName.toLowerCase() === 'a' && el.href) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function sendLink(anchor) {
    if (!anchor || !anchor.href) return;
    var text = (anchor.innerText || anchor.getAttribute('aria-label') || anchor.title || '').trim();
    if (!text) text = anchor.href;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'LONG_PRESS_LINK',
      url: anchor.href,
      title: text.slice(0, 120)
    }));
  }

  document.addEventListener('contextmenu', function(e) {
    var anchor = findAnchor(e.target);
    if (anchor) {
      e.preventDefault();
      sendLink(anchor);
    }
  }, true);

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return;
    var anchor = findAnchor(e.target);
    if (!anchor) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pressTimer = setTimeout(function() {
      sendLink(anchor);
      pressTimer = null;
    }, 520);
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!pressTimer || e.touches.length !== 1) return;
    var dx = Math.abs(e.touches[0].clientX - startX);
    var dy = Math.abs(e.touches[0].clientY - startY);
    if (dx > 12 || dy > 12) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }, { passive: true });

  document.addEventListener('touchend', function() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }, { passive: true });
})();
true;
`;

export default function InAppBrowser({
  initialUrl,
  initialTitle,
  sourceId,
  sourceName,
  sourceIcon,
  initialQuery,
  nodes,
  theme,
  onClose,
  onSaveSearchBookmark,
  onSaveLinkToSpace,
}: InAppBrowserProps) {
  const webViewRef = useRef<WebView>(null);

  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [pageTitle, setPageTitle] = useState(initialTitle);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal de direcionamento de link / página
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkTags, setLinkTags] = useState('');
  const [targetSpaceId, setTargetSpaceId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<'new_page' | 'append_block'>(
    'new_page'
  );
  const [openedFromLongPress, setOpenedFromLongPress] = useState(false);

  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      const plain = extractPlainTextFromContent(n.content);
      const matches = plain.match(/#[a-zA-Z0-9_À-ÿ]+/g) || [];
      for (const m of matches) set.add(m);
    }
    return Array.from(set).slice(0, 18);
  }, [nodes]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (linkModalVisible) {
        setLinkModalVisible(false);
        return true;
      }
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [linkModalVisible, canGoBack, onClose]);

  const openSaveDialog = (url: string, title: string, fromLongPress: boolean) => {
    setLinkUrl(url);
    setLinkTitle(title || url);
    setLinkTags('');
    setTargetSpaceId(null);
    setSaveMode('new_page');
    setOpenedFromLongPress(fromLongPress);
    setLinkModalVisible(true);
  };

  const handleWebMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        url?: string;
        title?: string;
      };
      if (payload.type === 'LONG_PRESS_LINK' && payload.url) {
        openSaveDialog(payload.url, payload.title ?? payload.url, true);
      }
    } catch {
      // Ignora mensagens não JSON
    }
  };

  const handleNavChange = (nav: WebViewNavigation) => {
    setCurrentUrl(nav.url);
    if (nav.title) setPageTitle(nav.title);
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
  };

  const appendTagChip = (tag: string) => {
    setLinkTags((prev) => {
      const list = prev
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
      if (list.some((t) => t.toLowerCase() === tag.toLowerCase())) return prev;
      return prev.trim() ? `${prev.trim()} ${tag}` : tag;
    });
  };

  const confirmSaveToNexus = () => {
    onSaveLinkToSpace({
      title: linkTitle.trim() || linkUrl,
      url: linkUrl,
      targetNodeId: targetSpaceId,
      mode: saveMode,
      tagsText: linkTags.trim(),
    });
    setLinkModalVisible(false);
    Alert.alert(
      'Salvo no Nexus!',
      'O link e as tags foram adicionados ao espaço selecionado.'
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Barra Superior do Navegador Interno */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity onPress={onClose} style={styles.navBtn}>
          <Text style={{ color: '#F87171', fontSize: 16, fontWeight: '800' }}>
            ✕
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!canGoBack}
          onPress={() => webViewRef.current?.goBack()}
          style={styles.navBtn}
        >
          <Text
            style={{
              color: canGoBack ? theme.text : theme.textDim,
              fontSize: 16,
              fontWeight: '700',
            }}
          >
            ←
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!canGoForward}
          onPress={() => webViewRef.current?.goForward()}
          style={styles.navBtn}
        >
          <Text
            style={{
              color: canGoForward ? theme.text : theme.textDim,
              fontSize: 16,
              fontWeight: '700',
            }}
          >
            →
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.urlPill,
            { backgroundColor: theme.bg, borderColor: theme.border },
          ]}
        >
          <Text
            style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}
            numberOfLines={1}
          >
            {pageTitle}
          </Text>
          <Text style={{ color: theme.textDim, fontSize: 10 }} numberOfLines={1}>
            {currentUrl}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => webViewRef.current?.reload()}
          style={styles.navBtn}
        >
          <Text style={{ color: theme.textMuted, fontSize: 15 }}>↻</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            onSaveSearchBookmark({
              query: initialQuery || pageTitle,
              url: currentUrl,
              sourceId,
              sourceName,
              sourceIcon,
            });
            Alert.alert('Salvo!', 'Página salva nas suas Pesquisas Salvas.');
          }}
          style={[styles.pillAction, { backgroundColor: theme.surfaceAlt }]}
        >
          <Text style={{ fontSize: 13 }}>💾</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openSaveDialog(currentUrl, pageTitle, false)}
          style={[styles.pillAction, { backgroundColor: theme.accent }]}
        >
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
            📌
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dica rápida */}
      <View
        style={[
          styles.hintStrip,
          { backgroundColor: theme.surfaceAlt, borderBottomColor: theme.border },
        ]}
      >
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
          💡 Segure qualquer link na página para enviar para um Espaço + #Tags (ou toque 📌)
        </Text>
        {loading && <ActivityIndicator size="small" color={theme.accent} />}
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: initialUrl }}
        style={{ flex: 1 }}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsFullscreenVideo
        setSupportMultipleWindows={false}
        injectedJavaScript={LONG_PRESS_SCRIPT}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          webViewRef.current?.injectJavaScript(LONG_PRESS_SCRIPT);
        }}
        onNavigationStateChange={handleNavChange}
        onMessage={handleWebMessage}
        onShouldStartLoadWithRequest={(req) => {
          if (
            req.url.startsWith('http://') ||
            req.url.startsWith('https://') ||
            req.url === 'about:blank'
          ) {
            return true;
          }
          return false;
        }}
      />

      {/* Modal Direcionar Link para Espaço + #Tags */}
      <Modal
        visible={linkModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLinkModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalBox,
              {
                maxHeight: '86%',
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {openedFromLongPress
                ? '🔗 Link Capturado!'
                : '📌 Salvar Página no Nexus'}
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              {openedFromLongPress && (
                <TouchableOpacity
                  style={[
                    styles.openHereBtn,
                    { backgroundColor: theme.surfaceAlt },
                  ]}
                  onPress={() => {
                    setLinkModalVisible(false);
                    const escaped = JSON.stringify(linkUrl);
                    webViewRef.current?.injectJavaScript(
                      `window.location.href = ${escaped}; true;`
                    );
                  }}
                >
                  <Text style={{ color: '#38BDF8', fontSize: 13, fontWeight: '700' }}>
                    🌐 Abrir este link no navegador agora
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={[styles.fieldLabel, { color: theme.textDim }]}>
                TÍTULO DO LINK
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
                value={linkTitle}
                onChangeText={setLinkTitle}
                placeholder="Título..."
                placeholderTextColor={theme.textDim}
              />

              <Text
                style={{ color: '#38BDF8', fontSize: 11, marginBottom: 12 }}
                numberOfLines={2}
              >
                {linkUrl}
              </Text>

              <Text style={[styles.fieldLabel, { color: theme.textDim }]}>
                ADICIONAR #TAGS
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.border,
                    color: '#A855F7',
                    fontWeight: '700',
                  },
                ]}
                value={linkTags}
                onChangeText={setLinkTags}
                placeholder="Ex: #estudos #referencia #youtube"
                placeholderTextColor={theme.textDim}
                autoCapitalize="none"
              />

              {existingTags.length > 0 && (
                <View style={styles.tagsWrap}>
                  {existingTags.map((t) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => appendTagChip(t)}
                      style={styles.tagChip}
                    >
                      <Text style={styles.tagChipText}>+ {t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.fieldLabel, { color: theme.textDim }]}>
                COMO SALVAR
              </Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  onPress={() => setSaveMode('new_page')}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor:
                        saveMode === 'new_page'
                          ? theme.accent
                          : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: saveMode === 'new_page' ? '#FFF' : theme.textMuted,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    📄 Nova Subpágina
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setSaveMode('append_block');
                    if (targetSpaceId === null && nodes.length > 0) {
                      setTargetSpaceId(nodes[0].id);
                    }
                  }}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor:
                        saveMode === 'append_block'
                          ? theme.accent
                          : theme.surfaceAlt,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        saveMode === 'append_block' ? '#FFF' : theme.textMuted,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    🔗 Bloco na Página
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.textDim }]}>
                DIRECIONAR PARA O ESPAÇO:
              </Text>
              <View style={{ gap: 6, marginBottom: 14 }}>
                {saveMode === 'new_page' && (
                  <TouchableOpacity
                    style={[
                      styles.spaceItem,
                      {
                        backgroundColor:
                          targetSpaceId === null
                            ? theme.accent
                            : theme.surfaceAlt,
                      },
                    ]}
                    onPress={() => setTargetSpaceId(null)}
                  >
                    <Text
                      style={{
                        color: targetSpaceId === null ? '#FFF' : theme.text,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      🏠 Início (Raiz dos Espaços)
                    </Text>
                  </TouchableOpacity>
                )}

                {nodes.map((n) => {
                  const selected = targetSpaceId === n.id;
                  return (
                    <TouchableOpacity
                      key={n.id}
                      style={[
                        styles.spaceItem,
                        {
                          backgroundColor: selected
                            ? theme.accent
                            : theme.surfaceAlt,
                        },
                      ]}
                      onPress={() => setTargetSpaceId(n.id)}
                    >
                      <Text
                        style={{
                          color: selected ? '#FFF' : theme.text,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                        numberOfLines={1}
                      >
                        📂 {n.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setLinkModalVisible(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.textDim, fontWeight: '600' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmSaveToNexus}
                style={[styles.saveConfirmBtn, { backgroundColor: theme.accent }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>
                  💾 Direcionar e Salvar
                </Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 5,
  },
  navBtn: {
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  urlPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillAction: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
  },
  hintStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    padding: 18,
  },
  modalBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  openHereBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 10,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: '#2E1065',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
  },
  tagChipText: {
    color: '#D8B4FE',
    fontSize: 11,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  spaceItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 6,
  },
  saveConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
  },
});
