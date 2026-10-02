import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadSettings } from '../db/settings';
import { DEFAULT_SETTINGS, type Settings } from '../db/types';

const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(loadSettings, []);
  // Render nothing until the stored settings are read, so no frame is painted with the default theme.
  if (!settings) return null;
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  return useContext(SettingsContext);
}
