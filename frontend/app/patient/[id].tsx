import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import { api, fileUrl, MediaFile, Patient } from '@/src/api/client';
import { useTheme, spacing, radius } from '@/src/theme';

type Tab = 'demographics' | 'history' | 'comparison' | 'results' | 'video';

export default function PatientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<Tab>('demographics');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPatient(id).then(setPatient).finally(() => setLoading(false));
  }, [id]);

  const onDelete = async () => {
    await api.deletePatient(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (loading || !patient) {
    return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;
  }

  const tabs: { key: Tab; label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[] = [
    { key: 'demographics', label: 'Info', icon: 'person-outline' },
    { key: 'history', label: 'History', icon: 'document-text-outline' },
    { key: 'comparison', label: 'Compare', icon: 'swap-horizontal-outline' },
    { key: 'results', label: 'Results', icon: 'checkmark-done-outline' },
    { key: 'video', label: 'Video', icon: 'videocam-outline' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <View style={styles.headerRow}>
          <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable testID="edit-patient-btn" onPress={() => router.push({ pathname: '/add-patient', params: { id: patient.id } })} style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="create-outline" size={20} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="delete-patient-btn" onPress={onDelete} style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
          <Text style={[styles.patientName, { color: colors.onSurface }]}>{patient.name}</Text>
          <Text style={[styles.patientMeta, { color: colors.muted }]}>
            {patient.age}y • {patient.sex} • {patient.country_code} {patient.mobile}
          </Text>
          {!!patient.date_of_surgery && (
            <View style={[styles.dosPill, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="calendar" size={12} color={colors.onBrandTertiary} />
              <Text style={[styles.dosText, { color: colors.onBrandTertiary }]}>Surgery: {patient.date_of_surgery}</Text>
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                testID={`tab-${t.key}`}
                onPress={() => { Haptics.selectionAsync(); setTab(t.key); }}
                style={[styles.tabChip, { backgroundColor: active ? colors.brandPrimary : 'transparent', borderColor: active ? colors.brandPrimary : colors.border }]}
              >
                <Ionicons name={t.icon} size={14} color={active ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: '600', fontSize: 13 }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 + insets.bottom }}>
        {tab === 'demographics' && <DemographicsTab patient={patient} />}
        {tab === 'history' && <HistoryTab patient={patient} />}
        {tab === 'comparison' && <ComparisonTab patient={patient} />}
        {tab === 'results' && <ResultsTab patient={patient} />}
        {tab === 'video' && <VideoTab patient={patient} />}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.divider }]}>
      <Text style={[styles.infoLabel, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.onSurface }]}>{value || '—'}</Text>
    </View>
  );
}

function DemographicsTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <InfoRow label="Full Name" value={patient.name} />
      <InfoRow label="Age" value={`${patient.age} years`} />
      <InfoRow label="Sex" value={patient.sex} />
      <InfoRow label="Mobile" value={`${patient.country_code} ${patient.mobile}`} />
      <InfoRow label="Date of Surgery" value={patient.date_of_surgery || 'Not set'} />
    </View>
  );
}

function HistoryTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.lg }]}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>CHIEF COMPLAINTS & HISTORY</Text>
      <Text style={{ color: colors.onSurface, fontSize: 15, lineHeight: 22 }}>
        {patient.history || 'No history recorded.'}
      </Text>
    </View>
  );
}

function ResultsTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.lg }]}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>CLINICAL RESULT / OUTCOME</Text>
      <Text style={{ color: colors.onSurface, fontSize: 15, lineHeight: 22 }}>
        {patient.result || 'No outcome recorded yet.'}
      </Text>
    </View>
  );
}

function ComparisonTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  const router = useRouter();
  const pre = patient.pre_op || [];
  const post = patient.post_op || [];

  const preImg = pre.find((f) => f.kind === 'image');
  const postImg = post.find((f) => f.kind === 'image');

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={[styles.compareCard, { backgroundColor: '#000' }]}>
        <View style={{ flex: 1 }}>
          <View style={styles.compareLabelWrap}>
            <View style={[styles.compareLabel, { backgroundColor: colors.brandPrimary }]}>
              <Text style={{ color: colors.onBrandPrimary, fontSize: 11, fontWeight: '700' }}>PRE-OP</Text>
            </View>
          </View>
          {preImg ? (
            <Pressable onPress={() => router.push({ pathname: '/media-viewer', params: { path: preImg.storage_path, name: preImg.name } })}>
              <Image source={{ uri: fileUrl(preImg.storage_path) }} style={styles.compareImg} contentFit="contain" />
            </Pressable>
          ) : (
            <View style={[styles.compareImg, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="image-outline" size={40} color="#444" />
              <Text style={{ color: '#666', marginTop: 8 }}>No Pre-op image</Text>
            </View>
          )}
        </View>
        <View style={{ height: 2, backgroundColor: colors.brand }} />
        <View style={{ flex: 1 }}>
          <View style={styles.compareLabelWrap}>
            <View style={[styles.compareLabel, { backgroundColor: colors.brandSecondary }]}>
              <Text style={{ color: colors.onBrandSecondary, fontSize: 11, fontWeight: '700' }}>POST-OP</Text>
            </View>
          </View>
          {postImg ? (
            <Pressable onPress={() => router.push({ pathname: '/media-viewer', params: { path: postImg.storage_path, name: postImg.name } })}>
              <Image source={{ uri: fileUrl(postImg.storage_path) }} style={styles.compareImg} contentFit="contain" />
            </Pressable>
          ) : (
            <View style={[styles.compareImg, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="image-outline" size={40} color="#444" />
              <Text style={{ color: '#666', marginTop: 8 }}>No Post-op image</Text>
            </View>
          )}
        </View>
      </View>

      <MediaList title="All Pre-op Files" files={pre} />
      <MediaList title="All Post-op Files" files={post} />
    </View>
  );
}

function MediaList({ title, files }: { title: string; files: MediaFile[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View>
      <Text style={[styles.sectionLabel, { color: colors.muted, marginBottom: spacing.sm }]}>{title.toUpperCase()}</Text>
      {files.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 13, fontStyle: 'italic' }}>No files</Text>
      ) : (
        <View style={styles.grid}>
          {files.map((f) => (
            <Pressable
              key={f.id}
              testID={`media-${f.id}`}
              onPress={() => {
                if (f.kind === 'image') router.push({ pathname: '/media-viewer', params: { path: f.storage_path, name: f.name } });
                else WebBrowser.openBrowserAsync(fileUrl(f.storage_path));
              }}
              style={[styles.gridItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              {f.kind === 'image' ? (
                <Image source={{ uri: fileUrl(f.storage_path) }} style={styles.gridImg} contentFit="cover" />
              ) : (
                <View style={[styles.gridImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary }]}>
                  <Ionicons name={f.kind === 'pdf' ? 'document-text' : f.kind === 'video' ? 'play-circle' : 'document'} size={36} color={colors.brand} />
                </View>
              )}
              <Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 11, padding: 6 }}>{f.name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function VideoTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  const videos = patient.videos || [];
  if (videos.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.xl, alignItems: 'center' }]}>
        <Ionicons name="videocam-off-outline" size={40} color={colors.muted} />
        <Text style={{ color: colors.muted, marginTop: spacing.sm }}>No videos recorded</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {videos.map((v) => (
        <VideoPlayerCard key={v.id} file={v} />
      ))}
    </View>
  );
}

function VideoPlayerCard({ file }: { file: MediaFile }) {
  const { colors } = useTheme();
  const uri = fileUrl(file.storage_path);
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: 0, overflow: 'hidden' }]}>
      <VideoView style={{ width: '100%', height: 220, backgroundColor: '#000' }} player={player} allowsFullscreen nativeControls />
      <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: '600', padding: spacing.md }}>{file.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  patientName: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  patientMeta: { fontSize: 14, marginTop: 4 },
  dosPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, marginTop: 8 },
  dosText: { fontSize: 12, fontWeight: '700' },
  tabsRow: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.sm, alignItems: 'center', height: 56 },
  tabChip: { flexShrink: 0, height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 15, fontWeight: '600' },
  compareCard: { borderRadius: radius.md, overflow: 'hidden', height: 460 },
  compareImg: { width: '100%', height: '100%' },
  compareLabelWrap: { position: 'absolute', top: 8, left: 8, zIndex: 2 },
  compareLabel: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: 100, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  gridImg: { width: '100%', height: 80 },
});
