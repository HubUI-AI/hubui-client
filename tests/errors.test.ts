import { describe, it, expect } from 'vitest';
import { HubUIError, ErrorCodes, createError, wrapError } from '../src/errors';

describe('HubUIError', () => {
  it('creates error with message and default code', () => {
    const err = new HubUIError('something broke');
    expect(err.message).toBe('something broke');
    expect(err.code).toBe('HUBUI_ERROR');
    expect(err.name).toBe('HubUIError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HubUIError);
  });

  it('creates error with custom code', () => {
    const err = new HubUIError('bad key', 'INVALID_API_KEY');
    expect(err.message).toBe('bad key');
    expect(err.code).toBe('INVALID_API_KEY');
  });
});

describe('ErrorCodes', () => {
  it('has all expected error codes', () => {
    expect(ErrorCodes.CONNECTION_FAILED).toBe('CONNECTION_FAILED');
    expect(ErrorCodes.INVALID_API_KEY).toBe('INVALID_API_KEY');
    expect(ErrorCodes.MISSING_AGENT_ID).toBe('MISSING_AGENT_ID');
    expect(ErrorCodes.MISSING_API_KEY).toBe('MISSING_API_KEY');
    expect(ErrorCodes.INVALID_MODE).toBe('INVALID_MODE');
    expect(ErrorCodes.INVALID_CONFIG).toBe('INVALID_CONFIG');
    expect(ErrorCodes.SESSION_NOT_CONNECTED).toBe('SESSION_NOT_CONNECTED');
    expect(ErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(ErrorCodes.TOKEN_FETCH_FAILED).toBe('TOKEN_FETCH_FAILED');
    expect(ErrorCodes.UNKNOWN).toBe('UNKNOWN');
  });
});

describe('createError', () => {
  it('creates HubUIError with specified code', () => {
    const err = createError('test message', ErrorCodes.INVALID_API_KEY);
    expect(err).toBeInstanceOf(HubUIError);
    expect(err.message).toBe('test message');
    expect(err.code).toBe('INVALID_API_KEY');
  });
});

describe('wrapError', () => {
  it('returns HubUIError unchanged', () => {
    const original = new HubUIError('original', 'INVALID_API_KEY');
    const wrapped = wrapError(original);
    expect(wrapped).toBe(original);
  });

  it('wraps standard Error with UNKNOWN code', () => {
    const err = wrapError(new Error('native error'));
    expect(err).toBeInstanceOf(HubUIError);
    expect(err.message).toBe('native error');
    expect(err.code).toBe('UNKNOWN');
  });

  it('wraps string with UNKNOWN code', () => {
    const err = wrapError('string error');
    expect(err).toBeInstanceOf(HubUIError);
    expect(err.message).toBe('string error');
    expect(err.code).toBe('UNKNOWN');
  });

  it('wraps non-error objects', () => {
    const err = wrapError(42);
    expect(err).toBeInstanceOf(HubUIError);
    expect(err.message).toBe('42');
    expect(err.code).toBe('UNKNOWN');
  });
});
