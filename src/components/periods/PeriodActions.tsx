"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { showToast } from "@/components/ui/toaster";
import { PeriodStatus, Role } from "@/types";
import { canTransitionStatus, hasPermission } from "@/lib/permissions";

interface PeriodActionsProps {
  period: {
    id: string;
    status: PeriodStatus;
    collectedServiceCharge: number;
    openingBalance: number;
    notes: string | null;
  };
  userRole: Role;
}

export function PeriodActions({ period, userRole }: PeriodActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editCollected, setEditCollected] = useState(String(period.collectedServiceCharge));
  const [editOpening, setEditOpening] = useState(String(period.openingBalance));
  const [editNotes, setEditNotes] = useState(period.notes ?? "");
  const [editLoading, setEditLoading] = useState(false);

  const canEdit =
    hasPermission(userRole, "periods:write") &&
    period.status !== "APPROVED" &&
    period.status !== "CLOSED";

  const handleEdit = async () => {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/periods/${period.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectedServiceCharge: Math.round(Number(editCollected) || 0),
          openingBalance: Math.round(Number(editOpening) || 0),
          notes: editNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Mentés sikertelen", "error");
        return;
      }
      showToast("Periódus frissítve", "success");
      setEditOpen(false);
      router.refresh();
    } catch {
      showToast("Hálózati hiba", "error");
    } finally {
      setEditLoading(false);
    }
  };

  const doAction = async (action: string, actionComment?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/periods/${period.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: actionComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Action failed", "error");
        return;
      }
      showToast(`Status updated to ${data.newStatus}`, "success");
      router.refresh();
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
      setCommentModalOpen(false);
      setPendingAction(null);
      setComment("");
    }
  };

  const triggerAction = (action: string, requireComment = false) => {
    if (requireComment) {
      setPendingAction(action);
      setCommentModalOpen(true);
    } else {
      doAction(action);
    }
  };

  const statusActions: Record<
    PeriodStatus,
    { action: string; label: string; className: string; requireComment?: boolean }[]
  > = {
    DRAFT: [
      {
        action: "SUBMITTED",
        label: "Submit for Approval",
        className: "bg-yellow-600 hover:bg-yellow-700",
      },
    ],
    PENDING_APPROVAL: [
      {
        action: "APPROVED",
        label: "Approve",
        className: "bg-green-600 hover:bg-green-700",
      },
      {
        action: "REJECTED",
        label: "Reject",
        className: "bg-red-600 hover:bg-red-700",
        requireComment: true,
      },
    ],
    APPROVED: [
      {
        action: "CLOSED",
        label: "Lezárás",
        className: "bg-blue-600 hover:bg-blue-700",
      },
    ],
    CLOSED: [
      {
        action: "REOPENED",
        label: "Újranyitás",
        className: "bg-orange-600 hover:bg-orange-700",
        requireComment: true,
      },
    ],
  };

  const actionToStatus: Record<string, PeriodStatus> = {
    SUBMITTED: "PENDING_APPROVAL",
    APPROVED: "APPROVED",
    REJECTED: "DRAFT",
    REOPENED: "DRAFT",
    CLOSED: "CLOSED",
  };

  const actions = statusActions[period.status] ?? [];
  const availableActions = actions.filter((a) =>
    canTransitionStatus(userRole, period.status, actionToStatus[a.action] ?? "DRAFT")
  );

  return (
    <>
      <div className="flex gap-2">
        {canEdit && (
          <button
            onClick={() => {
              setEditCollected(String(period.collectedServiceCharge));
              setEditOpening(String(period.openingBalance));
              setEditNotes(period.notes ?? "");
              setEditOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" />
            Szerkesztés
          </button>
        )}
        {availableActions.map((action) => (
          <button
            key={action.action}
            onClick={() => triggerAction(action.action, action.requireComment)}
            disabled={loading}
            className={`px-4 py-2 text-white text-sm font-medium rounded-md disabled:opacity-50 ${action.className}`}
          >
            {action.label}
          </button>
        ))}
      </div>

      {commentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold">
              {pendingAction === "REJECTED"
                ? "Periódus elutasítása"
                : pendingAction === "REOPENED"
                ? "Periódus újranyitása"
                : "Megjegyzés hozzáadása"}
            </h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Megjegyzés (opcionális)"
              rows={3}
              className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setCommentModalOpen(false); setPendingAction(null); }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Mégsem
              </button>
              <button
                onClick={() => pendingAction && doAction(pendingAction, comment)}
                disabled={loading}
                className={`px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 ${
                  pendingAction === "REOPENED"
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                Megerősítés
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Periódus szerkesztése</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Befolyt szervízdíj (Ft)
                </label>
                <input
                  type="number"
                  value={editCollected}
                  onChange={(e) => setEditCollected(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nyitó egyenleg (Ft)
                </label>
                <input
                  type="number"
                  value={editOpening}
                  onChange={(e) => setEditOpening(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Megjegyzés
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Megjegyzés (opcionális)"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditOpen(false)}
                disabled={editLoading}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Mégsem
              </button>
              <button
                onClick={handleEdit}
                disabled={editLoading}
                className="px-4 py-2 text-sm text-white bg-gray-900 rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {editLoading ? "Mentés..." : "Mentés"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
