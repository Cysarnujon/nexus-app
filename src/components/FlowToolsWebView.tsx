import React from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { FLOW_TOOLS_HTML } from './FlowToolsDocument';

export default function FlowToolsWebView() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ html: FLOW_TOOLS_HTML, baseUrl: 'https://nexus.local/' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        setSupportMultipleWindows={false}
        style={styles.webview}
        containerStyle={styles.webview}
        allowsBackForwardNavigationGestures={false}
        mixedContentMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  webview: { flex: 1, backgroundColor: '#0B1220' },
});
