import { Code2 } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

import { PermissionMatrixTable } from './PermissionMatrixTable';
import { RULEBOOK_SECTIONS } from './rulebook-content';
import { cellSegments, isCodeValue, type Rule, type RulebookGroup, type RuleSegment } from './rulebook-model';

function Segment({ segment }: { segment: RuleSegment }): React.ReactElement {
  if (!isCodeValue(segment)) return <>{segment}</>;
  return (
    <span
      className="rounded bg-primary/10 px-1 py-px font-semibold text-primary"
      title={`From code: ${segment.source}`}
    >
      {segment.value}
    </span>
  );
}

function RuleLine({ rule }: { rule: Rule }): React.ReactElement {
  return (
    <li className="leading-relaxed">
      {rule.parts.map((part, i) => (
        <Segment key={i} segment={part} />
      ))}
    </li>
  );
}

function Group({ group }: { group: RulebookGroup }): React.ReactElement {
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-semibold text-secondary">{group.title}</h3>
      {group.rules.length > 0 ? (
        <ul className="grid list-disc gap-1.5 pl-5 text-sm">
          {group.rules.map((rule, i) => (
            <RuleLine key={i} rule={rule} />
          ))}
        </ul>
      ) : null}
      {group.table ? (
        <div className="mt-1 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                {group.table.columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.table.rows.map((row, r) => (
                <tr key={r} className="border-t">
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-2 align-top">
                      {cellSegments(cell).map((segment, s) => (
                        <Segment key={s} segment={segment} />
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/** Read-only business rules; highlighted values come straight from @acc/types. */
export function RulebookPage(): React.ReactElement {
  return (
    <div>
      <PageHeader title="Rulebook" description="Business rules the platform enforces today, grouped by area." />

      <p className="mb-6 flex items-center gap-2 rounded-md border border-secondary/20 bg-secondary/5 px-3 py-2 text-sm text-secondary">
        <Code2 className="size-4 shrink-0" />
        <span>
          Highlighted values such as <Segment segment={{ kind: 'code', value: '10', source: 'LEATHER_POINTS_WIN' }} />{' '}
          are read from the app&apos;s code, so they always match what is enforced. Hover one to see its source.
        </span>
      </p>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Rulebook sections" className="lg:sticky lg:top-4 lg:self-start">
          <ul className="grid gap-1 text-sm">
            {RULEBOOK_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {section.title}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#permissions"
                className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Permission matrix
              </a>
            </li>
          </ul>
        </nav>

        <div className="grid min-w-0 gap-6">
          {RULEBOOK_SECTIONS.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-4 py-0">
              <CardContent className="grid gap-5 py-6">
                <div>
                  <h2 className="text-lg font-bold text-secondary">{section.title}</h2>
                  <p className="text-sm text-muted-foreground">{section.summary}</p>
                </div>
                {section.groups.map((group) => (
                  <Group key={group.title} group={group} />
                ))}
              </CardContent>
            </Card>
          ))}

          <Card id="permissions" className="scroll-mt-4 py-0">
            <CardContent className="grid gap-4 py-6">
              <div>
                <h2 className="text-lg font-bold text-secondary">Permission matrix</h2>
                <p className="text-sm text-muted-foreground">
                  Who may perform each action, generated from the permission matrix the API enforces. Notes under a
                  tick narrow the grant (own team, own center, organizer, tournament type).
                </p>
              </div>
              <PermissionMatrixTable />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
