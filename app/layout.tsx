import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'UtilSign — Secure E-Signature Platform',
    description: 'Send, sign, and manage documents electronically with priority-based signing workflows.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Prevent flash of wrong theme */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function(){
                        try {
                            var t = localStorage.getItem('utilsign-theme');
                            if (t === 'light') document.documentElement.classList.add('light');
                        } catch(e){}
                    })();
                `}} />
            </head>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    )
}
