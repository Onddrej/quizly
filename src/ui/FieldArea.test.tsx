import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldArea } from './FieldArea';

describe('FieldArea', () => {
  it('is a labelled two-row textarea that passes extra props through', () => {
    render(<FieldArea id="ex" label="Examples" value="" onChange={() => {}} lang="en" />);
    const area = screen.getByLabelText('Examples');
    expect(area.tagName).toBe('TEXTAREA');
    expect(area).toHaveAttribute('rows', '2');
    expect(area).toHaveAttribute('lang', 'en');
    expect(area).not.toHaveAttribute('aria-describedby');
    expect(area).not.toHaveAttribute('aria-invalid');
  });

  it('sizes its minimum height from the rows prop (two rows by default)', () => {
    const { rerender } = render(<FieldArea id="ex" label="Examples" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Examples').style.getPropertyValue('--field-rows')).toBe('2');
    rerender(<FieldArea id="ex" label="Examples" rows={1} value="" onChange={() => {}} style={{ color: 'red' }} />);
    const area = screen.getByLabelText('Examples');
    expect(area).toHaveAttribute('rows', '1');
    expect(area.style.getPropertyValue('--field-rows')).toBe('1');
    expect(area.style.color).toBe('red');
  });

  it('describes the field with its hint and its error', () => {
    const { rerender } = render(<FieldArea id="ex" label="Examples" hint="One per line." value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Examples')).toHaveAccessibleDescription('One per line.');
    rerender(<FieldArea id="ex" label="Examples" hint="One per line." error="Too long" value="" onChange={() => {}} />);
    const area = screen.getByLabelText('Examples');
    expect(area).toHaveAttribute('aria-invalid', 'true');
    expect(area).toHaveAccessibleDescription('One per line. Too long');
  });

  it('keeps line breaks while typing', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return <FieldArea id="ex" label="Examples" value={value} onChange={(e) => setValue(e.target.value)} />;
    }
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Examples'), 'one{Enter}two');
    expect(screen.getByLabelText('Examples')).toHaveValue('one\ntwo');
  });
});
