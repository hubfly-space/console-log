import { useState, useEffect } from "react"
import { useBridge } from "@/lib/bridge-hooks"
import { API } from "@/lib/bridge"
import { Button } from "./ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card"
import { Input } from "./ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"
import { Plus, Trash2, Save, LayoutGrid, AlertCircle, FileText, Activity } from "lucide-react"

interface DashboardBuilderProps {
  projectId: number
}

interface WidgetConfig {
  id: string
  name: string
  type: "logs" | "metrics" | "errors"
  streamId?: number
  metricName?: string
  query?: string
}

export function DashboardBuilder({ projectId }: DashboardBuilderProps) {
  const [activeDashboard, setActiveDashboard] = useState<string>("Default Dashboard")
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  
  // Create Dashboard dialog state
  const [isNewDashboardOpen, setIsNewDashboardOpen] = useState(false)
  const [newDashboardName, setNewDashboardName] = useState("")

  // Add Widget dialog state
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false)
  const [widgetName, setWidgetName] = useState("")
  const [widgetType, setWidgetType] = useState<"logs" | "metrics" | "errors">("logs")
  const [selectedStreamId, setSelectedStreamId] = useState<string>("all")
  const [selectedMetricName, setSelectedMetricName] = useState<string>("cpu_usage")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch dashboards
  const { data: dashboardsData, refetch: refetchDashboards } = useBridge("getDashboards", { projectId })
  const { data: streamsData } = useBridge("listStreams", { projectId })

  const dashboards = dashboardsData?.dashboards || []
  const streams = streamsData?.streams || []

  // Load layout when active dashboard changes
  useEffect(() => {
    const current = dashboards.find((d) => d.name === activeDashboard)
    if (current && current.layout) {
      try {
        setWidgets(JSON.parse(current.layout))
      } catch (e) {
        setWidgets([])
      }
    } else {
      setWidgets([])
    }
  }, [activeDashboard, dashboardsData])

  const handleCreateDashboard = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDashboardName.trim()) return
    try {
      await API.saveDashboard({
        projectId,
        name: newDashboardName,
        layout: "[]",
      })
      setActiveDashboard(newDashboardName)
      setNewDashboardName("")
      setIsNewDashboardOpen(false)
      refetchDashboards()
    } catch (err) {
      console.error("Failed to create dashboard", err)
    }
  }

  const handleSaveDashboard = async () => {
    try {
      await API.saveDashboard({
        projectId,
        name: activeDashboard,
        layout: JSON.stringify(widgets),
      })
      alert("Dashboard configuration saved successfully!")
      refetchDashboards()
    } catch (err) {
      console.error("Failed to save dashboard", err)
    }
  }

  const handleAddWidget = (e: React.FormEvent) => {
    e.preventDefault()
    if (!widgetName.trim()) return

    const newWidget: WidgetConfig = {
      id: "widget_" + Date.now(),
      name: widgetName,
      type: widgetType,
      streamId: widgetType === "logs" && selectedStreamId !== "all" ? parseInt(selectedStreamId, 10) : undefined,
      metricName: widgetType === "metrics" ? selectedMetricName : undefined,
      query: widgetType === "logs" && searchQuery.trim() ? searchQuery : undefined,
    }

    setWidgets([...widgets, newWidget])
    setWidgetName("")
    setSearchQuery("")
    setIsAddWidgetOpen(false)
  }

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter((w) => w.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Custom Dashboards</h2>
          <p className="text-sm text-muted-foreground">Build, customize, and save multi-widget operations panels.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-56">
            <Select value={activeDashboard} onValueChange={setActiveDashboard}>
              <SelectTrigger>
                <SelectValue placeholder="Select Dashboard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Default Dashboard">Default Dashboard</SelectItem>
                {dashboards.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isNewDashboardOpen} onOpenChange={setIsNewDashboardOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="cursor-pointer">
                New Panel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Dashboard</DialogTitle>
                <DialogDescription>Enter a name for your custom operations dashboard panel.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateDashboard} className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Dashboard Name</label>
                  <Input
                    required
                    placeholder="e.g. Production Overview"
                    value={newDashboardName}
                    onChange={(e) => setNewDashboardName(e.target.value)}
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium cursor-pointer">
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddWidgetOpen} onOpenChange={setIsAddWidgetOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-500 font-medium">
                <Plus className="mr-1.5 size-4" /> Add Widget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Custom Widget</DialogTitle>
                <DialogDescription>Configure a widget type and add it to your current dashboard view.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddWidget} className="space-y-4 py-2">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Widget Title *</label>
                  <Input
                    required
                    placeholder="e.g. CPU Load Status"
                    value={widgetName}
                    onChange={(e) => setWidgetName(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Widget Type</label>
                  <Select value={widgetType} onValueChange={(val: any) => setWidgetType(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="logs">Logs Live-Feed</SelectItem>
                      <SelectItem value="metrics">Metric Chart</SelectItem>
                      <SelectItem value="errors">Error Group Inspector</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {widgetType === "logs" && (
                  <>
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Target Stream</label>
                      <Select value={selectedStreamId} onValueChange={setSelectedStreamId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Streams</SelectItem>
                          {streams.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Search Filter (Optional)</label>
                      <Input
                        placeholder="Filter by keyword..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {widgetType === "metrics" && (
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Metric Name</label>
                    <Select value={selectedMetricName} onValueChange={setSelectedMetricName}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cpu_usage">CPU Usage (%)</SelectItem>
                        <SelectItem value="memory_usage">RAM Usage (MB)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <DialogFooter className="pt-4">
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium cursor-pointer">
                    Add to Dashboard
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {widgets.length > 0 && (
            <Button variant="outline" onClick={handleSaveDashboard} className="cursor-pointer border-indigo-600/30 text-indigo-600 hover:bg-indigo-50 bg-indigo-50/10 font-medium">
              <Save className="mr-1.5 size-4" /> Save View
            </Button>
          )}
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-16 text-center text-muted-foreground bg-card/20">
          <LayoutGrid className="mb-4 size-10 opacity-30" />
          <h3 className="font-semibold text-foreground text-base">Empty Dashboard Panel</h3>
          <p className="max-w-xs text-xs mt-1.5">No monitoring widgets added yet. Click &quot;Add Widget&quot; to build your operations dashboard.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {widgets.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              projectId={projectId}
              onRemove={() => handleRemoveWidget(w.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function WidgetCard({
  widget,
  projectId,
  onRemove,
}: {
  widget: WidgetConfig
  projectId: number
  onRemove: () => void
}) {
  return (
    <Card className="border-border/60 shadow-xs flex flex-col h-[320px] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 border-b border-border/60 bg-muted/10">
        <div className="flex items-center gap-2">
          {widget.type === "logs" && <FileText className="size-4 text-indigo-600" />}
          {widget.type === "metrics" && <Activity className="size-4 text-emerald-600" />}
          {widget.type === "errors" && <AlertCircle className="size-4 text-rose-600" />}
          <CardTitle className="text-sm font-semibold truncate max-w-[200px]">{widget.name}</CardTitle>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRemove} className="cursor-pointer text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-3 flex-1 overflow-hidden flex flex-col">
        {widget.type === "logs" && <WidgetLogsView projectId={projectId} streamId={widget.streamId} query={widget.query} />}
        {widget.type === "metrics" && <WidgetMetricsView projectId={projectId} metricName={widget.metricName || "cpu_usage"} />}
        {widget.type === "errors" && <WidgetErrorsView projectId={projectId} />}
      </CardContent>
    </Card>
  )
}

function WidgetLogsView({ projectId, streamId, query }: { projectId: number; streamId?: number; query?: string }) {
  const { data, loading } = useBridge("queryLogs", {
    projectId,
    streamId: streamId || null,
    query: query || "",
    levels: [],
    startTime: "",
    endTime: "",
    limit: 10,
    offset: 0,
  })

  if (loading) return <div className="text-2xs text-muted-foreground p-4">Loading logs...</div>
  const logs = data?.logs || []

  if (logs.length === 0) return <div className="text-2xs text-muted-foreground p-4 text-center">No log events found.</div>

  return (
    <div className="space-y-1.5 flex-1 overflow-y-auto text-3xs font-mono">
      {logs.map((l) => (
        <div key={l.id} className="border border-border/40 rounded-md p-1.5 bg-muted/10 flex items-start gap-2">
          <span className={`text-[9px] uppercase font-bold shrink-0 ${
            l.level === "error" || l.level === "critical" ? "text-rose-600" :
            l.level === "warn" ? "text-amber-600" : "text-indigo-600"
          }`}>
            {l.level}
          </span>
          <span className="text-foreground truncate flex-1">{l.message}</span>
          <span className="text-muted-foreground shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  )
}

function WidgetMetricsView({ projectId, metricName }: { projectId: number; metricName: string }) {
  const { data, loading } = useBridge("queryMetrics", {
    projectId,
    metricName,
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // last 30 mins
    endTime: "",
  })

  if (loading) return <div className="text-2xs text-muted-foreground p-4">Loading metric data...</div>
  const points = data?.points || []

  if (points.length === 0) return <div className="text-2xs text-muted-foreground p-4 text-center">No metrics points recorded.</div>

  // Find max value to normalize svg chart height
  const maxVal = Math.max(...points.map((p) => p.value), 10)
  const chartHeight = 160
  const chartWidth = 380

  // Draw simple SVG line chart
  const pointsString = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * chartWidth
      const y = chartHeight - (p.value / maxVal) * (chartHeight - 20) - 10
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className="flex flex-col flex-1 justify-between">
      <div className="flex items-center justify-between text-2xs text-muted-foreground pb-2">
        <span>Last 30m</span>
        <span className="font-semibold text-foreground">
          Avg: {(points.reduce((acc, p) => acc + p.value, 0) / points.length).toFixed(1)} {metricName === "cpu_usage" ? "%" : "MB"}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center bg-muted/20 border border-border/40 rounded-lg p-2 overflow-hidden">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
          <polyline
            fill="none"
            stroke="var(--color-indigo-600, #4f46e5)"
            strokeWidth="2"
            points={pointsString}
          />
        </svg>
      </div>
    </div>
  )
}

function WidgetErrorsView({ projectId }: { projectId: number }) {
  const { data, loading } = useBridge("queryErrors", {
    projectId,
    startTime: "",
    endTime: "",
  })

  if (loading) return <div className="text-2xs text-muted-foreground p-4">Loading errors...</div>
  const errors = data?.errors || []

  if (errors.length === 0) return <div className="text-2xs text-muted-foreground p-4 text-center">No error events detected.</div>

  return (
    <div className="space-y-2 flex-1 overflow-y-auto">
      {errors.slice(0, 5).map((e, i) => (
        <div key={i} className="flex items-center justify-between border border-border/50 bg-rose-50/5 p-2 rounded-md">
          <div className="max-w-[240px] truncate">
            <span className="font-semibold text-xs text-foreground block truncate">{e.message}</span>
            <span className="text-[10px] text-muted-foreground block truncate">{e.errorGroup}</span>
          </div>
          <span className="text-2xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-sm">
            {e.count}
          </span>
        </div>
      ))}
    </div>
  )
}
