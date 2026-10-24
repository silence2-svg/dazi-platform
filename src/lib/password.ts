import bcrypt from "bcryptjs";

export function hashPassword(plain: string) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}
