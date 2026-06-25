import { useState, useEffect } from 'react'
import { API, Project, Stream } from '../lib/bridge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Plus, Copy, Check, Hash, Key, Folder, Radio, Info, Terminal } from 'lucide-react'

interface ProjectManagerProps {
  user: any;
  onSelectProject: (project: Project | null) => void;
  selectedProject: Project | null;
  onProjectsUpdated: (projects: Project[]) => void;
}

export function ProjectManager({ user, onSelectProject, selectedProject, onProjectsUpdated }: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [projectName, setProjectName] = useState('')
  const [streamName, setStreamName] = useState('')
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      console.error('Failed to load projects', err)
    }
  }

  // Fetch streams for selected project
  const loadStreams = async (projectId: number) => {
    try {
      const res = await API.listStreams({ projectId })
      setStreams(res.streams || [])
    } catch (err) {
      console.error('Failed to load streams', err)
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
        setProjectName('')
        await loadProjects()
        onSelectProject(res.project)
      }
    } catch (err) {
      alert('Failed to create project')
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
        setStreamName('')
        await loadStreams(selectedProject.id)
      }
    } catch (err) {
      alert('Failed to create stream')
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
      {/* Project Selector / Creator */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 border-border/80 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" />
              Active Projects
            </CardTitle>
            <CardDescription className="text-xs">
              Select or switch between your monitored systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-muted rounded-lg">
                <p className="text-sm text-muted-foreground italic">No projects found. Create one to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {projects.map((p) => {
                  const isSelected = selectedProject?.id === p.id
                  return (
                    <button
                      key={p.id}
                      onClick={() => onSelectProject(p)}
                      className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary/40 bg-primary/5 shadow-sm'
                          : 'border-border/60 hover:bg-muted/30 bg-background/50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold tracking-tight">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Created: {new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                      {isSelected && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Project Card */}
        <Card className="border-border/80 bg-card/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Create Project
            </CardTitle>
            <CardDescription className="text-xs">
              Add a new app or service stack to monitor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="e.g. My Backend API"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={loading}
                  className="w-full bg-secondary/30 hover:bg-secondary/50 focus:bg-background px-3 py-2 rounded-lg text-sm border border-border/80 focus:border-primary focus:outline-none transition-all"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full text-xs h-9">
                Add Project
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {selectedProject && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Streams List */}
          <Card className="md:col-span-2 border-border/80 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" />
                  Ingestion Streams
                </CardTitle>
                <CardDescription className="text-xs">
                  Streams act as channel filters for incoming logs, metrics, or errors
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {streams.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-muted rounded-lg">
                  <Info className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No streams created yet.</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-1">Create a stream on the right to receive keys.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {streams.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border/50 bg-background/40 gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Hash className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold tracking-tight">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Stream ID: {s.id}</p>
                        </div>
                      </div>

                      {/* Stream Key View */}
                      <div className="flex items-center bg-secondary/40 px-3 py-1.5 rounded-lg border border-border/50 max-w-full sm:max-w-xs justify-between">
                        <code className="text-xs font-mono select-all truncate text-muted-foreground mr-3">
                          {s.streamKey}
                        </code>
                        <button
                          onClick={() => copyToClipboard(s.streamKey, `stream-${s.id}`)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        >
                          {copiedText === `stream-${s.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
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

          {/* Create Stream Form & Integration Guide */}
          <div className="space-y-6">
            <Card className="border-border/80 bg-card/50">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  New Ingestion Stream
                </CardTitle>
                <CardDescription className="text-xs">
                  Create a stream to partition logs (e.g. backend, logs-worker)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateStream} className="space-y-3">
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="e.g. production-api"
                      value={streamName}
                      onChange={(e) => setStreamName(e.target.value)}
                      disabled={loading}
                      className="w-full bg-secondary/30 hover:bg-secondary/50 focus:bg-background px-3 py-2 rounded-lg text-sm border border-border/80 focus:border-primary focus:outline-none transition-all"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="w-full text-xs h-9">
                    Add Stream
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Quick Integration Info */}
            {streams.length > 0 && (
              <Card className="border-border/80 bg-card/30">
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
                    <pre className="text-[9px] bg-secondary/50 p-2.5 rounded-lg font-mono overflow-x-auto text-muted-foreground max-w-full">
{`curl -X POST http://localhost:8080/api/v1/ingest \\
  -H "X-Stream-Key: ${streams[0]?.streamKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"log", "level":"info", "message":"App initialized", "payload":{"env":"prod"}}'`}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(
                        `curl -X POST http://localhost:8080/api/v1/ingest -H "X-Stream-Key: ${streams[0]?.streamKey}" -H "Content-Type: application/json" -d '{"type":"log", "level":"info", "message":"App initialized", "payload":{"env":"prod"}}'`,
                        'curl-sample'
                      )}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground cursor-pointer bg-card/60 p-1 rounded border border-border/50"
                    >
                      {copiedText === 'curl-sample' ? (
                        <Check className="h-3 w-3 text-emerald-500" />
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
