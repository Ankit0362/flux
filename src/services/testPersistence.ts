import { prisma } from "../lib/db";
import { persistCommitments, generateFingerprint, normalizeTitle } from "./commitmentPersistence";
import { ExtractedCommitment } from "./commitmentExtraction";
import { EmailDirection } from "@prisma/client";

async function main() {
  console.log("==================================================");
  console.log("Starting Phase 2 Commitment Persistence Test Suite");
  console.log("==================================================\n");

  try {
    // 1. Setup mock data
    console.log("Setting up mock database test records...");
    
    // Upsert a test User
    const user = await prisma.user.upsert({
      where: { email: "test-user@chiefos.com" },
      update: {},
      create: {
        email: "test-user@chiefos.com",
        name: "Test User",
      },
    });
    console.log(`- Test User: ${user.name} (${user.email}) [ID: ${user.id}]`);

    // Upsert a test Contact
    const contact = await prisma.contact.upsert({
      where: {
        userId_email: {
          userId: user.id,
          email: "external-contact@partner.com",
        },
      },
      update: {},
      create: {
        userId: user.id,
        email: "external-contact@partner.com",
        name: "External Contact",
      },
    });
    console.log(`- Test Contact: ${contact.name} (${contact.email}) [ID: ${contact.id}]`);

    // Upsert a test Thread
    const thread = await prisma.emailThread.upsert({
      where: { externalId: "test-thread-xyz-001" },
      update: {},
      create: {
        userId: user.id,
        externalId: "test-thread-xyz-001",
        subject: "Phase 2 Testing Thread",
        snippet: "Test thread for verifying commitment persistence layer.",
      },
    });

    // Clean up any existing test commitments for this thread/user to ensure clean state
    await prisma.commitment.deleteMany({
      where: {
        userId: user.id,
        emailThreadId: thread.id,
      },
    });
    console.log("- Cleaned up any old commitments matching test thread.");

    // Create unique mock email messages
    const msg1 = await prisma.emailMessage.upsert({
      where: { externalId: "test-msg-001" },
      update: {},
      create: {
        threadId: thread.id,
        externalId: "test-msg-001",
        sender: "external-contact@partner.com",
        recipients: ["test-user@chiefos.com"],
        subject: "Phase 2 Testing Thread",
        body: "I will review the forecast and send my feedback by next Tuesday.",
        direction: EmailDirection.INBOUND,
        receivedAt: new Date(),
      },
    });

    const msg2 = await prisma.emailMessage.upsert({
      where: { externalId: "test-msg-002" },
      update: {},
      create: {
        threadId: thread.id,
        externalId: "test-msg-002",
        sender: "external-contact@partner.com",
        recipients: ["test-user@chiefos.com"],
        subject: "Phase 2 Testing Thread - Part 2",
        body: "I will review the forecast and send my feedback by next Tuesday.",
        direction: EmailDirection.INBOUND,
        receivedAt: new Date(),
      },
    });

    const msg3 = await prisma.emailMessage.upsert({
      where: { externalId: "test-msg-003" },
      update: {},
      create: {
        threadId: thread.id,
        externalId: "test-msg-003",
        sender: "external-contact@partner.com",
        recipients: ["test-user@chiefos.com"],
        subject: "Phase 2 Testing Thread - Part 3",
        body: "Just checking in, no tasks today.",
        direction: EmailDirection.INBOUND,
        receivedAt: new Date(),
      },
    });

    console.log("- Created mock email messages.");

    // 2. Scenario 1: Successful persistence of a high-confidence candidate
    console.log("\nScenario 1: Persisting high-confidence candidate commitment...");
    const candidates1: ExtractedCommitment[] = [
      {
        title: "Review forecast and send feedback",
        description: "Review the forecast and send feedback by next Tuesday.",
        dueDate: "2026-06-16",
        confidence: 0.9,
        reasoning: "Explicit promise to send feedback by next Tuesday.",
        priority: "medium",
        committerEmail: "external-contact@partner.com",
        recipientEmail: "test-user@chiefos.com",
      },
    ];

    const persisted1 = await persistCommitments(candidates1, msg1, user.id);
    console.log(`- Result: Persisted ${persisted1.length} commitment(s).`);
    if (persisted1.length > 0) {
      const c = persisted1[0];
      const metadata = c.metadata as any;
      console.log(`  - Title: "${c.title}"`);
      console.log(`  - Due Date: ${c.dueDate?.toISOString().slice(0, 10)}`);
      console.log(`  - Contact linked: ${c.contactId === contact.id ? "YES (Correct)" : "NO"}`);
      console.log(`  - Fingerprint: "${metadata?.fingerprint}"`);
      console.log(`  - Confidence: ${metadata?.confidence}`);
      console.log(`  - Raw Snippet: "${metadata?.rawSnippet}"`);
      console.log(`  - Direction: ${metadata?.direction}`);
    } else {
      throw new Error("Scenario 1 failed: Commitment was not persisted.");
    }

    // 3. Scenario 2: Double-processing check (Same emailMessageId)
    console.log("\nScenario 2: Double-processing check for same emailMessageId...");
    const persisted2 = await persistCommitments(candidates1, msg1, user.id);
    console.log(`- Result: Persisted ${persisted2.length} commitment(s) on duplicate emailMessageId run.`);
    if (persisted2.length === 0) {
      console.log("  - Success: Correctly skipped because emailMessageId was already processed.");
    } else {
      throw new Error("Scenario 2 failed: Duplicate emailMessageId was not blocked.");
    }

    // 4. Scenario 3: Duplicate fingerprint check
    console.log("\nScenario 3: Duplicate fingerprint check across different emailMessageId...");
    // We try to persist the same commitment (shares exact same fingerprint) but for msg2 (a different message ID)
    const persisted3 = await persistCommitments(candidates1, msg2, user.id);
    console.log(`- Result: Persisted ${persisted3.length} commitment(s) on duplicate fingerprint run.`);
    if (persisted3.length === 0) {
      console.log("  - Success: Correctly skipped because a commitment with the same fingerprint already exists.");
    } else {
      throw new Error("Scenario 3 failed: Duplicate fingerprint was not blocked.");
    }

    // 5. Scenario 4: Sentinel record generation (all commitments below threshold)
    console.log("\nScenario 4: Sentinel record check (all candidates below threshold)...");
    const candidates4: ExtractedCommitment[] = [
      {
        title: "Maybe check that design later",
        description: "Maybe check that design later, not sure.",
        dueDate: null,
        confidence: 0.3, // below threshold
        reasoning: "Tentative suggestion, low confidence.",
        priority: "low",
        committerEmail: "test-user@chiefos.com",
        recipientEmail: "external-contact@partner.com",
      },
    ];

    const persisted4 = await persistCommitments(candidates4, msg3, user.id, { confidenceThreshold: 0.5 });
    console.log(`- Result: Persisted ${persisted4.length} commitment(s).`);
    if (persisted4.length === 1) {
      const c = persisted4[0];
      const metadata = c.metadata as any;
      console.log(`  - Title: "${c.title}" (Expected: NO_COMMITMENTS)`);
      console.log(`  - Is Sentinel: ${metadata?.sentinel === true ? "YES (Correct)" : "NO"}`);
      console.log(`  - Reason: "${c.description}"`);
      console.log(`  - Fingerprint: "${metadata?.fingerprint}"`);
    } else {
      throw new Error("Scenario 4 failed: Sentinel record was not created.");
    }

    console.log("\n==================================================");
    console.log("All scenarios passed successfully!");
    console.log("==================================================");

  } catch (error) {
    console.error("\nTest execution failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
