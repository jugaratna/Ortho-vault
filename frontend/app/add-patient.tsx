import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api, fileUrl, MediaFile, Patient, Sex } from '@/src/api/client';
import { useTheme, spacing, radius } from '@/src/theme';

export default function AddPatient() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | 'pre_op' | 'post_op' | 'video'>(null);
  const [showDate, setShowDate] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('Male');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const [history, setHistory] = useState('');
  const [result, setResult] = useState('');
  const [dos, setDos] = useState<Date | null>(null);
  const [preOp, setPreOp] = useState<MediaFile[]>([]);
  const [postOp, setPostOp] = useState<MediaFile[]>([]);
  const [videos, setVideos] = useState<MediaFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      api.getPatient(id).then((p) => {
        setName(p.name); setAge(String(p.age)); setSex(p.sex);
        setCountryCode(p.country_code || '+91');
        setMobile(p.mobile); setHistory(p.history || '');
        setResult(p.result || '');
        setDos(p.date_of_surgery ? new Date(p.date_of_surgery) : null);
        setPreOp(p.pre_op || []); setPostOp(p.post_op || []); setVideos(p.videos || []);
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const pickImages = async (section: 'pre_op' | 'post_op') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (res.canceled) return;
    setUploading(section);
    for (const asset of res.assets) {
      const name = asset.fileName || `img-${Date.now()}.jpg`;
      const mime = asset.mimeType || 'image/jpeg';
      try {
        const up = await api.uploadFile(asset.uri, name, mime);
        const mf: MediaFile = { id: crypto.randomUUID?.() || String(Date.now() + Math.random()), name: up.name, kind: up.kind, mime: up.mime, size: up.size, storage_path: up.storage_path, section };
        if (section === 'pre_op') setPreOp((cur) => [...cur, mf]); else setPostOp((cur) => [...cur, mf]);
      } catch (e) {}
    }
    setUploading(null);
  };

  const pickDocs = async (section: 'pre_op' | 'post_op') => {
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    setUploading(section);
    for (const a of res.assets) {
      try {
        const up = await api.uploadFile(a.uri, a.name, a.mimeType || 'application/octet-stream');
        const mf: MediaFile = { id: crypto.randomUUID?.() || String(Date.now() + Math.random()), name: up.name, kind: up.kind, mime: up.mime, size: up.size, storage_path: up.storage_path, section };
        if (section === 'pre_op') setPreOp((cur) => [...cur, mf]); else setPostOp((cur) => [...cur, mf]);
      } catch (e) {}
    }
    setUploading(null);
  };

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: true, quality: 0.8 });
    if (res.canceled) return;
    setUploading('video');
    for (const asset of res.assets) {
      const name = asset.fileName || `vid-${Date.now()}.mp4`;
      const mime = asset.mimeType || 'video/mp4';
      try {
        const up = await api.uploadFile(asset.uri, name, mime);
        const mf: MediaFile = { id: crypto.randomUUID?.() || String(Date.now() + Math.random()), name: up.name, kind: up.kind, mime: up.mime, size: up.size, storage_path: up.storage_path, section: 'video' };
        setVideos((cur) => [...cur, mf]);
      } catch (e) {}
    }
    setUploading(null);
  };

  const removeFile = (section: 'pre_op' | 'post_op' | 'video', fid: string) => {
    if (section === 'pre_op') setPreOp((c) => c.filter((f) => f.id !== fid));
    else if (section === 'post_op') setPostOp((c) => c.filter((f) => f.id !== fid));
    else setVideos((c) => c.filter((f) => f.id !== fid));
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Required';
    if (!age.trim() || isNaN(Number(age))) errs.age = 'Valid age';
    if (!mobile.trim() || mobile.replace(/\D/g, '').length < 7) errs.mobile = 'Valid mobile';
    setErrors(errs);
    if (Object.keys(errs).length) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setSaving(true);
    try {
      await api.upsertPatient({
        id,
        name: name.trim(),
        age: Number(age),
        sex,
        country_code: countryCode,
        mobile: mobile.trim(),
        history,
        result,
        date_of_surgery: dos ? dos.toISOString().slice(0, 10) : null,
        pre_op: preOp,
        post_op: postOp,
        videos,
      } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{id ? 'Edit Patient' : 'New Patient'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Section title="Demographics" colors={colors}>
          <Field label="Name" error={errors.name}>
            <TextInput testID="input-name" value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />
          </Field>
          <View style={styles.row2}>
            <Field label="Age" error={errors.age} flex>
              <TextInput testID="input-age" value={age} onChangeText={(t) => setAge(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="42" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />
            </Field>
            <Field label="Sex" flex>
              <View style={styles.segRow}>
                {(['Male', 'Female', 'Other'] as Sex[]).map((s) => (
                  <Pressable key={s} testID={`sex-${s}`} onPress={() => setSex(s)} style={[styles.seg, { backgroundColor: sex === s ? colors.brandPrimary : colors.surfaceSecondary, borderColor: sex === s ? colors.brandPrimary : colors.border }]}>
                    <Text style={{ color: sex === s ? colors.onBrandPrimary : colors.onSurface, fontWeight: '600', fontSize: 13 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          </View>

          <Field label="Mobile" error={errors.mobile}>
            <View style={styles.mobileRow}>
              <TextInput testID="input-country-code" value={countryCode} onChangeText={setCountryCode} style={[styles.input, { width: 70, color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, textAlign: 'center' }]} />
              <TextInput testID="input-mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1, color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />
            </View>
          </Field>
        </Section>

        <Section title="History & Surgery" colors={colors}>
          <Field label="Chief Complaints / History">
            <TextInput testID="input-history" value={history} onChangeText={setHistory} multiline placeholder="Presenting complaints, examination findings, diagnosis" placeholderTextColor={colors.muted} style={[styles.textarea, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />
          </Field>
          <Field label="Date of Surgery">
            <Pressable testID="date-picker-btn" onPress={() => setShowDate(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={{ color: dos ? colors.onSurface : colors.muted, fontSize: 15 }}>{dos ? dos.toISOString().slice(0, 10) : 'Select date'}</Text>
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
            </Pressable>
            {showDate && (
              <DateTimePicker
                value={dos || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, d) => { setShowDate(Platform.OS === 'ios'); if (d) setDos(d); }}
              />
            )}
          </Field>
        </Section>

        <MediaSection title="Pre-operative Documents" section="pre_op" files={preOp} onPickImage={() => pickImages('pre_op')} onPickDoc={() => pickDocs('pre_op')} onRemove={(fid) => removeFile('pre_op', fid)} uploading={uploading === 'pre_op'} />
        <MediaSection title="Post-operative Documents" section="post_op" files={postOp} onPickImage={() => pickImages('post_op')} onPickDoc={() => pickDocs('post_op')} onRemove={(fid) => removeFile('post_op', fid)} uploading={uploading === 'post_op'} />

        <Section title="Videos" colors={colors}>
          <Pressable testID="add-video-btn" onPress={pickVideo} style={[styles.uploadBtn, { borderColor: colors.brand, backgroundColor: colors.brandTertiary }]}>
            {uploading === 'video' ? <ActivityIndicator color={colors.brand} /> : <><Ionicons name="videocam-outline" size={18} color={colors.brand} /><Text style={{ color: colors.onBrandTertiary, fontWeight: '600' }}>Add Video</Text></>}
          </Pressable>
          <FileGrid files={videos} onRemove={(fid) => removeFile('video', fid)} />
        </Section>

        <Section title="Result / Outcome" colors={colors}>
          <Field label="Clinical Result Notes">
            <TextInput testID="input-result" value={result} onChangeText={setResult} multiline placeholder="ROM, function scores, post-op notes" placeholderTextColor={colors.muted} style={[styles.textarea, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />
          </Field>
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
        <Pressable testID="save-patient-btn" onPress={save} disabled={saving} style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: pressed || saving ? 0.8 : 1 }]}>
          {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 16 }}>{id ? 'Update Patient' : 'Save Patient'}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children, colors }: any) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

function Field({ label, error, flex, children }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: flex ? 1 : undefined }}>
      <Text style={[styles.label, { color: colors.onSurfaceTertiary }]}>{label}</Text>
      {children}
      {!!error && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

function MediaSection({ title, section, files, onPickImage, onPickDoc, onRemove, uploading }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <Pressable testID={`${section}-add-image`} onPress={onPickImage} style={[styles.uploadBtn, { flex: 1, borderColor: colors.brand, backgroundColor: colors.brandTertiary }]}>
          {uploading ? <ActivityIndicator color={colors.brand} /> : <><Ionicons name="images-outline" size={18} color={colors.brand} /><Text style={{ color: colors.onBrandTertiary, fontWeight: '600' }}>Images</Text></>}
        </Pressable>
        <Pressable testID={`${section}-add-doc`} onPress={onPickDoc} style={[styles.uploadBtn, { flex: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="document-attach-outline" size={18} color={colors.onSurface} />
          <Text style={{ color: colors.onSurface, fontWeight: '600' }}>PDF / Doc</Text>
        </Pressable>
      </View>
      <FileGrid files={files} onRemove={onRemove} />
    </View>
  );
}

function FileGrid({ files, onRemove }: { files: MediaFile[]; onRemove: (id: string) => void }) {
  const { colors } = useTheme();
  if (!files.length) return null;
  return (
    <View style={styles.grid}>
      {files.map((f) => (
        <View key={f.id} style={[styles.gridItem, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
          {f.kind === 'image' ? (
            <Image source={{ uri: fileUrl(f.storage_path) }} style={styles.gridImg} contentFit="cover" />
          ) : (
            <View style={[styles.gridImg, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons
                name={f.kind === 'pdf' ? 'document-text' : f.kind === 'video' ? 'play-circle' : f.kind === 'doc' ? 'document' : 'document-outline'}
                size={32}
                color={colors.brand}
              />
            </View>
          )}
          <Text numberOfLines={1} style={[styles.gridName, { color: colors.onSurface }]}>{f.name}</Text>
          <Pressable testID={`remove-${f.id}`} onPress={() => onRemove(f.id)} style={[styles.removeBtn, { backgroundColor: colors.error }]}>
            <Ionicons name="close" size={12} color="#fff" />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.md },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, minHeight: 46 },
  textarea: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, minHeight: 96, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: spacing.md },
  segRow: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  mobileRow: { flexDirection: 'row', gap: spacing.sm },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: 96, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 6, position: 'relative' },
  gridImg: { width: '100%', height: 80, borderRadius: radius.sm, marginBottom: 4 },
  gridName: { fontSize: 10, fontWeight: '500' },
  removeBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
