import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, fetchVersion } from './api'
import { useFetch } from './hooks'
import { API, Project, Stream } from './lib/bridge'
import { useBridge } from './lib/bridge-hooks'
import { AuthView } from './components/auth-view'
import { ProjectManager } from './components/project-manager'
import { LogExplorer } from './components/log-explorer'
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
  LogOut,
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
  const [user, setUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [helloName, setHelloName] = useState('World')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setCheckingAuth(false)
      return
    }

    API.config.headers = () => ({
      'Authorization': `Bearer ${token}`
    })

    API.getCurrentUser({})
      .then(res => {
        if (res.success) {
          setUser(res.user)
        } else {
          localStorage.removeItem('token')
        }
      })
      .catch(() => {
        localStorage.removeItem('token')
      })
      .finally(() => {
        setCheckingAuth(false)
      })
  }, [])

  const healthFn = useCallback(() => fetchHealth(), [])
  const versionFn = useCallback(() => fetchVersion(), [])

  const { data: health, loading: healthLoading, error: healthError, refetch: refetchHealth } = useFetch(healthFn, 10000)
  const { data: version, loading: versionLoading, error: versionError, refetch: refetchVersion } = useFetch(versionFn)

  // Demo: useBridge hook with caching and revalidation
  const { data: helloData, loading: helloLoading, error: helloError, refetch: refetchHello } = useBridge('hello', { name: helloName })

  const loading = healthLoading || versionLoading
  const error = healthError || versionError

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Verifying credentials...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthView onAuthSuccess={(u) => setUser(u)} />
  }

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

  const [activeTab, setActiveTab] = useState<'projects' | 'logs' | 'errors' | 'metrics' | 'system'>('projects')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-5 w-5 text-primary animate-pulse" />
              <h1 className="text-xl font-bold tracking-tight">Console Log</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Observability Panel &mdash; Signed in as <span className="font-semibold text-foreground">{user?.email}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <a href="https://github.com/bonheur/console-log" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-2 cursor-pointer border-destructive/20 text-destructive hover:bg-destructive/10" onClick={async () => {
              try {
                await API.logout({});
              } catch (e) {
                // Ignore, clear local session anyways
              }
              localStorage.removeItem('token');
              setUser(null);
            }}>
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </header>

        {/* Global Project Selection and Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/60 mb-6 pb-2 gap-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Projects & Streams
            </button>
            <button
              disabled={!selectedProject}
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                !selectedProject
                  ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                  : activeTab === 'logs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Log Explorer
            </button>
            <button
              disabled={!selectedProject}
              onClick={() => setActiveTab('errors')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                !selectedProject
                  ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                  : activeTab === 'errors'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Error Monitor
            </button>
            <button
              disabled={!selectedProject}
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                !selectedProject
                  ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                  : activeTab === 'metrics'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Metrics
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'system'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              System Health
            </button>
          </div>

          {selectedProject && (
            <div className="flex items-center gap-2 bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/80 text-xs shrink-0 self-start sm:self-center">
              <span className="text-muted-foreground">Active Project:</span>
              <select
                value={selectedProject.id}
                onChange={(e) => {
                  const proj = projects.find(p => p.id === parseInt(e.target.value))
                  if (proj) setSelectedProject(proj)
                }}
                className="bg-transparent font-semibold border-none focus:outline-none cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab Content Rendering */}
        <main className="min-h-[400px]">
          {activeTab === 'projects' && (
            <ProjectManager
              user={user}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              onProjectsUpdated={setProjects}
            />
          )}

          {activeTab === 'logs' && selectedProject && (
            <LogExplorer selectedProject={selectedProject} />
          )}

          {activeTab === 'errors' && selectedProject && (
            <Card className="border-border/80 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Error Monitor</CardTitle>
                <CardDescription>
                  Group exceptions and inspect application crashes for {selectedProject.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="py-12 text-center text-muted-foreground italic text-sm">
                Exception intelligence and grouping monitor will load in Part 6.
              </CardContent>
            </Card>
          )}

          {activeTab === 'metrics' && selectedProject && (
            <Card className="border-border/80 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Metrics Dashboard</CardTitle>
                <CardDescription>
                  Analyze resource usage and CPU/memory metric curves for {selectedProject.name}
                </CardDescription>
              </CardHeader>
              <CardContent className="py-12 text-center text-muted-foreground italic text-sm">
                Resource metrics monitoring and custom dashboards will load in Part 6.
              </CardContent>
            </Card>
          )}

          {activeTab === 'system' && (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
              <div className="rounded-xl border bg-card/40 p-5 shadow-sm">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-4">GoBridge RPC Hello Greeting Demo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-2">
                    <input
                      placeholder="Enter name..."
                      id="hello-name"
                      className="flex-1 bg-secondary/30 px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-1 focus:ring-primary"
                      onChange={(e) => setHelloName(e.target.value)}
                    />
                    <Button variant="outline" size="icon" onClick={() => refetchHello()}>
                      <RefreshCw className={`h-4 w-4 ${helloLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="bg-secondary/20 p-4 rounded-lg border border-dashed flex items-center justify-center min-h-[60px]">
                    {helloLoading ? (
                      <p className="text-xs text-muted-foreground italic">Revalidating...</p>
                    ) : helloError ? (
                      <p className="text-xs text-destructive">{helloError.message}</p>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-medium text-primary">{helloData?.message || 'Waiting...'}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Last update: {helloData?.timestamp}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Features list */}
              <div>
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Underlying Infrastructure features
                </h2>
                <FeatureList />
              </div>
            </div>
          )}
        </main>

        <Separator className="my-8" />

        {/* Footer */}
        <footer className="pb-4 text-center">
          <p className="text-xs text-muted-foreground">
            Console Log &mdash; Observability Platform
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
