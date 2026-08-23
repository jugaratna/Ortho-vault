import { View, StyleSheet, Pressable, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { fileUrl } from '@/src/api/client';

const { width: SW, height: SH } = Dimensions.get('window');

export default function MediaViewer() {
  const { path, name } = useLocalSearchParams<{ path: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.max(1, Math.min(5, savedScale.value * e.scale)); })
    .onEnd(() => { savedScale.value = scale.value; if (scale.value < 1.05) { scale.value = withSpring(1); tx.value = withSpring(0); ty.value = withSpring(0); savedTx.value = 0; savedTy.value = 0; } });

  const pan = Gesture.Pan()
    .onUpdate((e) => { tx.value = savedTx.value + e.translationX; ty.value = savedTy.value + e.translationY; })
    .onEnd(() => { savedTx.value = tx.value; savedTy.value = ty.value; });

  const dbl = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) { scale.value = withSpring(1); tx.value = withSpring(0); ty.value = withSpring(0); savedScale.value = 1; savedTx.value = 0; savedTy.value = 0; }
      else { scale.value = withSpring(2.5); savedScale.value = 2.5; }
    });

  const composed = Gesture.Simultaneous(pinch, pan, dbl);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="viewer-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{name || 'Image'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.imgWrap, animStyle]}>
          <Image source={{ uri: fileUrl(path as string) }} style={styles.img} contentFit="contain" />
        </Animated.View>
      </GestureDetector>

      <View style={[styles.hint, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.hintText}>Pinch to zoom • Double-tap to reset</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, zIndex: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  imgWrap: { width: SW, height: SH, alignItems: 'center', justifyContent: 'center' },
  img: { width: SW, height: SH * 0.85 },
  hint: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
