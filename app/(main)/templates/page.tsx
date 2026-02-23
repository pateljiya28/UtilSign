'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
    LayoutTemplate, Search, Plus, Star,
    FileText, MoreVertical, Trash2,
} from 'lucide-react'

interface Template {
    id: string
    name: string
    description: string | null
    category: string | null
    file_name: string | null
    created_at: string
    updated_at: string
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

    const fetchTemplates = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/templates')
            const data = await res.json()
            if (res.ok) setTemplates(data.templates ?? [])
        } catch { /* ignore */ } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchTemplates() }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return
        await fetch(`/api/templates/${id}`, { method: 'DELETE' })
        setMenuOpenId(null)
        fetchTemplates()
    }

    const filtered = search
        ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
        : templates

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* ── Sidebar ─────────────────────────────────────────────────────── */}
            <aside className="w-60 shrink-0 border-r border-slate-800/60 bg-slate-900/50 flex flex-col">
                <div className="p-4">
                    <Link
                        href="/templates/new"
                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-brand-500 hover:shadow-lg hover:shadow-brand-900/30 active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        Create Template
                    </Link>
                </div>

                <div className="px-3 pb-2">
                    <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        Envelope Templates
                    </p>
                </div>

                <nav className="flex-1 px-3 space-y-0.5">
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-brand-600/15 text-brand-400 border border-brand-500/20">
                        <FileText className="w-4 h-4" />
                        My Templates
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 border border-transparent cursor-not-allowed" disabled>
                        <Star className="w-4 h-4" />
                        Favorites
                        <span className="ml-auto text-[10px] bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded">Soon</span>
                    </button>
                </nav>
            </aside>

            {/* ── Main Content ─────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="px-8 pt-8 pb-4 space-y-4">
                    <h1 className="text-2xl font-extrabold text-white tracking-tight">My Templates</h1>

                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search My Templates…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/30"
                            />
                        </div>
                    </div>
                </div>

                {/* Table header */}
                <div className="px-8">
                    <div className="grid grid-cols-[1fr,140px,160px,160px,100px] gap-4 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-800/60">
                        <span>Name</span>
                        <span>Category</span>
                        <span>Created Date</span>
                        <span>Last Change</span>
                        <span className="text-right">Actions</span>
                    </div>
                </div>

                {/* Template List */}
                <div className="flex-1 overflow-y-auto px-8">
                    {loading ? (
                        <div className="text-center py-20">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                            <p className="text-slate-500 text-sm">Loading…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20 space-y-3">
                            <LayoutTemplate className="w-12 h-12 text-slate-700 mx-auto" />
                            <p className="text-white font-semibold">No templates yet</p>
                            <p className="text-slate-500 text-sm">Create your first template to speed up envelope creation.</p>
                            <Link href="/templates/new" className="btn-primary text-sm inline-flex items-center gap-2 mt-2">
                                <Plus className="w-4 h-4" /> Create Template
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800/40">
                            {filtered.map(t => (
                                <div
                                    key={t.id}
                                    className="grid grid-cols-[1fr,140px,160px,160px,100px] gap-4 items-center px-4 py-4 hover:bg-slate-800/30 transition-colors group"
                                >
                                    {/* Name */}
                                    <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">{t.name}</p>
                                        {t.description && (
                                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{t.description}</p>
                                        )}
                                    </div>

                                    {/* Category */}
                                    <div className="text-sm text-slate-400 truncate">
                                        {t.category || '—'}
                                    </div>

                                    {/* Created Date */}
                                    <div className="text-sm text-slate-400">
                                        {new Date(t.created_at).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric',
                                        })}
                                    </div>

                                    {/* Last Change */}
                                    <div className="text-sm text-slate-400">
                                        {new Date(t.updated_at).toLocaleDateString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric',
                                        })}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-end gap-2 relative">
                                        <Link
                                            href={`/documents/new?mode=request&template=${t.id}`}
                                            className="px-3 py-1.5 rounded-lg bg-brand-600 text-xs font-bold text-white hover:bg-brand-500 transition-colors"
                                        >
                                            Use
                                        </Link>
                                        <div className="relative">
                                            <button
                                                onClick={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)}
                                                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-white transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                            {menuOpenId === t.id && (
                                                <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-50">
                                                    <button
                                                        onClick={() => handleDelete(t.id)}
                                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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
