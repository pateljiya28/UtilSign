import type { Metadata } from 'next'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'UtilSign — Secure E-Signature Platform',
    description: 'Send, sign, and manage documents electronically with priority-based signing workflows.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    )
}
