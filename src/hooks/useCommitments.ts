import { useState, useEffect, useCallback } from "react";
import { CommitmentDTO } from "@/types/commitments";
import { CommitmentStatus } from "@prisma/client";

export function useCommitments() {
  const [commitments, setCommitments] = useState<CommitmentDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCommitments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commitments");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch commitments");
      }
      const data = await res.json();
      setCommitments(data.commitments || []);
    } catch (err: any) {
      console.error("Failed to load commitments:", err);
      setError(err.message || "Something went wrong fetching commitments");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCommitmentStatus = useCallback(async (id: string, newStatus: CommitmentStatus) => {
    setError(null);
    setUpdatingId(id);

    // Save previous commitments for rollback in case of error
    let previousCommitments: CommitmentDTO[] = [];
    setCommitments((prev) => {
      previousCommitments = prev;
      return prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: newStatus,
            }
          : c
      );
    });

    try {
      const res = await fetch(`/api/commitments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to update status to ${newStatus}`);
      }

      const data = await res.json();
      // Update with exact response from server
      setCommitments((prev) =>
        prev.map((c) => (c.id === id ? data.commitment : c))
      );
    } catch (err: any) {
      console.error(`Failed to update commitment ${id} status:`, err);
      setError(err.message || "Failed to update status");
      // Rollback to previous state
      setCommitments(previousCommitments);
    } finally {
      setUpdatingId(null);
    }
  }, []);

  const extractCommitments = useCallback(async (threadId: string): Promise<number> => {
    setError(null);
    setLoading(true); // Optimistic UI: transition panel to loading state
    
    try {
      const res = await fetch("/api/commitments/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ threadId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to extract commitments");
      }

      const data = await res.json();
      
      // Update local state with new commitments immediately (Optimistic Update)
      if (data.commitments && data.commitments.length > 0) {
        setCommitments((prev) => {
          // Avoid appending duplicates by filtering
          const newIds = new Set(data.commitments.map((c: any) => c.id));
          const filteredPrev = prev.filter((c) => !newIds.has(c.id));
          return [...data.commitments, ...filteredPrev];
        });
      }

      // Background list refresh to make sure everything is in sync
      fetchCommitments();

      return data.count ?? 0;
    } catch (err: any) {
      console.error(`Failed to extract commitments for thread ${threadId}:`, err);
      setError(err.message || "Failed to extract commitments");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCommitments]);

  useEffect(() => {
    fetchCommitments();
  }, [fetchCommitments]);

  return {
    commitments,
    loading,
    updatingId,
    error,
    refresh: fetchCommitments,
    updateCommitmentStatus,
    extractCommitments,
  };
}
