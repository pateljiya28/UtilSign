import { PDFDocument } from 'pdf-lib'

interface BurnInput {
    placeholder: {
        page_number: number
        x_percent: number
        y_percent: number
        width_percent: number
        height_percent: number
    }
    imageBase64: string
}

/**
 * Burns one or more signature images into a PDF document at specified coordinates.
 * Coordinates are provided as percentages of page width/height, measured from top-left.
 */
export async function burnSignaturesIntoPDF(
    pdfBytes: Uint8Array,
    inputs: BurnInput[]
): Promise<Uint8Array> {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    for (const input of inputs) {
        const { placeholder, imageBase64 } = input
        const pageIdx = placeholder.page_number - 1

        if (pageIdx < 0 || pageIdx >= pages.length) {
            console.warn(`[pdf-burn] Invalid page number: ${placeholder.page_number}`)
            continue
        }

        const page = pages[pageIdx]
        const { width, height } = page.getSize()

        // Embed the image (handle both PNG and JPG data URLs)
        let image
        try {
            if (imageBase64.includes('image/png')) {
                image = await pdfDoc.embedPng(imageBase64)
            } else if (imageBase64.includes('image/jpeg') || imageBase64.includes('image/jpg')) {
                image = await pdfDoc.embedJpg(imageBase64)
            } else {
                // Fallback: try embedding as PNG if no prefix
                image = await pdfDoc.embedPng(imageBase64)
            }
        } catch (err) {
            console.error(`[pdf-burn] Failed to embed image for placeholder ${input.placeholder.page_number}:`, err)
            continue
        }

        // Calculate absolute coordinates
        // UI provides percentages from Top-Left. 
        // pdf-lib uses points from Bottom-Left.
        const absX = (placeholder.x_percent / 100) * width
        const absW = (placeholder.width_percent / 100) * width
        const absH = (placeholder.height_percent / 100) * height

        // y_percent is distance from top.
        // height - distance_from_top = distance_from_bottom.
        // But drawImage's 'y' is the bottom edge of the image, so we subtract height of image too.
        const absY = height - ((placeholder.y_percent / 100) * height) - absH

        page.drawImage(image, {
            x: absX,
            y: absY,
            width: absW,
            height: absH,
        })
    }

    return await pdfDoc.save()
}
