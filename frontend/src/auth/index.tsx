import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_BASE = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'orthovault:session_token';

export type Role = 'admin' | 'editor' | 'viewer';
export type User = {
  user_id: string;
  email: string;
  name: string;
  picture: string;
  role: Role;
};

type Ctx = {
  loading: boolean;
  user: User | null;
  token: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({ loading: true, user: null, token: null, signInWithGoogle: async () => {}, logout: async () => {} });

let inMemoryToken: string | null = null;
export function getAuthToken() { return inMemoryToken; }

async function saveToken(t: string) {
  inMemoryToken = t;
  if (Platform.OS === 'web') { try { localStorage.setItem(TOKEN_KEY, t); } catch {} }
  else { try { await SecureStore.setItemAsync(TOKEN_KEY, t); } catch {} }
}
async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
  try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
}
async function clearToken() {
  inMemoryToken = null;
  if (Platform.OS === 'web') { try { localStorage.removeItem(TOKEN_KEY); } catch {} }
  else { try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {} }
}

const usedSessionIds = new Set<string>();

function extractSessionId(url: string): string | null {
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const exchange = useCallback(async (session_id: string) => {
    if (usedSessionIds.has(session_id)) return;
    usedSessionIds.add(session_id);
    try {
      const res = await fetch(`${API_BASE}/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id }),
      });
      if (!res.ok) throw new Error(`Auth failed ${res.status}`);
      const data = await res.json();
      await saveToken(data.session_token);
      setToken(data.session_token);
      setUser(data.user);
    } catch (e) {
      // silent — user will see login screen
    }
  }, []);

  const checkExisting = useCallback(async () => {
    const t = await loadToken();
    if (!t) { setLoading(false); return; }
    inMemoryToken = t;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const me = await res.json();
        setToken(t);
        setUser(me);
      } else {
        await clearToken();
      }
    } catch {
      // network issue — leave logged out
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: web parses URL; mobile registers deep-link listener + getInitialURL
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (Platform.OS === 'web') {
        const url = window.location.href;
        const sid = extractSessionId(url);
        if (sid) {
          await exchange(sid);
          // Clean URL
          try {
            const u = new URL(window.location.href);
            u.hash = u.hash.replace(/(^#?)session_id=[^&]+&?/g, '$1').replace(/^#$/, '');
            u.searchParams.delete('session_id');
            window.history.replaceState(window.history.state, '', u.toString());
          } catch {}
        }
        await checkExisting();
      } else {
        // Mobile: pre-register deep link listener before user opens the browser
        const sub = Linking.addEventListener('url', ({ url }) => {
          const sid = extractSessionId(url || '');
          if (sid && mounted) exchange(sid).then(checkExisting);
        });
        const initial = await Linking.getInitialURL();
        if (initial) {
          const sid = extractSessionId(initial);
          if (sid) await exchange(sid);
        }
        await checkExisting();
        return () => sub.remove();
      }
    })();
    return () => { mounted = false; };
  }, [exchange, checkExisting]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl = Platform.OS === 'web' ? window.location.origin + '/' : Linking.createURL('');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = null;
    if (result.type === 'success' && (result as any).url) url = (result as any).url as string;
    if (!url) url = await Linking.getInitialURL();
    if (url) {
      const sid = extractSessionId(url);
      if (sid) { await exchange(sid); await checkExisting(); }
    }
  }, [exchange, checkExisting]);

  const logout = useCallback(async () => {
    try {
      if (inMemoryToken) {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${inMemoryToken}` } });
      }
    } catch {}
    await clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ loading, user, token, signInWithGoogle, logout }), [loading, user, token, signInWithGoogle, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }
