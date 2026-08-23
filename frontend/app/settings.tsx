import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTheme, spacing, radius, ThemeMode } from '@/src/theme';
import { useSettings, FollowupDays } from '@/src/settings';
import { useAuth } from '@/src/auth';
import { useGoogleDriveAuth, isDriveConfigured } from '@/src/utils/google-auth';
import { backupToDrive, listBackupFolders, restoreFromDrive, BackupFolder } from '@/src/utils/drive';

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();

  const drive = useGoogleDriveAuth();
  const configured = isDriveConfigured();
  const { followupDays, setFollowupDays } = useSettings();
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState<null | 'backup' | 'restore-list' | 'restore'>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [folders, setFolders] = useState<BackupFolder[] | null>(null);
  const [showRestore, setShowRestore] = useState(false);

  const modes: { value: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'light', label: 'Light', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark', icon: 'moon-outline' },
    { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  ];

  const runBackup = async () => {
    if (!drive.accessToken) return;
    setStatus(null); setProgressMsg(''); setBusy('backup');
    try {
      const result = await backupToDrive(drive.accessToken, (m) => setProgressMsg(m));
      setStatus({ ok: true, msg: `Backed up ${result.patients} patient${result.patients === 1 ? '' : 's'} & ${result.files} file${result.files === 1 ? '' : 's'} to "${result.folder.name}"` });
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message || 'Backup failed' });
    } finally {
      setBusy(null); setProgressMsg('');
    }
  };

  const openRestore = async () => {
    if (!drive.accessToken) return;
    setStatus(null); setBusy('restore-list');
    try {
      const list = await listBackupFolders(drive.accessToken);
      setFolders(list);
      setShowRestore(true);
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message || 'Failed to list backups' });
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async (folder: BackupFolder) => {
    if (!drive.accessToken) return;
    setShowRestore(false);
    setStatus(null); setBusy('restore'); setProgressMsg('');
    try {
      const result = await restoreFromDrive(drive.accessToken, folder.id, (m) => setProgressMsg(m));
      setStatus({ ok: true, msg: `Restored ${result.patients} patient${result.patients === 1 ? '' : 's'} & ${result.files} file${result.files === 1 ? '' : 's'} from "${folder.name}"` });
    } catch (e: any) {
      setStatus({ ok: false, msg: e?.message || 'Restore failed' });
    } finally {
      setBusy(null); setProgressMsg('');
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
        {user && (
          <View style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, marginBottom: 0 }]}>
            <View style={[styles.avatar, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="person" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface }]} numberOfLines={1}>{user.name || user.email}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{user.email} • {user.role}</Text>
            </View>
            <Pressable testID="logout-btn" onPress={logout} style={[styles.badgeOn, { backgroundColor: colors.error }]}>
              <Text style={{ color: colors.onError, fontSize: 11, fontWeight: '700' }}>LOG OUT</Text>
            </Pressable>
          </View>
        )}

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

        {user?.role === 'admin' && (
          <Section title="Team" colors={colors}>
            <Pressable
              testID="open-team-btn"
              onPress={() => router.push('/team')}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Ionicons name="people-outline" size={20} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: colors.onSurface }]}>Manage Team</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>See all users and change their roles</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </Section>
        )}

        <Section title="Follow-up Window" colors={colors}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: spacing.sm }}>
            Flag patients as overdue when this many days have passed since surgery without a recorded outcome.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {([30, 60, 90] as FollowupDays[]).map((d) => (
              <Pressable
                key={d}
                testID={`followup-${d}`}
                onPress={() => setFollowupDays(d)}
                style={[styles.dayChip, { backgroundColor: followupDays === d ? colors.brandPrimary : colors.surfaceSecondary, borderColor: followupDays === d ? colors.brandPrimary : colors.border }]}
              >
                <Text style={{ color: followupDays === d ? colors.onBrandPrimary : colors.onSurface, fontWeight: '700', fontSize: 15 }}>{d}</Text>
                <Text style={{ color: followupDays === d ? colors.onBrandPrimary : colors.muted, fontSize: 11, marginTop: 2 }}>days</Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Backup & Restore" colors={colors}>
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
              <Text style={[styles.rowLabel, { color: colors.onSurface }]}>Google Drive</Text>
              {drive.connected && (
                <View style={[styles.badgeOn, { backgroundColor: colors.brand }]}>
                  <Text style={{ color: colors.onBrandPrimary, fontSize: 10, fontWeight: '700' }}>CONNECTED</Text>
                </View>
              )}
            </View>

            {!configured ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
                Add your Google OAuth Client IDs to <Text style={{ fontWeight: '700' }}>frontend/.env</Text> to enable backup & restore:{"\n"}
                • EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID{"\n"}
                • EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID{"\n"}
                • EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
              </Text>
            ) : !drive.connected ? (
              <Pressable
                testID="drive-connect-btn"
                onPress={() => drive.signIn()}
                disabled={!drive.canSignIn}
                style={({ pressed }) => [styles.driveBtn, { marginTop: 10, backgroundColor: colors.brandPrimary, opacity: pressed || !drive.canSignIn ? 0.7 : 1 }]}
              >
                <Ionicons name="log-in-outline" size={16} color={colors.onBrandPrimary} />
                <Text style={{ color: colors.onBrandPrimary, fontWeight: '700' }}>Connect Google Drive</Text>
              </Pressable>
            ) : (
              <View style={{ gap: 8, marginTop: 10 }}>
                <Pressable
                  testID="drive-backup-btn"
                  onPress={runBackup}
                  disabled={!!busy}
                  style={({ pressed }) => [styles.driveBtn, { backgroundColor: colors.brandPrimary, opacity: pressed || busy ? 0.75 : 1 }]}
                >
                  {busy === 'backup' ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={16} color={colors.onBrandPrimary} />
                      <Text style={{ color: colors.onBrandPrimary, fontWeight: '700' }}>Backup Now</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  testID="drive-restore-btn"
                  onPress={openRestore}
                  disabled={!!busy}
                  style={({ pressed }) => [styles.driveBtn, { backgroundColor: colors.surfaceTertiary, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, opacity: pressed || busy ? 0.75 : 1 }]}
                >
                  {busy === 'restore-list' || busy === 'restore' ? <ActivityIndicator color={colors.onSurface} /> : (
                    <>
                      <Ionicons name="cloud-download-outline" size={16} color={colors.onSurface} />
                      <Text style={{ color: colors.onSurface, fontWeight: '700' }}>Restore from Drive</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  testID="drive-signout-btn"
                  onPress={() => drive.signOut()}
                  style={({ pressed }) => [styles.driveBtn, { backgroundColor: 'transparent', opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={{ color: colors.muted, fontWeight: '600', fontSize: 13 }}>Sign out of Google</Text>
                </Pressable>
              </View>
            )}

            {!!progressMsg && (
              <View style={[styles.statusMsg, { backgroundColor: colors.surfaceTertiary }]}>
                <ActivityIndicator color={colors.brand} size="small" />
                <Text style={{ color: colors.onSurface, fontSize: 12, flex: 1 }}>{progressMsg}</Text>
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

      {/* Restore folder picker modal */}
      <Modal visible={showRestore} transparent animationType="slide" onRequestClose={() => setShowRestore(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Choose Backup to Restore</Text>
              <Pressable testID="restore-close" onPress={() => setShowRestore(false)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            {folders && folders.length === 0 && (
              <Text style={{ color: colors.muted, paddingVertical: spacing.lg, textAlign: 'center' }}>
                No OrthoVault backups found in your Drive
              </Text>
            )}
            <ScrollView style={{ maxHeight: 400 }}>
              {folders?.map((f) => (
                <Pressable
                  key={f.id}
                  testID={`restore-folder-${f.id}`}
                  onPress={() => doRestore(f)}
                  style={({ pressed }) => [styles.folderRow, { backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: colors.border }]}
                >
                  <Ionicons name="folder" size={22} color={colors.brand} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{f.name}</Text>
                    {!!f.createdTime && <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{new Date(f.createdTime).toLocaleString()}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  folderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  dayChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md },
});
