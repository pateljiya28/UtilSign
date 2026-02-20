'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Placeholder {
    id: string
    pageNumber: number
    xPercent: number
    yPercent: number
    widthPercent: number
    heightPercent: number
    label: string
    assignedSignerEmail: string
}

interface SignerEntry {
    email: string
    priority: number
    color: string
}

const SIGNER_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewDocumentPage() {
    const router = useRouter()
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Step 1: Upload
    const [file, setFile] = useState<File | null>(null)
    const [documentId, setDocumentId] = useState<string | null>(null)
    const [filePath, setFilePath] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)

    // Step 2: Placeholders
    const [pdfPages, setPdfPages] = useState<string[]>([])
    const [placeholders, setPlaceholders] = useState<Placeholder[]>([])
    const [activePage, setActivePage] = useState(1)
    const [signerEmails, setSignerEmails] = useState<string[]>([''])
    const pdfContainerRef = useRef<HTMLDivElement>(null)

    // Step 3: Signers assignment
    const [signers, setSigners] = useState<SignerEntry[]>([])

    // ── File validation & upload ───────────────────────────────────────────────
    const handleFile = useCallback((f: File) => {
        setError('')
        if (f.type !== 'application/pdf') {
            setError('Only PDF files are accepted.')
            return
        }
        if (f.size > 10 * 1024 * 1024) {
            setError('File must be 10MB or smaller.')
            return
        }
        setFile(f)
    }, [])

    const handleUpload = async () => {
        if (!file) return
        setLoading(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Upload failed')
            setDocumentId(data.documentId)
            setFilePath(data.filePath)
            // Render PDF pages
            await renderPDF(file)
            setStep(2)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setLoading(false)
        }
    }

    // ── Render PDF pages as images using pdfjs-dist ────────────────────────────
    const renderPDF = async (pdfFile: File) => {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
        const arrayBuffer = await pdfFile.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const pages: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext('2d')!
            await page.render({ canvasContext: ctx, viewport }).promise
            pages.push(canvas.toDataURL('image/png'))
        }
        setPdfPages(pages)
    }

    // ── Placeholder drag creation ──────────────────────────────────────────────
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 })

    const getRelativeCoords = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        return {
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        }
    }

    const handlePageMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.placeholder-box')) return
        const coords = getRelativeCoords(e)
        setIsDragging(true)
        setDragStart(coords)
        setDragCurrent(coords)
    }

    const handlePageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDragging) return
        setDragCurrent(getRelativeCoords(e))
    }

    const handlePageMouseUp = () => {
        if (!isDragging) return
        setIsDragging(false)
        const xPercent = Math.min(dragStart.x, dragCurrent.x)
        const yPercent = Math.min(dragStart.y, dragCurrent.y)
        const widthPercent = Math.abs(dragCurrent.x - dragStart.x)
        const heightPercent = Math.abs(dragCurrent.y - dragStart.y)
        if (widthPercent < 2 || heightPercent < 1) return

        const currentEmail = signerEmails.find(e => e.trim() !== '') || ''
        const newPh: Placeholder = {
            id: crypto.randomUUID(),
            pageNumber: activePage,
            xPercent,
            yPercent,
            widthPercent,
            heightPercent,
            label: `Signature ${placeholders.length + 1}`,
            assignedSignerEmail: currentEmail,
        }
        setPlaceholders(prev => [...prev, newPh])
    }

    const removePlaceholder = (id: string) => {
        setPlaceholders(prev => prev.filter(p => p.id !== id))
    }

    const updatePlaceholderEmail = (id: string, email: string) => {
        setPlaceholders(prev => prev.map(p => p.id === id ? { ...p, assignedSignerEmail: email } : p))
    }

    // ── Save placeholders and move to step 3 ──────────────────────────────────
    const handleSavePlaceholders = async () => {
        if (placeholders.length === 0) {
            setError('Place at least one signature placeholder on the document.')
            return
        }
        setLoading(true)
        setError('')
        try {
            // Validate all placeholders have signer emails
            const unassigned = placeholders.filter(p => !p.assignedSignerEmail || p.assignedSignerEmail.trim() === '')
            if (unassigned.length > 0) {
                setError(`${unassigned.length} placeholder(s) have no signer email assigned. Please assign all placeholders to a signer.`)
                setLoading(false)
                return
            }

            const res = await fetch(`/api/documents/${documentId}/placeholders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ placeholders }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Failed to save placeholders')

            // Build signers from unique emails
            const uniqueEmails = Array.from(new Set(placeholders.map(p => p.assignedSignerEmail).filter(Boolean)))
            if (uniqueEmails.length === 0) {
                setError('No signer emails found. Add signer emails and assign them to placeholders.')
                setLoading(false)
                return
            }
            setSigners(uniqueEmails.map((email, i) => ({
                email,
                priority: i + 1,
                color: SIGNER_COLORS[i % SIGNER_COLORS.length],
            })))
            setStep(3)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setLoading(false)
        }
    }

    // ── Send for signing ──────────────────────────────────────────────────────
    const handleSend = async () => {
        if (signers.some(s => !s.email)) {
            setError('All signers must have an email address.')
            return
        }
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/documents/${documentId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signers: signers.map(s => ({ email: s.email, priority: s.priority })) }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Failed to send')
            router.push(`/documents/${documentId}/status`)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send')
        } finally {
            setLoading(false)
        }
    }

    // ── Color for signer email ─────────────────────────────────────────────────
    const getSignerColor = (email: string): string => {
        const allEmails = Array.from(new Set(placeholders.map(p => p.assignedSignerEmail).filter(Boolean)))
        const idx = allEmails.indexOf(email)
        return SIGNER_COLORS[Math.max(0, idx) % SIGNER_COLORS.length]
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="page-header">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <span className="font-bold text-white">New Document</span>
                    </div>
                    {/* Stepper */}
                    <div className="flex items-center gap-3">
                        {[1, 2, 3].map(s => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40' :
                                    step > s ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                                    }`}>
                                    {step > s ? '✓' : s}
                                </div>
                                <span className={`text-xs hidden sm:block ${step === s ? 'text-white font-medium' : 'text-slate-500'}`}>
                                    {s === 1 ? 'Upload' : s === 2 ? 'Placeholders' : 'Send'}
                                </span>
                                {s < 3 && <div className={`w-8 h-px ${step > s ? 'bg-emerald-600' : 'bg-slate-700'}`} />}
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* Error */}
            {error && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                        {error}
                    </div>
                </div>
            )}

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
                {/* ════════════════ STEP 1: UPLOAD ════════════════ */}
                {step === 1 && (
                    <div className="max-w-xl mx-auto animate-fade-in">
                        <h2 className="text-xl font-bold text-white mb-2">Upload your document</h2>
                        <p className="text-slate-400 text-sm mb-6">Upload a PDF file (max 10MB) to start the signing process.</p>
                        <div
                            className={`card p-12 border-2 border-dashed transition-all cursor-pointer text-center ${dragActive ? 'border-brand-500 bg-brand-500/5' :
                                file ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700 hover:border-slate-600'
                                }`}
                            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                            />
                            {file ? (
                                <div className="space-y-2">
                                    <div className="text-3xl">📄</div>
                                    <p className="text-white font-medium">{file.name}</p>
                                    <p className="text-slate-400 text-xs">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    <button
                                        onClick={e => { e.stopPropagation(); setFile(null) }}
                                        className="text-red-400 text-xs hover:text-red-300"
                                    >Remove</button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="text-4xl">📤</div>
                                    <p className="text-white font-medium">Drop your PDF here</p>
                                    <p className="text-slate-500 text-xs">or click to browse</p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className="btn-primary w-full mt-6"
                        >
                            {loading ? 'Uploading…' : 'Upload & Continue'}
                        </button>
                    </div>
                )}

                {/* ════════════════ STEP 2: PLACEHOLDERS ════════════════ */}
                {step === 2 && (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">Place signature fields</h2>
                                <p className="text-slate-400 text-sm mt-0.5">Click and drag on the PDF to create signature placeholders. Assign each to a signer email.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setStep(1)} className="btn-secondary text-xs">← Back</button>
                                <button onClick={handleSavePlaceholders} disabled={loading} className="btn-primary text-xs">
                                    {loading ? 'Saving…' : 'Save & Continue →'}
                                </button>
                            </div>
                        </div>

                        {/* Signer email inputs */}
                        <div className="card p-4 mb-6">
                            <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Signer Emails</p>
                            <div className="flex flex-wrap gap-2">
                                {signerEmails.map((email, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-full" style={{ background: SIGNER_COLORS[i % SIGNER_COLORS.length] }} />
                                        <input
                                            type="email"
                                            className="input w-56 text-xs py-1.5"
                                            placeholder={`signer${i + 1}@example.com`}
                                            value={email}
                                            onChange={e => {
                                                const updated = [...signerEmails]
                                                updated[i] = e.target.value
                                                setSignerEmails(updated)
                                            }}
                                        />
                                        {signerEmails.length > 1 && (
                                            <button onClick={() => setSignerEmails(prev => prev.filter((_, j) => j !== i))} className="text-red-400 text-xs hover:text-red-300">✕</button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={() => setSignerEmails(prev => [...prev, ''])}
                                    className="btn-secondary text-xs px-2 py-1"
                                >+ Add Signer</button>
                            </div>
                        </div>

                        {/* Page navigation */}
                        {pdfPages.length > 1 && (
                            <div className="flex items-center gap-2 mb-4">
                                {pdfPages.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActivePage(i + 1)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage === i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >Page {i + 1}</button>
                                ))}
                            </div>
                        )}

                        {/* PDF Canvas + Placeholders */}
                        <div
                            ref={pdfContainerRef}
                            className="relative inline-block border border-slate-700 rounded-xl overflow-hidden cursor-crosshair select-none"
                            onMouseDown={handlePageMouseDown}
                            onMouseMove={handlePageMouseMove}
                            onMouseUp={handlePageMouseUp}
                            onMouseLeave={() => setIsDragging(false)}
                        >
                            {pdfPages[activePage - 1] && (
                                <img
                                    src={pdfPages[activePage - 1]}
                                    alt={`Page ${activePage}`}
                                    className="max-w-full"
                                    draggable={false}
                                />
                            )}

                            {/* Drawing rect */}
                            {isDragging && (
                                <div
                                    className="absolute border-2 border-brand-400 bg-brand-500/10 pointer-events-none"
                                    style={{
                                        left: `${Math.min(dragStart.x, dragCurrent.x)}%`,
                                        top: `${Math.min(dragStart.y, dragCurrent.y)}%`,
                                        width: `${Math.abs(dragCurrent.x - dragStart.x)}%`,
                                        height: `${Math.abs(dragCurrent.y - dragStart.y)}%`,
                                    }}
                                />
                            )}

                            {/* Existing placeholders on active page */}
                            {placeholders
                                .filter(p => p.pageNumber === activePage)
                                .map(p => (
                                    <div
                                        key={p.id}
                                        className="placeholder-box absolute group"
                                        style={{
                                            left: `${p.xPercent}%`,
                                            top: `${p.yPercent}%`,
                                            width: `${p.widthPercent}%`,
                                            height: `${p.heightPercent}%`,
                                            border: `2px solid ${getSignerColor(p.assignedSignerEmail)}`,
                                            background: `${getSignerColor(p.assignedSignerEmail)}15`,
                                        }}
                                    >
                                        <div className="absolute -top-7 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1" style={{ zIndex: 50 }}>
                                            <select
                                                className="text-[10px] bg-slate-800 text-white rounded px-1 py-0.5 border border-slate-600"
                                                value={p.assignedSignerEmail}
                                                onChange={e => updatePlaceholderEmail(p.id, e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                onMouseDown={e => e.stopPropagation()}
                                            >
                                                {signerEmails.filter(Boolean).map(email => (
                                                    <option key={email} value={email}>{email}</option>
                                                ))}
                                            </select>
                                            <button
                                                className="text-red-400 hover:text-red-300 text-xs bg-slate-800 rounded px-1"
                                                onClick={e => { e.stopPropagation(); removePlaceholder(p.id) }}
                                                onMouseDown={e => e.stopPropagation()}
                                            >✕</button>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <span className="text-[10px] font-medium opacity-60" style={{ color: getSignerColor(p.assignedSignerEmail) }}>
                                                ✍ {p.label}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* Placeholder list */}
                        {placeholders.length > 0 && (
                            <div className="card p-4 mt-4">
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-2">{placeholders.length} Placeholder{placeholders.length !== 1 ? 's' : ''}</p>
                                <div className="space-y-1">
                                    {placeholders.map(p => (
                                        <div key={p.id} className="flex items-center gap-2 text-xs text-slate-300">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: getSignerColor(p.assignedSignerEmail) }} />
                                            <span>Page {p.pageNumber} — {p.assignedSignerEmail || 'unassigned'}</span>
                                            <button onClick={() => removePlaceholder(p.id)} className="text-red-400 hover:text-red-300 ml-auto">Remove</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════════ STEP 3: SEND ════════════════ */}
                {step === 3 && (
                    <div className="max-w-xl mx-auto animate-fade-in">
                        <h2 className="text-xl font-bold text-white mb-2">Review & Send</h2>
                        <p className="text-slate-400 text-sm mb-6">Confirm signers and their signing order, then send.</p>

                        <div className="card p-6 space-y-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase">Signing Order</p>
                            {signers.map((s, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: s.color }}>
                                        {s.priority}
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="email"
                                            className="input text-sm py-1.5"
                                            value={s.email}
                                            onChange={e => {
                                                const updated = [...signers]
                                                updated[i] = { ...updated[i], email: e.target.value }
                                                setSigners(updated)
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            disabled={i === 0}
                                            onClick={() => {
                                                if (i === 0) return
                                                const updated = [...signers]
                                                const prev = updated[i - 1]
                                                updated[i - 1] = { ...updated[i], priority: prev.priority }
                                                updated[i] = { ...prev, priority: updated[i].priority }
                                                setSigners(updated)
                                            }}
                                            className="text-slate-500 hover:text-white disabled:opacity-30 text-xs"
                                        >▲</button>
                                        <button
                                            disabled={i === signers.length - 1}
                                            onClick={() => {
                                                if (i === signers.length - 1) return
                                                const updated = [...signers]
                                                const next = updated[i + 1]
                                                updated[i + 1] = { ...updated[i], priority: next.priority }
                                                updated[i] = { ...next, priority: updated[i].priority }
                                                setSigners(updated)
                                            }}
                                            className="text-slate-500 hover:text-white disabled:opacity-30 text-xs"
                                        >▼</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card p-4 mt-4 border-brand-800/40 bg-brand-950/20">
                            <div className="flex items-start gap-3">
                                <div className="text-xl">ℹ️</div>
                                <div className="text-sm text-slate-300">
                                    <p className="font-medium text-white mb-1">Priority-based signing</p>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Signer #1 will receive an email first. After they sign, signer #2 will be notified, and so on.
                                        Each signer will verify their identity with a one-time code before signing.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setStep(2)} className="btn-secondary flex-1">← Back</button>
                            <button onClick={handleSend} disabled={loading} className="btn-primary flex-1">
                                {loading ? 'Sending…' : '✉ Send for Signing'}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
