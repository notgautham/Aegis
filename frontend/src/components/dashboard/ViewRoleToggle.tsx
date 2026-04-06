import { cn } from '@/lib/utils';

type ViewRole = 'executive' | 'analyst' | 'compliance';

interface ViewRoleToggleProps {
  activeRole: ViewRole;
  onRoleChange: (role: ViewRole) => void;
}

const roles: { id: ViewRole; label: string }[] = [
  { id: 'executive', label: 'Executive' },
  { id: 'analyst', label: 'Analyst' },
  { id: 'compliance', label: 'Compliance' },
];

const ViewRoleToggle = ({ activeRole, onRoleChange }: ViewRoleToggleProps) => (
  <div className="flex gap-1 p-0.5 rounded-lg bg-[hsl(var(--bg-sunken))] border border-[hsl(var(--border-default))]">
    {roles.map(r => (
      <button
        key={r.id}
        onClick={() => onRoleChange(r.id)}
        className={cn(
          'px-3 py-1 rounded-md text-[11px] font-body transition-all',
          activeRole === r.id
            ? 'bg-white shadow-sm text-brand-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {r.label}
      </button>
    ))}
  </div>
);

export default ViewRoleToggle;
