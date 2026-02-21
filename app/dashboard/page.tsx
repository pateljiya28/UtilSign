'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
    Shield, PenTool, Send, FileText, CheckCircle, Clock,
    Plus, History, ArrowRight, Filter, X
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

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        draft: 'bg-slate-700/60 text-slate-300',
        sent: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        in_progress: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
        completed: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        cancelled: 'bg-red-500/20 text-red-300 border border-red-500/30',
    }
    const labels: Record<string, string> = {
        draft: 'Draft', sent: 'Sent', in_progress: 'In Progress',
        completed: 'Completed', cancelled: 'Cancelled',
    }
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${styles[status] ?? 'bg-slate-700/60 text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status === 'completed' ? 'bg-emerald-400' :
                    status === 'in_progress' ? 'bg-amber-400 animate-pulse' :
                        status === 'sent' ? 'bg-blue-400' :
                            status === 'cancelled' ? 'bg-red-400' : 'bg-slate-500'
                }`} />
            {labels[status] ?? status}
        </span>
    )
}

function TypeBadge({ type }: { type: string }) {
    const isSelf = type === 'self_sign'
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isSelf
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25'
                : 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
            }`}>
            {isSelf ? <><PenTool className="w-3 h-3" /> Self</> : <><Send className="w-3 h-3" /> Request</>}
        </span>
    )
}

function StatCard({ label, value, icon: Icon, color }: {
    label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string
}) {
    const colorMap: Record<string, string> = {
        violet: 'from-violet-600/20 to-violet-800/5 border-violet-500/20',
        sky: 'from-sky-600/20 to-sky-800/5 border-sky-500/20',
        emerald: 'from-emerald-600/20 to-emerald-800/5 border-emerald-500/20',
        amber: 'from-amber-600/20 to-amber-800/5 border-amber-500/20',
    }
    const iconColor: Record<string, string> = {
        violet: 'text-violet-400', sky: 'text-sky-400',
        emerald: 'text-emerald-400', amber: 'text-amber-400',
    }
    return (
        <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm p-5 ${colorMap[color]}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
                    <p className="text-3xl font-extrabold text-white tabular-nums">{value}</p>
                </div>
                <Icon className={`w-8 h-8 opacity-40 ${iconColor[color]}`} />
            </div>
        </div>
    )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const router = useRouter()

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [userEmail, setUserEmail] = useState('')
    const [documents, setDocuments] = useState<DocRow[]>([])
    const [loading, setLoading] = useState(true)

    // Navigation state: 'new' shows entry-point cards, 'history' shows doc list
    const [activeTab, setActiveTab] = useState<'new' | 'history'>('new')
    const [historyFilter, setHistoryFilter] = useState<'all' | 'self' | 'request'>('all')

    // Fetch user + documents
    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/auth/login'); return }
            setUserEmail(user.email ?? '')

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
    const requestCount = documents.filter(d => d.type === 'request_sign').length
    const completedCount = documents.filter(d => d.status === 'completed').length
    const pendingCount = documents.filter(d => ['draft', 'sent', 'in_progress'].includes(d.status)).length

    const filteredDocs = documents.filter(doc => {
        if (historyFilter === 'self') return doc.type === 'self_sign'
        if (historyFilter === 'request') return doc.type === 'request_sign'
        return true
    })

    return (
        <div className="min-h-screen">
            {/* ── Header ──────────────────────────────────────────────────────────── */}
            <header className="page-header">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-brand-900/30">
                            <Shield className="w-5 h-5" />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-white">
                            Util<span className="text-brand-400">Sign</span>
                        </span>
                    </div>

                    {/* ── Nav Tabs (centered) ── */}
                    <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl border border-slate-700/40">
                        <button
                            onClick={() => setActiveTab('new')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'new'
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <Plus className="w-4 h-4" />
                            New Document
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'history'
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                        >
                            <History className="w-4 h-4" />
                            History
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-sm hidden sm:block">{userEmail}</span>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                            {userEmail?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

                {/* ════════════════════════════════════════════════════════════ */}
                {/* TAB: + New Document                                        */}
                {/* ════════════════════════════════════════════════════════════ */}
                {activeTab === 'new' && (
                    <div className="space-y-10 animate-fade-in">
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
                                        Upload a document and sign it instantly — you're automatically set as the only signer. No emails, no waiting.
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
                                        Send documents to others for signing. Set custom signing order, priorities, and track progress in real-time.
                                    </p>
                                    <div className="mt-auto">
                                        <Link
                                            href="/documents/new?mode=request"
                                            className="flex items-center justify-center gap-2 w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-sky-500 hover:shadow-xl hover:shadow-sky-900/30 active:scale-[0.98]"
                                        >
                                            <Plus className="w-4 h-4" />
                                            New Request-Sign Document
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
                )}

                {/* ════════════════════════════════════════════════════════════ */}
                {/* TAB: History                                                */}
                {/* ════════════════════════════════════════════════════════════ */}
                {activeTab === 'history' && (
                    <div className="space-y-5 animate-fade-in">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-3xl font-extrabold text-white tracking-tight">Document History</h1>
                                <p className="text-slate-500 text-sm mt-0.5">Browse, filter, and manage all your signing workflows.</p>
                            </div>

                            {/* Filter Tabs */}
                            <div className="flex gap-0.5 p-1 bg-slate-800/60 rounded-xl border border-slate-700/40 backdrop-blur-sm self-start">
                                {([
                                    { key: 'all' as const, label: 'All', count: documents.length },
                                    { key: 'self' as const, label: 'Self-Signed', count: selfCount },
                                    { key: 'request' as const, label: 'Sent', count: requestCount },
                                ]).map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setHistoryFilter(tab.key)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 ${historyFilter === tab.key
                                                ? 'bg-slate-700 text-white shadow-md'
                                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                                            }`}
                                    >
                                        {tab.label}
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${historyFilter === tab.key ? 'bg-slate-600 text-slate-200' : 'bg-slate-800 text-slate-600'
                                            }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-20">
                                <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-slate-500 text-sm">Loading documents...</p>
                            </div>
                        ) : filteredDocs.length === 0 ? (
                            <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-16 text-center">
                                <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                <p className="text-white font-semibold text-lg">No documents found</p>
                                <p className="text-slate-500 text-sm mt-1">
                                    {historyFilter === 'self' ? 'Self-signed documents will appear here.' :
                                        historyFilter === 'request' ? 'Documents sent to others will appear here.' :
                                            'Create your first document to get started.'}
                                </p>
                                <button
                                    onClick={() => setActiveTab('new')}
                                    className="btn-primary text-sm mt-6"
                                >
                                    <Plus className="w-4 h-4 mr-1 inline" /> Create Document
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredDocs.map((doc) => (
                                    <Link
                                        key={doc.id}
                                        href={`/documents/${doc.id}/status`}
                                        className="group grid grid-cols-1 sm:grid-cols-[1fr,auto,auto,auto] items-center gap-4 px-5 py-4 rounded-xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm hover:bg-slate-800/50 hover:border-slate-700/60 transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 ${doc.type === 'self_sign'
                                                    ? 'bg-violet-600/10 border border-violet-500/20 group-hover:bg-violet-600/20'
                                                    : 'bg-sky-600/10 border border-sky-500/20 group-hover:bg-sky-600/20'
                                                }`}>
                                                {doc.type === 'self_sign'
                                                    ? <PenTool className="w-4 h-4 text-violet-400" />
                                                    : <Send className="w-4 h-4 text-sky-400" />
                                                }
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-white truncate group-hover:text-brand-300 transition-colors">{doc.file_name}</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                                    {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex justify-start sm:justify-center">
                                            <TypeBadge type={doc.type || 'request_sign'} />
                                        </div>

                                        <div className="flex justify-start sm:justify-center">
                                            <StatusBadge status={doc.status} />
                                        </div>

                                        <div className="flex justify-end">
                                            <span className="text-xs font-bold text-slate-600 group-hover:text-brand-400 transition-colors uppercase tracking-widest flex items-center gap-1">
                                                View <ArrowRight className="w-3 h-3" />
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
