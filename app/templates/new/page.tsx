'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback } from 'react'
import {
    ArrowLeft, Upload, Plus, X, ChevronUp, ChevronDown,
    Mail, User, FileText, Save, Info
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
        <div className="min-h-screen bg-gray-50">
            {/* ── DocuSign-style Header ─────────────────────────────────────────── */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/templates')}
                            className="p-2 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Create Template</h1>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#4C00FF] text-sm font-bold text-white hover:bg-[#3D00CC] transition-all shadow-sm disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {loading ? 'Saving…' : 'Save Template'}
                    </button>
                </div>
            </header>

            {/* ── Main content ──────────────────────────────────────────────────── */}
            <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
                {error && (
                    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-center gap-2 animate-fade-in">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* ── Section 1: Template Info ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-[#4C00FF]/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-[#4C00FF]" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Template Identity</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Template Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder="e.g. Standard NDA 2024"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Description</label>
                            <textarea
                                placeholder="Briefly describe the purpose of this template…"
                                value={templateDescription}
                                onChange={e => setTemplateDescription(e.target.value)}
                                rows={2}
                                className="input min-h-[80px] resize-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="input appearance-none"
                            >
                                <option value="">— Select Category —</option>
                                {AGREEMENT_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* ── Section 2: Document (Optional) ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Upload className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Add Document</h3>
                        <span className="text-gray-400 text-[10px] ml-1">(optional)</span>
                    </div>

                    {file ? (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 group">
                            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                                <FileText className="w-5 h-5 text-[#4C00FF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <button
                                onClick={() => setFile(null)}
                                className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div
                            onDragEnter={() => setDragActive(true)}
                            onDragLeave={() => setDragActive(false)}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
                            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${dragActive ? 'border-[#4C00FF] bg-[#4C00FF]/5 translate-y-[-2px]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                                }`}
                        >
                            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-sm text-gray-500 font-medium">Drop your PDF here, or <button onClick={() => fileInputRef.current?.click()} className="text-[#4C00FF] hover:underline">browse files</button></p>
                            <p className="text-xs text-gray-400 mt-1">Maximum file size: 10MB</p>
                            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
                        </div>
                    )}
                </div>

                {/* ── Section 3: Recipients ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <User className="w-4 h-4 text-emerald-600" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Recipients</h3>
                    </div>

                    <div className="space-y-3">
                        {recipients.map((r, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                <span className="w-6 h-6 rounded-full bg-[#4C00FF] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                    {r.priority}
                                </span>
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                    <input
                                        placeholder="Role / Name (e.g. Signer 1)"
                                        value={r.name}
                                        onChange={e => {
                                            const arr = [...recipients]; arr[idx] = { ...arr[idx], name: e.target.value }; setRecipients(arr)
                                        }}
                                        className="input py-1.5"
                                    />
                                    <input
                                        placeholder="Email (optional in template)"
                                        type="email"
                                        value={r.email}
                                        onChange={e => {
                                            const arr = [...recipients]; arr[idx] = { ...arr[idx], email: e.target.value }; setRecipients(arr)
                                        }}
                                        className="input py-1.5"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5 shrink-0">
                                    <button onClick={() => moveRecipient(idx, 'up')} disabled={idx === 0} className="p-1 rounded text-gray-400 hover:text-gray-900 disabled:opacity-20 transition-colors"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => moveRecipient(idx, 'down')} disabled={idx === recipients.length - 1} className="p-1 rounded text-gray-400 hover:text-gray-900 disabled:opacity-20 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
                                </div>
                                {recipients.length > 1 && (
                                    <button
                                        onClick={() => removeRecipient(idx)}
                                        className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={addRecipient}
                        className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Recipient
                    </button>

                    <p className="text-gray-400 text-[11px] mt-4 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Recipients defined here will be pre-filled when you use this template.
                    </p>
                </div>

                {/* ── Section 4: Default Message ── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-amber-600" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Default Message</h3>
                        <span className="text-gray-400 text-[10px] ml-1">(optional)</span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Default Subject</label>
                            <input
                                type="text"
                                placeholder="e.g. Please sign your agreement"
                                value={emailSubject}
                                onChange={e => setEmailSubject(e.target.value)}
                                className="input"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Default Message</label>
                            <textarea
                                placeholder="Add a standard message for your recipients…"
                                value={emailMessage}
                                onChange={e => setEmailMessage(e.target.value)}
                                rows={4}
                                className="input min-h-[100px] resize-y"
                            />
                        </div>
                    </div>
                </div>

                {/* Giant Save Button at bottom */}
                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#4C00FF] text-white font-bold text-lg hover:bg-[#3D00CC] transition-all shadow-lg shadow-[#4C00FF]/20 disabled:opacity-50"
                    >
                        {loading ? 'Saving Template…' : 'Create Template'}
                    </button>
                    <button
                        onClick={() => router.push('/templates')}
                        className="w-full mt-3 py-3 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                    >
                        Cancel and return to list
                    </button>
                </div>
            </main>
        </div>
    )
}

function AlertCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    )
}
