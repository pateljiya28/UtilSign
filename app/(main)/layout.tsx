'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Home, FileText, LayoutTemplate, History, LogOut, Settings, HelpCircle } from 'lucide-react'
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

    const initials = userEmail ? userEmail.charAt(0).toUpperCase() : '?'

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── DocuSign-style Header ─────────────────────────────────────────── */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
                    {/* Left: Logo + Nav */}
                    <div className="flex items-center gap-8">
                        {/* Logo */}
                        <Link href="/home" className="flex items-center gap-2.5 shrink-0">
                            <div className="w-8 h-8 rounded-md bg-[#4C00FF] flex items-center justify-center">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <span className="font-bold text-lg text-gray-900 tracking-tight">
                                Util<span className="text-[#4C00FF]">Sign</span>
                            </span>
                        </Link>

                        {/* Navigation */}
                        <nav className="flex items-center gap-1">
                            {NAV_ITEMS.map(({ label, href }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive(href)
                                        ? 'text-[#4C00FF] bg-[#4C00FF]/5'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                        }`}
                                >
                                    {label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <button className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                        <button className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                            <HelpCircle className="w-5 h-5" />
                        </button>

                        {/* Profile */}
                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setProfileOpen(prev => !prev)}
                                className="w-9 h-9 rounded-full bg-[#4C00FF] flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity"
                            >
                                {initials}
                            </button>
                            {profileOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-gray-200 shadow-lg py-2 animate-fade-in z-50">
                                    <div className="px-4 py-2.5 border-b border-gray-100">
                                        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Signed in as</p>
                                        <p className="text-sm text-gray-900 truncate mt-0.5 font-medium">{userEmail}</p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
