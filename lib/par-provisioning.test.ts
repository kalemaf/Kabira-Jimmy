import { describe, it, expect } from "vitest";
import { bucketForDaysPastDue, PAR_BUCKETS } from "./par-provisioning";

describe("bucketForDaysPastDue", () => {
  it("buckets exactly on the documented boundaries", () => {
    expect(bucketForDaysPastDue(0).key).toBe("current");
    expect(bucketForDaysPastDue(1).key).toBe("par1_30");
    expect(bucketForDaysPastDue(30).key).toBe("par1_30");
    expect(bucketForDaysPastDue(31).key).toBe("par31_60");
    expect(bucketForDaysPastDue(60).key).toBe("par31_60");
    expect(bucketForDaysPastDue(61).key).toBe("par61_90");
    expect(bucketForDaysPastDue(90).key).toBe("par61_90");
    expect(bucketForDaysPastDue(91).key).toBe("par90_plus");
    expect(bucketForDaysPastDue(9999).key).toBe("par90_plus");
  });

  it("covers every non-negative integer with no gaps", () => {
    for (let days = 0; days <= 500; days++) {
      const bucket = bucketForDaysPastDue(days);
      expect(PAR_BUCKETS.map((b) => b.key)).toContain(bucket.key);
    }
  });
});
