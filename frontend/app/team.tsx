import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal, RefreshControl,
  TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { api, BACKEND_URL } from '@/src/api/client';
import { useAuth, Role } from '@/src/auth';
import { useTheme, spacing, radius } from '@/src/theme';

type TeamUser = { user_id: string; email: string; name: string; picture: string; role: Role; last_active?: string | null };
type Invite = { email: string; role: Role; invited_at?: string | null };

const ROLE_META: Record<Role, { label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }> = {
  admin: { label: 'Admin', icon: 'shield-checkmark', desc: 'Full access — patients, files, team, delete' },
  editor: { label: 'Editor', icon: 'create-outline', desc: 'Can add & edit their own patients + upload media' },
  viewer: { label: 'Viewer', icon: 'eye-outline', desc: 'Read-only access — cannot add, edit, or delete' },
};

function timeAgo(iso?: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const IDLE_THRESHOLD_DAYS = 30;
function isIdle(iso?: string | null): boolean {
  if (!iso) return true; // never signed in / never active
  const then = new Date(iso).getTime();
  if (isNaN(then)) return false;
  const days = (Date.now() - then) / (1000 * 60 * 60 * 24);
  return days >= IDLE_THRESHOLD_DAYS;
}

function inviteLink(): string {
  // Prefer the current runtime origin (works on web), else the configured backend URL host
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/login`;
  }
  if (BACKEND_URL) {
    try {
      const u = new URL(BACKEND_URL);
      return `${u.protocol}//${u.host}/login`;
    } catch {
      return `${BACKEND_URL}/login`;
    }
  }
  return Linking.createURL('/login');
}

export default function Team() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<'single' | 'bulk'>('single');
  const [inviteEmail, setInviteEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteErr, setInviteErr] = useState('');
  const [lastInvited, setLastInvited] = useState<{ email: string; role: Role; emailed?: boolean } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ invited: number; updated: number; invalid: string[]; emailed: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, invs] = await Promise.all([api.listUsers(), api.listInvites().catch(() => [])]);
      setUsers(list);
      setInvites(invs);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load team');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'admin') load(); }, [user, load]);

  const link = useMemo(() => inviteLink(), []);

  if (authLoading) return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'admin') return <Redirect href="/dashboard" />;

  const changeRole = async (target: TeamUser, role: Role) => {
    if (target.user_id === user.user_id && role !== 'admin') {
      setError("You can't demote yourself while signed in.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.updateUserRole(target.user_id, role);
      setUsers((cur) => cur.map((u) => (u.user_id === target.user_id ? { ...u, role } : u)));
      setEditing(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message || 'Failed to update role');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    setInviteErr('');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteErr('Enter a valid email address');
      return;
    }
    setInviteSending(true);
    try {
      const inv = await api.createInvite(email, inviteRole);
      setLastInvited({ email: inv.email, role: inv.role as Role, emailed: inv.emailed });
      setInviteEmail('');
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setInviteErr(e?.message || 'Could not create invite');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setInviteSending(false);
    }
  };

  const sendBulkInvite = async () => {
    setInviteErr('');
    // Parse emails from newlines, commas, semicolons, or spaces
    const emails = bulkEmails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setInviteErr('Paste at least one email address');
      return;
    }
    if (emails.length > 100) {
      setInviteErr('Please limit to 100 emails per bulk invite');
      return;
    }
    setInviteSending(true);
    try {
      const res = await api.bulkInvite(emails, inviteRole);
      setBulkResult({
        invited: res.invited.length,
        updated: res.updated.length,
        invalid: res.invalid,
        emailed: res.emailed,
      });
      setBulkEmails('');
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setInviteErr(e?.message || 'Bulk invite failed');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setInviteSending(false);
    }
  };

  const copyLink = async () => {
    try {
      const msg = lastInvited
        ? `You're invited to OrthoVault as ${ROLE_META[lastInvited.role].label}. Sign in with your Google account (${lastInvited.email}) at: ${link}`
        : link;
      await Clipboard.setStringAsync(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Copied', 'Invite link copied to clipboard. Share it with your colleague.');
    } catch {
      Alert.alert('Copy failed', 'Please long-press the link to copy manually.');
    }
  };

  const revokeInvite = (email: string) => {
    Alert.alert('Revoke invite?', `Cancel the pending invite for ${email}?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          try {
            await api.deleteInvite(email);
            setInvites((cur) => cur.filter((i) => i.email !== email));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Could not revoke invite');
          }
        }
      },
    ]);
  };

  const closeInvite = () => {
    setInviteOpen(false);
    setInviteEmail('');
    setBulkEmails('');
    setInviteErr('');
    setLastInvited(null);
    setBulkResult(null);
    setInviteRole('editor');
    setInviteMode('single');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <Pressable testID="team-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Team</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {users.length} member{users.length === 1 ? '' : 's'}{invites.length ? ` · ${invites.length} pending` : ''}
          </Text>
        </View>
        <Pressable
          testID="team-invite-btn"
          onPress={() => { setInviteOpen(true); Haptics.selectionAsync(); }}
          style={({ pressed }) => [styles.inviteBtn, { backgroundColor: pressed ? colors.brandSecondary : colors.brandPrimary }]}
        >
          <Ionicons name="person-add" size={16} color={colors.onBrandPrimary} />
          <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 13 }}>Invite</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brand} />}
        >
          {!!error && (
            <View style={[styles.errBanner, { backgroundColor: colors.error + '22', borderColor: colors.error }]}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 12, flex: 1 }}>{error}</Text>
            </View>
          )}

          {invites.length > 0 && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>PENDING INVITES</Text>
              {invites.map((inv) => {
                const meta = ROLE_META[inv.role];
                return (
                  <View
                    key={inv.email}
                    testID={`invite-${inv.email}`}
                    style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderStyle: 'dashed' }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: colors.brandTertiary }]}>
                      <Ionicons name="mail-unread-outline" size={20} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: colors.onSurface, fontWeight: '700', fontSize: 15 }}>{inv.email}</Text>
                      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        Invited {timeAgo(inv.invited_at)}
                      </Text>
                    </View>
                    <View style={[styles.rolePill, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
                      <Ionicons name={meta.icon} size={12} color={colors.onSurface} />
                      <Text style={{ color: colors.onSurface, fontSize: 11, fontWeight: '700' }}>{meta.label}</Text>
                    </View>
                    <Pressable
                      testID={`revoke-${inv.email}`}
                      onPress={() => revokeInvite(inv.email)}
                      style={({ pressed }) => [styles.iconBtnSm, { opacity: pressed ? 0.5 : 1 }]}
                      hitSlop={8}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.muted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.muted }]}>MEMBERS</Text>
          {users.map((u) => {
            const meta = ROLE_META[u.role];
            const self = u.user_id === user.user_id;
            return (
              <Pressable
                key={u.user_id}
                testID={`team-user-${u.user_id}`}
                onPress={() => setEditing(u)}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: colors.brandTertiary }]}>
                  <Ionicons name="person" size={20} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text numberOfLines={1} style={{ color: colors.onSurface, fontWeight: '700', fontSize: 15 }}>{u.name || u.email}</Text>
                    {self && <View style={[styles.youChip, { backgroundColor: colors.brandPrimary }]}><Text style={{ color: colors.onBrandPrimary, fontSize: 9, fontWeight: '800' }}>YOU</Text></View>}
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{u.email}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                    Active {timeAgo(u.last_active)}
                  </Text>
                </View>
                {isIdle(u.last_active) && !self && (
                  <View style={[styles.idleBadge, { backgroundColor: colors.warning + '22', borderColor: colors.warning }]} testID={`idle-${u.user_id}`}>
                    <Ionicons name="moon-outline" size={10} color={colors.warning} />
                    <Text style={{ color: colors.warning, fontSize: 10, fontWeight: '800' }}>IDLE</Text>
                  </View>
                )}
                <View style={[styles.rolePill, { backgroundColor: u.role === 'admin' ? colors.brandPrimary : colors.surfaceTertiary, borderColor: u.role === 'admin' ? colors.brandPrimary : colors.border }]}>
                  <Ionicons name={meta.icon} size={12} color={u.role === 'admin' ? colors.onBrandPrimary : colors.onSurface} />
                  <Text style={{ color: u.role === 'admin' ? colors.onBrandPrimary : colors.onSurface, fontSize: 11, fontWeight: '700' }}>{meta.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Change role modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Change Role</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {editing?.name || editing?.email}
                </Text>
              </View>
              <Pressable testID="team-modal-close" onPress={() => setEditing(null)}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            {(['admin', 'editor', 'viewer'] as Role[]).map((r) => {
              const meta = ROLE_META[r];
              const active = editing?.role === r;
              return (
                <Pressable
                  key={r}
                  testID={`role-${r}`}
                  onPress={() => editing && changeRole(editing, r)}
                  disabled={saving}
                  style={({ pressed }) => [styles.roleRow, { backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border }]}
                >
                  <View style={[styles.roleIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name={meta.icon} size={20} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: '700' }}>{meta.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{meta.desc}</Text>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={colors.brand} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
                </Pressable>
              );
            })}
            {saving && <View style={{ paddingTop: spacing.md, alignItems: 'center' }}><ActivityIndicator color={colors.brand} /></View>}
          </View>
        </View>
      </Modal>

      {/* Invite modal */}
      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={closeInvite}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                  {lastInvited ? 'Invite ready' : bulkResult ? 'Bulk invite done' : 'Invite colleagues'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {lastInvited
                    ? 'They\'ll get an email with the sign-in link. You can also share it manually.'
                    : bulkResult
                    ? 'Everyone below has been pre-authorized on their next Google sign-in.'
                    : 'Pre-authorize colleagues so they get the right role on first Google sign-in.'}
                </Text>
              </View>
              <Pressable testID="invite-modal-close" onPress={closeInvite}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            {!lastInvited && !bulkResult && (
              <View style={[styles.tabRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                {(['single', 'bulk'] as const).map((m) => {
                  const active = inviteMode === m;
                  return (
                    <Pressable
                      key={m}
                      testID={`invite-tab-${m}`}
                      onPress={() => { setInviteMode(m); setInviteErr(''); Haptics.selectionAsync(); }}
                      style={[styles.tab, active && { backgroundColor: colors.brandPrimary }]}
                    >
                      <Ionicons name={m === 'single' ? 'person-outline' : 'people-outline'} size={14} color={active ? colors.onBrandPrimary : colors.onSurface} />
                      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: '700', fontSize: 13 }}>
                        {m === 'single' ? 'Single' : 'Bulk paste'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {!lastInvited && !bulkResult ? (
              <>
                {inviteMode === 'single' ? (
                  <>
                    <Text style={[styles.inputLabel, { color: colors.muted }]}>Email</Text>
                    <TextInput
                      testID="invite-email-input"
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      placeholder="colleague@hospital.com"
                      placeholderTextColor={colors.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!inviteSending}
                      style={[styles.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.inputLabel, { color: colors.muted }]}>Emails</Text>
                    <TextInput
                      testID="invite-bulk-input"
                      value={bulkEmails}
                      onChangeText={setBulkEmails}
                      placeholder={"Paste one email per line, or separate with commas.\ne.g.\ndr.smith@hospital.com\ndr.patel@hospital.com"}
                      placeholderTextColor={colors.muted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      multiline
                      editable={!inviteSending}
                      style={[styles.input, styles.textarea, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.onSurface }]}
                    />
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                      Up to 100 emails per bulk invite. Duplicates &amp; existing team members are skipped.
                    </Text>
                  </>
                )}

                <Text style={[styles.inputLabel, { color: colors.muted, marginTop: spacing.md }]}>Role on join</Text>
                <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
                  {(['admin', 'editor', 'viewer'] as Role[]).map((r) => {
                    const meta = ROLE_META[r];
                    const active = inviteRole === r;
                    return (
                      <Pressable
                        key={r}
                        testID={`invite-role-${r}`}
                        onPress={() => { setInviteRole(r); Haptics.selectionAsync(); }}
                        disabled={inviteSending}
                        style={({ pressed }) => [styles.roleRow, { backgroundColor: pressed ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: active ? colors.brand : colors.border, marginBottom: 0 }]}
                      >
                        <View style={[styles.roleIcon, { backgroundColor: colors.brandTertiary }]}>
                          <Ionicons name={meta.icon} size={20} color={colors.brand} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: '700' }}>{meta.label}</Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{meta.desc}</Text>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={22} color={colors.brand} />}
                      </Pressable>
                    );
                  })}
                </View>

                {!!inviteErr && (
                  <View style={[styles.errBanner, { backgroundColor: colors.error + '22', borderColor: colors.error, marginTop: spacing.md }]}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={{ color: colors.error, fontSize: 12, flex: 1 }}>{inviteErr}</Text>
                  </View>
                )}

                <Pressable
                  testID="invite-send-btn"
                  onPress={inviteMode === 'single' ? sendInvite : sendBulkInvite}
                  disabled={inviteSending}
                  style={({ pressed }) => [styles.primaryBtn, { backgroundColor: pressed ? colors.brandSecondary : colors.brandPrimary, opacity: inviteSending ? 0.6 : 1, marginTop: spacing.lg }]}
                >
                  {inviteSending
                    ? <ActivityIndicator color={colors.onBrandPrimary} />
                    : <>
                      <Ionicons name="paper-plane-outline" size={16} color={colors.onBrandPrimary} />
                      <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 15 }}>
                        {inviteMode === 'single' ? 'Send invite' : 'Send bulk invites'}
                      </Text>
                    </>}
                </Pressable>
              </>
            ) : lastInvited ? (
              <>
                <View style={[styles.successCard, { backgroundColor: colors.success + '15', borderColor: colors.success + '55' }]}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{lastInvited.email}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Pre-authorized as {ROLE_META[lastInvited.role].label}</Text>
                  </View>
                </View>

                <View style={[styles.emailStatus, { backgroundColor: (lastInvited.emailed ? colors.success : colors.warning) + '15', borderColor: (lastInvited.emailed ? colors.success : colors.warning) + '55' }]}>
                  <Ionicons name={lastInvited.emailed ? 'mail' : 'mail-unread-outline'} size={16} color={lastInvited.emailed ? colors.success : colors.warning} />
                  <Text style={{ color: colors.onSurface, fontSize: 12, flex: 1 }}>
                    {lastInvited.emailed
                      ? 'Invite email sent to their inbox.'
                      : "Couldn't send the email automatically — share the link below manually."}
                  </Text>
                </View>

                <Text style={[styles.inputLabel, { color: colors.muted, marginTop: spacing.md }]}>Sign-in link</Text>
                <View style={[styles.linkBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text selectable numberOfLines={2} style={{ color: colors.onSurface, fontSize: 13, flex: 1 }}>{link}</Text>
                </View>

                <Pressable
                  testID="invite-copy-btn"
                  onPress={copyLink}
                  style={({ pressed }) => [styles.primaryBtn, { backgroundColor: pressed ? colors.brandSecondary : colors.brandPrimary, marginTop: spacing.md }]}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.onBrandPrimary} />
                  <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 15 }}>Copy invite message</Text>
                </Pressable>

                <Pressable
                  testID="invite-another-btn"
                  onPress={() => { setLastInvited(null); setBulkResult(null); }}
                  style={({ pressed }) => [styles.ghostBtn, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceTertiary : 'transparent', marginTop: spacing.sm }]}
                >
                  <Ionicons name="person-add-outline" size={16} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontWeight: '600', fontSize: 14 }}>Invite another</Text>
                </Pressable>
              </>
            ) : bulkResult ? (
              <>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                  <View style={[styles.statCard, { backgroundColor: colors.brandTertiary, borderColor: colors.brand + '33' }]}>
                    <Text style={{ color: colors.brand, fontSize: 22, fontWeight: '800' }}>{bulkResult.invited}</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 11, fontWeight: '600' }}>Invited</Text>
                  </View>
                  <View style={[styles.statCard, { backgroundColor: colors.success + '15', borderColor: colors.success + '55' }]}>
                    <Text style={{ color: colors.success, fontSize: 22, fontWeight: '800' }}>{bulkResult.emailed}</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 11, fontWeight: '600' }}>Emailed</Text>
                  </View>
                  {bulkResult.updated > 0 && (
                    <View style={[styles.statCard, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '55' }]}>
                      <Text style={{ color: colors.warning, fontSize: 22, fontWeight: '800' }}>{bulkResult.updated}</Text>
                      <Text style={{ color: colors.onSurface, fontSize: 11, fontWeight: '600' }}>Updated</Text>
                    </View>
                  )}
                </View>

                {bulkResult.invalid.length > 0 && (
                  <View style={[styles.errBanner, { backgroundColor: colors.error + '15', borderColor: colors.error + '55', marginBottom: spacing.md, alignItems: 'flex-start' }]}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>{bulkResult.invalid.length} invalid skipped</Text>
                      <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }} numberOfLines={3}>{bulkResult.invalid.join(', ')}</Text>
                    </View>
                  </View>
                )}

                <Pressable
                  testID="invite-copy-btn"
                  onPress={copyLink}
                  style={({ pressed }) => [styles.primaryBtn, { backgroundColor: pressed ? colors.brandSecondary : colors.brandPrimary }]}
                >
                  <Ionicons name="copy-outline" size={16} color={colors.onBrandPrimary} />
                  <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 15 }}>Copy sign-in link</Text>
                </Pressable>

                <Pressable
                  testID="invite-another-btn"
                  onPress={() => { setBulkResult(null); setLastInvited(null); }}
                  style={({ pressed }) => [styles.ghostBtn, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceTertiary : 'transparent', marginTop: spacing.sm }]}
                >
                  <Ionicons name="people-outline" size={16} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontWeight: '600', fontSize: 14 }}>Invite more</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  iconBtnSm: { padding: 4 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, minHeight: 36 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: spacing.sm },
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  youChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  roleIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.md },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  successCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  linkBox: { padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, minHeight: 48, justifyContent: 'center' },
  idleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth, marginRight: 4 },
  tabRow: { flexDirection: 'row', padding: 4, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: radius.sm },
  textarea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
  emailStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm },
  statCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
});
