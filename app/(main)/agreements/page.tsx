'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
    Inbox, Send, CheckCircle, AlertCircle,
    FileEdit, Trash2, Clock, Timer,
    Search, Download, MoreVertical,
    ChevronDown, ChevronUp, FileText,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface AgreementDoc {
    id: string
    file_name: string
    status: string
    type: string | null
    category: string | null
    created_at: string
    updated_at: string | null
}

type FilterKey =
    | 'inbox' | 'sent' | 'completed' | 'action_required'
    | 'drafts' | 'deleted' | 'waiting' | 'expiring'

const SIDEBAR_ITEMS: { key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'sent', label: 'Sent', icon: Send },
    { key: 'completed', label: 'Completed', icon: CheckCircle },
    { key: 'action_required', label: 'Action Required', icon: AlertCircle },
]

const SIDEBAR_EXTRA: { key: FilterKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'drafts', label: 'Drafts', icon: FileEdit },
    { key: 'deleted', label: 'Deleted', icon: Trash2 },
    { key: 'waiting', label: 'Waiting for Others', icon: Clock },
    { key: 'expiring', label: 'Expiring Soon', icon: Timer },
]

// ─── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
        draft: { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400', label: 'Draft' },
        sent: { bg: 'bg-sky-500/10', text: 'text-sky-400', dot: 'bg-sky-400', label: 'Sent' },
        in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', label: 'In Progress' },
        completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: 'Completed' },
        cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', label: 'Cancelled' },
    }
    const s = map[status] ?? map.draft
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
        </span>
    )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function AgreementsPage() {
    const [activeFilter, setActiveFilter] = useState<FilterKey>('inbox')
    const [documents, setDocuments] = useState<AgreementDoc[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showMore, setShowMore] = useState(false)

    // Fetch documents for the active filter
    useEffect(() => {
        const fetchDocs = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/agreements?filter=${activeFilter}`)
                const data = await res.json()
                if (res.ok) setDocuments(data.documents ?? [])
                else setDocuments([])
            } catch {
                setDocuments([])
            } finally {
                setLoading(false)
            }
        }
        fetchDocs()
    }, [activeFilter])

    const filteredDocs = search
        ? documents.filter(d => d.file_name.toLowerCase().includes(search.toLowerCase()))
        : documents

    const FILTER_TITLES: Record<FilterKey, string> = {
        inbox: 'Inbox',
        sent: 'Sent',
        completed: 'Completed',
        action_required: 'Action Required',
        drafts: 'Drafts',
        deleted: 'Deleted',
        waiting: 'Waiting for Others',
        expiring: 'Expiring Soon',
    }

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* ── Sidebar ─────────────────────────────────────────────────────── */}
            <aside className="w-60 shrink-0 border-r border-slate-800/60 bg-slate-900/50 flex flex-col">
                <div className="p-4">
                    <Link
                        href="/documents/new?mode=request"
                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-900/30 active:scale-[0.98]"
                    >
                        Start Now
                    </Link>
                </div>

                <div className="px-3 pb-2">
                    <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <Inbox className="w-3.5 h-3.5" />
                        Envelopes
                    </p>
                </div>

                <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
                    {SIDEBAR_ITEMS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveFilter(key)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${activeFilter === key
                                ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                                }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            {label}
                        </button>
                    ))}

                    {/* Show More / Show Less toggle */}
                    <button
                        onClick={() => setShowMore(prev => !prev)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                    >
                        {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {showMore ? 'Show Less' : 'Show More'}
                    </button>

                    {showMore && SIDEBAR_EXTRA.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveFilter(key)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${activeFilter === key
                                ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                                }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            {label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* ── Main Content ─────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="px-8 pt-8 pb-4 space-y-4">
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">
                        {FILTER_TITLES[activeFilter]}
                    </h1>

                    {/* Search + Filters bar */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder={`Search ${FILTER_TITLES[activeFilter]}…`}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/30"
                            />
                        </div>
                    </div>
                </div>

                {/* Table header */}
                <div className="px-8">
                    <div className="grid grid-cols-[1fr,140px,160px,100px] gap-4 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-800/60">
                        <span>Name</span>
                        <span>Status</span>
                        <span>Last Change</span>
                        <span className="text-right">Actions</span>
                    </div>
                </div>

                {/* Document List */}
                <div className="flex-1 overflow-y-auto px-8">
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">Loading…</p>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="text-center py-20 space-y-3">
                            <FileText className="w-12 h-12 text-slate-700 mx-auto" />
                            <p className="text-white font-semibold">No documents found</p>
                            <p className="text-slate-500 text-sm">
                                {search ? 'Try a different search term.' : `No documents in "${FILTER_TITLES[activeFilter]}" yet.`}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/40">
                            {filteredDocs.map(doc => (
                                <Link
                                    key={doc.id}
                                    href={`/documents/${doc.id}/status`}
                                    className="grid grid-cols-[1fr,140px,160px,100px] gap-4 items-center px-4 py-4 hover:bg-slate-800/30 transition-colors group"
                                >
                                    {/* Name */}
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate group-hover:text-brand-400 transition-colors">
                                            {doc.file_name}
                                        </p>
                                        {doc.category && (
                                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{doc.category}</p>
                                        )}
                                    </div>

                                    {/* Status */}
                                    <div>
                                        <StatusBadge status={doc.status} />
                                    </div>

                                    {/* Last Change */}
                                    <div className="text-sm text-slate-400">
                                        {new Date(doc.updated_at || doc.created_at).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric',
                                        })}
                                        <br />
                                        <span className="text-xs text-slate-600">
                                            {new Date(doc.updated_at || doc.created_at).toLocaleTimeString('en-US', {
                                                hour: 'numeric', minute: '2-digit',
                                            })}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={e => {
                                                e.preventDefault()
                                                window.open(`/api/documents/${doc.id}/download`, '_blank')
                                            }}
                                            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-white transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={e => e.preventDefault()}
                                            className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-white transition-colors"
                                            title="More"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
