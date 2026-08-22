import { describe, expect, it } from "vitest";
import { parseLedgerKind, parseWithdrawalStatus } from "./ledger-kind.js";

describe("parseLedgerKind", () => {
  it("accepte les kinds connus", () => {
    expect(parseLedgerKind("withdraw")).toBe("withdraw");
    expect(parseLedgerKind("deposit")).toBe("deposit");
    expect(parseLedgerKind("bet")).toBe("bet");
    expect(parseLedgerKind("win")).toBe("win");
    expect(parseLedgerKind("grant")).toBe("grant");
  });

  it("ignore les valeurs inconnues ou vides", () => {
    expect(parseLedgerKind(undefined)).toBeUndefined();
    expect(parseLedgerKind("")).toBeUndefined();
    expect(parseLedgerKind("debit")).toBeUndefined();
    expect(parseLedgerKind("refund")).toBeUndefined();
  });
});

describe("parseWithdrawalStatus", () => {
  it("accepte les statuts de demande de retrait", () => {
    expect(parseWithdrawalStatus("pending")).toBe("pending");
    expect(parseWithdrawalStatus("successful")).toBe("successful");
    expect(parseWithdrawalStatus("failed")).toBe("failed");
    expect(parseWithdrawalStatus("cancelled")).toBe("cancelled");
    expect(parseWithdrawalStatus("processing")).toBe("processing");
  });

  it("ignore completed (alias admin) et les vides", () => {
    expect(parseWithdrawalStatus("completed")).toBeUndefined();
    expect(parseWithdrawalStatus(undefined)).toBeUndefined();
    expect(parseWithdrawalStatus("")).toBeUndefined();
  });
});
