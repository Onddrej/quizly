import { Outlet, type RouteObject } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { SetEditorPage } from '../features/editor/SetEditorPage';
import { SetPage } from '../features/set/SetPage';
import { FlashcardsPage } from '../features/flashcards/FlashcardsPage';
import { LearnPage } from '../features/learn/LearnPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { NotFound } from './NotFound';
import { RouteError } from './RouteError';
import { NavigationTracker } from './navigation';

function AppLayout() {
  return (
    <>
      <NavigationTracker />
      <Outlet />
    </>
  );
}

export const routes: RouteObject[] = [
  {
    // Pathless layout route: tracks the history for useLeave, and any render error below it shows the plain error page.
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/create', element: <SetEditorPage /> },
      { path: '/sets/:setId', element: <SetPage /> },
      { path: '/sets/:setId/edit', element: <SetEditorPage /> },
      { path: '/sets/:setId/flashcards', element: <FlashcardsPage /> },
      { path: '/sets/:setId/learn', element: <LearnPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
