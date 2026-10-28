/**
 * The service worker (vite-plugin-pwa `injectManifest`): offline precache of the app shell, plus the daily reminder, which
 * needs its own code here because only a service worker can run when the app is closed (periodic background sync).
 * Not unit-tested as a whole; the reminder wiring is tested in app/swReminder.test.ts.
 */
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { installReminder, type ReminderScope } from './app/swReminder';

// The tsconfig has the DOM lib, so the worker scope is typed by hand, with only what is used here.
const scope = self as unknown as ReminderScope & { skipWaiting(): Promise<void> };

// registerType 'autoUpdate': a new worker takes over as soon as it is installed (see the note in vite.config.ts).
void scope.skipWaiting();
clientsClaim();

// the build replaces the literal `self.__WB_MANIFEST` with the list of files to precache, so it must stay exactly that
precacheAndRoute((self as unknown as { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> }).__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

installReminder(scope);
