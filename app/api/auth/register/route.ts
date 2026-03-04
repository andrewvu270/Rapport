import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/src/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Calculate billing_period_start (first day of current month)
    const now = new Date()
    const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]

    // Insert user record with default values
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        tier: 'free',
        voice_minutes_used: 0,
        video_minutes_used: 0,
        billing_period_start: billingPeriodStart,
      })

    if (insertError) {
      // If user record creation fails, we should clean up the auth user
      // but for MVP we'll just log the error
      console.error('Failed to create user record:', insertError)
      return NextResponse.json(
        { error: 'Failed to create user record' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        message: 'User created successfully',
        userId: authData.user.id 
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
