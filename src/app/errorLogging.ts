import { diagnostics } from '../lib/diagnostics';

// Browsers fire this for layout work that finished a frame late; it is not an error in the app.
const HARMLESS = /^ResizeObserver loop/;

/**
 * Call once at startup: writes uncaught errors and unhandled promise rejections to the local diagnostics log.
 * Returns a function that removes the listeners again.
 */
export function installErrorLogging(target: Window = window): () => void {
  const onError = (event: Event) => {
    const { error, message } = event as ErrorEvent;
    if (typeof message === 'string' && HARMLESS.test(message)) return;
    diagnostics.recordError('error', error ?? message);
  };
  const onRejection = (event: Event) => {
    diagnostics.recordError('rejection', (event as PromiseRejectionEvent).reason);
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
