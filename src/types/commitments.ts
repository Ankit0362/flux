import { CommitmentStatus, EmailDirection } from "@prisma/client";

export interface SourceEmailDTO {
  id: string;
  externalId: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  receivedAt: string; // ISO string representation
}

/**
 * TS-07: Prisma `JsonValue` Metadata Typing
 *
 * Prisma types JSON columns as `JsonValue` (which can be string, number, object, array, or null).
 * In ChiefOS, the `Commitment.metadata` field strictly adheres to this interface.
 * When reading from Prisma, always cast or parse it through a safe helper
 * (e.g., `parseCommitmentMetadata`) rather than using `as any`.
 */
export interface CommitmentMetadata {
  confidence?: number;
  direction?: EmailDirection;
  [key: string]: unknown;
}

export interface CommitmentDTO {
  id: string;
  title: string;
  dueDate: string | null; // ISO date string or null
  status: CommitmentStatus;
  confidence: number;
  direction: EmailDirection;
  sourceEmail: SourceEmailDTO | null;
  source: SourceEmailDTO | null; // Alias for compatibility
  // Risk Intelligence
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskReason: string | null;
}

export interface GetCommitmentsResponse {
  commitments: CommitmentDTO[];
}

export interface UpdateCommitmentRequest {
  status: CommitmentStatus;
}

export interface UpdateCommitmentResponse {
  commitment: CommitmentDTO;
}

export interface ErrorResponse {
  error: string;
}
