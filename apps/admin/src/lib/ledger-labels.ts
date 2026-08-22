export type LedgerLabelInput = {
  type: string;
  reason: string;
  category?: string | null;
  withdrawalStatus?: string | null;
};

function keyOf(tx: LedgerLabelInput): string {
  return (tx.reason || tx.category || "").toLowerCase();
}

export function ledgerMethodLabel(reason: string | null | undefined): string | null {
  const r = (reason || "").toLowerCase();
  if (r.startsWith("moncash_")) return "MonCash";
  if (r.startsWith("natcash_")) return "NatCash";
  return null;
}

export function ledgerLifecycleLabel(reason: string | null | undefined): string | null {
  const r = (reason || "").toLowerCase();
  if (r.includes("withdraw_hold")) return "Hold (fonds reserves)";
  if (r.includes("withdraw_reject_refund")) return "Remboursement apres rejet";
  if (r.includes("withdraw_cancel_refund")) return "Remboursement apres annulation";
  if (r.includes("withdraw_refund")) return "Remboursement apres echec";
  return null;
}

export function withdrawalStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  switch (status) {
    case "pending":
      return "En attente";
    case "processing":
      return "En cours";
    case "successful":
      return "Reussi";
    case "failed":
      return "Echoue";
    case "cancelled":
      return "Annule";
    default:
      return status;
  }
}

export function ledgerNatureLabel(tx: LedgerLabelInput): string {
  const r = keyOf(tx);
  if (r === "moncash_deposit" || r === "deposit") return "Depot auto MonCash";
  if (r === "natcash_deposit" || r === "depot_manual") return "Depot manuel NatCash";
  if (r === "bonus") return "Bonus";
  if (r === "gift") return "Cadeau";
  if (r === "weekly_reward") return "Recompense hebdo";
  if (r === "reward") return "Recompense";
  if (r === "grant") return "Grant";
  if (r === "admin_investment") return "Approvisionnement admin";
  if (r === "admin_debit") return "Debit admin";
  if (r === "refund") return "Remboursement";
  if (r === "bet" || r.startsWith("bet_")) return "Mise";
  if (r === "win" || r.startsWith("win_")) return "Gain";
  if (r.includes("withdraw_hold")) {
    const method = ledgerMethodLabel(r);
    return method ? `Retrait ${method} (hold)` : "Retrait (hold)";
  }
  if (r.includes("withdraw_reject_refund")) return "Retrait rejete (rembourse)";
  if (r.includes("withdraw_cancel_refund")) return "Retrait annule (rembourse)";
  if (r.includes("withdraw_refund")) return "Retrait rembourse";
  if (r.includes("withdraw")) return "Retrait";
  return tx.type === "credit" ? "Credit" : "Debit";
}
