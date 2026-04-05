import { createHash, timingSafeEqual } from "node:crypto";

export async function sha256Hex(input: Blob | Uint8Array): Promise<string> {
  const bytes =
    input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());

  const hash = createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}

export function isValidSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

export function checksumMatches(left: string, right: string): boolean {
  if (!isValidSha256Hex(left) || !isValidSha256Hex(right)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
