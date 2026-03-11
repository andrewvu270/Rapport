'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const features = [
  'Intel on anyone you\'ll meet',
  'Voice & video AI practice',
  'Scored debrief every session',
  'Homework drills to improve',
]

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (!termsAccepted) { setError('You must accept the terms of service to continue'); return }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')
      router.push('/auth/login?registered=true')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
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
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
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
            <p className="mt-2 text-sm text-ink-muted">Create your account</p>
          </div>

          <div className="bg-white border border-ink/[0.08] rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email" name="email" type="email" autoComplete="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  id="password" name="password" type="password" autoComplete="new-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-xs font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  id="confirm-password" name="confirm-password" type="password" autoComplete="new-password" required
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" className={inputClass}
                />
              </div>

              <div className="flex items-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTermsAccepted(!termsAccepted)}
                  className={`mt-0.5 w-5 h-5 rounded-md border shrink-0 flex items-center justify-center transition-colors ${
                    termsAccepted ? 'bg-ink border-ink' : 'border-ink/20 hover:border-ink/40'
                  }`}
                >
                  {termsAccepted && (
                    <svg className="w-3 h-3 text-cream" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="text-xs text-ink-muted leading-relaxed">
                  I accept the{' '}
                  <Link href="/terms" target="_blank" className="font-semibold text-ink underline">terms of service</Link>
                  . I understand that Rapport uses AI to simulate practice conversations with personas based on publicly available information.
                </div>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full mt-2 bg-amber hover:bg-amber/90 disabled:opacity-50 disabled:cursor-not-allowed text-ink py-2.5 rounded-xl text-sm font-bold transition-colors active:scale-[0.98] shadow-[0_4px_0_#92400e]"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold text-ink hover:text-ink-muted transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
