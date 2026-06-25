import { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { 
  Terminal, 
  Shield, 
  Zap, 
  Cpu, 
  Layers, 
  BarChart3, 
  Radio, 
  Cloud,
  ArrowRight,
  Check,
  Copy,
  Mail
} from 'lucide-react'

interface LandingPageProps {
  onEnterApp: () => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const [showCloudModal, setShowCloudModal] = useState(false)
  const [cloudEmail, setCloudEmail] = useState('')
  const [cloudSuccess, setCloudSuccess] = useState(false)
  const [copiedDocker, setCopiedDocker] = useState(false)

  const dockerCmd = 'docker run -d -p 8080:8080 -v ./data:/data consolelog/console-log'

  const handleCopyDocker = () => {
    navigator.clipboard.writeText(dockerCmd)
    setCopiedDocker(true)
    setTimeout(() => setCopiedDocker(false), 2000)
  }

  const handleCloudSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cloudEmail) return
    // Mock successful sign up
    setCloudSuccess(true)
    setTimeout(() => {
      setShowCloudModal(false)
      setCloudSuccess(false)
      setCloudEmail('')
    }, 2500)
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden select-none">
      {/* Visual background decorations */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-[-10%] left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Landing Navbar */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between border-b border-border/10 relative z-10">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <span className="font-bold tracking-tight text-sm uppercase">Console Log</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCloudModal(true)} 
            className="text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors cursor-pointer"
          >
            Cloud Beta
          </button>
          <Button size="sm" onClick={onEnterApp} className="text-xs gap-1.5 h-8 font-medium cursor-pointer">
            Self-Host Login
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center relative z-10 space-y-6">
        {/* Release Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-wider text-primary animate-pulse mx-auto">
          <Zap className="h-3 w-3" />
          Self-Hosted Observability First
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-none bg-gradient-to-b from-foreground via-foreground to-foreground/75 bg-clip-text text-transparent max-w-2xl mx-auto">
          The Open Source Developer Observability Platform
        </h1>

        <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Collect, query, and visualize logs, grouped exceptions, and performance metrics in one single platform. Zero lock-in. Running on a lightweight, CGO-free SQLite backend.
        </p>

        {/* CTA Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Button onClick={onEnterApp} className="w-full sm:w-auto h-11 px-8 gap-2 font-medium cursor-pointer shadow-lg shadow-primary/20">
            <Terminal className="h-4 w-4" />
            Deploy & Self-Host Free
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setShowCloudModal(true)} 
            className="w-full sm:w-auto h-11 px-8 gap-2 font-medium cursor-pointer hover:bg-secondary/40 border-border/80"
          >
            <Cloud className="h-4 w-4 text-indigo-400" />
            Request Cloud Beta Access
          </Button>
        </div>
      </section>

      {/* Interactive Docker Showcase */}
      <section className="max-w-3xl mx-auto px-6 pb-20 relative z-10">
        <Card className="border-border/60 bg-card/60 backdrop-blur-md overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/30 via-primary to-primary/30" />
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                Launch Console Log locally in 10 seconds
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            </div>

            <div className="relative">
              <pre className="text-xs bg-zinc-950 p-4 rounded-xl font-mono overflow-x-auto text-muted-foreground border border-border/40 select-all">
                {dockerCmd}
              </pre>
              <button
                onClick={handleCopyDocker}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground cursor-pointer bg-card/75 p-1.5 rounded-lg border border-border/40 hover:scale-105 active:scale-95 transition-all"
              >
                {copiedDocker ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Feature Grids */}
      <section className="max-w-5xl mx-auto px-6 pb-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-border/40 bg-card/30 hover:bg-card/45 transition-colors">
            <CardContent className="pt-6 space-y-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <BarChart3 className="h-4.5 w-4.5 text-primary" />
              </div>
              <h3 className="text-sm font-bold">Centralized Structured Logs</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ingest structured JSON payloads. Fast text searches, dynamic log levels filtering, and interactive timelines histograms.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/30 hover:bg-card/45 transition-colors">
            <CardContent className="pt-6 space-y-3">
              <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <Shield className="h-4.5 w-4.5 text-rose-400" />
              </div>
              <h3 className="text-sm font-bold">Exception Intelligence</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Group thousands of repeating server errors into unique exceptions automatically. View stack traces, occurrences frequency, and first/last seen.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/30 hover:bg-card/45 transition-colors">
            <CardContent className="pt-6 space-y-3">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <Cpu className="h-4.5 w-4.5 text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold">Metrics Telemetry</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Stream CPU load, RAM allocation, API response times, or custom app metrics. View aggregated averages, peaks, and responsive area charts.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Cloud Access Modal */}
      {showCloudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/80 backdrop-blur-md animate-fadeIn">
          <Card className="w-full max-w-sm border-border bg-card/95 shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <CardContent className="p-6 space-y-5 pt-8">
              <div className="text-center">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mb-3">
                  <Cloud className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold">Cloud Beta Access</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  We are launching fully managed cloud hosts soon. Register your email to request early access.
                </p>
              </div>

              {cloudSuccess ? (
                <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 animate-pulse">
                  <Check className="h-4 w-4" />
                  <span>Access requested! Checking inbox soon.</span>
                </div>
              ) : (
                <form onSubmit={handleCloudSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={cloudEmail}
                      onChange={(e) => setCloudEmail(e.target.value)}
                      className="w-full bg-secondary/40 px-9 py-2 rounded-lg text-sm border border-border/80 focus:border-indigo-500 focus:outline-none transition-all"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium cursor-pointer">
                    Request Invitation
                  </Button>
                </form>
              )}

              <button
                onClick={() => setShowCloudModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground mx-auto block hover:underline font-medium cursor-pointer"
              >
                Close Dialog
              </button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
