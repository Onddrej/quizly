import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeakButton } from './SpeakButton';
import { InlineConfirm } from './InlineConfirm';
import { Field } from './Field';
import { StageBar } from './StageBar';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SpeakButton', () => {
  it('renders nothing when speech is not supported', () => {
    render(<SpeakButton text="gate" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('speaks the text when supported', async () => {
    const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    render(<SpeakButton text="gate" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play pronunciation: gate' }));
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });
});

describe('InlineConfirm', () => {
  it('calls confirm and cancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<InlineConfirm message="Delete it?" confirmLabel="Delete" danger onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Field', () => {
  it('labels the input and announces errors', () => {
    render(<Field id="t" label="Title" value="" onChange={() => {}} error="Add a title" />);
    const input = screen.getByLabelText('Title');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Add a title');
  });
});

describe('StageBar', () => {
  it('describes the counts for assistive tech', () => {
    render(<StageBar counts={{ mastered: 9, learning: 8, notStudied: 7 }} legend />);
    expect(screen.getByRole('img', { name: '9 mastered, 8 learning, 7 not studied' })).toBeInTheDocument();
    expect(screen.getByText('not studied', { exact: false })).toBeInTheDocument();
  });
});
