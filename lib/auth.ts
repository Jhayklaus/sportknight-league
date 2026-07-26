export function getPin(): string {
  return process.env.LEAGUE_PIN || "1234";
}

export function checkPin(pin: unknown): boolean {
  return typeof pin === "string" && pin.length > 0 && pin === getPin();
}
