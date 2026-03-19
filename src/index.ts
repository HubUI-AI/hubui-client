/**
 * HubUI Client SDK
 * @hubui/client
 * 
 * Connect to AI voice and text agents with ease.
 * 
 * @packageDocumentation
 */

// Main entry point
export { HubUI } from './HubUI';

// Session class
export { HubUISession } from './HubUISession';

// Types
export type {
  HubUIConfig,
  HubUIConnectionState,
  HubUITranscriptEntry,
  HubUIEvents,
  AudioDevice,
} from './types';

// Errors
export { HubUIError, ErrorCodes } from './errors';
export type { ErrorCode } from './errors';

// Constants (useful for advanced users)
export { SDK_VERSION } from './constants';
