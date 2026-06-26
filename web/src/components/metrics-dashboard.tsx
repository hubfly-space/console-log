import { useState, useEffect } from 'react'
import { API, MetricDataPoint, Project } from '../lib/bridge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { 
  Activity, 
  RefreshCw, 
  Cpu, 
  MemoryStick, 
  Database,
  BarChart3,
  TrendingUp
} from 'lucide-react'

interface MetricsDashboardProps {
  selectedProject: Project;
}

export function MetricsDashboard({ selectedProject }: MetricsDashboardProps) {
  const [cpuPoints, setCpuPoints] = useState<MetricDataPoint[]>([])
  const [ramPoints, setRamPoints] = useState<MetricDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [seedingDemo, setSeedingDemo] = useState(false)

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() // last 24h
      
      const cpuRes = await API.queryMetrics({
        projectId: selectedProject.id,
        metricName: 'cpu_usage',
        startTime,
        endTime: now.toISOString()
      })
      setCpuPoints(cpuRes.points || [])

      const ramRes = await API.queryMetrics({
        projectId: selectedProject.id,
        metricName: 'memory_usage',
        startTime,
        endTime: now.toISOString()
      })
      setRamPoints(ramRes.points || [])
    } catch (e) {
      console.error('Failed to load metrics', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMetrics()
  }, [selectedProject])

  const handleSeedDemo = async () => {
    setSeedingDemo(true)
    try {
      await API.generateDemoData({})
      await loadMetrics()
    } catch (e) {
      alert('Failed to seed metrics demo')
    } finally {
      setSeedingDemo(false)
    }
  }

  // Helper stats calculators
  const getStats = (points: MetricDataPoint[]) => {
    if (points.length === 0) return { current: 0, max: 0, avg: 0 }
    const values = points.map(p => p.value)
    const current = values[values.length - 1]
    const max = Math.max(...values)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    return { current, max, avg }
  }

  const cpuStats = getStats(cpuPoints)
  const ramStats = getStats(ramPoints)

  return (
    <div className="space-y-6">
      {/* Header toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Metrics Dashboard</h2>
          <h3 className="text-base font-bold text-foreground">Real-Time Resource Telemetry</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={loadMetrics} disabled={loading} className="cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {cpuPoints.length === 0 || ramPoints.length === 0 ? (
        <Card className="border-border/80 bg-card/45 backdrop-blur-md">
          <div className="text-center py-24">
            <BarChart3 className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No Metrics Recorded</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed mb-4">
              We couldn't find CPU/RAM server statistics for this project. Seed demo data to see charts immediately.
            </p>
            <Button 
              variant="outline" 
              onClick={handleSeedDemo} 
              disabled={seedingDemo}
              className="gap-2 cursor-pointer"
            >
              {seedingDemo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-primary" />}
              Generate Mock Metrics Data
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* KPI grid cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* CPU Stats Card */}
            <Card className="border-border/80 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-400" />
                  CPU Allocation
                </CardTitle>
                <CardDescription className="text-xs">
                  Active server core processing utilization
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {cpuStats.current.toFixed(1)}%
                  </span>
                  <span className="text-xs text-muted-foreground">current load</span>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Average</span>
                    <span className="text-foreground">{cpuStats.avg.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Peak Max</span>
                    <span className="text-foreground">{cpuStats.max.toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Memory Stats Card */}
            <Card className="border-border/80 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-emerald-400" />
                  Memory Footprint
                </CardTitle>
                <CardDescription className="text-xs">
                  Heap allocation in megabytes
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {ramStats.current.toFixed(0)} MB
                  </span>
                  <span className="text-xs text-muted-foreground">allocated heap</span>
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Average</span>
                    <span className="text-foreground">{ramStats.avg.toFixed(0)} MB</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Peak Max</span>
                    <span className="text-foreground">{ramStats.max.toFixed(0)} MB</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Area charts */}
          <div className="grid grid-cols-1 gap-6">
            {/* CPU Chart */}
            <Card className="border-border/80 bg-card/45">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
                  CPU Load History (Last 24 Hours)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <MetricAreaChart points={cpuPoints} color="slate" maxVal={100} unit="%" />
              </CardContent>
            </Card>

            {/* RAM Chart */}
            <Card className="border-border/80 bg-card/45">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  Memory footprint curve (Last 24 Hours)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <MetricAreaChart points={ramPoints} color="emerald" maxVal={1000} unit=" MB" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

interface AreaChartProps {
  points: MetricDataPoint[];
  color: 'slate' | 'emerald';
  maxVal: number;
  unit: string;
}

function MetricAreaChart({ points, color, maxVal, unit }: AreaChartProps) {
  const width = 500
  const height = 150

  const yMax = Math.max(...points.map(p => p.value), maxVal)
  const yMin = 0

  // Map values to coordinates
  const mappedPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = height - ((p.value - yMin) / (yMax - yMin)) * (height - 20) - 10
    return { x, y, value: p.value, time: p.timestamp }
  })

  // Create path description: M x y L x y...
  let linePath = ''
  let areaPath = ''

  if (mappedPoints.length > 0) {
    linePath = `M ${mappedPoints[0].x} ${mappedPoints[0].y} `
    for (let i = 1; i < mappedPoints.length; i++) {
      linePath += `L ${mappedPoints[i].x} ${mappedPoints[i].y} `
    }

    areaPath = `${linePath} L ${mappedPoints[mappedPoints.length - 1].x} ${height} L ${mappedPoints[0].x} ${height} Z`
  }

  // Curated theme styles
  const theme = {
    slate: {
      stroke: 'var(--color-primary)',
      gradient: '#64748b',
      bgGlow: 'rgba(100, 116, 139, 0.15)',
    },
    emerald: {
      stroke: 'var(--color-primary)', // oklch primary used dynamically
      gradient: '#10b981',
      bgGlow: 'rgba(16, 185, 129, 0.15)',
    }
  }

  const selectedTheme = theme[color]

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={selectedTheme.gradient} stopOpacity="0.4" />
            <stop offset="100%" stopColor={selectedTheme.gradient} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={0} y1={height} x2={width} y2={height} stroke="rgba(128,128,128,0.15)" strokeWidth={1} />
        <line x1={0} y1={height/2} x2={width} y2={height/2} stroke="rgba(128,128,128,0.1)" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={0} y1={10} x2={width} y2={10} stroke="rgba(128,128,128,0.1)" strokeWidth={1} strokeDasharray="3 3" />

        {/* Fill area */}
        {areaPath && (
          <path d={areaPath} fill={`url(#gradient-${color})`} />
        )}

        {/* Stroke line */}
        {linePath && (
          <path d={linePath} fill="none" stroke={selectedTheme.gradient} strokeWidth={2} strokeLinecap="round" />
        )}

        {/* Data points (dots on hover) */}
        {mappedPoints.map((p, i) => {
          // Render a simple circle for every 4th point or peak to avoid clutter
          if (i % 4 !== 0) return null
          return (
            <g key={i} className="group">
              <circle
                cx={p.x}
                cy={p.y}
                r={2.5}
                fill={selectedTheme.gradient}
                className="hover:r-4 transition-all cursor-pointer"
              />
              <title>{`${p.value.toFixed(1)}${unit} - ${new Date(p.time).toLocaleTimeString()}`}</title>
            </g>
          )
        })}
      </svg>
      {/* Legend */}
      <div className="flex justify-between text-[8px] font-mono text-muted-foreground mt-2 border-t border-border/20 pt-2">
        <span>{mappedPoints.length > 0 ? new Date(mappedPoints[0].time).toLocaleTimeString() : '—'}</span>
        <span>{mappedPoints.length > 0 ? new Date(mappedPoints[mappedPoints.length - 1].time).toLocaleTimeString() : '—'}</span>
      </div>
    </div>
  )
}
