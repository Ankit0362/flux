import { CommitmentDTO } from "./commitments";

export interface ContactListDTO {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  avatarUrl: string | null;
  relationshipScore: number;
  relationshipHealth: "Strong" | "Neutral" | "At Risk";
  relationshipReason: string | null;
  totalExchanges: number;
  openCommitments: number;
  completedCommitments: number;
  lastInteractionAt: string | null;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  lastMessageAt: string | null;
  followUpNeeded: boolean;
  followUpUrgency: string | null;
  followUpReason: string | null;
  snippet: string | null;
}

export interface ContactDetailDTO extends ContactListDTO {
  phoneNumber: string | null;
  inboundCount: number;
  outboundCount: number;
  commitments: CommitmentDTO[];
  recentThreads: ThreadSummary[];
}

export interface ContactInsightDTO {
  insight: string;
  recommendedActions: string[];
  relationshipRisk: "LOW" | "MEDIUM" | "HIGH";
  generatedAt: string;
}

export interface TimelineEvent {
  id: string;
  type: "email" | "commitment";
  date: string;
  title: string;
  description: string | null;
  direction?: "INBOUND" | "OUTBOUND";
  status?: string;
  riskLevel?: string;
}
