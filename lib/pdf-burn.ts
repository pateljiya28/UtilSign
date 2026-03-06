import { PDFDocument, PDFName, PDFString, PDFArray, StandardFonts } from 'pdf-lib'

interface BurnInput {
    placeholder: {
        page_number: number
        x_percent: number
        y_percent: number
        width_percent: number
        height_percent: number
    }
    imageBase64: string
    signerName?: string
    signerEmail?: string
    signerDesignation?: string
    signedAt?: string
}

/**
 * Burns signature images into a PDF. Adds hover tooltip annotations
 * sized to the text content showing signer info.
 */
export async function burnSignaturesIntoPDF(
    pdfBytes: Uint8Array,
    inputs: BurnInput[]
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    // Embed font to measure tooltip text width
    const hasInfo = inputs.some(i => i.signerEmail || i.signerName || i.signerDesignation)
    const font = hasInfo ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null

    for (const input of inputs) {
        const { placeholder, imageBase64 } = input
        const pageIdx = placeholder.page_number - 1

        if (pageIdx < 0 || pageIdx >= pages.length) {
            console.warn(`[pdf-burn] Invalid page number: ${placeholder.page_number}`)
            continue
        }

        const page = pages[pageIdx]
        const { width, height } = page.getSize()

        // Embed the image
        let image
        try {
            if (imageBase64.includes('image/png')) {
                image = await pdfDoc.embedPng(imageBase64)
            } else if (imageBase64.includes('image/jpeg') || imageBase64.includes('image/jpg')) {
                image = await pdfDoc.embedJpg(imageBase64)
            } else {
                image = await pdfDoc.embedPng(imageBase64)
            }
        } catch (err) {
            console.error(`[pdf-burn] Failed to embed image:`, err)
            continue
        }

        // Calculate absolute coordinates (UI top-left % → pdf-lib bottom-left pt)
        const absX = (placeholder.x_percent / 100) * width
        const absW = (placeholder.width_percent / 100) * width
        const absH = (placeholder.height_percent / 100) * height
        const absY = height - ((placeholder.y_percent / 100) * height) - absH

        page.drawImage(image, {
            x: absX,
            y: absY,
            width: absW,
            height: absH,
        })

        // ── Add hover tooltip annotation sized to text ──────────────────────
        if (font && (input.signerEmail || input.signerName || input.signerDesignation)) {
            const lines: string[] = []
            if (input.signerDesignation) lines.push(`Designation: ${input.signerDesignation}`)
            if (input.signerEmail) lines.push(`Email: ${input.signerEmail}`)

            // Format timestamp
            const ts = (input.signedAt ? new Date(input.signedAt) : new Date())
                .toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                    hour12: true,
                })
            lines.push(`Signed: ${ts}`)

            const tooltipText = lines.join('\n')
            const titleText = input.signerDesignation || input.signerName || input.signerEmail || 'Signer'

            // Measure text to size the annotation box
            const tooltipFontSize = 8
            const lineH = tooltipFontSize + 3
            const padding = 4
            const textWidths = lines.map(l => font.widthOfTextAtSize(l, tooltipFontSize))
            const maxW = Math.max(...textWidths) + padding * 2
            const totalH = lines.length * lineH + padding * 2

            // Position: overlay the signature itself so hover triggers on the sign
            // Rect = [x1, y1, x2, y2] covering the signature area
            try {
                const annotDict = pdfDoc.context.obj({
                    Type: 'Annot',
                    Subtype: 'Square',
                    Rect: [absX, absY, absX + absW, absY + absH],
                    Contents: PDFString.of(tooltipText),
                    T: PDFString.of(titleText),
                    C: [],
                    IC: [],
                    F: 292,   // Hidden + ReadOnly + NoZoom + NoRotate (not printed, not visible)
                    BS: pdfDoc.context.obj({ W: 0, S: 'S' }),
                })

                const annotRef = pdfDoc.context.register(annotDict)

                const pageDict = page.node
                const existingAnnots = pageDict.lookup(PDFName.of('Annots'))
                if (existingAnnots instanceof PDFArray) {
                    existingAnnots.push(annotRef)
                } else {
                    pageDict.set(PDFName.of('Annots'), pdfDoc.context.obj([annotRef]))
                }
            } catch (annotErr) {
                console.warn('[pdf-burn] Failed to add tooltip annotation:', annotErr)
            }
        }
    }

    return await pdfDoc.save()
}
