'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface AuditLog {
    id: string
    actor_email: string
    event_type: string
    metadata: Record<string, unknown>
    created_at: string
    signer_id: string | null
}

const EVENT_LABELS: Record<string, string> = {
    document_created: 'Document created',
    document_sent: 'Sent for signature',
    email_delivered: 'Signing email sent',
    link_opened: 'Opened signing link',
    otp_sent: 'OTP sent',
    otp_verified: 'Verified identity',
    otp_failed: 'Wrong OTP entered',
    otp_locked: 'Locked out after failed attempts',
    placeholder_viewed: 'Viewed the document',
    signature_submitted: 'Submitted signature',
    pdf_burned: 'Signature burned into document',
    signer_declined: 'Declined to sign',
    next_signer_notified: 'Signing request sent to next signer',
    document_completed: 'Document fully signed by all parties',
    document_downloaded: 'Downloaded the completed document',
}

const EVENT_ICONS: Record<string, string> = {
    document_created: '📄', document_sent: '📤', email_delivered: '✉️',
    link_opened: '🔗', otp_sent: '🔐', otp_verified: '✅', otp_failed: '❌',
    otp_locked: '🔒', placeholder_viewed: '👁️', signature_submitted: '✍️',
    pdf_burned: '🔥', signer_declined: '🚫', next_signer_notified: '➡️',
    document_completed: '🎉', document_downloaded: '⬇️',
}

const EVENT_COLORS: Record<string, string> = {
    document_created: 'border-slate-600', document_sent: 'border-blue-500',
    email_delivered: 'border-blue-400', link_opened: 'border-cyan-500',
    otp_sent: 'border-amber-500', otp_verified: 'border-emerald-500',
    otp_failed: 'border-red-500', otp_locked: 'border-red-600',
    placeholder_viewed: 'border-purple-500', signature_submitted: 'border-brand-500',
    pdf_burned: 'border-orange-500', signer_declined: 'border-red-500',
    next_signer_notified: 'border-blue-500', document_completed: 'border-emerald-500',
    document_downloaded: 'border-emerald-400',
}

function formatEventLabel(log: AuditLog): string {
    const base = EVENT_LABELS[log.event_type] ?? log.event_type
    const email = log.actor_email
    const meta = log.metadata

    switch (log.event_type) {
        case 'email_delivered':
            return `Signing email sent to ${(meta?.to as string) || email}`
        case 'link_opened':
            return `${email} opened their signing link`
        case 'otp_sent':
            return `OTP sent to ${email}`
        case 'otp_verified':
            return `${email} verified their identity`
        case 'otp_failed': {
            const attempt = (meta?.attempt as number) ?? '?'
            const max = (meta?.maxAttempts as number) ?? 3
            return `${email} entered wrong OTP (attempt ${attempt} of ${max})`
        }
        case 'otp_locked':
            return `${email} locked out after 3 failed attempts`
        case 'placeholder_viewed':
            return `${email} viewed the document`
        case 'signature_submitted':
            return `${email} submitted their signature`
        case 'signer_declined':
            return `${email} declined to sign`
        case 'next_signer_notified':
            return `Signing request sent to ${(meta?.to as string) || 'next signer'}`
        default:
            return base
    }
}

export default function AuditLogsPage() {
    const router = useRouter()
    const params = useParams()
    const documentId = params.id as string

    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch(`/api/documents/${documentId}/logs`)
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setLogs(data.logs)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch logs')
            } finally {
                setLoading(false)
            }
        }
        fetchLogs()
    }, [documentId])

    return (
        <div className="min-h-screen">
            <header className="page-header">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="text-slate-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <span className="font-bold text-white">Audit Log</span>
                    </div>
                    <Link href={`/documents/${documentId}/status`} className="btn-secondary text-xs px-3 py-1.5">
                        ← Status
                    </Link>
                </div>
            </header>

            {error && (
                <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-4">
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
                </div>
            )}

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
                <h2 className="text-xl font-bold text-white mb-2">Activity Timeline</h2>
                <p className="text-slate-400 text-sm mb-8">Complete chronological record of all actions on this document.</p>

                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading logs…
                    </div>
                ) : logs.length === 0 ? (
                    <div className="card p-12 text-center">
                        <p className="text-slate-400">No activity recorded yet.</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-800" />

                        <div className="space-y-4">
                            {logs.map((log) => (
                                <div key={log.id} className="relative pl-14 animate-fade-in">
                                    {/* Timeline dot */}
                                    <div className={`absolute left-3 top-4 w-4 h-4 rounded-full border-2 bg-slate-950 ${EVENT_COLORS[log.event_type] ?? 'border-slate-600'}`} />

                                    <div className="card-hover p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="text-lg flex-shrink-0">{EVENT_ICONS[log.event_type] ?? '📋'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-medium">{formatEventLabel(log)}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-slate-500 text-xs">
                                                        {new Date(log.created_at).toLocaleDateString(undefined, {
                                                            month: 'short', day: 'numeric', year: 'numeric',
                                                        })}{' '}
                                                        at{' '}
                                                        {new Date(log.created_at).toLocaleTimeString(undefined, {
                                                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                        })}
                                                    </span>
                                                    <span className="text-slate-600 text-xs">·</span>
                                                    <span className="text-slate-500 text-xs truncate">{log.actor_email}</span>
                                                </div>
                                                {/* Metadata */}
                                                {Object.keys(log.metadata).length > 0 && (
                                                    <div className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800/50 text-xs text-slate-500 font-mono">
                                                        {Object.entries(log.metadata).map(([k, v]) => (
                                                            <span key={k} className="mr-3">
                                                                {k}: <span className="text-slate-400">{String(v)}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
