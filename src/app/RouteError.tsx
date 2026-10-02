import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router';
import { Page } from '../ui/Page';
import { TopBar } from '../ui/TopBar';
import { EmptyState } from '../ui/EmptyState';
import { buttonClassName } from '../ui/Button';

/** Replaces React Router's developer error screen when a page throws while rendering or loading. */
export function RouteError() {
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Page top={<TopBar />}>
      <EmptyState
        title="Something went wrong"
        text="Try again, or go back Home."
        action={
          <Link to="/" className={buttonClassName('primary')}>
            Go to Home
          </Link>
        }
      />
    </Page>
  );
}
