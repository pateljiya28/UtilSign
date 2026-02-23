'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Check, Clock, Download, RefreshCw, ClipboardList, Info } from 'lucide-react'

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
    pending: { cls: 'bg-blue-50 text-blue-700 border-blue-100', label: 'Needs to Sign' },
    awaiting_turn: { cls: 'bg-gray-50 text-gray-500 border-gray-100', label: 'Waiting for Others' },
    signed: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', label: 'Signed' },
    declined: { cls: 'bg-red-50 text-red-700 border-red-100', label: 'Declined' },
}

const docStatusBadge: Record<string, { cls: string; label: string }> = {
    draft: { cls: 'bg-gray-100 text-gray-600 border-gray-200', label: 'Draft' },
    sent: { cls: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Sent' },
    in_progress: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'In Progress' },
    completed: { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Completed' },
    cancelled: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'Voided' },
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
        const interval = setInterval(() => {
            if (doc && (doc.status === 'completed' || doc.status === 'cancelled')) {
                clearInterval(interval)
                return
            }
            fetchStatus()
        }, 15000)
        return () => clearInterval(interval)
    }, [documentId, doc?.status])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-[#4C00FF]/10 border-t-[#4C00FF] rounded-full animate-spin" />
                    <p className="text-gray-500 font-bold text-sm uppercase tracking-widest">Loading status…</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ── Header ───────────────────────────────────────────────────────── */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 z-50">
                <div className="max-w-[1000px] mx-auto px-6 h-full flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Agreement</span>
                            <h1 className="text-sm font-bold text-gray-900 leading-none truncate max-w-[200px] sm:max-w-md">
                                {doc?.file_name}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/documents/${documentId}/logs`}
                            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-gray-600 font-bold text-xs hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100"
                        >
                            <ClipboardList className="w-4 h-4" /> Audit Logs
                        </Link>
                        <button
                            onClick={fetchStatus}
                            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={async () => {
                                setDownloading(true)
                                try {
                                    const res = await fetch(`/api/documents/${documentId}/download`)
                                    if (!res.ok) throw new Error('Download failed')
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
                            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[#4C00FF] text-xs font-bold text-white hover:bg-[#3C00CC] transition-all shadow-lg shadow-[#4C00FF]/20 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            {downloading ? 'Downloading…' : 'Download PDF'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-20 px-6">
                <div className="max-w-3xl mx-auto space-y-8">
                    {error && (
                        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 font-medium animate-shake">
                            {error}
                        </div>
                    )}

                    {/* Document card */}
                    {doc && (
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col sm:flex-row items-center p-8 gap-8">
                            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100 shrink-0">
                                <FileText className="w-10 h-10 text-[#4C00FF]" />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <h2 className="text-xl font-black text-gray-900 mb-1">{doc.file_name}</h2>
                                <p className="text-sm text-gray-500">
                                    Envelope ID: <span className="font-mono text-[10px] bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 uppercase">{doc.id.split('-')[0]}...</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                    Created {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="shrink-0 flex flex-col items-center sm:items-end gap-2">
                                <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${docStatusBadge[doc.status]?.cls ?? 'bg-white border-gray-200'}`}>
                                    {docStatusBadge[doc.status]?.label ?? doc.status}
                                </span>
                                {doc.status === 'completed' && (
                                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                                        <Check className="w-4 h-4" /> Legally Binding
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Signers section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Signing Status</h3>
                            <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Signed</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Pending</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {signers.map((signer, i) => (
                                <div key={signer.id} className="relative group">
                                    {/* Vertical line connector */}
                                    {i < signers.length - 1 && (
                                        <div className="absolute left-[2.25rem] top-12 bottom-0 w-px bg-gray-100 group-hover:bg-[#4C00FF]/20 transition-all z-0" />
                                    )}

                                    <div className={`bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-6 relative z-10 transition-all group-hover:border-[#4C00FF]/10 group-hover:shadow-lg group-hover:shadow-[#4C00FF]/5`}>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black shrink-0 shadow-sm border ${signer.status === 'signed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            signer.status === 'pending' || signer.status === 'awaiting_turn' ? 'bg-white text-gray-400 border-gray-100' :
                                                'bg-red-50 text-red-600 border-red-100'
                                            }`}>
                                            {signer.status === 'signed' ? <Check className="w-6 h-6" /> : signer.priority}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1">
                                                <h4 className="text-sm font-bold text-gray-900 truncate">{signer.email}</h4>
                                                <span className={`w-fit px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter border ${statusBadge[signer.status]?.cls}`}>
                                                    {statusBadge[signer.status]?.label ?? signer.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                Recipient {signer.priority}
                                                {signer.signed_at && (
                                                    <span className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
                                                        <Clock className="w-3 h-3" /> Signed {new Date(signer.signed_at).toLocaleString()}
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        {signer.status === 'pending' && (
                                            <div className="hidden sm:flex items-center gap-2 text-blue-500">
                                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Active</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer help */}
                    <div className="bg-[#4C00FF]/5 rounded-2xl border border-[#4C00FF]/10 p-6 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-[#4C00FF]/10 shrink-0 shadow-sm">
                            <Info className="w-5 h-5 text-[#4C00FF]" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 mb-1">Need to make changes?</h4>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                This envelope is currently active. If you need to fix a mistake or add signers, you must void this document and create a new one. All signers will be notified of the cancellation.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
