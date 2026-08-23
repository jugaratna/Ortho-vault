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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('editor');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteErr, setInviteErr] = useState('');
  const [lastInvited, setLastInvited] = useState<Invite | null>(null);

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
      setLastInvited(inv);
      setInviteEmail('');
      // Refresh invites & users (if the address already existed as a user, role would flip)
      await load();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setInviteErr(e?.message || 'Could not create invite');
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
    setInviteErr('');
    setLastInvited(null);
    setInviteRole('editor');
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
                  {lastInvited ? 'Invite ready' : 'Invite colleague'}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                  {lastInvited
                    ? 'Share the link below. They must sign in with Google using the invited email.'
                    : 'Pre-authorize an email so they get the right role on first Google sign-in.'}
                </Text>
              </View>
              <Pressable testID="invite-modal-close" onPress={closeInvite}>
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>

            {!lastInvited ? (
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
                  onPress={sendInvite}
                  disabled={inviteSending}
                  style={({ pressed }) => [styles.primaryBtn, { backgroundColor: pressed ? colors.brandSecondary : colors.brandPrimary, opacity: inviteSending ? 0.6 : 1, marginTop: spacing.lg }]}
                >
                  {inviteSending
                    ? <ActivityIndicator color={colors.onBrandPrimary} />
                    : <>
                      <Ionicons name="paper-plane-outline" size={16} color={colors.onBrandPrimary} />
                      <Text style={{ color: colors.onBrandPrimary, fontWeight: '700', fontSize: 15 }}>Create invite</Text>
                    </>}
                </Pressable>
              </>
            ) : (
              <>
                <View style={[styles.successCard, { backgroundColor: colors.success + '15', borderColor: colors.success + '55' }]}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{lastInvited.email}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Pre-authorized as {ROLE_META[lastInvited.role].label}</Text>
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: colors.muted, marginTop: spacing.md }]}>Invite link</Text>
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
                  onPress={() => { setLastInvited(null); }}
                  style={({ pressed }) => [styles.ghostBtn, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceTertiary : 'transparent', marginTop: spacing.sm }]}
                >
                  <Ionicons name="person-add-outline" size={16} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontWeight: '600', fontSize: 14 }}>Invite another</Text>
                </Pressable>
              </>
            )}
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
});
