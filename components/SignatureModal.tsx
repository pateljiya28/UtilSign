'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import SignaturePad from 'signature_pad'

interface SignatureModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (imageBase64: string) => void
}

type TabType = 'draw' | 'type' | 'upload'

const SIGNATURE_FONTS = [
    { name: 'Dancing Script', css: '"Dancing Script", cursive' },
    { name: 'Great Vibes', css: '"Great Vibes", cursive' },
    { name: 'Sacramento', css: '"Sacramento", cursive' },
    { name: 'Pacifico', css: '"Pacifico", cursive' },
    { name: 'Caveat', css: '"Caveat", cursive' },
]

export default function SignatureModal({ isOpen, onClose, onConfirm }: SignatureModalProps) {
    const [tab, setTab] = useState<TabType>('draw')
    const [signatureData, setSignatureData] = useState<string | null>(null)

    // ── Draw tab ────────────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const sigPadRef = useRef<SignaturePad | null>(null)

    useEffect(() => {
        if (isOpen && tab === 'draw' && canvasRef.current && !sigPadRef.current) {
            const canvas = canvasRef.current
            const ratio = Math.max(window.devicePixelRatio || 1, 1)
            canvas.width = canvas.offsetWidth * ratio
            canvas.height = canvas.offsetHeight * ratio
            const ctx = canvas.getContext('2d')!
            ctx.scale(ratio, ratio)
            sigPadRef.current = new SignaturePad(canvas, {
                penColor: '#1e1b4b',
                backgroundColor: 'rgba(255,255,255,0)',
            })
        }
        return () => {
            if (sigPadRef.current) {
                sigPadRef.current.off()
                sigPadRef.current = null
            }
        }
    }, [isOpen, tab])

    const clearDraw = () => sigPadRef.current?.clear()

    const captureDraw = (): string | null => {
        if (!sigPadRef.current || sigPadRef.current.isEmpty()) return null
        return sigPadRef.current.toDataURL('image/png')
    }

    // ── Type tab ────────────────────────────────────────────────────────────────
    const [typedText, setTypedText] = useState('')
    const [selectedFont, setSelectedFont] = useState(0)
    const typeCanvasRef = useRef<HTMLCanvasElement>(null)

    const captureTyped = useCallback((): string | null => {
        if (!typedText.trim()) return null
        const canvas = typeCanvasRef.current
        if (!canvas) return null
        const ctx = canvas.getContext('2d')!
        const ratio = 2
        canvas.width = 500 * ratio
        canvas.height = 120 * ratio
        ctx.scale(ratio, ratio)
        ctx.clearRect(0, 0, 500, 120)
        ctx.fillStyle = 'transparent'
        ctx.fillRect(0, 0, 500, 120)
        ctx.font = `italic 48px ${SIGNATURE_FONTS[selectedFont].css}`
        ctx.fillStyle = '#1e1b4b'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(typedText, 250, 60)
        return canvas.toDataURL('image/png')
    }, [typedText, selectedFont])

    // ── Upload tab ──────────────────────────────────────────────────────────────
    const [uploadPreview, setUploadPreview] = useState<string | null>(null)
    const uploadInputRef = useRef<HTMLInputElement>(null)

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = () => {
            setUploadPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
    }

    // ── Confirm handler ────────────────────────────────────────────────────────
    const handleConfirm = () => {
        let data: string | null = null
        switch (tab) {
            case 'draw':
                data = captureDraw()
                break
            case 'type':
                data = captureTyped()
                break
            case 'upload':
                data = uploadPreview
                break
        }
        if (data) {
            onConfirm(data)
            resetAll()
        }
    }

    const resetAll = () => {
        sigPadRef.current?.clear()
        setTypedText('')
        setSelectedFont(0)
        setUploadPreview(null)
        setSignatureData(null)
    }

    const handleClose = () => {
        resetAll()
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden animate-slide-up shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Add Signature</h3>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors text-lg">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800">
                    {(['draw', 'type', 'upload'] as TabType[]).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-3 text-sm font-medium transition-all ${tab === t
                                ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/5'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {t === 'draw' ? '✏️ Draw' : t === 'type' ? '⌨️ Type' : '📁 Upload'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* Draw */}
                    {tab === 'draw' && (
                        <div>
                            <div className="relative border border-slate-700 rounded-xl overflow-hidden bg-white mb-3" style={{ height: 200 }}>
                                <canvas
                                    ref={canvasRef}
                                    className="w-full h-full cursor-crosshair"
                                    style={{ touchAction: 'none' }}
                                />
                                <div className="absolute bottom-2 left-3 text-slate-300 text-[10px] pointer-events-none opacity-50">
                                    Draw your signature above
                                </div>
                            </div>
                            <button onClick={clearDraw} className="text-slate-500 text-xs hover:text-slate-300">Clear</button>
                        </div>
                    )}

                    {/* Type */}
                    {tab === 'type' && (
                        <div>
                            <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Sacramento&family=Pacifico&family=Caveat:wght@700&display=swap" rel="stylesheet" />
                            <input
                                type="text"
                                className="input text-center mb-3"
                                placeholder="Type your full name"
                                value={typedText}
                                onChange={e => setTypedText(e.target.value)}
                                maxLength={40}
                            />
                            {/* Font selector */}
                            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                                {SIGNATURE_FONTS.map((font, i) => (
                                    <button
                                        key={font.name}
                                        onClick={() => setSelectedFont(i)}
                                        className={`shrink-0 px-3 py-2 rounded-lg border text-sm transition-all ${selectedFont === i
                                            ? 'border-brand-500 bg-brand-500/10 text-brand-400 shadow-sm shadow-brand-500/20'
                                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                                            }`}
                                        style={{ fontFamily: font.css, fontSize: '18px' }}
                                    >
                                        {typedText || 'Abc'}
                                    </button>
                                ))}
                            </div>
                            <div className="border border-slate-700 rounded-xl bg-white p-4 flex items-center justify-center" style={{ height: 120 }}>
                                <span
                                    className="text-4xl text-[#1e1b4b]"
                                    style={{ fontFamily: SIGNATURE_FONTS[selectedFont].css, fontStyle: 'italic' }}
                                >
                                    {typedText || 'Preview'}
                                </span>
                            </div>
                            <canvas ref={typeCanvasRef} className="hidden" />
                        </div>
                    )}

                    {/* Upload */}
                    {tab === 'upload' && (
                        <div>
                            <div
                                className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center cursor-pointer hover:border-slate-600 transition-colors"
                                onClick={() => uploadInputRef.current?.click()}
                            >
                                <input
                                    ref={uploadInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                {uploadPreview ? (
                                    <img src={uploadPreview} alt="Signature" className="max-h-32 mx-auto object-contain" />
                                ) : (
                                    <div className="space-y-2">
                                        <div className="text-3xl">🖼️</div>
                                        <p className="text-slate-400 text-sm">Click to upload an image of your signature</p>
                                        <p className="text-slate-600 text-xs">PNG, JPG, or WEBP</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-800 flex gap-3">
                    <button onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleConfirm} className="btn-primary flex-1">Confirm Signature</button>
                </div>
            </div>
        </div>
    )
}
