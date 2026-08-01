import * as React from "react";
import { Html, Head, Body, Container, Text, Heading, Section, Link } from "@react-email/components";

interface ResetPasswordTemplateProps {
  url: string;
}

export const ResetPasswordTemplate: React.FC<ResetPasswordTemplateProps> = ({ url }) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={wordmark}>Nexcgen</Text>
        </Section>
        <Section style={body}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            Click the button below to reset your password. If you didn&apos;t request this,
            you can safely ignore this email.
          </Text>
          <Section style={btnContainer}>
            <Link href={url} style={button}>
              Reset password
            </Link>
          </Section>
          <Text style={text}>
            Or copy and paste this URL into your browser:
            <br />
            <Link href={url} style={link}>{url}</Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#F4F4F3",
  fontFamily: "'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif",
};

const container = {
  margin: "0 auto",
  maxWidth: "600px",
  width: "100%",
  backgroundColor: "#FFFFFF",
  border: "1px solid #E7E5E1",
  borderRadius: "14px",
  overflow: "hidden" as const,
};

const header = {
  backgroundColor: "#141414",
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

const h1 = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#141414",
  marginTop: 0,
  marginBottom: "8px",
};

const text = {
  fontSize: "14px",
  lineHeight: "22px",
  color: "#5C5C5C",
};

const btnContainer = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const button = {
  backgroundColor: "#141414",
  borderRadius: "999px",
  color: "#FFFFFF",
  fontSize: "14px",
  fontWeight: 500,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};

const link = {
  color: "#1D4FB8",
  textDecoration: "underline",
};
