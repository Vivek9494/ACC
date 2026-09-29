import { Link } from 'react-router';

import { DEFAULT_ROUTE } from '@/app/nav';
import { Button } from '@/components/ui/button';

export function NotFoundPage(): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-5xl font-extrabold text-primary">404</p>
      <p className="text-lg font-semibold">This page doesn't exist.</p>
      <Button asChild>
        <Link to={DEFAULT_ROUTE}>Back to dashboard</Link>
      </Button>
    </div>
  );
}
