import React, { useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Line, Circle, Text as SvgText, Rect } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { fileUrl } from '@/src/api/client';
import { useTheme } from '@/src/theme';

const { width: SW, height: SH } = Dimensions.get('window');

type Pt = { x: number; y: number };
type Segment = { a: Pt; b: Pt };

function angleBetween(a: Segment, b: Segment): number {
  const v1 = { x: a.b.x - a.a.x, y: a.b.y - a.a.y };
  const v2 = { x: b.b.x - b.a.x, y: b.b.y - b.a.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

function distance(a: Pt, b: Pt): number {
  return Math.round(Math.hypot(b.x - a.x, b.y - a.y));
}

export default function MediaViewer() {
  const { path, name } = useLocalSearchParams<{ path: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const shotRef = useRef<ViewShot>(null);

  const [mode, setMode] = useState<'view' | 'annotate'>('view');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [firstPt, setFirstPt] = useState<Pt | null>(null);

  // Zoom / pan (only when in view mode)
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .enabled(mode === 'view')
    .onUpdate((e) => { scale.value = Math.max(1, Math.min(5, savedScale.value * e.scale)); })
    .onEnd(() => { savedScale.value = scale.value; if (scale.value < 1.05) { scale.value = withSpring(1); tx.value = withSpring(0); ty.value = withSpring(0); savedTx.value = 0; savedTy.value = 0; } });

  const pan = Gesture.Pan()
    .enabled(mode === 'view')
    .onUpdate((e) => { tx.value = savedTx.value + e.translationX; ty.value = savedTy.value + e.translationY; })
    .onEnd(() => { savedTx.value = tx.value; savedTy.value = ty.value; });

  const dbl = Gesture.Tap()
    .enabled(mode === 'view')
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.1) { scale.value = withSpring(1); tx.value = withSpring(0); ty.value = withSpring(0); savedScale.value = 1; savedTx.value = 0; savedTy.value = 0; }
      else { scale.value = withSpring(2.5); savedScale.value = 2.5; }
    });

  const composed = Gesture.Simultaneous(pinch, pan, dbl);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));

  // Annotation - tap to add point
  const onCanvasPress = (e: any) => {
    if (mode !== 'annotate') return;
    const { locationX, locationY } = e.nativeEvent;
    if (!firstPt) {
      setFirstPt({ x: locationX, y: locationY });
      Haptics.selectionAsync();
    } else {
      const seg: Segment = { a: firstPt, b: { x: locationX, y: locationY } };
      setSegments((cur) => [...cur, seg]);
      setFirstPt(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const clearAnnotations = () => {
    setSegments([]);
    setFirstPt(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const undoLast = () => {
    if (firstPt) { setFirstPt(null); return; }
    setSegments((cur) => cur.slice(0, -1));
  };

  const shareAnnotated = async () => {
    if (!shotRef.current || !shotRef.current.capture) return;
    try {
      const uri = await shotRef.current.capture();
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save annotated image', UTI: 'public.png' });
      }
    } catch (e) {
      // ignore
    }
  };

  const CANVAS_H = SH * 0.85;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable testID="viewer-close" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>{name || 'Image'}</Text>
        <Pressable
          testID="toggle-annotate"
          onPress={() => { setMode(mode === 'view' ? 'annotate' : 'view'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          style={[styles.iconBtn, { backgroundColor: mode === 'annotate' ? colors.brandPrimary : 'rgba(255,255,255,0.1)' }]}
        >
          <Ionicons name={mode === 'annotate' ? 'checkmark' : 'create-outline'} size={20} color="#fff" />
        </Pressable>
      </View>

      {mode === 'view' ? (
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.imgWrap, animStyle]}>
            <Image source={{ uri: fileUrl(path as string) }} style={styles.img} contentFit="contain" />
          </Animated.View>
        </GestureDetector>
      ) : (
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={{ width: SW, height: CANVAS_H, marginTop: 40 }}>
          <View style={styles.annotateCanvas} onStartShouldSetResponder={() => true} onResponderRelease={onCanvasPress}>
            <Image source={{ uri: fileUrl(path as string) }} style={StyleSheet.absoluteFill} contentFit="contain" />
            <Svg width={SW} height={CANVAS_H} style={StyleSheet.absoluteFill} pointerEvents="none">
              {segments.map((s, i) => (
                <React.Fragment key={i}>
                  <Line
                    x1={s.a.x}
                    y1={s.a.y}
                    x2={s.b.x}
                    y2={s.b.y}
                    stroke={colors.brandSecondary}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <Circle cx={s.a.x} cy={s.a.y} r={5} fill={colors.brand} />
                  <Circle cx={s.b.x} cy={s.b.y} r={5} fill={colors.brand} />
                  <Rect
                    x={(s.a.x + s.b.x) / 2 - 20}
                    y={(s.a.y + s.b.y) / 2 - 20}
                    width={40}
                    height={16}
                    fill="rgba(0,0,0,0.65)"
                    rx={4}
                  />
                  <SvgText
                    x={(s.a.x + s.b.x) / 2}
                    y={(s.a.y + s.b.y) / 2 - 8}
                    fill="#fff"
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {`${distance(s.a, s.b)}px`}
                  </SvgText>
                  {i > 0 && (() => {
                    const prev = segments[i - 1];
                    const ang = angleBetween(prev, s);
                    // Show angle at the meeting point (b of prev or nearest)
                    const px = prev.b.x;
                    const py = prev.b.y;
                    return (
                      <>
                        <Rect x={px + 10} y={py - 24} width={44} height={18} fill={colors.brandPrimary} rx={4} />
                        <SvgText x={px + 32} y={py - 11} fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle">
                          {`${ang}°`}
                        </SvgText>
                      </>
                    );
                  })()}
                </React.Fragment>
              ))}
              {firstPt && (
                <Circle cx={firstPt.x} cy={firstPt.y} r={6} fill={colors.warning} stroke="#fff" strokeWidth={2} />
              )}
            </Svg>
          </View>
        </ViewShot>
      )}

      {mode === 'annotate' && (
        <View style={[styles.toolbar, { paddingBottom: insets.bottom + 12, backgroundColor: 'rgba(0,0,0,0.8)' }]}>
          <Pressable testID="annotate-undo" onPress={undoLast} style={styles.toolBtn}>
            <Ionicons name="arrow-undo" size={18} color="#fff" />
            <Text style={styles.toolLbl}>Undo</Text>
          </Pressable>
          <Pressable testID="annotate-clear" onPress={clearAnnotations} style={styles.toolBtn}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.toolLbl}>Clear</Text>
          </Pressable>
          <Pressable testID="annotate-share" onPress={shareAnnotated} style={[styles.toolBtn, { backgroundColor: colors.brandPrimary }]}>
            <Ionicons name="share-outline" size={18} color="#fff" />
            <Text style={styles.toolLbl}>Save PNG</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.hint, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.hintText}>
          {mode === 'view' ? 'Pinch to zoom • Double-tap to reset • Tap ✎ to annotate' : firstPt ? 'Tap the end point to complete a line' : 'Tap two points to draw a line — chain lines to measure angles'}
        </Text>
      </View>
    </View>
  );
}

// React was imported implicitly via JSX; keep an alias

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, zIndex: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center', marginHorizontal: 12 },
  imgWrap: { width: SW, height: SH, alignItems: 'center', justifyContent: 'center' },
  img: { width: SW, height: SH * 0.85 },
  annotateCanvas: { width: SW, height: SH * 0.85, backgroundColor: '#000' },
  hint: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center', paddingHorizontal: 16 },
  toolbar: { position: 'absolute', bottom: 30, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)' },
  toolLbl: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
