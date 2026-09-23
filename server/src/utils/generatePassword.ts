import crypto from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "@#$%";

function pick(charset: string): string {
  return charset[crypto.randomInt(charset.length)];
}

/** Generates a random 10-character temporary password guaranteed to satisfy
 *  the "1 uppercase + 1 number" policy used in changePasswordSchema. */
export function generateTempPassword(): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const rest = Array.from({ length: 6 }, () => pick(all));
  const chars = [...required, ...rest];
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
