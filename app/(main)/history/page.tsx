'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
    FileText, Search, PenTool, Send, ArrowRight,
    Filter, X,
} from 'lucide-react'
import { AGREEMENT_CATEGORIES } from '@/lib/categories'

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

function TypeBadge({ type }: { type: string }) {
    return type === 'self_sign' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-400 text-[11px] font-semibold">
            <PenTool className="w-3 h-3" /> Self
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 text-[11px] font-semibold">
            <Send className="w-3 h-3" /> Request
        </span>
    )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function HistoryPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [documents, setDocuments] = useState<DocRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [typeFilter, setTypeFilter] = useState<string>('all')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [showFilters, setShowFilters] = useState(false)

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from('documents')
                .select('id, file_name, status, type, category, created_at, updated_at')
                .eq('sender_id', user.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false })

            setDocuments(data ?? [])
            setLoading(false)
        }
        fetchData()
    }, [])

    // Apply filters
    const filteredDocs = documents.filter(doc => {
        if (statusFilter !== 'all' && doc.status !== statusFilter) return false
        if (typeFilter !== 'all' && doc.type !== typeFilter) return false
        if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false
        if (search && !doc.file_name.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    // Get unique categories from documents
    const usedCategories = Array.from(new Set(documents.map(d => d.category).filter(Boolean) as string[]))

    const activeFilterCount = [statusFilter, typeFilter, categoryFilter].filter(f => f !== 'all').length

    const clearFilters = () => {
        setStatusFilter('all')
        setTypeFilter('all')
        setCategoryFilter('all')
        setSearch('')
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight">Document History</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Browse, filter, and manage all your documents.</p>
                </div>
            </div>

            {/* Search + Filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search documents…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/30"
                    />
                </div>

                <button
                    onClick={() => setShowFilters(prev => !prev)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${showFilters || activeFilterCount > 0
                        ? 'bg-brand-600/10 border-brand-500/30 text-brand-400'
                        : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
                        }`}
                >
                    <Filter className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{activeFilterCount}</span>
                    )}
                </button>

                {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors">
                        <X className="w-3 h-3" /> Clear all
                    </button>
                )}
            </div>

            {/* Filter dropdowns */}
            {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800/60 animate-fade-in">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500/50 appearance-none"
                        >
                            <option value="all">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500/50 appearance-none"
                        >
                            <option value="all">All Types</option>
                            <option value="self_sign">Self Sign</option>
                            <option value="request_sign">Request Sign</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-500/50 appearance-none"
                        >
                            <option value="all">All Categories</option>
                            {AGREEMENT_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Results count */}
            <p className="text-xs text-slate-500 font-medium">
                Showing {filteredDocs.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>

            {/* Document List */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Loading documents…</p>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-16 text-center">
                    <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-white font-semibold text-lg">No documents found</p>
                    <p className="text-slate-500 text-sm mt-1">
                        {activeFilterCount > 0 ? 'Try adjusting your filters.' : 'Create your first document to get started.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredDocs.map(doc => (
                        <Link
                            key={doc.id}
                            href={`/documents/${doc.id}/status`}
                            className="group grid grid-cols-1 sm:grid-cols-[1fr,auto,auto,auto,auto] items-center gap-4 px-5 py-4 rounded-xl border border-slate-800/60 bg-slate-900/40 backdrop-blur-sm hover:bg-slate-800/50 hover:border-slate-700/60 transition-all duration-200"
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
                                        {doc.category && <span className="ml-2 text-slate-600">• {doc.category}</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-start sm:justify-center">
                                <TypeBadge type={doc.type || 'request_sign'} />
                            </div>

                            <div className="flex justify-start sm:justify-center">
                                <StatusBadge status={doc.status} />
                            </div>

                            <div className="text-sm text-slate-500 hidden sm:block">
                                {doc.category || '—'}
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
    )
}
