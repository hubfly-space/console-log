import { useState } from 'react'
import { API } from '../lib/bridge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Terminal, ShieldCheck, Mail, Lock, User, RefreshCw, AlertCircle } from 'lucide-react'

interface AuthViewProps {
  onAuthSuccess: (user: any) => void;
}

export function AuthView({ onAuthSuccess }: AuthViewProps) {
  const [view, setView] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string

    if (!email || !password || (view === 'signup' && !name)) {
      setError('Please fill in all fields')
      setLoading(false)
      return
    }

    try {
      if (view === 'login') {
        const res = await API.login({ username: email, password })
        if (res.success) {
          localStorage.setItem('token', res.token)
          // Set authorization headers config dynamically
          API.config.headers = () => ({
            'Authorization': `Bearer ${res.token}`
          })
          onAuthSuccess(res.user)
        } else {
          setError('Invalid email or password')
        }
      } else {
        const res = await API.signup({ email, name, password })
        if (res.success) {
          localStorage.setItem('token', res.token)
          API.config.headers = () => ({
            'Authorization': `Bearer ${res.token}`
          })
          onAuthSuccess(res.user)
        } else {
          setError('Failed to create account')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Decorative background grid and glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md border-border bg-card/85 backdrop-blur-md shadow-2xl relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
        
        <CardHeader className="text-center pt-8 pb-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-3 animate-pulse">
            <Terminal className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/80 bg-clip-text text-transparent">
            Console Log
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            {view === 'login' 
              ? 'Enter your credentials to access your observability panel' 
              : 'Create an account to start self-hosting observability'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    disabled={loading}
                    className="w-full bg-secondary/50 hover:bg-secondary/80 focus:bg-background px-9 py-2 rounded-lg text-sm border border-border/80 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  disabled={loading}
                  className="w-full bg-secondary/50 hover:bg-secondary/80 focus:bg-background px-9 py-2 rounded-lg text-sm border border-border/80 focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-muted-foreground" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full bg-secondary/50 hover:bg-secondary/80 focus:bg-background px-9 py-2 rounded-lg text-sm border border-border/80 focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-10 mt-2 gap-2 font-medium">
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : view === 'login' ? (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Sign In
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="text-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setError(null)
                setView(view === 'login' ? 'signup' : 'login')
              }}
              className="text-xs text-primary hover:underline font-medium focus:outline-none"
            >
              {view === 'login' 
                ? "Don't have an account? Sign up" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
