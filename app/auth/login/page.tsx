'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [cooldown, setCooldown] = useState(0)

    // Countdown timer for rate limit
    useEffect(() => {
        if (cooldown <= 0) return
        const timer = setInterval(() => setCooldown(c => c - 1), 1000)
        return () => clearInterval(timer)
    }, [cooldown])

    // Common email domain typos
    const DOMAIN_TYPOS: Record<string, string> = {
        'gamil.com': 'gmail.com',
        'gmai.com': 'gmail.com',
        'gmal.com': 'gmail.com',
        'gmial.com': 'gmail.com',
        'gnail.com': 'gmail.com',
        'gmali.com': 'gmail.com',
        'yaho.com': 'yahoo.com',
        'yahooo.com': 'yahoo.com',
        'hotmal.com': 'hotmail.com',
        'hotmial.com': 'hotmail.com',
        'outlok.com': 'outlook.com',
    }

    const friendlyError = useCallback((msg: string): string => {
        const lower = msg.toLowerCase()
        if (lower.includes('rate limit')) {
            setCooldown(60)
            return 'Too many attempts. Please wait before trying again.'
        }
        if (lower.includes('invalid login credentials')) {
            return 'Incorrect email or password. Please try again.'
        }
        if (lower.includes('password') && lower.includes('characters')) {
            return 'Password must be at least 6 characters long.'
        }
        if (lower.includes('user not found') || lower.includes('no user')) {
            return 'No account found with this email. Try signing up instead.'
        }
        if (lower.includes('email not confirmed')) {
            return 'Please check your inbox and confirm your email before signing in.'
        }
        if (lower.includes('already registered') || lower.includes('already been registered')) {
            return 'An account with this email already exists. Try signing in instead.'
        }
        return msg
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (cooldown > 0) return
        setLoading(true)
        setError('')
        setSuccess('')

        // Check for email domain typos
        const domain = email.split('@')[1]?.toLowerCase()
        if (domain && DOMAIN_TYPOS[domain]) {
            const corrected = email.replace(/@.+$/, `@${DOMAIN_TYPOS[domain]}`)
            setError(`Did you mean ${corrected}? "${domain}" looks like a typo.`)
            setLoading(false)
            return
        }

        try {
            if (mode === 'login') {
                const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
                if (signInErr) {
                    setError(friendlyError(signInErr.message))
                } else {
                    router.push('/dashboard')
                    router.refresh()
                }
            } else {
                const { data, error: signUpErr } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                })
                if (signUpErr) {
                    setError(friendlyError(signUpErr.message))
                } else if (data.user && !data.user.identities?.length) {
                    // User already exists
                    setError('An account with this email already exists. Try signing in instead.')
                } else if (data.session) {
                    // Email confirmation disabled — user is logged in directly
                    setSuccess('Account created! Redirecting...')
                    router.push('/dashboard')
                    router.refresh()
                } else {
                    setSuccess('Account created! Check your email to confirm, then log in.')
                    setMode('login')
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Network error'
            setError(`Connection failed: ${msg}. Check your internet connection.`)
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-md animate-fade-in">
                {/* Brand */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 shadow-lg shadow-brand-900/40 mb-4">
                        <span className="text-2xl">✍️</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white">UtilSign</h1>
                    <p className="text-slate-400 mt-1 text-sm">Secure e-signature platform</p>
                </div>

                {/* Card */}
                <div className="card p-8">
                    <h2 className="text-lg font-semibold text-white mb-6">
                        {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
                    </h2>

                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                            {error}
                            {cooldown > 0 && (
                                <div className="mt-2 flex items-center gap-2 text-red-400/80">
                                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Retry in {cooldown}s
                                </div>
                            )}
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="label">Email</label>
                            <input
                                id="email"
                                type="email"
                                className="input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="label">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <button
                            id="auth-submit"
                            type="submit"
                            disabled={loading || cooldown > 0}
                            className="btn-primary w-full mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                                </span>
                            ) : cooldown > 0 ? (
                                `Wait ${cooldown}s…`
                            ) : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 text-sm mt-5">
                        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            type="button"
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setCooldown(0) }}
                            className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
                        >
                            {mode === 'login' ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}
