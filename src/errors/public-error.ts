export class PublicError extends Error {
  public constructor(
    public readonly code: string,
    public readonly publicMessage: string,
    options?: ErrorOptions,
  ) {
    super(publicMessage, options);
    this.name = 'PublicError';
  }
}

export function publicMessage(error: unknown, correlationId: string): string {
  if (error instanceof PublicError) return error.publicMessage;
  return `The action could not be completed. Try again or contact an administrator with reference ${correlationId}.`;
}
