import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@/types";
import { verifyTotp } from "@/lib/totp";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tempToken: { label: "Temp Token", type: "text" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        // 2FA second step: validate temp token + TOTP code
        if (credentials.tempToken && credentials.totpCode) {
          const tokenRecord = await prisma.twoFactorToken.findUnique({
            where: { token: credentials.tempToken },
            include: { user: true },
          });

          if (
            !tokenRecord ||
            tokenRecord.used ||
            tokenRecord.expiresAt < new Date()
          ) {
            return null;
          }

          const user = tokenRecord.user;
          if (!user.active || !user.twoFactorEnabled || !user.twoFactorSecret) {
            return null;
          }

          const code = credentials.totpCode.replace(/\s/g, "");
          const isValidTotp = verifyTotp(code, user.twoFactorSecret);

          if (!isValidTotp) {
            // Check backup codes (plain text stored in JSON array)
            if (user.twoFactorBackupCodes) {
              const backupCodes: string[] = JSON.parse(user.twoFactorBackupCodes);
              const codeIndex = backupCodes.indexOf(code);
              if (codeIndex === -1) return null;
              backupCodes.splice(codeIndex, 1);
              await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorBackupCodes: JSON.stringify(backupCodes) },
              });
            } else {
              return null;
            }
          }

          await prisma.twoFactorToken.update({
            where: { id: tokenRecord.id },
            data: { used: true },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role as Role,
          };
        }

        // Normal login: email + password
        if (!credentials.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.active) return null;

        const isPasswordValid = await compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) return null;

        // If 2FA is enabled, block here — client must use the pre-login API
        if (user.twoFactorEnabled) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { id: string; role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};
