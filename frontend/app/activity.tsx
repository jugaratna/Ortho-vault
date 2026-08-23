import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ActivityEvent } from '@/src/api/client';
import { useAuth } from '@/src/auth';
import { useTheme, spacing, radius } from '@/src/theme';

const ACTION_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: 'brand' | 'success' | 'warning' | 'error' | 'muted'; label: string; verb: string }> = {
  create: { icon: 'add-circle', color: 'success', label: 'Created', verb: 'created' },
  update: { icon: 'create', color: 'brand', label: 'Updated', verb: 'updated' },
  delete: { icon: 'trash', color: 'error', label: 'Deleted', verb: 'deleted' },
  share: { icon: 'people', color: 'brand', label: 'Shared', verb: 'shared' },
  unshare: { icon: 'person-remove', color: 'warning', label: 'Unshared', verb: 'stopped sharing' },
  media_added: { icon: 'images', color: 'brand', label: 'Media', verb: 'added media to' },
};

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
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
  return new Date(iso).toLocaleDateString();
}

export default function Activity() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'share'>('all');

  const load = useCallback(async () => {
    try {
      const list = await api.listActivity(200);
      setEvents(list);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (user?.role === 'admin') load(); }, [user, load]);

  if (authLoading) return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;
  if (!user) return <Redirect href="/login" />;
  if (user.role !== 'admin') return <Redirect href="/dashboard" />;

  const filtered = events.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'share') return e.action === 'share' || e.action === 'unshare';
    return e.action === filter;
  });

  const colorFor = (name: 'brand' | 'success' | 'warning' | 'error' | 'muted') => {
    switch (name) {
      case 'success': return colors.success;
      case 'warning': return colors.warning;
      case 'error': return colors.error;
      case 'muted': return colors.muted;
      default: return colors.brand;
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.divider }]}>
        <Pressable testID="activity-back-btn" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Activity</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{filtered.length} event{filtered.length === 1 ? '' : 's'}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {([
          { key: 'all' as const, label: 'All', icon: 'apps-outline' as const },
          { key: 'create' as const, label: 'Created', icon: 'add-circle-outline' as const },
          { key: 'update' as const, label: 'Updated', icon: 'create-outline' as const },
          { key: 'delete' as const, label: 'Deleted', icon: 'trash-outline' as const },
          { key: 'share' as const, label: 'Sharing', icon: 'people-outline' as const },
        ]).map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              testID={`activity-filter-${f.key}`}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, { backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }]}
            >
              <Ionicons name={f.icon} size={13} color={active ? colors.onBrandPrimary : colors.onSurface} />
              <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontSize: 12, fontWeight: '700' }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

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

          {filtered.length === 0 && !error && (
            <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
              <Ionicons name="time-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: spacing.md }}>No activity yet</Text>
            </View>
          )}

          {filtered.map((ev) => {
            const meta = ACTION_META[ev.action] || { icon: 'ellipse', color: 'muted' as const, label: ev.action, verb: ev.action };
            const c = colorFor(meta.color);
            const targetEmail = ev.meta?.target_email || '';
            const scope = ev.meta?.scope || '';
            const count = ev.meta?.count || 0;
            const canOpen = ev.action !== 'delete' && !!ev.entity_id;
            return (
              <Pressable
                key={ev.id}
                testID={`activity-${ev.id}`}
                disabled={!canOpen}
                onPress={() => canOpen && router.push({ pathname: '/patient/[id]', params: { id: ev.entity_id } })}
                style={({ pressed }) => [styles.eventRow, { backgroundColor: pressed && canOpen ? colors.surfaceTertiary : colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <View style={[styles.evIcon, { backgroundColor: c + '22' }]}>
                  <Ionicons name={meta.icon} size={18} color={c} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ color: colors.onSurface, fontSize: 14, lineHeight: 20 }}>
                    <Text style={{ fontWeight: '700' }}>{ev.actor_name || 'Someone'}</Text>
                    {' '}<Text style={{ color: colors.muted }}>{meta.verb}</Text>{' '}
                    <Text style={{ fontWeight: '700' }}>{ev.entity_name || '(patient)'}</Text>
                    {ev.action === 'share' && targetEmail ? (
                      <Text style={{ color: colors.muted }}>{` with ${targetEmail}${scope ? ` (${scope})` : ''}`}</Text>
                    ) : ev.action === 'unshare' && targetEmail ? (
                      <Text style={{ color: colors.muted }}>{` with ${targetEmail}`}</Text>
                    ) : ev.action === 'media_added' && count ? (
                      <Text style={{ color: colors.muted }}>{` (${count} file${count === 1 ? '' : 's'})`}</Text>
                    ) : null}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{timeAgo(ev.at)}</Text>
                </View>
                {canOpen && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  filters: { paddingHorizontal: spacing.md, gap: spacing.sm, paddingVertical: spacing.sm },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.sm },
  evIcon: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
