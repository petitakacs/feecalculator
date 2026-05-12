import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { Role } from "@/types";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Get the authenticated session from the JWT cookie on the request.
 * Uses getToken (reads directly from request headers) instead of getServerSession
 * to avoid Next.js 15/16 async-headers compatibility issues with next-auth v4.
 * Returns the same shape as getServerSession so callers can use session.user.* unchanged.
 */
export async function getAuthSession(
  req: NextRequest
): Promise<{ user: SessionUser } | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id || !token?.role) return null;
  return {
    user: {
      id: token.id as string,
      name: (token.name as string) ?? "",
      email: (token.email as string) ?? "",
      role: token.role as Role,
    },
  };
}
