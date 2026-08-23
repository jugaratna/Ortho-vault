import { useColorScheme } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

export const lightColors = {
  surface: '#F8FAFC',
  onSurface: '#0F172A',
  surfaceSecondary: '#FFFFFF',
  onSurfaceSecondary: '#1E293B',
  surfaceTertiary: '#F1F5F9',
  onSurfaceTertiary: '#334155',
  surfaceInverse: '#0F172A',
  onSurfaceInverse: '#F8FAFC',
  brand: '#0F766E',
  brandPrimary: '#0F766E',
  onBrandPrimary: '#FFFFFF',
  brandSecondary: '#14B8A6',
  onBrandSecondary: '#FFFFFF',
  brandTertiary: '#CCFBF1',
  onBrandTertiary: '#115E59',
  success: '#059669',
  onSuccess: '#FFFFFF',
  warning: '#CA8A04',
  onWarning: '#FFFFFF',
  error: '#DC2626',
  onError: '#FFFFFF',
  info: '#475569',
  onInfo: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#94A3B8',
  divider: '#E2E8F0',
  muted: '#64748B',
};

export const darkColors = {
  surface: '#020617',
  onSurface: '#F8FAFC',
  surfaceSecondary: '#0F172A',
  onSurfaceSecondary: '#E2E8F0',
  surfaceTertiary: '#1E293B',
  onSurfaceTertiary: '#CBD5E1',
  surfaceInverse: '#F8FAFC',
  onSurfaceInverse: '#0F172A',
  brand: '#14B8A6',
  brandPrimary: '#14B8A6',
  onBrandPrimary: '#020617',
  brandSecondary: '#0F766E',
  onBrandSecondary: '#FFFFFF',
  brandTertiary: '#115E59',
  onBrandTertiary: '#CCFBF1',
  success: '#34D399',
  onSuccess: '#020617',
  warning: '#FDE047',
  onWarning: '#020617',
  error: '#F87171',
  onError: '#020617',
  info: '#94A3B8',
  onInfo: '#020617',
  border: '#334155',
  borderStrong: '#64748B',
  divider: '#1E293B',
  muted: '#94A3B8',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const fonts = { display: 'SpaceGrotesk', text: 'Geist' };

type ThemeCtx = {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof lightColors;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  mode: 'system',
  isDark: false,
  colors: lightColors,
  setMode: () => {},
});

const THEME_KEY = 'orthovault:theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  };

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const value = useMemo(() => ({ mode, isDark, colors, setMode }), [mode, isDark, colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
