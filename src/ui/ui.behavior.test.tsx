import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { useState } from 'react';
import { Sheet } from './Sheet';
import { ToastProvider, useToast } from './Toast';
import { Segmented } from './Segmented';
import { Switch } from './Switch';
import { Button, buttonClassName } from './Button';
import { IconButton } from './IconButton';
import { TabBar } from './TabBar';
import { StageBar } from './StageBar';
import { Field } from './Field';
import { Page } from './Page';
import { SpeakButton } from './SpeakButton';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Sheet', () => {
  it('renders nothing while closed and a named dialog while open', () => {
    const { rerender } = render(<Sheet open={false} title="Options" onClose={() => {}}>body</Sheet>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<Sheet open title="Options" onClose={() => {}}>body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Options' })).toHaveTextContent('body');
  });

  it('closes on Escape, on the backdrop and on the Close button, but not on taps inside', async () => {
    const onClose = vi.fn();
    render(<Sheet open title="Options" onClose={onClose}><button type="button">Inside</button></Sheet>);
    await userEvent.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('stops listening for Escape once closed', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sheet open title="Options" onClose={onClose}>x</Sheet>);
    rerender(<Sheet open={false} title="Options" onClose={onClose}>x</Sheet>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

function ToastDemo() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast('Saved')}>one</button>
      <button type="button" onClick={() => toast('Copied')}>two</button>
    </>
  );
}

describe('Toast', () => {
  it('keeps a polite live region mounted before any message', () => {
    render(<ToastProvider><ToastDemo /></ToastProvider>);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('shows a message for 3 s, and a newer message restarts the timer', () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastDemo /></ToastProvider>);
    act(() => screen.getByText('one').click());
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => { vi.advanceTimersByTime(2000); });
    act(() => screen.getByText('two').click());
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('cancels the pending timer on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<ToastProvider><ToastDemo /></ToastProvider>);
    act(() => screen.getByText('one').click());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('Segmented', () => {
  function Demo({ onChange }: { onChange: (v: 'a' | 'b') => void }) {
    const [v, setV] = useState<'a' | 'b'>('a');
    return (
      <Segmented
        name="mode"
        label="Mode"
        value={v}
        options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]}
        onChange={(x) => { setV(x); onChange(x); }}
      />
    );
  }
  it('is a labelled radio group; click and arrow keys change the value', async () => {
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Mode' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
    await userEvent.click(screen.getByText('Beta'));
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked();
    screen.getByRole('radio', { name: 'Beta' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toBeChecked();
  });
});

describe('Switch', () => {
  it('exposes role switch, reflects checked and reports the new value', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Switch id="s" label="Autoplay" checked={false} onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Autoplay' });
    expect(sw).not.toBeChecked();
    await userEvent.click(screen.getByText('Autoplay'));
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(<Switch id="s" label="Autoplay" checked onChange={onChange} />);
    expect(sw).toBeChecked();
    sw.focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

describe('Button', () => {
  it('defaults to type=button so it never submits a surrounding form', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(<form onSubmit={onSubmit}><Button>Go</Button></form>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Nope</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Nope' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('buttonClassName composes variant, block and extra classes', () => {
    const cls = buttonClassName('outline', true, 'extra');
    expect(cls.split(' ')).toHaveLength(4);
    expect(cls).toContain('extra');
    expect(buttonClassName('primary')).not.toBe(buttonClassName('danger'));
    expect(buttonClassName('primary', true)).not.toBe(buttonClassName('primary'));
  });
});

describe('IconButton', () => {
  it('uses the label as accessible name and tooltip, and forwards aria-pressed', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Star term" icon={<svg />} aria-pressed={true} onClick={onClick} />);
    const b = screen.getByRole('button', { name: 'Star term' });
    expect(b).toHaveAttribute('title', 'Star term');
    expect(b).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('TabBar', () => {
  it('links Home, Create and Settings and marks the current route', () => {
    render(<MemoryRouter initialEntries={['/settings']}><TabBar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Create set' })).toHaveAttribute('href', '/create');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
  it('does not mark Home current on a nested route', () => {
    render(<MemoryRouter initialEntries={['/sets/1']}><TabBar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });
});

describe('StageBar widths', () => {
  it('does not produce NaN widths for an empty set', () => {
    const { container } = render(<StageBar counts={{ mastered: 0, learning: 0, notStudied: 0 }} />);
    const spans = container.querySelectorAll('[role=img] > span');
    expect([...spans].map((s) => (s as HTMLElement).style.width)).toEqual(['0%', '0%']);
  });
  it('sizes mastered and learning as shares of the total', () => {
    const { container } = render(<StageBar counts={{ mastered: 1, learning: 1, notStudied: 2 }} />);
    const spans = container.querySelectorAll('[role=img] > span');
    expect([...spans].map((s) => (s as HTMLElement).style.width)).toEqual(['25%', '25%']);
  });
});

describe('Field without error', () => {
  it('has no aria-invalid and no description', () => {
    render(<Field id="t" label="Title" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Title');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAccessibleDescription();
  });
});

describe('Page', () => {
  it('renders one main landmark between the top and bottom slots', () => {
    render(<Page top={<header>top</header>} bottom={<nav aria-label="b">bottom</nav>}>content</Page>);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveTextContent('content');
  });
});

describe('SpeakButton inside a pointer-listening container', () => {
  it('does not leak pointer or click events to the container (flashcard flip)', async () => {
    const synth = { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
    const down = vi.fn();
    const up = vi.fn();
    const click = vi.fn();
    render(
      <div onPointerDown={down} onPointerUp={up} onClick={click}>
        <SpeakButton text="gate" />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Play pronunciation: gate' }));
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(down).not.toHaveBeenCalled();
    expect(up).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });
});
