import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_API_PATTERNS = [
  /^\/api\/auth\//,     // NextAuth routes
  /^\/api\/health$/,    // health endpoint (has its own auth gate)
];

const PUBLIC_PAGE_PATTERNS = [
  /^\/login$/,
  /^\/_next\//,
  /^\/favicon/,
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public pages and NextAuth internals
  if (PUBLIC_PAGE_PATTERNS.some((p) => p.test(pathname))) {
    return NextResponse.next();
  }

  // For API routes: check JWT, return 401 if missing
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PATTERNS.some((p) => p.test(pathname))) {
      return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // For dashboard pages: redirect to login if no session
  if (pathname.startsWith("/")) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
