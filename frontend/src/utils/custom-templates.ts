import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Template } from '@/src/data/templates';

const KEY = 'orthovault:custom_templates';

export type CustomTemplate = Template & { builtin?: false };

export async function loadCustomTemplates(): Promise<CustomTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function persist(items: CustomTemplate[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function upsertCustomTemplate(tpl: CustomTemplate) {
  const items = await loadCustomTemplates();
  const idx = items.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) items[idx] = tpl;
  else items.unshift(tpl);
  await persist(items);
  return items;
}

export async function deleteCustomTemplate(id: string) {
  const items = await loadCustomTemplates();
  const next = items.filter((t) => t.id !== id);
  await persist(next);
  return next;
}

export function useCustomTemplates() {
  const [items, setItems] = useState<CustomTemplate[]>([]);

  const refresh = useCallback(async () => {
    const arr = await loadCustomTemplates();
    setItems(arr);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, refresh };
}
