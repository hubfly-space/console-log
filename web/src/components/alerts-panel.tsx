import { useState } from "react"
import { useBridge } from "@/lib/bridge-hooks"
import { API } from "@/lib/bridge"
import { Button } from "./ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card"
import { Input } from "./ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"
import { Bell, Plus, Trash2, Eye, EyeOff, AlertCircle, Calendar, ShieldAlert } from "lucide-react"

interface AlertsPanelProps {
  projectId: number
}

export function AlertsPanel({ projectId }: AlertsPanelProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [metricType, setMetricType] = useState("error_count")
  const [threshold, setThreshold] = useState("5")
  const [comparison, setComparison] = useState(">")
  const [timeWindowMins, setTimeWindowMins] = useState("5")
  const [channel, setChannel] = useState("email")
  const [target, setTarget] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  const { data: rulesData, refetch: refetchRules } = useBridge("listAlertRules", { projectId })
  const { data: historyData, refetch: refetchHistory } = useBridge("queryAlertsHistory", { projectId })

  const rules = rulesData?.rules || []
  const history = historyData?.history || []

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !target.trim()) {
      setErrorMsg("Please fill out all required fields.")
      return
    }
    setIsSubmitting(true)
    setErrorMsg("")
    try {
      await API.createAlertRule({
        projectId,
        name,
        metricType,
        threshold: parseFloat(threshold),
        comparison,
        timeWindowMins: parseInt(timeWindowMins, 10),
        channel,
        target,
      })
      setName("")
      setTarget("")
      setIsCreateOpen(false)
      refetchRules()
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create alert rule")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleRule = async (id: number, currentActive: number) => {
    try {
      await API.toggleAlertRule({
        id,
        active: currentActive === 1 ? 0 : 1,
      })
      refetchRules()
    } catch (err) {
      console.error("Failed to toggle rule", err)
    }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm("Are you sure you want to delete this alert rule?")) return
    try {
      await API.deleteAlertRule({ id })
      refetchRules()
    } catch (err) {
      console.error("Failed to delete rule", err)
    }
  }

  const formatMetricName = (type: string) => {
    switch (type) {
      case "error_count":
        return "Error Count"
      case "log_volume":
        return "Log Volume"
      case "cpu_usage":
        return "CPU Usage"
      case "memory_usage":
        return "RAM Usage"
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Alerts & Notifications</h2>
          <p className="text-sm text-muted-foreground">Configure thresholds and notify channels when conditions are met.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-500 font-medium">
              <Plus className="mr-1.5 size-4" /> Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Alert Rule</DialogTitle>
              <DialogDescription>
                Define thresholds to monitor your telemetry. When matching events are detected, an alert triggers.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateRule} className="space-y-4 py-2">
              {errorMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircle className="size-4" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rule Name *</label>
                <Input
                  required
                  placeholder="e.g. Error Spike Alert"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metric Type</label>
                  <Select value={metricType} onValueChange={setMetricType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error_count">Error Count</SelectItem>
                      <SelectItem value="log_volume">Log Volume</SelectItem>
                      <SelectItem value="cpu_usage">CPU Usage</SelectItem>
                      <SelectItem value="memory_usage">RAM Usage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condition</label>
                  <div className="flex gap-2">
                    <div className="w-24">
                      <Select value={comparison} onValueChange={setComparison}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">">&gt;</SelectItem>
                          <SelectItem value="<">&lt;</SelectItem>
                          <SelectItem value=">=">&gt;=</SelectItem>
                          <SelectItem value="<=">&lt;=</SelectItem>
                          <SelectItem value="=">=</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      required
                      className="flex-1"
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time Window (Minutes)</label>
                <Input
                  type="number"
                  required
                  value={timeWindowMins}
                  onChange={(e) => setTimeWindowMins(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notify Channel</label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {channel === "email" ? "Email Target *" : "Webhook URL *"}
                  </label>
                  <Input
                    required
                    placeholder={channel === "email" ? "ops@company.com" : "https://hooks.slack.com/..."}
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Create Rule"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Rules List */}
        <Card className="col-span-2 border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Configured Alert Rules</CardTitle>
            <CardDescription>Rules currently evaluating telemetry streams.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Bell className="mb-2 size-8 opacity-40" />
                <span className="text-sm">No alert rules configured yet.</span>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {rules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{rule.name}</span>
                        <span className="rounded-md border border-border/80 bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground uppercase tracking-wider">
                          {rule.channel}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Triggers when <span className="font-medium text-foreground">{formatMetricName(rule.metricType)}</span> is{" "}
                        <span className="font-medium text-foreground">{rule.comparison} {rule.threshold}</span> over the last{" "}
                        <span className="font-medium text-foreground">{rule.timeWindowMins}m</span>.
                      </p>
                      <p className="text-2xs text-muted-foreground truncate max-w-sm">Target: {rule.target}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleToggleRule(rule.id, rule.active)}
                        title={rule.active === 1 ? "Mute" : "Unmute"}
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        {rule.active === 1 ? <Eye className="size-4 text-emerald-600" /> : <EyeOff className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="cursor-pointer text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Feed */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold">Incident/Alert Log</CardTitle>
              <CardDescription>Recent alerts triggered.</CardDescription>
            </div>
            <Button variant="outline" size="xs" onClick={() => refetchHistory()} className="cursor-pointer">
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <ShieldAlert className="mb-1.5 size-6 opacity-30 text-emerald-600" />
                <span className="text-xs">No alerts triggered recently. System healthy.</span>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {history.map((h) => (
                  <div key={h.id} className="relative pl-4 border-l border-red-500/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground block">{h.ruleName}</span>
                      <span className="text-[10px] text-destructive bg-destructive/10 px-1 rounded-sm">Triggered</span>
                    </div>
                    <p className="text-2xs text-muted-foreground">
                      Value: <span className="font-medium text-foreground">{h.triggeredValue}</span> (Threshold: {h.comparison} {h.threshold})
                    </p>
                    <div className="flex items-center text-[10px] text-muted-foreground gap-1 pt-0.5">
                      <Calendar className="size-3" />
                      <span>{new Date(h.triggeredAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
