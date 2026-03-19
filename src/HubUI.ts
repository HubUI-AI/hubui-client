/**
 * HubUI Client SDK - Main Entry Point
 * @hubui/client
 * 
 * Static class providing SDK entry points.
 */

import { HubUISession } from './HubUISession';
import { HubUIConfig, AudioDevice, TokenResponse } from './types';
import { HubUIError, ErrorCodes, createError, wrapError } from './errors';
import { DEFAULT_API_BASE_URL, API_ENDPOINTS, DEFAULTS } from './constants';

/**
 * Main entry point for the HubUI SDK.
 * 
 * @example
 * ```typescript
 * import { HubUI } from '@hubui/client';
 * 
 * // Connect to an agent
 * const session = await HubUI.connect({
 *   agentId: 'your-agent-id',
 *   apiKey: 'pk_live_xxxxx',
 *   mode: 'voice',  // or 'text'
 *   userName: 'John Doe',
 * });
 * 
 * // Listen for events
 * session.on('transcript', (text, speaker) => {
 *   console.log(`${speaker}: ${text}`);
 * });
 * 
 * // Disconnect when done
 * await session.disconnect();
 * ```
 */
export class HubUI {
  /**
   * Connect to a HubUI agent.
   * 
   * @param config - Configuration for the connection
   * @returns A promise that resolves to an active HubUISession
   * @throws HubUIError if connection fails
   */
  static async connect(config: HubUIConfig): Promise<HubUISession> {
    // Validate config
    HubUI.validateConfig(config);

    let tokenResponse: TokenResponse;

    if (config.token) {
      // Token provided directly — skip API key fetch (used by dashboard / internal tools)
      if (!config.serverUrl) {
        throw createError('serverUrl is required when using token directly', ErrorCodes.INVALID_CONFIG);
      }
      tokenResponse = {
        token: config.token,
        hubui_url: config.serverUrl,
        room_name: '',
      };
    } else {
      // Standard flow — fetch token using API key
      tokenResponse = await HubUI.fetchToken(config);
    }

    // Create and connect session
    const session = new HubUISession(config);
    await session.connect(tokenResponse);

    return session;
  }

  /**
   * Get available audio input and output devices.
   * 
   * @returns Lists of available audio devices
   * @throws HubUIError if device enumeration fails
   */
  static async getAudioDevices(): Promise<{ inputs: AudioDevice[]; outputs: AudioDevice[] }> {
    try {
      // Request permission first (needed on some browsers)
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs: AudioDevice[] = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: 'audioinput' as const,
        }));

      const outputs: AudioDevice[] = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          kind: 'audiooutput' as const,
        }));

      return { inputs, outputs };
    } catch (error) {
      throw createError(
        'Failed to get audio devices. Please ensure microphone permission is granted.',
        ErrorCodes.AUDIO_DEVICE_ERROR
      );
    }
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  private static validateConfig(config: HubUIConfig): void {
    if (!config) {
      throw createError('Configuration is required', ErrorCodes.INVALID_CONFIG);
    }

    if (!config.agentId || typeof config.agentId !== 'string') {
      throw createError('agentId is required', ErrorCodes.MISSING_AGENT_ID);
    }

    // Either apiKey or token must be provided
    if (!config.token) {
      if (!config.apiKey || typeof config.apiKey !== 'string') {
        throw createError('apiKey or token is required', ErrorCodes.MISSING_API_KEY);
      }

      if (!config.apiKey.startsWith('pk_live_')) {
        throw createError('Invalid API key format. Key should start with pk_live_', ErrorCodes.INVALID_API_KEY);
      }
    }

    if (!config.mode || !['voice', 'text'].includes(config.mode)) {
      throw createError('mode must be either "voice" or "text"', ErrorCodes.INVALID_MODE);
    }
  }

  private static async fetchToken(config: HubUIConfig): Promise<TokenResponse> {
    const baseUrl = config.apiBaseUrl || DEFAULT_API_BASE_URL;
    const url = `${baseUrl}${API_ENDPOINTS.PUBLIC_TOKEN}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: config.apiKey,
          agent_id: config.agentId,
          mode: config.mode,
          user_name: config.userName || DEFAULTS.USER_NAME,
          user_email: config.userEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.error || 'Failed to authenticate';
        
        if (response.status === 401 || response.status === 403) {
          throw createError(errorMessage, ErrorCodes.INVALID_API_KEY);
        }
        if (response.status === 404) {
          throw createError('Agent not found or not accessible', ErrorCodes.INVALID_AGENT_ID);
        }
        
        throw createError(errorMessage, ErrorCodes.TOKEN_FETCH_FAILED);
      }

      const data: TokenResponse = await response.json();
      
      if (!data.token || !data.hubui_url) {
        throw createError('Invalid token response from server', ErrorCodes.TOKEN_FETCH_FAILED);
      }

      return data;
    } catch (error) {
      if (error instanceof HubUIError) {
        throw error;
      }
      
      throw createError(
        'Failed to connect to HubUI. Please check your internet connection.',
        ErrorCodes.NETWORK_ERROR
      );
    }
  }
}
