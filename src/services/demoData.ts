import { ContactInsightDTO } from "@/types/contacts";
import { CommitmentStatus } from "@prisma/client";

// MOCK CONSTANTS
const RECRUITER_ID = "demo-contact-recruiter";
const CLIENT_ID = "demo-contact-client";
const FOUNDER_ID = "demo-contact-founder";
const ADVISOR_ID = "demo-contact-advisor";

const RECRUITER_EMAIL = "sarah.jenkins@apextalent.com";
const CLIENT_EMAIL = "david.vance@acmecorp.com";
const FOUNDER_EMAIL = "elena.rostova@futureai.io";
const ADVISOR_EMAIL = "marcus.aurelius@vcpartners.com";

export class DemoStore {
  private static instance: DemoStore;

  public contacts: any[] = [];
  public commitments: any[] = [];
  public threads: any[] = [];
  public messages: any[] = [];
  public executiveBriefing: any = null;

  private constructor() {
    this.reset();
  }

  public static getInstance(): DemoStore {
    if (!DemoStore.instance) {
      DemoStore.instance = new DemoStore();
    }
    return DemoStore.instance;
  }

  public reset() {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twelveDaysAgo = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    // 1. Seed Contacts
    this.contacts = [
      {
        id: CLIENT_ID,
        email: CLIENT_EMAIL,
        name: "David Vance",
        company: "Acme Corp",
        avatarUrl: null,
        phoneNumber: "+1 (555) 382-9901",
        relationshipScore: 20,
        relationshipHealth: "At Risk",
        relationshipReason: "At Risk due to 1 critical overdue deliverable (API Integration documentation).",
        totalExchanges: 14,
        inboundCount: 8,
        outboundCount: 6,
        openCommitments: 1,
        completedCommitments: 1,
        lastInteractionAt: oneDayAgo,
      },
      {
        id: RECRUITER_ID,
        email: RECRUITER_EMAIL,
        name: "Sarah Jenkins",
        company: "Apex Talent Group",
        avatarUrl: null,
        phoneNumber: "+1 (555) 192-3847",
        relationshipScore: 55,
        relationshipHealth: "At Risk",
        relationshipReason: "At Risk due to no communication in 12 days and pending contract signature promise.",
        totalExchanges: 4,
        inboundCount: 2,
        outboundCount: 2,
        openCommitments: 1,
        completedCommitments: 1,
        lastInteractionAt: twelveDaysAgo,
      },
      {
        id: FOUNDER_ID,
        email: FOUNDER_EMAIL,
        name: "Elena Rostova",
        company: "FutureAI Inc.",
        avatarUrl: null,
        phoneNumber: "+1 (555) 837-1920",
        relationshipScore: 85,
        relationshipHealth: "Strong",
        relationshipReason: "Strong because of frequent interactions and active YC mockup guidance.",
        totalExchanges: 18,
        inboundCount: 10,
        outboundCount: 8,
        openCommitments: 1,
        completedCommitments: 2,
        lastInteractionAt: twoDaysAgo,
      },
      {
        id: ADVISOR_ID,
        email: ADVISOR_EMAIL,
        name: "Dr. Marcus Aurelius",
        company: "VC Partners",
        avatarUrl: null,
        phoneNumber: "+1 (555) 902-1845",
        relationshipScore: 95,
        relationshipHealth: "Strong",
        relationshipReason: "Strong with steady communication. Catch up meeting scheduled.",
        totalExchanges: 6,
        inboundCount: 3,
        outboundCount: 3,
        openCommitments: 1,
        completedCommitments: 1,
        lastInteractionAt: fourDaysAgo,
      },
    ];

    // 2. Seed Commitments
    this.commitments = [
      {
        id: "demo-commitment-1",
        title: "Deliver API integration documentation for Acme Corp kickoff",
        dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Overdue by 2 days
        status: CommitmentStatus.PENDING,
        confidence: 0.95,
        direction: "OUTBOUND",
        contactId: CLIENT_ID,
        emailMessageId: "demo-msg-client-1",
        riskScore: 90,
        riskLevel: "HIGH",
        riskReason: "2 days past due date with blocker signals in client communication.",
        createdAt: twoDaysAgo,
      },
      {
        id: "demo-commitment-2",
        title: "Submit Apex recruitment candidate agreement & signed NDA",
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // Due in 3 days
        status: CommitmentStatus.PENDING,
        confidence: 0.88,
        direction: "INBOUND",
        contactId: RECRUITER_ID,
        emailMessageId: "demo-msg-recruiter-1",
        riskScore: 45,
        riskLevel: "MEDIUM",
        riskReason: "Pending inbound action. Relates to contract signature with no recent exchange.",
        createdAt: twelveDaysAgo,
      },
      {
        id: "demo-commitment-3",
        title: "Introduce FutureAI to Sequoia Venture Partner",
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // Due in 5 days
        status: CommitmentStatus.PENDING,
        confidence: 0.90,
        direction: "OUTBOUND",
        contactId: FOUNDER_ID,
        emailMessageId: "demo-msg-founder-1",
        riskScore: 20,
        riskLevel: "LOW",
        riskReason: "No significant risk factors active.",
        createdAt: twoDaysAgo,
      },
      {
        id: "demo-commitment-4",
        title: "Meet Marcus for coffee catch up and advisory agreement signoff",
        dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // Due tomorrow
        status: CommitmentStatus.PENDING,
        confidence: 0.85,
        direction: "OUTBOUND",
        contactId: ADVISOR_ID,
        emailMessageId: "demo-msg-advisor-1",
        riskScore: 10,
        riskLevel: "LOW",
        riskReason: "No significant risk factors active.",
        createdAt: fourDaysAgo,
      },
      // Completed commitments
      {
        id: "demo-commitment-5",
        title: "Send latest CV and github profile list",
        dueDate: twelveDaysAgo,
        status: CommitmentStatus.COMPLETED,
        confidence: 0.92,
        direction: "OUTBOUND",
        contactId: RECRUITER_ID,
        emailMessageId: "demo-msg-recruiter-2",
        riskScore: 0,
        riskLevel: "LOW",
        riskReason: "No significant risk factors active.",
        createdAt: twelveDaysAgo,
      },
      {
        id: "demo-commitment-6",
        title: "Review Acme enterprise terms draft",
        dueDate: tenDaysAgo,
        status: CommitmentStatus.COMPLETED,
        confidence: 0.90,
        direction: "INBOUND",
        contactId: CLIENT_ID,
        emailMessageId: "demo-msg-client-2",
        riskScore: 0,
        riskLevel: "LOW",
        riskReason: "No significant risk factors active.",
        createdAt: tenDaysAgo,
      },
      {
        id: "demo-commitment-7",
        title: "Review YC pitch deck and provide mockup feedback comments",
        dueDate: fourDaysAgo,
        status: CommitmentStatus.COMPLETED,
        confidence: 0.89,
        direction: "OUTBOUND",
        contactId: FOUNDER_ID,
        emailMessageId: "demo-msg-founder-2",
        riskScore: 0,
        riskLevel: "LOW",
        riskReason: "No significant risk factors active.",
        createdAt: fourDaysAgo,
      },
    ];

    // 3. Seed Email Threads & Messages
    this.messages = [
      // Acme Corp Thread
      {
        id: "demo-msg-client-1",
        threadId: "demo-thread-client",
        externalId: "g-msg-client-1",
        sender: `David Vance <${CLIENT_EMAIL}>`,
        recipients: ["user@flux.ai"],
        subject: "URGENT: Acme Corp / Flux Integration specs missing",
        body: "Hi there, we were expecting the final API integration documentation yesterday. Our engineering team is currently blocked from starting the sandbox tests. When can we expect this deliverable? Let's make sure it doesn't slip, as our launch is scheduled for next Monday. Let's sync up as soon as possible.",
        direction: "INBOUND",
        receivedAt: oneDayAgo,
      },
      {
        id: "demo-msg-client-2",
        threadId: "demo-thread-client",
        externalId: "g-msg-client-2",
        sender: "user@flux.ai",
        recipients: [CLIENT_EMAIL],
        subject: "Re: Acme Corp / Flux Integration specs missing",
        body: "Hi David, I am finalizing the API schema documentation today. I will send it over first thing tomorrow morning so your developers can get unblocked. Apologies for the slight delay.",
        direction: "OUTBOUND",
        receivedAt: twoDaysAgo,
      },
      // Recruiter Thread
      {
        id: "demo-msg-recruiter-1",
        threadId: "demo-thread-recruiter",
        externalId: "g-msg-recruiter-1",
        sender: `Sarah Jenkins <${RECRUITER_EMAIL}>`,
        recipients: ["user@flux.ai"],
        subject: "Apex Talent Recruitment - Chief Technology Officer search next steps",
        body: "Hi, thanks for catching up yesterday. I enjoyed hearing about your background. I've attached the Apex recruitment agreement and candidate NDA. Please review and sign the NDA so we can begin presenting candidates next week. Also, let me know if you had a chance to compile your salary benchmark expectations.",
        direction: "INBOUND",
        receivedAt: twelveDaysAgo,
      },
      // Founder Thread
      {
        id: "demo-msg-founder-1",
        threadId: "demo-thread-founder",
        externalId: "g-msg-founder-1",
        sender: `Elena Rostova <${FOUNDER_EMAIL}>`,
        recipients: ["user@flux.ai"],
        subject: "YC Pitch deck review & Sequoia intros",
        body: "Hey, thanks again for reviewing our YC pitch deck and sharing your mockup feedback! That was extremely helpful. As discussed, would you be open to introducing us to the Venture Partner at Sequoia who handles AI investments? Let me know when you have a free moment. Thanks!",
        direction: "INBOUND",
        receivedAt: twoDaysAgo,
      },
      // Advisor Thread
      {
        id: "demo-msg-advisor-1",
        threadId: "demo-thread-advisor",
        externalId: "g-msg-advisor-1",
        sender: `Dr. Marcus Aurelius <${ADVISOR_EMAIL}>`,
        recipients: ["user@flux.ai"],
        subject: "Advisors agreement feedback & Catch up",
        body: "Hello! I hope you are doing well. I've reviewed your suggestions for the advisory agreement and they look solid. Let's catch up over coffee this Thursday to finalize it. Let me know if 10 AM works for you.",
        direction: "INBOUND",
        receivedAt: fourDaysAgo,
      },
    ];

    this.threads = [
      {
        id: "demo-thread-client",
        externalId: "g-thread-client",
        subject: "URGENT: Acme Corp / Flux Integration specs missing",
        snippet: "Hi there, we were expecting the final API integration documentation yesterday...",
        labels: ["INBOX", "UNREAD"],
        followUpNeeded: true,
        followUpUrgency: "CRITICAL",
        followUpReason: "Inbound urgent client email sent 1 day ago asking for API specs with team blocked.",
        lastMessageDirection: "INBOUND",
        lastMessageAt: oneDayAgo,
      },
      {
        id: "demo-thread-recruiter",
        externalId: "g-thread-recruiter",
        subject: "Apex Talent Recruitment - Chief Technology Officer search next steps",
        snippet: "Hi, thanks for catching up yesterday. I've attached the Apex agreement...",
        labels: ["INBOX"],
        followUpNeeded: true,
        followUpUrgency: "MEDIUM",
        followUpReason: "Inbound recruitment message outstanding for 12 days regarding NDA signature.",
        lastMessageDirection: "INBOUND",
        lastMessageAt: twelveDaysAgo,
      },
      {
        id: "demo-thread-founder",
        externalId: "g-thread-founder",
        subject: "YC Pitch deck review & Sequoia intros",
        snippet: "Hey, thanks again for reviewing our YC pitch deck and sharing...",
        labels: ["INBOX"],
        followUpNeeded: true,
        followUpUrgency: "HIGH",
        followUpReason: "Inbound Sequoia introduction ask from Elena outstanding for 2 days.",
        lastMessageDirection: "INBOUND",
        lastMessageAt: twoDaysAgo,
      },
      {
        id: "demo-thread-advisor",
        externalId: "g-thread-advisor",
        subject: "Advisors agreement feedback & Catch up",
        snippet: "Hello! I hope you are doing well. I've reviewed your suggestions...",
        labels: ["INBOX"],
        followUpNeeded: false,
        followUpUrgency: "LOW",
        followUpReason: "Coffee sync set for tomorrow.",
        lastMessageDirection: "INBOUND",
        lastMessageAt: fourDaysAgo,
      },
    ];

    // 4. Seed Executive Briefing DTO
    this.executiveBriefing = {
      executiveSummary: "Today's focal points involve clearing the API integration blocker for David Vance (Acme Corp), who is currently blocked. You also have an outstanding introduction request from Elena Rostova (FutureAI) to Sequoia, and a pending NDA review with Sarah Jenkins (Apex Talent) from 12 days ago. On the positive side, advisory agreement terms with Dr. Marcus Aurelius are finalized ahead of your catch-up tomorrow.",
      topRisks: [
        {
          commitmentId: "demo-commitment-1",
          title: "Deliver API integration documentation for Acme Corp kickoff",
          riskLevel: "HIGH",
          reason: "Overdue by 2 days. David Vance noted his engineering team is completely blocked.",
        },
        {
          commitmentId: "demo-commitment-2",
          title: "Submit Apex recruitment candidate agreement & signed NDA",
          riskLevel: "MEDIUM",
          reason: "NDA signature has been outstanding for 12 days with no touchpoints.",
        },
      ],
      relationshipsAttention: [
        {
          contactId: CLIENT_ID,
          name: "David Vance",
          email: CLIENT_EMAIL,
          reason: "Enterprise client blocked on overdue API docs. Score down to 20.",
        },
        {
          contactId: RECRUITER_ID,
          name: "Sarah Jenkins",
          email: RECRUITER_EMAIL,
          reason: "NDA pending signature for 12 days with no communication.",
        },
      ],
      recommendedActions: [
        {
          id: "demo-action-1",
          action: "Email API integration documentation to David Vance (Acme Corp)",
          priority: "HIGH",
          refType: "commitment",
          refId: "demo-commitment-1",
        },
        {
          id: "demo-action-2",
          action: "Sign Apex recruitment NDA and send to Sarah Jenkins",
          priority: "HIGH",
          refType: "commitment",
          refId: "demo-commitment-2",
        },
        {
          id: "demo-action-3",
          action: "Draft email introducing Elena Rostova (FutureAI) to Sequoia Capital Partner",
          priority: "MEDIUM",
          refType: "commitment",
          refId: "demo-commitment-3",
        },
      ],
      generatedAt: now.toISOString(),
    };
  }

  // API ROUTE SIMULATORS

  public getBriefingData() {
    const pending = this.commitments.filter((c) => c.status === CommitmentStatus.PENDING);
    const completed = this.commitments.filter((c) => c.status === CommitmentStatus.COMPLETED);
    const snoozed = this.commitments.filter((c) => c.status === CommitmentStatus.SNOOZED);
    const now = new Date();
    const overdue = pending.filter((c) => c.dueDate && new Date(c.dueDate) < now);

    return {
      userName: "Alex Operator",
      userEmail: "alex@flux.ai",
      unreadEmailCount: this.threads.filter((t) => t.labels.includes("UNREAD")).length,
      stats: {
        pendingCount: pending.length,
        completedCount: completed.length,
        overdueCount: overdue.length,
        snoozedCount: snoozed.length,
        totalCount: this.commitments.length,
      },
      relationships: {
        totalContacts: this.contacts.length,
        strongCount: this.contacts.filter((c) => c.relationshipHealth === "Strong").length,
        neutralCount: this.contacts.filter((c) => c.relationshipHealth === "Neutral").length,
        atRiskCount: this.contacts.filter((c) => c.relationshipHealth === "At Risk").length,
        topContacts: [...this.contacts].sort((a, b) => b.relationshipScore - a.relationshipScore).slice(0, 5),
        atRiskContacts: this.contacts.filter((c) => c.relationshipHealth === "At Risk").slice(0, 5),
      },
      lists: {
        recentCommitments: this.commitments.slice(0, 5),
        highConfidenceCommitments: this.commitments.filter((c) => c.confidence >= 0.8).slice(0, 5),
        upcomingDeadlines: pending
          .filter((c) => c.dueDate && new Date(c.dueDate) >= now)
          .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
          .slice(0, 5),
      },
    };
  }

  public getExecutiveBriefingData() {
    return {
      briefing: this.executiveBriefing,
      cached: true,
    };
  }

  public getInboxThreads() {
    return {
      threads: this.threads.map((t) => {
        const threadMsgs = this.messages.filter((m) => m.threadId === t.id);
        const latestMsg = threadMsgs[0] || { sender: "Unknown", receivedAt: new Date().toISOString() };
        return {
          id: t.id,
          externalId: t.externalId,
          subject: t.subject,
          snippet: t.snippet,
          labels: t.labels,
          lastSyncedAt: new Date().toISOString(),
          messageCount: threadMsgs.length,
          latestMessageDate: latestMsg.receivedAt,
          latestSender: latestMsg.sender,
        };
      }),
      isConnected: true,
      email: "alex@flux.ai",
      userId: "demo-user-id",
    };
  }

  public getThreadDetails(threadId: string) {
    const thread = this.threads.find((t) => t.id === threadId);
    if (!thread) return null;

    const threadMsgs = this.messages.filter((m) => m.threadId === threadId);
    const contactEmails = Array.from(
      new Set(
        threadMsgs.flatMap((m) => [
          m.sender.includes("<") ? m.sender.split("<")[1].split(">")[0] : m.sender,
          ...(m.recipients || []),
        ])
      )
    ).filter((email) => email !== "alex@flux.ai" && email !== "user@flux.ai");

    const relatedContacts = this.contacts.filter((c) => contactEmails.includes(c.email));

    return {
      thread: {
        id: thread.id,
        subject: thread.subject,
        messages: threadMsgs,
      },
      contacts: relatedContacts,
    };
  }

  public getContactsList() {
    return this.contacts;
  }

  public getContactDetail(id: string) {
    const contact = this.contacts.find((c) => c.id === id);
    if (!contact) return null;

    const contactCommitments = this.commitments.filter((c) => c.contactId === id);
    const contactThreads = this.threads.filter((t) => {
      const msgs = this.messages.filter((m) => m.threadId === t.id);
      return msgs.some(
        (m) =>
          m.sender.toLowerCase().includes(contact.email.toLowerCase()) ||
          m.recipients.some((r: string) => r.toLowerCase() === contact.email.toLowerCase())
      );
    });

    // Map to detail DTO shape
    return {
      ...contact,
      commitments: contactCommitments.map((c) => {
        const msg = this.messages.find((m) => m.id === c.emailMessageId);
        return {
          id: c.id,
          title: c.title,
          dueDate: c.dueDate ? c.dueDate.toISOString() : null,
          status: c.status,
          confidence: c.confidence,
          direction: c.direction,
          sourceEmail: msg
            ? {
                id: msg.id,
                externalId: msg.externalId,
                sender: msg.sender,
                recipients: msg.recipients,
                subject: msg.subject,
                body: msg.body,
                receivedAt: msg.receivedAt.toISOString(),
              }
            : null,
          riskScore: c.riskScore,
          riskLevel: c.riskLevel,
          riskReason: c.riskReason,
        };
      }),
      recentThreads: contactThreads.map((t) => ({
        id: t.id,
        subject: t.subject,
        lastMessageAt: t.lastMessageAt ? t.lastMessageAt.toISOString() : null,
        followUpNeeded: t.followUpNeeded,
        followUpUrgency: t.followUpUrgency,
        followUpReason: t.followUpReason,
        snippet: t.snippet,
      })),
    };
  }

  public getContactInsight(id: string): ContactInsightDTO | null {
    const contact = this.contacts.find((c) => c.id === id);
    if (!contact) return null;

    if (id === CLIENT_ID) {
      return {
        insight: "David Vance's relationship is under strain due to the overdue API schema documentation blocker. Although exchanges are high (14 total), trust score has declined to 20. Delivering the API specs today is critical to unlock sandbox testing and secure next week's integration kickoff.",
        recommendedActions: [
          "Send the finalized API documentation PDF directly to David.",
          "Request a brief 5-minute alignment call to review blocked testing items.",
        ],
        relationshipRisk: "HIGH",
        generatedAt: new Date().toISOString(),
      };
    } else if (id === RECRUITER_ID) {
      return {
        insight: "Sarah Jenkins' communication has stalled. It has been 12 days since the last inbound email. The recruitment search for the CTO role is inactive until you return the signed NDA. Completing this back-office tasks will instantly restore relationship velocity.",
        recommendedActions: [
          "Locate and sign the candidate NDA agreement.",
          "Follow up with salary benchmark requirements.",
        ],
        relationshipRisk: "MEDIUM",
        generatedAt: new Date().toISOString(),
      };
    } else if (id === FOUNDER_ID) {
      return {
        insight: "Collaboration with Elena Rostova is strong. Following your review of the YC pitch deck, she is highly responsive. The key next step is delivering the promised introduction to Sequoia Capital. Making this connection today capitalizes on momentum.",
        recommendedActions: [
          "Draft double-opt-in intro email to Sequoia Venture Partner.",
          "Invite Elena to review the draft outline.",
        ],
        relationshipRisk: "LOW",
        generatedAt: new Date().toISOString(),
      };
    } else {
      return {
        insight: "A healthy, low-risk mentorship structure with Marcus Aurelius. Advisory agreement suggestions are approved on both sides. catching up for coffee tomorrow will lock in the signature and establish advisory schedules.",
        recommendedActions: [
          "Confirm 10 AM coffee meeting at the VC Partners offices.",
          "Print/prepare the final advisory agreement copy.",
        ],
        relationshipRisk: "LOW",
        generatedAt: new Date().toISOString(),
      };
    }
  }

  public updateCommitmentStatus(id: string, status: CommitmentStatus) {
    const commitment = this.commitments.find((c) => c.id === id);
    if (commitment) {
      commitment.status = status;
      if (status === CommitmentStatus.COMPLETED) {
        commitment.riskScore = 0;
        commitment.riskLevel = "LOW";
        commitment.riskReason = "No significant risk factors active.";
      }
    }

    // Sync counts on contacts
    this.contacts.forEach((contact) => {
      const contactCommitments = this.commitments.filter((c) => c.contactId === contact.id);
      contact.openCommitments = contactCommitments.filter((c) => c.status === CommitmentStatus.PENDING).length;
      contact.completedCommitments = contactCommitments.filter((c) => c.status === CommitmentStatus.COMPLETED).length;

      // Dynamically recalculate health/score in-memory to reflect demo actions
      if (contact.id === CLIENT_ID && contact.openCommitments === 0) {
        contact.relationshipScore = 80;
        contact.relationshipHealth = "Strong";
        contact.relationshipReason = "Strong because you resolved the critical API documentation blocker.";
      } else if (contact.id === RECRUITER_ID && contact.openCommitments === 0) {
        contact.relationshipScore = 75;
        contact.relationshipHealth = "Strong";
        contact.relationshipReason = "Strong because you completed the pending NDA contract signature.";
      }
    });

    // Recalculate executive briefing actions
    if (this.executiveBriefing) {
      this.executiveBriefing.recommendedActions = this.executiveBriefing.recommendedActions.filter(
        (a: any) => a.refId !== id
      );
      this.executiveBriefing.topRisks = this.executiveBriefing.topRisks.filter(
        (r: any) => r.commitmentId !== id
      );
    }
  }

  // SIMULATE DEMO EVENTS

  public simulateNewClientMail() {
    const now = new Date();
    
    // 1. Add new message
    const msgId = "demo-msg-client-new";
    this.messages.unshift({
      id: msgId,
      threadId: "demo-thread-client",
      externalId: "g-msg-client-new",
      sender: `David Vance <${CLIENT_EMAIL}>`,
      recipients: ["user@flux.ai"],
      subject: "RE: Acme Corp / Flux Integration specs missing - escalation",
      body: "Hi, following up on this. We have a board meeting on Thursday where I need to report on our integration progress. I need that API document now. If we can't sync today, I will have to schedule a call with our directors. Please update me ASAP.",
      direction: "INBOUND",
      receivedAt: now,
    });

    // 2. Update thread
    const thread = this.threads.find((t) => t.id === "demo-thread-client");
    if (thread) {
      thread.snippet = "Hi, following up on this. We have a board meeting on Thursday where I need...";
      thread.lastMessageAt = now;
      thread.labels.push("UNREAD");
      thread.followUpUrgency = "CRITICAL";
      thread.followUpReason = "Urgent client escalation. Board meeting dependency mentioned.";
    }

    // 3. Add a new high-risk commitment
    this.commitments.unshift({
      id: "demo-commitment-new",
      title: "Provide board-meeting ready integration outline to David Vance",
      dueDate: new Date(now.getTime() + 4 * 60 * 60 * 1000), // Due in 4 hours!
      status: CommitmentStatus.PENDING,
      confidence: 0.98,
      direction: "OUTBOUND",
      contactId: CLIENT_ID,
      emailMessageId: msgId,
      riskScore: 99,
      riskLevel: "HIGH",
      riskReason: "High risk escalation due to board meeting blocker deadline.",
      createdAt: now,
    });

    // 4. Update contacts stats
    const client = this.contacts.find((c) => c.id === CLIENT_ID);
    if (client) {
      client.totalExchanges += 1;
      client.inboundCount += 1;
      client.openCommitments += 1;
      client.relationshipScore = 10; // score falls even lower!
      client.relationshipReason = "At Risk due to critical Board meeting escalation.";
      client.lastInteractionAt = now;
    }

    // 5. Update briefing
    if (this.executiveBriefing) {
      this.executiveBriefing.executiveSummary = "URGENT ESCALATION: David Vance (Acme Corp) has escalated the missing API integration documentation for a Board meeting deadline. You must provide a board-meeting ready outline immediately. You also have pending introductions for Elena Rostova and the Apex NDA.";
      
      this.executiveBriefing.topRisks.unshift({
        commitmentId: "demo-commitment-new",
        title: "Provide board-meeting ready integration outline to David Vance",
        riskLevel: "HIGH",
        reason: "Critically urgent board meeting deadline, David Vance has escalated communication.",
      });

      this.executiveBriefing.recommendedActions.unshift({
        id: "demo-action-new",
        action: "Send board-meeting API summary to David Vance",
        priority: "HIGH",
        refType: "commitment",
        refId: "demo-commitment-new",
      });
    }
  }
}

export const demoStore = DemoStore.getInstance();
