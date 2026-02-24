'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
    FileText, Search, PenTool, Send, ArrowRight,
    Filter, X, ChevronRight,
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

function TypeBadge({ type }: { type: string }) {
    return type === 'self_sign' ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#4C00FF]/10 text-[#4C00FF] text-[11px] font-semibold">
            <PenTool className="w-3 h-3" /> Self
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[11px] font-semibold">
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

            // Try with new columns first, fall back to basic query
            let docs: DocRow[] = []
            const { data, error } = await supabase
                .from('documents')
                .select('id, file_name, status, type, category, created_at, updated_at')
                .eq('sender_id', user.id)
                .order('created_at', { ascending: false })

            if (error) {
                // Fallback: columns from migration may not exist yet
                const { data: fallback } = await supabase
                    .from('documents')
                    .select('id, file_name, status, type, created_at')
                    .eq('sender_id', user.id)
                    .order('created_at', { ascending: false })
                docs = (fallback ?? []).map(d => ({ ...d, category: null, updated_at: null }))
            } else {
                docs = data ?? []
            }

            setDocuments(docs)
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
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Document History</h1>
                    <p className="text-slate-400 text-sm mt-0.5">Browse, filter, and manage all your documents.</p>
                </div>
            </div>

            {/* Search + Filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search documents…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4C00FF]/30 focus:border-[#4C00FF]/40"
                    />
                </div>

                <button
                    onClick={() => setShowFilters(prev => !prev)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0
                        ? 'bg-[#4C00FF]/10 border-[#4C00FF]/30 text-[#4C00FF]'
                        : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                >
                    <Filter className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="bg-[#4C00FF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">{activeFilterCount}</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/60">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4C00FF]/40 appearance-none"
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
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4C00FF]/40 appearance-none"
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
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#4C00FF]/40 appearance-none"
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
                <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800/60">
                    <div className="w-7 h-7 border-2 border-[#4C00FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">Loading documents…</p>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-700/40 bg-slate-900/40 p-16 text-center">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-white font-semibold text-lg">No documents found</p>
                    <p className="text-slate-500 text-sm mt-1">
                        {activeFilterCount > 0 ? 'Try adjusting your filters.' : 'Create your first document to get started.'}
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

                            <TypeBadge type={doc.type || 'request_sign'} />
                            <StatusBadge status={doc.status} />
                            <span className="text-sm text-slate-500 hidden sm:block w-28 truncate">{doc.category || '—'}</span>
                            <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-[#4C00FF] transition-colors" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
