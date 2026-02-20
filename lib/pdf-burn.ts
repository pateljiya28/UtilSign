import { PDFDocument } from 'pdf-lib'
import { percentToAbsolute } from '@/lib/pdf-coordinates'

export interface SignatureInput {
    placeholder: {
        page_number: number
        x_percent: number
        y_percent: number
        width_percent: number
        height_percent: number
    }
    imageBase64: string // data:image/png;base64,... or raw base64
}

/**
 * Burn all signatures into the PDF in-memory and return the new bytes.
 *
 * Steps per signature:
 *  1. Get the target page (page_number is 1-indexed)
 *  2. Get page dimensions in pt
 *  3. Convert percent placeholders → absolute pt using percentToAbsolute
 *     (includes Y-axis flip: browser top-left → pdf-lib bottom-left)
 *  4. Strip the data-URI prefix, decode base64 → Buffer
 *  5. Embed as PNG, draw at the computed position
 */
export async function burnSignaturesIntoPDF(
    pdfBytes: Uint8Array,
    signatures: SignatureInput[],
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    for (const sig of signatures) {
        const pageIndex = sig.placeholder.page_number - 1
        const page = pages[pageIndex]
        if (!page) {
            throw new Error(`Page ${sig.placeholder.page_number} does not exist in the PDF`)
        }

        const { width: pageWidth, height: pageHeight } = page.getSize()

        const { x, y, width, height } = percentToAbsolute(
            sig.placeholder.x_percent,
            sig.placeholder.y_percent,
            sig.placeholder.width_percent,
            sig.placeholder.height_percent,
            pageWidth,
            pageHeight,
        )

        // Strip data-URI prefix if present
        const base64Data = sig.imageBase64.replace(/^data:image\/\w+;base64,/, '')
        const imgBuffer = Buffer.from(base64Data, 'base64')

        const pdfImage = await pdfDoc.embedPng(imgBuffer)
        page.drawImage(pdfImage, { x, y, width, height })
    }

    return pdfDoc.save()
}
