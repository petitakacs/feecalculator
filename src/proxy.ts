import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip API routes — each one enforces its own auth via getServerSession
  if (pathname.startsWith("/api/")) return NextResponse.next();
  // Skip static assets and login page
  if (pathname.startsWith("/_next/") || pathname.startsWith("/favicon") || pathname === "/login") {
    return NextResponse.next();
  }

  // Protect dashboard pages — redirect to login when no session
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
