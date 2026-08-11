export type SortKey =
  | "date_desc"
  | "date_asc"
  | "balance_desc"
  | "balance_asc"
  | "transactions_desc"
  | "transactions_asc"
  | "name_asc"
  | "name_desc";

export const SORT_KEYS = [
  "date_desc",
  "date_asc",
  "balance_desc",
  "balance_asc",
  "transactions_desc",
  "transactions_asc",
  "name_asc",
  "name_desc",
] as const satisfies readonly SortKey[];

export const SORT_LABELS: Record<SortKey, string> = {
  date_desc: "Plus recents",
  date_asc: "Plus anciens",
  balance_desc: "Solde decroissant",
  balance_asc: "Solde croissant",
  transactions_desc: "Plus de transactions",
  transactions_asc: "Moins de transactions",
  name_asc: "Nom A-Z",
  name_desc: "Nom Z-A",
};
