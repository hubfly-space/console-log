import { useState } from "react"
import { useBridge } from "@/lib/bridge-hooks"
import { API } from "@/lib/bridge"
import { Button } from "./ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"
import { AlertCircle, Plus, Clock, MessageSquare, ShieldAlert, CheckCircle2, ChevronRight } from "lucide-react"

interface IncidentsPanelProps {
  projectId: number
}

export function IncidentsPanel({ projectId }: IncidentsPanelProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [severity, setSeverity] = useState("warning")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Selected incident details for updates
  const [selectedIncidentId, setSelectedIncidentId] = useState<number | null>(null)
  const [updateMessage, setUpdateMessage] = useState("")
  const [updateStatus, setUpdateStatus] = useState("investigating")
  const [isUpdating, setIsUpdating] = useState(false)

  // Fetch incidents
  const { data: incidentsData, refetch: refetchIncidents } = useBridge("listIncidents", { projectId })
  const incidents = incidentsData?.incidents || []

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setIsSubmitting(true)
    try {
      await API.createIncident({
        projectId,
        title,
        severity,
        description,
      })
      setTitle("")
      setDescription("")
      setIsCreateOpen(false)
      refetchIncidents()
    } catch (err) {
      console.error("Failed to create incident", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedIncidentId || !updateMessage.trim()) return
    setIsUpdating(true)
    try {
      await API.updateIncidentStatus({
        id: selectedIncidentId,
        message: updateMessage,
        status: updateStatus,
      })
      setUpdateMessage("")
      refetchIncidents()
    } catch (err) {
      console.error("Failed to post incident update", err)
    } finally {
      setIsUpdating(false)
    }
  }

  const selectedIncident = incidents.find((i) => i.id === selectedIncidentId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Incident Outage Board</h2>
          <p className="text-sm text-muted-foreground">Track system outages, review diagnostic timelines, and post status updates.</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer bg-blue-600 text-white hover:bg-blue-500 font-medium">
              <Plus className="mr-1.5 size-4" /> Log Incident
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Incident Outage</DialogTitle>
              <DialogDescription>Declare a new service outage or performance degradation incident.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateIncident} className="space-y-4 py-2">
              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Incident Title *</label>
                <Input
                  required
                  placeholder="e.g. Stripe API Payment failures"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Severity</label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info / Notice</SelectItem>
                    <SelectItem value="warning">Warning / Degradation</SelectItem>
                    <SelectItem value="critical">Critical / Outage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Diagnostic Description</label>
                <Textarea
                  placeholder="Describe details, impacted streams or regions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer">
                  {isSubmitting ? "Logging..." : "Declare Incident"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Incident List */}
        <Card className="lg:col-span-2 border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Incidents Outages ({incidents.length})</CardTitle>
            <CardDescription>Review open & resolved outage logs.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <CheckCircle2 className="mb-2 size-8 text-emerald-600 opacity-60" />
                <span className="text-sm font-medium text-foreground">All Systems Operational</span>
                <span className="text-xs mt-1">No active incidents logged for this project.</span>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => {
                      setSelectedIncidentId(inc.id)
                      setUpdateStatus(inc.status)
                    }}
                    className={`flex items-start justify-between p-4 cursor-pointer transition-colors ${
                      selectedIncidentId === inc.id ? "bg-muted/50 border-r-2 border-blue-600" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${
                          inc.status === "resolved" ? "bg-emerald-500" :
                          inc.severity === "critical" ? "bg-rose-500 animate-pulse" : "bg-amber-500"
                        }`} />
                        <span className="font-semibold text-sm text-foreground">{inc.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{inc.description}</p>
                      <div className="flex items-center text-[10px] text-muted-foreground gap-3 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {new Date(inc.createdAt).toLocaleString()}
                        </span>
                        <span className="uppercase text-2xs font-semibold tracking-wider">
                          {inc.status}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="size-4 text-muted-foreground opacity-60 self-center" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diagnostic Timeline / Updates */}
        <Card className="border-border/60 shadow-xs flex flex-col h-[500px]">
          <CardHeader className="border-b border-border/60 bg-muted/10 py-3">
            <CardTitle className="text-sm font-semibold">Incident Diagnosis & Updates</CardTitle>
            <CardDescription>Select an incident on the left to inspect timeline.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto flex flex-col justify-between">
            {!selectedIncident ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground flex-1">
                <ShieldAlert className="mb-2 size-8 opacity-30" />
                <span className="text-xs">Select an incident from the board list to review diagnosis logs or update outage status.</span>
              </div>
            ) : (
              <div className="flex flex-col flex-1 justify-between h-full space-y-4">
                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  <div className="border-b border-border/60 pb-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-sm ${
                        selectedIncident.severity === "critical" ? "bg-rose-100 text-rose-700" :
                        selectedIncident.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                      }`}>
                        {selectedIncident.severity}
                      </span>
                      <span className="text-2xs text-muted-foreground">ID: #{selectedIncident.id}</span>
                    </div>
                    <span className="font-bold text-sm block text-foreground">{selectedIncident.title}</span>
                    <p className="text-xs text-muted-foreground">{selectedIncident.description}</p>
                  </div>

                  {/* Updates Timeline */}
                  <div className="space-y-4 relative pl-3 border-l border-border">
                    {selectedIncident.updates.map((up) => (
                      <div key={up.id} className="relative space-y-0.5">
                        <span className="absolute -left-[17px] top-1 size-2 rounded-full border border-card bg-blue-600" />
                        <div className="flex items-center justify-between">
                          <span className="text-2xs font-semibold text-foreground uppercase tracking-wider">{up.status}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(up.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{up.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Post Status Update Form */}
                <form onSubmit={handlePostUpdate} className="border-t border-border/60 pt-3 space-y-3 shrink-0">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">New Status</label>
                      <Select value={updateStatus} onValueChange={setUpdateStatus}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="investigating">Investigating</SelectItem>
                          <SelectItem value="identified">Identified</SelectItem>
                          <SelectItem value="monitoring">Monitoring</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase">Post As</label>
                      <span className="text-xs text-muted-foreground py-1.5 flex items-center gap-1">
                        <MessageSquare className="size-3.5" /> Diagnostic Update
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      required
                      placeholder="Explain current progress..."
                      value={updateMessage}
                      className="h-8 text-xs flex-1"
                      onChange={(e) => setUpdateMessage(e.target.value)}
                    />
                    <Button type="submit" disabled={isUpdating} size="sm" className="bg-blue-600 text-white hover:bg-blue-500 font-medium cursor-pointer">
                      {isUpdating ? "..." : "Post"}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
