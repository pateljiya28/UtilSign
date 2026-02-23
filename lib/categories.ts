// ─── Agreement Categories ─────────────────────────────────────────────────────
// Used in envelope creation (request sign + templates) and history filtering.

export const AGREEMENT_CATEGORIES = [
    'Agency Agreements',
    'Bank Account Opening Agreements',
    'Confidentiality Agreements',
    'Consulting Agreements',
    'Contractor Agreements',
    'Credit Card Agreements',
    'Distribution Agreements',
    'Employment Contracts',
    'Franchise Agreements',
    'Independent Contractor Agreements',
    'Intellectual Property Assignment Agreements',
    'Investment Account Agreements',
    'Joint Venture Agreements',
    'Lease Agreements',
    'Licensing Agreements',
    'Loan Agreements',
    'Loan Applications',
    'Non-Disclosure Agreements (NDAs)',
    'Onboarding Agreements',
    'Other',
    'Partnership Agreements',
    'Purchase Agreements',
    'Sales Contracts',
    'Service Agreements',
    'Software License Agreements',
    'Vendor Agreements',
    'Wealth Management Agreements',
] as const

export type AgreementCategory = (typeof AGREEMENT_CATEGORIES)[number]
