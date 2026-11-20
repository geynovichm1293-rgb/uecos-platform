export function isTokenVersionCurrent(tokenVersion, storedTokenVersion) {
  const tokenVersionValue = tokenVersion ?? 0;
  const storedVersionValue = Number(storedTokenVersion ?? 0);
  return Number.isInteger(tokenVersionValue) &&
    Number.isInteger(storedVersionValue) &&
    tokenVersionValue === storedVersionValue;
}
