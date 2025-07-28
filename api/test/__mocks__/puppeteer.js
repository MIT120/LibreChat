/**
 * Mock for puppeteer module
 */

const mockPuppeteer = {
  launch: jest.fn(() => Promise.resolve({
    newPage: jest.fn(() => Promise.resolve({
      setUserAgent: jest.fn(() => Promise.resolve()),
      setViewport: jest.fn(() => Promise.resolve()),
      setExtraHTTPHeaders: jest.fn(() => Promise.resolve()),
      goto: jest.fn(() => Promise.resolve({
        ok: () => true,
        status: () => 200,
        statusText: () => 'OK',
        headers: () => ({})
      })),
      evaluate: jest.fn(() => Promise.resolve([])),
      close: jest.fn(() => Promise.resolve())
    })),
    close: jest.fn(() => Promise.resolve())
  }))
};

module.exports = mockPuppeteer;