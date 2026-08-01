import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Heading,
  Text,
} from "@react-email/components";

interface OTPTemplateProps {
  otp: string;
}

export const OTPTemplate: React.FC<OTPTemplateProps> = ({ otp }) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={wordmark}>Nexcgen</Text>
        </Section>
        <Section style={body}>
          <Heading style={h1}>Verification code</Heading>
          <Text style={text}>Your verification code is:</Text>
          <Section style={codeBox}>
            <Text style={code}>{otp}</Text>
          </Section>
          <Text style={text}>This code expires in 10 minutes.</Text>
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

const codeBox = {
  background: "#F4F4F3",
  border: "1px solid #E7E5E1",
  borderRadius: "10px",
  margin: "16px 0",
  padding: "16px",
  textAlign: "center" as const,
};

const code = {
  fontSize: "28px",
  fontWeight: 700,
  letterSpacing: "6px",
  color: "#141414",
  margin: 0,
  fontVariantNumeric: "tabular-nums",
};
