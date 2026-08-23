import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FollowupDays = 30 | 60 | 90;
const KEY = 'orthovault:followup_days';

type Ctx = {
  followupDays: FollowupDays;
  setFollowupDays: (d: FollowupDays) => void;
};

const SettingsContext = createContext<Ctx>({
  followupDays: 42 as any, // legacy fallback default
  setFollowupDays: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [followupDays, setDaysState] = useState<FollowupDays>(60);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      const n = Number(v);
      if (n === 30 || n === 60 || n === 90) setDaysState(n);
    });
  }, []);

  const setFollowupDays = (d: FollowupDays) => {
    setDaysState(d);
    AsyncStorage.setItem(KEY, String(d)).catch(() => {});
  };

  const value = useMemo(() => ({ followupDays, setFollowupDays }), [followupDays]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
