'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import SignatureModal from '@/components/SignatureModal'
import ThemeToggle from '@/components/ThemeToggle'
import { AGREEMENT_CATEGORIES } from '@/lib/categories'
import {
    ArrowLeft, PenTool, Send, Upload, FileText, X, Check,
    ChevronUp, ChevronDown, Info, Plus, Trash2, GripVertical, Mail, User,
    Type, Calendar, Briefcase, GripHorizontal
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
    fieldType: 'signature' | 'name' | 'title' | 'designation' | 'date'
}

const FIELD_TYPES = [
    { type: 'signature' as const, label: 'Sign', icon: PenTool, w: 15, h: 4, color: '#4C00FF' },
    { type: 'name' as const, label: 'Name', icon: User, w: 15, h: 3, color: '#10b981' },
    { type: 'title' as const, label: 'Title', icon: Type, w: 12, h: 3, color: '#f59e0b' },
    { type: 'designation' as const, label: 'Designation', icon: Briefcase, w: 14, h: 3, color: '#8b5cf6' },
    { type: 'date' as const, label: 'Date', icon: Calendar, w: 10, h: 3, color: '#06b6d4' },
]

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
    const [isSelfSign, setIsSelfSign] = useState(false)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Current user email & name (for self-sign mode)
    const [userEmail, setUserEmail] = useState('')
    const [userName, setUserName] = useState('')

    // Drag-from-toolbar state
    const [draggingFieldType, setDraggingFieldType] = useState<string | null>(null)

    // Step 1: Upload
    const [file, setFile] = useState<File | null>(null)
    const [documentId, setDocumentId] = useState<string | null>(null)
    const [filePath, setFilePath] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)

    // Document preview state
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [previewPageCount, setPreviewPageCount] = useState(0)

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
    const [savedSignatureImage, setSavedSignatureImage] = useState<string | null>(null)

    // Envelope data (request mode)
    const [recipients, setRecipients] = useState<{ name: string; email: string }[]>([{ name: '', email: '' }])
    const [emailSubject, setEmailSubject] = useState('')
    const [emailMessage, setEmailMessage] = useState('')
    const [category, setCategory] = useState('')

    // ── Template prefill logic ──────────────────────────────────────────
    useEffect(() => {
        const templateId = searchParams.get('template')
        if (!templateId || isSelfSign) return
        const fetchTemplate = async () => {
            try {
                const res = await fetch(`/api/templates/${templateId}`)
                const data = await res.json()
                if (res.ok && data.template) {
                    const t = data.template
                    if (t.recipients && t.recipients.length > 0) {
                        setRecipients(t.recipients.map((r: { name: string; email: string }) => ({ name: r.name || '', email: r.email || '' })))
                    }
                    if (t.subject) setEmailSubject(t.subject)
                    if (t.message) setEmailMessage(t.message)
                    if (t.category) setCategory(t.category)
                }
            } catch { /* ignore */ }
        }
        fetchTemplate()
    }, [searchParams, isSelfSign])

    // Fetch user email on mount + restore saved profile
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) {
                setUserEmail(user.email)
            }
        }
        fetchUser()
        // Restore saved profile from localStorage
        try {
            const saved = localStorage.getItem('utilsign_user_profile')
            if (saved) {
                const profile = JSON.parse(saved)
                if (profile.name) setUserName(profile.name)
            }
        } catch { /* ignore */ }
        // Restore saved signature from localStorage
        try {
            const savedSig = localStorage.getItem('utilsign_saved_signature')
            if (savedSig) setSavedSignatureImage(savedSig)
        } catch { /* ignore */ }
    }, [])

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
        renderPDFPreview(f)
    }, [])

    // ── Render PDF preview (first page thumbnail) ─────────────────────────────
    const renderPDFPreview = async (pdfFile: File) => {
        try {
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
            const arrayBuffer = await pdfFile.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
            setPreviewPageCount(pdf.numPages)
            const page = await pdf.getPage(1)
            const viewport = page.getViewport({ scale: 0.8 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext('2d')!
            await page.render({ canvasContext: ctx, viewport }).promise
            setPreviewImage(canvas.toDataURL('image/png'))
        } catch {
            // Preview failed silently — upload will still work
        }
    }

    const handleUpload = async () => {
        if (!file) return
        setLoading(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', isSelfSign ? 'self_sign' : 'request_sign')
            if (category) formData.append('category', category)
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
            fieldType: 'signature',
        }
        setPlaceholders(prev => [...prev, newPh])
    }

    // ── Drop handler for dragging field from toolbar onto PDF ──────────────────
    const handleFieldDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const fieldTypeStr = e.dataTransfer.getData('text/plain')
        const fieldConfig = FIELD_TYPES.find(f => f.type === fieldTypeStr)
        if (!fieldConfig) return

        const rect = e.currentTarget.getBoundingClientRect()
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100

        // Clamp so field doesn't go off the PDF edge
        const clampedX = Math.min(xPercent, 100 - fieldConfig.w)
        const clampedY = Math.min(yPercent, 100 - fieldConfig.h)

        const currentEmail = isSelfSign
            ? userEmail
            : (signerEmails[activeSignerIndex]?.trim() || signerEmails.find(em => em.trim() !== '') || '')

        const newPh: Placeholder = {
            id: crypto.randomUUID(),
            pageNumber: activePage,
            xPercent: Math.max(0, clampedX),
            yPercent: Math.max(0, clampedY),
            widthPercent: fieldConfig.w,
            heightPercent: fieldConfig.h,
            label: fieldConfig.label,
            assignedSignerEmail: currentEmail,
            fieldType: fieldConfig.type,
        }
        setPlaceholders(prev => [...prev, newPh])
        setDraggingFieldType(null)
    }

    // ── Save user profile to localStorage ─────────────────────────────────────
    const saveUserProfile = (name: string) => {
        setUserName(name)
        try {
            localStorage.setItem('utilsign_user_profile', JSON.stringify({ name, email: userEmail }))
        } catch { /* ignore */ }
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
            if (!res.ok) {
                console.error('[save placeholders] API error:', { status: res.status, data, documentId })
                throw new Error(data.error ?? 'Failed to save placeholders')
            }

            if (isSelfSign) {
                // Move to inline signing step
                setStep(3)
            } else {
                // Build signers from recipients (preserving envelope priority order)
                const validRecipients = recipients.filter(r => r.email.trim())
                if (validRecipients.length === 0) {
                    setError('No signer emails found.')
                    setLoading(false)
                    return
                }
                setSigners(validRecipients.map((r, i) => ({
                    email: r.email.trim(),
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
        // Save signature permanently to localStorage
        setSavedSignatureImage(imageBase64)
        try { localStorage.setItem('utilsign_saved_signature', imageBase64) } catch { /* ignore */ }
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
        const sigImage = signatures.length > 0
            ? signatures[signatures.length - 1].imageBase64
            : savedSignatureImage
        if (!sigImage) return
        setSignatures(prev => {
            const filtered = prev.filter(s => s.placeholderId !== placeholderId)
            const updated = [...filtered, { placeholderId, imageBase64: sigImage }]
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
            // Build signer data with names from recipients
            const signerData = signers.map(s => {
                const recipient = recipients.find(r => r.email.trim().toLowerCase() === s.email.toLowerCase())
                return {
                    email: s.email,
                    name: recipient?.name || '',
                    priority: s.priority,
                }
            })
            const res = await fetch(`/api/documents/${documentId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signers: signerData,
                    subject: emailSubject || undefined,
                    message: emailMessage || undefined,
                }),
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
        ? ['Envelope', 'Placeholders', 'Sign']
        : ['Envelope', 'Placeholders', 'Send']
    const totalSteps = 3

    // ════════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/dashboard')} className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">{isSelfSign ? 'Self Sign' : 'Request Sign'}</span>
                            <span className="text-sm font-bold text-gray-900 leading-none flex items-center gap-2">
                                {isSelfSign ? <PenTool className="w-3.5 h-3.5 text-[#4C00FF]" /> : <Send className="w-3.5 h-3.5 text-[#4C00FF]" />}
                                {isSelfSign ? 'New Document' : 'New Envelope'}
                            </span>
                        </div>
                    </div>
                    {step <= totalSteps && (
                        <div className="flex items-center gap-3">
                            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
                                <div key={s} className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === s
                                        ? 'bg-[#4C00FF] text-gray-900 shadow-lg shadow-[#4C00FF]/20'
                                        : step > s ? 'bg-emerald-500 text-gray-900' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                        {step > s ? '\u2713' : s}
                                    </div>
                                    <span className={`text-xs hidden sm:block ${step === s ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                                        {stepLabels[s - 1]}
                                    </span>
                                    {s < totalSteps && <div className={`w-8 h-px ${step > s ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                                </div>
                            ))}
                        </div>
                    )}
                    <ThemeToggle />
                </div>
            </header>

            {/* Error */}
            {error && (
                <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-20">
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
                        {error}
                    </div>
                </div>
            )}

            <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">
                {/* ════════════════ STEP 1: UNIFIED ENVELOPE ════════════════ */}
                {step === 1 && (
                    <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">Create your envelope</h2>
                            <p className="text-gray-500 text-sm">Add your document, recipients, and an optional message.</p>
                        </div>

                        {/* ── Section 1: Add Document ── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-[#4C00FF]/10 border border-[#4C00FF]/20 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-[#4C00FF]" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Add Documents</h3>
                            </div>

                            {/* File already selected — show preview */}
                            {file && previewImage ? (
                                <div className="flex items-start gap-4">
                                    <div className="shrink-0 border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white" style={{ width: 140 }}>
                                        <img src={previewImage} alt="Document preview" className="w-full" draggable={false} />
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <p className="text-gray-900 font-medium text-sm truncate">{file.name}</p>
                                        <p className="text-gray-500 text-xs mt-0.5">{previewPageCount} page{previewPageCount !== 1 ? 's' : ''}</p>
                                        <button
                                            onClick={() => { setFile(null); setPreviewImage(null); setPreviewPageCount(0) }}
                                            className="flex items-center gap-1 mt-2 text-red-500 hover:text-red-700 text-xs font-medium transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" /> Remove
                                        </button>
                                    </div>
                                    {/* Drop zone to add more (or replace) */}
                                    <div
                                        className={`flex-1 p-6 border-2 border-dashed rounded-xl transition-all cursor-pointer text-center ${dragActive ? 'border-sky-500 bg-sky-500/5' : 'border-gray-200 hover:border-gray-300'}`}
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
                                        <Upload className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                                        <p className="text-gray-500 text-xs">Drop your files here or</p>
                                        <span className="inline-flex items-center gap-1 mt-2 px-4 py-1.5 rounded-lg bg-[#4C00FF] text-white text-xs font-semibold hover:bg-[#3D00CC] transition-colors">
                                            Upload <ChevronDown className="w-3 h-3" />
                                        </span>
                                    </div>
                                </div>
                            ) : file ? (
                                /* File selected but preview still loading */
                                <div
                                    className="p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer text-center border-emerald-500/40 bg-emerald-50"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
                                    />
                                    <div className="flex items-center justify-center gap-3">
                                        <FileText className="w-6 h-6 text-emerald-600" />
                                        <div className="text-left">
                                            <p className="text-gray-900 font-medium text-sm">{file.name}</p>
                                            <p className="text-gray-500 text-xs">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                        <button
                                            onClick={e => { e.stopPropagation(); setFile(null); setPreviewImage(null); setPreviewPageCount(0) }}
                                            className="text-red-600 hover:text-red-300 ml-2"
                                        ><X className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ) : (
                                /* No file selected — show drop zone */
                                <div
                                    className={`p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer text-center ${dragActive ? 'border-sky-500 bg-sky-500/5' : 'border-gray-200 hover:border-gray-300'}`}
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
                                    <div className="space-y-2">
                                        <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                                        <p className="text-gray-900 font-medium text-sm">Drop your PDF here</p>
                                        <p className="text-gray-400 text-xs">or click to browse · max 10MB</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Section 2: Add Recipients ── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-[#4C00FF]/15 border border-[#4C00FF]/20 flex items-center justify-center">
                                    <User className="w-4 h-4 text-[#4C00FF]" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Add Recipients</h3>
                            </div>

                            {/* I'm the only signer checkbox */}
                            <label className="flex items-center gap-2.5 cursor-pointer mb-4 py-2">
                                <input
                                    type="checkbox"
                                    checked={isSelfSign}
                                    onChange={(e) => {
                                        setIsSelfSign(e.target.checked)
                                        if (e.target.checked && userEmail) {
                                            setSignerEmails([userEmail])
                                        }
                                    }}
                                    className="w-[18px] h-[18px] rounded border-gray-300 text-[#4C00FF] accent-[#4C00FF] cursor-pointer"
                                />
                                <span className="text-sm font-medium text-gray-700">I&apos;m the only signer</span>
                                <Info className="w-3.5 h-3.5 text-gray-400" />
                            </label>

                            {/* Self-signer name field with auto-suggest */}
                            {isSelfSign && (
                                <div className="mt-3 p-3 rounded-xl bg-[#4C00FF]/5 border border-[#4C00FF]/10">
                                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Your Name</label>
                                    <input
                                        type="text"
                                        className="input text-sm py-2 w-full"
                                        placeholder="Enter your name"
                                        value={userName}
                                        onChange={(e) => saveUserProfile(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> Signing as {userEmail || 'your account email'}
                                    </p>
                                </div>
                            )}

                            {/* Recipient fields — hidden when self-sign */}
                            {!isSelfSign && (
                                <>
                                    <div className="space-y-3">
                                        {recipients.map((r, i) => (
                                            <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-gray-100/50 border border-gray-200/50">
                                                {/* Priority badge */}
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-gray-900 shrink-0" style={{ background: SIGNER_COLORS[i % SIGNER_COLORS.length] }}>
                                                    {i + 1}
                                                </div>
                                                {/* Name */}
                                                <input
                                                    type="text"
                                                    className="input text-sm py-1.5 flex-1 min-w-0"
                                                    placeholder="Name"
                                                    value={r.name}
                                                    onChange={e => {
                                                        const updated = [...recipients]
                                                        updated[i] = { ...updated[i], name: e.target.value }
                                                        setRecipients(updated)
                                                    }}
                                                />
                                                {/* Email */}
                                                <input
                                                    type="email"
                                                    className="input text-sm py-1.5 flex-1 min-w-0"
                                                    placeholder="email@example.com"
                                                    value={r.email}
                                                    onChange={e => {
                                                        const updated = [...recipients]
                                                        updated[i] = { ...updated[i], email: e.target.value }
                                                        setRecipients(updated)
                                                    }}
                                                />
                                                {/* Reorder */}
                                                <div className="flex flex-col gap-0.5 shrink-0">
                                                    <button
                                                        disabled={i === 0}
                                                        onClick={() => {
                                                            const updated = [...recipients]
                                                                ;[updated[i - 1], updated[i]] = [updated[i], updated[i - 1]]
                                                            setRecipients(updated)
                                                        }}
                                                        className="text-gray-400 hover:text-gray-900 disabled:opacity-20 text-[10px] leading-none"
                                                    >▲</button>
                                                    <button
                                                        disabled={i === recipients.length - 1}
                                                        onClick={() => {
                                                            const updated = [...recipients]
                                                                ;[updated[i], updated[i + 1]] = [updated[i + 1], updated[i]]
                                                            setRecipients(updated)
                                                        }}
                                                        className="text-gray-400 hover:text-gray-900 disabled:opacity-20 text-[10px] leading-none"
                                                    >▼</button>
                                                </div>
                                                {/* Remove */}
                                                {recipients.length > 1 && (
                                                    <button
                                                        onClick={() => setRecipients(prev => prev.filter((_, j) => j !== i))}
                                                        className="text-red-600 hover:text-red-300 shrink-0"
                                                    ><X className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => setRecipients(prev => [...prev, { name: '', email: '' }])}
                                            className="btn-secondary text-xs px-3 py-1.5"
                                        ><Plus className="w-3 h-3 inline mr-1" /> Add Recipient</button>
                                        {userEmail && !recipients.some(r => r.email.toLowerCase() === userEmail.toLowerCase()) && (
                                            <button
                                                onClick={() => setRecipients(prev => [...prev, { name: userEmail.split('@')[0], email: userEmail }])}
                                                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all bg-[#4C00FF] hover:bg-[#3C00CC] text-white shadow-sm"
                                            ><Plus className="w-3 h-3 inline mr-1" /> Add Me</button>
                                        )}
                                    </div>
                                    <p className="text-gray-400 text-[11px] mt-3 flex items-center gap-1">
                                        <Info className="w-3 h-3" /> Priority order determines who signs first. Drag or use arrows to reorder.
                                    </p>
                                </>
                            )}
                        </div>

                        {/* ── Section 3: Add Message ── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-amber-600/15 border border-amber-500/20 flex items-center justify-center">
                                    <Mail className="w-4 h-4 text-amber-400" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Add Message</h3>
                                <span className="text-gray-400 text-[10px] ml-1">(optional)</span>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Subject</label>
                                    <input
                                        type="text"
                                        className="input text-sm"
                                        placeholder={`Please sign: ${file?.name || 'your document'}`}
                                        value={emailSubject}
                                        onChange={e => setEmailSubject(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Message</label>
                                    <textarea
                                        className="input text-sm min-h-[80px] resize-y"
                                        placeholder="Add a personal message to your recipients (optional)"
                                        value={emailMessage}
                                        onChange={e => setEmailMessage(e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Section 4: Category ── */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-lg bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-emerald-600" />
                                </div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Category</h3>
                                <span className="text-gray-400 text-[10px] ml-1">(optional)</span>
                            </div>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="input text-sm w-full appearance-none"
                            >
                                <option value="">— Select a category —</option>
                                {AGREEMENT_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Next button */}
                        <button
                            onClick={async () => {
                                // Validate
                                if (!file) { setError('Please add a document.'); return }
                                if (isSelfSign) {
                                    // Self-sign: set signer as current user, skip recipient validation
                                    setSignerEmails([userEmail])
                                } else {
                                    const validRecipients = recipients.filter(r => r.email.trim())
                                    if (validRecipients.length === 0) { setError('Add at least one recipient with an email address.'); return }
                                    // Populate signerEmails from recipients (order = priority)
                                    setSignerEmails(validRecipients.map(r => r.email.trim()))
                                }
                                // Set default subject if empty
                                if (!emailSubject.trim()) {
                                    setEmailSubject(`Please sign: ${file.name}`)
                                }
                                // Upload the file
                                await handleUpload()
                            }}
                            disabled={!file || loading}
                            className="btn-primary w-full"
                        >
                            {loading ? 'Uploading…' : 'Next →'}
                        </button>
                    </div>
                )}

                {/* ════════════════ STEP 2: PLACEHOLDERS (SIDEBAR LAYOUT) ════════════════ */}
                {step === 2 && (
                    <div className="animate-fade-in flex gap-5 items-start" style={{ minHeight: 'calc(100vh - 140px)' }}>
                        {/* ── Left Sidebar ── */}
                        <div className="w-72 shrink-0 space-y-4 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {isSelfSign ? 'Place your signature fields' : 'Place signature fields'}
                                </h2>
                                <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                                    {isSelfSign
                                        ? 'Drag the Sign field from the toolbar below onto the PDF, or click and drag directly.'
                                        : 'Drag fields from the toolbar below onto the PDF. Assign each field to a signer.'}
                                </p>
                            </div>

                            {/* ── Draggable Fields Toolbar ── */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Fields</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(isSelfSign ? FIELD_TYPES.filter(f => f.type === 'signature') : FIELD_TYPES).map(field => (
                                        <div
                                            key={field.type}
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('text/plain', field.type)
                                                setDraggingFieldType(field.type)
                                            }}
                                            onDragEnd={() => setDraggingFieldType(null)}
                                            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium cursor-grab active:cursor-grabbing border transition-all select-none ${draggingFieldType === field.type
                                                ? 'border-[#4C00FF] bg-[#4C00FF]/10 shadow-sm'
                                                : 'border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100'
                                                }`}
                                        >
                                            <GripHorizontal className="w-3 h-3 text-gray-400 shrink-0" />
                                            <field.icon className="w-3.5 h-3.5 shrink-0" style={{ color: field.color }} />
                                            <span className="text-gray-700">{field.label}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-gray-400 text-[10px] mt-2 flex items-center gap-1">
                                    <GripHorizontal className="w-3 h-3" /> Drag onto the document to place
                                </p>
                            </div>

                            {/* Self-sign: show who we're signing as */}
                            {isSelfSign && userEmail && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 border-[#4C00FF]/20 bg-[#4C00FF]/5">
                                    <div className="flex items-center gap-2">
                                        <PenTool className="w-3.5 h-3.5 text-[#4C00FF]" />
                                        <span className="text-xs font-medium text-[#4C00FF]">Signing as:</span>
                                        <span className="text-xs text-gray-900 font-semibold">{userEmail}</span>
                                    </div>
                                </div>
                            )}

                            {/* Recipients list — read-only for request mode (set in Step 1) */}
                            {!isSelfSign && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Recipients</p>
                                    <div className="space-y-1.5">
                                        {signerEmails.filter(Boolean).map((email, i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SIGNER_COLORS[i % SIGNER_COLORS.length] }} />
                                                <span className="text-xs text-gray-600 truncate">{email}</span>
                                                <span className="text-[10px] text-slate-600 ml-auto shrink-0">#{i + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Active signer selector (request mode only) */}
                            {
                                !isSelfSign && signerEmails.filter(e => e.trim() !== '').length > 1 && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Drawing for:</p>
                                        <div className="space-y-1">
                                            {signerEmails.map((email, i) => {
                                                if (!email.trim()) return null
                                                const isActive = activeSignerIndex === i
                                                return (
                                                    <button
                                                        key={i}
                                                        onClick={() => setActiveSignerIndex(i)}
                                                        className={`flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${isActive
                                                            ? 'border-[#4C00FF]/20 text-gray-900 shadow-sm'
                                                            : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-900'
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
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pages</p>
                                        <div className="flex flex-wrap gap-1">
                                            {pdfPages.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActivePage(i + 1)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage === i + 1 ? 'bg-[#4C00FF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                >{i + 1}</button>
                                            ))}
                                        </div>
                                    </div>
                                )
                            }

                            {/* Placeholder list */}
                            {
                                placeholders.length > 0 && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                            {placeholders.length} Placeholder{placeholders.length !== 1 ? 's' : ''}
                                        </p>
                                        <div className="space-y-1 max-h-40 overflow-y-auto">
                                            {placeholders.map(p => {
                                                const fc = FIELD_TYPES.find(f => f.type === p.fieldType)
                                                return (
                                                    <div key={p.id} className="flex items-center gap-1.5 text-[11px] text-gray-600 py-0.5">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: getSignerColor(p.assignedSignerEmail) }} />
                                                        <span className="truncate flex-1">{fc?.label || p.label} — P{p.pageNumber}</span>
                                                        <button onClick={() => removePlaceholder(p.id)} className="text-red-600 hover:text-red-300 shrink-0">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            }

                            {/* Saved signature — drag to sign (self-sign only) */}
                            {isSelfSign && savedSignatureImage && (
                                <div className="bg-white rounded-2xl border border-[#4C00FF]/20 shadow-sm p-3">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Your Saved Signature</p>
                                    <div
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('application/signature', savedSignatureImage)
                                            e.dataTransfer.effectAllowed = 'copy'
                                        }}
                                        className="border-2 border-dashed border-[#4C00FF]/30 rounded-lg p-2 cursor-grab active:cursor-grabbing hover:border-[#4C00FF]/60 hover:bg-[#4C00FF]/5 transition-all flex flex-col items-center gap-1.5"
                                    >
                                        <img src={savedSignatureImage} alt="Your signature" className="max-h-12 object-contain" draggable={false} />
                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                            <GripHorizontal className="w-3 h-3" /> Drag onto a Sign field
                                        </span>
                                    </div>
                                    {placeholders.length > 0 && placeholders.some(p => !isPlaceholderSigned(p.id)) && (
                                        <button
                                            onClick={() => {
                                                const unsigned = placeholders.filter(p => !isPlaceholderSigned(p.id))
                                                setSignatures(prev => [
                                                    ...prev,
                                                    ...unsigned.map(p => ({ placeholderId: p.id, imageBase64: savedSignatureImage }))
                                                ])
                                            }}
                                            className="w-full mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#4C00FF] text-white hover:bg-[#3D00CC] transition-colors"
                                        >
                                            ✓ Sign All ({placeholders.filter(p => !isPlaceholderSigned(p.id)).length} remaining)
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-col gap-2 pt-2">
                                {isSelfSign && placeholders.length > 0 && allSigned ? (
                                    <button
                                        onClick={async () => {
                                            await handleSavePlaceholders()
                                            // handleSavePlaceholders moves to step 3, but since all signed we submit right away
                                        }}
                                        disabled={loading || submitting}
                                        className="btn-primary text-xs w-full"
                                    >
                                        {loading ? 'Saving…' : '✓ Finalize & Save'}
                                    </button>
                                ) : (
                                    <button onClick={handleSavePlaceholders} disabled={loading} className="btn-primary text-xs w-full">
                                        {loading ? 'Saving…' : (isSelfSign ? 'Save & Sign →' : 'Save & Continue →')}
                                    </button>
                                )}
                                <button onClick={() => setStep(1)} className="btn-secondary text-xs w-full">
                                    <ArrowLeft className="w-3 h-3 inline mr-1" /> Back
                                </button>
                            </div>
                        </div >

                        {/* ── Right: PDF Canvas ── */}
                        < div className="flex-1 min-w-0" >
                            <div
                                ref={pdfContainerRef}
                                className={`relative inline-block border rounded-xl overflow-hidden cursor-crosshair select-none w-full transition-colors ${draggingFieldType ? 'border-[#4C00FF] border-2 bg-[#4C00FF]/[0.02]' : 'border-gray-200'}`}
                                onMouseDown={handlePageMouseDown}
                                onMouseMove={handlePageMouseMove}
                                onMouseUp={handlePageMouseUp}
                                onMouseLeave={() => setIsDragging(false)}
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                                onDrop={(e) => {
                                    // Handle signature drops (self-sign)
                                    const sigData = e.dataTransfer.getData('application/signature')
                                    if (sigData && isSelfSign) {
                                        e.preventDefault()
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        const dropX = ((e.clientX - rect.left) / rect.width) * 100
                                        const dropY = ((e.clientY - rect.top) / rect.height) * 100
                                        const target = placeholders
                                            .filter(p => p.pageNumber === activePage && !isPlaceholderSigned(p.id))
                                            .find(p =>
                                                dropX >= p.xPercent && dropX <= p.xPercent + p.widthPercent &&
                                                dropY >= p.yPercent && dropY <= p.yPercent + p.heightPercent
                                            )
                                        if (target) {
                                            setSignatures(prev => [...prev.filter(s => s.placeholderId !== target.id), { placeholderId: target.id, imageBase64: sigData }])
                                        }
                                        return
                                    }
                                    // Handle field type drops
                                    handleFieldDrop(e)
                                }}
                            >
                                {pdfPages[activePage - 1] && (
                                    <img src={pdfPages[activePage - 1]} alt={`Page ${activePage}`} className="w-full" draggable={false} />
                                )}

                                {isDragging && (
                                    <div
                                        className="absolute border-2 border-brand-400 bg-[#4C00FF]/10 pointer-events-none"
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
                                    .map(p => {
                                        const signed = isSelfSign && isPlaceholderSigned(p.id)
                                        const sig = isSelfSign ? signatures.find(s => s.placeholderId === p.id) : null
                                        return (
                                            <div
                                                key={p.id}
                                                className={`placeholder-box absolute group ${signed ? 'border-2 border-emerald-500 bg-emerald-500/10' : ''}`}
                                                style={{
                                                    left: `${p.xPercent}%`,
                                                    top: `${p.yPercent}%`,
                                                    width: `${p.widthPercent}%`,
                                                    height: `${p.heightPercent}%`,
                                                    ...(!signed ? { border: `2px solid ${getSignerColor(p.assignedSignerEmail)}`, background: `${getSignerColor(p.assignedSignerEmail)}15` } : {}),
                                                }}
                                            >
                                                {signed && sig ? (
                                                    <img src={sig.imageBase64} alt="Signed" className="w-full h-full object-contain" />
                                                ) : (
                                                    <>
                                                        <div className="absolute -top-7 left-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1" style={{ zIndex: 50 }}>
                                                            {!isSelfSign && (
                                                                <select
                                                                    className="text-[10px] bg-gray-100 text-gray-900 rounded px-1 py-0.5 border border-gray-300"
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
                                                                className="text-red-600 hover:text-red-300 bg-gray-100 rounded p-0.5"
                                                                onClick={e => { e.stopPropagation(); removePlaceholder(p.id) }}
                                                                onMouseDown={e => e.stopPropagation()}
                                                            ><X className="w-3 h-3" /></button>
                                                        </div>
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <span className="text-[10px] font-medium opacity-70 flex items-center gap-1" style={{ color: getSignerColor(p.assignedSignerEmail) }}>
                                                                {(() => { const fc = FIELD_TYPES.find(f => f.type === p.fieldType); return fc ? <><fc.icon className="w-2.5 h-2.5" /> {fc.label}</> : <><PenTool className="w-2.5 h-2.5" /> {p.label}</> })()}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )
                                    })}
                            </div>
                        </div >
                    </div >
                )
                }

                {/* ════════════════ STEP 3 (SELF-SIGN): INLINE SIGNING ════════════════ */}
                {
                    step === 3 && isSelfSign && (
                        <div className="animate-fade-in flex gap-5 items-start" style={{ minHeight: 'calc(100vh - 140px)' }}>
                            {/* ── Left Sidebar ── */}
                            <div className="w-72 shrink-0 space-y-4 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Sign Your Document</h2>
                                    <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                                        {savedSignatureImage
                                            ? 'Drag your saved signature onto each field, or click a field to sign.'
                                            : 'Click on each highlighted area to add your signature.'}
                                    </p>
                                </div>

                                {/* Progress */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                        <span>{signatures.length}/{placeholders.length} signed</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-violet-500 transition-all"
                                            style={{ width: `${placeholders.length > 0 ? (signatures.length / placeholders.length) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Saved signature — draggable */}
                                {savedSignatureImage && (
                                    <div className="bg-white rounded-2xl border border-[#4C00FF]/20 shadow-sm p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Your Saved Signature</p>
                                        <div
                                            draggable
                                            onDragStart={(e) => {
                                                e.dataTransfer.setData('application/signature', savedSignatureImage)
                                                e.dataTransfer.effectAllowed = 'copy'
                                            }}
                                            className="border-2 border-dashed border-[#4C00FF]/30 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-[#4C00FF]/60 hover:bg-[#4C00FF]/5 transition-all flex flex-col items-center gap-2"
                                        >
                                            <img src={savedSignatureImage} alt="Your signature" className="max-h-16 object-contain" draggable={false} />
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <GripHorizontal className="w-3 h-3" /> Drag onto a field
                                            </span>
                                        </div>
                                        {/* Apply to all unsigned */}
                                        {placeholders.some(p => !isPlaceholderSigned(p.id)) && (
                                            <button
                                                onClick={() => {
                                                    const unsigned = placeholders.filter(p => !isPlaceholderSigned(p.id))
                                                    setSignatures(prev => [
                                                        ...prev,
                                                        ...unsigned.map(p => ({ placeholderId: p.id, imageBase64: savedSignatureImage }))
                                                    ])
                                                }}
                                                className="w-full mt-2 px-3 py-2 rounded-lg text-xs font-semibold bg-[#4C00FF] text-white hover:bg-[#3D00CC] transition-colors"
                                            >
                                                ✓ Apply to All ({placeholders.filter(p => !isPlaceholderSigned(p.id)).length} remaining)
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Page navigation */}
                                {pdfPages.length > 1 && (
                                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Pages</p>
                                        <div className="flex flex-wrap gap-1">
                                            {pdfPages.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActivePage(i + 1)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage === i + 1 ? 'bg-[#4C00FF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                >{i + 1}</button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-col gap-2 pt-2">
                                    <button
                                        onClick={handleSelfSignSubmit}
                                        disabled={!allSigned || submitting}
                                        className="btn-primary text-xs w-full"
                                    >
                                        {submitting ? 'Submitting…' : allSigned ? '✓ Finalize & Save' : `Sign all ${placeholders.length} fields first`}
                                    </button>
                                    <button onClick={() => setStep(2)} disabled={submitting} className="btn-secondary text-xs w-full">
                                        <ArrowLeft className="w-3 h-3 inline mr-1" /> Back
                                    </button>
                                </div>
                            </div>

                            {/* ── Right: PDF Canvas ── */}
                            <div className="flex-1 min-w-0">
                                <div
                                    className="relative inline-block border border-gray-200 rounded-xl overflow-hidden w-full"
                                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        const sigData = e.dataTransfer.getData('application/signature')
                                        if (!sigData) return
                                        // Find which placeholder we dropped onto
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        const dropX = ((e.clientX - rect.left) / rect.width) * 100
                                        const dropY = ((e.clientY - rect.top) / rect.height) * 100
                                        const target = placeholders
                                            .filter(p => p.pageNumber === activePage && !isPlaceholderSigned(p.id))
                                            .find(p =>
                                                dropX >= p.xPercent && dropX <= p.xPercent + p.widthPercent &&
                                                dropY >= p.yPercent && dropY <= p.yPercent + p.heightPercent
                                            )
                                        if (target) {
                                            setSignatures(prev => [...prev.filter(s => s.placeholderId !== target.id), { placeholderId: target.id, imageBase64: sigData }])
                                        }
                                    }}
                                >
                                    {pdfPages[activePage - 1] && (
                                        <img src={pdfPages[activePage - 1]} alt={`Page ${activePage}`} className="w-full" draggable={false} />
                                    )}

                                    {placeholders
                                        .filter(p => p.pageNumber === activePage)
                                        .map(p => {
                                            const signed = isPlaceholderSigned(p.id)
                                            const sig = signatures.find(s => s.placeholderId === p.id)
                                            const canReplicateHere = !signed && (lastSignatureImage || savedSignatureImage)
                                            const replicateImage = lastSignatureImage || savedSignatureImage

                                            return (
                                                <div
                                                    key={p.id}
                                                    ref={el => { placeholderRefs.current[p.id] = el }}
                                                    className={`absolute transition-all ${signed
                                                        ? 'border-2 border-emerald-500 bg-emerald-500/10'
                                                        : canReplicateHere
                                                            ? 'border-2 border-amber-500 bg-amber-50 cursor-pointer'
                                                            : 'border-2 border-[#4C00FF] bg-[#4C00FF]/5 hover:bg-[#4C00FF]/10 animate-pulse-slow cursor-pointer'
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
                                                                src={replicateImage!}
                                                                alt="Previous signature"
                                                                className="object-contain opacity-50"
                                                                style={{ maxHeight: '55%', maxWidth: '90%' }}
                                                            />
                                                            <div className="flex gap-1 flex-shrink-0">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleApplySame(p.id) }}
                                                                    className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
                                                                >✓ Apply</button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handlePlaceholderClick(p.id) }}
                                                                    className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-gray-600 hover:bg-gray-500 text-white transition-colors whitespace-nowrap"
                                                                >✎ New</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center h-full">
                                                            <span className="text-[#4C00FF] text-[10px] font-medium">✍ Click to sign</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* ════════════════ STEP 3 (REQUEST): SEND ════════════════ */}
                {
                    step === 3 && !isSelfSign && (
                        <div className="max-w-xl mx-auto animate-fade-in">
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Review &amp; Send</h2>
                            <p className="text-gray-500 text-sm mb-6">Review your envelope details and send for signing.</p>

                            {/* Signing order (read-only) */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase">Signing Order</p>
                                {signers.map((s, i) => {
                                    const recipient = recipients.find(r => r.email.trim().toLowerCase() === s.email.toLowerCase())
                                    return (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-100/50 border border-gray-200/50">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-gray-900" style={{ background: s.color }}>
                                                {s.priority}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {recipient?.name && (
                                                    <p className="text-sm text-gray-900 font-medium truncate">{recipient.name}</p>
                                                )}
                                                <p className="text-xs text-gray-500 truncate">{s.email}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Email preview */}
                            {(emailSubject || emailMessage) && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-4">
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Email Preview</p>
                                    {emailSubject && (
                                        <div className="mb-2">
                                            <span className="text-[10px] text-gray-400 uppercase">Subject:</span>
                                            <p className="text-sm text-gray-900">{emailSubject}</p>
                                        </div>
                                    )}
                                    {emailMessage && (
                                        <div>
                                            <span className="text-[10px] text-gray-400 uppercase">Message:</span>
                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{emailMessage}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4 border-[#4C00FF]/20 bg-[#4C00FF]/5">
                                <div className="flex items-start gap-3">
                                    <Info className="w-5 h-5 text-[#4C00FF] shrink-0 mt-0.5" />
                                    <div className="text-sm text-gray-600">
                                        <p className="font-medium text-gray-900 mb-1">Priority-based signing</p>
                                        <p className="text-gray-500 text-xs leading-relaxed">
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Signed!</h2>
                            <p className="text-gray-500 text-sm mb-6">
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
