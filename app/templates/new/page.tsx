'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback } from 'react'
import {
    ArrowLeft, Upload, Plus, X, ChevronUp, ChevronDown,
    Mail, User, FileText, Save, Info, PenTool, Type,
    Calendar, Briefcase, Trash2, GripHorizontal, ChevronRight
} from 'lucide-react'
import { AGREEMENT_CATEGORIES } from '@/lib/categories'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Recipient {
    name: string
    email: string
    priority: number
}

interface TemplatePlaceholder {
    id: string
    pageNumber: number
    xPercent: number
    yPercent: number
    widthPercent: number
    heightPercent: number
    label: string
    fieldType: 'signature' | 'name' | 'title' | 'designation' | 'date'
    signerIndex: number
}

const FIELD_TYPES = [
    { type: 'signature' as const, label: 'Sign', icon: PenTool, w: 15, h: 4, color: '#4C00FF' },
    { type: 'name' as const, label: 'Name', icon: User, w: 15, h: 3, color: '#10b981' },
    { type: 'title' as const, label: 'Title', icon: Type, w: 12, h: 3, color: '#f59e0b' },
    { type: 'designation' as const, label: 'Designation', icon: Briefcase, w: 14, h: 3, color: '#8b5cf6' },
    { type: 'date' as const, label: 'Date', icon: Calendar, w: 10, h: 3, color: '#06b6d4' },
]

const SIGNER_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
]

// ─── Component ───────────────────────────────────────────────────────────────
export default function NewTemplatePage() {
    const router = useRouter()
    const [step, setStep] = useState(1)

    // Step 1 state
    const [templateName, setTemplateName] = useState('')
    const [templateDescription, setTemplateDescription] = useState('')
    const [category, setCategory] = useState('')
    const [recipients, setRecipients] = useState<Recipient[]>([{ name: '', email: '', priority: 1 }])
    const [emailSubject, setEmailSubject] = useState('')
    const [emailMessage, setEmailMessage] = useState('')

    // Document
    const [file, setFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [dragActive, setDragActive] = useState(false)

    // Step 2 state — PDF rendering & placeholders
    const [pdfPages, setPdfPages] = useState<string[]>([])
    const [activePage, setActivePage] = useState(1)
    const [placeholders, setPlaceholders] = useState<TemplatePlaceholder[]>([])
    const [activeSignerIndex, setActiveSignerIndex] = useState(0)
    const pdfContainerRef = useRef<HTMLDivElement>(null)
    const [draggingFieldType, setDraggingFieldType] = useState<string | null>(null)

    // Drag-create state
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [dragCurrent, setDragCurrent] = useState({ x: 0, y: 0 })

    // Resize state
    const [resizingId, setResizingId] = useState<string | null>(null)
    const resizeStartRef = useRef<{ mouseX: number; mouseY: number; w: number; h: number } | null>(null)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // ── File handling ─────────────────────────────────────────────────────────
    const handleFile = useCallback((f: File) => {
        setError('')
        if (f.type !== 'application/pdf') { setError('Only PDF files are accepted.'); return }
        if (f.size > 10 * 1024 * 1024) { setError('File must be 10MB or smaller.'); return }
        setFile(f)
    }, [])

    // ── Recipients ────────────────────────────────────────────────────────────
    const addRecipient = () => {
        setRecipients(prev => [...prev, { name: '', email: '', priority: prev.length + 1 }])
    }

    const removeRecipient = (idx: number) => {
        setRecipients(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, priority: i + 1 })))
        // Remove placeholders assigned to this signer
        setPlaceholders(prev => prev.filter(p => p.signerIndex !== idx).map(p => ({
            ...p,
            signerIndex: p.signerIndex > idx ? p.signerIndex - 1 : p.signerIndex,
        })))
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

    // ── PDF Rendering ─────────────────────────────────────────────────────────
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

    // ── Step 1 → Step 2 ──────────────────────────────────────────────────────
    const handleGoToStep2 = async () => {
        if (!templateName.trim()) { setError('Template name is required.'); return }
        if (!file) { setError('Please upload a PDF document.'); return }
        setError('')
        setLoading(true)
        try {
            await renderPDF(file)
            setStep(2)
        } catch {
            setError('Failed to render PDF. Please try a different file.')
        } finally {
            setLoading(false)
        }
    }

    // ── Placeholder drag creation ─────────────────────────────────────────────
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

        const newPh: TemplatePlaceholder = {
            id: crypto.randomUUID(),
            pageNumber: activePage,
            xPercent,
            yPercent,
            widthPercent,
            heightPercent,
            label: `Signature ${placeholders.length + 1}`,
            fieldType: 'signature',
            signerIndex: activeSignerIndex,
        }
        setPlaceholders(prev => [...prev, newPh])
    }

    // ── Drop handler: drag field from toolbar ─────────────────────────────────
    const handleFieldDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        const fieldTypeStr = e.dataTransfer.getData('text/plain')
        const fieldConfig = FIELD_TYPES.find(f => f.type === fieldTypeStr)
        if (!fieldConfig) return

        const rect = e.currentTarget.getBoundingClientRect()
        const xPercent = ((e.clientX - rect.left) / rect.width) * 100
        const yPercent = ((e.clientY - rect.top) / rect.height) * 100

        const clampedX = Math.min(xPercent, 100 - fieldConfig.w)
        const clampedY = Math.min(yPercent, 100 - fieldConfig.h)

        const newPh: TemplatePlaceholder = {
            id: crypto.randomUUID(),
            pageNumber: activePage,
            xPercent: Math.max(0, clampedX),
            yPercent: Math.max(0, clampedY),
            widthPercent: fieldConfig.w,
            heightPercent: fieldConfig.h,
            label: fieldConfig.label,
            fieldType: fieldConfig.type,
            signerIndex: activeSignerIndex,
        }
        setPlaceholders(prev => [...prev, newPh])
        setDraggingFieldType(null)
    }

    // ── Resize placeholder ────────────────────────────────────────────────────
    const handleResizeMouseDown = (e: React.MouseEvent, phId: string) => {
        e.stopPropagation()
        e.preventDefault()
        const ph = placeholders.find(p => p.id === phId)
        if (!ph) return
        setResizingId(phId)
        resizeStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, w: ph.widthPercent, h: ph.heightPercent }

        const container = pdfContainerRef.current
        if (!container) return
        const containerRect = container.getBoundingClientRect()

        const onMouseMove = (ev: MouseEvent) => {
            if (!resizeStartRef.current) return
            const dxPct = ((ev.clientX - resizeStartRef.current.mouseX) / containerRect.width) * 100
            const dyPct = ((ev.clientY - resizeStartRef.current.mouseY) / containerRect.height) * 100
            const newW = Math.max(5, resizeStartRef.current.w + dxPct)
            const newH = Math.max(2, resizeStartRef.current.h + dyPct)
            setPlaceholders(prev => prev.map(p =>
                p.id === phId ? { ...p, widthPercent: Math.min(newW, 100 - p.xPercent), heightPercent: Math.min(newH, 100 - p.yPercent) } : p
            ))
        }
        const onMouseUp = () => {
            setResizingId(null)
            resizeStartRef.current = null
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
    }

    const removePlaceholder = (id: string) => {
        setPlaceholders(prev => prev.filter(p => p.id !== id))
    }

    // ── Save Template ─────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (placeholders.length === 0) {
            setError('Place at least one placeholder on the document.')
            return
        }
        setLoading(true)
        setError('')

        try {
            // 1) Upload the file
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

            const validRecipients = recipients.filter(r => r.name.trim() || r.email.trim())

            // 2) Create the template with placeholders
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
                    placeholders: placeholders.map(p => ({
                        pageNumber: p.pageNumber,
                        xPercent: p.xPercent,
                        yPercent: p.yPercent,
                        widthPercent: p.widthPercent,
                        heightPercent: p.heightPercent,
                        label: p.label,
                        fieldType: p.fieldType,
                        signerIndex: p.signerIndex,
                    })),
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

    // ── Color for signer ──────────────────────────────────────────────────────
    const getSignerColor = (signerIndex: number): string => {
        return SIGNER_COLORS[signerIndex % SIGNER_COLORS.length]
    }

    const currentPagePlaceholders = placeholders.filter(p => p.pageNumber === activePage)

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => step === 2 ? setStep(1) : router.push('/templates')}
                            className="p-2 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Template</span>
                            <h1 className="text-sm font-bold text-gray-900 leading-none">{templateName || 'New Template'}</h1>
                        </div>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-3">
                        {['Envelope', 'Placeholders'].map((label, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step === i + 1
                                    ? 'bg-[#4C00FF] text-white shadow-lg shadow-[#4C00FF]/20'
                                    : step > i + 1 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                                    }`}>
                                    {step > i + 1 ? '✓' : i + 1}
                                </div>
                                <span className={`text-xs hidden sm:block ${step === i + 1 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                                    {label}
                                </span>
                                {i < 1 && <div className={`w-8 h-px ${step > i + 1 ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
                            </div>
                        ))}
                    </div>

                    {step === 2 ? (
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
                    ) : (
                        <div className="w-32" /> /* spacer */
                    )}
                </div>
            </header>

            {/* ── Error ────────────────────────────────────────────────────── */}
            {error && (
                <div className="max-w-3xl mx-auto px-6 mt-4">
                    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 flex items-center gap-2 animate-fade-in">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                </div>
            )}

            {/* ═══════════ STEP 1: ENVELOPE ═══════════ */}
            {step === 1 && (
                <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
                    {/* Section 1: Template Info */}
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
                                <select value={category} onChange={e => setCategory(e.target.value)} className="input appearance-none">
                                    <option value="">— Select Category —</option>
                                    {AGREEMENT_CATEGORIES.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Document Upload (Required) */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                <Upload className="w-4 h-4 text-indigo-600" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Add Document</h3>
                            <span className="text-red-500 text-xs ml-1">*</span>
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
                                className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${dragActive ? 'border-[#4C00FF] bg-[#4C00FF]/5' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}`}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm text-gray-500 font-medium">Drop your PDF here, or <span className="text-[#4C00FF] hover:underline">browse files</span></p>
                                <p className="text-xs text-gray-400 mt-1">Maximum file size: 10MB</p>
                                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
                            </div>
                        )}
                    </div>

                    {/* Section 3: Recipients */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <User className="w-4 h-4 text-emerald-600" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Signer Roles</h3>
                        </div>

                        <div className="space-y-3">
                            {recipients.map((r, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                                    <span
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                        style={{ background: getSignerColor(idx) }}
                                    >
                                        {r.priority}
                                    </span>
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <input
                                            placeholder="Role or Name (e.g. Signer 1)"
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
                                        <button onClick={() => removeRecipient(idx)} className="p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <button onClick={addRecipient} className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all">
                            <Plus className="w-3.5 h-3.5" /> Add Signer Role
                        </button>

                        <p className="text-gray-400 text-[11px] mt-4 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5" />
                            Define signer roles here. Emails can be filled in when you use the template.
                        </p>
                    </div>

                    {/* Section 4: Default Message */}
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
                                <input type="text" placeholder="e.g. Please sign your agreement" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="input" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Default Message</label>
                                <textarea placeholder="Add a standard message for your recipients…" value={emailMessage} onChange={e => setEmailMessage(e.target.value)} rows={4} className="input min-h-[100px] resize-y" />
                            </div>
                        </div>
                    </div>

                    {/* Next button */}
                    <div className="pt-4">
                        <button
                            onClick={handleGoToStep2}
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#4C00FF] text-white font-bold text-lg hover:bg-[#3D00CC] transition-all shadow-lg shadow-[#4C00FF]/20 disabled:opacity-50"
                        >
                            {loading ? 'Rendering PDF…' : 'Next → Place Fields'}
                            {!loading && <ChevronRight className="w-5 h-5" />}
                        </button>
                        <button onClick={() => router.push('/templates')} className="w-full mt-3 py-3 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                            Cancel and return to list
                        </button>
                    </div>
                </main>
            )}

            {/* ═══════════ STEP 2: PLACEHOLDERS ═══════════ */}
            {step === 2 && (
                <div className="flex h-[calc(100vh-3.5rem)]">
                    {/* ── Left Sidebar: Field Toolbar ── */}
                    <div className="w-64 bg-white border-r border-gray-100 p-4 overflow-y-auto shrink-0">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Fields</h3>
                        <div className="space-y-2 mb-6">
                            {FIELD_TYPES.map(ft => {
                                const Icon = ft.icon
                                return (
                                    <div
                                        key={ft.type}
                                        draggable
                                        onDragStart={e => {
                                            e.dataTransfer.setData('text/plain', ft.type)
                                            setDraggingFieldType(ft.type)
                                        }}
                                        onDragEnd={() => setDraggingFieldType(null)}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-grab active:cursor-grabbing transition-all group"
                                    >
                                        <GripHorizontal className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400" />
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${ft.color}15` }}>
                                            <Icon className="w-3.5 h-3.5" style={{ color: ft.color }} />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{ft.label}</span>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Active Signer Selector */}
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Assign To</h3>
                        <div className="space-y-1.5 mb-6">
                            {recipients.map((r, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveSignerIndex(idx)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${activeSignerIndex === idx
                                        ? 'border-gray-300 bg-gray-50 text-gray-900 shadow-sm'
                                        : 'border-transparent text-gray-500 hover:bg-gray-50'
                                        }`}
                                >
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: getSignerColor(idx) }}>
                                        {idx + 1}
                                    </span>
                                    <span className="truncate">{r.name || `Signer ${idx + 1}`}</span>
                                </button>
                            ))}
                        </div>

                        {/* Page Navigator */}
                        {pdfPages.length > 1 && (
                            <>
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Pages</h3>
                                <div className="space-y-1.5">
                                    {pdfPages.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setActivePage(i + 1)}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activePage === i + 1
                                                ? 'bg-[#4C00FF]/10 text-[#4C00FF]'
                                                : 'text-gray-500 hover:bg-gray-50'
                                                }`}
                                        >
                                            Page {i + 1}
                                            {placeholders.filter(p => p.pageNumber === i + 1).length > 0 && (
                                                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                                    {placeholders.filter(p => p.pageNumber === i + 1).length}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Placeholder count */}
                        <div className="mt-6 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                {placeholders.length} field{placeholders.length !== 1 ? 's' : ''} placed
                            </p>
                        </div>
                    </div>

                    {/* ── Main PDF Area ── */}
                    <div className="flex-1 overflow-y-auto bg-gray-100 flex justify-center py-6 px-4">
                        <div className="relative max-w-3xl w-full">
                            {pdfPages[activePage - 1] && (
                                <div
                                    ref={pdfContainerRef}
                                    className="relative bg-white shadow-xl rounded-lg overflow-hidden select-none"
                                    onMouseDown={handlePageMouseDown}
                                    onMouseMove={handlePageMouseMove}
                                    onMouseUp={handlePageMouseUp}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={handleFieldDrop}
                                >
                                    <img
                                        src={pdfPages[activePage - 1]}
                                        alt={`Page ${activePage}`}
                                        className="w-full pointer-events-none"
                                        draggable={false}
                                    />

                                    {/* Existing placeholders */}
                                    {currentPagePlaceholders.map(ph => {
                                        const fieldConfig = FIELD_TYPES.find(f => f.type === ph.fieldType)
                                        const color = getSignerColor(ph.signerIndex)
                                        const Icon = fieldConfig?.icon || PenTool
                                        return (
                                            <div
                                                key={ph.id}
                                                className="placeholder-box absolute border-2 rounded-md flex items-center justify-center cursor-move group"
                                                style={{
                                                    left: `${ph.xPercent}%`,
                                                    top: `${ph.yPercent}%`,
                                                    width: `${ph.widthPercent}%`,
                                                    height: `${ph.heightPercent}%`,
                                                    borderColor: color,
                                                    background: `${color}15`,
                                                }}
                                            >
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color }}>
                                                    <Icon className="w-3 h-3" />
                                                    <span>{ph.label}</span>
                                                    <span className="w-4 h-4 rounded-full text-white flex items-center justify-center text-[8px]" style={{ background: color }}>
                                                        {ph.signerIndex + 1}
                                                    </span>
                                                </div>
                                                {/* Delete button */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); removePlaceholder(ph.id) }}
                                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                                {/* Resize handle */}
                                                <div
                                                    onMouseDown={e => handleResizeMouseDown(e, ph.id)}
                                                    className="absolute -bottom-1 -right-1 w-3 h-3 rounded-sm cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ background: color }}
                                                />
                                            </div>
                                        )
                                    })}

                                    {/* Drag preview rectangle */}
                                    {isDragging && (
                                        <div
                                            className="absolute border-2 border-dashed rounded"
                                            style={{
                                                left: `${Math.min(dragStart.x, dragCurrent.x)}%`,
                                                top: `${Math.min(dragStart.y, dragCurrent.y)}%`,
                                                width: `${Math.abs(dragCurrent.x - dragStart.x)}%`,
                                                height: `${Math.abs(dragCurrent.y - dragStart.y)}%`,
                                                borderColor: getSignerColor(activeSignerIndex),
                                                background: `${getSignerColor(activeSignerIndex)}10`,
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
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
