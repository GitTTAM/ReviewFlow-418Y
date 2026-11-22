export class AppError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
export function assert(condition, status, message) {
  if (!condition) throw new AppError(status, message);
}
export function validId(value) {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}
