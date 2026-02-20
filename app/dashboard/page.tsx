import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        draft: 'badge-draft',
        sent: 'badge-sent',
        in_progress: 'badge-in-progress',
        completed: 'badge-completed',
        cancelled: 'badge-cancelled',
    }
    const label: Record<string, string> = {
        draft: 'Draft', sent: 'Sent', in_progress: 'In Progress',
        completed: 'Completed', cancelled: 'Cancelled',
    }
    return <span className={map[status] ?? 'badge'}>{label[status] ?? status}</span>
}

export default async function DashboardPage() {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const admin = createSupabaseAdminClient()
    const { data: documents } = await admin
        .from('documents')
        .select('id, file_name, status, created_at')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })

    const handleSignOut = async () => {
        'use server'
        const sb = await createSupabaseServerClient()
        await sb.auth.signOut()
        redirect('/auth/login')
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="page-header">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center text-sm">✍️</div>
                        <span className="font-bold text-white text-lg">UtilSign</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-sm hidden sm:block">{user.email}</span>
                        <form action={handleSignOut}>
                            <button type="submit" className="btn-secondary text-xs px-3 py-1.5">Sign out</button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Body */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Documents</h1>
                        <p className="text-slate-400 text-sm mt-0.5">Manage your signing workflows</p>
                    </div>
                    <Link href="/documents/new" className="btn-primary">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        New Document
                    </Link>
                </div>

                {(!documents || documents.length === 0) ? (
                    <div className="card p-16 flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-3xl">📄</div>
                        <div>
                            <p className="text-white font-semibold mb-1">No documents yet</p>
                            <p className="text-slate-400 text-sm">Upload a PDF and set up your first signing workflow.</p>
                        </div>
                        <Link href="/documents/new" className="btn-primary mt-2">Create your first document</Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {documents.map(doc => (
                            <div key={doc.id} className="card-hover p-5 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-brand-900/40 border border-brand-800/40 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">{doc.file_name}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                <StatusBadge status={doc.status} />
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Link
                                        href={`/documents/${doc.id}/status`}
                                        className="btn-secondary text-xs px-3 py-1.5"
                                    >
                                        Status
                                    </Link>
                                    <Link
                                        href={`/documents/${doc.id}/logs`}
                                        className="btn-secondary text-xs px-3 py-1.5 gap-1"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        Logs
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    )
}
