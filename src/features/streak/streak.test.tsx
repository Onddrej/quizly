import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute } from '../../test/render';
import { resetDb } from '../../test/db';
import { db } from '../../db/schema';
import { createSet } from '../../db/sets';

// Wednesday 28 October 2026. Only Date is faked, so timers and promises behave as usual.
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 12, 0));
  await resetDb();
});
afterEach(() => vi.useRealTimers());

const study = (...days: string[]) => db.studyDays.bulkPut(days.map((day) => ({ day, rounds: 1 })));
const oneSet = () => createSet({ title: 'Travel', definitionLang: 'sk', cards: [{ term: 'gate', definition: 'brána' }] });

describe('the streak card on Home', () => {
  it('shows the streak and links to the streak page', async () => {
    await oneSet();
    await study('2026-10-26', '2026-10-27', '2026-10-28');
    renderRoute('/');
    const card = await screen.findByRole('link', { name: /day streak/i });
    expect(card).toHaveAttribute('href', '/streak');
    expect(card).toHaveTextContent('3');
    expect(card).toHaveTextContent('Done for today');
  });

  it('keeps the streak while today is still open and says what is left to do', async () => {
    await oneSet();
    await study('2026-10-25', '2026-10-26', '2026-10-27');
    renderRoute('/');
    const card = await screen.findByRole('link', { name: /day streak/i });
    expect(card).toHaveTextContent('3');
    expect(card).toHaveTextContent('Finish a round today to keep it');
  });

  it('invites to start a streak when there is none', async () => {
    await oneSet();
    renderRoute('/');
    const card = await screen.findByRole('link', { name: /day streak/i });
    expect(card).toHaveTextContent('0');
    expect(card).toHaveTextContent('Finish a round today to start a streak');
  });

  it('shows the week with the days that were studied', async () => {
    await oneSet();
    await study('2026-10-26', '2026-10-28');
    renderRoute('/');
    const card = await screen.findByRole('link', { name: /day streak/i });
    const days = within(card).getAllByRole('listitem');
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getAttribute('aria-label'))).toEqual([
      'Monday, studied',
      'Tuesday, not studied',
      'Wednesday, today, studied',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
  });

  it('is not shown before there is a set: the empty home says how to start', async () => {
    renderRoute('/');
    await screen.findByText('Create your first set');
    expect(screen.queryByRole('link', { name: /day streak/i })).not.toBeInTheDocument();
  });
});

describe('the streak page', () => {
  it('shows the streak, the best streak, the week and the month', async () => {
    await study('2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-27', '2026-10-28');
    renderRoute('/streak');
    expect(await screen.findByRole('heading', { name: 'Streak' })).toBeInTheDocument();
    expect(screen.getByText('2', { selector: '[data-streak]' })).toBeInTheDocument();
    expect(screen.getByText('Best streak: 4 days')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
  });

  it('marks the studied days of the month and today', async () => {
    await study('2026-10-02', '2026-10-27', '2026-10-28');
    renderRoute('/streak');
    const month = await screen.findByRole('grid', { name: 'October 2026' });
    const cell = (label: string) => within(month).getByRole('gridcell', { name: label });
    expect(cell('2 October, studied')).toBeInTheDocument();
    expect(cell('3 October, not studied')).toBeInTheDocument();
    expect(cell('28 October, today, studied')).toBeInTheDocument();
    expect(cell('29 October')).toBeInTheDocument();
    // the padding days of the neighbouring months are not part of this month
    expect(within(month).queryByRole('gridcell', { name: /September|November/ })).not.toBeInTheDocument();
  });

  it('says that today is still open when it has not been studied', async () => {
    renderRoute('/streak');
    const month = await screen.findByRole('grid', { name: 'October 2026' });
    expect(within(month).getByRole('gridcell', { name: '28 October, today' })).toBeInTheDocument();
  });

  it('browses to earlier months with the study days found there, and back', async () => {
    await study('2026-09-10', '2026-10-28');
    const { user } = renderRoute('/streak');
    await screen.findByRole('grid', { name: 'October 2026' });
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    const september = screen.getByRole('grid', { name: 'September 2026' });
    expect(within(september).getByRole('gridcell', { name: '10 September, studied' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeInTheDocument();
  });

  it('cannot go to the future or before the first study day', async () => {
    await study('2026-09-10', '2026-10-28');
    const { user } = renderRoute('/streak');
    await screen.findByRole('grid', { name: 'October 2026' });
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();
  });

  it('has nowhere to go back to without any history, but stays on the current month', async () => {
    renderRoute('/streak');
    await screen.findByRole('grid', { name: 'October 2026' });
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
  });

  it('leaves for Home with Back', async () => {
    const { user, router } = renderRoute('/streak');
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(router.state.location.pathname).toBe('/');
  });
});
