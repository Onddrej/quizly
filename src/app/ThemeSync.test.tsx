import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { resetDb } from '../test/db';
import { saveSetting } from '../db/settings';
import { SettingsProvider } from './SettingsContext';
import { ThemeSync } from './ThemeSync';

const root = document.documentElement;
let meta: HTMLMetaElement;

beforeEach(async () => {
  await resetDb();
  delete root.dataset.theme;
  meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = '#000000';
  document.head.append(meta);
});
afterEach(() => {
  meta.remove();
  root.style.removeProperty('--bg');
  vi.unstubAllGlobals();
});

const mountSync = () => render(<SettingsProvider><ThemeSync /></SettingsProvider>);

describe('ThemeSync', () => {
  it('removes data-theme for "system" and sets it for light and dark', async () => {
    root.dataset.theme = 'dark';
    await saveSetting('theme', 'system');
    const first = mountSync();
    await waitFor(() => expect(root.dataset.theme).toBeUndefined());
    first.unmount();
    await saveSetting('theme', 'light');
    mountSync();
    await waitFor(() => expect(root.dataset.theme).toBe('light'));
  });

  it('copies the computed --bg token into the theme-color meta tag, with a fallback', async () => {
    root.style.setProperty('--bg', ' #123456 ');
    mountSync();
    await waitFor(() => expect(meta.content).toBe('#123456'));
  });

  it('falls back to the light background color when --bg is not defined', async () => {
    mountSync();
    await waitFor(() => expect(meta.content).toBe('#F6F7FB'));
  });

  it('refreshes the meta tag on OS theme change and removes its listener on unmount', async () => {
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
    root.style.setProperty('--bg', '#111111');
    const view = mountSync();
    await waitFor(() => expect(listeners.size).toBe(1));
    root.style.setProperty('--bg', '#222222');
    listeners.forEach((fn) => fn());
    expect(meta.content).toBe('#222222');
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it('does not throw when the theme-color meta tag is missing', async () => {
    meta.remove();
    await saveSetting('theme', 'dark');
    mountSync();
    await waitFor(() => expect(root.dataset.theme).toBe('dark'));
  });
});
