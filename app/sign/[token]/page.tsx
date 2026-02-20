'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import SignatureModal from '@/components/SignatureModal'

type SignerState = 'loading' | 'otp' | 'document' | 'success' | 'error'

interface PlaceholderData {
    id: string
    page_number: number
    x_percent: number
    y_percent: number
    width_percent: number
    height_percent: number
    label: string | null
}

interface SignatureCapture {
    placeholderId: string
    imageBase64: string
}

export default function SignPage() {
    const params = useParams()
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
            // Session token stays in React state ONLY
            setSessionToken(data.sessionToken)
            // Load the document for viewing
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
            setResendCooldown(60) // 60s cooldown after resend
        } catch {
            setOtpError('Failed to resend OTP.')
        } finally {
            setOtpLoading(false)
        }
    }

    // ── Step 3: Load document for viewing ──────────────────────────────────────
    const loadDocument = async (session: string) => {
        try {
            // Fetch placeholders and PDF URL via the submit route's context
            // We reuse the token GET endpoint info — placeholders are delivered as part of the page
            // For MVP: render the PDF client-side from unsigned URL
            const pdfjsLib = await import('pdfjs-dist')
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

            // Fetch actual document metadata through a simple placeholder endpoint
            // For the signer, we use a special info fetch
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

    // ── Step 4: Handle placeholder click → open modal ──────────────────────────
    const handlePlaceholderClick = (placeholderId: string) => {
        setActivePlaceholderId(placeholderId)
        setModalOpen(true)
    }

    const handleSignatureConfirm = (imageBase64: string) => {
        if (!activePlaceholderId) return
        setSignatures(prev => {
            const filtered = prev.filter(s => s.placeholderId !== activePlaceholderId)
            return [...filtered, { placeholderId: activePlaceholderId, imageBase64 }]
        })
        setModalOpen(false)
        setActivePlaceholderId(null)
    }

    const isPlaceholderSigned = (id: string) => signatures.some(s => s.placeholderId === id)
    const allSigned = placeholders.length > 0 && placeholders.every(p => isPlaceholderSigned(p.id))

    // ── Step 5: Submit signatures ──────────────────────────────────────────────
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

    // ── Decline ────────────────────────────────────────────────────────────────
    const handleDecline = async () => {
        if (!confirm('Are you sure you want to decline signing this document? This action cannot be undone.')) return
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

    // ════════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="page-header">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center text-xs">✍️</div>
                    <span className="font-bold text-white text-sm">UtilSign</span>
                    {documentName && <span className="text-slate-500 text-xs">· {documentName}</span>}
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
                {/* ════════════ LOADING ════════════ */}
                {state === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-32 animate-fade-in">
                        <svg className="animate-spin h-8 w-8 text-brand-400 mb-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-slate-400 text-sm">Validating your signing link…</p>
                    </div>
                )}

                {/* ════════════ ERROR ════════════ */}
                {state === 'error' && (
                    <div className="max-w-md mx-auto text-center py-32 animate-fade-in">
                        <div className="text-5xl mb-4">
                            {errorType === 'not_your_turn' ? '⏳' : errorType === 'already_signed' ? '✅' : '⚠️'}
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            {errorType === 'not_your_turn' ? 'Not Your Turn Yet' :
                                errorType === 'already_signed' ? 'Already Signed' :
                                    errorType === 'expired' ? 'Link Expired' : 'Something Went Wrong'}
                        </h2>
                        <p className="text-slate-400 text-sm">{error}</p>
                    </div>
                )}

                {/* ════════════ OTP ════════════ */}
                {state === 'otp' && (
                    <div className="max-w-md mx-auto text-center py-16 animate-fade-in">
                        <div className="text-5xl mb-4">🔐</div>
                        <h2 className="text-xl font-bold text-white mb-2">Verify Your Identity</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            We sent a 6-digit verification code to <strong className="text-white">{signerEmail}</strong>
                        </p>

                        {otpError && (
                            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                                {otpError}
                            </div>
                        )}

                        {/* OTP Input */}
                        <div className="flex justify-center gap-2 mb-4">
                            {[0, 1, 2, 3, 4, 5].map(i => (
                                <input
                                    key={i}
                                    type="text"
                                    maxLength={1}
                                    className="w-12 h-14 text-center text-xl font-bold rounded-xl bg-slate-800 border border-slate-700 text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all"
                                    value={otp[i] || ''}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '')
                                        if (!val) return
                                        const newOtp = otp.split('')
                                        newOtp[i] = val
                                        const joined = newOtp.join('').slice(0, 6)
                                        setOtp(joined)
                                        // Auto-focus next
                                        if (val && i < 5) {
                                            const next = e.target.nextElementSibling as HTMLInputElement
                                            next?.focus()
                                        }
                                    }}
                                    onKeyDown={e => {
                                        if (e.key === 'Backspace' && !otp[i] && i > 0) {
                                            const prev = (e.target as HTMLInputElement).previousElementSibling as HTMLInputElement
                                            prev?.focus()
                                            setOtp(prev => prev.slice(0, i - 1) + prev.slice(i))
                                        }
                                    }}
                                    onPaste={e => {
                                        e.preventDefault()
                                        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
                                        setOtp(pasted)
                                    }}
                                />
                            ))}
                        </div>

                        <div className="flex items-center justify-center gap-4 mb-6">
                            <span className="text-slate-500 text-xs">
                                {countdown > 0 ? `Expires in ${formatTime(countdown)}` : 'Code expired'}
                            </span>
                            <button
                                onClick={handleResendOTP}
                                disabled={resendCooldown > 0 || otpLoading}
                                className={`text-xs font-medium transition-colors ${resendCooldown > 0 || otpLoading ? 'text-slate-600 cursor-not-allowed' : 'text-brand-400 hover:text-brand-300'}`}
                            >
                                {otpLoading ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                            </button>
                        </div>

                        <button
                            onClick={handleVerifyOTP}
                            disabled={otp.length !== 6 || otpLoading || countdown === 0}
                            className="btn-primary w-full max-w-xs mx-auto"
                        >
                            {otpLoading ? 'Verifying…' : 'Verify & Continue'}
                        </button>
                    </div>
                )}

                {/* ════════════ DOCUMENT VIEW ════════════ */}
                {state === 'document' && (
                    <div className="animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-white">Review & Sign</h2>
                                <p className="text-slate-400 text-sm">Click on each highlighted area to add your signature.</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{signatures.length}/{placeholders.length} signed</span>
                                <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-brand-500 transition-all"
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
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage === i + 1 ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                            }`}
                                    >Page {i + 1}</button>
                                ))}
                            </div>
                        )}

                        {/* PDF with placeholders */}
                        <div className="relative inline-block border border-slate-700 rounded-xl overflow-hidden">
                            {pdfPages[activePage - 1] && (
                                <img src={pdfPages[activePage - 1]} alt={`Page ${activePage}`} className="max-w-full" draggable={false} />
                            )}

                            {placeholders
                                .filter(p => p.page_number === activePage)
                                .map(p => {
                                    const signed = isPlaceholderSigned(p.id)
                                    const sig = signatures.find(s => s.placeholderId === p.id)
                                    return (
                                        <div
                                            key={p.id}
                                            className={`absolute cursor-pointer transition-all ${signed
                                                ? 'border-2 border-emerald-500 bg-emerald-500/10'
                                                : 'border-2 border-brand-400 bg-brand-500/10 hover:bg-brand-500/20 animate-pulse-slow'
                                                }`}
                                            style={{
                                                left: `${p.x_percent}%`,
                                                top: `${p.y_percent}%`,
                                                width: `${p.width_percent}%`,
                                                height: `${p.height_percent}%`,
                                            }}
                                            onClick={() => handlePlaceholderClick(p.id)}
                                        >
                                            {signed && sig ? (
                                                <img src={sig.imageBase64} alt="Signature" className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full">
                                                    <span className="text-brand-400 text-[10px] font-medium">✍ Click to sign</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 mt-6">
                            <button onClick={handleDecline} disabled={submitting} className="btn-danger text-sm">
                                Decline
                            </button>
                            <div className="flex-1" />
                            <button
                                onClick={handleSubmit}
                                disabled={!allSigned || submitting}
                                className="btn-primary text-sm"
                            >
                                {submitting ? 'Submitting…' : allSigned ? '✓ Submit Signatures' : `Sign all ${placeholders.length} fields first`}
                            </button>
                        </div>

                        {error && (
                            <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════ SUCCESS ════════════ */}
                {state === 'success' && (
                    <div className="max-w-md mx-auto text-center py-32 animate-fade-in">
                        <div className="text-6xl mb-4">{error ? '🚫' : '🎉'}</div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {error ? 'Declined' : 'Signed Successfully!'}
                        </h2>
                        <p className="text-slate-400 text-sm mb-4">
                            {error || 'Your signature has been recorded and burned into the document. You may close this tab.'}
                        </p>
                        <div className="card p-4 inline-block">
                            <p className="text-slate-500 text-xs">Document: <span className="text-white">{documentName}</span></p>
                            <p className="text-slate-500 text-xs">Email: <span className="text-white">{signerEmail}</span></p>
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
