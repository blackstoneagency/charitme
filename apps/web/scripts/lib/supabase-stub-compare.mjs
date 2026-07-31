export function compare(value, raw) {
  const leftNumber = Number(value);
  const rightNumber = Number(raw);
  if (
    value !== null &&
    value !== '' &&
    raw !== '' &&
    !Number.isNaN(leftNumber) &&
    !Number.isNaN(rightNumber)
  ) {
    return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1;
  }
  const leftString = String(value ?? '');
  const rightString = String(raw);
  return leftString === rightString ? 0 : leftString > rightString ? 1 : -1;
}
