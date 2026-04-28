/**
 * Error codes produced by `@sovereignbase/base-station`.
 */
export type BaseStationErrorCode = '' | ''

/**
 * Semantic error type for `@sovereignbase/base-station`.
 */
export class BaseStationError extends Error {
  /**
   * Machine-readable base station error code.
   */
  readonly code: BaseStationErrorCode

  /**
   * Initializes a new {@link BaseStationError}.
   *
   * @param code The semantic error code.
   * @param message Optional human-readable detail.
   */
  constructor(code: BaseStationErrorCode, message?: string) {
    const detail = message ?? code
    super(`{@sovereignbase/base-station} ${detail}`)
    this.code = code
    this.name = 'BaseStationError'
  }
}
