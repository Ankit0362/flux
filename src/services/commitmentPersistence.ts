import { prisma } from "../lib/db";
import { EmailMessage, CommitmentStatus } from "@prisma/client";
import { ExtractedCommitment } from "./commitmentExtraction";

/**
 * Normalizes a commitment title by converting to lowercase, removing non-alphanumeric characters, and trimming.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Generates a fingerprint for a commitment using title, due date, and user ID.
 * fingerprint = normalize(title) + dueDate + userId
 */
export function generateFingerprint(title: string, dueDate: string | null, userId: string): string {
  const normalized = normalizeTitle(title);
  const dateStr = dueDate || "";
  return `${normalized}${dateStr}${userId}`;
}

interface PersistOptions {
  confidenceThreshold?: number;
}

/**
 * Service function to persist commitment candidates extracted from an email message.
 * This is Phase 2: Duplicate checking, confidence threshold filtering, metadata generation,
 * sentinel recording, and Prisma transactional persistence.
 * 
 * @param candidates The extracted commitment candidates.
 * @param emailMessage The email message from which the commitments were extracted.
 * @param userId The ID of the user who owns the commitments.
 * @param options Persistence options, including confidence threshold.
 * @returns A promise resolving to the list of persisted Commitment records.
 */
export async function persistCommitments(
  candidates: ExtractedCommitment[],
  emailMessage: EmailMessage,
  userId: string,
  options: PersistOptions = {}
) {
  const confidenceThreshold = options.confidenceThreshold ?? 0.5;

  return await prisma.$transaction(async (tx) => {
    // 1. Check for duplicates: Same emailMessageId
    // If this email message has already been processed for commitments, we skip to avoid duplicate processing.
    const existingMessageCommitment = await tx.commitment.findFirst({
      where: { emailMessageId: emailMessage.id },
    });

    if (existingMessageCommitment) {
      console.log(`Email message ${emailMessage.id} already has persisted commitments/sentinels. Skipping.`);
      return [];
    }

    // Fetch user's email address to distinguish external contacts for contact linking
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const userEmail = user?.email;

    // Filter candidates by confidence threshold
    const aboveThresholdCandidates = candidates.filter(
      (c) => c.confidence >= confidenceThreshold
    );

    // 2. Check if a sentinel record should be created:
    // Create sentinel record when:
    // - no commitments found (candidates is empty)
    // - all commitments below threshold (aboveThresholdCandidates is empty)
    if (candidates.length === 0 || aboveThresholdCandidates.length === 0) {
      console.log(`No valid commitments above threshold (${confidenceThreshold}) for message ${emailMessage.id}. Creating sentinel record.`);
      
      const sentinelFingerprint = `sentinel-${emailMessage.id}`;
      const reason = candidates.length === 0
        ? "No commitment candidates found in this email."
        : "All extracted commitment candidates were below the confidence threshold.";

      const sentinel = await tx.commitment.create({
        data: {
          userId,
          title: "NO_COMMITMENTS",
          description: reason,
          status: CommitmentStatus.PENDING,
          dueDate: null,
          emailMessageId: emailMessage.id,
          emailThreadId: emailMessage.threadId,
          metadata: {
            sentinel: true,
            confidence: 0,
            rawSnippet: "No commitments detected",
            fingerprint: sentinelFingerprint,
            direction: emailMessage.direction,
          },
        },
      });

      return [sentinel];
    }

    const persistedCommitments = [];

    // 3. Process each candidate commitment above the confidence threshold
    for (const candidate of aboveThresholdCandidates) {
      const fingerprint = generateFingerprint(candidate.title, candidate.dueDate, userId);

      // Check for duplicates: Same fingerprint
      // We look up if a commitment with the exact same fingerprint already exists for this user.
      const existingFingerprintCommitment = await tx.commitment.findFirst({
        where: {
          userId,
          metadata: {
            path: ["fingerprint"],
            equals: fingerprint,
          },
        } as any,
      });

      if (existingFingerprintCommitment) {
        console.log(`Commitment with fingerprint "${fingerprint}" already exists. Skipping duplicate candidate: "${candidate.title}".`);
        continue;
      }

      // Try to resolve contact if the committer or recipient is an external contact
      let contactId: string | null = null;
      const externalEmail = candidate.committerEmail?.toLowerCase() !== userEmail?.toLowerCase()
        ? candidate.committerEmail
        : candidate.recipientEmail;

      if (externalEmail) {
        const contact = await tx.contact.findUnique({
          where: {
            userId_email: {
              userId,
              email: externalEmail.toLowerCase(),
            },
          },
        });
        if (contact) {
          contactId = contact.id;
        }
      }

      // Format dueDate if present (convert string YYYY-MM-DD to Date object)
      const dueDate = candidate.dueDate ? new Date(candidate.dueDate) : null;

      // Create the Commitment record
      const commitment = await tx.commitment.create({
        data: {
          userId,
          title: candidate.title,
          description: candidate.description,
          status: CommitmentStatus.PENDING,
          dueDate,
          contactId,
          emailMessageId: emailMessage.id,
          emailThreadId: emailMessage.threadId,
          metadata: {
            confidence: candidate.confidence,
            rawSnippet: candidate.reasoning || candidate.description,
            fingerprint,
            direction: emailMessage.direction,
          },
        },
      });

      persistedCommitments.push(commitment);
    }

    return persistedCommitments;
  });
}
