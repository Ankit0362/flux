import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeFollowUpsForUser } from "../../src/services/followUpIntelligence";
import { prisma } from "../../src/lib/db";

// Mock the environment variable
process.env.GEMINI_API_KEY = "test-api-key";

// Create hoisted mock definitions for GoogleGenAI
const { mockGenerateContent, MockGoogleGenAI } = vi.hoisted(() => {
  const mockGen = vi.fn();
  class MockGenAI {
    models = {
      generateContent: mockGen,
    };
  }
  return { mockGenerateContent: mockGen, MockGoogleGenAI: MockGenAI };
});

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: MockGoogleGenAI,
  };
});

// Mock the Prisma client
vi.mock("../../src/lib/db", () => {
  return {
    prisma: {
      emailThread: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe("FollowUpIntelligence Service", () => {
  const userId = "test-user-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 0 and not call Gemini if no threads are found", async () => {
    vi.mocked(prisma.emailThread.findMany).mockResolvedValue([]);

    const result = await analyzeFollowUpsForUser(userId);

    expect(result).toBe(0);
    expect(prisma.emailThread.findMany).toHaveBeenCalledWith({
      where: {
        userId,
        updatedAt: { gte: expect.any(Date) },
      },
      include: {
        messages: {
          orderBy: { receivedAt: "desc" },
        },
      },
    });
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(prisma.emailThread.update).not.toHaveBeenCalled();
  });

  it("should skip threads with no messages", async () => {
    vi.mocked(prisma.emailThread.findMany).mockResolvedValue([
      {
        id: "thread-1",
        userId,
        subject: "No messages",
        messages: [],
        lastMessageAt: null,
      } as any,
    ]);

    const result = await analyzeFollowUpsForUser(userId);

    expect(result).toBe(0);
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(prisma.emailThread.update).not.toHaveBeenCalled();
  });

  it("should skip threads already analyzed up to the latest message", async () => {
    const latestDate = new Date("2026-06-09T10:00:00Z");
    vi.mocked(prisma.emailThread.findMany).mockResolvedValue([
      {
        id: "thread-1",
        userId,
        subject: "Already analyzed",
        lastMessageAt: latestDate,
        messages: [
          {
            id: "msg-1",
            direction: "OUTBOUND",
            receivedAt: latestDate,
            sender: "User <user@example.com>",
            body: "Just checking in.",
          },
        ],
      } as any,
    ]);

    const result = await analyzeFollowUpsForUser(userId);

    expect(result).toBe(0);
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(prisma.emailThread.update).not.toHaveBeenCalled();
  });

  it("should analyze threads that have new messages and save results", async () => {
    const messageDate = new Date("2026-06-08T10:00:00Z");
    vi.mocked(prisma.emailThread.findMany).mockResolvedValue([
      {
        id: "thread-need-analysis",
        userId,
        subject: "Follow up test",
        lastMessageAt: null, // needs analysis
        messages: [
          {
            id: "msg-2",
            direction: "OUTBOUND",
            receivedAt: messageDate,
            sender: "User <user@example.com>",
            body: "Did you review the proposal?",
          },
        ],
      } as any,
    ]);

    // Mock Gemini response
    const mockResponse = {
      text: JSON.stringify({
        lastMessageDirection: "OUTBOUND",
        daysSinceLastResponse: 2,
        followUpNeeded: true,
        followUpUrgency: "MEDIUM",
        reason: "Outbound email sent 2 days ago with no reply.",
      }),
    };
    mockGenerateContent.mockResolvedValue(mockResponse);

    const result = await analyzeFollowUpsForUser(userId);

    expect(result).toBe(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    
    // Check parameters sent to Gemini generateContent
    const generateCall = mockGenerateContent.mock.calls[0][0];
    expect(generateCall.model).toBe("gemini-2.0-flash");
    expect(generateCall.contents).toContain("Follow up test");
    expect(generateCall.contents).toContain("OUTBOUND");
    expect(generateCall.config.responseMimeType).toBe("application/json");

    // Verify database update
    expect(prisma.emailThread.update).toHaveBeenCalledWith({
      where: { id: "thread-need-analysis" },
      data: {
        followUpNeeded: true,
        followUpUrgency: "MEDIUM",
        followUpReason: "Outbound email sent 2 days ago with no reply.",
        lastMessageDirection: "OUTBOUND",
        lastMessageAt: messageDate,
      },
    });
  });

  it("should handle Gemini API errors gracefully without crashing the whole loop", async () => {
    vi.mocked(prisma.emailThread.findMany).mockResolvedValue([
      {
        id: "thread-error",
        userId,
        subject: "Error prone thread",
        lastMessageAt: null,
        messages: [
          {
            id: "msg-3",
            direction: "INBOUND",
            receivedAt: new Date(),
            sender: "Client <client@example.com>",
            body: "Help me!",
          },
        ],
      } as any,
    ]);

    // Make Gemini throw error
    mockGenerateContent.mockRejectedValue(new Error("Gemini API is down"));

    // Verify it doesn't throw and returns 0 updated threads
    await expect(analyzeFollowUpsForUser(userId)).resolves.toBe(0);
    expect(prisma.emailThread.update).not.toHaveBeenCalled();
  });
});
