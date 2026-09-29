import { cn } from '@/lib/utils';

import {
  isRoleCheckboxDisabled,
  type TeamRoleKey,
  type TeamRoleSelection,
  toggleRole,
} from './team-roles';

/** One Captain / VC / Manager cell — enforces one holder per role, one role per player. */
export function RoleCheckbox({
  selection,
  onChange,
  userId,
  playerName,
  role,
  label,
  locked = false,
}: {
  selection: TeamRoleSelection;
  onChange: (next: TeamRoleSelection) => void;
  userId: string;
  playerName: string;
  role: TeamRoleKey;
  label: string;
  locked?: boolean;
}): React.ReactElement {
  const disabled = locked || isRoleCheckboxDisabled(selection, userId, role);
  return (
    <input
      type="checkbox"
      aria-label={`${label}: ${playerName}`}
      data-role={role}
      checked={selection[role] === userId}
      disabled={disabled}
      onChange={(e) => onChange(toggleRole(selection, userId, role, e.target.checked))}
      className={cn(
        'size-4 accent-primary',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
      )}
    />
  );
}
