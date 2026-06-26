import { useState, useEffect, useRef } from 'react'
import { API, LogEvent, Project, Stream } from '../lib/bridge'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { 
  Search, 
  RefreshCw, 
  Terminal, 
  ChevronDown, 
  ChevronRight, 
  Calendar,
  Layers,
  Database,
  Play,
  Pause,
  AlertTriangle,
  Info
} from 'lucide-react'

interface LogExplorerProps {
  selectedProject: Project;
}

export function LogExplorer({ selectedProject }: LogExplorerProps) {
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [histogram, setHistogram] = useState<{ time: string; count: number }[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [selectedStreamId, setSelectedStreamId] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [timeRange, setTimeRange] = useState<string>('1h') // 15m, 1h, 24h
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  
  const [liveTail, setLiveTail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generatingDemo, setGeneratingDemo] = useState(false)
  const liveTailInterval = useRef<NodeJS.Timeout | null>(null)

  // Log level configurations
  const levelsConfig: Record<string, { bg: string; text: string; dot: string }> = {
    trace: { bg: 'bg-zinc-500/10 border-zinc-500/20', text: 'text-zinc-400', dot: 'bg-zinc-400' },
    debug: { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
    info: { bg: 'bg-sky-500/10 border-sky-500/20', text: 'text-sky-400', dot: 'bg-sky-400' },
    success: { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    warning: { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
    error: { bg: 'bg-rose-500/10 border-rose-500/20', text: 'text-rose-400', dot: 'bg-rose-400' },
    fatal: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
  }

  // Fetch streams
  const loadStreams = async () => {
    try {
      const res = await API.listStreams({ projectId: selectedProject.id })
      setStreams(res.streams || [])
    } catch (e) {
      console.error('Failed to load streams', e)
    }
  }

  // Calculate StartTime based on selected range
  const getStartTime = () => {
    const now = new Date()
    if (timeRange === '15m') now.setMinutes(now.getMinutes() - 15)
    else if (timeRange === '1h') now.setHours(now.getHours() - 1)
    else if (timeRange === '24h') now.setHours(now.getHours() - 24)
    return now.toISOString()
  }

  // Load logs and histogram data
  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const startTime = getStartTime()
      const endTime = new Date().toISOString()
      const streamIdParam = selectedStreamId === 'all' ? null : parseInt(selectedStreamId)

      // Query logs
      const logsRes = await API.queryLogs({
        projectId: selectedProject.id,
        streamId: streamIdParam,
        query: query,
        levels: selectedLevels,
        startTime: startTime,
        endTime: endTime,
        limit: 100,
        offset: 0
      })
      setLogs(logsRes.logs || [])

      // Query histogram
      const histRes = await API.getLogHistogram({
        projectId: selectedProject.id,
        streamId: streamIdParam,
        query: query,
        levels: selectedLevels,
        startTime: startTime,
        endTime: endTime
      })
      setHistogram(histRes.buckets || [])
    } catch (err) {
      console.error('Failed to query observability data', err)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Load streams and initial logs on project change or query filters change
  useEffect(() => {
    loadStreams()
    loadData(true)
  }, [selectedProject, selectedStreamId, selectedLevels, timeRange])

  // Periodic tail trigger
  useEffect(() => {
    if (liveTail) {
      liveTailInterval.current = setInterval(() => {
        loadData(false)
      }, 3000)
    } else {
      if (liveTailInterval.current) {
        clearInterval(liveTailInterval.current)
      }
    }
    return () => {
      if (liveTailInterval.current) clearInterval(liveTailInterval.current)
    }
  }, [liveTail, query, selectedStreamId, selectedLevels, timeRange])

  const toggleLevel = (lvl: string) => {
    setSelectedLevels(prev => 
      prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]
    )
  }

  const handleGenerateDemo = async () => {
    setGeneratingDemo(true)
    try {
      await API.generateDemoData({})
      await loadData(true)
    } catch (e) {
      alert('Failed to generate demo data')
    } finally {
      setGeneratingDemo(false)
    }
  }

  // Calculate SVG histogram dimensions
  const maxCount = Math.max(...histogram.map(b => b.count), 1)
  const svgWidth = 800
  const svgHeight = 60
  const padding = 2
  const barWidth = (svgWidth / histogram.length) - padding

  return (
    <div className="space-y-6">
      {/* Controls & Filter Bar */}
      <Card className="border-border/80 bg-card/45 backdrop-blur-md">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search messages or payload fields (e.g. status=200, user_id=42)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
                className="w-full bg-secondary/30 hover:bg-secondary/50 focus:bg-background pl-9 pr-4 py-2 rounded-lg text-sm border border-border/80 focus:border-primary focus:outline-none transition-all"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Stream Select */}
              <div className="flex items-center gap-1.5 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/80 text-xs">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={selectedStreamId}
                  onChange={(e) => setSelectedStreamId(e.target.value)}
                  className="bg-transparent font-medium border-none focus:outline-none cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <option value="all">All Streams</option>
                  {streams.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Time Range Select */}
              <div className="flex items-center gap-1.5 bg-secondary/30 px-3 py-1.5 rounded-lg border border-border/80 text-xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-transparent font-medium border-none focus:outline-none cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <option value="15m">Last 15 min</option>
                  <option value="1h">Last 1 hour</option>
                  <option value="24h">Last 24 hours</option>
                </select>
              </div>

              {/* Action Buttons */}
              <Button
                variant={liveTail ? "default" : "outline"}
                size="sm"
                onClick={() => setLiveTail(!liveTail)}
                className={`gap-1.5 text-xs h-8 cursor-pointer ${liveTail ? 'bg-primary text-primary-foreground animate-pulse' : ''}`}
              >
                {liveTail ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Live Tailing
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Live Tail
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => loadData()}
                disabled={loading}
                className="h-8 w-8 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Level Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">
              Log Levels:
            </span>
            {Object.keys(levelsConfig).map(lvl => {
              const active = selectedLevels.includes(lvl)
              const cfg = levelsConfig[lvl]
              return (
                <button
                  key={lvl}
                  onClick={() => toggleLevel(lvl)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium transition-all cursor-pointer ${
                    active 
                      ? 'bg-primary/10 border-primary/30 text-primary' 
                      : 'bg-background hover:bg-muted/40 border-border/80 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  <span className="capitalize">{lvl}</span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* SVG Histogram Chart */}
      {histogram.length > 0 && (
        <Card className="border-border/80 bg-card/45 overflow-hidden">
          <div className="px-4 pt-3 flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Log Distribution Over Time
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Max bucket count: {maxCount}
            </span>
          </div>
          <CardContent className="pt-2 pb-4">
            <div className="w-full overflow-hidden">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-16">
                <defs>
                  <linearGradient id="barGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                {histogram.map((bucket, index) => {
                  const barHeight = (bucket.count / maxCount) * (svgHeight - 5)
                  const x = index * (barWidth + padding)
                  const y = svgHeight - barHeight
                  return (
                    <g key={index} className="group">
                      <rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(barHeight, 2)}
                        rx={1}
                        fill="url(#barGlow)"
                        className="transition-all duration-200 group-hover:fill-primary"
                      />
                      <title>{`${new Date(bucket.Time).toLocaleTimeString()} - ${bucket.count} events`}</title>
                    </g>
                  )
                })}
              </svg>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs Table / List */}
      <Card className="border-border/80 bg-card/35 overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-20">
            <Terminal className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No Logs Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed mb-4">
              We couldn't find any log events for {selectedProject.name} matching the selected filters.
            </p>
            <Button 
              variant="outline" 
              onClick={handleGenerateDemo} 
              disabled={generatingDemo}
              className="gap-2 cursor-pointer"
            >
              {generatingDemo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-primary" />}
              Generate Mock Demo Data
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40 font-mono text-xs max-h-[600px] overflow-y-auto">
            {logs.map((log) => {
              const isExpanded = expandedLogId === log.id
              const lvlCfg = levelsConfig[log.level] || { bg: 'bg-muted border-border/80', text: 'text-muted-foreground', dot: 'bg-muted-foreground' }
              const logTime = new Date(log.timestamp).toLocaleTimeString()
              
              return (
                <div 
                  key={log.id} 
                  className={`hover:bg-muted/15 transition-all ${isExpanded ? 'bg-muted/10' : ''}`}
                >
                  {/* Summary Row */}
                  <div 
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex items-start p-3 gap-3 cursor-pointer select-none"
                  >
                    <div className="shrink-0 pt-0.5 text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </div>
                    
                    <span className="shrink-0 text-muted-foreground/75 w-16">
                      {logTime}
                    </span>

                    <span className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-semibold uppercase tracking-wider ${lvlCfg.bg} ${lvlCfg.text}`}>
                      <span className={`h-1 w-1 rounded-full ${lvlCfg.dot}`} />
                      {log.level}
                    </span>

                    <span className="flex-1 truncate text-foreground/90 font-medium">
                      {log.message}
                    </span>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-9 pb-3 pt-1 border-t border-dashed border-border/20 bg-secondary/10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 text-[10px] text-muted-foreground py-2 border-b border-border/20">
                        <div>
                          <span className="font-semibold text-foreground mr-1">Timestamp:</span>
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground mr-1">Log ID:</span>
                          {log.id}
                        </div>
                        {log.streamId && (
                          <div>
                            <span className="font-semibold text-foreground mr-1">Stream:</span>
                            Stream #{log.streamId}
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-foreground mr-1">Type:</span>
                          {log.type}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Structured Metadata context:
                        </span>
                        <pre className="text-[10px] bg-secondary/50 p-3 rounded-lg overflow-x-auto text-muted-foreground border border-border/50 select-all max-h-48">
                          {JSON.stringify(log.Payload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
