import * as React from "react";
import { Html, Head, Body, Container, Section, Text } from "@react-email/components";

// design-style-guide.md §13 — shared shell every notification email uses.
export function EmailShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={wordmark}>Nexcgen</Text>
          </Section>
          <Section style={body}>{children}</Section>
          <Section style={footerSection}>
            {footer ?? <Text style={footerText}>Nexcgen — {title}</Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={button}>
      {children}
    </a>
  );
}

export function StatusChip({ tone, children }: { tone: "success" | "warning" | "error"; children: React.ReactNode }) {
  const colors = {
    success: { bg: "#EAF7EE", text: "#1A8A3D" },
    warning: { bg: "#FDF6E3", text: "#B8860B" },
    error: { bg: "#FDECEC", text: "#D32F2F" },
  }[tone];
  return (
    <span style={{ ...chip, backgroundColor: colors.bg, color: colors.text }}>{children}</span>
  );
}

const main = {
  backgroundColor: "#F4F4F3",
  fontFamily: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
};

const container = {
  margin: "0 auto",
  maxWidth: "600px",
  width: "100%",
  backgroundColor: "#FFFFFF",
  border: "1px solid #DCE3F2",
  borderRadius: "14px",
  overflow: "hidden" as const,
};

const header = {
  backgroundColor: "#2F6FE4",
  padding: "20px 24px",
};

const wordmark = {
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: 600,
  margin: 0,
};

const body = {
  padding: "24px",
};

const footerSection = {
  padding: "16px 24px",
  borderTop: "1px solid #DCE3F2",
};

const footerText = {
  fontSize: "12px",
  color: "#5C5C5C",
  textAlign: "center" as const,
  margin: 0,
};

const button = {
  display: "inline-block",
  backgroundColor: "#2F6FE4",
  color: "#FFFFFF",
  padding: "12px 24px",
  borderRadius: "999px",
  fontSize: "14px",
  fontWeight: 500,
  textDecoration: "none",
  marginTop: "16px",
};

const chip = {
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 500,
};

export const emailTextStyles = {
  h1: { fontSize: "20px", fontWeight: 600, color: "#141414", marginTop: 0, marginBottom: "8px" },
  text: { fontSize: "14px", lineHeight: "22px", color: "#5C5C5C" },
  amount: { fontSize: "28px", fontWeight: 700, color: "#141414", margin: "8px 0" },
};
