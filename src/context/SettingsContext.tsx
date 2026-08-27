import React, { createContext, useContext, useState } from 'react';

export type FollowupDays = 7 | 10 | 14 | 21 | 30 | 45 | 60;

interface SettingsContextType {
  followupDays: FollowupDays;
  setFollowupDays: (d: FollowupDays) => void;
  hospitalName: string;
  setHospitalName: (n: string) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  followupDays: 14,
  setFollowupDays: () => {},
  hospitalName: 'Apex Orthopedic & Trauma Center',
  setHospitalName: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [followupDays, setFollowupDaysState] = useState<FollowupDays>(() => {
    const saved = localStorage.getItem('orthovault_followup_days');
    return saved ? (Number(saved) as FollowupDays) : 14;
  });

  const [hospitalName, setHospitalNameState] = useState<string>(() => {
    return localStorage.getItem('orthovault_hospital_name') || 'Apex Orthopedic & Trauma Center';
  });

  const setFollowupDays = (d: FollowupDays) => {
    setFollowupDaysState(d);
    localStorage.setItem('orthovault_followup_days', String(d));
  };

  const setHospitalName = (n: string) => {
    setHospitalNameState(n);
    localStorage.setItem('orthovault_hospital_name', n);
  };

  return (
    <SettingsContext.Provider
      value={{ followupDays, setFollowupDays, hospitalName, setHospitalName }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
