import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { diagnostics } from '../lib/diagnostics';
import { installErrorLogging } from './errorLogging';

let uninstall: () => void;

beforeEach(() => {
  localStorage.clear();
  uninstall = installErrorLogging(window);
});
afterEach(() => uninstall());

function fireError(init: ErrorEventInit) {
  window.dispatchEvent(new ErrorEvent('error', init));
}

function fireRejection(reason: unknown) {
  const event = new Event('unhandledrejection') as Event & { reason: unknown };
  event.reason = reason;
  window.dispatchEvent(event);
}

describe('installErrorLogging', () => {
  it('logs an uncaught error with its name, message and stack', () => {
    const error = new TypeError('x is undefined');
    fireError({ error, message: 'Uncaught TypeError: x is undefined' });
    expect(diagnostics.entries()).toMatchObject([{ kind: 'error', message: 'TypeError: x is undefined' }]);
  });

  it('falls back to the event message when there is no error object (cross-origin script errors)', () => {
    fireError({ message: 'Script error.' });
    expect(diagnostics.entries()).toMatchObject([{ kind: 'error', message: 'Script error.' }]);
  });

  it('logs an unhandled promise rejection', () => {
    fireRejection(new Error('write failed'));
    expect(diagnostics.entries()).toMatchObject([{ kind: 'rejection', message: 'Error: write failed' }]);
  });

  it('logs a rejection with a plain value', () => {
    fireRejection('just a string');
    expect(diagnostics.entries()).toMatchObject([{ kind: 'rejection', message: 'just a string' }]);
  });

  it('ignores the harmless ResizeObserver notice', () => {
    fireError({ message: 'ResizeObserver loop completed with undelivered notifications.' });
    fireError({ message: 'ResizeObserver loop limit exceeded' });
    expect(diagnostics.entries()).toEqual([]);
  });

  it('stops logging after it is uninstalled', () => {
    uninstall();
    // vitest reports an `error` event as a test-run error unless the test has a listener of its own
    const swallow = (event: Event) => event.preventDefault();
    window.addEventListener('error', swallow);
    fireError({ error: new Error('late'), message: 'late' });
    window.removeEventListener('error', swallow);
    fireRejection(new Error('late'));
    expect(diagnostics.entries()).toEqual([]);
  });
});
