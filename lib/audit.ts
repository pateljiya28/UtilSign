import { createSupabaseAdminClient } from '@/lib/supabase'

export type AuditEventType =
    | 'document_created'
    | 'document_sent'
    | 'email_delivered'
    | 'email_failed'
    | 'broadcast_sent'
    | 'progress_notification_sent'
    | 'link_opened'
    | 'otp_sent'
    | 'otp_verified'
    | 'otp_failed'
    | 'otp_locked'
    | 'placeholder_viewed'
    | 'signature_submitted'
    | 'pdf_burned'
    | 'signer_declined'
    | 'next_signer_notified'
    | 'document_completed'
    | 'document_downloaded'

interface LogEventParams {
    documentId: string
    signerId?: string
    actorEmail: string
    event: AuditEventType
    metadata?: Record<string, unknown>
}

/**
 * Insert an audit log row. This function NEVER throws — 
 * wrapped in try/catch so a logging failure cannot break the main flow.
 */
export async function logEvent({
    documentId,
    signerId,
    actorEmail,
    event,
    metadata = {},
}: LogEventParams): Promise<void> {
    try {
        const supabase = createSupabaseAdminClient()
        await supabase.from('audit_logs').insert({
            document_id: documentId,
            signer_id: signerId ?? null,
            actor_email: actorEmail,
            event_type: event,
            metadata,
        })
    } catch {
        // Intentionally silent — logging must never break the main flow
    }
}
