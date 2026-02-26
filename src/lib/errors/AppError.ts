export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'AppError'
  }
}
