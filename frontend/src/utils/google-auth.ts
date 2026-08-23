import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import { DRIVE_SCOPE } from './drive';

WebBrowser.maybeCompleteAuthSession();

const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

function isRealClientId(value: string) {
  // Reject empty and any leftover placeholder like "YOUR_GOOGLE_..._CLIENT_ID.apps.googleusercontent.com"
  if (!value) return false;
  if (value.startsWith('YOUR_')) return false;
  return value.endsWith('.apps.googleusercontent.com');
}

function currentClientId() {
  let raw = '';
  if (Platform.OS === 'web') raw = WEB_ID;
  else if (Platform.OS === 'ios') raw = IOS_ID;
  else raw = ANDROID_ID;
  return isRealClientId(raw) ? raw : '';
}

export function isDriveConfigured() {
  return !!currentClientId();
}

export function useGoogleDriveAuth() {
  const clientId = currentClientId();
  const redirectUri = makeRedirectUri({ scheme: 'frontend', path: 'oauthredirect' });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: clientId || 'not-configured',
      responseType: ResponseType.Token,
      scopes: ['openid', 'email', DRIVE_SCOPE],
      redirectUri,
    },
    {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
    },
  );

  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (response?.type === 'success') {
      const token = (response as any).authentication?.accessToken || (response.params as any)?.access_token;
      if (token) setAccessToken(token);
    }
  }, [response]);

  return {
    configured: !!clientId,
    accessToken,
    connected: !!accessToken,
    canSignIn: !!request && !!clientId,
    signIn: () => promptAsync(),
    signOut: () => setAccessToken(null),
  };
}
