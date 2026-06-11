import Link from "next/link";

const signals = [
  "Gmail",
  "Calendar",
  "Commitments",
  "Relationships",
];

const outcomes = [
  {
    label: "Commitments",
    value: "Every promise has an owner",
    copy: "ChiefOS extracts asks, promises, names, and dates from email so follow-through is tracked without manual upkeep.",
  },
  {
    label: "Follow-ups",
    value: "Stalled conversations surface early",
    copy: "Unanswered requests and aging threads rise into view before they become relationship debt.",
  },
  {
    label: "Briefings",
    value: "Meetings arrive with context",
    copy: "Calendar events are paired with recent messages, open decisions, and the preparation that matters.",
  },
  {
    label: "Relationships",
    value: "The people system stays current",
    copy: "Relationship health, last touch, and open obligations stay visible for the people who move your work forward.",
  },
];

export default function Home() {
  return (
    <main className="landing-shell">
      <div className="landing-ambient" aria-hidden="true" />
      <nav className="landing-nav">
        <Link href="/" className="brand-lockup" aria-label="ChiefOS home">
          <span className="brand-mark">C</span>
          <span>ChiefOS</span>
        </Link>
        <div className="nav-links">
          <a href="#brief">Daily brief</a>
          <a href="#system">System</a>
          <a href="#trust">Trust</a>
        </div>
        <Link href="/api/auth/signin" className="nav-cta">
          Enter workspace <span>-&gt;</span>
        </Link>
      </nav>

      <section className="hero-stage">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            Private executive intelligence
          </div>
          <h1>
            Your inbox becomes an operating system.
          </h1>
          <p>
            ChiefOS turns email, calendar, commitments, and relationships into
            one prioritized daily brief, so the important work is visible before
            it is urgent.
          </p>
          <div className="hero-actions">
            <Link href="/api/auth/signin" className="primary-action">
              Connect your workspace <span>-&gt;</span>
            </Link>
            <Link href="/demo" className="secondary-action">
              Watch the brief
            </Link>
          </div>
          <div className="trust-row" id="trust">
            <span>Private by design</span>
            <span>Human-approved actions</span>
            <span>Built around Gmail and calendar</span>
          </div>
        </div>

        <div className="command-table" aria-label="3D command table turning work signals into a daily brief">
          <div className="table-glow" />
          <div className="signal-ring ring-one" />
          <div className="signal-ring ring-two" />
          <div className="signal-ring ring-three" />

          {signals.map((signal, index) => (
            <div key={signal} className={`signal-chip signal-chip-${index + 1}`}>
              <span>Signal</span>
              <strong>{signal}</strong>
            </div>
          ))}

          <div className="brief-core">
            <div className="core-topline">
              <span>ChiefOS</span>
              <span>11 Jun</span>
            </div>
            <div className="core-title">Daily command brief</div>
            <div className="brief-priority urgent">
              <span>01</span>
              <div>
                <strong>Return the revised proposal</strong>
                <small>Due today - Sarah Chen</small>
              </div>
            </div>
            <div className="brief-priority">
              <span>02</span>
              <div>
                <strong>Prepare board operating review</strong>
                <small>4 open decisions</small>
              </div>
            </div>
            <div className="brief-priority">
              <span>03</span>
              <div>
                <strong>Follow up with Maya</strong>
                <small>Waiting 6 days</small>
              </div>
            </div>
          </div>

          <div className="risk-panel">
            <span>Risk</span>
            <strong>2 commitments need attention</strong>
          </div>
          <div className="context-panel">
            <span>Context</span>
            <strong>Meeting prep ready</strong>
          </div>
          <div className="table-base" />
        </div>
      </section>

      <section className="brief-proof" id="brief">
        <div className="proof-kicker">The daily brief</div>
        <div className="proof-copy">
          <h2>Calm, ranked, and ready before your day starts.</h2>
          <p>
            Instead of another inbox to manage, ChiefOS creates a small daily
            operating picture: what you promised, who is waiting, what meetings
            need preparation, and what can safely wait.
          </p>
        </div>
        <div className="proof-metrics">
          <div><strong>01</strong><span>Prioritized view</span></div>
          <div><strong>04</strong><span>Connected work signals</span></div>
          <div><strong>00</strong><span>Important promises buried</span></div>
        </div>
      </section>

      <section className="principles" id="system">
        <div className="section-heading">
          <span>One dependable system</span>
          <h2>The context behind every decision, kept in order.</h2>
        </div>
        <div className="feature-grid">
          {outcomes.map((outcome, index) => (
            <article key={outcome.label} className="feature-card">
              <span>0{index + 1} / {outcome.label}</span>
              <h3>{outcome.value}</h3>
              <p>{outcome.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="closing-statement">
        <span>ChiefOS</span>
        <h2>Keep your word. Keep your relationships. Keep your focus.</h2>
        <Link href="/api/auth/signin">Connect your workspace <span>-&gt;</span></Link>
      </section>

      <footer className="landing-footer">
        <span>ChiefOS 2026</span>
        <span>For operators whose work runs through relationships.</span>
      </footer>
    </main>
  );
}
