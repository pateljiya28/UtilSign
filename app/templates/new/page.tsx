'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback } from 'react'
import {
    ArrowLeft, Upload, Plus, X, ChevronUp, ChevronDown,
    Mail, User, FileText, Save,
} from 'lucide-react'
import { AGREEMENT_CATEGORIES } from '@/lib/categories'

interface Recipient {
    name: string
    email: string
    priority: number
}

export default function NewTemplatePage() {
    const router = useRouter()

    const [templateName, setTemplateName] = useState('')
    const [templateDescription, setTemplateDescription] = useState('')
    const [category, setCategory] = useState('')
    const [recipients, setRecipients] = useState<Recipient[]>([{ name: '', email: '', priority: 1 }])
    const [emailSubject, setEmailSubject] = useState('')
    const [emailMessage, setEmailMessage] = useState('')

    // Optional document attachment
    const [file, setFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleFile = useCallback((f: File) => {
        setError('')
        if (f.type !== 'application/pdf') { setError('Only PDF files are accepted.'); return }
        if (f.size > 10 * 1024 * 1024) { setError('File must be 10MB or smaller.'); return }
        setFile(f)
    }, [])

    const addRecipient = () => {
        setRecipients(prev => [...prev, { name: '', email: '', priority: prev.length + 1 }])
    }

    const removeRecipient = (idx: number) => {
        setRecipients(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, priority: i + 1 })))
    }

    const moveRecipient = (idx: number, dir: 'up' | 'down') => {
        setRecipients(prev => {
            const arr = [...prev]
            const swapIdx = dir === 'up' ? idx - 1 : idx + 1
            if (swapIdx < 0 || swapIdx >= arr.length) return arr
                ;[arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
            return arr.map((r, i) => ({ ...r, priority: i + 1 }))
        })
    }

    const handleSave = async () => {
        if (!templateName.trim()) {
            setError('Template name is required.')
            return
        }
        setLoading(true)
        setError('')

        try {
            // Optionally upload the file first
            let filePath: string | null = null
            let fileName: string | null = null

            if (file) {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('type', 'request_sign')
                const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: formData })
                const uploadData = await uploadRes.json()
                if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed')
                filePath = uploadData.filePath
                fileName = file.name
            }

            const validRecipients = recipients.filter(r => r.email.trim())

            const res = await fetch('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: templateName.trim(),
                    description: templateDescription.trim() || null,
                    category: category || null,
                    recipients: validRecipients,
                    subject: emailSubject.trim() || null,
                    message: emailMessage.trim() || null,
                    file_path: filePath,
                    file_name: fileName,
                }),
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Failed to save template')

            router.push('/templates')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen">
            {/* ── Header ───────────────────────────────────────────────────────── */}
            <div className="bg-slate-900/50 border-b border-slate-800/60 px-6 py-4">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/templates')}
                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold text-white">Create Template</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-sm font-bold text-white hover:bg-brand-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="w-4 h-4" />
                        {loading ? 'Saving…' : 'Save Template'}
                    </button>
                </div>
            </div>

            {/* ── Content ──────────────────────────────────────────────────────── */}
            <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                {error && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                        {error}
                    </div>
                )}

                {/* ── Template Name & Description ─────────────────────────────── */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-brand-400 uppercase tracking-wider mb-1.5">Template Name *</label>
                        <input
                            type="text"
                            placeholder="e.g. NDA Template"
                            value={templateName}
                            onChange={e => setTemplateName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description (optional)</label>
                        <textarea
                            placeholder="Describe what this template is for…"
                            value={templateDescription}
                            onChange={e => setTemplateDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                        />
                    </div>
                </div>

                {/* ── Category ────────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 appearance-none"
                    >
                        <option value="">— Select —</option>
                        {AGREEMENT_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                {/* ── Add Document (optional) ─────────────────────────────────── */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-400" />
                        Add Document (optional)
                    </h3>
                    {file ? (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                            <FileText className="w-5 h-5 text-brand-400 shrink-0" />
                            <span className="text-sm text-white truncate flex-1">{file.name}</span>
                            <button onClick={() => setFile(null)} className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-red-400">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div
                            onDragEnter={() => setDragActive(true)}
                            onDragLeave={() => setDragActive(false)}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-brand-500 bg-brand-500/5' : 'border-slate-700/40 hover:border-slate-600'}`}
                        >
                            <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                            <p className="text-sm text-slate-400">Drop your file here or</p>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-2 px-4 py-2 rounded-lg bg-brand-600 text-xs font-bold text-white hover:bg-brand-500 transition-colors"
                            >
                                Upload
                            </button>
                            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
                        </div>
                    )}
                </div>

                {/* ── Add Recipients ──────────────────────────────────────────── */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <User className="w-4 h-4 text-brand-400" />
                        Add Recipients
                    </h3>
                    <div className="space-y-3">
                        {recipients.map((r, idx) => (
                            <div key={idx} className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                                <span className="w-7 h-7 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-[10px] font-bold text-brand-400 shrink-0 mt-1">
                                    {r.priority}
                                </span>
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                    <input
                                        placeholder="Role / Name"
                                        value={r.name}
                                        onChange={e => {
                                            const arr = [...recipients]; arr[idx] = { ...arr[idx], name: e.target.value }; setRecipients(arr)
                                        }}
                                        className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                                    />
                                    <input
                                        placeholder="Email"
                                        type="email"
                                        value={r.email}
                                        onChange={e => {
                                            const arr = [...recipients]; arr[idx] = { ...arr[idx], email: e.target.value }; setRecipients(arr)
                                        }}
                                        className="px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5 shrink-0">
                                    <button onClick={() => moveRecipient(idx, 'up')} disabled={idx === 0} className="p-1 rounded hover:bg-slate-700 text-slate-500 disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                                    <button onClick={() => moveRecipient(idx, 'down')} disabled={idx === recipients.length - 1} className="p-1 rounded hover:bg-slate-700 text-slate-500 disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                                {recipients.length > 1 && (
                                    <button onClick={() => removeRecipient(idx)} className="p-1.5 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 shrink-0 mt-1"><X className="w-3.5 h-3.5" /></button>
                                )}
                            </div>
                        ))}
                    </div>
                    <button onClick={addRecipient} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Add Recipient
                    </button>
                </div>

                {/* ── Add Message ─────────────────────────────────────────────── */}
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6">
                    <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-brand-400" />
                        Add Message
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Subject</label>
                            <input
                                type="text"
                                placeholder="Complete with UtilSign:"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Message</label>
                            <textarea
                                placeholder="Enter Message"
                                value={emailMessage}
                                onChange={e => setEmailMessage(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
