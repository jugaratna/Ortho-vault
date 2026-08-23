import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api } from '@/src/api/client';
import { useAuth, Role } from '@/src/auth';
import { useTheme, spacing, radius } from '@/src/theme';

type TeamUser = { user_id: string; email: string; name: string; picture: string; role: Role };

const ROLE_META: Record<Role, { label: string; icon: keyof typeof Ionicons.glyphMap; desc: string }> = {
  admin: { label: 'Admin', icon: 'shield-checkmark', desc: 'Full access — patients, files, team, delete' },
  editor: { label: 'Editor', icon: 'create-outline', desc: 'Can add & edit their own patients + upload media' },
  viewer: { label: 'Viewer', icon: 'eye-outline', desc: 'Read-only access — cannot add, edit, or delete' },
};

export default function Team() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<TeamUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await api.listUsers();
      setUsers(list);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'admin') load(); }, [user, load]);

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

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <Pressable testID="team-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Team</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{users.length} member{users.length === 1 ? '' : 's'}</Text>
        </View>
        <View style={{ width: 40 }} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
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
});
