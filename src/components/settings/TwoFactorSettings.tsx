"use client";

import { useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import Image from "next/image";

type Step = "idle" | "setup" | "verify" | "backup-codes" | "disable";

interface SetupData {
  secret: string;
  qrCodeDataUrl: string;
}

export function TwoFactorSettings({
  twoFactorEnabled: initialEnabled,
}: {
  twoFactorEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start 2FA setup");
      }
      const data = await res.json();
      setSetupData(data);
      setStep("setup");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (!totpCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/verify-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode: totpCode.replace(/\s/g, "") }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Invalid TOTP code");
      }
      const data = await res.json();
      setBackupCodes(data.backupCodes);
      setStep("backup-codes");
      setEnabled(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to disable 2FA");
      }
      setEnabled(false);
      setStep("idle");
      setPassword("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStep("idle");
    setSetupData(null);
    setTotpCode("");
    setPassword("");
    setError(null);
  };

  if (step === "setup" && setupData) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">
          Set up Two-Factor Authentication
        </h3>
        <p className="text-sm text-gray-600">
          Scan the QR code below with your authenticator app (e.g. Google
          Authenticator, Authy).
        </p>

        <div className="flex justify-center">
          <Image
            src={setupData.qrCodeDataUrl}
            alt="2FA QR Code"
            width={200}
            height={200}
            unoptimized
          />
        </div>

        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-500 mb-1">
            Or enter this key manually:
          </p>
          <code className="text-sm font-mono text-gray-800 break-all">
            {setupData.secret}
          </code>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter the 6-digit code from your app to confirm
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder="000000"
            maxLength={6}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={verifySetup}
            disabled={loading || totpCode.length < 6}
            className="flex-1 py-2 px-4 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Activate 2FA"}
          </button>
          <button
            onClick={reset}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === "backup-codes") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-700">
          <ShieldCheck size={20} />
          <h3 className="text-base font-semibold">
            2FA Enabled Successfully!
          </h3>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
          <strong>Save these backup codes</strong> — they can be used if you lose access to your authenticator app. Each code can only be used once.
        </div>

        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map((code) => (
            <code
              key={code}
              className="bg-gray-100 rounded px-3 py-1.5 text-sm font-mono text-center"
            >
              {code}
            </code>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={copyBackupCodes}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy codes"}
          </button>
          <button
            onClick={reset}
            className="flex-1 py-2 px-4 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (step === "disable") {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-gray-900">
          Disable Two-Factor Authentication
        </h3>
        <p className="text-sm text-gray-600">
          Enter your password to confirm disabling 2FA.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={disable2FA}
            disabled={loading || !password}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Disabling..." : "Disable 2FA"}
          </button>
          <button
            onClick={reset}
            className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {enabled ? (
          <ShieldCheck size={20} className="text-green-600" />
        ) : (
          <ShieldOff size={20} className="text-gray-400" />
        )}
        <div>
          <p className="text-sm font-medium text-gray-900">
            Two-Factor Authentication
          </p>
          <p className="text-xs text-gray-500">
            {enabled
              ? "Your account is protected with 2FA"
              : "Add an extra layer of security to your account"}
          </p>
        </div>
        <span
          className={`ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            enabled
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {enabled ? (
        <button
          onClick={() => {
            setError(null);
            setStep("disable");
          }}
          className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 text-sm font-medium"
        >
          <ShieldOff size={14} />
          Disable 2FA
        </button>
      ) : (
        <button
          onClick={startSetup}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-700 text-sm font-medium disabled:opacity-50"
        >
          <ShieldCheck size={14} />
          {loading ? "Setting up..." : "Enable 2FA"}
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded-md text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
