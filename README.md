# @hubui/client

Official JavaScript/TypeScript SDK for [HubUI](https://hubui.ai) — Connect your applications to AI voice and text agents.

**SDK Version: 0.1.0**

[Get Started Free](https://app.hubui.ai) · [Documentation](https://app.hubui.ai/documentation) · [Discord](https://discord.gg/9HZBN6ZeU6)

---

## Why HubUI Client?

If you already have a web app — React, Next.js, Vue, plain HTML — HubUI Client lets you **drop in a real-time voice or text AI agent with a few lines of code**. No WebRTC plumbing. No socket management. No audio handling.

Your users get a real-time conversation with an AI agent — voice with sub-500ms latency, or streaming text chat — and you get a clean event-driven API. Connect, listen for events, done.

> **Building a custom reasoning backend?** Use the [HubUI Brain SDK](https://github.com/HubUI-AI/hubui-brain) (Python) to plug in your own LLM, LangChain, or LangGraph pipeline.

---

## Installation

### From npm (recommended)

```bash
npm install @hubui/client
```

### From GitHub repository

```bash
npm install github:HubUI-AI/hubui-client
```

If your environment requires explicit Git URLs:

```bash
npm install git+https://github.com/HubUI-AI/hubui-client.git
```

## Before You Start

- [Free HubUI account](https://app.hubui.ai) (sign up in seconds)
- Agent created in the [HubUI Dashboard](https://app.hubui.ai)
- API key (`pk_live_...`) from Dashboard > Settings > API Keys
- `agentId` from the Agents page

## Quick Start

### Voice Mode

```typescript
import { HubUI } from '@hubui/client';

// Connect to your agent in voice mode
const session = await HubUI.connect({
  agentId: 'your-agent-id',      // From HubUI Dashboard
  apiKey: 'pk_live_xxxxx',        // From HubUI Dashboard > Settings > API Keys
  mode: 'voice',
  userName: 'John Doe',           // Optional: End user's name
});

// Listen for transcripts
session.on('transcript', (text, speaker, isFinal) => {
  console.log(`${speaker}: ${text}`);
});

// Handle connection state
session.on('connectionStateChanged', (state) => {
  console.log('Connection:', state);
});

// Mute/unmute controls
session.mute();
session.unmute();

// Disconnect when done
await session.disconnect();
```

### Text Mode

```typescript
import { HubUI } from '@hubui/client';

// Connect to your agent in text mode
const session = await HubUI.connect({
  agentId: 'your-agent-id',
  apiKey: 'pk_live_xxxxx',
  mode: 'text',
  userName: 'John Doe',
});

// Listen for agent responses
session.on('message', (text) => {
  console.log('Agent:', text);
});

// Send messages
await session.send('Hello! How can you help me?');

// Disconnect when done
await session.disconnect();
```

## API Reference

### `HubUI.connect(config)`

Connects to a HubUI agent and returns a session.

**Parameters:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `agentId` | `string` | Yes | Your agent ID from the dashboard |
| `apiKey` | `string` | Yes* | Your API key (`pk_live_...`) |
| `token` | `string` | No | Pre-fetched realtime token (advanced usage) |
| `serverUrl` | `string` | No | Realtime server URL (required when `token` is provided) |
| `mode` | `'voice' \| 'text'` | Yes | Connection mode |
| `userName` | `string` | No | End user's display name |
| `userEmail` | `string` | No | End user's email |
| `audioInput` | `string` | No | Audio input device ID |
| `audioOutput` | `string` | No | Audio output device ID |
| `apiBaseUrl` | `string` | No | Custom HubUI API base URL |
| `debug` | `boolean` | No | Enable SDK debug logging (default: `false`) |

**Returns:** `Promise<HubUISession>`

\* `apiKey` is required unless you provide `token` + `serverUrl`.

### `HubUI.getAudioDevices()`

Lists available audio input and output devices.

```typescript
const { inputs, outputs } = await HubUI.getAudioDevices();

console.log('Microphones:', inputs);
console.log('Speakers:', outputs);
```

### `HubUISession`

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | `HubUIConnectionState` | Current connection state |
| `mode` | `'voice' \| 'text'` | Current mode |
| `transcript` | `HubUITranscriptEntry[]` | Full conversation transcript |

#### Methods

| Method | Description |
|--------|-------------|
| `on(event, callback)` | Subscribe to events |
| `off(event, callback)` | Unsubscribe from events |
| `mute()` | Mute microphone (voice mode) |
| `unmute()` | Unmute microphone (voice mode) |
| `isMuted()` | Check if muted |
| `enableAudio()` | Enable audio (required on mobile) |
| `send(message)` | Send text message |
| `setAudioInput(deviceId)` | Change microphone |
| `setAudioOutput(deviceId)` | Change speaker |
| `disconnect()` | End the session |

#### Events

| Event | Callback | Description |
|-------|----------|-------------|
| `connected` | `() => void` | Connected to agent |
| `disconnected` | `() => void` | Disconnected from agent |
| `error` | `(error: HubUIError) => void` | Error occurred |
| `transcript` | `(text, speaker, isFinal) => void` | Voice transcript received |
| `message` | `(text) => void` | Text message received |
| `connectionStateChanged` | `(state) => void` | State changed |
| `audioPlaybackBlocked` | `() => void` | Audio blocked (call `enableAudio()`) |

## Mobile Browser Support

Mobile browsers require a user gesture to play audio. Handle this with:

```typescript
session.on('audioPlaybackBlocked', () => {
  // Show UI prompting user to tap
  showButton('Tap to enable audio', async () => {
    await session.enableAudio();
  });
});
```

## Error Handling

```typescript
import { HubUI, HubUIError, ErrorCodes } from '@hubui/client';

try {
  const session = await HubUI.connect(config);
} catch (error) {
  if (error instanceof HubUIError) {
    switch (error.code) {
      case ErrorCodes.INVALID_API_KEY:
        console.error('Invalid API key');
        break;
      case ErrorCodes.INVALID_AGENT_ID:
        console.error('Agent not found');
        break;
      default:
        console.error('Error:', error.message);
    }
  }
}
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  HubUIConfig,
  HubUIConnectionState,
  HubUITranscriptEntry,
  AudioDevice,
} from '@hubui/client';
```

## Browser Support

- Chrome 70+
- Firefox 65+
- Safari 14+
- Edge 79+

## Support

- **[Read the docs](https://app.hubui.ai/documentation)** — full platform documentation
- **[Join the Discord](https://discord.gg/9HZBN6ZeU6)** — get help, share what you're building
- Email: info@hubui.ai
- Dashboard: https://app.hubui.ai

## License

This software is licensed under the [Apache License 2.0](LICENSE).
