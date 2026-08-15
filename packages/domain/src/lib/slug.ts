const SLUG_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function isValidSlug(slug: string, length = 10): boolean {
  return typeof slug === "string" && slug.length === length && new RegExp(`^[0-9A-Za-z]{${length}}$`).test(slug);
}

export function generateSlug(length = 10, random: () => number = Math.random): string {
  if (!Number.isInteger(length) || length < 4 || length > 64) throw new RangeError("Slug length must be between 4 and 64");
  let value = "";
  for (let i = 0; i < length; i += 1) value += SLUG_ALPHABET[Math.floor(random() * SLUG_ALPHABET.length)];
  return value;
}

export function incrementRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new RangeError("Revision must be a non-negative integer");
  return revision + 1;
}
