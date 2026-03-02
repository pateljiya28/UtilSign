'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import SignatureModal from '@/components/SignatureModal'
import {
    PenTool, Check, AlertCircle, Clock, ShieldCheck,
    ChevronUp, ChevronDown, CheckCircle, Info, Lock,
    ArrowLeft, Download, Calendar, Type, Briefcase, User
} from 'lucide-react'

type SignerState = 'loading' | 'otp' | 'document' | 'success' | 'error'

interface PlaceholderData {
    id: string
    page_number: number
    x_percent: number
    y_percent: number
    width_percent: number
    height_percent: number
    label: string | null
    assigned_signer_email: string
    is_mine: boolean
}

interface SignatureCapture {
    placeholderId: string
    imageBase64: string
}

export default function SignPage() {
    const params = useParams()
    const router = useRouter()
    const token = params.token as string

    const [state, setState] = useState<SignerState>('loading')
    const [error, setError] = useState('')
    const [errorType, setErrorType] = useState('')

    // Signer info
    const [documentName, setDocumentName] = useState('')
    const [signerEmail, setSignerEmail] = useState('')

    // OTP
    const [otp, setOtp] = useState('')
    const [otpLoading, setOtpLoading] = useState(false)
    const [otpError, setOtpError] = useState('')
    const [countdown, setCountdown] = useState(600) // 10 minutes
    const [resendCooldown, setResendCooldown] = useState(0) // seconds until resend allowed
    const hasFiredRef = useRef(false) // prevent Strict Mode double-fire

    // Session (stored ONLY in React state)
    const [sessionToken, setSessionToken] = useState('')

    // Document viewing
    const [pdfPages, setPdfPages] = useState<string[]>([])
    const [placeholders, setPlaceholders] = useState<PlaceholderData[]>([])
    const [activePage, setActivePage] = useState(1)

    // Signature collection
    const [signatures, setSignatures] = useState<SignatureCapture[]>([])
    const [modalOpen, setModalOpen] = useState(false)
    const [activePlaceholderId, setActivePlaceholderId] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    // Text/Date field inputs (for non-signature fields)
    const [textInputs, setTextInputs] = useState<Record<string, string>>({})
    const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

    // Refs for auto-scroll
    const placeholderRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // ── Step 1: Validate token + send OTP ──────────────────────────────────────
    useEffect(() => {
        if (hasFiredRef.current) return // Prevent Strict Mode double-fire
        hasFiredRef.current = true
        const validate = async () => {
            try {
                const res = await fetch(`/api/sign/${token}`)
                const data = await res.json()
                if (!res.ok) {
                    setErrorType(data.error)
                    setError(data.message || 'This link is invalid or expired.')
                    setState('error')
                    return
                }
                setDocumentName(data.documentName)
                setSignerEmail(data.signerEmail)
                setState('otp')
                setCountdown(600)
                setResendCooldown(60) // 60s cooldown after initial send
            } catch {
                setError('Failed to validate signing link.')
                setState('error')
            }
        }
        validate()
    }, [token])

    // ── OTP countdown timer ────────────────────────────────────────────────────
    useEffect(() => {
        if (state !== 'otp') return
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 0) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
            setResendCooldown(prev => Math.max(0, prev - 1))
        }, 1000)
        return () => clearInterval(timer)
    }, [state])

    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

    // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
    const handleVerifyOTP = async () => {
        if (otp.length !== 6) return
        setOtpLoading(true)
        setOtpError('')
        try {
            const res = await fetch(`/api/sign/${token}/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otp }),
            })
            const data = await res.json()
            if (!res.ok) {
                setOtpError(data.message || 'Verification failed.')
                if (data.error === 'otp_locked') {
                    setOtpError('Too many failed attempts. Please request a new OTP by refreshing the page.')
                }
                setOtpLoading(false)
                return
            }
            setSessionToken(data.sessionToken)
            await loadDocument(data.sessionToken)
            setState('document')
        } catch {
            setOtpError('Something went wrong. Please try again.')
        } finally {
            setOtpLoading(false)
        }
    }

    // ── Resend OTP ─────────────────────────────────────────────────────────────
    const handleResendOTP = async () => {
        if (resendCooldown > 0) return
        setOtp('')
        setOtpError('')
        setOtpLoading(true)
        try {
            const res = await fetch(`/api/sign/${token}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            setCountdown(600)
            setResendCooldown(60)
        } catch {
            setOtpError('Failed to resend OTP.')
        } finally {
            setOtpLoading(false)
        }
    }

    // ── Step 3: Load document for viewing ──────────────────────────────────────
    const loadDocument = async (session: string) => {
        try {
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

            const infoRes = await fetch(`/api/sign/${token}/info`, {
                headers: { 'Authorization': `Bearer ${session}` },
            })

            if (infoRes.ok) {
                const info = await infoRes.json()
                setPlaceholders(info.placeholders ?? [])
                if (info.pdfUrl) {
                    const pdfRes = await fetch(info.pdfUrl)
                    const ab = await pdfRes.arrayBuffer()
                    const pdf = await pdfjsLib.getDocument({ data: ab }).promise
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
            }
        } catch (err) {
            console.error('Failed to load document:', err)
        }
    }

    const getFieldType = (label: string | null): string => {
        if (!label) return 'Sign'
        const normalized = label.toLowerCase().trim()
        if (normalized === 'name') return 'Name'
        if (normalized === 'title') return 'Title'
        if (normalized === 'designation') return 'Designation'
        if (normalized === 'date') return 'Date'
        return 'Sign'
    }

    const isTextField = (label: string | null) => ['Name', 'Title', 'Designation'].includes(getFieldType(label))
    const isDateField = (label: string | null) => getFieldType(label) === 'Date'
    const isSignField = (label: string | null) => getFieldType(label) === 'Sign'

    const getFieldIcon = (fieldType: string) => {
        switch (fieldType) {
            case 'Name': return User
            case 'Title': return Type
            case 'Designation': return Briefcase
            case 'Date': return Calendar
            default: return PenTool
        }
    }

    const getFieldColor = (fieldType: string) => {
        switch (fieldType) {
            case 'Name': return '#10b981'
            case 'Title': return '#f59e0b'
            case 'Designation': return '#8b5cf6'
            case 'Date': return '#06b6d4'
            default: return '#4C00FF'
        }
    }

    const handlePlaceholderClick = (placeholderId: string, label: string | null) => {
        if (isSignField(label)) {
            setActivePlaceholderId(placeholderId)
            setModalOpen(true)
        } else if (isTextField(label)) {
            setEditingFieldId(placeholderId)
        } else if (isDateField(label)) {
            setEditingFieldId(placeholderId)
        }
    }

    const handleTextFieldConfirm = (placeholderId: string, text: string) => {
        if (!text.trim()) return
        setTextInputs(prev => ({ ...prev, [placeholderId]: text }))
        // Store as a rendered text image in signatures for submission
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 80
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#1a1a1a'
        ctx.font = 'bold 28px Inter, Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, canvas.width / 2, canvas.height / 2)
        const imageBase64 = canvas.toDataURL('image/png')
        setSignatures(prev => {
            const filtered = prev.filter(s => s.placeholderId !== placeholderId)
            const updated = [...filtered, { placeholderId, imageBase64 }]
            setTimeout(() => scrollToNextUnsigned(placeholderId, updated), 400)
            return updated
        })
        setEditingFieldId(null)
    }

    const handleDateFieldConfirm = (placeholderId: string, date: string) => {
        if (!date) return
        const formatted = new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        setTextInputs(prev => ({ ...prev, [placeholderId]: formatted }))
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 80
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#1a1a1a'
        ctx.font = '24px Inter, Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(formatted, canvas.width / 2, canvas.height / 2)
        const imageBase64 = canvas.toDataURL('image/png')
        setSignatures(prev => {
            const filtered = prev.filter(s => s.placeholderId !== placeholderId)
            const updated = [...filtered, { placeholderId, imageBase64 }]
            setTimeout(() => scrollToNextUnsigned(placeholderId, updated), 400)
            return updated
        })
        setEditingFieldId(null)
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
        const mine = placeholders.filter(p => p.is_mine)
        const justSignedIdx = mine.findIndex(p => p.id === justSignedId)
        let nextUnsigned: PlaceholderData | null = null
        for (let i = justSignedIdx + 1; i < mine.length; i++) {
            if (!signedIds.has(mine[i].id)) { nextUnsigned = mine[i]; break }
        }
        if (!nextUnsigned) {
            for (let i = 0; i < justSignedIdx; i++) {
                if (!signedIds.has(mine[i].id)) { nextUnsigned = mine[i]; break }
            }
        }
        if (!nextUnsigned) return
        if (nextUnsigned.page_number !== activePage) {
            setActivePage(nextUnsigned.page_number)
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
        const placeholder = placeholders.find(p => p.id === placeholderId)
        if (!placeholder) return
        const ft = getFieldType(placeholder.label)
        const lastValue = getLastValueForFieldType(ft)
        if (!lastValue) return
        setSignatures(prev => {
            const filtered = prev.filter(s => s.placeholderId !== placeholderId)
            const updated = [...filtered, { placeholderId, imageBase64: lastValue }]
            setTimeout(() => scrollToNextUnsigned(placeholderId, updated), 400)
            return updated
        })
    }

    const isPlaceholderSigned = (id: string) => signatures.some(s => s.placeholderId === id)
    const myPlaceholders = placeholders.filter(p => p.is_mine)
    const allSigned = myPlaceholders.length > 0 && myPlaceholders.every(p => isPlaceholderSigned(p.id))

    // Get the last completed value for a specific field type
    const getLastValueForFieldType = (fieldType: string): string | null => {
        const matchingPlaceholders = myPlaceholders.filter(p => getFieldType(p.label) === fieldType)
        for (let i = signatures.length - 1; i >= 0; i--) {
            const sig = signatures[i]
            if (matchingPlaceholders.some(p => p.id === sig.placeholderId)) {
                return sig.imageBase64
            }
        }
        return null
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            const res = await fetch(`/api/sign/${token}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ action: 'sign', signatures }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setState('success')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Submission failed')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDecline = async () => {
        if (!confirm('Are you sure you want to decline signing this document?')) return
        setSubmitting(true)
        try {
            const res = await fetch(`/api/sign/${token}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`,
                },
                body: JSON.stringify({ action: 'decline' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setState('success')
            setError('You have declined to sign this document.')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to decline')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── Unified Header ────────────────────────────────────────────────── */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-[#4C00FF] flex items-center justify-center">
                            <PenTool className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg text-gray-900 tracking-tight">UtilSign</span>
                        {documentName && (
                            <span className="text-gray-400 text-sm font-medium border-l border-gray-200 pl-3 ml-1 truncate max-w-[200px] md:max-w-md">
                                {documentName}
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-10">
                {/* ════════════ LOADING ════════════ */}
                {state === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-32 animate-fade-in text-center">
                        <div className="w-10 h-10 border-3 border-[#4C00FF] border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-gray-500 font-medium">Preparing your document for signing…</p>
                        <p className="text-gray-400 text-xs mt-1">Verifying secure access link</p>
                    </div>
                )}

                {/* ════════════ ERROR ════════════ */}
                {state === 'error' && (
                    <div className="max-w-md mx-auto text-center py-24 animate-fade-in">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                            {errorType === 'not_your_turn' ? <Clock className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {errorType === 'not_your_turn' ? 'Pending Signature' :
                                errorType === 'already_signed' ? 'Document Finalized' :
                                    errorType === 'expired' ? 'Link Expired' : 'Link Unavailable'}
                        </h2>
                        <p className="text-gray-500 leading-relaxed mb-8">{error}</p>
                        <button onClick={() => router.push('/')} className="btn-secondary w-full">Return Home</button>
                    </div>
                )}

                {/* ════════════ OTP ════════════ */}
                {state === 'otp' && (
                    <div className="max-w-md mx-auto animate-fade-in py-10">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
                            <div className="bg-[#4C00FF] p-8 text-center text-white">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                                    <Lock className="w-6 h-6 text-white" />
                                </div>
                                <h2 className="text-xl font-bold">Secure Access Verification</h2>
                                <p className="text-white/80 text-sm mt-1">Please verify your identity to continue</p>
                            </div>

                            <div className="p-8 text-center">
                                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                    A 6-digit verification code has been sent to:<br />
                                    <strong className="text-gray-900 font-bold">{signerEmail}</strong>
                                </p>

                                {otpError && (
                                    <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-100 animate-shake">
                                        {otpError}
                                    </div>
                                )}

                                <div className="flex justify-center gap-2 mb-6">
                                    {[0, 1, 2, 3, 4, 5].map(i => (
                                        <input
                                            key={i}
                                            type="text"
                                            maxLength={1}
                                            className="w-11 h-13 text-center text-xl font-bold rounded-lg bg-gray-50 border border-gray-200 text-gray-900 focus:border-[#4C00FF] focus:ring-4 focus:ring-[#4C00FF]/10 transition-all outline-none"
                                            value={otp[i] || ''}
                                            onChange={e => {
                                                const val = e.target.value.replace(/\D/g, '')
                                                if (!val) return
                                                const newOtp = otp.split('')
                                                newOtp[i] = val
                                                const joined = newOtp.join('').slice(0, 6)
                                                setOtp(joined)
                                                if (i < 5) (e.target.nextElementSibling as HTMLInputElement)?.focus()
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Backspace' && !otp[i] && i > 0) {
                                                    const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                                                    prev?.focus()
                                                    setOtp(prev => prev.slice(0, i - 1) + prev.slice(i))
                                                }
                                            }}
                                        />
                                    ))}
                                </div>

                                <div className="flex items-center justify-center gap-4 mb-8">
                                    <span className="text-gray-400 text-xs font-medium flex items-center gap-1.5">
                                        <Clock className="w-3 h-3" />
                                        {countdown > 0 ? `Code expires in ${formatTime(countdown)}` : 'Link expired'}
                                    </span>
                                    <button
                                        onClick={handleResendOTP}
                                        disabled={resendCooldown > 0 || otpLoading}
                                        className="text-[#4C00FF] font-bold text-xs hover:underline disabled:text-gray-400 disabled:no-underline"
                                    >
                                        {otpLoading ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                                    </button>
                                </div>

                                <button
                                    onClick={handleVerifyOTP}
                                    disabled={otp.length !== 6 || otpLoading || countdown === 0}
                                    className="w-full bg-[#4C00FF] text-white py-3.5 rounded-xl font-bold hover:bg-[#3D00CC] transition-all disabled:opacity-50 shadow-lg shadow-[#4C00FF]/20"
                                >
                                    {otpLoading ? 'Verifying…' : 'Review and Sign Document'}
                                </button>

                                <p className="text-[11px] text-gray-400 mt-6 flex items-center justify-center gap-1.5 uppercase tracking-wider font-semibold">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    End-to-End Encrypted Secure Link
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════ DOCUMENT VIEW ════════════ */}
                {state === 'document' && (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Review & Sign</h2>
                                <p className="text-gray-500 text-sm mt-1">Please review the document and sign at the highlighted locations.</p>
                            </div>
                            <div className="hidden md:flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                    <span>{signatures.length}/{myPlaceholders.length} signatures</span>
                                </div>
                                <div className="w-48 h-2 rounded-full bg-gray-200 overflow-hidden shadow-inner">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${myPlaceholders.length > 0 ? (signatures.length / myPlaceholders.length) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Page navigation */}
                        {pdfPages.length > 1 && (
                            <div className="flex items-center gap-2 mb-5">
                                {pdfPages.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActivePage(i + 1)}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activePage === i + 1
                                            ? 'bg-[#4C00FF] text-white shadow-md'
                                            : 'bg-white border border-gray-200 text-gray-400 hover:border-gray-300'
                                            }`}
                                    >Page {i + 1}</button>
                                ))}
                            </div>
                        )}

                        {/* PDF Viewer */}
                        <div className="relative inline-block border border-gray-100 rounded-2xl shadow-xl overflow-hidden bg-white">
                            {pdfPages[activePage - 1] && (
                                <img src={pdfPages[activePage - 1]} alt={`Page ${activePage}`} className="max-w-full" draggable={false} />
                            )}

                            {placeholders
                                .filter(p => p.page_number === activePage)
                                .map(p => {
                                    if (!p.is_mine) {
                                        const ft = getFieldType(p.label)
                                        const FieldIcon = getFieldIcon(ft)
                                        return (
                                            <div
                                                key={p.id}
                                                className="absolute border border-dashed border-gray-300 bg-gray-50/40 flex items-center justify-center rounded pointer-events-none"
                                                style={{
                                                    left: `${p.x_percent}%`,
                                                    top: `${p.y_percent}%`,
                                                    width: `${p.width_percent}%`,
                                                    height: `${p.height_percent}%`,
                                                }}
                                            >
                                                <span className="text-[9px] text-gray-400 text-center px-1 font-medium truncate">Waiting: {p.assigned_signer_email.split('@')[0]}</span>
                                            </div>
                                        )
                                    }

                                    const fieldType = getFieldType(p.label)
                                    const FieldIcon = getFieldIcon(fieldType)
                                    const fieldColor = getFieldColor(fieldType)
                                    const signed = isPlaceholderSigned(p.id)
                                    const sig = signatures.find(s => s.placeholderId === p.id)
                                    const lastMatchingValue = getLastValueForFieldType(fieldType)
                                    const canReplicateHere = !signed && lastMatchingValue && myPlaceholders.filter(pp => getFieldType(pp.label) === fieldType).length > 1
                                    const isEditing = editingFieldId === p.id

                                    return (
                                        <div
                                            key={p.id}
                                            ref={el => { placeholderRefs.current[p.id] = el }}
                                            className={`absolute transition-all ${signed
                                                ? 'border-2 border-emerald-500 bg-emerald-50 border-solid'
                                                : isEditing
                                                    ? 'border-2 border-solid shadow-lg z-20'
                                                    : canReplicateHere
                                                        ? 'border-2 border-amber-500 bg-amber-50 border-solid'
                                                        : 'border-2 bg-opacity-5 hover:bg-opacity-10 cursor-pointer border-solid'
                                                }`}
                                            style={{
                                                left: `${p.x_percent}%`,
                                                top: `${p.y_percent}%`,
                                                width: `${p.width_percent}%`,
                                                height: `${p.height_percent}%`,
                                                borderRadius: '6px',
                                                ...(!signed && !isEditing && !canReplicateHere ? { borderColor: fieldColor, backgroundColor: `${fieldColor}08` } : {}),
                                                ...(isEditing ? { borderColor: fieldColor, backgroundColor: '#ffffff' } : {}),
                                            }}
                                            onClick={() => { if (!signed && !canReplicateHere && !isEditing) handlePlaceholderClick(p.id, p.label) }}
                                        >
                                            {/* Signed state */}
                                            {signed && sig ? (
                                                <img src={sig.imageBase64} alt={fieldType} className="w-full h-full object-contain p-1" />

                                                /* Editing text field inline */
                                            ) : isEditing && isTextField(p.label) ? (
                                                <div className="flex items-center h-full w-full p-1 gap-1">
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        placeholder={`Enter ${fieldType.toLowerCase()}...`}
                                                        defaultValue={textInputs[p.id] || ''}
                                                        className="flex-1 min-w-0 text-sm border-none outline-none bg-transparent text-gray-900 font-medium placeholder:text-gray-400"
                                                        onKeyDown={e => { if (e.key === 'Enter') handleTextFieldConfirm(p.id, (e.target as HTMLInputElement).value) }}
                                                        onBlur={e => handleTextFieldConfirm(p.id, e.target.value)}
                                                    />
                                                    <button
                                                        className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                                                        style={{ backgroundColor: fieldColor }}
                                                        onMouseDown={e => e.preventDefault()}
                                                        onClick={e => {
                                                            e.stopPropagation()
                                                            const input = e.currentTarget.previousElementSibling as HTMLInputElement
                                                            handleTextFieldConfirm(p.id, input.value)
                                                        }}
                                                    >✓</button>
                                                </div>

                                                /* Editing date field inline */
                                            ) : isEditing && isDateField(p.label) ? (
                                                <div className="flex items-center h-full w-full p-1 gap-1">
                                                    <input
                                                        type="date"
                                                        autoFocus
                                                        defaultValue={new Date().toISOString().split('T')[0]}
                                                        className="flex-1 min-w-0 text-sm border-none outline-none bg-transparent text-gray-900 font-medium"
                                                        onChange={e => handleDateFieldConfirm(p.id, e.target.value)}
                                                    />
                                                </div>

                                                /* Replicate sign */
                                            ) : canReplicateHere ? (
                                                <div className="flex flex-col items-center justify-center h-full w-full gap-1 p-1">
                                                    <img src={lastMatchingValue!} alt="Preview" className="object-contain opacity-30 max-h-[50%]" />
                                                    <div className="flex gap-1 shrink-0">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleApplySame(p.id) }}
                                                            className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-emerald-600 text-white shadow-sm"
                                                        >✓ Apply Same</button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handlePlaceholderClick(p.id, p.label) }}
                                                            className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-gray-500 text-white shadow-sm"
                                                        >✎ New</button>
                                                    </div>
                                                </div>

                                                /* Default: watermark with field type */
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full gap-0.5">
                                                    <FieldIcon className="w-4 h-4" style={{ color: fieldColor }} />
                                                    <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: fieldColor }}>
                                                        {fieldType === 'Sign' ? 'Sign Here' : fieldType}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                        </div>

                        {/* Sign Sticky Bottom Bar (Mobile/Table View) */}
                        <div className="sticky bottom-8 mt-10 p-5 bg-white rounded-2xl border border-gray-100 shadow-2xl flex items-center justify-between gap-4 z-40">
                            <button onClick={handleDecline} disabled={submitting} className="px-5 py-2.5 text-sm font-bold text-gray-400 hover:text-red-500 transition-colors">
                                Decline to Sign
                            </button>

                            <div className="flex items-center gap-4">
                                <div className="hidden sm:block text-right">
                                    <p className="text-xs font-bold text-gray-900">{signatures.length > 0 ? `${signatures.length} of ${myPlaceholders.length} signed` : 'No fields signed yet'}</p>
                                    <p className="text-[10px] text-gray-400 font-medium">Progress preserved locally</p>
                                </div>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!allSigned || submitting}
                                    className="px-8 py-3 rounded-xl bg-[#4C00FF] text-white font-bold text-sm hover:bg-[#3D00CC] transition-all shadow-lg shadow-[#4C00FF]/20 disabled:opacity-50 min-w-[200px]"
                                >
                                    {submitting ? 'Submitting…' : allSigned ? '✓ Finish and Submit' : `Sign ${myPlaceholders.length - signatures.length} more field${myPlaceholders.length - signatures.length !== 1 ? 's' : ''}`}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100 animate-fade-in flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════ SUCCESS ════════════ */}
                {state === 'success' && (
                    <div className="max-w-md mx-auto text-center py-20 animate-fade-in">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 text-emerald-500">
                            <CheckCircle className="w-12 h-12" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-3">
                            {error ? 'Action Recorded' : 'Document Signed!'}
                        </h2>
                        <p className="text-gray-500 leading-relaxed mb-10">
                            {error || 'Thank you for your signature. The document has been securely processed and notified to the sender.'}
                        </p>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8 text-left space-y-3">
                            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Document</span>
                                <span className="text-sm text-gray-900 font-medium truncate ml-4">{documentName}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Signed As</span>
                                <span className="text-sm text-gray-900 font-medium">{signerEmail}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button onClick={() => window.print()} className="btn-secondary flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> Download Certificate
                            </button>
                            <button onClick={() => router.push('/')} className="py-3 text-sm font-bold text-[#4C00FF] hover:underline">
                                Return to UtilSign Home
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Signature modal */}
            <SignatureModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setActivePlaceholderId(null) }}
                onConfirm={handleSignatureConfirm}
            />
        </div>
    )
}
