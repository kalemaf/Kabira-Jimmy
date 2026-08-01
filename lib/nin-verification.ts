import "server-only";

/**
 * National ID (NIN) verification via Youverify's Entity Management API.
 *
 * There's no public NIRA (Uganda's National Identification and Registration
 * Authority) API — Youverify is the licensed third-party KYC vendor this
 * project is wired to. Confirmed against Youverify's live docs
 * (doc.youverify.co): base URL, `token` auth header, and the two-step
 * entity flow — POST /v2/api/entities (create, from PII) then POST
 * /v2/api/entities/:entityId/identity (attach a government-ID check,
 * cross-validated against the supplied name/DOB). Creating the entity also
 * auto-triggers Youverify's AML/Sanctions/PEP/Watchlist screening as a
 * side effect, which this returns alongside the identity match result.
 *
 * IMPORTANT — Uganda is not in Youverify's published idType list (they
 * document Nigeria, Kenya, Ghana, South Africa only). `idType: "ugNin"`
 * below is an informed guess following the country-prefixed pattern used
 * by 3 of those 4 (keNationalId, zaSAID, ghVoter — only Nigeria uses bare
 * names). This has NOT been confirmed against a real Uganda NIN. If
 * Youverify rejects it, their error response is specific enough to reveal
 * whether the idType or something else is wrong — check their support/docs
 * before trusting this in production either way.
 */

export type NinVerificationStatus = "Matched" | "Mismatch" | "Unavailable";

export type NinVerificationResult = {
  status: NinVerificationStatus;
  detail: string;
};

type YouverifyErrorResponse = { success: false; statusCode: number; message?: string; name?: string };

type CreateEntityResponse =
  | { success: true; data: { entity?: { entityId: string } } }
  | YouverifyErrorResponse;

type VerifyIdentityResponse =
  | {
      success: true;
      data?: {
        status?: string; // "found" | other
        validationDetails?: Record<string, { status: "full_matched" | "partial_matched" | "not_matched" }>;
      };
    }
  | YouverifyErrorResponse;

function getConfig() {
  const apiKey = process.env.YOUVERIFY_API_KEY;
  if (!apiKey) return null;
  // Defaults to Youverify's production base URL; override with
  // YOUVERIFY_API_URL (e.g. their sandbox) to test without live charges.
  const baseUrl = (process.env.YOUVERIFY_API_URL || "https://api.youverify.co").replace(/\/$/, "");
  return { baseUrl, apiKey };
}

export function isNinVerificationConfigured(): boolean {
  return getConfig() !== null;
}

async function youverifyPost<T>(baseUrl: string, apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiKey },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ...json, __httpStatus: res.status } as T;
}

/**
 * Verifies a claimed identity against the NIN register. Returns
 * "Unavailable" (never throws) when no provider is configured, or if the
 * provider call itself fails — a verification outage should block on a
 * human decision, not crash the loan application flow.
 */
export async function verifyNin(params: {
  nin: string;
  firstName: string;
  lastName: string;
  dob?: Date | null;
  phone: string;
}): Promise<NinVerificationResult> {
  const config = getConfig();
  if (!config) {
    return {
      status: "Unavailable",
      detail: "NIN verification is not configured (set YOUVERIFY_API_KEY)",
    };
  }

  try {
    // Step 1 — create (or reuse) an entity from basic PII. This alone
    // triggers Youverify's background AML/Sanctions/PEP screen.
    const entityRes = await youverifyPost<CreateEntityResponse & { __httpStatus: number }>(
      config.baseUrl,
      config.apiKey,
      "/v2/api/entities",
      {
        entityType: "individual",
        firstName: params.firstName,
        lastName: params.lastName,
        nationality: "UG",
        phone: params.phone,
        isSubjectConsent: true,
      }
    );

    if (!entityRes.success) {
      return { status: "Unavailable", detail: entityRes.message ?? `Could not create entity (${entityRes.__httpStatus})` };
    }
    const entityId = entityRes.data?.entity?.entityId;
    if (!entityId) {
      return { status: "Unavailable", detail: "Youverify did not return an entity ID" };
    }

    // Step 2 — attach the government-ID check to that entity, cross
    // validating the supplied name/DOB against the ID record.
    const identityRes = await youverifyPost<VerifyIdentityResponse & { __httpStatus: number }>(
      config.baseUrl,
      config.apiKey,
      `/v2/api/entities/${entityId}/identity`,
      {
        entityType: "individual",
        isSubjectConsent: true,
        identity: { countryCode: "UG", idType: "ugNin", id: params.nin },
        validations: {
          data: {
            firstName: params.firstName,
            lastName: params.lastName,
            dateOfBirth: params.dob ? params.dob.toISOString().slice(0, 10) : undefined,
          },
        },
      }
    );

    if (!identityRes.success) {
      return { status: "Unavailable", detail: identityRes.message ?? `Identity check failed (${identityRes.__httpStatus})` };
    }

    if (identityRes.data?.status !== "found") {
      return { status: "Mismatch", detail: "No matching record found on the national register for this NIN" };
    }

    const fields = identityRes.data.validationDetails ?? {};
    const nameFields = ["firstName", "lastName", "fullName"].filter((key) => key in fields);
    const anyNotMatched = nameFields.some((key) => fields[key]?.status === "not_matched");
    const allFullyMatched = nameFields.length > 0 && nameFields.every((key) => fields[key]?.status === "full_matched");

    if (anyNotMatched || !allFullyMatched) {
      return {
        status: "Mismatch",
        detail: "The name on record does not fully match the national register for this NIN — review manually before proceeding",
      };
    }

    return { status: "Matched", detail: "Name matches the national register for this NIN" };
  } catch (e) {
    return { status: "Unavailable", detail: e instanceof Error ? e.message : "NIN verification request failed" };
  }
}
