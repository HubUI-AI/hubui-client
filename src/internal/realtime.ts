/**
 * HubUI Client SDK - Internal Realtime Adapter
 * @hubui/client
 *
 * This file isolates transport imports to keep them internal.
 * The bundler inlines runtime internals from end users.
 */

// Re-export only what we need internally
export {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  TrackPublication,
  Participant,
  RemoteParticipant,
  LocalParticipant,
  DataPacket_Kind,
  ParticipantKind,
  LogLevel,
  setLogLevel,
} from 'livekit-client';

export type {
  RoomOptions,
  RoomConnectOptions,
  TranscriptionSegment,
} from 'livekit-client';
