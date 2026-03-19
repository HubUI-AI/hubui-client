/**
 * HubUI Client SDK - Type Definitions
 * @hubui/client
 */

/**
 * Configuration for connecting to a HubUI agent
 */
export interface HubUIConfig {
  /** The agent ID from your HubUI dashboard */
  agentId: string;
  
  /** Your API key (pk_live_xxx) from the HubUI dashboard. Required unless `token` is provided. */
  apiKey?: string;
  
  /** Pre-fetched connection token. When provided, the SDK skips API key validation and token fetch. Requires `serverUrl`. */
  token?: string;

  /** WebSocket server URL. Required when using `token` directly. */
  serverUrl?: string;
  
  /** Connection mode: 'voice' for audio calls, 'text' for chat */
  mode: 'voice' | 'text';
  
  /** Optional: Display name for the end user */
  userName?: string;
  
  /** Optional: Email for the end user (for analytics) */
  userEmail?: string;
  
  /** Optional: Specific audio input device ID */
  audioInput?: string;
  
  /** Optional: Specific audio output device ID */
  audioOutput?: string;

  /** Optional: Custom API base URL (for enterprise) */
  apiBaseUrl?: string;

  /** Optional: Enable debug logging to the browser console (default: false) */
  debug?: boolean;
}

/**
 * Connection states for a HubUI session
 */
export type HubUIConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'reconnecting';

/**
 * A single transcript entry
 */
export interface HubUITranscriptEntry {
  /** Unique ID for this entry */
  id: string;
  
  /** Who spoke: 'user' or 'agent' */
  speaker: 'user' | 'agent';
  
  /** The transcribed or sent text */
  text: string;
  
  /** When this entry was created */
  timestamp: Date;
  
  /** Whether this is a final transcript (vs interim) */
  isFinal: boolean;
}

/**
 * Audio device information
 */
export interface AudioDevice {
  /** Device ID to use when setting input/output */
  deviceId: string;
  
  /** Human-readable device name */
  label: string;
  
  /** Device type */
  kind: 'audioinput' | 'audiooutput';
}

/**
 * Event handler types
 */
export interface HubUIEvents {
  /** Fired when successfully connected to the agent */
  'connected': () => void;
  
  /** Fired when disconnected from the agent */
  'disconnected': () => void;
  
  /** Fired when an error occurs */
  'error': (error: HubUIError) => void;
  
  /** Fired when transcript is received (voice mode) */
  'transcript': (text: string, speaker: 'user' | 'agent', isFinal: boolean) => void;
  
  /** Fired when a text message is received */
  'message': (text: string) => void;
  
  /** Fired when connection state changes */
  'connectionStateChanged': (state: HubUIConnectionState) => void;
  
  /** Fired when audio playback is blocked (mobile browsers) */
  'audioPlaybackBlocked': () => void;
}

/**
 * Error class for HubUI-specific errors
 */
export class HubUIError extends Error {
  code: string;
  
  constructor(message: string, code: string = 'HUBUI_ERROR') {
    super(message);
    this.name = 'HubUIError';
    this.code = code;
  }
}

/**
 * Response from the token endpoint
 */
export interface TokenResponse {
  token: string;
  hubui_url: string;
  room_name: string;
}
