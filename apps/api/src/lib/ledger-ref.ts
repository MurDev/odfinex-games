/** Strip refund/reject/cancel prefixes so hold and refund lines join the same request. */
export function withdrawalLookupRef(referenceId: string): string {
  return referenceId.replace(/^(refund_|reject_|cancel_)/, "");
}
