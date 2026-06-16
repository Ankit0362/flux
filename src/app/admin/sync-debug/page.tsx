"use client";

import { useEffect, useState } from "react";

interface MessageStat {
  id: string;
  sender: string;
  subject: string;
  receivedAt: string;
  direction: "INBOUND" | "OUTBOUND";
}

interface SyncState {
  isConnected: boolean;
  email: string | null;
  tenantId: string;
  threadCount: number;
  messageCount: number;
  contactCount: number;
  latestMessages: MessageStat[];
}

export default function SyncDebugPage() {
  const [state, setState] = useState<SyncState>({
    isConnected: false,
    email: null,
    tenantId: "default-user",
    threadCount: 0,
    messageCount: 0,
    contactCount: 0,
    latestMessages: [],
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev]);
  };

  const fetchState = async () => {
    try {
      const res = await fetch("/api/admin/sync-state");
      if (res.ok) {
        const data = await res.json();
        setState(data);
      } else {
        addLog("Failed to fetch current synchronization state.");
      }
    } catch (err: unknown) {
      addLog(`Error fetching state: ${(err instanceof Error ? err.message : String(err))}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    addLog("Dashboard initialized. Scoping to default tenant.");
    
    // Polling sync state every 5 seconds to show active imports
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: "bootstrap" | "incremental" | "reset") => {
    setActionLoading(action);
    addLog(`Initiating action: ${action.toUpperCase()}...`);
    try {
      const res = await fetch("/api/admin/sync-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tenantId: state.tenantId,
          email: state.email,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        addLog(`Success: ${data.message}`);
        await fetchState();
      } else {
        addLog(`Error: ${data.error}`);
      }
    } catch (err: unknown) {
      addLog(`Action failed: ${(err instanceof Error ? err.message : String(err))}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnect = () => {
    addLog("Redirecting to Google OAuth flow...");
    window.location.href = `/api/auth/google?tenantId=${state.tenantId}`;
  };

  return (
    <div className="container">
      <header className="header">
        <div className="title-group">
          <h1>ChiefOS</h1>
          <span className="subtitle">Gmail Integration Control</span>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${state.isConnected ? "active" : "inactive"}`}></span>
          <span className="status-text">
            {state.isConnected ? `Connected: ${state.email}` : "Disconnected"}
          </span>
        </div>
      </header>

      <div className="grid">
        {/* Left Side: Controller Panels */}
        <div className="column">
          {/* Panel 1: Credentials */}
          <div className="card">
            <h2>OAuth Connection</h2>
            <p className="description">
              Securely authenticate your Google Developer Account to obtain offline Gmail access.
            </p>
            <div className="button-group">
              <button
                className={`btn btn-primary ${state.isConnected ? "btn-connected" : ""}`}
                onClick={handleConnect}
              >
                {state.isConnected ? "Reconnect Account" : "Connect Gmail"}
              </button>
            </div>
          </div>

          {/* Panel 2: Manual Operations */}
          <div className="card">
            <h2>Manual Synchronization</h2>
            <p className="description">
              Manually trigger background sync sequences. Ideal for testing OAuth token persistence and database hooks.
            </p>
            <div className="button-group-vertical">
              <button
                className="btn btn-secondary"
                disabled={!state.isConnected || actionLoading !== null}
                onClick={() => handleAction("bootstrap")}
              >
                {actionLoading === "bootstrap" ? "Syncing..." : "Run Bootstrap Sync (Latest 50)"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={!state.isConnected || actionLoading !== null}
                onClick={() => handleAction("incremental")}
              >
                {actionLoading === "incremental" ? "Syncing..." : "Run Incremental Sync (New Events)"}
              </button>
              <button
                className="btn btn-danger"
                disabled={actionLoading !== null}
                onClick={() => handleAction("reset")}
              >
                {actionLoading === "reset" ? "Wiping..." : "Wipe Local PostgreSQL Tables"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Database Stats & Feeds */}
        <div className="column">
          {/* Panel 3: Stats Summary */}
          <div className="card">
            <h2>PostgreSQL Stats</h2>
            <div className="stats-row">
              <div className="stat-box">
                <span className="stat-value">{state.threadCount}</span>
                <span className="stat-label">Threads</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{state.messageCount}</span>
                <span className="stat-label">Messages</span>
              </div>
              <div className="stat-box">
                <span className="stat-value">{state.contactCount}</span>
                <span className="stat-label">Contacts</span>
              </div>
            </div>
          </div>

          {/* Panel 4: Sync Log Feed */}
          <div className="card">
            <h2>Latest Imported Emails</h2>
            <div className="messages-list">
              {state.latestMessages.length === 0 ? (
                <div className="empty-state">No emails imported yet. Connect and sync to see records.</div>
              ) : (
                state.latestMessages.map((msg) => (
                  <div key={msg.id} className="message-item">
                    <div className="msg-header">
                      <span className="msg-sender" title={msg.sender}>
                        {msg.sender.split("<")[0] || msg.sender}
                      </span>
                      <span className="msg-date">
                        {new Date(msg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="msg-body">
                      <span className="msg-subject">{msg.subject}</span>
                      <span className={`msg-tag ${msg.direction.toLowerCase()}`}>
                        {msg.direction}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer: Live Logs */}
      <footer className="card console-card">
        <h2>Live Integration Console Log</h2>
        <div className="console">
          {logs.map((log, index) => (
            <div key={index} className="console-line">
              {log}
            </div>
          ))}
        </div>
      </footer>

      {/* Global CSS Inject to WOW the user */}
      <style jsx global>{`
        :root {
          --bg: #0b0f19;
          --card-bg: rgba(22, 28, 45, 0.45);
          --border: rgba(255, 255, 255, 0.08);
          --text: #e2e8f0;
          --text-muted: #94a3b8;
          --primary: #7c3aed;
          --primary-hover: #6d28d9;
          --secondary: #1e293b;
          --secondary-hover: #334155;
          --danger: #ef4444;
          --danger-hover: #dc2626;
          --green: #10b981;
          --blue: #3b82f6;
        }

        body {
          background-color: var(--bg);
          color: var(--text);
          font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
          margin: 0;
          padding: 0;
          min-height: 100vh;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2.5rem 1.5rem;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2.5rem;
          border-bottom: 1px solid var(--border);
          padding-bottom: 1.5rem;
        }

        .title-group h1 {
          margin: 0;
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -0.05em;
          background: linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subtitle {
          color: var(--text-muted);
          font-size: 0.95rem;
          font-weight: 500;
        }

        .status-badge {
          display: flex;
          align-items: center;
          background-color: rgba(30, 41, 59, 0.5);
          border: 1px solid var(--border);
          padding: 0.6rem 1.2rem;
          border-radius: 9999px;
          backdrop-filter: blur(8px);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 0.75rem;
          display: inline-block;
        }

        .status-dot.active {
          background-color: var(--green);
          box-shadow: 0 0 12px var(--green);
          animation: pulse 2s infinite;
        }

        .status-dot.inactive {
          background-color: var(--danger);
          box-shadow: 0 0 12px var(--danger);
        }

        .status-text {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text);
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }

        .column {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .card {
          background-color: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 2rem;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
          border-color: rgba(124, 58, 237, 0.3);
          box-shadow: 0 4px 30px rgba(124, 58, 237, 0.05);
        }

        .card h2 {
          margin-top: 0;
          margin-bottom: 0.75rem;
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .description {
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .button-group {
          display: flex;
          gap: 1rem;
        }

        .button-group-vertical {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .btn {
          font-family: inherit;
          padding: 0.8rem 1.5rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: var(--primary);
          color: white;
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--primary-hover);
          transform: translateY(-1px);
        }

        .btn-connected {
          background-color: var(--green);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-secondary {
          background-color: var(--secondary);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .btn-secondary:hover:not(:disabled) {
          background-color: var(--secondary-hover);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .btn-danger {
          background-color: rgba(239, 68, 68, 0.1);
          color: var(--danger);
          border: 1px solid rgba(239, 68, 68, 0.2);
          margin-top: 0.5rem;
        }

        .btn-danger:hover:not(:disabled) {
          background-color: var(--danger);
          color: white;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        .stats-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
        }

        .stat-box {
          flex: 1;
          background-color: rgba(30, 41, 59, 0.3);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 1.25rem 1rem;
          text-align: center;
          transition: transform 0.2s ease;
        }

        .stat-box:hover {
          transform: scale(1.03);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .stat-value {
          display: block;
          font-size: 2rem;
          font-weight: 800;
          color: white;
          line-height: 1.2;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 275px;
          overflow-y: auto;
          padding-right: 0.25rem;
        }

        .empty-state {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.9rem;
          padding: 2.5rem 1rem;
          background-color: rgba(30, 41, 59, 0.15);
          border-radius: 12px;
          border: 1px dashed var(--border);
        }

        .message-item {
          background-color: rgba(30, 41, 59, 0.25);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0.85rem 1.1rem;
        }

        .msg-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.35rem;
        }

        .msg-sender {
          font-weight: 700;
          font-size: 0.85rem;
          color: white;
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .msg-date {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .msg-body {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .msg-subject {
          font-size: 0.85rem;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .msg-tag {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .msg-tag.inbound {
          background-color: rgba(59, 130, 246, 0.15);
          color: var(--blue);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .msg-tag.outbound {
          background-color: rgba(16, 185, 129, 0.15);
          color: var(--green);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .console-card {
          margin-top: 2.5rem;
        }

        .console {
          background-color: #05070c;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1.25rem;
          height: 180px;
          overflow-y: auto;
          font-family: 'Fira Code', 'Courier New', monospace;
          font-size: 0.8rem;
          color: #a7f3d0;
          display: flex;
          flex-direction: column-reverse;
          gap: 0.35rem;
        }

        .console-line {
          line-height: 1.4;
          word-break: break-all;
        }

        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
      `}</style>
    </div>
  );
}
