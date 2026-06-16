import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/db";
import { CHIEFOS_TOOL_DECLARATIONS, dispatchTool } from "@/services/askChiefOSTools";
import { AskRequest, AskResponse } from "@/types/ask";
import { GoogleGenAI, Content, Part } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// ─── System Instruction ───────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are Ask ChiefOS, an elite AI Chief of Staff built into ChiefOS.
Your role is to answer questions about the user's commitments, relationships, inbox, and follow-ups — and to take action on their behalf.

RULES:
1. You MUST call the provided tools to fetch real data before answering. Never fabricate data.
2. If a tool returns empty results, state that honestly.
3. After gathering data, you MUST respond ONLY with a valid JSON object matching this exact schema:
   {
     "answer": "<A clear, professional, 2-4 sentence answer grounded in the data>",
     "evidence": [
       {
         "type": "<commitment|relationship|inbox|followup>",
         "id": "<database id>",
         "title": "<short title>",
         "context": "<one sentence explaining why this is relevant>"
       }
     ],
     "actions": [
       {
         "actionType": "<draft_email|view_commitment|view_contact|mark_complete|view_inbox|send_email|reply_to_thread|create_calendar_event>",
         "targetId": "<the relevant database id>",
         "label": "<short action label>",
         "pendingPayload": { ... }  // ONLY for write actions — see below
       }
     ]
   }
4. Evidence should be concrete items from the tool results (up to 5).
5. Actions should be directly executable next steps (up to 3).
6. Be concise, professional, and always grounded in real data.

WRITE ACTION GUIDELINES:
- You now have native write tools (send_email, reply_to_thread, create_calendar_event, reschedule_calendar_event, create_commitment).
- Call these tools directly when the user asks you to take action.
- DO NOT return write actions in your final JSON response. The system will automatically intercept your native tool calls and ask the user for confirmation.
- Only return READ-based UI actions (draft_email, view_commitment, view_contact, mark_complete, view_inbox) in your final JSON response actions array.`;

// ─── Response Schema ──────────────────────────────────────────────────────────

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING", description: "A grounded, professional 2-4 sentence answer." },
    evidence: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: ["commitment", "relationship", "inbox", "followup"] },
          id: { type: "STRING" },
          title: { type: "STRING" },
          context: { type: "STRING" },
        },
        required: ["type", "id", "title", "context"],
      },
    },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          actionType: {
            type: "STRING",
            enum: [
              "draft_email", "view_commitment", "view_contact", "mark_complete", "view_inbox",
              "send_email", "reply_to_thread", "create_calendar_event", "create_event_and_send_email",
              "reschedule_calendar_event", "create_commitment", "update_commitment", "execute_negotiation"
            ],
          },
          targetId: { type: "STRING" },
          label: { type: "STRING" },
          pendingPayload: {
            type: "OBJECT",
            description: "Only for write actions (send_email, reply_to_thread, create_calendar_event). Omit for read actions.",
            properties: {
              kind: { type: "STRING", enum: ["send_email", "reply_to_thread", "create_calendar_event", "create_event_and_send_email", "reschedule_calendar_event", "create_commitment", "update_commitment", "execute_negotiation"] },
              to: { type: "ARRAY", items: { type: "STRING" } },
              subject: { type: "STRING" },
              body: { type: "STRING" },
              threadId: { type: "STRING" },
              title: { type: "STRING" },
              startAt: { type: "STRING" },
              endAt: { type: "STRING" },
              attendees: { type: "ARRAY", items: { type: "STRING" } },
              description: { type: "STRING" },
              location: { type: "STRING" },
            },
            required: ["kind"],
          },
        },
        required: ["actionType", "targetId", "label"],
      },
    },
  },
  required: ["answer", "evidence", "actions"],
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Fetch the primary user (MVP single-user pattern, identical to all other routes)
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = user.id;

    // 2. Parse request body
    const body: AskRequest = await request.json();
    const { query, history = [] } = body;
    if (!query?.trim()) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }
    if (query.length > 500) {
      return NextResponse.json({ error: "Query is too long (max 500 characters)." }, { status: 400 });
    }

    // 3. Validate Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // 4. Build conversation history for multi-turn context
    const conversationHistory: Content[] = history.map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.content }] as Part[],
    }));

    // 5. Append the new user query
    conversationHistory.push({
      role: "user",
      parts: [{ text: query }] as Part[],
    });

    // 6. Agentic tool-calling loop (max 3 rounds to prevent infinite loops)
    const contents: Content[] = [...conversationHistory];
    let finalAnswer: AskResponse | null = null;
    const MAX_ROUNDS = 3;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations: CHIEFOS_TOOL_DECLARATIONS as never }],
          // Only enforce JSON schema on the final text response (not tool-call turns)
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) throw new Error("No response candidate from Gemini.");

      const parts = candidate.content?.parts ?? [];

      // Check for function calls in this response
      const functionCallParts = parts.filter((p: Part) => p.functionCall);

      if (functionCallParts.length > 0) {
        // Intercept Write Actions to require confirmation
        const WRITE_TOOLS = new Set([
          "send_email", "reply_to_thread", "create_calendar_event",
          "reschedule_calendar_event", "create_commitment",
          "update_commitment", "execute_negotiation"
        ]);
        
        const writeCall = functionCallParts.find(p => p.functionCall && WRITE_TOOLS.has(p.functionCall.name!));
        
        if (writeCall) {
          const { name, args } = writeCall.functionCall!;
          const argDict = (args as Record<string, unknown>) ?? {};
          
          let actionLabel = "Execute Action";
          if (name === "send_email") actionLabel = "Send Email";
          else if (name === "reply_to_thread") actionLabel = "Reply to Thread";
          else if (name === "create_calendar_event") actionLabel = "Create Event";
          else if (name === "reschedule_calendar_event") actionLabel = "Reschedule Event";
          else if (name === "create_commitment") actionLabel = "Create Commitment";
          else if (name === "update_commitment") actionLabel = "Update Commitment";
          
          finalAnswer = {
            answer: "I've drafted the requested action. Please review and confirm to proceed.",
            evidence: [],
            actions: [
              {
                actionType: name as string,
                targetId: "pending",
                label: actionLabel,
                pendingPayload: { kind: name as string, ...argDict }
              }
            ]
          };
          break; // Halt agent loop and return to client
        }

        // Append the model's function call turn to history
        contents.push({ role: "model", parts });

        // Execute each READ tool call and collect results
        const toolResponseParts: Part[] = await Promise.all(
          functionCallParts.map(async (p: Part) => {
            const { name, args } = p.functionCall!;
            if (!name) {
              throw new Error("Function call name is undefined.");
            }
            let result: unknown;
            try {
              // SECURITY: userId always comes from the server session, never from LLM args
              result = await dispatchTool(userId, name, (args as Record<string, unknown>) ?? {});
            } catch (err: unknown) {
              result = { error: err instanceof Error ? err.message : "Tool execution failed." };
            }
            return {
              functionResponse: {
                name,
                response: { result },
              },
            } as Part;
          })
        );

        // Append tool results back to the conversation
        contents.push({ role: "user", parts: toolResponseParts });
        // Continue to next round so Gemini can synthesize
        continue;
      }

      // No function calls — this is the final text response
      const textPart = parts.find((p: Part) => p.text);
      if (textPart?.text) {
        try {
          // Use structured output for the final synthesis step
          const finalResponse = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [
              ...contents,
              { role: "model", parts: [{ text: textPart.text }] },
              {
                role: "user",
                parts: [
                  {
                    text: "Now format your findings as the required JSON schema with answer, evidence, and actions fields.",
                  },
                ],
              },
            ],
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              responseSchema: RESPONSE_SCHEMA as never,
            },
          });

          const rawText = finalResponse.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            finalAnswer = {
              answer: parsed.answer ?? "I was unable to generate an answer.",
              evidence: parsed.evidence ?? [],
              actions: parsed.actions ?? [],
            };
          }
        } catch {
          // Fallback: try parsing the raw text directly
          try {
            const parsed = JSON.parse(textPart.text);
            finalAnswer = {
              answer: parsed.answer ?? textPart.text,
              evidence: parsed.evidence ?? [],
              actions: parsed.actions ?? [],
            };
          } catch {
            finalAnswer = { answer: textPart.text, evidence: [], actions: [] };
          }
        }
        break;
      }

      break; // Safety: exit if no text and no function calls
    }

    if (!finalAnswer) {
      finalAnswer = {
        answer: "I was unable to retrieve your data at this time. Please try again.",
        evidence: [],
        actions: [],
      };
    }

    return NextResponse.json(finalAnswer);
  } catch (err: unknown) {
    console.error("Ask ChiefOS API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
