import { NextRequest, NextResponse } from 'next/server'
import { createClient } from './supabase-server'

/**
 * Auth middleware to protect API routes
 * Returns the authenticated user or an error response
 */
export async function requireAuth(request: NextRequest) {
  const supabase = createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  return { user, error: null }
}

/**
 * Check if a path should bypass auth
 */
export function isPublicRoute(pathname: string): boolean {
  const publicRoutes = [
    '/api/auth/register',
    '/api/auth/login',
  ]

  return publicRoutes.some(route => pathname.startsWith(route))
}
