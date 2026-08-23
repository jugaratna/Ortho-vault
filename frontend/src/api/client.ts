import { Platform } from 'react-native';

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
  return `${API_BASE}/files/${storagePath}`;
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
    const res = await fetch(`${API_BASE}/patients`);
    return json<Patient[]>(res);
  },

  async getPatient(id: string): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients/${id}`);
    return json<Patient>(res);
  },

  async upsertPatient(p: Partial<Patient>): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    return json<Patient>(res);
  },

  async deletePatient(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/patients/${id}`, { method: 'DELETE' });
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
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
    return json<{ storage_path: string; size: number; name: string; mime: string; kind: MediaKind }>(res);
  },

  async draftDischarge(input: { name: string; age: number; sex: string; diagnosis: string; date_of_surgery: string | null; operative_note: string; result: string }): Promise<string> {
    const res = await fetch(`${API_BASE}/ai/draft-discharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await json<{ draft: string }>(res);
    return data.draft;
  },
};
