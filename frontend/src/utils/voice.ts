import { Platform } from 'react-native';
import { AudioModule, useAudioRecorder, RecordingPresets } from 'expo-audio';
import { API_BASE } from '@/src/api/client';

export async function ensureMicPermission(): Promise<boolean> {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  return status.granted;
}

export async function transcribeAudio(uri: string): Promise<string> {
  const form = new FormData();
  const name = `voice-${Date.now()}.m4a`;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append('file', blob, name);
  } else {
    form.append('file', { uri, name, type: 'audio/m4a' } as any);
  }
  const res = await fetch(`${API_BASE}/transcribe`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
  const data = await res.json();
  return (data.text || '').trim();
}

// Re-export the recorder hook + preset for convenience
export { useAudioRecorder, RecordingPresets };
