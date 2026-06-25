import { Card, CardContent } from '@/components/ui/card'
import {
  Shield,
  Package,
  RefreshCw,
  BarChart3,
  Gauge,
  Archive,
  Tag,
  Zap,
  LucideIcon,
} from 'lucide-react'

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

const features: Feature[] = [
  {
    icon: Zap,
    title: 'Zero Dependencies',
    desc: 'Pure Go stdlib. No external packages needed.',
  },
  {
    icon: Shield,
    title: 'Security Headers',
    desc: 'CSP, XSS, clickjacking protection built-in.',
  },
  {
    icon: Package,
    title: 'Single Binary',
    desc: 'Frontend embedded into the Go binary.',
  },
  {
    icon: RefreshCw,
    title: 'Graceful Shutdown',
    desc: 'Signal handling with request draining.',
  },
  {
    icon: BarChart3,
    title: 'Structured Logging',
    desc: 'slog with JSON/text formats and levels.',
  },
  {
    icon: Gauge,
    title: 'Rate Limiting',
    desc: 'Token bucket per IP with configurable burst.',
  },
  {
    icon: Archive,
    title: 'Gzip Compression',
    desc: 'Pooled writers for response compression.',
  },
  {
    icon: Tag,
    title: 'Auto Versioning',
    desc: 'Git-tag versioning with ldflags injection.',
  },
]

export function FeatureList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {features.map((f, i) => (
        <Card key={i} className="transition-colors hover:bg-muted/50">
          <CardContent className="pt-6">
            <f.icon className="h-5 w-5 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {f.desc}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
