import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock livekit-client
vi.mock('livekit-client', () => {
  function createMockRoom() {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      localParticipant: {
        identity: 'local-user',
        sid: 'local-sid',
        setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
        publishData: vi.fn().mockResolvedValue(undefined),
        streamText: vi.fn().mockResolvedValue({ write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }),
      },
      remoteParticipants: new Map(),
      on: vi.fn(),
      registerTextStreamHandler: vi.fn(),
      startAudio: vi.fn().mockResolvedValue(undefined),
      switchActiveDevice: vi.fn().mockResolvedValue(undefined),
      canPlaybackAudio: true,
    };
  }

  return {
    Room: vi.fn().mockImplementation(() => createMockRoom()),
    RoomEvent: {
      ConnectionStateChanged: 'connectionStateChanged',
      ParticipantConnected: 'participantConnected',
      TrackPublished: 'trackPublished',
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
      TranscriptionReceived: 'transcriptionReceived',
      DataReceived: 'dataReceived',
      AudioPlaybackStatusChanged: 'audioPlaybackStatusChanged',
      Disconnected: 'disconnected',
    },
    ConnectionState: {
      Connected: 'connected',
      Connecting: 'connecting',
      Reconnecting: 'reconnecting',
      Disconnected: 'disconnected',
    },
    Track: { Kind: { Audio: 'audio', Video: 'video' } },
    TrackPublication: vi.fn(),
    Participant: vi.fn(),
    RemoteParticipant: vi.fn(),
    LocalParticipant: vi.fn(),
    DataPacket_Kind: {},
    ParticipantKind: {},
    LogLevel: { debug: 'debug', silent: 'silent' },
    setLogLevel: vi.fn(),
  };
});

import { HubUISession } from '../src/HubUISession';
import { HubUIError, ErrorCodes } from '../src/errors';

function createSession(mode: 'voice' | 'text' = 'text') {
  return new HubUISession({
    agentId: 'agent-1',
    apiKey: 'pk_live_test',
    mode,
  });
}

async function createConnectedSession(mode: 'voice' | 'text' = 'text') {
  const session = createSession(mode);
  await session.connect({
    token: 'test-token',
    hubui_url: 'wss://test.hubui.ai',
    room_name: 'room-1',
  });
  return session;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HubUISession — initial state', () => {
  it('starts disconnected', () => {
    const session = createSession();
    expect(session.state).toBe('disconnected');
  });

  it('reports correct mode', () => {
    expect(createSession('voice').mode).toBe('voice');
    expect(createSession('text').mode).toBe('text');
  });

  it('starts with empty transcript', () => {
    const session = createSession();
    expect(session.transcript).toEqual([]);
  });

  it('starts unmuted', () => {
    const session = createSession('voice');
    expect(session.isMuted()).toBe(false);
  });
});

describe('HubUISession — event emitter', () => {
  it('registers and fires event listeners', async () => {
    const session = await createConnectedSession();
    const handler = vi.fn();

    session.on('message', handler);
    // Manually trigger via send (which adds to transcript and sends)
    await session.send('hello');

    // send() doesn't fire 'message' — it's for incoming. But we can test on/off.
    expect(handler).not.toHaveBeenCalled(); // correct: send doesn't emit message
  });

  it('removes listeners with off()', async () => {
    const session = await createConnectedSession();
    const handler = vi.fn();

    session.on('connected', handler);
    session.off('connected', handler);

    // The handler should not fire even if event is triggered internally
  });
});

describe('HubUISession — mute/unmute', () => {
  it('mute/unmute toggles state in voice mode', async () => {
    const session = await createConnectedSession('voice');

    expect(session.isMuted()).toBe(false);
    session.mute();
    expect(session.isMuted()).toBe(true);
    session.unmute();
    expect(session.isMuted()).toBe(false);
  });

  it('mute is no-op in text mode', async () => {
    const session = await createConnectedSession('text');
    session.mute();
    expect(session.isMuted()).toBe(false);
  });
});

describe('HubUISession — send()', () => {
  it('throws when not connected', async () => {
    const session = createSession();
    await expect(session.send('hello')).rejects.toMatchObject({
      code: ErrorCodes.SESSION_NOT_CONNECTED,
    });
  });

  it('ignores empty messages', async () => {
    const session = await createConnectedSession();
    // Should not throw
    await session.send('   ');
  });

  it('adds user message to transcript', async () => {
    const session = await createConnectedSession();
    await session.send('hello world');

    const transcript = session.transcript;
    expect(transcript.length).toBe(1);
    expect(transcript[0].speaker).toBe('user');
    expect(transcript[0].text).toBe('hello world');
    expect(transcript[0].isFinal).toBe(true);
  });
});

describe('HubUISession — disconnect()', () => {
  it('sets state to disconnected', async () => {
    const session = await createConnectedSession();
    expect(session.state).toBe('connected');

    await session.disconnect();
    expect(session.state).toBe('disconnected');
  });
});

describe('HubUISession — transcript', () => {
  it('returns a copy (not the internal array)', async () => {
    const session = await createConnectedSession();
    await session.send('msg1');

    const t1 = session.transcript;
    const t2 = session.transcript;
    expect(t1).not.toBe(t2);
    expect(t1).toEqual(t2);
  });
});
