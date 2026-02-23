import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
    try {
        // ── Auth ──────────────────────────────────────────────────────────────
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const filter = req.nextUrl.searchParams.get('filter') || 'inbox'
        const admin = createSupabaseAdminClient()
        const userEmail = user.email ?? ''

        let results: Record<string, unknown>[] = []

        switch (filter) {
            case 'inbox': {
                // Documents where the user is a signer (others sent TO me)
                const { data: signerRows } = await admin
                    .from('signers')
                    .select('document_id')
                    .eq('email', userEmail)
                    .in('status', ['pending', 'awaiting_turn'])

                const docIds = Array.from(new Set((signerRows ?? []).map(r => r.document_id)))
                if (docIds.length > 0) {
                    const { data, error } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, category, created_at, updated_at')
                        .in('id', docIds)
                        .order('created_at', { ascending: false })

                    if (error) {
                        const { data: fallback } = await admin
                            .from('documents')
                            .select('id, file_name, status, type, created_at')
                            .in('id', docIds)
                            .order('created_at', { ascending: false })
                        results = fallback ?? []
                    } else {
                        results = data ?? []
                    }
                }
                break
            }
            case 'sent': {
                const { data, error } = await admin
                    .from('documents')
                    .select('id, file_name, status, type, category, created_at, updated_at')
                    .eq('sender_id', user.id)
                    .eq('type', 'request_sign')
                    .in('status', ['sent', 'in_progress'])
                    .order('created_at', { ascending: false })

                if (error) {
                    const { data: fallback } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, created_at')
                        .eq('sender_id', user.id)
                        .eq('type', 'request_sign')
                        .in('status', ['sent', 'in_progress'])
                        .order('created_at', { ascending: false })
                    results = fallback ?? []
                } else {
                    results = data ?? []
                }
                break
            }
            case 'completed': {
                // Docs I sent that are completed, OR docs where I signed
                const query = admin
                    .from('documents')
                    .select('id, file_name, status, type, category, created_at, updated_at')
                    .eq('sender_id', user.id)
                    .eq('status', 'completed')
                    .order('created_at', { ascending: false })

                const { data: myDocs, error: myError } = await query
                let finalMyDocs = []

                if (myError) {
                    const { data: fallback } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, created_at')
                        .eq('sender_id', user.id)
                        .eq('status', 'completed')
                        .order('created_at', { ascending: false })
                    finalMyDocs = fallback ?? []
                } else {
                    finalMyDocs = myDocs ?? []
                }

                const { data: signedRows } = await admin
                    .from('signers')
                    .select('document_id')
                    .eq('email', userEmail)
                    .eq('status', 'signed')

                const signedDocIds = Array.from(new Set((signedRows ?? []).map(r => r.document_id)))
                    .filter(id => !finalMyDocs.some(d => d.id === id))

                let signedDocs: Record<string, unknown>[] = []
                if (signedDocIds.length > 0) {
                    const { data, error: sError } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, category, created_at, updated_at')
                        .in('id', signedDocIds)
                        .order('created_at', { ascending: false })

                    if (sError) {
                        const { data: fallback } = await admin
                            .from('documents')
                            .select('id, file_name, status, type, created_at')
                            .in('id', signedDocIds)
                            .order('created_at', { ascending: false })
                        signedDocs = fallback ?? []
                    } else {
                        signedDocs = data ?? []
                    }
                }

                results = [...finalMyDocs, ...signedDocs]
                break
            }
            case 'action_required': {
                // Docs where it is MY turn to sign right now
                const { data: signerRows } = await admin
                    .from('signers')
                    .select('document_id')
                    .eq('email', userEmail)
                    .eq('status', 'pending')

                const docIds = Array.from(new Set((signerRows ?? []).map(r => r.document_id)))
                if (docIds.length > 0) {
                    const { data, error } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, category, created_at, updated_at')
                        .in('id', docIds)
                        .in('status', ['sent', 'in_progress'])
                        .order('created_at', { ascending: false })

                    if (error) {
                        const { data: fallback } = await admin
                            .from('documents')
                            .select('id, file_name, status, type, created_at')
                            .in('id', docIds)
                            .in('status', ['sent', 'in_progress'])
                            .order('created_at', { ascending: false })
                        results = fallback ?? []
                    } else {
                        results = data ?? []
                    }
                }
                break
            }
            case 'drafts': {
                const { data, error } = await admin
                    .from('documents')
                    .select('id, file_name, status, type, category, created_at, updated_at')
                    .eq('sender_id', user.id)
                    .eq('status', 'draft')
                    .order('created_at', { ascending: false })

                if (error) {
                    const { data: fallback } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, created_at')
                        .eq('sender_id', user.id)
                        .eq('status', 'draft')
                        .order('created_at', { ascending: false })
                    results = fallback ?? []
                } else {
                    results = data ?? []
                }
                break
            }
            case 'deleted': {
                const { data } = await admin
                    .from('documents')
                    .select('id, file_name, status, type, category, created_at, deleted_at, updated_at')
                    .eq('sender_id', user.id)
                    .not('deleted_at', 'is', null)
                    .order('deleted_at', { ascending: false })
                results = data ?? []
                break
            }
            case 'waiting': {
                // Docs I sent that are waiting for others to sign
                const { data, error } = await admin
                    .from('documents')
                    .select('id, file_name, status, type, category, created_at, updated_at')
                    .eq('sender_id', user.id)
                    .in('status', ['sent', 'in_progress'])
                    .order('created_at', { ascending: false })

                if (error) {
                    const { data: fallback } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, created_at')
                        .eq('sender_id', user.id)
                        .in('status', ['sent', 'in_progress'])
                        .order('created_at', { ascending: false })
                    results = fallback ?? []
                } else {
                    results = data ?? []
                }
                break
            }
            case 'expiring': {
                // Docs created more than 25 days ago that are not yet completed
                const twentyFiveDaysAgo = new Date()
                twentyFiveDaysAgo.setDate(twentyFiveDaysAgo.getDate() - 25)

                const { data, error } = await admin
                    .from('documents')
                    .select('id, file_name, status, type, category, created_at, updated_at')
                    .eq('sender_id', user.id)
                    .lt('created_at', twentyFiveDaysAgo.toISOString())
                    .not('status', 'in', '("completed","cancelled")')
                    .order('created_at', { ascending: false })

                if (error) {
                    const { data: fallback } = await admin
                        .from('documents')
                        .select('id, file_name, status, type, created_at')
                        .eq('sender_id', user.id)
                        .lt('created_at', twentyFiveDaysAgo.toISOString())
                        .not('status', 'in', '("completed","cancelled")')
                        .order('created_at', { ascending: false })
                    results = fallback ?? []
                } else {
                    results = data ?? []
                }
                break
            }
            default:
                return NextResponse.json({ error: 'Invalid filter' }, { status: 400 })
        }

        return NextResponse.json({ documents: results })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
