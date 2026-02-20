import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options ?? {})
                    )
                },
            },
        }
    )

    // Attempt to get user — if Supabase is unreachable, treat as no user
    let user = null
    try {
        const { data } = await supabase.auth.getUser()
        user = data?.user ?? null
    } catch {
        // Supabase unreachable — continue without user
    }

    const pathname = request.nextUrl.pathname

    // Protected sender routes
    const senderRoutes = ['/dashboard', '/documents']
    const isProtected = senderRoutes.some(r => pathname.startsWith(r))

    if (isProtected && !user) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Redirect logged-in users away from login page
    if (pathname.startsWith('/auth/login') && user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return response
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
