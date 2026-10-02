import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resetDb } from '../test/db';
import { saveSetting } from '../db/settings';
import { DEFAULT_SETTINGS } from '../db/types';
import { SettingsProvider, useSettings } from './SettingsContext';

function SettingsProbe() {
  const { theme, accent } = useSettings();
  return (
    <p>
      theme:{theme} accent:{accent}
    </p>
  );
}

beforeEach(async () => {
  await resetDb();
});

describe('SettingsProvider', () => {
  it('renders nothing until the settings have loaded, then its children with the stored values', async () => {
    await saveSetting('theme', 'dark');
    await saveSetting('accent', 'en-GB');

    const { container } = render(
      <SettingsProvider>
        <SettingsProbe />
      </SettingsProvider>,
    );

    // No frame is painted with the default settings.
    expect(container).toBeEmptyDOMElement();
    expect(await screen.findByText('theme:dark accent:en-GB')).toBeInTheDocument();
  });

  it('gives the defaults to consumers rendered without a provider', () => {
    render(<SettingsProbe />);
    expect(screen.getByText(`theme:${DEFAULT_SETTINGS.theme} accent:${DEFAULT_SETTINGS.accent}`)).toBeInTheDocument();
  });
});
