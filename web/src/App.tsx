import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, fetchVersion } from './api'
import { useFetch } from './hooks'
import { API, Project } from './lib/bridge'
import { useBridge } from './lib/bridge-hooks'
import { AuthView } from './components/auth-view'
import { ProjectManager } from './components/project-manager'
import { LogExplorer } from './components/log-explorer'
import { ErrorMonitor } from './components/error-monitor'
import { MetricsDashboard } from './components/metrics-dashboard'
import { LandingPage } from './components/landing-page'
import { AlertsPanel } from './components/alerts-panel'
import { DashboardBuilder } from './components/dashboard-builder'
import { IncidentsPanel } from './components/incidents-panel'
import { AuditPanel } from './components/audit-panel'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import { InfoTable } from '@/components/info-table'
import { FeatureList } from '@/components/feature-list'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  FolderOpen,
  LayoutGrid,
  FileText,
  AlertOctagon,
  LineChart,
  Bell,
  ActivitySquare,
  Shield,
  Heart,
} from 'lucide-react'

type TabType = 'projects' | 'dashboards' | 'logs' | 'errors' | 'metrics' | 'alerts' | 'incidents' | 'audit' | 'system';

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
  const [activeTab, setActiveTab] = useState<TabType>('projects')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [showLanding, setShowLanding] = useState(() => {
    return !localStorage.getItem('token')
  })
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
          setShowLanding(false)
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

  if (showLanding && !user) {
    return <LandingPage onEnterApp={() => setShowLanding(false)} />
  }

  if (!user) {
    return <AuthView onAuthSuccess={(u) => {
      setUser(u)
      setShowLanding(false)
    }} />
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Advanced Top Navbar */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center border border-border shadow-sm">
              <Activity className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Console Log</h1>
              <p className="text-xs text-muted-foreground">
                Developer Observability Engine &mdash; <span className="font-semibold text-foreground">{user?.email}</span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {selectedProject && (
              <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/80 text-xs shadow-2xs">
                <span className="text-muted-foreground font-semibold">Project:</span>
                <div className="w-40">
                  <Select
                    value={String(selectedProject.id)}
                    onValueChange={(val) => {
                      const proj = projects.find(p => p.id === parseInt(val, 10))
                      if (proj) setSelectedProject(proj)
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs border-none bg-transparent hover:bg-muted py-0 px-1.5 focus:ring-0 cursor-pointer font-bold">
                      <SelectValue placeholder="Select Project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <Button variant="ghost" size="icon-sm" onClick={toggleTheme} className="cursor-pointer">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon-sm" asChild className="cursor-pointer">
              <a href="https://github.com/bonheur/console-log" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 cursor-pointer border-destructive/20 text-destructive hover:bg-destructive/10 font-semibold"
              onClick={async () => {
                try {
                  await API.logout({});
                } catch (e) {
                  // Ignore
                }
                localStorage.removeItem('token');
                setUser(null);
                setShowLanding(true);
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </header>

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-border/60 mb-6 pb-2 overflow-x-auto scrollbar-none gap-2">
          <TabButton
            active={activeTab === 'projects'}
            onClick={() => setActiveTab('projects')}
            icon={FolderOpen}
            label="Projects"
          />
          <TabButton
            active={activeTab === 'dashboards'}
            disabled={!selectedProject}
            onClick={() => setActiveTab('dashboards')}
            icon={LayoutGrid}
            label="Dashboards"
          />
          <TabButton
            active={activeTab === 'logs'}
            disabled={!selectedProject}
            onClick={() => setActiveTab('logs')}
            icon={FileText}
            label="Logs"
          />
          <TabButton
            active={activeTab === 'errors'}
            disabled={!selectedProject}
            onClick={() => setActiveTab('errors')}
            icon={AlertOctagon}
            label="Errors"
          />
          <TabButton
            active={activeTab === 'metrics'}
            disabled={!selectedProject}
            onClick={() => setActiveTab('metrics')}
            icon={LineChart}
            label="Metrics"
          />
          <TabButton
            active={activeTab === 'alerts'}
            disabled={!selectedProject}
            onClick={() => setActiveTab('alerts')}
            icon={Bell}
            label="Alerts"
          />
          <TabButton
            active={activeTab === 'incidents'}
            disabled={!selectedProject}
            onClick={() => setActiveTab('incidents')}
            icon={ActivitySquare}
            label="Incidents"
          />
          <TabButton
            active={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            icon={Shield}
            label="Audit Trail"
          />
          <TabButton
            active={activeTab === 'system'}
            onClick={() => setActiveTab('system')}
            icon={Heart}
            label="System"
          />
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

          {activeTab === 'dashboards' && selectedProject && (
            <DashboardBuilder projectId={selectedProject.id} />
          )}

          {activeTab === 'logs' && selectedProject && (
            <LogExplorer selectedProject={selectedProject} />
          )}

          {activeTab === 'errors' && selectedProject && (
            <ErrorMonitor selectedProject={selectedProject} />
          )}

          {activeTab === 'metrics' && selectedProject && (
            <MetricsDashboard selectedProject={selectedProject} />
          )}

          {activeTab === 'alerts' && selectedProject && (
            <AlertsPanel projectId={selectedProject.id} />
          )}

          {activeTab === 'incidents' && selectedProject && (
            <IncidentsPanel projectId={selectedProject.id} />
          )}

          {activeTab === 'audit' && (
            <AuditPanel />
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
              <div className="rounded-xl border border-border bg-card p-5 shadow-2xs">
                <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-4">GoBridge RPC Hello Greeting Demo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter name..."
                      id="hello-name"
                      className="flex-1"
                      onChange={(e) => setHelloName(e.target.value)}
                    />
                    <Button variant="outline" size="icon" onClick={() => refetchHello()} className="cursor-pointer">
                      <RefreshCw className={`h-4 w-4 ${helloLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  <div className="bg-muted/20 p-4 rounded-lg border border-dashed border-border/80 flex items-center justify-center min-h-[60px]">
                    {helloLoading ? (
                      <p className="text-xs text-muted-foreground italic">Revalidating...</p>
                    ) : helloError ? (
                      <p className="text-xs text-destructive">{helloError.message}</p>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-primary">{helloData?.message || 'Waiting...'}</p>
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

function TabButton({
  active,
  disabled = false,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: any
  label: string
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
        disabled
          ? 'opacity-40 cursor-not-allowed border-transparent text-muted-foreground'
          : active
          ? 'border-primary/20 bg-primary/10 text-primary font-bold shadow-2xs'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  )
}

export default App
