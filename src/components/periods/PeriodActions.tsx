"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/ui/toaster";
import { PeriodStatus, Role } from "@/types";
import { canTransitionStatus } from "@/lib/permissions";

interface PeriodActionsProps {
  period: { id: string; status: PeriodStatus };
  userRole: Role;
}

export function PeriodActions({ period, userRole }: PeriodActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [comment, setComment] = useState("");

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
        label: "Close Period",
        className: "bg-blue-600 hover:bg-blue-700",
      },
    ],
    CLOSED: [],
  };

  const actions = statusActions[period.status] ?? [];
  const availableActions = actions.filter((a) =>
    canTransitionStatus(
      userRole,
      period.status,
      a.action === "SUBMITTED"
        ? "PENDING_APPROVAL"
        : a.action === "APPROVED"
        ? "APPROVED"
        : a.action === "REJECTED"
        ? "DRAFT"
        : "CLOSED"
    )
  );

  return (
    <>
      <div className="flex gap-2">
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
              {pendingAction === "REJECTED" ? "Reject Period" : "Add Comment"}
            </h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)"
              rows={3}
              className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setCommentModalOpen(false);
                  setPendingAction(null);
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => pendingAction && doAction(pendingAction, comment)}
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
