import { Redirect } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/auth';
import { useTheme } from '@/src/theme';

export default function Index() {
  const { loading, user } = useAuth();
  const { colors } = useTheme();
  if (loading) return <View style={[styles.center, { backgroundColor: colors.surface }]}><ActivityIndicator color={colors.brand} /></View>;
  return <Redirect href={user ? '/dashboard' : '/login'} />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
