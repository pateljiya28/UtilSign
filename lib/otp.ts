import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

// ─── Generate a 6-digit OTP as a zero-padded string ─────────────────────────
export function generateOTP(): string {
    const code = randomInt(0, 1_000_000)
    return code.toString().padStart(6, '0')
}

// ─── Hash an OTP for safe storage ────────────────────────────────────────────
export async function hashOTP(otp: string): Promise<string> {
    return bcrypt.hash(otp, SALT_ROUNDS)
}

// ─── Compare a candidate OTP against a stored hash ───────────────────────────
export async function verifyOTP(candidate: string, hash: string): Promise<boolean> {
    return bcrypt.compare(candidate, hash)
}
