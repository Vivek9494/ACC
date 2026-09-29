import { Construction } from 'lucide-react';

import type { NavItem } from '@/app/nav';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export function ComingSoonPage({ item }: { item: NavItem }): React.ReactElement {
  const Icon = item.icon;
  return (
    <div>
      <PageHeader title={item.label} description={item.description} />
      <Card className="py-0">
        <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="relative flex size-14 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
            <Icon className="size-7" />
            <Construction className="absolute -right-1.5 -bottom-1.5 size-5 rounded-full bg-card p-0.5 text-primary" />
          </span>
          <div>
            <p className="text-lg font-semibold">{item.label} is coming in a later phase</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              This area of the admin dashboard hasn't been built yet. Use the ACC mobile app for these tasks in
              the meantime.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
