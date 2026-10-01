import type { RouteObject } from 'react-router';
import { HomePage } from '../features/home/HomePage';
import { SetEditorPage } from '../features/editor/SetEditorPage';
import { SetPage } from '../features/set/SetPage';
import { FlashcardsPage } from '../features/flashcards/FlashcardsPage';
import { LearnPage } from '../features/learn/LearnPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { NotFound } from './NotFound';

export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/create', element: <SetEditorPage /> },
  { path: '/sets/:setId', element: <SetPage /> },
  { path: '/sets/:setId/edit', element: <SetEditorPage /> },
  { path: '/sets/:setId/flashcards', element: <FlashcardsPage /> },
  { path: '/sets/:setId/learn', element: <LearnPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '*', element: <NotFound /> },
];
