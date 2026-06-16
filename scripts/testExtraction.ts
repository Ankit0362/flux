import { extractCommitmentsFromMessage } from "../src/services/commitmentExtraction";
import { prisma } from "../src/lib/db";

// Mock email messages for test cases
const MOCK_MESSAGES = [
  {
    id: "mock-msg-001",
    subject: "Project update and deliverables",
    sender: "John Doe <user@example.com>",
    recipients: ["sarah@partner.com"],
    receivedAt: new Date("2026-06-08T18:30:00Z"),
    body: `Hi Sarah,

Thanks for the call earlier. I will send over the updated financial forecast by this Friday. Also, I'll schedule the design review meeting next Monday.

Best,
John`,
    description: "Outbound commitments (sender is user)",
  },
  {
    id: "mock-msg-002",
    subject: "Re: Project update and deliverables",
    sender: "Sarah Smith <sarah@partner.com>",
    recipients: ["user@example.com"],
    receivedAt: new Date("2026-06-08T19:45:00Z"),
    body: `Thanks John! That sounds great. 

I will review the forecast as soon as I get it and send my feedback by next Tuesday.

Best,
Sarah`,
    description: "Inbound commitment (sender is other)",
  },
  {
    id: "mock-msg-003",
    subject: "Weekly tech newsletter",
    sender: "Tech Digest <newsletter@tech.com>",
    recipients: ["user@example.com"],
    receivedAt: new Date("2026-06-08T20:00:00Z"),
    body: `Hello readers,

Here is your weekly digest of what happened in tech. Rust is growing, AI is everywhere. Read more at our website. No action is required.

Best,
The Newsletter Team`,
    description: "Neutral message (no commitments)",
  },
];

async function runTests() {
  console.log("=========================================");
  console.log("Commitment Extraction Verification Tool");
  console.log("=========================================\n");

  const messageIdArg = process.argv[2];

  if (messageIdArg) {
    console.log(`Attempting to fetch message with ID: ${messageIdArg} from DB...`);
    try {
      const message = await prisma.emailMessage.findFirst({
        where: {
          OR: [
            { id: messageIdArg },
            { externalId: messageIdArg }
          ]
        }
      });

      if (!message) {
        console.error(`Error: Message with ID '${messageIdArg}' not found in database.`);
        process.exit(1);
      }

      console.log(`Found message in database:`);
      console.log(`- Subject: ${message.subject}`);
      console.log(`- Sender: ${message.sender}`);
      console.log(`- Date: ${message.receivedAt}`);
      console.log(`Running extraction...\n`);

      const results = await extractCommitmentsFromMessage({
        id: message.id,
        subject: message.subject,
        body: message.body,
        sender: message.sender,
        recipients: message.recipients,
        receivedAt: message.receivedAt,
      });

      console.log("--- Extraction Results ---");
      console.log(JSON.stringify(results, null, 2));
      console.log("\nDone.");
    } catch (err) {
      console.error("Database query failed:", err);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    // If no argument, ask if they want to query database latest message OR run mock tests
    console.log("No specific message ID provided. Running mock test suite...");
    console.log("If you want to run on a database message, pass its ID or external ID as an argument:");
    console.log("e.g. npx ts-node scripts/testExtraction.ts <message_id>\n");

    // Check if we can get the latest email from database as well
    let latestMessage: any = null;
    try {
      latestMessage = await prisma.emailMessage.findFirst({
        orderBy: { receivedAt: "desc" }
      });
      if (latestMessage) {
        console.log(`Note: Most recent message in database has ID: "${latestMessage.id}"`);
      }
    } catch (_e) {
      // Ignored if DB is not set up or configured
      console.log("(Note: Could not query latest message from DB. Make sure postgres is running if using DB.)");
    } finally {
      await prisma.$disconnect();
    }

    for (let i = 0; i < MOCK_MESSAGES.length; i++) {
      const mockMsg = MOCK_MESSAGES[i];
      console.log(`\n-----------------------------------------`);
      console.log(`Test Case ${i + 1}: ${mockMsg.description}`);
      console.log(`Sender: ${mockMsg.sender}`);
      console.log(`Subject: ${mockMsg.subject}`);
      console.log(`-----------------------------------------`);
      
      try {
        const results = await extractCommitmentsFromMessage(mockMsg);
        console.log("Extracted Commitments:");
        console.log(JSON.stringify(results, null, 2));
      } catch (err: unknown) {
        console.error("Extraction failed for test case:", (err instanceof Error ? err.message : String(err)) || err);
      }
    }
    console.log("\n=========================================");
    console.log("Verification finished.");
    console.log("=========================================");
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
