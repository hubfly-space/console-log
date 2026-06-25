import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status?: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isOk = status === 'ok' || status === 'ready'

  return (
    <Badge variant={isOk ? 'default' : 'destructive'} className="text-xs gap-1.5">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isOk
            ? 'bg-emerald-400 animate-pulse'
            : 'bg-red-400'
        }`}
      />
      {isOk ? 'Operational' : 'Degraded'}
    </Badge>
  )
}
