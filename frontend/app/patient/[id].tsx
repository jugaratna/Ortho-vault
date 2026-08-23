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
import { exportPatientPdf, exportPatientNotesPdf, downloadMediaFile, exportOperativeNotePdf, exportDischargeNotePdf } from '@/src/utils/export-pdf';

type Tab = 'demographics' | 'history' | 'comparison' | 'results' | 'video' | 'timeline';

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

  const onExport = async () => {
    if (!patient) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await exportPatientPdf(patient);
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
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
    { key: 'timeline', label: 'Timeline', icon: 'time-outline' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <View style={styles.headerRow}>
          <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <Pressable testID="export-patient-btn" onPress={onExport} style={[styles.iconBtn, { backgroundColor: colors.surfaceTertiary }]}>
              <Ionicons name="share-outline" size={20} color={colors.onSurface} />
            </Pressable>
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
        {tab === 'timeline' && <TimelineTab patient={patient} />}
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
      <InfoRow label="Diagnosis" value={patient.diagnosis || 'Not set'} />
      <InfoRow label="Date of Surgery" value={patient.date_of_surgery || 'Not set'} />
      <InfoRow label="Follow-up Window" value={patient.followup_days ? `${patient.followup_days} days (custom)` : 'Using global default'} />
    </View>
  );
}

function HistoryTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      {!!patient.diagnosis && (
        <View style={[styles.card, { backgroundColor: colors.brandTertiary, borderColor: colors.brand, padding: spacing.lg }]}>
          <Text style={[styles.sectionLabel, { color: colors.onBrandTertiary }]}>DIAGNOSIS</Text>
          <Text style={{ color: colors.onBrandTertiary, fontSize: 16, fontWeight: '700' }}>{patient.diagnosis}</Text>
        </View>
      )}
      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.lg }]}>
        <View style={styles.notesHead}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>CHIEF COMPLAINTS & HISTORY</Text>
          <Pressable testID="download-notes-btn" onPress={() => exportPatientNotesPdf(patient)} style={[styles.dlBtn, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="download-outline" size={13} color={colors.brand} />
            <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700' }}>Notes PDF</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.onSurface, fontSize: 15, lineHeight: 22 }}>
          {patient.history || 'No history recorded.'}
        </Text>
      </View>
    </View>
  );
}

function ResultsTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.lg }]}>
        <View style={styles.notesHead}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>OPERATIVE NOTE</Text>
          <Pressable testID="download-op-note-btn" onPress={() => exportOperativeNotePdf(patient)} style={[styles.dlBtn, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="download-outline" size={13} color={colors.brand} />
            <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700' }}>Op Note PDF</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.onSurface, fontSize: 14, lineHeight: 21 }}>
          {(patient as any).operative_note || 'No operative note recorded.'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.lg }]}>
        <View style={styles.notesHead}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>DISCHARGE NOTE</Text>
          <Pressable testID="download-discharge-btn" onPress={() => exportDischargeNotePdf(patient)} style={[styles.dlBtn, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="download-outline" size={13} color={colors.brand} />
            <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700' }}>Discharge PDF</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.onSurface, fontSize: 14, lineHeight: 21 }}>
          {(patient as any).discharge_note || 'No discharge note recorded.'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.lg }]}>
        <View style={styles.notesHead}>
          <Text style={[styles.sectionLabel, { color: colors.muted }]}>CLINICAL RESULT / OUTCOME</Text>
          <Pressable testID="download-result-btn" onPress={() => exportPatientNotesPdf(patient)} style={[styles.dlBtn, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="download-outline" size={13} color={colors.brand} />
            <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700' }}>Notes PDF</Text>
          </Pressable>
        </View>
        <Text style={{ color: colors.onSurface, fontSize: 14, lineHeight: 21 }}>
          {patient.result || 'No outcome recorded yet.'}
        </Text>
      </View>
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
  const canSlider = !!preImg && !!postImg;

  return (
    <View style={{ gap: spacing.lg }}>
      {canSlider && (
        <Pressable
          testID="open-compare-slider"
          onPress={() => router.push({ pathname: '/compare-slider', params: { pre: preImg!.storage_path, post: postImg!.storage_path, preName: preImg!.name, postName: postImg!.name } })}
          style={({ pressed }) => [styles.sliderCta, { backgroundColor: colors.brandPrimary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="swap-horizontal" size={18} color={colors.onBrandPrimary} />
          <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 14 }}>Open Alignment Slider</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.onBrandPrimary} />
        </Pressable>
      )}

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

      <MediaList title="Pre-op" files={pre} />
      <MediaList title="Post-op" files={post} />
    </View>
  );
}

function MediaList({ title, files }: { title: string; files: MediaFile[] }) {
  const { colors } = useTheme();
  const router = useRouter();
  const images = files.filter((f) => f.kind === 'image');
  const docs = files.filter((f) => f.kind === 'pdf' || f.kind === 'doc' || f.kind === 'dicom' || f.kind === 'other');
  const renderGrid = (list: MediaFile[]) => (
    <View style={styles.grid}>
      {list.map((f) => (
        <View key={f.id} style={[styles.gridItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Pressable
            testID={`media-${f.id}`}
            onPress={() => {
              if (f.kind === 'image') router.push({ pathname: '/media-viewer', params: { path: f.storage_path, name: f.name } });
              else if (f.kind === 'pdf' || f.kind === 'doc') router.push({ pathname: '/pdf-viewer', params: { path: f.storage_path, name: f.name } });
              else WebBrowser.openBrowserAsync(fileUrl(f.storage_path));
            }}
          >
            {f.kind === 'image' ? (
              <Image source={{ uri: fileUrl(f.storage_path) }} style={styles.gridImg} contentFit="cover" />
            ) : (
              <View style={[styles.gridImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name={f.kind === 'pdf' ? 'document-text' : f.kind === 'video' ? 'play-circle' : 'document'} size={36} color={colors.brand} />
              </View>
            )}
            <Text numberOfLines={1} style={{ color: colors.onSurface, fontSize: 11, padding: 6, paddingBottom: 2 }}>{f.name}</Text>
          </Pressable>
          <Pressable
            testID={`download-${f.id}`}
            onPress={() => downloadMediaFile(f)}
            style={[styles.dlChip, { backgroundColor: colors.brandTertiary }]}
          >
            <Ionicons name="download-outline" size={11} color={colors.brand} />
            <Text style={{ color: colors.brand, fontSize: 10, fontWeight: '700' }}>Download</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>{title.toUpperCase()} — DOCUMENTS &amp; IMAGES</Text>

      <SubHeadingRow label="Images" icon="images-outline" count={images.length} />
      {images.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontStyle: 'italic' }}>No images uploaded</Text>
      ) : renderGrid(images)}

      <SubHeadingRow label="Documents" icon="document-attach-outline" count={docs.length} />
      {docs.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontStyle: 'italic' }}>No documents uploaded</Text>
      ) : renderGrid(docs)}
    </View>
  );
}

function SubHeadingRow({ label, icon, count }: { label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; count: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.subHead}>
      <Ionicons name={icon} size={14} color={colors.brand} />
      <Text style={[styles.subHeadText, { color: colors.onSurface }]}>{label}</Text>
      <View style={[styles.subCount, { backgroundColor: colors.surfaceTertiary }]}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>{count}</Text>
      </View>
    </View>
  );
}

function _LegacyMediaList({ title, files }: { title: string; files: MediaFile[] }) {
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
                else if (f.kind === 'pdf' || f.kind === 'doc') router.push({ pathname: '/pdf-viewer', params: { path: f.storage_path, name: f.name } });
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
  return (
    <View style={{ gap: spacing.md }}>
      <SubHeadingRow label="Videos" icon="videocam-outline" count={videos.length} />
      {videos.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.xl, alignItems: 'center' }]}>
          <Ionicons name="videocam-off-outline" size={40} color={colors.muted} />
          <Text style={{ color: colors.muted, marginTop: spacing.sm }}>No video documentation on record</Text>
        </View>
      ) : (
        videos.map((v) => <VideoPlayerCard key={v.id} file={v} />)
      )}
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
      <View style={styles.videoFoot}>
        <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{file.name}</Text>
        <Pressable
          testID={`download-${file.id}`}
          onPress={() => downloadMediaFile(file)}
          style={[styles.dlChip, { backgroundColor: colors.brandTertiary, marginLeft: 8 }]}
        >
          <Ionicons name="download-outline" size={12} color={colors.brand} />
          <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700' }}>Download</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TimelineTab({ patient }: { patient: Patient }) {
  const { colors } = useTheme();
  const router = useRouter();

  type Ev = { at: string; kind: 'created' | 'surgery' | 'pre_op' | 'post_op' | 'video' | 'result'; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; title: string; sub?: string; file?: MediaFile; color: string };
  const events: Ev[] = [];
  if (patient.created_at) events.push({ at: patient.created_at, kind: 'created', icon: 'person-add-outline', title: 'Patient record created', sub: patient.name, color: colors.info });
  if (patient.date_of_surgery) events.push({ at: patient.date_of_surgery + 'T12:00:00Z', kind: 'surgery', icon: 'medkit', title: 'Surgery performed', sub: patient.diagnosis || 'Orthopedic procedure', color: colors.brandPrimary });
  (patient.pre_op || []).forEach((f) => events.push({ at: f.uploaded_at || patient.created_at || '', kind: 'pre_op', icon: 'images-outline', title: 'Pre-op ' + (f.kind === 'image' ? 'image' : f.kind), sub: f.name, file: f, color: colors.brandSecondary }));
  (patient.post_op || []).forEach((f) => events.push({ at: f.uploaded_at || patient.updated_at || '', kind: 'post_op', icon: 'albums-outline', title: 'Post-op ' + (f.kind === 'image' ? 'image' : f.kind), sub: f.name, file: f, color: colors.success }));
  (patient.videos || []).forEach((f) => events.push({ at: f.uploaded_at || patient.updated_at || '', kind: 'video', icon: 'videocam-outline', title: 'Video', sub: f.name, file: f, color: colors.warning }));
  if (patient.result && patient.result.trim()) events.push({ at: patient.updated_at || new Date().toISOString(), kind: 'result', icon: 'checkmark-done-outline', title: 'Outcome recorded', sub: patient.result.slice(0, 80), color: colors.brand });

  events.sort((a, b) => (a.at || '').localeCompare(b.at || ''));

  if (events.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.xl, alignItems: 'center' }]}>
        <Ionicons name="time-outline" size={40} color={colors.muted} />
        <Text style={{ color: colors.muted, marginTop: spacing.sm }}>No timeline events yet</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingLeft: 8 }}>
      {events.map((ev, i) => (
        <View key={i} style={styles.tlRow}>
          <View style={styles.tlLeftCol}>
            <View style={[styles.tlDot, { backgroundColor: ev.color, borderColor: colors.surface }]}>
              <Ionicons name={ev.icon} size={12} color="#fff" />
            </View>
            {i < events.length - 1 && <View style={[styles.tlLine, { backgroundColor: colors.border }]} />}
          </View>
          <Pressable
            onPress={() => {
              if (!ev.file) return;
              if (ev.file.kind === 'image') router.push({ pathname: '/media-viewer', params: { path: ev.file.storage_path, name: ev.file.name } });
              else if (ev.file.kind === 'pdf' || ev.file.kind === 'doc') router.push({ pathname: '/pdf-viewer', params: { path: ev.file.storage_path, name: ev.file.name } });
              else WebBrowser.openBrowserAsync(fileUrl(ev.file.storage_path));
            }}
            style={({ pressed }) => [styles.tlCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed && ev.file ? 0.8 : 1 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: '700' }}>{ev.title}</Text>
              {!!ev.sub && <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{ev.sub}</Text>}
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6, fontWeight: '600' }}>
                {ev.at ? new Date(ev.at).toLocaleString() : '—'}
              </Text>
            </View>
            {ev.file?.kind === 'image' && (
              <Image source={{ uri: fileUrl(ev.file.storage_path) }} style={styles.tlThumb} contentFit="cover" />
            )}
            {ev.file && (
              <Pressable
                testID={`tl-download-${ev.file.id}`}
                onPress={() => downloadMediaFile(ev.file!)}
                style={[styles.tlDlBtn, { backgroundColor: colors.brandTertiary }]}
                hitSlop={8}
              >
                <Ionicons name="download-outline" size={14} color={colors.brand} />
              </Pressable>
            )}
          </Pressable>
        </View>
      ))}
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
  sliderCta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.md, justifyContent: 'center' },
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 },
  subHeadText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  subCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, minWidth: 22, alignItems: 'center' },
  notesHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  dlChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#0002' },
  videoFoot: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  tlRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.md },
  tlLeftCol: { alignItems: 'center', width: 28 },
  tlDot: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  tlLine: { width: 2, flex: 1, marginTop: 2 },
  tlCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  tlThumb: { width: 56, height: 56, borderRadius: radius.sm },
  tlDlBtn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
