'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
    PenTool, Send, FileText, CheckCircle, Clock,
    Plus, ArrowRight,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DocRow {
    id: string
    file_name: string
    status: string
    created_at: string
    type: string | null
}

// ─── Components ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }: {
    label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string
}) {
    const colorMap: Record<string, string> = {
        violet: 'from-violet-600/15 border-violet-500/20 text-violet-400',
        sky: 'from-sky-600/15 border-sky-500/20 text-sky-400',
        emerald: 'from-emerald-600/15 border-emerald-500/20 text-emerald-400',
        amber: 'from-amber-600/15 border-amber-500/20 text-amber-400',
    }
    return (
        <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br to-transparent p-5 transition-all hover:scale-[1.02] ${colorMap[color] ?? colorMap.violet}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="text-3xl font-black text-white mt-1">{value}</p>
                </div>
                <div className="rounded-xl bg-slate-800/50 p-3">
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </div>
    )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function HomePage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [documents, setDocuments] = useState<DocRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from('documents')
                .select('id, file_name, status, created_at, type')
                .eq('sender_id', user.id)
                .order('created_at', { ascending: false })

            setDocuments(data ?? [])
            setLoading(false)
        }
        fetchData()
    }, [])

    const selfCount = documents.filter(d => d.type === 'self_sign').length
    const completedCount = documents.filter(d => d.status === 'completed').length
    const pendingCount = documents.filter(d => ['draft', 'sent', 'in_progress'].includes(d.status)).length

    if (loading) {
        return (
            <div className="text-center py-32">
                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-500 text-sm">Loading…</p>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 animate-fade-in">
            {/* Welcome */}
            <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                    Create a new document
                </h1>
                <p className="text-slate-400 text-sm mt-1">Choose how you'd like to work with your document.</p>
            </div>

            {/* Entry-Point Cards */}
            <div className="grid md:grid-cols-2 gap-5">
                {/* Self Sign */}
                <div className="group relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-transparent to-transparent p-px transition-all duration-300 hover:border-violet-500/40 hover:shadow-[0_0_40px_-12px_rgba(139,92,246,0.3)]">
                    <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl group-hover:bg-violet-500/20 transition-all duration-500" />
                    <div className="relative flex h-full flex-col rounded-[15px] bg-slate-900/90 p-7 backdrop-blur-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-600/15 border border-violet-500/20 group-hover:scale-110 group-hover:bg-violet-600/25 transition-all duration-300">
                                <PenTool className="w-6 h-6 text-violet-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Self Sign</h3>
                                <p className="text-xs text-violet-400/70 font-medium">Sign documents yourself</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">
                            Upload a document and sign it instantly — you&apos;re automatically set as the only signer. No emails, no waiting.
                        </p>
                        <div className="mt-auto">
                            <Link
                                href="/documents/new?mode=self"
                                className="flex items-center justify-center gap-2 w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-violet-500 hover:shadow-xl hover:shadow-violet-900/30 active:scale-[0.98]"
                            >
                                <Plus className="w-4 h-4" />
                                New Self-Sign Document
                                <ArrowRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Request Sign */}
                <div className="group relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-600/10 via-transparent to-transparent p-px transition-all duration-300 hover:border-sky-500/40 hover:shadow-[0_0_40px_-12px_rgba(14,165,233,0.3)]">
                    <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-sky-500/10 blur-3xl group-hover:bg-sky-500/20 transition-all duration-500" />
                    <div className="relative flex h-full flex-col rounded-[15px] bg-slate-900/90 p-7 backdrop-blur-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-600/15 border border-sky-500/20 group-hover:scale-110 group-hover:bg-sky-600/25 transition-all duration-300">
                                <Send className="w-6 h-6 text-sky-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Request Sign</h3>
                                <p className="text-xs text-sky-400/70 font-medium">Send to others for signing</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">
                            Create an envelope with your document, add recipients, set signing order, and include a custom message — all in one step.
                        </p>
                        <div className="mt-auto">
                            <Link
                                href="/documents/new?mode=request"
                                className="flex items-center justify-center gap-2 w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-sky-500 hover:shadow-xl hover:shadow-sky-900/30 active:scale-[0.98]"
                            >
                                <Plus className="w-4 h-4" />
                                New Envelope
                                <ArrowRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total" value={documents.length} icon={FileText} color="violet" />
                <StatCard label="Self-Signed" value={selfCount} icon={PenTool} color="sky" />
                <StatCard label="Completed" value={completedCount} icon={CheckCircle} color="emerald" />
                <StatCard label="Pending" value={pendingCount} icon={Clock} color="amber" />
            </div>
        </div>
    )
}
