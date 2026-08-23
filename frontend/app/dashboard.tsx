import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api, fileUrl, Patient } from '@/src/api/client';
import { useTheme, spacing, radius } from '@/src/theme';

type SortKey =
  | 'name_asc' | 'name_desc'
  | 'age_asc' | 'age_desc'
  | 'sex' | 'mobile'
  | 'history'
  | 'dos_new' | 'dos_old'
  | 'preop_count' | 'postop_count'
  | 'result' | 'has_video';

const SORTS: { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dos_new', label: 'Newest Surgery', icon: 'time-outline' },
  { key: 'dos_old', label: 'Oldest Surgery', icon: 'hourglass-outline' },
  { key: 'name_asc', label: 'Name A–Z', icon: 'arrow-down-outline' },
  { key: 'name_desc', label: 'Name Z–A', icon: 'arrow-up-outline' },
  { key: 'age_asc', label: 'Age Asc', icon: 'chevron-up-outline' },
  { key: 'age_desc', label: 'Age Desc', icon: 'chevron-down-outline' },
  { key: 'sex', label: 'Group by Sex', icon: 'people-outline' },
  { key: 'mobile', label: 'Mobile #', icon: 'call-outline' },
  { key: 'history', label: 'History A–Z', icon: 'document-text-outline' },
  { key: 'preop_count', label: 'Most Pre-op', icon: 'images-outline' },
  { key: 'postop_count', label: 'Most Post-op', icon: 'albums-outline' },
  { key: 'result', label: 'Result A–Z', icon: 'checkmark-done-outline' },
  { key: 'has_video', label: 'With Video', icon: 'videocam-outline' },
];

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('dos_new');

  const load = useCallback(async () => {
    try {
      const list = await api.listPatients();
      setPatients(list);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let arr = patients.filter((p) => {
      if (!query) return true;
      return (
        p.name.toLowerCase().includes(query) ||
        p.mobile.includes(query) ||
        (p.history || '').toLowerCase().includes(query)
      );
    });

    const cmp = (a: Patient, b: Patient) => {
      switch (sort) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'age_asc': return a.age - b.age;
        case 'age_desc': return b.age - a.age;
        case 'sex': return (a.sex || '').localeCompare(b.sex || '');
        case 'mobile': return (a.mobile || '').localeCompare(b.mobile || '', undefined, { numeric: true });
        case 'history': return (a.history || '').localeCompare(b.history || '');
        case 'dos_new': return (b.date_of_surgery || '').localeCompare(a.date_of_surgery || '');
        case 'dos_old': return (a.date_of_surgery || '').localeCompare(b.date_of_surgery || '');
        case 'preop_count': return (b.pre_op?.length || 0) - (a.pre_op?.length || 0);
        case 'postop_count': return (b.post_op?.length || 0) - (a.post_op?.length || 0);
        case 'result': return (a.result || '').localeCompare(b.result || '');
        case 'has_video': return (b.videos?.length ? 1 : 0) - (a.videos?.length ? 1 : 0);
      }
    };
    return [...arr].sort(cmp);
  }, [patients, q, sort]);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.brandTitle, { color: colors.onSurface }]}>OrthoVault</Text>
            <Text style={[styles.brandSub, { color: colors.muted }]}>{patients.length} patient{patients.length === 1 ? '' : 's'}</Text>
          </View>
          <Pressable
            testID="settings-btn"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.surfaceTertiary, opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="dashboard-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search by name, mobile, or diagnosis"
            placeholderTextColor={colors.muted}
            style={[styles.searchInput, { color: colors.onSurface }]}
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} testID="dashboard-search-clear">
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <Pressable
                key={s.key}
                testID={`sort-chip-${s.key}`}
                onPress={() => { Haptics.selectionAsync(); setSort(s.key); }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary,
                    borderColor: active ? colors.brandPrimary : colors.border,
                  },
                ]}
              >
                <Ionicons name={s.icon} size={14} color={active ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="clipboard-outline" size={40} color={colors.brand} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No patients found</Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>
            {q ? 'Try a different search' : 'Add your first patient to get started'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          testID="patients-list"
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 + insets.bottom }}
          renderItem={({ item }) => <PatientCard patient={item} onPress={() => router.push({ pathname: '/patient/[id]', params: { id: item.id } })} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand}
            />
          }
        />
      )}

      {/* FAB */}
      <Pressable
        testID="add-patient-fab"
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/add-patient'); }}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: insets.bottom + spacing.xl,
            backgroundColor: colors.brandPrimary,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            shadowColor: isDark ? '#000' : colors.brand,
          },
        ]}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

function PatientCard({ patient, onPress }: { patient: Patient; onPress: () => void }) {
  const { colors } = useTheme();
  const preThumb = patient.pre_op?.find((f) => f.kind === 'image');
  const postThumb = patient.post_op?.find((f) => f.kind === 'image');

  return (
    <Pressable
      onPress={onPress}
      testID={`patient-card-${patient.id}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.cardLeft}>
        <Text numberOfLines={1} style={[styles.cardName, { color: colors.onSurface }]}>{patient.name}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.cardMeta, { color: colors.muted }]}>{patient.age}y • {patient.sex}</Text>
          <View style={[styles.dot, { backgroundColor: colors.borderStrong }]} />
          <Text style={[styles.cardMeta, { color: colors.muted }]} numberOfLines={1}>{patient.country_code} {patient.mobile}</Text>
        </View>
        {!!patient.date_of_surgery && (
          <View style={[styles.dosPill, { backgroundColor: colors.brandTertiary }]}>
            <Ionicons name="calendar" size={11} color={colors.onBrandTertiary} />
            <Text style={[styles.dosText, { color: colors.onBrandTertiary }]}>{patient.date_of_surgery}</Text>
          </View>
        )}
        <View style={styles.badgesRow}>
          <Badge icon="images-outline" count={patient.pre_op?.length || 0} label="Pre" color={colors.info} onBg={colors.surfaceTertiary} onText={colors.onSurfaceTertiary} />
          <Badge icon="albums-outline" count={patient.post_op?.length || 0} label="Post" color={colors.info} onBg={colors.surfaceTertiary} onText={colors.onSurfaceTertiary} />
          <Badge icon="videocam-outline" count={patient.videos?.length || 0} label="Vid" color={colors.info} onBg={colors.surfaceTertiary} onText={colors.onSurfaceTertiary} />
        </View>
      </View>

      <View style={[styles.thumbStack, { borderColor: colors.border }]}>
        {preThumb ? (
          <Image source={{ uri: fileUrl(preThumb.storage_path) }} style={styles.thumb} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.thumbPh, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="scan" size={20} color={colors.muted} />
          </View>
        )}
        {postThumb ? (
          <Image source={{ uri: fileUrl(postThumb.storage_path) }} style={[styles.thumb, styles.thumbOverlay]} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.thumbPh, styles.thumbOverlay, { backgroundColor: colors.surfaceTertiary }]}>
            <Ionicons name="scan-outline" size={20} color={colors.muted} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Badge({ icon, count, label, color, onBg, onText }: any) {
  return (
    <View style={[styles.badge, { backgroundColor: onBg }]}>
      <Ionicons name={icon} size={11} color={onText} />
      <Text style={[styles.badgeText, { color: onText }]}>{count} {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header: { paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  brandTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  brandSub: { fontSize: 13, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  searchBar: { marginHorizontal: spacing.lg, height: 44, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  chipsRow: { gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, alignItems: 'center', height: 56 },
  chip: { flexShrink: 0, height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 13, fontWeight: '600' },
  card: { flexDirection: 'row', padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, gap: spacing.md },
  cardLeft: { flex: 1, justifyContent: 'space-between' },
  cardName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cardMeta: { fontSize: 13 },
  dot: { width: 3, height: 3, borderRadius: 999 },
  dosPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, marginTop: 6 },
  dosText: { fontSize: 12, fontWeight: '600' },
  badgesRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { fontSize: 11, fontWeight: '600' },
  thumbStack: { width: 88, height: 88, position: 'relative' },
  thumb: { position: 'absolute', top: 0, left: 0, width: 64, height: 64, borderRadius: radius.md, borderWidth: 2, borderColor: '#fff' },
  thumbPh: { position: 'absolute', top: 0, left: 0, width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  thumbOverlay: { top: 22, left: 22 },
  emptyIcon: { width: 80, height: 80, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, marginTop: 4 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 60, height: 60, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
});
