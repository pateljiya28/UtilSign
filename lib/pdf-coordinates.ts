/**
 * PDF coordinate helpers.
 *
 * COORDINATE SYSTEM NOTE:
 *   Browser (pdfjs-dist): origin = top-left, Y increases downward
 *   pdf-lib:              origin = bottom-left, Y increases upward
 *
 * Placeholders are stored as percentages of page size measured from
 * the browser's top-left origin. Before drawing into pdf-lib we must:
 *   1. Convert percentages → absolute points
 *   2. Flip the Y axis
 *
 * FORMULA:
 *   pdfX      = (xPercent      / 100) * pageWidth
 *   pdfWidth  = (widthPercent  / 100) * pageWidth
 *   pdfHeight = (heightPercent / 100) * pageHeight
 *   pdfY      = pageHeight - ((yPercent / 100) * pageHeight) - pdfHeight
 *
 * WORKED EXAMPLE (from spec):
 *   pageWidth=595pt, pageHeight=842pt
 *   xPercent=10, yPercent=70, widthPercent=30, heightPercent=8
 *
 *   pdfX      = (10/100) × 595  = 59.5 pt
 *   pdfWidth  = (30/100) × 595  = 178.5 pt
 *   pdfHeight = ( 8/100) × 842  = 67.36 pt
 *   pdfY      = 842 − (70/100 × 842) − 67.36
 *             = 842 − 589.4 − 67.36
 *             = 185.24 pt  ← bottom edge in pdf-lib space ✓
 */

export interface AbsoluteCoords {
    x: number
    y: number
    width: number
    height: number
}

/**
 * Convert percent-based placeholder values to absolute pt coordinates
 * in pdf-lib space (origin bottom-left, Y flipped).
 */
export function percentToAbsolute(
    xPercent: number,
    yPercent: number,
    widthPercent: number,
    heightPercent: number,
    pageWidth: number,
    pageHeight: number,
): AbsoluteCoords {
    const x = (xPercent / 100) * pageWidth
    const width = (widthPercent / 100) * pageWidth
    const height = (heightPercent / 100) * pageHeight
    // Flip Y: browser top → pdf-lib bottom
    const y = pageHeight - ((yPercent / 100) * pageHeight) - height

    return { x, y, width, height }
}
