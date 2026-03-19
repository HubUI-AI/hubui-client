/**
 * HubUI Client SDK - Error Classes
 * @hubui/client
 */

/**
 * Base error class for all HubUI errors
 */
export class HubUIError extends Error {
  code: string;
  
  constructor(message: string, code: string = 'HUBUI_ERROR') {
    super(message);
    this.name = 'HubUIError';
    this.code = code;
    
    // Maintains proper stack trace for where error was thrown
    const captureStackTrace = (Error as { captureStackTrace?: (target: object, constructor: Function) => void }).captureStackTrace;
    if (captureStackTrace) {
      captureStackTrace(this, HubUIError);
    }
  }
}

/**
 * Error codes used throughout the SDK
 */
export const ErrorCodes = {
  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_LOST: 'CONNECTION_LOST',
  
  // Authentication errors
  INVALID_API_KEY: 'INVALID_API_KEY',
  INVALID_AGENT_ID: 'INVALID_AGENT_ID',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Configuration errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  MISSING_AGENT_ID: 'MISSING_AGENT_ID',
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_MODE: 'INVALID_MODE',
  
  // Media errors
  MICROPHONE_ACCESS_DENIED: 'MICROPHONE_ACCESS_DENIED',
  AUDIO_DEVICE_ERROR: 'AUDIO_DEVICE_ERROR',
  
  // Session errors
  SESSION_NOT_CONNECTED: 'SESSION_NOT_CONNECTED',
  SESSION_ALREADY_CONNECTED: 'SESSION_ALREADY_CONNECTED',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TOKEN_FETCH_FAILED: 'TOKEN_FETCH_FAILED',
  
  // Unknown
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create a HubUIError with a specific code
 */
export function createError(message: string, code: ErrorCode): HubUIError {
  return new HubUIError(message, code);
}

/**
 * Wrap unknown errors in HubUIError
 */
export function wrapError(error: unknown): HubUIError {
  if (error instanceof HubUIError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new HubUIError(error.message, ErrorCodes.UNKNOWN);
  }
  
  return new HubUIError(String(error), ErrorCodes.UNKNOWN);
}
