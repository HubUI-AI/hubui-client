import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock livekit-client before importing HubUI (it imports Room transitively)
vi.mock('livekit-client', () => {
  const createMockRoom = () => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    localParticipant: {
      identity: 'local',
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
  });

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

import { HubUI } from '../src/HubUI';
import { HubUIError, ErrorCodes } from '../src/errors';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HubUI.connect — config validation', () => {
  it('rejects missing config', async () => {
    // @ts-expect-error testing invalid input
    await expect(HubUI.connect(null)).rejects.toThrow(HubUIError);
    // @ts-expect-error testing invalid input
    await expect(HubUI.connect(null)).rejects.toMatchObject({ code: ErrorCodes.INVALID_CONFIG });
  });

  it('rejects missing agentId', async () => {
    await expect(
      // @ts-expect-error testing invalid input
      HubUI.connect({ apiKey: 'pk_live_abc123', mode: 'voice' })
    ).rejects.toMatchObject({ code: ErrorCodes.MISSING_AGENT_ID });
  });

  it('rejects missing apiKey when no token provided', async () => {
    await expect(
      // @ts-expect-error testing invalid input
      HubUI.connect({ agentId: 'agent-1', mode: 'voice' })
    ).rejects.toMatchObject({ code: ErrorCodes.MISSING_API_KEY });
  });

  it('rejects invalid apiKey format', async () => {
    await expect(
      HubUI.connect({ agentId: 'agent-1', apiKey: 'bad_key', mode: 'voice' })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_API_KEY });
  });

  it('rejects invalid mode', async () => {
    await expect(
      // @ts-expect-error testing invalid input
      HubUI.connect({ agentId: 'agent-1', apiKey: 'pk_live_abc123', mode: 'video' })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_MODE });
  });

  it('rejects token without serverUrl', async () => {
    await expect(
      HubUI.connect({ agentId: 'agent-1', token: 'some-token', mode: 'voice' })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_CONFIG });
  });
});

describe('HubUI.connect — token fetch', () => {
  it('calls correct endpoint with config values', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'tok_123', hubui_url: 'wss://rt.hubui.ai', room_name: 'room-1' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await HubUI.connect({
      agentId: 'agent-1',
      apiKey: 'pk_live_abc123',
      mode: 'text',
      userName: 'Test User',
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.hubui.ai/api/v1/tokens/public');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body);
    expect(body.api_key).toBe('pk_live_abc123');
    expect(body.agent_id).toBe('agent-1');
    expect(body.mode).toBe('text');
    expect(body.user_name).toBe('Test User');
  });

  it('uses custom apiBaseUrl when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'tok', hubui_url: 'wss://rt.hubui.ai', room_name: 'r' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await HubUI.connect({
      agentId: 'agent-1',
      apiKey: 'pk_live_abc123',
      mode: 'text',
      apiBaseUrl: 'https://custom.api.example.com',
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://custom.api.example.com/api/v1/tokens/public');
  });

  it('throws INVALID_API_KEY on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Invalid key' }),
    }));

    await expect(
      HubUI.connect({ agentId: 'a', apiKey: 'pk_live_abc', mode: 'voice' })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_API_KEY });
  });

  it('throws INVALID_AGENT_ID on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'Not found' }),
    }));

    await expect(
      HubUI.connect({ agentId: 'a', apiKey: 'pk_live_abc', mode: 'voice' })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_AGENT_ID });
  });

  it('throws NETWORK_ERROR on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      HubUI.connect({ agentId: 'a', apiKey: 'pk_live_abc', mode: 'voice' })
    ).rejects.toMatchObject({ code: ErrorCodes.NETWORK_ERROR });
  });

  it('skips token fetch when token + serverUrl provided', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await HubUI.connect({
      agentId: 'agent-1',
      token: 'pre-fetched-token',
      serverUrl: 'wss://rt.hubui.ai',
      mode: 'text',
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('HubUI.connect — session creation', () => {
  it('returns a session object with correct mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'tok', hubui_url: 'wss://rt.hubui.ai', room_name: 'r' }),
    }));

    const session = await HubUI.connect({
      agentId: 'agent-1',
      apiKey: 'pk_live_abc123',
      mode: 'text',
    });

    expect(session).toBeDefined();
    expect(session.mode).toBe('text');
    expect(session.state).toBe('connected');
    expect(typeof session.on).toBe('function');
    expect(typeof session.off).toBe('function');
    expect(typeof session.send).toBe('function');
    expect(typeof session.disconnect).toBe('function');
  });
});
