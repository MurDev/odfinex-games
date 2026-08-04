"use client";

import { useEffect, useRef } from "react";

type Props = {
  returnTo: string;
  action: (formData: FormData) => Promise<void>;
};

export function AutoGoogleSignIn({ returnTo, action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.requestSubmit();
  }, []);

  return (
    <main style={{ maxWidth: 400, margin: "0 auto", padding: "6rem 1.5rem" }}>
      <p
        style={{
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.6,
          fontSize: "0.8rem",
        }}
      >
        Odfinex Games
      </p>
      <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0 0.5rem" }}>Connexion</h1>
      <p style={{ opacity: 0.7, marginBottom: "2rem", fontSize: "0.95rem" }}>
        Redirection vers Google…
      </p>
      <form ref={formRef} action={action}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <noscript>
          <button type="submit" style={buttonStyle}>
            Continuer avec Google
          </button>
        </noscript>
      </form>
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "#fff",
  color: "#1f2937",
  border: "none",
  borderRadius: 8,
  padding: "0.85rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
  width: "100%",
};
