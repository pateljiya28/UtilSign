'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
    FileText, Search, PenTool, Send, ArrowRight, Inbox, Clock,
    CheckCircle, AlertCircle, Trash2, Users, Timer, FileWarning,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface DocRow {
    id: string
    file_name: string
    status: string
    type: string | null
    category: string | null
    created_at: string
    updated_at: string | null
}

// ─── Sidebar Filters ────────────────────────────────────────────────────────
const FILTERS = [
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'sent', label: 'Sent', icon: Send },
    { key: 'completed', label: 'Completed', icon: CheckCircle },
    { key: 'action_required', label: 'Action Required', icon: AlertCircle },
    { key: 'drafts', label: 'Drafts', icon: FileText },
    { key: 'deleted', label: 'Deleted', icon: Trash2 },
    { key: 'waiting', label: 'Waiting for Others', icon: Users },
    { key: 'expiring', label: 'Expiring Soon', icon: Timer },
] as const

// ─── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; text: string; label: string }> = {
        draft: { bg: 'bg-slate-700/60', text: 'text-slate-300', label: 'Draft' },
        sent: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Sent' },
        in_progress: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'In Progress' },
        completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'Completed' },
        cancelled: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Cancelled' },
    }
    const s = map[status] ?? map.draft
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
            {s.label}
        </span>
    )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function AgreementsPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [documents, setDocuments] = useState<DocRow[]>([])
    const [loading, setLoading] = useState(true)
    const [activeFilter, setActiveFilter] = useState('inbox')
    const [search, setSearch] = useState('')

    useEffect(() => {
        const fetchDocs = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/agreements?filter=${activeFilter}`)
                const data = await res.json()
                if (res.ok) setDocuments(data.documents ?? [])
            } catch { /* ignore */ }
            setLoading(false)
        }
        fetchDocs()
    }, [activeFilter])

    const filteredDocs = search
        ? documents.filter(d => d.file_name.toLowerCase().includes(search.toLowerCase()))
        : documents

    const activeLabel = FILTERS.find(f => f.key === activeFilter)?.label ?? 'Inbox'

    return (
        <div className="max-w-[1400px] mx-auto px-6 py-8">
            <div className="flex gap-6">
                {/* ── Sidebar ─────────────────────────────────────────────────── */}
                <div className="w-60 shrink-0">
                    <h2 className="text-lg font-bold text-white mb-4">Agreements</h2>
                    <nav className="space-y-0.5">
                        {FILTERS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setActiveFilter(key)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilter === key
                                    ? 'bg-[#4C00FF]/10 text-[#4C00FF]'
                                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* ── Main Content ────────────────────────────────────────────── */}
                <div className="flex-1 min-w-0">
                    {/* Search bar */}
                    <div className="relative mb-5">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder={`Search ${activeLabel.toLowerCase()}…`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4C00FF]/30 focus:border-[#4C00FF]/40"
                        />
                    </div>

                    {/* Header bar */}
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{activeLabel}</h3>
                        <p className="text-xs text-slate-500">{filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Document List */}
                    {loading ? (
                        <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800/60">
                            <div className="w-7 h-7 border-2 border-[#4C00FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">Loading…</p>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-700/40 bg-slate-900/40 p-16 text-center">
                            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-white font-semibold text-lg">No documents</p>
                            <p className="text-slate-500 text-sm mt-1">
                                {search ? 'Try a different search term.' : `No documents in ${activeLabel.toLowerCase()} yet.`}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 overflow-hidden">
                            {filteredDocs.map((doc, i) => (
                                <Link
                                    key={doc.id}
                                    href={`/documents/${doc.id}/status`}
                                    className={`group flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/40 transition-colors ${i < filteredDocs.length - 1 ? 'border-b border-slate-800/40' : ''}`}
                                >
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${doc.type === 'self_sign' ? 'bg-[#4C00FF]/10' : 'bg-blue-500/10'}`}>
                                        {doc.type === 'self_sign'
                                            ? <PenTool className="w-4 h-4 text-[#4C00FF]" />
                                            : <Send className="w-4 h-4 text-blue-400" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate group-hover:text-[#4C00FF] transition-colors">{doc.file_name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            {doc.category && <span className="ml-2 text-slate-600">· {doc.category}</span>}
                                        </p>
                                    </div>
                                    <StatusBadge status={doc.status} />
                                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-[#4C00FF] transition-colors" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
