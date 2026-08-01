import "server-only";

/**
 * Pluggable SMS/WhatsApp provider adapter. No specific provider is wired up
 * (SMS_PROVIDER_API_KEY is empty by default) — this targets Africa's
 * Talking's REST shape as the most common choice for Ugandan SACCOs, but
 * every call is isolated behind the two functions below, so swapping
 * providers means changing only this file, never a caller.
 */

export type NotificationResult = { success: boolean; error?: string };

function getConfig() {
  const apiKey = process.env.SMS_PROVIDER_API_KEY;
  const senderId = process.env.SMS_PROVIDER_SENDER_ID;
  if (!apiKey) return null;
  return { apiKey, senderId: senderId || "NGSACCO" };
}

export function isSmsConfigured(): boolean {
  return getConfig() !== null;
}

export async function sendSms(to: string, message: string): Promise<NotificationResult> {
  const config = getConfig();
  if (!config) {
    console.warn(`[notifications] SMS not configured — would have sent to ${to}: ${message}`);
    return { success: false, error: "SMS_PROVIDER_API_KEY not set" };
  }

  try {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ to, message, from: config.senderId }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `SMS provider returned ${res.status}: ${body}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown SMS error" };
  }
}

export async function sendWhatsApp(to: string, message: string): Promise<NotificationResult> {
  const config = getConfig();
  if (!config) {
    console.warn(`[notifications] WhatsApp not configured — would have sent to ${to}: ${message}`);
    return { success: false, error: "SMS_PROVIDER_API_KEY not set" };
  }

  try {
    const res = await fetch("https://api.africastalking.com/whatsapp/message/send", {
      method: "POST",
      headers: {
        apiKey: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ to, message: { text: { body: message } } }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `WhatsApp provider returned ${res.status}: ${body}` };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown WhatsApp error" };
  }
}
