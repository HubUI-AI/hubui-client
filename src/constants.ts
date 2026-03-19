/**
 * HubUI Client SDK - Constants
 * @hubui/client
 */

/**
 * Default API base URL for HubUI backend
 */
export const DEFAULT_API_BASE_URL = 'https://api.hubui.ai';

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
  /** Public token endpoint for SDK authentication */
  PUBLIC_TOKEN: '/api/v1/tokens/public',
} as const;

/**
 * Realtime data channel topics
 */
export const DATA_TOPICS = {
  /** Topic for text chat messages */
  CHAT: 'lk-chat-topic',
} as const;

/**
 * Default configuration values
 */
export const DEFAULTS = {
  /** Default connection timeout in milliseconds */
  CONNECTION_TIMEOUT: 30000,
  
  /** Default reconnection attempts */
  MAX_RECONNECT_ATTEMPTS: 3,
  
  /** Default user name if not provided */
  USER_NAME: 'User',
} as const;

/**
 * SDK version
 */
export const SDK_VERSION = '0.1.0';
