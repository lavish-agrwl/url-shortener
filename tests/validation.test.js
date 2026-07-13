const { parseShortenRequest, safeParseShortenRequest } = require('../src/validation/shortenRequest');

describe('Shorten request validation', () => {
  test('valid request parses correctly', () => {
    const input = {
      url: 'https://example.com/path',
      customSlug: 'my-slug',
      expiresAt: '2026-12-31',
    };
    const result = parseShortenRequest(input);
    expect(result.url).toBe(input.url);
    expect(result.customSlug).toBe(input.customSlug);
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  test('invalid URL throws ZodError', () => {
    const input = { url: 'not-a-url' };
    expect(() => parseShortenRequest(input)).toThrow();
  });

  test('invalid protocol throws ZodError', () => {
    const input = { url: 'ftp://example.com' };
    expect(() => parseShortenRequest(input)).toThrow();
  });

  test('invalid custom slug throws ZodError', () => {
    const input = { url: 'https://example.com', customSlug: '!!!' };
    expect(() => parseShortenRequest(input)).toThrow();
  });

  test('safeParse returns success flag', () => {
    const { success, data } = safeParseShortenRequest({ url: 'https://example.com' });
    expect(success).toBe(true);
    expect(data.url).toBe('https://example.com');
  });
});
