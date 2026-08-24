import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import { DRIVE_SCOPE } from './drive';

WebBrowser.maybeCompleteAuthSession();

const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

function isRealClientId(value: string) {
  if (!value) return false;
  if (value.startsWith('YOUR_')) return false;
  return value.endsWith('.apps.googleusercontent.com');
}

function currentPlatformConfigured() {
  if (Platform.OS === 'web') return isRealClientId(WEB_ID);
  if (Platform.OS === 'ios') return isRealClientId(IOS_ID);
  return isRealClientId(ANDROID_ID);
}

export function isDriveConfigured() {
  return currentPlatformConfigured();
}

export function useGoogleDriveAuth() {
  // Expo's Google provider handles PKCE, native URL schemes, and web redirects correctly per-platform.
  // It uses the reversed-client-id URL scheme on iOS, the Play Services flow on Android, and the auth session on web.
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: isRealClientId(WEB_ID) ? WEB_ID : undefined,
    iosClientId: isRealClientId(IOS_ID) ? IOS_ID : undefined,
    androidClientId: isRealClientId(ANDROID_ID) ? ANDROID_ID : undefined,
    scopes: ['openid', 'email', 'profile', DRIVE_SCOPE],
  });

  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (response?.type === 'success') {
      const token = (response as any).authentication?.accessToken || (response.params as any)?.access_token;
      if (token) setAccessToken(token);
    }
  }, [response]);

  return {
    configured: currentPlatformConfigured(),
    accessToken,
    connected: !!accessToken,
    canSignIn: !!request && currentPlatformConfigured(),
    signIn: () => promptAsync(),
    signOut: () => setAccessToken(null),
  };
}
