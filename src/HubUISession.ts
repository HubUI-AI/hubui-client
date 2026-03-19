/**
 * HubUI Client SDK - Session Class
 * @hubui/client
 * 
 * Manages an active connection to a HubUI agent.
 */

import {
  Room,
  RoomEvent,
  ConnectionState,
  RemoteParticipant,
  Participant,
  Track,
  LogLevel,
  setLogLevel,
} from './internal/realtime';
import type { TranscriptionSegment } from './internal/realtime';
import { 
  HubUIConnectionState, 
  HubUITranscriptEntry, 
  HubUIEvents,
  HubUIConfig,
  TokenResponse,
} from './types';
import { ErrorCodes, createError, wrapError } from './errors';
import { DATA_TOPICS } from './constants';

type EventCallback = (...args: any[]) => void;

/**
 * Represents an active session with a HubUI agent.
 * 
 * @example
 * ```typescript
 * const session = await HubUI.connect({ agentId, apiKey, mode: 'voice' });
 * 
 * session.on('transcript', (text, speaker, isFinal) => {
 *   console.log(`${speaker}: ${text}`);
 * });
 * 
 * session.on('message', (text) => {
 *   console.log('Agent:', text);
 * });
 * 
 * // For text mode:
 * await session.send('Hello!');
 * 
 * // Cleanup
 * await session.disconnect();
 * ```
 */
export class HubUISession {
  private room: Room;
  private config: HubUIConfig;
  private eventListeners: Map<keyof HubUIEvents, Set<EventCallback>> = new Map();
  private _state: HubUIConnectionState = 'disconnected';
  private _transcript: HubUITranscriptEntry[] = [];
  private _isMuted: boolean = false;
  private transcriptIdCounter: number = 0;
  private audioContext: AudioContext | null = null;
  private audioUnlocked: boolean = false;
  private debug: boolean;

  /**
   * @internal
   * Use HubUI.connect() instead of constructing directly.
   */
  constructor(config: HubUIConfig) {
    this.config = config;
    this.debug = config.debug ?? false;
    setLogLevel(this.debug ? LogLevel.debug : LogLevel.silent);
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
  }

  /**
   * Current connection state
   */
  get state(): HubUIConnectionState {
    return this._state;
  }

  /**
   * Current mode (voice or text)
   */
  get mode(): 'voice' | 'text' {
    return this.config.mode;
  }

  /**
   * Full transcript history
   */
  get transcript(): HubUITranscriptEntry[] {
    return [...this._transcript];
  }

  /**
   * @internal
   * Connect to the room - called by HubUI.connect()
   */
  async connect(tokenResponse: TokenResponse): Promise<void> {
    this.log('[HubUI] Connecting to room...');
    this.log('[HubUI] Token response:', { 
      hubui_url: tokenResponse.hubui_url, 
      room_name: tokenResponse.room_name,
      token_length: tokenResponse.token?.length 
    });
    
    this.updateState('connecting');

    try {
      // Unlock audio on mobile browsers (must happen before connect)
      if (this.config.mode === 'voice') {
        await this.unlockAudio();
      }

      // Setup all room event listeners BEFORE connecting
      this.setupRoomListeners();

      // Register text stream handlers (critical for text mode)
      this.registerTextStreamHandlers();

      this.log('[HubUI] Connecting to realtime room:', tokenResponse.hubui_url);
      
      // Connect to realtime room
      await this.room.connect(tokenResponse.hubui_url, tokenResponse.token, {
        autoSubscribe: true,
      });

      this.log('[HubUI] Room connected, localParticipant:', this.room.localParticipant.identity);
      
      // Log existing remote participants (agent might already be connected)
      const remoteParticipants = Array.from(this.room.remoteParticipants.values());
      this.log('[HubUI] Remote participants on connect:', remoteParticipants.map(p => p.identity));

      // CRITICAL: Start audio immediately after connect for voice mode
      // Must happen while still in user gesture context
      if (this.config.mode === 'voice') {
        try {
          await this.room.startAudio();
          this.log('[HubUI] Audio started successfully');
        } catch (e) {
          this.log('[HubUI] startAudio deferred - may need user gesture');
        }
      }

      // For voice mode, enable microphone
      if (this.config.mode === 'voice') {
        this.log('[HubUI] Enabling microphone...');
        if (this.config.audioInput) {
          await this.room.localParticipant.setMicrophoneEnabled(true, { 
            deviceId: this.config.audioInput 
          });
        } else {
          await this.room.localParticipant.setMicrophoneEnabled(true);
        }
        this.log('[HubUI] Microphone enabled');
      }

      // Set audio output device if specified
      if (this.config.audioOutput) {
        await this.setAudioOutput(this.config.audioOutput);
      }

      this.updateState('connected');
      this.emit('connected');
      this.log('[HubUI] Connection complete, state:', this._state);
    } catch (error) {
      this.logError('[HubUI] Connection failed:', error);
      this.updateState('disconnected');
      throw wrapError(error);
    }
  }

  /**
   * Register an event listener
   */
  on<E extends keyof HubUIEvents>(event: E, callback: HubUIEvents[E]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback);
  }

  /**
   * Remove an event listener
   */
  off<E extends keyof HubUIEvents>(event: E, callback: HubUIEvents[E]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as EventCallback);
    }
  }

  /**
   * Mute the microphone (voice mode only)
   */
  mute(): void {
    if (this.config.mode !== 'voice') return;
    this.room.localParticipant.setMicrophoneEnabled(false);
    this._isMuted = true;
  }

  /**
   * Unmute the microphone (voice mode only)
   */
  unmute(): void {
    if (this.config.mode !== 'voice') return;
    this.room.localParticipant.setMicrophoneEnabled(true);
    this._isMuted = false;
  }

  /**
   * Check if microphone is muted
   */
  isMuted(): boolean {
    return this._isMuted;
  }

  /**
   * Enable audio playback (required on mobile browsers)
   */
  async enableAudio(): Promise<void> {
    await this.room.startAudio();
  }

  /**
   * Send a text message to the agent
   */
  async send(message: string): Promise<void> {
    if (this._state !== 'connected') {
      throw createError('Not connected to agent', ErrorCodes.SESSION_NOT_CONNECTED);
    }

    if (!message.trim()) return;

    this.log('[HubUI] Sending message:', message);

    // Add to transcript
    this.addTranscriptEntry('user', message, true);

    // Send via realtime text stream (matches dashboard implementation)
    try {
      this.log('[HubUI] Creating text stream on lk.chat topic...');
      const textStream = await this.room.localParticipant.streamText({
        topic: 'lk.chat',
      });
      await textStream.write(message);
      await textStream.close();
      this.log('[HubUI] Message sent successfully via text stream');
    } catch (error) {
      // Fallback to data channel if text stream fails
      this.log('[HubUI] Text stream failed, using data channel fallback:', error);
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ text: message }));
      
      await this.room.localParticipant.publishData(data, {
        reliable: true,
        topic: DATA_TOPICS.CHAT,
      });
      this.log('[HubUI] Message sent via data channel fallback');
    }
  }

  /**
   * Set audio input device
   */
  async setAudioInput(deviceId: string): Promise<void> {
    await this.room.switchActiveDevice('audioinput', deviceId);
  }

  /**
   * Set audio output device
   */
  async setAudioOutput(deviceId: string): Promise<void> {
    await this.room.switchActiveDevice('audiooutput', deviceId);
  }

  /**
   * Disconnect from the agent
   */
  async disconnect(): Promise<void> {
    // Close AudioContext if open
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    // Send session end message (like dashboard does)
    if (this.room && this._state === 'connected') {
      try {
        const textStream = await this.room.localParticipant.streamText({
          topic: 'lk.chat',
        });
        await textStream.write('[SESSION_END]');
        await textStream.close();
        // Small delay to ensure message is sent
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // Ignore errors when sending disconnect message
      }
    }

    await this.room.disconnect();
    this.updateState('disconnected');
    this.emit('disconnected');
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Unlock audio for mobile browsers - must be called before connect
   */
  private async unlockAudio(): Promise<void> {
    if (this.audioUnlocked) return;

    try {
      // Create and resume AudioContext (required for iOS/Android)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        this.audioContext = ctx;

        // Resume if suspended (iOS requires this on user gesture)
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        // Create a silent buffer and play it
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }

      // Play a silent HTML audio element (some browsers need this)
      const silentAudio = document.createElement('audio');
      silentAudio.setAttribute('playsinline', 'true');
      silentAudio.setAttribute('webkit-playsinline', 'true');
      silentAudio.muted = false;
      silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      silentAudio.volume = 0.1;

      try {
        await silentAudio.play();
      } catch (e) {}

      this.audioUnlocked = true;
    } catch (e) {
      this.log('[HubUI] Audio unlock failed:', e);
    }
  }

  /**
   * Register text stream handlers for receiving agent responses
   */
  private registerTextStreamHandlers(): void {
    // Handler for 'lk.chat' topic (agent chat responses)
    this.room.registerTextStreamHandler('lk.chat', async (reader: any, participantIdentity: any) => {
      this.log('[HubUI] lk.chat stream received from:', participantIdentity);
      
      const identityStr = typeof participantIdentity === 'string' 
        ? participantIdentity 
        : participantIdentity?.identity;
      
      // Skip messages from local participant (our own messages)
      if (identityStr === this.room.localParticipant.identity) {
        this.log('[HubUI] Skipping lk.chat - from local participant');
        return;
      }

      const segmentId = `chat-${Date.now()}`;
      let accumulatedText = '';

      try {
        for await (const chunk of reader) {
          this.log('[HubUI] lk.chat chunk:', chunk);
          accumulatedText += chunk;
          
          if (accumulatedText.trim()) {
            // Update transcript entry (streaming)
            this.updateTranscriptEntry(segmentId, 'agent', accumulatedText, false);
            // Don't emit message event during streaming to avoid duplicates
          }
        }

        // Emit message event ONLY when stream completes (final)
        if (accumulatedText.trim()) {
          this.log('[HubUI] lk.chat complete:', accumulatedText);
          this.updateTranscriptEntry(segmentId, 'agent', accumulatedText, true);
          this.emit('message', accumulatedText);
        }
      } catch (err) {
        this.logError('[HubUI] Error reading lk.chat stream:', err);
      }
    });

    // Handler for 'lk.transcription' topic (agent transcription responses)
    this.room.registerTextStreamHandler('lk.transcription', async (reader: any, participantIdentity: any) => {
      this.log('[HubUI] lk.transcription stream received from:', participantIdentity);
      
      // Only process in text mode to avoid duplicates with TranscriptionReceived
      if (this.config.mode !== 'text') {
        this.log('[HubUI] Skipping lk.transcription - not in text mode');
        return;
      }

      const identityStr = typeof participantIdentity === 'string' 
        ? participantIdentity 
        : participantIdentity?.identity;

      // Skip messages from local participant
      if (identityStr === this.room.localParticipant.identity) {
        this.log('[HubUI] Skipping lk.transcription - from local participant');
        return;
      }

      const segmentId = reader.info?.attributes?.['lk.segment_id'] || `agent-${Date.now()}`;
      let accumulatedText = '';

      try {
        for await (const chunk of reader) {
          this.log('[HubUI] lk.transcription chunk:', chunk);
          accumulatedText += chunk;

          if (accumulatedText.trim()) {
            this.updateTranscriptEntry(segmentId, 'agent', accumulatedText, false);
            // Emit interim transcript events for real-time display
            this.emit('transcript', accumulatedText, 'agent', false);
          }
        }

        // Mark as final when stream completes
        if (accumulatedText.trim()) {
          this.log('[HubUI] lk.transcription complete:', accumulatedText);
          this.updateTranscriptEntry(segmentId, 'agent', accumulatedText, true);
          this.emit('transcript', accumulatedText, 'agent', true);
        }
      } catch (err) {
        this.logError('[HubUI] Error reading lk.transcription stream:', err);
      }
    });
  }

  private setupRoomListeners(): void {
    // Connection state changes
    this.room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      this.log('[HubUI] Room ConnectionStateChanged:', state);
      const mappedState = this.mapConnectionState(state);
      this.updateState(mappedState);
    });

    // Log when participants connect (agent joining)
    this.room.on(RoomEvent.ParticipantConnected, (participant: any) => {
      this.log('[HubUI] Participant connected:', participant.identity, participant.kind);
    });

    // Log when tracks are published
    this.room.on(RoomEvent.TrackPublished, (publication: any, participant: any) => {
      this.log('[HubUI] Track published:', publication.kind, 'from', participant.identity);
    });

    // Handle audio track subscriptions (voice mode)
    this.room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
      this.log('[HubUI] Track subscribed:', track.kind, 'from', participant.identity);
      
      if (track.kind === Track.Kind.Audio && this.config.mode === 'voice') {
        // Attach the audio track
        const audioElement = track.attach();
        audioElement.setAttribute('playsinline', 'true');
        audioElement.setAttribute('webkit-playsinline', 'true');
        audioElement.autoplay = true;
        audioElement.muted = false;
        audioElement.volume = 1.0;

        // Append to body for mobile compatibility
        document.body.appendChild(audioElement);

        // Attempt to play
        audioElement.play().catch((err: any) => {
          this.log('[HubUI] Audio play blocked, user interaction needed');
          this.emit('audioPlaybackBlocked');
        });
      }
    });

    // Handle track unsubscribed
    this.room.on(RoomEvent.TrackUnsubscribed, (track: any) => {
      if (track.kind === Track.Kind.Audio) {
        track.detach().forEach((el: HTMLElement) => el.remove());
      }
    });

    // Transcription (voice mode)
    this.room.on(
      RoomEvent.TranscriptionReceived,
      (segments: TranscriptionSegment[], participant?: Participant) => {
        this.log('[HubUI] TranscriptionReceived:', segments.length, 'segments from', (participant as any)?.identity);
        
        for (const segment of segments) {
          const isLocal = (participant as any)?.sid === this.room.localParticipant.sid;
          const speaker = isLocal ? 'user' : 'agent'; // Correctly map speaker
          const isFinal = segment.final;
          
          this.log(`[HubUI] Transcript segment: speaker=${speaker}, final=${isFinal}, text="${segment.text}"`);
          
          // Update or add transcript entry
          const existingIndex = this._transcript.findIndex(t => t.id === segment.id);
          if (existingIndex >= 0) {
            this._transcript[existingIndex].text = segment.text;
            this._transcript[existingIndex].isFinal = isFinal;
          } else {
            this._transcript.push({
              id: segment.id,
              speaker: speaker,
              text: segment.text,
              timestamp: new Date(),
              isFinal: isFinal
            });
          }

          this.emit('transcript', segment.text, speaker, isFinal);
        }
      }
    );

    // Handle data received (Chat)
    this.room.on(
      RoomEvent.DataReceived,
      (payload: Uint8Array, participant?: any, kind?: any, topic?: string) => {
        this.log('[HubUI] DataReceived, topic:', topic, 'from:', participant?.identity);
        
        // Ignore local messages
        const p = participant as RemoteParticipant;
        if (!p || p.isLocal) return;

        try {
          const text = new TextDecoder().decode(payload);
          this.log('[HubUI] DataReceived decoded:', text);
          
          try {
            const data = JSON.parse(text);
            const message = data.text || data.response || data.message || data.content;
            
            if (message) {
              this.addTranscriptEntry('agent', message, true);
              this.emit('message', message);
            }
          } catch {
            // Not JSON, assume plain text
            if (text.trim()) {
              this.addTranscriptEntry('agent', text, true);
              this.emit('message', text);
            }
          }
        } catch (e) {
          this.logWarn('[HubUI] Failed to decode data message', e);
        }
      }
    );

    // Audio playback status
    this.room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      this.log('[HubUI] AudioPlaybackStatusChanged, canPlaybackAudio:', this.room.canPlaybackAudio);
      if (!this.room.canPlaybackAudio) {
        this.emit('audioPlaybackBlocked');
      }
    });

    // Disconnection handling
    this.room.on(RoomEvent.Disconnected, () => {
      this.log('[HubUI] Room disconnected');
      this.updateState('disconnected');
      this.emit('disconnected');
    });
  }

  private mapConnectionState(state: ConnectionState): HubUIConnectionState {
    switch (state) {
      case ConnectionState.Connected:
        return 'connected';
      case ConnectionState.Connecting:
        return 'connecting';
      case ConnectionState.Reconnecting:
        return 'reconnecting';
      case ConnectionState.Disconnected:
      default:
        return 'disconnected';
    }
  }

  private updateState(state: HubUIConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this.emit('connectionStateChanged', state);
    }
  }

  private addTranscriptEntry(speaker: 'user' | 'agent', text: string, isFinal: boolean): void {
    const entry: HubUITranscriptEntry = {
      id: `${++this.transcriptIdCounter}`,
      speaker,
      text,
      timestamp: new Date(),
      isFinal,
    };
    this._transcript.push(entry);
  }

  private updateTranscriptEntry(id: string, speaker: 'user' | 'agent', text: string, isFinal: boolean): void {
    const existingIndex = this._transcript.findIndex(t => t.id === id);
    if (existingIndex >= 0) {
      this._transcript[existingIndex].text = text;
      this._transcript[existingIndex].isFinal = isFinal;
    } else {
      this._transcript.push({
        id,
        speaker,
        text,
        timestamp: new Date(),
        isFinal,
      });
    }
  }

  private log(...args: any[]): void {
    if (this.debug) console.log(...args);
  }

  private logWarn(...args: any[]): void {
    if (this.debug) console.warn(...args);
  }

  private logError(...args: any[]): void {
    if (this.debug) console.error(...args);
  }

  private emit<E extends keyof HubUIEvents>(event: E, ...args: Parameters<HubUIEvents[E]>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          this.logError(`[HubUI] Error in ${event} listener:`, error);
        }
      });
    }
  }
}
