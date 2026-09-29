import { cn } from '@/lib/utils';

export interface AvatarPerson {
  firstName: string;
  lastName: string;
  profilePhotoUrl: string | null;
}

export function UserAvatar({ person, className }: { person: AvatarPerson; className?: string }): React.ReactElement {
  if (person.profilePhotoUrl) {
    return <img src={person.profilePhotoUrl} alt="" className={cn('size-9 shrink-0 rounded-full object-cover', className)} />;
  }
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-xs font-bold text-secondary',
        className,
      )}
    >
      {`${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()}
    </span>
  );
}
