import { describe, it, expect, beforeEach, afterEach } from "vitest";

// DGATEWAY_MODE is read at call-time (not module-load-time) by every
// function in lib/dgateway.ts, so it's safe to flip per-test rather than
// needing vi.resetModules() between them.
describe("dgateway mock mode", () => {
  const originalMode = process.env.DGATEWAY_MODE;
  const originalUrl = process.env.ROHO_API_URL;
  const originalKey = process.env.ROHO_API_KEY;

  beforeEach(() => {
    process.env.DGATEWAY_MODE = "mock";
    delete process.env.ROHO_API_URL;
    delete process.env.ROHO_API_KEY;
  });

  afterEach(() => {
    if (originalMode === undefined) delete process.env.DGATEWAY_MODE;
    else process.env.DGATEWAY_MODE = originalMode;
    if (originalUrl === undefined) delete process.env.ROHO_API_URL;
    else process.env.ROHO_API_URL = originalUrl;
    if (originalKey === undefined) delete process.env.ROHO_API_KEY;
    else process.env.ROHO_API_KEY = originalKey;
  });

  it("reports configured even with no real RohoPay credentials set", async () => {
    const { isDGatewayConfigured } = await import("./dgateway");
    expect(isDGatewayConfigured()).toBe(true);
  });

  it("disburse() returns a fake pending result without making a real HTTP call", async () => {
    const { disburse } = await import("./dgateway");
    const result = await disburse({ phone: "+256754974499", amountUgx: 20_000, reference: "TEST-REF" });
    expect(result.status).toBe("pending");
    expect(result.transactionRef).toMatch(/^MOCK-/);
  });

  it("collectPayment() returns a fake pending result without making a real HTTP call", async () => {
    const { collectPayment } = await import("./dgateway");
    const result = await collectPayment({ phone: "+256754974499", amountUgx: 10_000, reference: "TEST-REF-2" });
    expect(result.status).toBe("pending");
    expect(result.transactionRef).toMatch(/^MOCK-/);
  });

  it("getWalletBalance() returns a fake balance instead of null", async () => {
    const { getWalletBalance } = await import("./dgateway");
    const balance = await getWalletBalance();
    expect(balance).toEqual({ balance: 5_000_000, currency: "UGX" });
  });

  it("is off by default (no DGATEWAY_MODE set, no real credentials)", async () => {
    delete process.env.DGATEWAY_MODE;
    const { isDGatewayConfigured } = await import("./dgateway");
    expect(isDGatewayConfigured()).toBe(false);
  });
});
