import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme, spacing, radius } from '@/src/theme';
import { CustomTemplate, loadCustomTemplates, upsertCustomTemplate, deleteCustomTemplate } from '@/src/utils/custom-templates';

export default function TemplateEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [label, setLabel] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'result' | 'operative_note' | 'discharge_note'>('operative_note');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    loadCustomTemplates().then((items) => {
      const t = items.find((x) => x.id === id);
      if (t) { setLabel(t.label); setBody(t.body); if (t.target) setTarget(t.target); }
      setLoading(false);
    });
  }, [id]);

  const save = async () => {
    if (!label.trim()) { setError('Give your template a name'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    if (!body.trim()) { setError('Template body is empty'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    setSaving(true);
    try {
      const tpl: CustomTemplate = {
        id: id || `custom-${Date.now()}`,
        label: label.trim(),
        icon: 'bookmark-outline',
        target,
        body,
      };
      await upsertCustomTemplate(tpl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    await deleteCustomTemplate(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.back();
  };

  if (loading) return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>{id ? 'Edit Template' : 'New Template'}</Text>
        {id ? (
          <Pressable testID="delete-template-btn" onPress={remove} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </Pressable>
        ) : <View style={{ width: 40 }} />}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.onSurfaceTertiary }]}>TEMPLATE NAME</Text>
        <TextInput
          testID="template-label-input"
          value={label}
          onChangeText={(t) => { setLabel(t); setError(''); }}
          placeholder="e.g. Spine Fusion / Shoulder Arthroplasty"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.onSurfaceTertiary, marginTop: spacing.lg }]}>INSERTS INTO</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {([
            { v: 'operative_note', label: 'Operative Note' },
            { v: 'discharge_note', label: 'Discharge Note' },
            { v: 'result', label: 'Result / Outcome' },
          ] as { v: 'result' | 'operative_note' | 'discharge_note'; label: string }[]).map((opt) => {
            const active = target === opt.v;
            return (
              <Pressable
                key={opt.v}
                testID={`target-${opt.v}`}
                onPress={() => setTarget(opt.v)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }}
              >
                <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: '600', fontSize: 12 }}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.onSurfaceTertiary, marginTop: spacing.lg }]}>TEMPLATE BODY</Text>
        <TextInput
          testID="template-body-input"
          value={body}
          onChangeText={(t) => { setBody(t); setError(''); }}
          multiline
          placeholder={`e.g.\n\nProcedure:\n- __\n\nApproach:\n- __\n\nImplants:\n- __\n\nPost-op protocol:\n- __`}
          placeholderTextColor={colors.muted}
          style={[styles.textarea, { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        />

        {!!error && <Text style={{ color: colors.error, marginTop: 8 }}>{error}</Text>}

        <View style={[styles.tip, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name="bulb-outline" size={16} color={colors.brand} />
          <Text style={{ color: colors.onBrandTertiary, fontSize: 12, flex: 1, lineHeight: 18 }}>
            Use blank <Text style={{ fontWeight: '700' }}>__</Text> as placeholders you'll fill in later. Add headings on their own line to keep it scannable.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.surface, borderTopColor: colors.divider }]}>
        <Pressable testID="save-template-btn" onPress={save} disabled={saving} style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: pressed || saving ? 0.8 : 1 }]}>
          {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 16 }}>{id ? 'Update Template' : 'Save Template'}</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, minHeight: 46 },
  textarea: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 14, minHeight: 300, textAlignVertical: 'top' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  footer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
