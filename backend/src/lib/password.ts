/**
 * 員工密碼雜湊（AC-011）。只存 bcrypt 雜湊，任何地方都不存、不記錄明碼。
 */
import bcrypt from 'bcryptjs';

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt 只取前 72 bytes；超過的部分會被忽略，所以直接拒絕過長的密碼，避免「後面亂打也能登入」。 */
export const MAX_PASSWORD_BYTES = 72;
const BCRYPT_COST = 10;

const tooLong = (plain: string) => Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES;

export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string' || plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (tooLong(plain)) {
    throw new Error(`password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (typeof plain !== 'string' || !hash || tooLong(plain)) return false;
  return bcrypt.compare(plain, hash);
}

/** 帳號不存在時用來做等時比對的雜湊（內容為隨機值，不對應任何密碼）。 */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash(bcrypt.genSaltSync(4) + Math.random().toString(36), BCRYPT_COST);
  return dummyHash;
}

export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}
