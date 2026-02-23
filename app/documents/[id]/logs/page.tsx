'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, History, FileText, User, Mail, ShieldAlert, CheckCircle2, AlertCircle, Eye, PenTool, Flame, Ban, ArrowRight, PartyPopper, Download, Info } from 'lucide-react'

interface AuditLog {
    id: string
    actor_email: string
    event_type: string
    metadata: Record<string, unknown>
    created_at: string
    signer_id: string | null
}

const EVENT_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    document_created: { label: 'Document Created', icon: FileText, color: 'text-gray-400', bgColor: 'bg-gray-50' },
    document_sent: { label: 'Envelope Sent', icon: Mail, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    email_delivered: { label: 'Email Delivered', icon: Mail, color: 'text-blue-400', bgColor: 'bg-blue-50' },
    link_opened: { label: 'Signing Link Opened', icon: Eye, color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
    otp_sent: { label: 'Identity Code Sent', icon: ShieldAlert, color: 'text-amber-500', bgColor: 'bg-amber-50' },
    otp_verified: { label: 'Identity Verified', icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
    otp_failed: { label: 'Verification Failed', icon: AlertCircle, color: 'text-red-500', bgColor: 'bg-red-50' },
    otp_locked: { label: 'Account Locked', icon: Ban, color: 'text-red-600', bgColor: 'bg-red-50' },
    placeholder_viewed: { label: 'Document Viewed', icon: Eye, color: 'text-purple-500', bgColor: 'bg-purple-50' },
    signature_submitted: { label: 'Signature Applied', icon: PenTool, color: 'text-[#4C00FF]', bgColor: 'bg-[#4C00FF]/5' },
    pdf_burned: { label: 'Document Hardened', icon: Flame, color: 'text-orange-500', bgColor: 'bg-orange-50' },
    signer_declined: { label: 'Declined to Sign', icon: Ban, color: 'text-red-500', bgColor: 'bg-red-50' },
    next_signer_notified: { label: 'Sequence Advanced', icon: ArrowRight, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    document_completed: { label: 'Envelope Completed', icon: PartyPopper, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    document_downloaded: { label: 'Document Downloaded', icon: Download, color: 'text-gray-600', bgColor: 'bg-gray-50' },
}

function formatEventLabel(log: AuditLog): string {
    const config = EVENT_CONFIG[log.event_type]
    const email = log.actor_email
    const meta = log.metadata

    switch (log.event_type) {
        case 'email_delivered':
            return `Envelope delivered to ${(meta?.to as string) || email}`
        case 'link_opened':
            return `${email} accessed the document via secure link`
        case 'otp_sent':
            return `One-time passcode sent to ${email}`
        case 'otp_verified':
            return `Identity of ${email} successfully verified`
        case 'otp_failed': {
            const attempt = (meta?.attempt as number) ?? '?'
            const max = (meta?.maxAttempts as number) ?? 3
            return `Failed verification attempt (${attempt}/${max}) by ${email}`
        }
        case 'otp_locked':
            return `Security lockout: ${email} exceeded maximum attempts`
        case 'placeholder_viewed':
            return `${email} is currently viewing the document`
        case 'signature_submitted':
            return `${email} confirmed signature placement`
        case 'signer_declined':
            return `${email} declined the request to sign`
        case 'next_signer_notified':
            return `Request automatically forwarded to ${(meta?.to as string) || 'next recipient'}`
        default:
            return config?.label || log.event_type
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
        <div className="min-h-screen bg-gray-50">
            {/* ── Header ───────────────────────────────────────────────────────── */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-50">
                <div className="max-w-[1000px] mx-auto px-6 h-full flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push(`/documents/${documentId}/status`)}
                            className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Security</span>
                            <h1 className="text-sm font-bold text-gray-900 leading-none">Audit History</h1>
                        </div>
                    </div>
                    <Link
                        href={`/documents/${documentId}/status`}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 font-bold text-xs hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
                    >
                        Return to Status
                    </Link>
                </div>
            </header>

            <main className="pt-24 pb-20 px-6">
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900">Document Timeline</h2>
                            <p className="text-sm text-gray-500 mt-1">Full tamper-evident record of all envelope activities.</p>
                        </div>
                        <div className="bg-[#4C00FF]/5 rounded-lg px-3 py-1.5 flex items-center gap-2 border border-[#4C00FF]/10">
                            <History className="w-3.5 h-3.5 text-[#4C00FF]" />
                            <span className="text-[10px] font-bold text-[#4C00FF] uppercase tracking-wider">{logs.length} Total Events</span>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 font-medium">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-[#4C00FF]/10 border-t-[#4C00FF] rounded-full animate-spin" />
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Compiling history…</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <Info className="w-8 h-8 text-gray-300" />
                            </div>
                            <h3 className="text-gray-900 font-bold mb-2">No activity recorded</h3>
                            <p className="text-sm text-gray-400">Actions will appear here as the document is processed.</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Vertical timeline line */}
                            <div className="absolute left-[2.25rem] top-0 bottom-0 w-px bg-gray-100 z-0" />

                            <div className="space-y-6">
                                {logs.map((log, i) => {
                                    const config = EVENT_CONFIG[log.event_type]
                                    const Icon = config?.icon || Info
                                    return (
                                        <div key={log.id} className="relative pl-16 animate-fade-in group">
                                            {/* Timeline indicator dot */}
                                            <div className={`absolute left-[1.5rem] top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-gray-50 flex items-center justify-center transition-all z-10 ${log.event_type === 'document_completed' ? 'bg-emerald-500' :
                                                log.event_type === 'signature_submitted' ? 'bg-[#4C00FF]' :
                                                    'bg-white border-gray-100'
                                                }`} />

                                            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-start gap-5 relative z-10 transition-all group-hover:border-[#4C00FF]/20 group-hover:shadow-lg group-hover:shadow-gray-200/50">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${config?.bgColor || 'bg-gray-50'} ${config?.color || 'text-gray-400'} border-transparent`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                                                        <h4 className="text-sm font-bold text-gray-900 leading-none">{formatEventLabel(log)}</h4>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter shrink-0">
                                                            {new Date(log.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-3">
                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-50 border border-gray-100">
                                                            <User className="w-3 h-3 text-gray-400" />
                                                            <span className="text-[10px] font-bold text-gray-500 truncate max-w-[200px]">{log.actor_email}</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest leading-none">
                                                            {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </span>
                                                    </div>

                                                    {/* Metadata Expansion */}
                                                    {Object.keys(log.metadata).length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                            {Object.entries(log.metadata).map(([k, v]) => (
                                                                <div key={k} className="flex flex-col gap-0.5">
                                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{k}</span>
                                                                    <span className="text-[10px] font-mono text-gray-600 truncate">{String(v)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
