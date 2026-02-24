'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
    PenTool, Send, FileText, CheckCircle, Clock, AlertCircle, Users,
    Plus, ArrowRight, ChevronRight, Timer,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DocRow {
    id: string
    file_name: string
    status: string
    created_at: string
    type: string | null
}

interface TemplateRow {
    id: string
    name: string
    description: string | null
    category: string | null
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function HomePage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [documents, setDocuments] = useState<DocRow[]>([])
    const [templates, setTemplates] = useState<TemplateRow[]>([])
    const [loading, setLoading] = useState(true)
    const [userName, setUserName] = useState('')
    const [userEmail, setUserEmail] = useState('')

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            setUserName(user.email?.split('@')[0] ?? 'there')
            setUserEmail(user.email ?? '')

            const { data } = await supabase
                .from('documents')
                .select('id, file_name, status, created_at, type')
                .eq('sender_id', user.id)
                .order('created_at', { ascending: false })

            setDocuments(data ?? [])

            // Fetch templates
            try {
                const res = await fetch('/api/templates')
                const tData = await res.json()
                if (res.ok) setTemplates(tData.templates?.slice(0, 3) ?? [])
            } catch { /* ignore */ }

            setLoading(false)
        }
        fetchData()
    }, [])

    const actionRequired = documents.filter(d => d.status === 'sent' || d.status === 'in_progress').length
    const waitingForOthers = documents.filter(d => d.type === 'request_sign' && ['sent', 'in_progress'].includes(d.status)).length
    const expiringSoon = documents.filter(d => {
        const age = Date.now() - new Date(d.created_at).getTime()
        return age > 25 * 86400000 && !['completed', 'cancelled'].includes(d.status)
    }).length
    const completedCount = documents.filter(d => d.status === 'completed').length

    if (loading) {
        return (
            <div className="text-center py-32">
                <div className="w-8 h-8 border-2 border-[#4C00FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Loading…</p>
            </div>
        )
    }

    const initials = userName ? userName.charAt(0).toUpperCase() + (userName.charAt(1) || '').toUpperCase() : '??'

    return (
        <div>
            {/* ── Purple Welcome Banner ──────────────────────────────────────── */}
            <div data-theme-preserve className="bg-gradient-to-r from-[#1B0036] via-[#2D0060] to-[#1B0036]">
                <div className="max-w-[1400px] mx-auto px-6">
                    {/* Welcome Section */}
                    <div className="pt-10 pb-6">
                        <h1 className="text-2xl font-bold text-white" data-theme-preserve>Welcome back</h1>
                        <div className="flex items-center gap-3 mt-3">
                            <div className="w-10 h-10 rounded-full bg-[#4C00FF] flex items-center justify-center text-white text-sm font-bold border-2 border-white/30" data-theme-preserve>
                                {initials}
                            </div>
                            <span className="text-white/80 text-sm font-medium" data-theme-preserve>{userEmail}</span>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="pb-8">
                        <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4" data-theme-preserve>Last 6 Months</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
                            {/* Action Required */}
                            <div className="pr-6 border-r border-white/10">
                                <p className="text-4xl font-bold text-white" data-theme-preserve>{actionRequired}</p>
                                <p className="text-white/60 text-sm mt-1" data-theme-preserve>Action Required</p>
                            </div>
                            {/* Waiting for Others */}
                            <div className="px-6 border-r border-white/10">
                                <p className="text-4xl font-bold text-white" data-theme-preserve>{waitingForOthers}</p>
                                <p className="text-white/60 text-sm mt-1" data-theme-preserve>Waiting for Others</p>
                            </div>
                            {/* Expiring Soon */}
                            <div className="px-6 border-r border-white/10">
                                <p className="text-4xl font-bold text-white" data-theme-preserve>{expiringSoon}</p>
                                <p className="text-white/60 text-sm mt-1" data-theme-preserve>Expiring Soon</p>
                            </div>
                            {/* Completed */}
                            <div className="pl-6">
                                <p className="text-4xl font-bold text-white" data-theme-preserve>{completedCount}</p>
                                <p className="text-white/60 text-sm mt-1" data-theme-preserve>Completed</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Get Started or Use Templates Section ──────────────────────── */}
            <div className="max-w-[1400px] mx-auto px-6 py-10">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Get Started or Use Templates</h2>
                    <Link
                        href="/templates"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-700/40 text-sm font-medium text-slate-300 hover:bg-slate-800/60 transition-colors"
                    >
                        Browse all Templates
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>

                <div className="grid md:grid-cols-3 gap-5">
                    {/* Sign Card — Self Sign only */}
                    <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 p-6 hover:border-slate-700 transition-all group">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-[#4C00FF]/10 flex items-center justify-center">
                                <PenTool className="w-5 h-5 text-[#4C00FF]" />
                            </div>
                            <h3 className="font-semibold text-white">Self Sign</h3>
                        </div>
                        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                            Upload a document to sign it yourself quickly and securely.
                        </p>
                        <Link
                            href="/documents/new?mode=self"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#4C00FF] text-white text-sm font-semibold hover:bg-[#3D00CC] transition-colors"
                        >
                            <PenTool className="w-4 h-4" />
                            Self Sign
                        </Link>
                    </div>

                    {/* Template Cards */}
                    {templates.length > 0 ? (
                        templates.slice(0, 2).map(t => (
                            <div key={t.id} className="bg-slate-900/60 rounded-xl border border-slate-800/60 p-6 hover:border-slate-700 transition-all group">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-800/60 flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Template</p>
                                            <h3 className="font-semibold text-white mt-0.5">{t.name}</h3>
                                        </div>
                                    </div>
                                </div>
                                {t.description && (
                                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">{t.description}</p>
                                )}
                                {t.category && (
                                    <span className="inline-block px-2.5 py-1 rounded-full bg-[#4C00FF]/10 text-[#4C00FF] text-xs font-medium mb-4">
                                        {t.category}
                                    </span>
                                )}
                                <Link
                                    href={`/documents/new?mode=request&template=${t.id}`}
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-700/40 text-sm font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors mt-auto"
                                >
                                    Use Template
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ))
                    ) : (
                        <>
                            {/* Placeholder cards when no templates */}
                            <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 p-6 hover:border-slate-700 transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-800/60 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Template</p>
                                        <h3 className="font-semibold text-white mt-0.5">Create your first template</h3>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400 mb-6">Save time by creating reusable envelope templates for common workflows.</p>
                                <Link
                                    href="/templates/new"
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-700/40 text-sm font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Template
                                </Link>
                            </div>
                            <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 p-6 hover:border-slate-700 transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-slate-800/60 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Quick Start</p>
                                        <h3 className="font-semibold text-white mt-0.5">Send for signing</h3>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-400 mb-6">Create an envelope and send documents to others for their signature.</p>
                                <Link
                                    href="/documents/new?mode=request"
                                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-slate-700/40 text-sm font-semibold text-slate-300 hover:bg-slate-800/60 transition-colors"
                                >
                                    Get Started
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Recent Activity ──────────────────────────────────────────────── */}
            {documents.length > 0 && (
                <div className="max-w-[1400px] mx-auto px-6 pb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Recent Activity</h2>
                        <Link
                            href="/history"
                            className="flex items-center gap-1 text-sm font-medium text-[#4C00FF] hover:text-[#3D00CC] transition-colors"
                        >
                            View all
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 overflow-hidden">
                        {documents.slice(0, 5).map((doc, i) => (
                            <Link
                                key={doc.id}
                                href={`/documents/${doc.id}/status`}
                                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/40 transition-colors ${i < Math.min(documents.length, 5) - 1 ? 'border-b border-slate-800/40' : ''}`}
                            >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'self_sign' ? 'bg-[#4C00FF]/10' : 'bg-blue-500/10'}`}>
                                    {doc.type === 'self_sign'
                                        ? <PenTool className="w-4 h-4 text-[#4C00FF]" />
                                        : <Send className="w-4 h-4 text-blue-400" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{doc.file_name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                                <StatusPill status={doc.status} />
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function StatusPill({ status }: { status: string }) {
    const map: Record<string, { bg: string; text: string; label: string }> = {
        draft: { bg: 'bg-slate-700/60', text: 'text-slate-300', label: 'Draft' },
        sent: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Sent' },
        in_progress: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'In Progress' },
        completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Completed' },
        cancelled: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Cancelled' },
    }
    const s = map[status] ?? map.draft
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    )
}
