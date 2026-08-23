import { View, StyleSheet, Pressable, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { fileUrl } from '@/src/api/client';
import { useTheme } from '@/src/theme';

const { width: SW } = Dimensions.get('window');
const VIEWER_H = 520;

export default function CompareSlider() {
  const { pre, post, preName, postName } = useLocalSearchParams<{ pre: string; post: string; preName?: string; postName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const width = SW;
  const dividerX = useSharedValue(width / 2);
  const savedX = useSharedValue(width / 2);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const next = Math.max(24, Math.min(width - 24, savedX.value + e.translationX));
      dividerX.value = next;
    })
    .onEnd(() => {
      savedX.value = dividerX.value;
    });

  const clipStyle = useAnimatedStyle(() => ({ width: dividerX.value }));
  const handleStyle = useAnimatedStyle(() => ({ left: dividerX.value - 22 }));

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="compare-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Pre-op vs Post-op</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <View style={[styles.viewer, { width, height: VIEWER_H }]}>
          {/* Bottom (post-op full) */}
          <Image source={{ uri: fileUrl(post as string) }} style={StyleSheet.absoluteFill} contentFit="contain" />

          {/* Top (pre-op clipped) */}
          <Animated.View style={[styles.clip, clipStyle]}>
            <Image source={{ uri: fileUrl(pre as string) }} style={{ width, height: VIEWER_H }} contentFit="contain" />
          </Animated.View>

          {/* Divider + Handle */}
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.handle, handleStyle]}>
              <View style={[styles.line, { backgroundColor: colors.brandSecondary }]} />
              <View style={[styles.knob, { backgroundColor: colors.brandSecondary, borderColor: '#fff' }]}>
                <Ionicons name="swap-horizontal" size={18} color="#fff" />
              </View>
              <View style={[styles.line, { backgroundColor: colors.brandSecondary }]} />
            </Animated.View>
          </GestureDetector>

          {/* Labels */}
          <View style={[styles.labelWrap, { left: 12 }]}>
            <View style={[styles.label, { backgroundColor: colors.brandPrimary }]}>
              <Text style={styles.labelText}>PRE-OP</Text>
            </View>
          </View>
          <View style={[styles.labelWrap, { right: 12 }]}>
            <View style={[styles.label, { backgroundColor: colors.brandSecondary }]}>
              <Text style={styles.labelText}>POST-OP</Text>
            </View>
          </View>
        </View>

        <Text style={styles.hint}>Drag the handle to reveal pre-op vs post-op alignment</Text>
        {(preName || postName) && (
          <View style={styles.namesRow}>
            <Text style={styles.name} numberOfLines={1}>{preName}</Text>
            <Text style={styles.name} numberOfLines={1}>{postName}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.85)' },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewer: { position: 'relative', overflow: 'hidden' },
  clip: { position: 'absolute', top: 0, left: 0, height: VIEWER_H, overflow: 'hidden' },
  handle: { position: 'absolute', top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2 },
  knob: { width: 44, height: 44, borderRadius: 999, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  labelWrap: { position: 'absolute', top: 12 },
  label: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  labelText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 24, textAlign: 'center', paddingHorizontal: 24 },
  namesRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingHorizontal: 16, width: '100%', justifyContent: 'space-between' },
  name: { color: 'rgba(255,255,255,0.5)', fontSize: 11, flex: 1, textAlign: 'center' },
});
