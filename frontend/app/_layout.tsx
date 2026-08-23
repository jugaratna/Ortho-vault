import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useIconFonts } from '@/src/hooks/use-icon-fonts';
import { ThemeProvider, useTheme } from '@/src/theme';
import { SettingsProvider } from '@/src/settings';
import { AuthProvider, useAuth } from '@/src/auth';

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function RootNav() {
  const { isDark, colors } = useTheme();
  const { loading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === 'login';
    if (!user && !onLogin) router.replace('/login');
    else if (user && onLogin) router.replace('/dashboard');
  }, [loading, user, segments, router]);

  if (loading) return null;
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: 'slide_from_right',
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();

  useEffect(() => {
    if (iconsLoaded || iconsError) {
      SplashScreen.hideAsync();
    }
  }, [iconsLoaded, iconsError]);

  if (!iconsLoaded && !iconsError) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SettingsProvider>
            <AuthProvider>
              <RootNav />
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
