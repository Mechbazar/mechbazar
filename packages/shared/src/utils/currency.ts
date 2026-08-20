// Single source of truth for INR display formatting. Was previously
// duplicated byte-for-byte in apps/mechanic and apps/rider, with every other
// app inlining its own ad hoc `₹${x}`/`₹${x.toLocaleString()}` -- some of
// which skipped Indian digit grouping entirely.
export const formatINR = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
