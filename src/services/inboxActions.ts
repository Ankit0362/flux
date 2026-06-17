import { corsair } from "@/lib/corsair";
import { prisma } from "@/lib/db";

type Metadata = Record<string, unknown>;

function asMetadata(value: unknown): Metadata {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Metadata) : {};
}

export async function archiveThread(userId: string, threadId: string) {
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, userId },
    select: { id: true, externalId: true, labels: true },
  });
  if (!thread) throw new Error("Thread not found");

  const client = corsair.withTenant(userId) as any;
  await client.gmail.api.threads.modify({
    id: thread.externalId,
    removeLabelIds: ["INBOX"],
  });

  return prisma.emailThread.update({
    where: { id: thread.id },
    data: { labels: thread.labels.filter((label) => label !== "INBOX") },
  });
}

export async function remindLaterThread(
  userId: string,
  threadId: string,
  options: { mode?: "fixed" | "until_reply"; remindAt?: string; note?: string } = {}
) {
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, userId },
    select: { id: true, metadata: true },
  });
  if (!thread) throw new Error("Thread not found");

  const remindAt =
    options.mode === "until_reply"
      ? null
      : options.remindAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return prisma.emailThread.update({
    where: { id: thread.id },
    data: {
      metadata: {
        ...asMetadata(thread.metadata),
        fluxSnooze: {
          mode: options.mode ?? "fixed",
          remindAt,
          note: options.note ?? null,
          createdAt: new Date().toISOString(),
        },
      },
    },
  });
}

export async function clearRelevantSnoozesForThread(userId: string, threadId: string) {
  const thread = await prisma.emailThread.findFirst({
    where: { id: threadId, userId },
    select: { id: true, metadata: true },
  });
  if (!thread) return;

  const metadata = asMetadata(thread.metadata);
  if (!metadata.fluxSnooze) return;

  delete metadata.fluxSnooze;
  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { metadata: metadata as Parameters<typeof prisma.emailThread.update>[0]["data"]["metadata"] },
  });
}
