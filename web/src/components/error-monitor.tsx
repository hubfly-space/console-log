import { useState, useEffect } from 'react'
import { API, ErrorGroup, LogEvent, Project } from '../lib/bridge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { 
  AlertOctagon, 
  RefreshCw, 
  ChevronRight, 
  Calendar, 
  Clock, 
  Eye, 
  Terminal,
  Database,
  ArrowLeft
} from 'lucide-react'

interface ErrorMonitorProps {
  selectedProject: Project;
}

export function ErrorMonitor({ selectedProject }: ErrorMonitorProps) {
  const [errors, setErrors] = useState<ErrorGroup[]>([])
  const [selectedError, setSelectedError] = useState<ErrorGroup | null>(null)
  const [errorDetails, setErrorDetails] = useState<LogEvent[]>([])
  const [selectedOccurrence, setSelectedOccurrence] = useState<LogEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [generatingDemo, setGeneratingDemo] = useState(false)

  const loadErrors = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() // last 24h
      const res = await API.queryErrors({
        projectId: selectedProject.id,
        startTime,
        endTime: now.toISOString()
      })
      setErrors(res.errors || [])
    } catch (e) {
      console.error('Failed to load error groups', e)
    } finally {
      setLoading(false)
    }
  }

  const loadErrorDetails = async (errGroup: ErrorGroup) => {
    setDetailsLoading(true)
    try {
      const res = await API.getErrorDetails({ errorGroup: errGroup.errorGroup })
      setErrorDetails(res.errors || [])
      if (res.errors && res.errors.length > 0) {
        setSelectedOccurrence(res.errors[0])
      } else {
        setSelectedOccurrence(null)
      }
    } catch (e) {
      console.error('Failed to load error occurrences', e)
    } finally {
      setDetailsLoading(false)
    }
  }

  useEffect(() => {
    loadErrors()
    setSelectedError(null)
    setErrorDetails([])
    setSelectedOccurrence(null)
  }, [selectedProject])

  useEffect(() => {
    if (selectedError) {
      loadErrorDetails(selectedError)
    }
  }, [selectedError])

  const handleGenerateDemo = async () => {
    setGeneratingDemo(true)
    try {
      await API.generateDemoData({})
      await loadErrors()
    } catch (e) {
      alert('Failed to seed demo data')
    } finally {
      setGeneratingDemo(false)
    }
  }

  if (selectedError) {
    return (
      <div className="space-y-6">
        {/* Back Button and Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setSelectedError(null); setErrorDetails([]); setSelectedOccurrence(null) }}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to groups
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Exception Intelligence</h2>
            <h3 className="text-base font-bold truncate max-w-xl text-rose-500 mt-0.5">{selectedError.message}</h3>
          </div>
        </div>

        {/* Detailed Occurrence Viewer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: Occurrences list */}
          <Card className="border-border/80 bg-card/50 lg:col-span-1 max-h-[500px] overflow-y-auto">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Occurrences ({errorDetails.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/40 font-mono text-[10px]">
              {detailsLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                </div>
              ) : errorDetails.length === 0 ? (
                <p className="text-center py-6 italic text-muted-foreground">No occurrences found.</p>
              ) : (
                errorDetails.map((occ, i) => {
                  const active = selectedOccurrence?.id === occ.id
                  return (
                    <button
                      key={occ.id}
                      onClick={() => setSelectedOccurrence(occ)}
                      className={`w-full text-left p-3.5 hover:bg-muted/10 transition-all flex items-center justify-between cursor-pointer ${
                        active ? 'bg-rose-500/10 border-l-2 border-rose-500 text-rose-400' : 'text-muted-foreground'
                      }`}
                    >
                      <span className="truncate">{new Date(occ.timestamp).toLocaleString()}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-2" />
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Right panel: Stack trace / Context viewer */}
          <Card className="lg:col-span-2 border-border/80 bg-card/50">
            <CardHeader className="border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-500" />
                Error Context & Stack Trace
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {selectedOccurrence ? (
                <>
                  {/* Meta stats */}
                  <div className="grid grid-cols-2 gap-4 bg-secondary/20 p-3 rounded-lg border border-border/50 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Timestamp</span>
                      <span className="text-foreground">{new Date(selectedOccurrence.timestamp).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-0.5">Event ID</span>
                      <span className="text-foreground">#{selectedOccurrence.id}</span>
                    </div>
                  </div>

                  {/* Stack trace */}
                  {selectedOccurrence.Payload?.stack && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                        Stack Trace
                      </span>
                      <pre className="text-[10px] font-mono bg-zinc-950 p-4 rounded-xl text-rose-400/90 overflow-x-auto border border-rose-950/45 leading-relaxed shadow-inner max-h-72 select-all">
                        {String(selectedOccurrence.Payload.stack)}
                      </pre>
                    </div>
                  )}

                  {/* Full Payload Context */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Full Context Payload
                    </span>
                    <pre className="text-[10px] font-mono bg-secondary/50 p-4 rounded-xl text-muted-foreground overflow-x-auto border border-border/50 max-h-52 select-all">
                      {JSON.stringify(selectedOccurrence.Payload, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-muted-foreground italic text-xs">
                  Select an occurrence on the left to inspect its details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* List view of grouped exceptions */}
      <Card className="border-border/80 bg-card/45 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-rose-500" />
              Exception Intelligence
            </CardTitle>
            <CardDescription className="text-xs">
              Errors are automatically grouped by message similarity to prevent alarm storms
            </CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={loadErrors} disabled={loading} className="cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent className="pt-2">
          {errors.length === 0 ? (
            <div className="text-center py-20">
              <AlertOctagon className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No Errors Logged</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed mb-4">
                Excellent! We couldn't find any recorded exceptions or server crashes in the database.
              </p>
              <Button 
                variant="outline" 
                onClick={handleGenerateDemo} 
                disabled={generatingDemo}
                className="gap-2 cursor-pointer"
              >
                {generatingDemo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-primary" />}
                Generate Mock Error Data
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 font-bold">Error Exception Message</th>
                    <th className="py-3 px-4 font-bold text-center">Frequency</th>
                    <th className="py-3 px-4 font-bold">First Seen</th>
                    <th className="py-3 px-4 font-bold">Last Seen</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {errors.map((e, index) => (
                    <tr key={index} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-rose-500 truncate max-w-xs sm:max-w-md">
                        {e.message}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold px-2 py-0.5 rounded-full">
                          {e.count}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {new Date(e.firstSeen).toLocaleDateString()} {new Date(e.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        {new Date(e.lastSeen).toLocaleDateString()} {new Date(e.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedError(e)}
                          className="gap-1 cursor-pointer h-7 text-[10px] text-primary hover:bg-primary/10"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
