'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/src/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = searchParams.get('next') || '/history'
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

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-500/6 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <Link href="/" className="text-sm font-semibold text-zinc-100 hover:text-white transition-colors">
            NetWork
          </Link>
          <p className="mt-2 text-sm text-zinc-500">Sign in to your account</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20 transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-zinc-600">
          Don't have an account?{' '}
          <Link href="/auth/register" className="text-violet-400 hover:text-violet-300 transition-colors">
            Create one
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-zinc-700">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="text-zinc-600 hover:text-zinc-400 underline transition-colors">Terms of Service</Link>
        </p>
      </div>
    </div>
  )
}
