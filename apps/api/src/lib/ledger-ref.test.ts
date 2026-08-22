import { describe, expect, it } from "vitest";
import { withdrawalLookupRef } from "./ledger-ref.js";

describe("withdrawalLookupRef", () => {
  it("laisse un hold wd_ intact", () => {
    expect(withdrawalLookupRef("wd_abc_123")).toBe("wd_abc_123");
  });

  it("aligne refund/reject/cancel sur la meme demande", () => {
    expect(withdrawalLookupRef("refund_wd_abc")).toBe("wd_abc");
    expect(withdrawalLookupRef("reject_wd_abc")).toBe("wd_abc");
    expect(withdrawalLookupRef("cancel_wd_abc")).toBe("wd_abc");
  });
});
