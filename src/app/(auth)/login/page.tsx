"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const totpSchema = z.object({
  totpCode: z
    .string()
    .min(6, "Code must be 6 characters")
    .max(8, "Code too long"),
});

type LoginForm = z.infer<typeof loginSchema>;
type TotpForm = z.infer<typeof totpSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const totpForm = useForm<TotpForm>({
    resolver: zodResolver(totpSchema),
  });

  const onLoginSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/pre-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      if (!res.ok) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      const preLogin = await res.json();

      if (preLogin.requiresTwoFactor) {
        setTempToken(preLogin.tempToken);
        setTwoFactorRequired(true);
        setLoading(false);
        return;
      }

      // No 2FA: sign in directly
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      setLoading(false);
      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  const onTotpSubmit = async (data: TotpForm) => {
    if (!tempToken) return;
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      tempToken,
      totpCode: data.totpCode.replace(/\s/g, ""),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid or expired 2FA code");
    } else {
      router.push("/dashboard");
    }
  };

  if (twoFactorRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <ShieldCheck className="w-10 h-10 text-gray-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Two-Factor Authentication
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form
            onSubmit={totpForm.handleSubmit(onTotpSubmit)}
            className="space-y-6"
          >
            {error && (
              <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="totpCode"
                className="block text-sm font-medium text-gray-700"
              >
                Authentication Code
              </label>
              <input
                id="totpCode"
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                placeholder="000000"
                {...totpForm.register("totpCode")}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-center text-2xl tracking-widest focus:outline-none focus:ring-primary focus:border-primary"
              />
              {totpForm.formState.errors.totpCode && (
                <p className="mt-1 text-sm text-red-600">
                  {totpForm.formState.errors.totpCode.message}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500 text-center">
                You can also use a backup code
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              onClick={() => {
                setTwoFactorRequired(false);
                setTempToken(null);
                setError(null);
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold text-center text-gray-900">
            Café SC Manager
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Service Charge Distribution System
          </p>
        </div>

        <form
          onSubmit={loginForm.handleSubmit(onLoginSubmit)}
          className="space-y-6"
        >
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...loginForm.register("email")}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            />
            {loginForm.formState.errors.email && (
              <p className="mt-1 text-sm text-red-600">
                {loginForm.formState.errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...loginForm.register("password")}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            />
            {loginForm.formState.errors.password && (
              <p className="mt-1 text-sm text-red-600">
                {loginForm.formState.errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
