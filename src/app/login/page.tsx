"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/inbox" });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 0%, #1a1230 0%, #05070f 60%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        padding: "2rem",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(180,120,40,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          position: "relative",
        }}
      >
        {/* Card */}
        <div
          style={{
            background: "rgba(10, 13, 25, 0.85)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px",
            padding: "2.5rem",
            backdropFilter: "blur(20px)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "2rem" }}>
            <img 
              src="/shortlogo.png" 
              alt="Flux Icon" 
              style={{ height: "40px", width: "40px", objectFit: "contain" }} 
            />
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "20px",
                  color: "#f1f5f9",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                FLUX
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#C5A06D",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                AI CHIEF OF STAFF
              </div>
            </div>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "#f1f5f9",
              marginBottom: "8px",
              letterSpacing: "-0.02em",
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "#64748b",
              marginBottom: "2rem",
              lineHeight: 1.6,
            }}
          >
            Sign in with Google to access your inbox, commitments, and daily brief.
          </p>

          {/* Google Sign-In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "14px 20px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: loading
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.07)",
              color: "#f1f5f9",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              outline: "none",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading)
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.11)";
            }}
            onMouseLeave={(e) => {
              if (!loading)
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.07)";
            }}
          >
            {loading ? (
              <svg
                style={{
                  width: "18px",
                  height: "18px",
                  animation: "spin 1s linear infinite",
                }}
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  style={{ opacity: 0.25 }}
                />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  style={{ opacity: 0.75 }}
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                <path
                  d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
                  fill="#FFC107"
                />
                <path
                  d="M6.3 14.7l7 5.1C15.1 17 19.2 14 24 14c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 7.4 6.3 14.7z"
                  fill="#FF3D00"
                />
                <path
                  d="M24 46c5.5 0 10.5-1.9 14.4-5l-6.7-5.5C29.6 37 26.9 38 24 38c-6.1 0-10.7-3.8-11.9-8.7l-7 5.4C8.2 42.4 15.6 46 24 46z"
                  fill="#4CAF50"
                />
                <path
                  d="M44.5 20H24v8.5h11.8c-0.5 2-1.8 3.7-3.5 4.9l6.7 5.5C42.7 36 46 31 46 24c0-1.3-.2-2.7-.5-4z"
                  fill="#1976D2"
                />
              </svg>
            )}
            {loading ? "Signing in..." : "Continue with Google"}
          </button>

          {/* Trust badge */}
          <div
            style={{
              marginTop: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            {["Private by design", "Gmail & Calendar", "Human-approved actions"].map((label) => (
              <span
                key={label}
                style={{
                  fontSize: "10px",
                  color: "#475569",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span style={{ color: "#78716c" }}>✓</span> {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
