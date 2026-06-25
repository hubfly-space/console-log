import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, fetchVersion } from './api'
import { useFetch } from './hooks'
import { API } from './lib/bridge'
import { useBridge } from './lib/bridge-hooks'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import { InfoTable } from '@/components/info-table'
import { FeatureList } from '@/components/feature-list'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  HeartPulse,
  GitCommit,
  Cpu,
  MemoryStick,
  RefreshCw,
  AlertTriangle,
  Sun,
  Moon,
  ExternalLink,
  Activity,
} from 'lucide-react'

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    return true
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return [dark, () => setDark(d => !d)] as const
}

function App() {
  const [dark, toggleTheme] = useTheme()
  const [helloName, setHelloName] = useState('World')

  const healthFn = useCallback(() => fetchHealth(), [])
  const versionFn = useCallback(() => fetchVersion(), [])

  const { data: health, loading: healthLoading, error: healthError, refetch: refetchHealth } = useFetch(healthFn, 10000)
  const { data: version, loading: versionLoading, error: versionError, refetch: refetchVersion } = useFetch(versionFn)

  // Demo: useBridge hook with caching and revalidation
  const { data: helloData, loading: helloLoading, error: helloError, refetch: refetchHello } = useBridge('hello', { name: helloName })

  const loading = healthLoading || versionLoading
  const error = healthError || versionError

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Connecting to server...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-1">Connection Error</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => { refetchHealth(); refetchVersion() }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-foreground" />
              <h1 className="text-xl font-bold tracking-tight">Go Starter Kit</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              System overview &mdash; fullstack Go + React
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a href="https://github.com/bonheur/go-starter-kit" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </header>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard
            icon={HeartPulse}
            label="Health"
            value={<StatusBadge status={health?.status} />}
            description={`Uptime: ${health?.uptime || '—'}`}
          />
          <MetricCard
            icon={GitCommit}
            label="Version"
            value={version?.version || 'dev'}
            description={version?.git_commit ? version.git_commit.substring(0, 8) : '—'}
          />
          <MetricCard
            icon={Cpu}
            label="Goroutines"
            value={health?.system?.goroutines ?? '—'}
            description={`${health?.system?.cpus ?? '—'} CPUs available`}
          />
          <MetricCard
            icon={MemoryStick}
            label="Memory"
            value={`${health?.system?.mem_alloc_mb?.toFixed(1) ?? '—'} MB`}
            description={`Sys: ${health?.system?.mem_sys_mb?.toFixed(1) ?? '—'} MB`}
          />
        </div>

        {/* Detail Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
          <InfoTable
            title="System"
            badge={<StatusBadge status={health?.status} />}
            rows={[
              { label: 'Go Version', value: health?.system?.go_version || '—' },
              { label: 'OS', value: health?.system?.os || '—' },
              { label: 'Architecture', value: health?.system?.arch || '—' },
              { label: 'GC Cycles', value: String(health?.system?.gc_cycles ?? '—') },
              { label: 'Total Requests', value: health?.stats?.total_requests?.toLocaleString() || '—' },
              { label: 'Server Time', value: health?.timestamp || '—' },
            ]}
          />
          <InfoTable
            title="Build"
            rows={[
              { label: 'Version', value: version?.version || '—' },
              { label: 'Commit', value: version?.git_commit || '—' },
              { label: 'Branch', value: version?.git_branch || '—' },
              { label: 'Built At', value: version?.build_time || '—' },
              { label: 'Go Version', value: version?.go_version || '—' },
              { label: 'Target', value: `${version?.os || '—'}/${version?.arch || '—'}` },
            ]}
          />
        </div>

        {/* Bridge Demo */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            GoBridge RPC Demo
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* RPC Mutation: Login */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <h3 className="font-semibold mb-4">Login (Direct RPC)</h3>
              <form className="space-y-3" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const formData = new FormData(form);
                try {
                  const result = await API.login({
                    username: formData.get('username') as string,
                    password: formData.get('password') as string
                  });
                  alert(`Login ${result.success ? 'Success!' : 'Failed.'} Token: ${result.token}`);
                } catch (err: any) {
                  alert(`Error: ${err.message}`);
                }
              }}>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Username</label>
                  <input name="username" defaultValue="admin" className="w-full bg-secondary px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Password</label>
                  <input name="password" type="password" defaultValue="password" className="w-full bg-secondary px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <Button type="submit" className="w-full mt-2">Login with Bridge</Button>
              </form>
            </div>

            {/* RPC Query Hook: Hello */}
            <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col">
              <h3 className="font-semibold mb-4">Live Greeting (useBridge Hook)</h3>
              <div className="flex-1 space-y-4">
                <div className="flex gap-2">
                  <input
                    placeholder="Enter name..."
                    id="hello-name"
                    className="flex-1 bg-secondary px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-primary"
                    onChange={(e) => setHelloName(e.target.value)}
                  />
                  <Button variant="outline" size="icon" onClick={() => refetchHello()}>
                    <RefreshCw className={`h-4 w-4 ${helloLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                <div className="bg-secondary/50 p-4 rounded-lg border border-dashed flex items-center justify-center min-h-[80px]">
                  {helloLoading ? (
                    <p className="text-sm text-muted-foreground italic">Revalidating...</p>
                  ) : helloError ? (
                    <p className="text-sm text-destructive">{helloError.message}</p>
                  ) : (
                    <div className="text-center">
                      <p className="text-lg font-medium text-primary">{helloData?.message || 'Waiting...'}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Last update: {helloData?.timestamp}</p>
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  This component uses the auto-generated Typescript client with built-in caching.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Built-in Features
          </h2>
          <FeatureList />
        </div>

        <Separator />

        {/* Footer */}
        <footer className="pt-6 pb-4 text-center">
          <p className="text-xs text-muted-foreground">
            Built with Go + React &mdash;{' '}
            <a
              className="underline underline-offset-4 hover:text-foreground transition-colors"
              href="https://github.com/bonheur/go-starter-kit"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source on GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
