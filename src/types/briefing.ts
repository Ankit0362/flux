export interface BriefingRisk {
  commitmentId: string;
  title: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
}

export interface BriefingRelationship {
  contactId: string;
  name: string | null;
  email: string;
  reason: string;
}

export interface BriefingAction {
  id: string;
  action: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  refType: "email" | "commitment" | "contact" | "general";
  refId?: string;
}

export interface ExecutiveBriefingDTO {
  executiveSummary: string;
  topRisks: BriefingRisk[];
  relationshipsAttention: BriefingRelationship[];
  recommendedActions: BriefingAction[];
  generatedAt: string; // ISO date string
}
