import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadSettings } from '../db/settings';
import { DEFAULT_SETTINGS, type Settings } from '../db/types';

const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(loadSettings, [], DEFAULT_SETTINGS);
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  return useContext(SettingsContext);
}
