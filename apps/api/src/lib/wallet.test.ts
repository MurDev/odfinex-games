import { describe, expect, it } from "vitest";
import { computeDebitOutcome } from "./wallet.js";

describe("computeDebitOutcome", () => {
  it("diminue le solde total du montant entier meme quand le bonus absorbe le debit", () => {
    // Cas du bug : joueur tout en bonus (credit admin) qui perd une mise.
    const outcome = computeDebitOutcome({
      currentBalance: 25000,
      currentBonus: 25000,
      amountCents: 5000,
    });
    expect(outcome).toEqual({
      ok: true,
      nextBalance: 20000,
      nextBonus: 20000,
      entryBonusCents: -5000,
    });
  });

  it("consomme le solde reel d'abord, le bonus seulement s'il est epuise", () => {
    const outcome = computeDebitOutcome({
      currentBalance: 10000,
      currentBonus: 4000,
      amountCents: 5000,
    });
    expect(outcome).toEqual({
      ok: true,
      nextBalance: 5000,
      nextBonus: 4000,
      entryBonusCents: 0,
    });
  });

  it("sans bonus, le solde diminue de la mise", () => {
    const outcome = computeDebitOutcome({
      currentBalance: 10000,
      currentBonus: 0,
      amountCents: 5000,
    });
    expect(outcome).toEqual({
      ok: true,
      nextBalance: 5000,
      nextBonus: 0,
      entryBonusCents: 0,
    });
  });

  it("consomme le bonus quand la mise depasse le solde reel", () => {
    // balance=10000, bonus=4000 -> retirable 6000. Une mise de 8000 epuise le
    // reel (6000) puis consomme 2000 de bonus.
    const outcome = computeDebitOutcome({
      currentBalance: 10000,
      currentBonus: 4000,
      amountCents: 8000,
    });
    expect(outcome).toEqual({
      ok: true,
      nextBalance: 2000,
      nextBonus: 2000,
      entryBonusCents: -2000,
    });
  });

  it("preserve le bonus non retirable lors d'un retrait du retirable", () => {
    // balance=10000, bonus=4000 -> retirable 6000. Le retrait sort du solde
    // reel, le bonus reste intact et non retirable (retirable apres = 0).
    const outcome = computeDebitOutcome({
      currentBalance: 10000,
      currentBonus: 4000,
      amountCents: 6000,
    });
    expect(outcome).toEqual({
      ok: true,
      nextBalance: 4000,
      nextBonus: 4000,
      entryBonusCents: 0,
    });
  });

  it("refuse un debit superieur au solde total", () => {
    const outcome = computeDebitOutcome({
      currentBalance: 10000,
      currentBonus: 4000,
      amountCents: 10001,
    });
    expect(outcome).toEqual({
      ok: false,
      code: "INSUFFICIENT_FUNDS",
      message: "Insufficient wallet balance",
    });
  });

  it("tolere un debit exactement egal au solde total", () => {
    const outcome = computeDebitOutcome({
      currentBalance: 10000,
      currentBonus: 10000,
      amountCents: 10000,
    });
    expect(outcome).toEqual({
      ok: true,
      nextBalance: 0,
      nextBonus: 0,
      entryBonusCents: -10000,
    });
  });
});