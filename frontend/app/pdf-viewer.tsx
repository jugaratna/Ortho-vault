import { View, StyleSheet, Pressable, Text, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { fileUrl } from '@/src/api/client';
import { useTheme, spacing, radius } from '@/src/theme';

export default function PdfViewer() {
  const { path, name } = useLocalSearchParams<{ path: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);

  const url = fileUrl(path as string);
  // Google Docs viewer wraps any public URL and renders inline
  const gviewer = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="pdf-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{name || 'Document'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {Platform.OS === 'web' ? (
        <iframe
          src={url}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%', background: '#000' } as any}
          onLoad={() => setLoading(false)}
        />
      ) : (
        <WebView
          source={{ uri: gviewer }}
          style={{ flex: 1, backgroundColor: '#000' }}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState
          originWhitelist={['*']}
        />
      )}

      {loading && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={colors.brand} />
          <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>Loading document…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.85)' },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  loading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
