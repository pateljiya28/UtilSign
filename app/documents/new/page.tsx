'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import SignatureModal from '@/components/SignatureModal'
import ThemeToggle from '@/components/ThemeToggle'
import {
    ArrowLeft, PenTool, Send, Upload, FileText, X, Check,
    ChevronUp, ChevronDown, Info, Plus, Trash2, GripVertical
} from 'lucide-react'

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

interface SignatureCapture {
    placeholderId: string
    imageBase64: string
}

const SIGNER_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function NewDocumentPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const mode = searchParams.get('mode') === 'self' ? 'self' : 'request'
    const isSelfSign = mode === 'self'

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Current user email (for self-sign mode)
    const [userEmail, setUserEmail] = useState('')

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
    const [activeSignerIndex, setActiveSignerIndex] = useState(0)
    const pdfContainerRef = useRef<HTMLDivElement>(null)

    // Step 3 (request mode): Signers assignment
    const [signers, setSigners] = useState<SignerEntry[]>([])

    // Step 3 (self-sign mode): Inline signing
    const [signatures, setSignatures] = useState<SignatureCapture[]>([])
    const [modalOpen, setModalOpen] = useState(false)
    const [activePlaceholderId, setActivePlaceholderId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const placeholderRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // Fetch user email on mount
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) {
                setUserEmail(user.email)
                if (isSelfSign) {
                    setSignerEmails([user.email])
                }
            }
        }
        fetchUser()
    }, [isSelfSign])

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
            formData.append('type', isSelfSign ? 'self_sign' : 'request_sign')
            const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Upload failed')
            setDocumentId(data.documentId)
            setFilePath(data.filePath)
            await renderPDF(file)
            setStep(2)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setLoading(false)
        }
    }

    // ── Render PDF pages ──────────────────────────────────────────────────────
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

        const currentEmail = isSelfSign
            ? userEmail
            : (signerEmails[activeSignerIndex]?.trim() || signerEmails.find(e => e.trim() !== '') || '')

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

    // ── Save placeholders ─────────────────────────────────────────────────────
    const handleSavePlaceholders = async () => {
        if (placeholders.length === 0) {
            setError('Place at least one signature placeholder on the document.')
            return
        }
        setLoading(true)
        setError('')
        try {
            const unassigned = placeholders.filter(p => !p.assignedSignerEmail || p.assignedSignerEmail.trim() === '')
            if (unassigned.length > 0) {
                setError(`${unassigned.length} placeholder(s) have no signer email assigned.`)
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

            if (isSelfSign) {
                // Move to inline signing step
                setStep(3)
            } else {
                // Build signers from unique emails
                const uniqueEmails = Array.from(new Set(placeholders.map(p => p.assignedSignerEmail).filter(Boolean)))
                if (uniqueEmails.length === 0) {
                    setError('No signer emails found.')
                    setLoading(false)
                    return
                }
                setSigners(uniqueEmails.map((email, i) => ({
                    email,
                    priority: i + 1,
                    color: SIGNER_COLORS[i % SIGNER_COLORS.length],
                })))
                setStep(3)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setLoading(false)
        }
    }

    // ── Self-sign: inline signing helpers ──────────────────────────────────────
    const handlePlaceholderClick = (placeholderId: string) => {
        setActivePlaceholderId(placeholderId)
        setModalOpen(true)
    }

    const handleSignatureConfirm = (imageBase64: string) => {
        if (!activePlaceholderId) return
        setSignatures(prev => {
            const filtered = prev.filter(s => s.placeholderId !== activePlaceholderId)
            const updated = [...filtered, { placeholderId: activePlaceholderId, imageBase64 }]
            setTimeout(() => scrollToNextUnsigned(activePlaceholderId, updated), 400)
            return updated
        })
        setModalOpen(false)
        setActivePlaceholderId(null)
    }

    const scrollToNextUnsigned = (justSignedId: string, currentSignatures: SignatureCapture[]) => {
        const signedIds = new Set(currentSignatures.map(s => s.placeholderId))
        const justSignedIdx = placeholders.findIndex(p => p.id === justSignedId)
        let nextUnsigned: Placeholder | null = null
        for (let i = justSignedIdx + 1; i < placeholders.length; i++) {
            if (!signedIds.has(placeholders[i].id)) { nextUnsigned = placeholders[i]; break }
        }
        if (!nextUnsigned) {
            for (let i = 0; i < justSignedIdx; i++) {
                if (!signedIds.has(placeholders[i].id)) { nextUnsigned = placeholders[i]; break }
            }
        }
        if (!nextUnsigned) return
        if (nextUnsigned.pageNumber !== activePage) {
            setActivePage(nextUnsigned.pageNumber)
            setTimeout(() => {
                const el = placeholderRefs.current[nextUnsigned!.id]
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 300)
        } else {
            const el = placeholderRefs.current[nextUnsigned.id]
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }

    const handleApplySame = (placeholderId: string) => {
        if (signatures.length === 0) return
        const lastSig = signatures[signatures.length - 1]
        setSignatures(prev => {
            const filtered = prev.filter(s => s.placeholderId !== placeholderId)
            const updated = [...filtered, { placeholderId, imageBase64: lastSig.imageBase64 }]
            setTimeout(() => scrollToNextUnsigned(placeholderId, updated), 400)
            return updated
        })
    }

    const isPlaceholderSigned = (id: string) => signatures.some(s => s.placeholderId === id)
    const allSigned = placeholders.length > 0 && placeholders.every(p => isPlaceholderSigned(p.id))
    const lastSignatureImage = signatures.length > 0 ? signatures[signatures.length - 1].imageBase64 : null

    // ── Self-sign: submit signatures ──────────────────────────────────────────
    const handleSelfSignSubmit = async () => {
        setSubmitting(true)
        setError('')
        try {
            const res = await fetch(`/api/documents/${documentId}/self-sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatures }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? 'Submission failed')
            setStep(4) // success state
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Submission failed')
        } finally {
            setSubmitting(false)
        }
    }

    // ── Send for signing (request mode) ───────────────────────────────────────
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
            // If sender is priority-1 signer, redirect to sign immediately
            if (data.redirectUrl) {
                router.push(data.redirectUrl)
            } else {
                router.push(`/documents/${documentId}/status`)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send')
        } finally {
            setLoading(false)
        }
    }

    // ── Color for signer email ────────────────────────────────────────────────
    const getSignerColor = (email: string): string => {
        const allEmails = Array.from(new Set(placeholders.map(p => p.assignedSignerEmail).filter(Boolean)))
        const idx = allEmails.indexOf(email)
        return SIGNER_COLORS[Math.max(0, idx) % SIGNER_COLORS.length]
    }

    // ── Stepper config ────────────────────────────────────────────────────────
    const stepLabels = isSelfSign
        ? ['Upload', 'Placeholders', 'Sign']
        : ['Upload', 'Placeholders', 'Send']
    const totalSteps = 3

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
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-white flex items-center gap-2">
                            {isSelfSign ? <PenTool className="w-4 h-4 text-violet-400" /> : <Send className="w-4 h-4 text-sky-400" />}
                            {isSelfSign ? 'Self Sign' : 'Request Sign'} — New Document
                        </span>
                    </div>
                    {/* Stepper (hidden on success) */}
                    {step <= totalSteps && (
                        <div className="flex items-center gap-3">
                            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
                                <div key={s} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s
                                        ? (isSelfSign ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40' : 'bg-brand-600 text-white shadow-lg shadow-brand-900/40')
                                        : step > s ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                                        }`}>
                                        {step > s ? '✓' : s}
                                    </div>
                                    <span className={`text-xs hidden sm:block ${step === s ? 'text-white font-medium' : 'text-slate-500'}`}>
                                        {stepLabels[s - 1]}
                                    </span>
                                    {s < totalSteps && <div className={`w-8 h-px ${step > s ? 'bg-emerald-600' : 'bg-slate-700'}`} />}
                                </div>
                            ))}
                        </div>
                    )}
                    <ThemeToggle />
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
                        <p className="text-slate-400 text-sm mb-6">
                            Upload a PDF file (max 10MB) to {isSelfSign ? 'sign it yourself' : 'start the signing process'}.
                        </p>
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
                                    <FileText className="w-8 h-8 text-emerald-400 mx-auto" />
                                    <p className="text-white font-medium">{file.name}</p>
                                    <p className="text-slate-400 text-xs">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                    <button
                                        onClick={e => { e.stopPropagation(); setFile(null) }}
                                        className="text-red-400 text-xs hover:text-red-300 flex items-center gap-1 mx-auto"
                                    ><X className="w-3 h-3" /> Remove</button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Upload className="w-10 h-10 text-slate-500 mx-auto" />
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

                {/* ════════════════ STEP 2: PLACEHOLDERS (SIDEBAR LAYOUT) ════════════════ */}
                {step === 2 && (
                    <div className="animate-fade-in flex gap-5 items-start" style={{ minHeight: 'calc(100vh - 140px)' }}>
                        {/* ── Left Sidebar ── */}
                        <div className="w-72 shrink-0 space-y-4 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
                            <div>
                                <h2 className="text-lg font-bold text-white">
                                    {isSelfSign ? 'Place your signature fields' : 'Place signature fields'}
                                </h2>
                                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                                    {isSelfSign
                                        ? 'Click and drag on the PDF to place signature boxes.'
                                        : 'Click and drag on the PDF. Assign each placeholder to a signer.'}
                                </p>
                            </div>

                            {/* Self-sign: show who we're signing as */}
                            {isSelfSign && userEmail && (
                                <div className="card p-3 border-violet-500/20 bg-violet-500/5">
                                    <div className="flex items-center gap-2">
                                        <PenTool className="w-3.5 h-3.5 text-violet-400" />
                                        <span className="text-xs font-medium text-violet-300">Signing as:</span>
                                        <span className="text-xs text-white font-semibold">{userEmail}</span>
                                    </div>
                                </div>
                            )}

                            {/* Signer email inputs — only for request mode */}
                            {!isSelfSign && (
                                <div className="card p-3">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Signer Emails</p>
                                    <div className="space-y-2">
                                        {signerEmails.map((email, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SIGNER_COLORS[i % SIGNER_COLORS.length] }} />
                                                <input
                                                    type="email"
                                                    className="input text-xs py-1.5 flex-1"
                                                    placeholder={`signer${i + 1}@example.com`}
                                                    value={email}
                                                    onChange={e => {
                                                        const updated = [...signerEmails]
                                                        updated[i] = e.target.value
                                                        setSignerEmails(updated)
                                                    }}
                                                />
                                                {signerEmails.length > 1 && (
                                                    <button onClick={() => {
                                                        setSignerEmails(prev => prev.filter((_, j) => j !== i))
                                                        if (activeSignerIndex >= signerEmails.length - 1) setActiveSignerIndex(Math.max(0, signerEmails.length - 2))
                                                    }} className="text-red-400 hover:text-red-300 shrink-0">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setSignerEmails(prev => [...prev, ''])}
                                            className="btn-secondary text-xs px-2 py-1 w-full"
                                        ><Plus className="w-3 h-3 inline mr-1" /> Add Signer</button>
                                        {userEmail && !signerEmails.some(e => e.toLowerCase() === userEmail.toLowerCase()) && (
                                            <button
                                                onClick={() => setSignerEmails(prev => [...prev, userEmail])}
                                                className="text-xs px-2 py-1 w-full rounded-lg font-semibold transition-all bg-blue-600 hover:bg-blue-500 text-white"
                                            ><Plus className="w-3 h-3 inline mr-1" /> Add Me</button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Active signer selector (request mode only) */}
                            {
                                !isSelfSign && signerEmails.filter(e => e.trim() !== '').length > 1 && (
                                    <div className="card p-3">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Drawing for:</p>
                                        <div className="space-y-1">
                                            {signerEmails.map((email, i) => {
                                                if (!email.trim()) return null
                                                const isActive = activeSignerIndex === i
                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => setActiveSignerIndex(i)}
                                                        className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${isActive
                                                            ? 'border-white/30 text-white shadow-lg'
                                                            : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                                                            }`}
                                                        style={isActive ? { background: SIGNER_COLORS[i % SIGNER_COLORS.length] + '33' } : {}}
                                                    >
                                                        <div className="w-2 h-2 rounded-full" style={{ background: SIGNER_COLORS[i % SIGNER_COLORS.length] }} />
                                                        <span className="truncate">{email}</span>
                                                        {isActive && <Check className="w-3 h-3 ml-auto shrink-0" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            }

                            {/* Page navigation */}
                            {
                                pdfPages.length > 1 && (
                                    <div className="card p-3">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pages</p>
                                        <div className="flex flex-wrap gap-1">
                                            {pdfPages.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActivePage(i + 1)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${activePage === i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                                >{i + 1}</button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }

                            {/* Placeholder list */}
                            {
                                placeholders.length > 0 && (
                                    <div className="card p-3">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            {placeholders.length} Placeholder{placeholders.length !== 1 ? 's' : ''}
                                        </p>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {placeholders.map(p => (
                                                <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-slate-300 py-0.5">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getSignerColor(p.assignedSignerEmail) }} />
                                                    <span className="truncate flex-1">P{p.pageNumber} — {p.assignedSignerEmail || 'unassigned'}</span>
                                                    <button onClick={() => removePlaceholder(p.id)} className="text-red-400 hover:text-red-300 shrink-0">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }

                            {/* Action buttons */}
                            <div className="flex flex-col gap-2 pt-2">
                                <button onClick={handleSavePlaceholders} disabled={loading} className="btn-primary text-xs w-full">
                                    {loading ? 'Saving…' : (isSelfSign ? 'Save & Sign →' : 'Save & Continue →')}
                                </button>
                                <button onClick={() => setStep(1)} className="btn-secondary text-xs w-full">
                                    <ArrowLeft className="w-3 h-3 inline mr-1" /> Back
                                </button>
                            </div>
                        </div >

                        {/* ── Right: PDF Canvas ── */}
                        < div className="flex-1 min-w-0" >
                            <div
                                ref={pdfContainerRef}
                                className="relative inline-block border border-slate-700 rounded-xl overflow-hidden cursor-crosshair select-none w-full"
                                onMouseDown={handlePageMouseDown}
                                onMouseMove={handlePageMouseMove}
                                onMouseUp={handlePageMouseUp}
                                onMouseLeave={() => setIsDragging(false)}
                            >
                                {pdfPages[activePage - 1] && (
                                    <img src={pdfPages[activePage - 1]} alt={`Page ${activePage}`} className="w-full" draggable={false} />
                                )}

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
                                                {!isSelfSign && (
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
                                                )}
                                                <button
                                                    className="text-red-400 hover:text-red-300 bg-slate-800 rounded p-0.5"
                                                    onClick={e => { e.stopPropagation(); removePlaceholder(p.id) }}
                                                    onMouseDown={e => e.stopPropagation()}
                                                ><X className="w-3 h-3" /></button>
                                            </div>
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="text-[10px] font-medium opacity-60 flex items-center gap-1" style={{ color: getSignerColor(p.assignedSignerEmail) }}>
                                                    <PenTool className="w-2.5 h-2.5" /> {p.label}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div >
                    </div >
                )}

                {/* ════════════════ STEP 3 (SELF-SIGN): INLINE SIGNING ════════════════ */}
                {
                    step === 3 && isSelfSign && (
                        <div className="animate-fade-in">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Sign Your Document</h2>
                                    <p className="text-slate-400 text-sm mt-0.5">Click on each highlighted area to add your signature.</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <span>{signatures.length}/{placeholders.length} signed</span>
                                    <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-violet-500 transition-all"
                                            style={{ width: `${placeholders.length > 0 ? (signatures.length / placeholders.length) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Page navigation */}
                            {pdfPages.length > 1 && (
                                <div className="flex items-center gap-2 mb-4">
                                    {pdfPages.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActivePage(i + 1)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage === i + 1 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                        >Page {i + 1}</button>
                                    ))}
                                </div>
                            )}

                            {/* PDF with signing placeholders */}
                            <div className="relative inline-block border border-slate-700 rounded-xl overflow-hidden">
                                {pdfPages[activePage - 1] && (
                                    <img src={pdfPages[activePage - 1]} alt={`Page ${activePage}`} className="max-w-full" draggable={false} />
                                )}

                                {placeholders
                                    .filter(p => p.pageNumber === activePage)
                                    .map(p => {
                                        const signed = isPlaceholderSigned(p.id)
                                        const sig = signatures.find(s => s.placeholderId === p.id)
                                        const canReplicateHere = !signed && lastSignatureImage

                                        return (
                                            <div
                                                key={p.id}
                                                ref={el => { placeholderRefs.current[p.id] = el }}
                                                className={`absolute transition-all ${signed
                                                    ? 'border-2 border-emerald-500 bg-emerald-500/10'
                                                    : canReplicateHere
                                                        ? 'border-2 border-amber-400 bg-amber-500/10'
                                                        : 'border-2 border-violet-400 bg-violet-500/10 hover:bg-violet-500/20 animate-pulse-slow cursor-pointer'
                                                    }`}
                                                style={{
                                                    left: `${p.xPercent}%`,
                                                    top: `${p.yPercent}%`,
                                                    width: `${p.widthPercent}%`,
                                                    height: `${p.heightPercent}%`,
                                                }}
                                                onClick={() => {
                                                    if (!signed && !canReplicateHere) handlePlaceholderClick(p.id)
                                                }}
                                            >
                                                {signed && sig ? (
                                                    <img src={sig.imageBase64} alt="Signature" className="w-full h-full object-contain" />
                                                ) : canReplicateHere ? (
                                                    <div className="flex flex-col items-center justify-center h-full w-full gap-0.5 p-0.5">
                                                        <img
                                                            src={lastSignatureImage}
                                                            alt="Previous signature"
                                                            className="object-contain opacity-50"
                                                            style={{ maxHeight: '55%', maxWidth: '90%' }}
                                                        />
                                                        <div className="flex gap-1 flex-shrink-0">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleApplySame(p.id) }}
                                                                className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
                                                            >✓ Apply Same</button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handlePlaceholderClick(p.id) }}
                                                                className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-slate-600 hover:bg-slate-500 text-white transition-colors whitespace-nowrap"
                                                            >✎ Sign New</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full">
                                                        <span className="text-violet-400 text-[10px] font-medium">✍ Click to sign</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-3 mt-6">
                                <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary text-sm">
                                    ← Back
                                </button>
                                <div className="flex-1" />
                                <button
                                    onClick={handleSelfSignSubmit}
                                    disabled={!allSigned || submitting}
                                    className="btn-primary text-sm"
                                >
                                    {submitting ? 'Submitting…' : allSigned ? '✓ Finalize & Save' : `Sign all ${placeholders.length} fields first`}
                                </button>
                            </div>
                        </div>
                    )
                }

                {/* ════════════════ STEP 3 (REQUEST): SEND ════════════════ */}
                {
                    step === 3 && !isSelfSign && (
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
                                    <Info className="w-5 h-5 text-brand-400 shrink-0 mt-0.5" />
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
                                <button onClick={() => setStep(2)} className="btn-secondary flex-1"><ArrowLeft className="w-4 h-4 inline mr-1" /> Back</button>
                                <button onClick={handleSend} disabled={loading} className="btn-primary flex-1">
                                    {loading ? 'Sending…' : <><Send className="w-4 h-4 inline mr-1" /> Send for Signing</>}
                                </button>
                            </div>
                        </div>
                    )
                }

                {/* ════════════════ STEP 4 (SELF-SIGN): SUCCESS ════════════════ */}
                {
                    step === 4 && isSelfSign && (
                        <div className="max-w-md mx-auto text-center py-20 animate-fade-in">
                            <div className="text-6xl mb-4">🎉</div>
                            <h2 className="text-2xl font-bold text-white mb-2">Document Signed!</h2>
                            <p className="text-slate-400 text-sm mb-6">
                                Your signatures have been burned into the document. It&apos;s ready to download or share.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button
                                    onClick={() => {
                                        const a = document.createElement('a')
                                        a.href = `/api/documents/${documentId}/download`
                                        a.download = ''
                                        document.body.appendChild(a)
                                        a.click()
                                        document.body.removeChild(a)
                                    }}
                                    className="btn-primary text-sm"
                                >
                                    ⬇ Download Signed Document
                                </button>
                                <button
                                    onClick={() => router.push(`/documents/${documentId}/status`)}
                                    className="btn-secondary text-sm"
                                >
                                    View Status
                                </button>
                                <button
                                    onClick={() => router.push('/dashboard')}
                                    className="btn-secondary text-sm"
                                >
                                    ← Back to Dashboard
                                </button>
                            </div>
                        </div>
                    )
                }
            </main >

            {/* Signature modal (for self-sign step 3) */}
            < SignatureModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setActivePlaceholderId(null) }}
                onConfirm={handleSignatureConfirm}
            />
        </div >
    )
}
