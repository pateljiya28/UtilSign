import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
    document_created: 'Document Created',
    document_sent: 'Document Sent',
    email_delivered: 'Email Delivered',
    email_failed: 'Email Failed',
    link_opened: 'Signing Link Opened',
    otp_sent: 'OTP Sent',
    otp_verified: 'OTP Verified',
    otp_failed: 'OTP Failed',
    otp_locked: 'OTP Locked',
    placeholder_viewed: 'Placeholders Viewed',
    signature_submitted: 'Signature Submitted',
    pdf_burned: 'Signatures Applied to PDF',
    signer_declined: 'Signer Declined',
    next_signer_notified: 'Next Signer Notified',
    document_completed: 'Document Completed',
    document_downloaded: 'Document Downloaded',
}

function formatDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true,
    })
}

// Draws wrapped text and returns the new Y position
function drawWrappedText(
    page: ReturnType<PDFDocument['addPage']>,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    fontSize: number,
    color: ReturnType<typeof rgb>
): number {
    const words = text.split(' ')
    let line = ''
    for (const word of words) {
        const test = line ? `${line} ${word}` : word
        const w = font.widthOfTextAtSize(test, fontSize)
        if (w > maxWidth && line) {
            page.drawText(line, { x, y, font, size: fontSize, color })
            y -= lineHeight
            line = word
        } else {
            line = test
        }
    }
    if (line) {
        page.drawText(line, { x, y, font, size: fontSize, color })
        y -= lineHeight
    }
    return y
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: documentId } = await params

        // ── Auth ────────────────────────────────────────────────────────────────
        const supabase = await createSupabaseServerClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const admin = createSupabaseAdminClient()

        // ── Verify document ownership ──────────────────────────────────────────
        const { data: doc, error: docError } = await admin
            .from('documents')
            .select('id, file_name, file_path, sender_id, created_at')
            .eq('id', documentId)
            .eq('sender_id', user.id)
            .single()

        if (docError || !doc) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        // ── Download the PDF from Supabase Storage ──────────────────────────────
        const { data: fileData, error: downloadErr } = await admin.storage
            .from('documents')
            .download(doc.file_path)

        if (downloadErr || !fileData) {
            return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
        }

        // ── Fetch audit logs ────────────────────────────────────────────────────
        const { data: logs } = await admin
            .from('audit_logs')
            .select('actor_email, event_type, metadata, created_at')
            .eq('document_id', documentId)
            .order('created_at', { ascending: true })

        // ── Fetch signers ───────────────────────────────────────────────────────
        const { data: signers } = await admin
            .from('signers')
            .select('email, priority, status, signed_at')
            .eq('document_id', documentId)
            .order('priority', { ascending: true })

        // ── Load the signed PDF ─────────────────────────────────────────────────
        const srcBytes = await fileData.arrayBuffer()
        const pdfDoc = await PDFDocument.load(srcBytes)

        // ── Embed fonts ─────────────────────────────────────────────────────────
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

        // ── Page layout constants ───────────────────────────────────────────────
        const PAGE_W = 595   // A4 width  (pt)
        const PAGE_H = 842   // A4 height (pt)
        const MARGIN = 48
        const CONTENT_W = PAGE_W - MARGIN * 2

        // Accent colours
        const INDIGO = rgb(0.31, 0.27, 0.90)   // #4f46e5
        const INDIGOlt = rgb(0.94, 0.94, 1.00)   // background stripe
        const DARK = rgb(0.12, 0.10, 0.29)   // #1e1b4b
        const GREY = rgb(0.29, 0.34, 0.42)   // #4b5563
        const LGREY = rgb(0.60, 0.63, 0.67)   // #9ca3af
        const WHITE = rgb(1, 1, 1)
        const GREEN = rgb(0.04, 0.60, 0.42)   // #059669
        const RED = rgb(0.86, 0.15, 0.15)

        // ── Add audit page ──────────────────────────────────────────────────────
        const page = pdfDoc.addPage([PAGE_W, PAGE_H])

        let y = PAGE_H - MARGIN

        // ────────── Header banner ──────────────────────────────────────────────
        page.drawRectangle({
            x: 0, y: PAGE_H - 70,
            width: PAGE_W, height: 70,
            color: INDIGO,
        })
        page.drawText('UtilSign  Audit Trail', {
            x: MARGIN, y: PAGE_H - 34,
            font: fontBold, size: 17, color: WHITE,
        })
        page.drawText('Certificate of Completion & Event Log', {
            x: MARGIN, y: PAGE_H - 54,
            font: fontRegular, size: 10, color: rgb(0.8, 0.8, 1),
        })

        y = PAGE_H - 90

        // ────────── Document metadata block ───────────────────────────────────
        page.drawRectangle({
            x: MARGIN, y: y - 54,
            width: CONTENT_W, height: 60,
            color: INDIGOlt,
            borderColor: INDIGO,
            borderWidth: 0.5,
        })
        page.drawText('Document', { x: MARGIN + 12, y: y - 12, font: fontBold, size: 9, color: INDIGO })
        page.drawText(doc.file_name, { x: MARGIN + 12, y: y - 26, font: fontBold, size: 12, color: DARK })
        page.drawText(`Document ID: ${doc.id}`, { x: MARGIN + 12, y: y - 42, font: fontRegular, size: 8, color: LGREY })

        y -= 70

        // ────────── Signers summary table ─────────────────────────────────────
        if (signers && signers.length > 0) {
            page.drawText('SIGNERS', { x: MARGIN, y, font: fontBold, size: 9, color: INDIGO })
            y -= 14

            // Header row
            page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 18, color: INDIGO })
            page.drawText('#', { x: MARGIN + 6, y: y - 12, font: fontBold, size: 8, color: WHITE })
            page.drawText('Email', { x: MARGIN + 24, y: y - 12, font: fontBold, size: 8, color: WHITE })
            page.drawText('Status', { x: MARGIN + 280, y: y - 12, font: fontBold, size: 8, color: WHITE })
            page.drawText('Signed At', { x: MARGIN + 365, y: y - 12, font: fontBold, size: 8, color: WHITE })
            y -= 18

            for (let i = 0; i < signers.length; i++) {
                const s = signers[i]
                const rowColor = i % 2 === 0 ? WHITE : INDIGOlt
                page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 16, color: rowColor })
                page.drawText(String(s.priority), { x: MARGIN + 6, y: y - 10, font: fontRegular, size: 8, color: GREY })
                page.drawText(s.email, { x: MARGIN + 24, y: y - 10, font: fontRegular, size: 8, color: DARK })
                const statusColor = s.status === 'signed' ? GREEN : s.status === 'declined' ? RED : GREY
                page.drawText(s.status.toUpperCase(), { x: MARGIN + 280, y: y - 10, font: fontBold, size: 7, color: statusColor })
                page.drawText(s.signed_at ? formatDate(s.signed_at) : '-', {
                    x: MARGIN + 365, y: y - 10, font: fontRegular, size: 7, color: GREY,
                })
                y -= 16
            }
            y -= 10
        }

        // ────────── Audit events ───────────────────────────────────────────────
        // Event-type → row background colour
        const ROW_COLORS: Record<string, ReturnType<typeof rgb>> = {
            document_sent: rgb(0.88, 0.93, 1.00),  // light blue
            email_delivered: rgb(0.88, 0.93, 1.00),
            next_signer_notified: rgb(0.88, 0.93, 1.00),
            broadcast_sent: rgb(0.88, 0.93, 1.00),

            signature_submitted: rgb(0.88, 0.98, 0.92),  // light green
            pdf_burned: rgb(0.88, 0.98, 0.92),
            document_completed: rgb(0.88, 0.98, 0.92),
            otp_verified: rgb(0.88, 0.98, 0.92),

            link_opened: rgb(0.94, 0.94, 0.94),  // light grey
            placeholder_viewed: rgb(0.94, 0.94, 0.94),
            document_downloaded: rgb(0.94, 0.94, 0.94),
            document_created: rgb(0.94, 0.94, 0.94),

            otp_sent: rgb(1.00, 0.97, 0.88),  // light amber
            otp_failed: rgb(1.00, 0.97, 0.88),
            otp_locked: rgb(1.00, 0.97, 0.88),

            signer_declined: rgb(1.00, 0.90, 0.90),  // light red
            email_failed: rgb(1.00, 0.90, 0.90),
        }
        const getRowColor = (eventType: string) => ROW_COLORS[eventType] ?? INDIGOlt

        page.drawText('AUDIT LOG', { x: MARGIN, y, font: fontBold, size: 9, color: INDIGO })
        y -= 14

        // Table header
        page.drawRectangle({ x: MARGIN, y: y - 16, width: CONTENT_W, height: 18, color: INDIGO })
        page.drawText('Timestamp', { x: MARGIN + 6, y: y - 12, font: fontBold, size: 8, color: WHITE })
        page.drawText('Event', { x: MARGIN + 145, y: y - 12, font: fontBold, size: 8, color: WHITE })
        page.drawText('Actor', { x: MARGIN + 310, y: y - 12, font: fontBold, size: 8, color: WHITE })
        y -= 18

        const auditRows = logs ?? []
        for (let i = 0; i < auditRows.length; i++) {
            const log = auditRows[i]

            // Start a new page if we're running low
            if (y < MARGIN + 40) {
                const overflow = pdfDoc.addPage([PAGE_W, PAGE_H])
                // carry over header on continuation pages
                overflow.drawRectangle({ x: 0, y: PAGE_H - 30, width: PAGE_W, height: 30, color: INDIGO })
                overflow.drawText('UtilSign Audit Trail (continued)', {
                    x: MARGIN, y: PAGE_H - 20, font: fontBold, size: 10, color: WHITE,
                })
                // Add header row again
                overflow.drawRectangle({ x: MARGIN, y: PAGE_H - 50, width: CONTENT_W, height: 18, color: INDIGO })
                overflow.drawText('Timestamp', { x: MARGIN + 6, y: PAGE_H - 64, font: fontBold, size: 8, color: WHITE })
                overflow.drawText('Event', { x: MARGIN + 145, y: PAGE_H - 64, font: fontBold, size: 8, color: WHITE })
                overflow.drawText('Actor', { x: MARGIN + 310, y: PAGE_H - 64, font: fontBold, size: 8, color: WHITE })
                y = PAGE_H - 68
                // Draw remaining rows on new page
                for (let j = i; j < auditRows.length; j++) {
                    const l = auditRows[j]
                    const rowBg = getRowColor(l.event_type)
                    overflow.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 16, color: rowBg })
                    overflow.drawText(formatDate(l.created_at), { x: MARGIN + 6, y: y - 10, font: fontRegular, size: 7, color: GREY })
                    overflow.drawText(EVENT_LABELS[l.event_type] ?? l.event_type, { x: MARGIN + 145, y: y - 10, font: fontBold, size: 7.5, color: DARK })
                    overflow.drawText(l.actor_email ?? '-', { x: MARGIN + 310, y: y - 10, font: fontRegular, size: 7, color: GREY })
                    y -= 16
                    if (y < MARGIN + 24 && j < auditRows.length - 1) break
                }
                break // done
            }

            const rowBg = getRowColor(log.event_type)
            page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_W, height: 16, color: rowBg })
            page.drawText(formatDate(log.created_at), { x: MARGIN + 6, y: y - 10, font: fontRegular, size: 7, color: GREY })
            page.drawText(EVENT_LABELS[log.event_type] ?? log.event_type, { x: MARGIN + 145, y: y - 10, font: fontBold, size: 7.5, color: DARK })
            page.drawText(log.actor_email ?? '-', { x: MARGIN + 310, y: y - 10, font: fontRegular, size: 7, color: GREY })
            y -= 16
        }

        // ────────── Footer bar ─────────────────────────────────────────────────
        page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 28, color: INDIGOlt })
        page.drawText(
            `Generated by UtilSign • ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`,
            { x: MARGIN, y: 10, font: fontRegular, size: 8, color: LGREY }
        )
        page.drawText('This document is legally binding.', {
            x: PAGE_W - MARGIN - 170, y: 10, font: fontRegular, size: 8, color: LGREY,
        })

        // ── Serialize the final PDF ─────────────────────────────────────────────
        const finalBytes = await pdfDoc.save()
        const safeName = doc.file_name.replace(/[^a-zA-Z0-9._-]/g, '_')

        return new NextResponse(finalBytes.buffer as ArrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="signed_${safeName}"`,
                'Content-Length': String(finalBytes.byteLength),
            },
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
