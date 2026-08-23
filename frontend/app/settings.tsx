import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, radius, ThemeMode } from '@/src/theme';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();

  const modes: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Section title="Appearance" colors={colors}>
          <View style={{ gap: spacing.sm }}>
            {modes.map((m) => (
              <Pressable
                key={m.value}
                testID={`theme-${m.value}`}
                onPress={() => setMode(m.value)}
                style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: mode === m.value ? colors.brand : colors.border }]}
              >
                <Ionicons name={m.icon} size={20} color={colors.onSurface} />
                <Text style={[styles.rowLabel, { color: colors.onSurface }]}>{m.label}</Text>
                {mode === m.value && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Backup" colors={colors}>
          <View style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="cloud-outline" size={20} color={colors.onSurface} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>Cloud Sync</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>All records synced to secure backend</Text>
            </View>
            <View style={[styles.badgeOn, { backgroundColor: colors.success }]}>
              <Text style={{ color: colors.onSuccess, fontSize: 11, fontWeight: '700' }}>ACTIVE</Text>
            </View>
          </View>
          <View style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="logo-google" size={20} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.muted }]}>Google Drive Backup</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Coming soon</Text>
            </View>
          </View>
        </Section>

        <Section title="About" colors={colors}>
          <View style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="medkit" size={20} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>OrthoVault</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>v1.0 • For Orthopedic Surgeons</Text>
            </View>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, colors, children }: any) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  badgeOn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
});
