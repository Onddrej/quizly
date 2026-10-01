import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { routes } from '../app/routes';
import { SettingsProvider } from '../app/SettingsContext';
import { ToastProvider } from '../ui/Toast';

/** Renders the real route table at `path` with the same providers as the app. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const user = userEvent.setup();
  const view = render(
    <SettingsProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </SettingsProvider>,
  );
  return { user, router, ...view };
}
