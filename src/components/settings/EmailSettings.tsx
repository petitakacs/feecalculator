"use client";

import { useState } from "react";
import { showToast } from "@/components/ui/toaster";

interface EmailSettingsProps {
  configured: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  currentUserEmail: string;
}

export function EmailSettings({ configured, smtpHost, smtpPort, smtpUser, currentUserEmail }: EmailSettingsProps) {
  const [sending, setSending] = useState(false);
  const [testTo, setTestTo] = useState(currentUserEmail);

  const handleTest = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(typeof data.error === "string" ? data.error : "Teszt sikertelen", "error");
        return;
      }
      showToast(`Teszt email elküldve: ${data.to}`, "success");
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            configured ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {configured ? "Konfigurálva" : "Nincs konfigurálva"}
        </span>
        <span className="text-sm text-gray-600">
          {configured
            ? `SMTP: ${smtpHost}:${smtpPort} (${smtpUser})`
            : "Az SMTP_HOST, SMTP_USER, SMTP_PASS környezeti változók hiányoznak."}
        </span>
      </div>

      {!configured && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <p className="font-medium mb-1">Az email értesítők beállításához add meg a következő változókat a <code>.env</code> fájlban:</p>
          <pre className="text-xs mt-1 font-mono">
{`SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=your-password
SMTP_FROM="Fee Calculator <noreply@example.com>"`}
          </pre>
        </div>
      )}

      {configured && (
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Teszt email küldése</label>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="email@example.com"
            />
          </div>
          <button
            onClick={handleTest}
            disabled={sending || !testTo}
            className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {sending ? "Küldés..." : "Teszt küldése"}
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Az értesítők automatikusan kiküldésre kerülnek periódus állapotváltozáskor (beküldés, jóváhagyás, visszadobás, lezárás) minden aktív felhasználónak.
      </p>
    </div>
  );
}
