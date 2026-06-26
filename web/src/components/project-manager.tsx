import { useState, useEffect } from "react"
import { API, Project, Stream } from "../lib/bridge"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog"
import { Plus, Copy, Check, Hash, Key, Folder, Radio, Info, Terminal, Settings } from "lucide-react"

interface ProjectManagerProps {
  user: any
  onSelectProject: (project: Project | null) => void
  selectedProject: Project | null
  onProjectsUpdated: (projects: Project[]) => void
}

export function ProjectManager({ user, onSelectProject, selectedProject, onProjectsUpdated }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [projectName, setProjectName] = useState("")
  const [streamName, setStreamName] = useState("")
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Dialog open states
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [isStreamModalOpen, setIsStreamModalOpen] = useState(false)

  // Fetch projects on load
  const loadProjects = async () => {
    try {
      const res = await API.listProjects({})
      setProjects(res.projects || [])
      onProjectsUpdated(res.projects || [])
      if (res.projects && res.projects.length > 0 && !selectedProject) {
        onSelectProject(res.projects[0])
      }
    } catch (err) {
      console.error("Failed to load projects", err)
    }
  }

  // Fetch streams for selected project
  const loadStreams = async (projectId: number) => {
    try {
      const res = await API.listStreams({ projectId })
      setStreams(res.streams || [])
    } catch (err) {
      console.error("Failed to load streams", err)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadStreams(selectedProject.id)
    } else {
      setStreams([])
    }
  }, [selectedProject])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return
    setLoading(true)
    try {
      const res = await API.createProject({ name: projectName })
      if (res.success) {
        setProjectName("")
        setIsProjectModalOpen(false)
        await loadProjects()
        onSelectProject(res.project)
      }
    } catch (err) {
      alert("Failed to create project")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!streamName.trim() || !selectedProject) return
    setLoading(true)
    try {
      const res = await API.createStream({ projectId: selectedProject.id, name: streamName })
      if (res.success) {
        setStreamName("")
        setIsStreamModalOpen(false)
        await loadStreams(selectedProject.id)
      }
    } catch (err) {
      alert("Failed to create stream")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(id)
    setTimeout(() => setCopiedText(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Project Selector / Creator header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Monitored Projects
          </h2>
          <p className="text-sm text-muted-foreground">Manage active projects, API credentials, and collection streams.</p>
        </div>

        <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
          <DialogTrigger asChild>
            <Button className="cursor-pointer">
              <Plus className="mr-1.5 size-4" /> Create Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Monitored Project</DialogTitle>
              <DialogDescription>Add a new app or service stack to Console Log.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4 py-2">
              <div className="grid gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Project Name</label>
                <Input
                  required
                  placeholder="e.g. My Backend API"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="submit" disabled={loading} className="w-full cursor-pointer">
                  {loading ? "Creating..." : "Create Project"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Active Projects Cards list */}
        <Card className="border-border/60 bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Active Projects ({projects.length})</CardTitle>
            <CardDescription>Select an active project to explore logs, metrics, errors and events.</CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border/80 rounded-xl bg-muted/10">
                <p className="text-sm text-muted-foreground italic">No projects found. Create one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {projects.map((p) => {
                  const isSelected = selectedProject?.id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectProject(p)}
                      className={`flex flex-col p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                        isSelected
                          ? "border-primary/40 bg-primary/5 shadow-xs"
                          : "border-border/60 hover:bg-muted/30 bg-background"
                      }`}
                    >
                      <div>
                        <span className="text-sm font-bold block text-foreground">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground block mt-1">
                          Created: {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border/40 w-full flex items-center justify-between">
                        <span className="text-3xs font-mono text-muted-foreground select-all truncate max-w-[150px]" title={p.apiKey}>
                          Key: {p.apiKey}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyToClipboard(p.apiKey, `project-${p.id}`)
                          }}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {copiedText === `project-${p.id}` ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>
                      {isSelected && <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary animate-pulse" />}
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedProject && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Streams List */}
          <Card className="lg:col-span-2 border-border/60 bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  Ingestion Streams
                </CardTitle>
                <CardDescription>
                  Streams partition inbound logs, metrics, or errors (e.g. auth-service, analytics).
                </CardDescription>
              </div>

              <Dialog open={isStreamModalOpen} onOpenChange={setIsStreamModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    <Plus className="mr-1 size-3.5" /> Add Stream
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Ingestion Stream</DialogTitle>
                    <DialogDescription>Create a telemetry stream for project &quot;{selectedProject.name}&quot;.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateStream} className="space-y-4 py-2">
                    <div className="grid gap-2">
                      <label className="text-xs font-semibold text-muted-foreground uppercase">Stream Name</label>
                      <Input
                        required
                        placeholder="e.g. production-api"
                        value={streamName}
                        onChange={(e) => setStreamName(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <DialogFooter className="pt-2">
                      <Button type="submit" disabled={loading} className="w-full cursor-pointer">
                        {loading ? "Adding..." : "Add Ingestion Stream"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {streams.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border/80 rounded-xl bg-muted/10">
                  <Info className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-xs text-muted-foreground">No streams created yet.</p>
                  <p className="text-3xs text-muted-foreground/80 mt-1">Create a stream above to receive collection keys.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {streams.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/60 bg-background/50 gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                          <Hash className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold tracking-tight">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Stream ID: {s.id}</p>
                        </div>
                      </div>

                      {/* Stream Key View */}
                      <div className="flex items-center bg-muted/20 px-3 py-1.5 rounded-lg border border-border/60 max-w-full sm:max-w-xs justify-between">
                        <code className="text-xs font-mono select-all truncate text-muted-foreground mr-3">
                          {s.streamKey}
                        </code>
                        <button
                          onClick={() => copyToClipboard(s.streamKey, `stream-${s.id}`)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        >
                          {copiedText === `stream-${s.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Integration Info */}
          <div className="space-y-6">
            {streams.length > 0 && (
              <Card className="border-border/60 bg-card shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-primary" />
                    Quick Curl Ingestion
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Send structured logs from any CLI or server by POSTing to the ingest endpoint:
                  </p>
                  <div className="relative">
                    <pre className="text-[9px] bg-muted/50 p-2.5 rounded-lg font-mono overflow-x-auto text-muted-foreground max-w-full">
{`curl -X POST http://localhost:8080/api/v1/ingest \\
  -H "X-Stream-Key: ${streams[0]?.streamKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"log", "level":"info", "message":"App initialized", "payload":{"env":"prod"}}'`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(
                        `curl -X POST http://localhost:8080/api/v1/ingest -H "X-Stream-Key: ${streams[0]?.streamKey}" -H "Content-Type: application/json" -d '{"type":"log", "level":"info", "message":"App initialized", "payload":{"env":"prod"}}'`,
                        "curl-sample"
                      )}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer bg-card/60 p-1 rounded border border-border/60"
                    >
                      {copiedText === "curl-sample" ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
