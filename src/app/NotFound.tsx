import { Link } from 'react-router';
import { Page } from '../ui/Page';
import { TopBar } from '../ui/TopBar';
import { EmptyState } from '../ui/EmptyState';
import { buttonClassName } from '../ui/Button';

export function NotFound({ title = "This page doesn't exist" }: { title?: string }) {
  return (
    <Page top={<TopBar />}>
      <EmptyState
        title={title}
        text="It may have been deleted."
        action={
          <Link to="/" className={buttonClassName('primary')}>
            Go to Home
          </Link>
        }
      />
    </Page>
  );
}
