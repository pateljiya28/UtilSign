'use client'

import { useState } from 'react'
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            if (mode === 'login') {
                const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
                if (signInErr) {
                    setError(signInErr.message)
                } else {
                    router.push('/dashboard')
                    router.refresh()
                }
            } else {
                const { error: signUpErr } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                })
                if (signUpErr) {
                    setError(signUpErr.message)
                } else {
                    setSuccess('Account created! Check your email to confirm, then log in.')
                    setMode('login')
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Network error'
            setError(`Connection failed: ${msg}. Check that your Supabase URL is correct.`)
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
                            disabled={loading}
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
                            ) : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 text-sm mt-5">
                        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            type="button"
                            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
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
