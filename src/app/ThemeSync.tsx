import { useLayoutEffect } from 'react';
import { useSettings } from './SettingsContext';

/** Applies the theme preference to <html data-theme> and keeps the system bar color in sync. */
export function ThemeSync() {
  const { theme } = useSettings();

  // A layout effect applies data-theme before the browser paints, so there is no flash of the wrong theme.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;

    const applyBarColor = () => {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#F6F7FB');
    };
    applyBarColor();
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener('change', applyBarColor);
    return () => media?.removeEventListener('change', applyBarColor);
  }, [theme]);

  return null;
}
