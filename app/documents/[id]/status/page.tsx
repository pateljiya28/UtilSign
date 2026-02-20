'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface SignerData {
    id: string
    email: string
    priority: number
    status: string
    signed_at: string | null
    created_at: string
}

interface DocData {
    id: string
    file_name: string
    status: string
    created_at: string
}

const statusBadge: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'badge-pending', label: 'Pending' },
    awaiting_turn: { cls: 'badge-awaiting', label: 'Awaiting Turn' },
    signed: { cls: 'badge-signed', label: 'Signed' },
    declined: { cls: 'badge-declined', label: 'Declined' },
}

const docStatusBadge: Record<string, { cls: string; label: string }> = {
    draft: { cls: 'badge-draft', label: 'Draft' },
    sent: { cls: 'badge-sent', label: 'Sent' },
    in_progress: { cls: 'badge-in-progress', label: 'In Progress' },
    completed: { cls: 'badge-completed', label: 'Completed' },
    cancelled: { cls: 'badge-cancelled', label: 'Cancelled' },
}

export default function DocumentStatusPage() {
    const router = useRouter()
    const params = useParams()
    const documentId = params.id as string

    const [doc, setDoc] = useState<DocData | null>(null)
    const [signers, setSigners] = useState<SignerData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [downloading, setDownloading] = useState(false)

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/documents/${documentId}/status`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setDoc(data.document)
            setSigners(data.signers)
            setError('')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch status')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStatus()
        const interval = setInterval(fetchStatus, 10000) // Poll every 10s
        return () => clearInterval(interval)
    }, [documentId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading status…
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            <header className="page-header">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/dashboard')} className="text-slate-400 hover:text-white transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <span className="font-bold text-white">Document Status</span>
                    </div>
                    <div className="flex gap-2">
                        <Link href={`/documents/${documentId}/logs`} className="btn-secondary text-xs px-3 py-1.5 gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Audit Logs
                        </Link>
                        <button onClick={fetchStatus} className="btn-secondary text-xs px-3 py-1.5">↻ Refresh</button>
                        <button
                            onClick={async () => {
                                setDownloading(true)
                                try {
                                    const res = await fetch(`/api/documents/${documentId}/download`)
                                    if (!res.ok) {
                                        const data = await res.json()
                                        throw new Error(data.error ?? 'Download failed')
                                    }
                                    const blob = await res.blob()
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `signed_${doc?.file_name ?? 'document.pdf'}`
                                    document.body.appendChild(a)
                                    a.click()
                                    document.body.removeChild(a)
                                    URL.revokeObjectURL(url)
                                } catch (err) {
                                    setError(err instanceof Error ? err.message : 'Download failed')
                                } finally {
                                    setDownloading(false)
                                }
                            }}
                            disabled={downloading}
                            className="btn-primary text-xs px-3 py-1.5 gap-1"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            {downloading ? 'Downloading…' : 'Download PDF'}
                        </button>
                    </div>
                </div>
            </header>

            {error && (
                <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-4">
                    <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
                </div>
            )}

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
                {/* Document info */}
                {doc && (
                    <div className="card p-6 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-brand-900/40 border border-brand-800/40 flex items-center justify-center">
                                <svg className="w-6 h-6 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h1 className="text-lg font-bold text-white">{doc.file_name}</h1>
                                <p className="text-slate-500 text-xs mt-0.5">
                                    Created {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <span className={docStatusBadge[doc.status]?.cls ?? 'badge'}>{docStatusBadge[doc.status]?.label ?? doc.status}</span>
                        </div>
                    </div>
                )}

                {/* Signers timeline */}
                <h2 className="text-base font-bold text-white mb-4">Signing Progress</h2>
                <div className="space-y-3">
                    {signers.map((signer, i) => (
                        <div key={signer.id} className="card p-5">
                            <div className="flex items-center gap-4">
                                {/* Priority number */}
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${signer.status === 'signed' ? 'bg-emerald-600 text-white' :
                                    signer.status === 'awaiting_turn' ? 'bg-amber-500 text-white animate-pulse-slow' :
                                        signer.status === 'declined' ? 'bg-red-600 text-white' :
                                            'bg-slate-800 text-slate-500'
                                    }`}>
                                    {signer.status === 'signed' ? '✓' : signer.priority}
                                </div>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium">{signer.email}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        Priority #{signer.priority}
                                        {signer.signed_at && ` · Signed ${new Date(signer.signed_at).toLocaleString()}`}
                                    </p>
                                </div>
                                {/* Badge */}
                                <span className={statusBadge[signer.status]?.cls ?? 'badge'}>
                                    {statusBadge[signer.status]?.label ?? signer.status}
                                </span>
                            </div>
                            {/* Connector line */}
                            {i < signers.length - 1 && (
                                <div className="flex justify-center mt-3">
                                    <div className={`w-px h-6 ${signer.status === 'signed' ? 'bg-emerald-600' : 'bg-slate-700'}`} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
        </div>
    )
}
