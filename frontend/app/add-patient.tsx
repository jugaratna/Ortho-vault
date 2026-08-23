import { useState, useEffect, useRef } from 'react';
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api, fileUrl, MediaFile, Patient, Sex } from '@/src/api/client';
import { useTheme, spacing, radius } from '@/src/theme';
import { searchIcd, IcdCode } from '@/src/data/icd10';
import { TEMPLATES, Template } from '@/src/data/templates';
import { useCustomTemplates, CustomTemplate } from '@/src/utils/custom-templates';
import { ensureMicPermission, transcribeAudio, useAudioRecorder, RecordingPresets } from '@/src/utils/voice';
import { useSettings } from '@/src/settings';
import { useAuth } from '@/src/auth';
import { mkId } from '@/src/utils/id';

export default function AddPatient() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, loading: authLoading, token } = useAuth();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | 'pre_op' | 'post_op' | 'video'>(null);
  const [showDate, setShowDate] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const isViewer = user?.role === 'viewer';

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('Male');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [history, setHistory] = useState('');
  const [result, setResult] = useState('');
  const [operativeNote, setOperativeNote] = useState('');
  const [dischargeNote, setDischargeNote] = useState('');
  const [dos, setDos] = useState<Date | null>(null);
  const [preOp, setPreOp] = useState<MediaFile[]>([]);
  const [postOp, setPostOp] = useState<MediaFile[]>([]);
  const [videos, setVideos] = useState<MediaFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [icdOptions, setIcdOptions] = useState<IcdCode[]>([]);
  const [showIcd, setShowIcd] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const { followupDays: globalFollowup } = useSettings();
  const [followupDays, setFollowupDays] = useState<number | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateTarget, setTemplateTarget] = useState<'result' | 'operative_note' | 'discharge_note'>('result');
  const { items: customTemplates, refresh: refreshCustom } = useCustomTemplates();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (showTemplates) refreshCustom();
  }, [showTemplates, refreshCustom]);

  useEffect(() => {
    if (id) {
      api.getPatient(id).then((p) => {
        setName(p.name); setAge(String(p.age)); setSex(p.sex);
        setCountryCode(p.country_code || '+91');
        setMobile(p.mobile); setDiagnosis(p.diagnosis || ''); setHistory(p.history || '');
        setResult(p.result || '');
        setOperativeNote((p as any).operative_note || '');
        setDischargeNote((p as any).discharge_note || '');
        setDos(p.date_of_surgery ? new Date(p.date_of_surgery) : null);
        setFollowupDays(p.followup_days ?? null);
        setPreOp(p.pre_op || []); setPostOp(p.post_op || []); setVideos(p.videos || []);
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const pickImages = async (section: 'pre_op' | 'post_op') => {
    if (isViewer) { setUploadError('Viewers cannot upload files. Ask an admin to upgrade your role.'); return; }
    if (!token) { setUploadError('Signing you in — please try again in a moment.'); return; }
    setUploadError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setUploadError('Photo library permission is required to attach images.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (res.canceled) return;
    setUploading(section);
    const failures: string[] = [];
    for (const asset of res.assets) {
      const name = asset.fileName || `img-${Date.now()}.jpg`;
      const mime = asset.mimeType || 'image/jpeg';
      try {
        const up = await api.uploadFile(asset.uri, name, mime);
        const mf: MediaFile = { id: mkId(), name: up.name, kind: up.kind, mime: up.mime, size: up.size, storage_path: up.storage_path, section };
        if (section === 'pre_op') setPreOp((cur) => [...cur, mf]); else setPostOp((cur) => [...cur, mf]);
      } catch (e: any) {
        failures.push(`${name}: ${e?.message || 'upload failed'}`);
      }
    }
    if (failures.length) {
      setUploadError(`Couldn't upload ${failures.length} file${failures.length === 1 ? '' : 's'} — ${failures[0]}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setUploading(null);
  };

  const pickDocs = async (section: 'pre_op' | 'post_op') => {
    if (isViewer) { setUploadError('Viewers cannot upload files. Ask an admin to upgrade your role.'); return; }
    if (!token) { setUploadError('Signing you in — please try again in a moment.'); return; }
    setUploadError('');
    const res = await DocumentPicker.getDocumentAsync({ multiple: true, type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '*/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    setUploading(section);
    const failures: string[] = [];
    for (const a of res.assets) {
      try {
        const up = await api.uploadFile(a.uri, a.name, a.mimeType || 'application/octet-stream');
        const mf: MediaFile = { id: mkId(), name: up.name, kind: up.kind, mime: up.mime, size: up.size, storage_path: up.storage_path, section };
        if (section === 'pre_op') setPreOp((cur) => [...cur, mf]); else setPostOp((cur) => [...cur, mf]);
      } catch (e: any) {
        failures.push(`${a.name}: ${e?.message || 'upload failed'}`);
      }
    }
    if (failures.length) {
      setUploadError(`Couldn't upload ${failures.length} file${failures.length === 1 ? '' : 's'} — ${failures[0]}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setUploading(null);
  };

  const pickVideo = async () => {
    if (isViewer) { setUploadError('Viewers cannot upload files. Ask an admin to upgrade your role.'); return; }
    if (!token) { setUploadError('Signing you in — please try again in a moment.'); return; }
    setUploadError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setUploadError('Media library permission is required to attach videos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsMultipleSelection: true, quality: 0.8 });
    if (res.canceled) return;
    setUploading('video');
    const failures: string[] = [];
    for (const asset of res.assets) {
      const name = asset.fileName || `vid-${Date.now()}.mp4`;
      const mime = asset.mimeType || 'video/mp4';
      try {
        const up = await api.uploadFile(asset.uri, name, mime);
        const mf: MediaFile = { id: mkId(), name: up.name, kind: up.kind, mime: up.mime, size: up.size, storage_path: up.storage_path, section: 'video' };
        setVideos((cur) => [...cur, mf]);
      } catch (e: any) {
        failures.push(`${name}: ${e?.message || 'upload failed'}`);
      }
    }
    if (failures.length) {
      setUploadError(`Couldn't upload ${failures.length} video${failures.length === 1 ? '' : 's'} — ${failures[0]}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setUploading(null);
  };

  const removeFile = (section: 'pre_op' | 'post_op' | 'video', fid: string) => {
    if (section === 'pre_op') setPreOp((c) => c.filter((f) => f.id !== fid));
    else if (section === 'post_op') setPostOp((c) => c.filter((f) => f.id !== fid));
    else setVideos((c) => c.filter((f) => f.id !== fid));
  };

  const onDiagnosisChange = (t: string) => {
    setDiagnosis(t);
    const opts = searchIcd(t, 6);
    setIcdOptions(opts);
    setShowIcd(opts.length > 0);
  };

  const pickIcd = (item: IcdCode) => {
    const val = `${item.code} - ${item.label}`;
    setDiagnosis(val);
    setShowIcd(false);
    Haptics.selectionAsync();
  };

  const startVoice = async () => {
    const ok = await ensureMicPermission();
    if (!ok) return;
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setVoiceState('recording');
    } catch (e) {
      setVoiceState('idle');
    }
  };

  const stopVoice = async () => {
    try {
      setVoiceState('transcribing');
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) { setVoiceState('idle'); return; }
      const text = await transcribeAudio(uri);
      if (text) {
        setResult((cur) => (cur ? cur.trim() + ' ' : '') + text);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setVoiceState('idle');
    }
  };

  const insertTemplate = (tpl: Template) => {
    const dst = tpl.target || templateTarget;
    const setter = dst === 'operative_note' ? setOperativeNote : dst === 'discharge_note' ? setDischargeNote : setResult;
    setter((cur) => (cur.trim() ? cur.trim() + '\n\n' : '') + tpl.body);
    setShowTemplates(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openTemplateFor = (target: 'result' | 'operative_note' | 'discharge_note') => {
    setTemplateTarget(target);
    setShowTemplates(true);
  };

  const draftDischargeWithAI = async () => {
    if (!operativeNote.trim() && !result.trim()) {
      setAiError('Fill Operative Note or Result first so the AI has something to draft from.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setAiError('');
    setAiBusy(true);
    try {
      const draft = await api.draftDischarge({
        name, age: Number(age) || 0, sex, diagnosis, date_of_surgery: dos ? dos.toISOString().slice(0, 10) : null,
        operative_note: operativeNote, result,
      });
      setAiDraft(draft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setAiError(e?.message || 'AI draft failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAiBusy(false);
    }
  };

  const acceptAiDraft = () => {
    if (!aiDraft) return;
    setDischargeNote((cur) => (cur.trim() ? cur.trim() + '\n\n' : '') + aiDraft);
    setAiDraft(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        diagnosis: diagnosis.trim(),
        history,
        result,
        operative_note: operativeNote,
        discharge_note: dischargeNote,
        followup_days: followupDays,
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

  if (authLoading) return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;
  if (!user) return <Redirect href="/login" />;
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
        {!!uploadError && (
          <Pressable
            testID="upload-error-banner"
            onPress={() => setUploadError('')}
            style={[styles.errBanner, { backgroundColor: colors.error + '22', borderColor: colors.error }]}
          >
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={{ color: colors.error, fontSize: 12, flex: 1 }}>{uploadError}</Text>
            <Ionicons name="close" size={14} color={colors.error} />
          </Pressable>
        )}
        {isViewer && (
          <View testID="viewer-notice" style={[styles.errBanner, { backgroundColor: colors.warning + '22', borderColor: colors.warning }]}>
            <Ionicons name="eye-outline" size={16} color={colors.warning} />
            <Text style={{ color: colors.warning, fontSize: 12, flex: 1 }}>Read-only viewer role — media uploads are disabled. Contact your admin to upgrade.</Text>
          </View>
        )}
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
          <Field label="Diagnosis">
            <TextInput
              testID="input-diagnosis"
              value={diagnosis}
              onChangeText={onDiagnosisChange}
              onFocus={() => setShowIcd(icdOptions.length > 0)}
              placeholder="Type to search ICD-10 codes (e.g. osteo, ACL, hip)"
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            />
            {showIcd && icdOptions.length > 0 && (
              <View style={[styles.icdBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                {icdOptions.map((it) => (
                  <Pressable
                    key={it.code}
                    testID={`icd-option-${it.code}`}
                    onPress={() => pickIcd(it)}
                    style={({ pressed }) => [styles.icdRow, { borderBottomColor: colors.divider, backgroundColor: pressed ? colors.surfaceTertiary : 'transparent' }]}
                  >
                    <View style={[styles.icdCodePill, { backgroundColor: colors.brandTertiary }]}>
                      <Text style={{ color: colors.onBrandTertiary, fontSize: 11, fontWeight: '700' }}>{it.code}</Text>
                    </View>
                    <Text style={{ color: colors.onSurface, fontSize: 13, flex: 1 }} numberOfLines={2}>{it.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Field>
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

          <Field label={`Follow-up Window (global default: ${globalFollowup}d)`}>
            <View style={styles.followRow}>
              {([
                { v: null, label: 'Global' },
                { v: 30, label: '30d' },
                { v: 60, label: '60d' },
                { v: 90, label: '90d' },
                { v: 180, label: '180d' },
              ] as { v: number | null; label: string }[]).map((opt) => {
                const active = followupDays === opt.v;
                return (
                  <Pressable
                    key={opt.label}
                    testID={`followup-opt-${opt.label}`}
                    onPress={() => setFollowupDays(opt.v)}
                    style={[styles.followChip, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }]}
                  >
                    <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: '600', fontSize: 13 }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        </Section>

        <MediaSection title="Pre-operative Documents" section="pre_op" files={preOp} onPickImage={() => pickImages('pre_op')} onPickDoc={() => pickDocs('pre_op')} onRemove={(fid) => removeFile('pre_op', fid)} uploading={uploading === 'pre_op'} disabled={isViewer} />
        <MediaSection title="Post-operative Documents" section="post_op" files={postOp} onPickImage={() => pickImages('post_op')} onPickDoc={() => pickDocs('post_op')} onRemove={(fid) => removeFile('post_op', fid)} uploading={uploading === 'post_op'} disabled={isViewer} />

        <Section title="Videos" colors={colors}>
          <SubHeading label="Videos" icon="videocam-outline" count={videos.length} />
          <Pressable
            testID="add-video-btn"
            onPress={pickVideo}
            disabled={isViewer || uploading === 'video'}
            style={[styles.uploadBtn, { borderColor: colors.brand, backgroundColor: colors.brandTertiary, marginBottom: spacing.sm, opacity: isViewer ? 0.5 : 1 }]}
          >
            {uploading === 'video' ? <ActivityIndicator color={colors.brand} /> : <><Ionicons name="videocam-outline" size={18} color={colors.brand} /><Text style={{ color: colors.onBrandTertiary, fontWeight: '600' }}>Add Video (Gait, ROM, Arthroscopy)</Text></>}
          </Pressable>
          {videos.length > 0 && <FileGrid files={videos} onRemove={(fid) => removeFile('video', fid)} />}
        </Section>

        <Section title="Operative Note" colors={colors}>
          <Field label="Intra-op Findings, Approach, Implants">
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Pressable
                testID="open-template-operative"
                onPress={() => openTemplateFor('operative_note')}
                style={[styles.templateBtn, { backgroundColor: colors.brandTertiary, borderColor: colors.brand }]}
              >
                <Ionicons name="library-outline" size={14} color={colors.brand} />
                <Text style={{ color: colors.onBrandTertiary, fontWeight: '700', fontSize: 12 }}>Insert Template</Text>
                <Ionicons name="chevron-down" size={12} color={colors.brand} />
              </Pressable>
            </View>
            <TextInput
              testID="input-operative-note"
              value={operativeNote}
              onChangeText={setOperativeNote}
              multiline
              placeholder="Tap Insert Template for a structured Operative Note"
              placeholderTextColor={colors.muted}
              style={[styles.textarea, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, minHeight: 140 }]}
            />
          </Field>
        </Section>

        <Section title="Discharge Note" colors={colors}>
          <Field label="Discharge Summary & Follow-up Plan">
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Pressable
                testID="open-template-discharge"
                onPress={() => openTemplateFor('discharge_note')}
                style={[styles.templateBtn, { backgroundColor: colors.brandTertiary, borderColor: colors.brand }]}
              >
                <Ionicons name="library-outline" size={14} color={colors.brand} />
                <Text style={{ color: colors.onBrandTertiary, fontWeight: '700', fontSize: 12 }}>Insert Template</Text>
                <Ionicons name="chevron-down" size={12} color={colors.brand} />
              </Pressable>
              <Pressable
                testID="draft-discharge-ai"
                onPress={draftDischargeWithAI}
                disabled={aiBusy}
                style={[styles.templateBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary, opacity: aiBusy ? 0.7 : 1 }]}
              >
                {aiBusy ? (
                  <ActivityIndicator color={colors.onBrandPrimary} size="small" />
                ) : (
                  <Ionicons name="sparkles" size={14} color={colors.onBrandPrimary} />
                )}
                <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 12 }}>Draft with AI</Text>
              </Pressable>
            </View>
            {!!aiError && <Text style={{ color: colors.error, fontSize: 12, marginBottom: 6 }}>{aiError}</Text>}
            <TextInput
              testID="input-discharge-note"
              value={dischargeNote}
              onChangeText={setDischargeNote}
              multiline
              placeholder="Tap Insert Template for a structured Discharge Summary"
              placeholderTextColor={colors.muted}
              style={[styles.textarea, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, minHeight: 140 }]}
            />
          </Field>
        </Section>

        <Section title="Result / Outcome" colors={colors}>
          <Field label="Clinical Result Notes">
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <Pressable
                testID="open-template-library"
                onPress={() => openTemplateFor('result')}
                style={[styles.templateBtn, { backgroundColor: colors.brandTertiary, borderColor: colors.brand }]}
              >
                <Ionicons name="library-outline" size={14} color={colors.brand} />
                <Text style={{ color: colors.onBrandTertiary, fontWeight: '700', fontSize: 12 }}>Template Library</Text>
                <Ionicons name="chevron-down" size={12} color={colors.brand} />
              </Pressable>
            </View>
            <View style={{ position: 'relative' }}>
              <TextInput testID="input-result" value={result} onChangeText={setResult} multiline placeholder="ROM, function scores, post-op notes — or tap the mic to dictate" placeholderTextColor={colors.muted} style={[styles.textarea, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, paddingRight: 56, minHeight: 160 }]} />
              <Pressable
                testID="voice-note-btn"
                onPress={voiceState === 'recording' ? stopVoice : startVoice}
                disabled={voiceState === 'transcribing'}
                style={[styles.micBtn, { backgroundColor: voiceState === 'recording' ? colors.error : colors.brandPrimary }]}
              >
                {voiceState === 'transcribing' ? (
                  <ActivityIndicator color={colors.onBrandPrimary} size="small" />
                ) : (
                  <Ionicons name={voiceState === 'recording' ? 'stop' : 'mic'} size={20} color={colors.onBrandPrimary} />
                )}
              </Pressable>
            </View>
            {voiceState === 'recording' && (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 6, fontWeight: '600' }}>● Recording — tap stop to transcribe</Text>
            )}
            {voiceState === 'transcribing' && (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Transcribing…</Text>
            )}
          </Field>
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
        <Pressable testID="save-patient-btn" onPress={save} disabled={saving} style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: pressed || saving ? 0.8 : 1 }]}>
          {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 16 }}>{id ? 'Update Patient' : 'Save Patient'}</Text>}
        </Pressable>
      </View>

      {/* Template Library modal */}
      <Modal visible={showTemplates} transparent animationType="slide" onRequestClose={() => setShowTemplates(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHead}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Template Library</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  Inserts into <Text style={{ color: colors.brand, fontWeight: '700' }}>
                    {templateTarget === 'operative_note' ? 'Operative Note' : templateTarget === 'discharge_note' ? 'Discharge Note' : 'Result / Outcome'}
                  </Text>
                </Text>
              </View>
              <Pressable testID="template-close" onPress={() => setShowTemplates(false)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            <Pressable
              testID="template-new"
              onPress={() => { setShowTemplates(false); router.push('/template-editor'); }}
              style={({ pressed }) => [styles.newTplRow, { backgroundColor: pressed ? colors.brandPrimary : colors.brandTertiary, borderColor: colors.brand }]}
            >
              <Ionicons name="add-circle" size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 14, fontWeight: '700' }}>Create Custom Template</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Author your own (e.g. Spine Fusion, Shoulder Arthroplasty)</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.brand} />
            </Pressable>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {customTemplates.length > 0 && (
                <>
                  <Text style={[styles.groupLbl, { color: colors.muted }]}>MY CUSTOM TEMPLATES</Text>
                  {customTemplates.map((t) => (
                    <Pressable
                      key={t.id}
                      testID={`template-${t.id}`}
                      onPress={() => insertTemplate(t)}
                      onLongPress={() => { setShowTemplates(false); router.push({ pathname: '/template-editor', params: { id: t.id } }); }}
                      delayLongPress={350}
                      style={({ pressed }) => [styles.tplRow, { backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: colors.border }]}
                    >
                      <View style={[styles.tplIcon, { backgroundColor: colors.brandTertiary }]}>
                        <Ionicons name={t.icon || 'bookmark-outline'} size={22} color={colors.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: '700' }}>{t.label}</Text>
                        <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                          {t.body.split('\n').slice(0, 4).join(' • ').replace(/\s+/g, ' ').slice(0, 90)}…
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3, fontStyle: 'italic' }}>Long-press to edit</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    </Pressable>
                  ))}
                </>
              )}

              <Text style={[styles.groupLbl, { color: colors.muted, marginTop: customTemplates.length ? spacing.md : 0 }]}>BUILT-IN TEMPLATES</Text>
              {TEMPLATES.map((t) => (
                <Pressable
                  key={t.id}
                  testID={`template-${t.id}`}
                  onPress={() => insertTemplate(t)}
                  style={({ pressed }) => [styles.tplRow, { backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <View style={[styles.tplIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name={t.icon} size={22} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: '700' }}>{t.label}</Text>
                    <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
                      {t.body.split('\n').slice(2, 5).join(' • ').replace(/\s+/g, ' ').slice(0, 90)}…
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* AI Draft review modal */}
      <Modal visible={!!aiDraft} transparent animationType="slide" onRequestClose={() => setAiDraft(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }]}>
            <View style={styles.modalHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={18} color={colors.brand} />
                  <Text style={[styles.modalTitle, { color: colors.onSurface }]}>AI Discharge Draft</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Review, edit if needed, then accept to insert into the Discharge Note</Text>
              </View>
              <Pressable testID="ai-draft-close" onPress={() => setAiDraft(null)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 460, marginTop: spacing.sm }}>
              <TextInput
                testID="ai-draft-textarea"
                value={aiDraft || ''}
                onChangeText={(t) => setAiDraft(t)}
                multiline
                style={[styles.textarea, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, minHeight: 320, fontSize: 13 }]}
              />
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
              <Pressable
                testID="ai-draft-discard"
                onPress={() => setAiDraft(null)}
                style={({ pressed }) => [styles.saveBtn, { flex: 1, backgroundColor: colors.surfaceTertiary, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: colors.onSurface, fontWeight: '700', fontSize: 15 }}>Discard</Text>
              </Pressable>
              <Pressable
                testID="ai-draft-accept"
                onPress={acceptAiDraft}
                style={({ pressed }) => [styles.saveBtn, { flex: 2, backgroundColor: colors.brandPrimary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 15 }}>Accept & Insert</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

function MediaSection({ title, section, files, onPickImage, onPickDoc, onRemove, uploading, disabled }: any) {
  const { colors } = useTheme();
  const images = (files || []).filter((f: MediaFile) => f.kind === 'image');
  const docs = (files || []).filter((f: MediaFile) => f.kind === 'pdf' || f.kind === 'doc' || f.kind === 'dicom' || f.kind === 'other');
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>

      {/* Images sub-section */}
      <SubHeading label="Images" icon="images-outline" count={images.length} />
      <Pressable
        testID={`${section}-add-image`}
        onPress={onPickImage}
        disabled={disabled || !!uploading}
        style={[styles.uploadBtn, { borderColor: colors.brand, backgroundColor: colors.brandTertiary, marginBottom: spacing.sm, opacity: disabled ? 0.5 : 1 }]}
      >
        {uploading ? <ActivityIndicator color={colors.brand} /> : <><Ionicons name="images-outline" size={18} color={colors.brand} /><Text style={{ color: colors.onBrandTertiary, fontWeight: '600' }}>Add Images (X-ray, MRI, CT, photos)</Text></>}
      </Pressable>
      {images.length > 0 && <FileGrid files={images} onRemove={onRemove} />}

      {/* Documents sub-section */}
      <SubHeading label="Documents" icon="document-attach-outline" count={docs.length} />
      <Pressable
        testID={`${section}-add-doc`}
        onPress={onPickDoc}
        disabled={disabled || !!uploading}
        style={[styles.uploadBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm, opacity: disabled ? 0.5 : 1 }]}
      >
        <Ionicons name="document-attach-outline" size={18} color={colors.onSurface} />
        <Text style={{ color: colors.onSurface, fontWeight: '600' }}>Add PDFs / Word Docs / Lab Reports</Text>
      </Pressable>
      {docs.length > 0 && <FileGrid files={docs} onRemove={onRemove} />}
    </View>
  );
}

function SubHeading({ label, icon, count }: { label: string; icon: keyof typeof Ionicons.glyphMap; count: number }) {
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
  icdBox: { marginTop: 6, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  icdRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icdCodePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 76, alignItems: 'center' },
  micBtn: { position: 'absolute', right: 8, bottom: 8, width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 },
  subHeadText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  subCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, minWidth: 22, alignItems: 'center' },
  followRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  followChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  templateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  tplRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  tplIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  newTplRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', marginBottom: spacing.md },
  groupLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.sm, marginTop: 4 },
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md },
});
