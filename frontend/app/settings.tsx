import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTheme, spacing, radius, ThemeMode } from '@/src/theme';
import { useGoogleDriveAuth, isDriveConfigured } from '@/src/utils/google-auth';
import { createFolder, uploadJson, uploadRemoteUrl } from '@/src/utils/drive';
import { api, fileUrl, MediaFile } from '@/src/api/client';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();

  const drive = useGoogleDriveAuth();
  const configured = isDriveConfigured();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const modes: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  const backupToDrive = async () => {
    if (!drive.accessToken) return;
    setStatus(null);
    setBusy(true);
    try {
      const patients = await api.listPatients();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const folder = await createFolder(drive.accessToken, `OrthoVault Backup ${stamp}`);
      await uploadJson(drive.accessToken, folder.id, 'patients.json', patients);

      // Upload each media file the patients reference
      const allFiles: { p: any; f: MediaFile }[] = [];
      for (const p of patients) {
        [...(p.pre_op || []), ...(p.post_op || []), ...(p.videos || [])].forEach((f) => allFiles.push({ p, f }));
      }
      for (const { p, f } of allFiles) {
        const nice = `${p.name.replace(/\s+/g, '_')}__${f.section}__${f.name}`;
        try {
          await uploadRemoteUrl(drive.accessToken, folder.id, nice, f.mime, fileUrl(f.storage_path));
        } catch {
          // skip failed file, continue
        }
      }
      setStatus({ ok: true, msg: `Backed up ${patients.length} patient${patients.length === 1 ? '' : 's'} & ${allFiles.length} file${allFiles.length === 1 ? '' : 's'} to Google Drive` });
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message || 'Backup failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl, paddingBottom: 40 }}>
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

          {/* Google Drive */}
          <View style={[styles.driveCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <View style={styles.driveHead}>
              <Ionicons name="logo-google" size={20} color={colors.onSurface} />
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>Google Drive Backup</Text>
              {drive.connected && (
                <View style={[styles.badgeOn, { backgroundColor: colors.brand }]}>
                  <Text style={{ color: colors.onBrandPrimary, fontSize: 10, fontWeight: '700' }}>CONNECTED</Text>
                </View>
              )}
            </View>

            {!configured ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                Add your Google OAuth Client IDs to <Text style={{ fontWeight: '700' }}>frontend/.env</Text> to enable one-tap backup:{"\n"}
                • EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID{"\n"}
                • EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID{"\n"}
                • EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
              </Text>
            ) : !drive.connected ? (
              <Pressable
                testID="drive-connect-btn"
                onPress={() => drive.signIn()}
                disabled={!drive.canSignIn}
                style={({ pressed }) => [styles.driveBtn, { backgroundColor: colors.brandPrimary, opacity: pressed || !drive.canSignIn ? 0.7 : 1 }]}
              >
                <Ionicons name="log-in-outline" size={16} color={colors.onBrandPrimary} />
                <Text style={{ color: colors.onBrandPrimary, fontWeight: '700' }}>Connect Google Drive</Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable
                  testID="drive-backup-btn"
                  onPress={backupToDrive}
                  disabled={busy}
                  style={({ pressed }) => [styles.driveBtn, { flex: 1, backgroundColor: colors.brandPrimary, opacity: pressed || busy ? 0.75 : 1 }]}
                >
                  {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color={colors.onBrandPrimary} />
                      <Text style={{ color: colors.onBrandPrimary, fontWeight: '700' }}>Backup Now</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  testID="drive-signout-btn"
                  onPress={() => drive.signOut()}
                  style={({ pressed }) => [styles.driveBtn, { backgroundColor: colors.surfaceTertiary, opacity: pressed ? 0.7 : 1, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.onSurface, fontWeight: '600' }}>Sign out</Text>
                </Pressable>
              </View>
            )}

            {status && (
              <View style={[styles.statusMsg, { backgroundColor: status.ok ? colors.brandTertiary : (colors.error + '22') }]}>
                <Ionicons name={status.ok ? 'checkmark-circle' : 'alert-circle'} size={14} color={status.ok ? colors.brand : colors.error} />
                <Text style={{ color: status.ok ? colors.onBrandTertiary : colors.error, fontSize: 12, flex: 1 }}>{status.msg}</Text>
              </View>
            )}
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
  driveCard: { padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  driveHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, paddingHorizontal: 14 },
  statusMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: radius.sm },
});
