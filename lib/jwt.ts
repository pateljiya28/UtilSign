import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

export interface SignerTokenPayload {
    signerId: string
    documentId: string
    type: 'magic_link'
}

export interface SessionTokenPayload {
    signerId: string
    documentId: string
    type: 'signing_session'
}

// ─── Sign a magic-link token (sent via email, 7 days) ────────────────────────
export async function signMagicToken(payload: Omit<SignerTokenPayload, 'type'>): Promise<string> {
    return new SignJWT({ ...payload, type: 'magic_link' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret)
}

// ─── Sign a session token (issued after OTP verified, 1 hour, in React state only) ──
export async function signSessionToken(payload: Omit<SessionTokenPayload, 'type'>): Promise<string> {
    return new SignJWT({ ...payload, type: 'signing_session' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret)
}

// ─── Verify any token and narrow the type ────────────────────────────────────
export async function verifyToken(token: string): Promise<SignerTokenPayload | SessionTokenPayload> {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SignerTokenPayload | SessionTokenPayload
}
