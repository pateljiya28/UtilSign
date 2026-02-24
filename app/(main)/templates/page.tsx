'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
    FileText, Search, Plus, LayoutTemplate, Star,
    Trash2, ArrowRight, MoreVertical,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TemplateRow {
    id: string
    name: string
    description: string | null
    category: string | null
    created_at: string
    updated_at: string
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function TemplatesPage() {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [templates, setTemplates] = useState<TemplateRow[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [sidebarFilter, setSidebarFilter] = useState('all')

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await fetch('/api/templates')
                const data = await res.json()
                if (res.ok) setTemplates(data.templates ?? [])
            } catch { /* ignore */ }
            setLoading(false)
        }
        fetchTemplates()
    }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return
        try {
            await fetch(`/api/templates/${id}`, { method: 'DELETE' })
            setTemplates(prev => prev.filter(t => t.id !== id))
        } catch { /* ignore */ }
    }

    const filteredTemplates = templates.filter(t => {
        if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    return (
        <div className="max-w-[1400px] mx-auto px-6 py-8">
            <div className="flex gap-6">
                {/* ── Sidebar ─────────────────────────────────────────────────── */}
                <div className="w-60 shrink-0">
                    <h2 className="text-lg font-bold text-white mb-4">Templates</h2>
                    <nav className="space-y-0.5 mb-6">
                        <button
                            onClick={() => setSidebarFilter('all')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sidebarFilter === 'all'
                                ? 'bg-[#4C00FF]/10 text-[#4C00FF]'
                                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                                }`}
                        >
                            <LayoutTemplate className="w-4 h-4" />
                            My Templates
                        </button>
                        <button
                            onClick={() => setSidebarFilter('favorites')}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sidebarFilter === 'favorites'
                                ? 'bg-[#4C00FF]/10 text-[#4C00FF]'
                                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                                }`}
                        >
                            <Star className="w-4 h-4" />
                            Favorites
                        </button>
                    </nav>

                    <Link
                        href="/templates/new"
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#4C00FF] text-white text-sm font-semibold hover:bg-[#3D00CC] transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Template
                    </Link>
                </div>

                {/* ── Main Content ────────────────────────────────────────────── */}
                <div className="flex-1 min-w-0">
                    {/* Search bar */}
                    <div className="relative mb-5">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search templates…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4C00FF]/30 focus:border-[#4C00FF]/40"
                        />
                    </div>

                    {/* Templates Table */}
                    {loading ? (
                        <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800/60">
                            <div className="w-7 h-7 border-2 border-[#4C00FF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">Loading…</p>
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-700/40 bg-slate-900/40 p-16 text-center">
                            <LayoutTemplate className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                            <p className="text-white font-semibold text-lg">
                                {search ? 'No templates found' : 'No templates yet'}
                            </p>
                            <p className="text-slate-500 text-sm mt-1">
                                {search ? 'Try a different search term.' : 'Create your first template to speed up your workflow.'}
                            </p>
                            {!search && (
                                <Link
                                    href="/templates/new"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 mt-5 rounded-lg bg-[#4C00FF] text-white text-sm font-semibold hover:bg-[#3D00CC] transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create Template
                                </Link>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-900/60 rounded-xl border border-slate-800/60 overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-[1fr,140px,140px,120px] gap-4 px-5 py-3 bg-slate-800/40 border-b border-slate-800/60">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</span>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</span>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Change</span>
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</span>
                            </div>

                            {/* Table Rows */}
                            {filteredTemplates.map((t, i) => (
                                <div
                                    key={t.id}
                                    className={`grid grid-cols-[1fr,140px,140px,120px] gap-4 px-5 py-3.5 items-center hover:bg-slate-800/40 transition-colors ${i < filteredTemplates.length - 1 ? 'border-b border-slate-800/40' : ''}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg bg-[#4C00FF]/10 flex items-center justify-center shrink-0">
                                            <FileText className="w-4 h-4 text-[#4C00FF]" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{t.name}</p>
                                            {t.description && (
                                                <p className="text-xs text-slate-500 truncate mt-0.5">{t.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm text-slate-400">{t.category || '—'}</span>
                                    <span className="text-sm text-slate-500">
                                        {new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <div className="flex items-center gap-2 justify-end">
                                        <Link
                                            href={`/documents/new?mode=request&template=${t.id}`}
                                            className="px-3 py-1.5 rounded-md bg-[#4C00FF] text-white text-xs font-semibold hover:bg-[#3D00CC] transition-colors"
                                        >
                                            Use
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
