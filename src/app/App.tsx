import { RouterProvider, createHashRouter } from 'react-router';
import { routes } from './routes';
import { SettingsProvider } from './SettingsContext';
import { StorageGate } from './StorageGate';
import { ThemeSync } from './ThemeSync';
import { ToastProvider } from '../ui/Toast';

// Hash URLs work on GitHub Pages without a 404 redirect trick (spec 3).
const router = createHashRouter(routes);

export function App() {
  return (
    <StorageGate>
      <SettingsProvider>
        <ThemeSync />
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </SettingsProvider>
    </StorageGate>
  );
}
