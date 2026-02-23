'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Shield, Home, FileText, LayoutTemplate, History, LogOut } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'

const NAV_ITEMS = [
    { label: 'Home', href: '/home', icon: Home },
    { label: 'Agreements', href: '/agreements', icon: FileText },
    { label: 'Templates', href: '/templates', icon: LayoutTemplate },
    { label: 'History', href: '/history', icon: History },
] as const

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [userEmail, setUserEmail] = useState('')
    const [profileOpen, setProfileOpen] = useState(false)
    const profileRef = useRef<HTMLDivElement>(null)

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    // Fetch user
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }
            setUserEmail(user.email ?? '')
        }
        fetchUser()
    }, [])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

    return (
        <div className="min-h-screen">
            {/* ── Header ──────────────────────────────────────────────────────────── */}
            <header className="page-header">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/home" className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-brand-900/30">
                            <Shield className="w-5 h-5" />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-white">
                            Util<span className="text-brand-400">Sign</span>
                        </span>
                    </Link>

                    {/* ── Nav Tabs (centered) ── */}
                    <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl border border-slate-700/40">
                        {NAV_ITEMS.map(({ label, href, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${isActive(href)
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </Link>
                        ))}
                    </div>

                    {/* ── Right side ── */}
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
                        <ThemeToggle />
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setProfileOpen(prev => !prev)}
                                className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-lg hover:shadow-brand-500/40 transition-shadow cursor-pointer"
                            >
                                {userEmail?.charAt(0).toUpperCase()}
                            </button>
                            {profileOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-2 animate-fade-in z-50">
                                    <div className="px-4 py-2 border-b border-slate-800">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Signed in as</p>
                                        <p className="text-sm text-white truncate mt-0.5">{userEmail}</p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main content ──────────────────────────────────────────────────── */}
            <main>{children}</main>
        </div>
    )
}
