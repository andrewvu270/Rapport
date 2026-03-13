'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase'

const features = [
  'Intel on anyone you\'ll meet',
  'Voice & video AI practice',
  'Scored debrief every session',
  'Homework drills to improve',
]

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Account created! Please sign in.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      router.push(nextPath)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-cream border border-ink/[0.1] rounded-xl text-sm text-ink placeholder-ink-muted/50 focus:border-ink/30 focus:ring-2 focus:ring-ink/[0.06] transition-colors outline-none"

  return (
    <div className="min-h-screen flex">
      {/* Left panel — desktop only */}
      <div
        className="hidden lg:flex lg:w-1/2 bg-ink flex-col p-12"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <Link href="/" className="text-lg font-extrabold tracking-tight text-cream">
          Rapport
        </Link>

        <div className="flex-1 flex flex-col justify-center max-w-sm">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-amber mb-6">
            Interview Intelligence
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-cream leading-tight mb-4">
            Walk in prepared.
          </h1>
          <p className="text-cream/40 text-base mb-10">
            AI intel. Practice personas. Scored debrief.
          </p>

          <ul className="space-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="text-amber text-xs leading-none">◆</span>
                <span className="text-cream/80 text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-cream">
        <div className="w-full max-w-sm animate-slide-up">

          <div className="text-center mb-8">
            <Link href="/" className="text-lg font-extrabold tracking-tight text-ink">
              Rapport
            </Link>
            <p className="mt-2 text-sm text-ink-muted">Sign in to your account</p>
          </div>

          <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  id="password" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className={inputClass}
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full mt-2 bg-amber hover:bg-amber/90 disabled:opacity-50 disabled:cursor-not-allowed text-ink py-2.5 rounded-xl text-sm font-bold transition-colors active:scale-[0.98] shadow-[0_4px_0_#92400e]"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-ink-muted">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="font-semibold text-ink hover:text-ink-muted transition-colors">
              Create one
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-ink-muted/50">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-ink-muted transition-colors">Terms of Service</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
