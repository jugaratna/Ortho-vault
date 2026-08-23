import { Platform } from 'react-native';
import { getAuthToken } from '@/src/auth';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const API_BASE = `${BACKEND_URL}/api`;

export type Sex = 'Male' | 'Female' | 'Other';

export type MediaKind = 'image' | 'pdf' | 'doc' | 'video' | 'dicom' | 'other';

export type MediaFile = {
  id: string;
  name: string;
  kind: MediaKind;
  mime: string;
  size?: number;
  storage_path: string;
  section: 'pre_op' | 'post_op' | 'video';
  uploaded_at?: string;
};

export type Patient = {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  mobile: string;
  country_code: string;
  diagnosis: string;
  history: string;
  date_of_surgery?: string | null;
  followup_days?: number | null;
  operative_note: string;
  discharge_note: string;
  result: string;
  pre_op: MediaFile[];
  post_op: MediaFile[];
  videos: MediaFile[];
  created_at?: string;
  updated_at?: string;
};

export function fileUrl(storagePath: string) {
  const t = getAuthToken();
  const suffix = t ? `?token=${encodeURIComponent(t)}` : '';
  return `${API_BASE}/files/${storagePath}${suffix}`;
}

function authHeaders(): Record<string, string> {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${t || res.statusText}`);
  }
  return res.json();
}

export const api = {
  async listPatients(): Promise<Patient[]> {
    const res = await fetch(`${API_BASE}/patients`, { headers: authHeaders() });
    return json<Patient[]>(res);
  },

  async getPatient(id: string): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients/${id}`, { headers: authHeaders() });
    return json<Patient>(res);
  },

  async upsertPatient(p: Partial<Patient>): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(p),
    });
    return json<Patient>(res);
  },

  async deletePatient(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/patients/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  },

  async uploadFile(uri: string, name: string, mime: string) {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(uri)).blob();
      form.append('file', blob, name);
    } else {
      form.append('file', { uri, name, type: mime } as any);
    }
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form, headers: authHeaders() });
    return json<{ storage_path: string; size: number; name: string; mime: string; kind: MediaKind }>(res);
  },

  async draftDischarge(input: { name: string; age: number; sex: string; diagnosis: string; date_of_surgery: string | null; operative_note: string; result: string }): Promise<string> {
    const res = await fetch(`${API_BASE}/ai/draft-discharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(input),
    });
    const data = await json<{ draft: string }>(res);
    return data.draft;
  },

  async listUsers() {
    const res = await fetch(`${API_BASE}/auth/users`, { headers: authHeaders() });
    return json<Array<{ user_id: string; email: string; name: string; picture: string; role: 'admin' | 'editor' | 'viewer'; last_active?: string | null }>>(res);
  },

  async updateUserRole(user_id: string, role: 'admin' | 'editor' | 'viewer') {
    const res = await fetch(`${API_BASE}/auth/users/${user_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ role }),
    });
    return json<{ ok: boolean }>(res);
  },

  async listInvites() {
    const res = await fetch(`${API_BASE}/auth/invites`, { headers: authHeaders() });
    return json<Array<{ email: string; role: 'admin' | 'editor' | 'viewer'; invited_at?: string | null }>>(res);
  },

  async createInvite(email: string, role: 'admin' | 'editor' | 'viewer') {
    const res = await fetch(`${API_BASE}/auth/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ email, role }),
    });
    return json<{ email: string; role: 'admin' | 'editor' | 'viewer'; invited_at?: string | null }>(res);
  },

  async deleteInvite(email: string) {
    const res = await fetch(`${API_BASE}/auth/invites/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return json<{ ok: boolean }>(res);
  },
};
