import { describe, it, expect } from 'vitest';
import {
  DEFAULT_API_BASE_URL,
  API_ENDPOINTS,
  DATA_TOPICS,
  DEFAULTS,
  SDK_VERSION,
} from '../src/constants';

describe('constants', () => {
  it('DEFAULT_API_BASE_URL points to production', () => {
    expect(DEFAULT_API_BASE_URL).toBe('https://api.hubui.ai');
  });

  it('API_ENDPOINTS has correct paths', () => {
    expect(API_ENDPOINTS.PUBLIC_TOKEN).toBe('/api/v1/tokens/public');
  });

  it('DATA_TOPICS has chat topic', () => {
    expect(DATA_TOPICS.CHAT).toBe('lk-chat-topic');
  });

  it('DEFAULTS has expected values', () => {
    expect(DEFAULTS.CONNECTION_TIMEOUT).toBe(30000);
    expect(DEFAULTS.MAX_RECONNECT_ATTEMPTS).toBe(3);
    expect(DEFAULTS.USER_NAME).toBe('User');
  });

  it('SDK_VERSION is a valid semver string', () => {
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
