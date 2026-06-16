import { prisma } from "../src/lib/db";
import { GET } from "../src/app/api/commitments/route";
import { PATCH } from "../src/app/api/commitments/[id]/route";
import { NextRequest } from "next/server";
import { CommitmentStatus, EmailDirection } from "@prisma/client";

async function runTests() {
  console.log("==================================================");
  console.log("Starting Phase 3 API Integration Test Suite");
  console.log("==================================================\n");

  let testUser: any = null;
  let testMsg: any = null;
  const createdCommitmentIds: string[] = [];

  try {
    // 1. Setup Test User and Email Message
    testUser = await prisma.user.upsert({
      where: { email: "api-test-user@chiefos.com" },
      update: {},
      create: {
        email: "api-test-user@chiefos.com",
        name: "API Test User",
      },
    });
    console.log(`- Setup Test User: ${testUser.name} [ID: ${testUser.id}]`);

    const thread = await prisma.emailThread.upsert({
      where: { externalId: "api-test-thread-001" },
      update: {},
      create: {
        userId: testUser.id,
        externalId: "api-test-thread-001",
        subject: "API Test Thread",
        snippet: "Snippet for api testing",
      },
    });

    testMsg = await prisma.emailMessage.upsert({
      where: { externalId: "api-test-msg-001" },
      update: {},
      create: {
        threadId: thread.id,
        externalId: "api-test-msg-001",
        sender: "partner@example.com",
        recipients: ["api-test-user@chiefos.com"],
        subject: "API Test Thread",
        body: "I promise to deliver the report tomorrow.",
        direction: EmailDirection.INBOUND,
        receivedAt: new Date(),
      },
    });
    console.log(`- Setup Test Email Message: [ID: ${testMsg.id}]`);

    // Clean up any old test commitments to start fresh
    await prisma.commitment.deleteMany({
      where: { userId: testUser.id },
    });

    // 2. Create Test Commitments with different statuses
    const pendingC = await prisma.commitment.create({
      data: {
        userId: testUser.id,
        title: "Test Pending Commitment",
        description: "Must finish this pending task.",
        status: CommitmentStatus.PENDING,
        dueDate: new Date("2026-07-01"),
        emailMessageId: testMsg.id,
        emailThreadId: thread.id,
        metadata: {
          confidence: 0.95,
          direction: EmailDirection.INBOUND,
          fingerprint: "fingerprint-pending-01",
        },
      },
    });
    createdCommitmentIds.push(pendingC.id);

    const completedC = await prisma.commitment.create({
      data: {
        userId: testUser.id,
        title: "Test Completed Commitment",
        description: "This task was already completed.",
        status: CommitmentStatus.COMPLETED,
        dueDate: new Date("2026-06-01"),
        completedAt: new Date(),
        emailMessageId: testMsg.id,
        emailThreadId: thread.id,
        metadata: {
          confidence: 0.8,
          direction: EmailDirection.OUTBOUND,
          fingerprint: "fingerprint-completed-01",
        },
      },
    });
    createdCommitmentIds.push(completedC.id);

    const snoozedC = await prisma.commitment.create({
      data: {
        userId: testUser.id,
        title: "Test Snoozed Commitment",
        description: "This task was snoozed.",
        status: CommitmentStatus.SNOOZED,
        dueDate: new Date("2026-08-01"),
        emailMessageId: testMsg.id,
        emailThreadId: thread.id,
        metadata: {
          confidence: 0.75,
          direction: EmailDirection.INBOUND,
          fingerprint: "fingerprint-snoozed-01",
        },
      },
    });
    createdCommitmentIds.push(snoozedC.id);

    // Create a Sentinel record (should be filtered out)
    const sentinelC = await prisma.commitment.create({
      data: {
        userId: testUser.id,
        title: "NO_COMMITMENTS",
        description: "No commitments found.",
        status: CommitmentStatus.PENDING,
        emailMessageId: testMsg.id,
        emailThreadId: thread.id,
        metadata: {
          sentinel: true,
          confidence: 0,
          fingerprint: "sentinel-01",
        },
      },
    });
    createdCommitmentIds.push(sentinelC.id);

    console.log(`- Created 3 test commitments (PENDING, COMPLETED, SNOOZED) and 1 sentinel record.`);

    // ==========================================
    // GET Endpoints Tests
    // ==========================================
    console.log("\n--- Testing GET /api/commitments ---");

    // Test 1: Fetch all (should return 3, excluding sentinel)
    const req1 = new NextRequest("http://localhost/api/commitments");
    const res1 = await GET(req1);
    const data1 = await res1.json();
    console.log(`Test 1: Fetch all. Status: ${res1.status}, Count: ${data1.commitments?.length}`);
    if (res1.status !== 200) throw new Error("Test 1 failed: Expected status 200");
    if (data1.commitments?.length !== 3) throw new Error(`Test 1 failed: Expected 3 commitments, got ${data1.commitments?.length}`);
    
    // Verify DTO fields
    const firstC = data1.commitments[0];
    if (!firstC.id || !firstC.title || firstC.confidence === undefined || !firstC.direction) {
      throw new Error("Test 1 failed: Commitment DTO is missing fields");
    }
    if (!firstC.sourceEmail || !firstC.source || firstC.sourceEmail.id !== testMsg.id) {
      throw new Error("Test 1 failed: sourceEmail/source was not mapped correctly");
    }
    console.log("  - Success: Returned correct fields, mapped sourceEmail, excluded sentinel.");

    // Test 2: Filter status=PENDING
    const req2 = new NextRequest("http://localhost/api/commitments?status=PENDING");
    const res2 = await GET(req2);
    const data2 = await res2.json();
    console.log(`Test 2: Filter status=PENDING. Status: ${res2.status}, Count: ${data2.commitments?.length}`);
    if (res2.status !== 200) throw new Error("Test 2 failed: Expected status 200");
    if (data2.commitments?.length !== 1 || data2.commitments[0].status !== CommitmentStatus.PENDING) {
      throw new Error("Test 2 failed: Expected exactly 1 PENDING commitment");
    }
    console.log("  - Success: Filtered PENDING correctly.");

    // Test 3: Filter status=COMPLETED
    const req3 = new NextRequest("http://localhost/api/commitments?status=COMPLETED");
    const res3 = await GET(req3);
    const data3 = await res3.json();
    console.log(`Test 3: Filter status=COMPLETED. Status: ${res3.status}, Count: ${data3.commitments?.length}`);
    if (res3.status !== 200) throw new Error("Test 3 failed: Expected status 200");
    if (data3.commitments?.length !== 1 || data3.commitments[0].status !== CommitmentStatus.COMPLETED) {
      throw new Error("Test 3 failed: Expected exactly 1 COMPLETED commitment");
    }
    console.log("  - Success: Filtered COMPLETED correctly.");

    // Test 4: Filter status=SNOOZED
    const req4 = new NextRequest("http://localhost/api/commitments?status=snoozed"); // lowercase should be handled
    const res4 = await GET(req4);
    const data4 = await res4.json();
    console.log(`Test 4: Filter status=snoozed. Status: ${res4.status}, Count: ${data4.commitments?.length}`);
    if (res4.status !== 200) throw new Error("Test 4 failed: Expected status 200");
    if (data4.commitments?.length !== 1 || data4.commitments[0].status !== CommitmentStatus.SNOOZED) {
      throw new Error("Test 4 failed: Expected exactly 1 SNOOZED commitment");
    }
    console.log("  - Success: Filtered lowercase 'snoozed' correctly.");

    // Test 5: Invalid status filter
    const req5 = new NextRequest("http://localhost/api/commitments?status=INVALID_STATUS");
    const res5 = await GET(req5);
    const data5 = await res5.json();
    console.log(`Test 5: Invalid status filter. Status: ${res5.status}, Error: "${data5.error}"`);
    if (res5.status !== 400) throw new Error("Test 5 failed: Expected status 400");
    console.log("  - Success: Blocked invalid status filter.");

    // ==========================================
    // PATCH Endpoints Tests
    // ==========================================
    console.log("\n--- Testing PATCH /api/commitments/[id] ---");

    // Test 6: Valid transition PENDING -> COMPLETED
    const req6 = new NextRequest(`http://localhost/api/commitments/${pendingC.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    const res6 = await PATCH(req6, { params: Promise.resolve({ id: pendingC.id }) });
    const data6 = await res6.json();
    console.log(`Test 6: PENDING -> COMPLETED. Status: ${res6.status}, New Status: ${data6.commitment?.status}`);
    if (res6.status !== 200) throw new Error("Test 6 failed: Expected status 200");
    if (data6.commitment?.status !== CommitmentStatus.COMPLETED) {
      throw new Error("Test 6 failed: Expected status in response to be COMPLETED");
    }
    // Verify in db
    const dbPendingCheck = await prisma.commitment.findUnique({ where: { id: pendingC.id } });
    if (dbPendingCheck?.status !== CommitmentStatus.COMPLETED || !dbPendingCheck.completedAt) {
      throw new Error("Test 6 failed: Database status was not updated or completedAt not set");
    }
    console.log("  - Success: Transitioned PENDING -> COMPLETED and set completedAt.");

    // Test 7: Block invalid transition (now that it is COMPLETED, try to transition to SNOOZED)
    const req7 = new NextRequest(`http://localhost/api/commitments/${pendingC.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SNOOZED" }),
    });
    const res7 = await PATCH(req7, { params: Promise.resolve({ id: pendingC.id }) });
    const data7 = await res7.json();
    console.log(`Test 7: Block COMPLETED -> SNOOZED. Status: ${res7.status}, Error: "${data7.error}"`);
    if (res7.status !== 400) throw new Error("Test 7 failed: Expected status 400");
    console.log("  - Success: Blocked transition from COMPLETED.");

    // Test 8: Block invalid target status (try to transition SNOOZED to PENDING)
    const req8 = new NextRequest(`http://localhost/api/commitments/${snoozedC.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PENDING" }),
    });
    const res8 = await PATCH(req8, { params: Promise.resolve({ id: snoozedC.id }) });
    const data8 = await res8.json();
    console.log(`Test 8: Block SNOOZED -> PENDING. Status: ${res8.status}, Error: "${data8.error}"`);
    if (res8.status !== 400) throw new Error("Test 8 failed: Expected status 400");
    console.log("  - Success: Blocked transition to invalid target status.");

    // Test 9: 404 for non-existent commitment ID
    const randomId = "00000000-0000-0000-0000-000000000000";
    const req9 = new NextRequest(`http://localhost/api/commitments/${randomId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    const res9 = await PATCH(req9, { params: Promise.resolve({ id: randomId }) });
    const data9 = await res9.json();
    console.log(`Test 9: Patch non-existent ID. Status: ${res9.status}, Error: "${data9.error}"`);
    if (res9.status !== 404) throw new Error("Test 9 failed: Expected status 404");
    console.log("  - Success: Returned 404 for missing ID.");

    console.log("\n==================================================");
    console.log("All Integration Tests Passed Successfully!");
    console.log("==================================================");
  } catch (error) {
    console.error("\nIntegration test run failed:", error);
    process.exit(1);
  } finally {
    // 3. Clean up database records
    console.log("\nCleaning up test records from database...");
    if (testUser) {
      await prisma.commitment.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.emailMessage.deleteMany({
        where: {
          thread: {
            userId: testUser.id,
          },
        },
      });
      await prisma.emailThread.deleteMany({
        where: { userId: testUser.id },
      });
      await prisma.user.delete({
        where: { id: testUser.id },
      });
      console.log("- Database cleanup finished.");
    }
    await prisma.$disconnect();
  }
}

runTests();
