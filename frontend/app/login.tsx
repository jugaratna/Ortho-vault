import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/src/auth';
import { useTheme, spacing, radius } from '@/src/theme';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  editor: 'Editor',
  viewer: 'Viewer',
};

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const params = useLocalSearchParams<{ invite?: string; role?: string }>();

  // Read query params once — Expo Router surfaces them on web too
  const inviteEmail = (typeof params.invite === 'string' ? params.invite : '').trim().toLowerCase();
  const inviteRole = (typeof params.role === 'string' ? params.role : '').trim().toLowerCase();
  const hasInvite = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail);

  useEffect(() => {
    // If already signed in with matching email, backend already applied the role — nothing to do
  }, []);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;
  }
  if (user) return <Redirect href="/dashboard" />;

  const onSignIn = async () => {
    setBusy(true);
    try { await signInWithGoogle(); } finally { setBusy(false); }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={styles.inner}>
        <View style={[styles.logoWrap, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name="medkit" size={40} color={colors.brand} />
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>OrthoVault</Text>
        <Text style={[styles.sub, { color: colors.muted }]}>Secure patient records for orthopedic surgeons</Text>

        {hasInvite && (
          <View testID="invite-welcome" style={[styles.inviteCard, { backgroundColor: colors.brandTertiary, borderColor: colors.brand + '55' }]}>
            <View style={[styles.inviteIcon, { backgroundColor: colors.brandPrimary }]}>
              <Ionicons name="mail-open" size={18} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: '800' }}>Welcome to OrthoVault</Text>
              <Text style={{ color: colors.onSurface, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                Sign in with <Text style={{ fontWeight: '700' }}>{inviteEmail}</Text> to join as{' '}
                <Text style={{ fontWeight: '700' }}>{ROLE_LABEL[inviteRole] || 'Editor'}</Text>.
              </Text>
            </View>
          </View>
        )}

        <Pressable
          testID="google-signin-btn"
          onPress={onSignIn}
          disabled={busy}
          style={({ pressed }) => [styles.gBtn, { backgroundColor: colors.onSurface, opacity: pressed || busy ? 0.85 : 1 }]}
        >
          {busy ? <ActivityIndicator color={colors.surface} /> : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.surface} />
              <Text style={[styles.gTxt, { color: colors.surface }]}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {!hasInvite && (
          <Text style={[styles.footer, { color: colors.muted }]}>
            The first person to sign in becomes the clinic admin. Additional users default to editors and can be promoted from the Team screen.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { width: 84, height: 84, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  sub: { fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.xl, textAlign: 'center', paddingHorizontal: 20 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, marginBottom: spacing.xl, maxWidth: 360 },
  inviteIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 22, borderRadius: radius.md, minWidth: 280 },
  gTxt: { fontSize: 16, fontWeight: '700' },
  footer: { marginTop: spacing['2xl'], fontSize: 12, textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },
});
