import { type LucideIcon, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

/**
 * Kebab with Edit, any extra actions, then Delete (each omitted when its handler is);
 * clicks don't bubble to clickable rows.
 */
export function RowActionsMenu({
  label,
  onEdit,
  actions = [],
  onDelete,
}: {
  label: string;
  onEdit?: () => void;
  actions?: readonly RowAction[];
  onDelete?: () => void;
}): React.ReactElement {
  return (
    <div
      className="flex justify-end"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`Actions for ${label}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil />
              Edit
            </DropdownMenuItem>
          ) : null}
          {actions.map(({ label: actionLabel, icon: Icon, onSelect }) => (
            <DropdownMenuItem key={actionLabel} onSelect={onSelect}>
              <Icon />
              {actionLabel}
            </DropdownMenuItem>
          ))}
          {(onEdit || actions.length > 0) && onDelete ? <DropdownMenuSeparator /> : null}
          {onDelete ? (
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
