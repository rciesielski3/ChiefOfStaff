import {
  sendTelegram,
  sendTelegramHTML,
  sendTelegramMarkdown,
  sendTelegramMock,
  TelegramResponse
} from '../../src/business-logic/telegram';

// Mock the global fetch API
global.fetch = jest.fn();

describe('sendTelegram', () => {
  const mockToken = 'test-bot-token-12345';
  const mockChatId = '123456789';
  const mockMessage = 'Test message';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send message successfully with default Markdown parse mode', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegram(mockMessage, mockToken, mockChatId);

    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.telegram.org/bot${mockToken}/sendMessage`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  it('should throw error on empty token', async () => {
    await expect(sendTelegram(mockMessage, '', mockChatId)).rejects.toThrow(
      'Missing TELEGRAM_BOT_TOKEN'
    );
  });

  it('should throw error on whitespace-only token', async () => {
    await expect(sendTelegram(mockMessage, '   ', mockChatId)).rejects.toThrow(
      'Missing TELEGRAM_BOT_TOKEN'
    );
  });

  it('should throw error on empty chat ID', async () => {
    await expect(sendTelegram(mockMessage, mockToken, '')).rejects.toThrow(
      'Missing TELEGRAM_CHAT_ID'
    );
  });

  it('should throw error on whitespace-only chat ID', async () => {
    await expect(sendTelegram(mockMessage, mockToken, '   ')).rejects.toThrow(
      'Missing TELEGRAM_CHAT_ID'
    );
  });

  it('should throw error on empty message', async () => {
    await expect(sendTelegram('', mockToken, mockChatId)).rejects.toThrow(
      'Message cannot be empty'
    );
  });

  it('should throw error on whitespace-only message', async () => {
    await expect(sendTelegram('   ', mockToken, mockChatId)).rejects.toThrow(
      'Message cannot be empty'
    );
  });

  it('should handle HTML parse mode', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegram(mockMessage, mockToken, mockChatId, 'HTML');

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const payload = JSON.parse(callArgs.body);

    expect(payload.parse_mode).toBe('HTML');
  });

  it('should handle MarkdownV2 parse mode', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegram(mockMessage, mockToken, mockChatId, 'MarkdownV2');

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const payload = JSON.parse(callArgs.body);

    expect(payload.parse_mode).toBe('MarkdownV2');
  });

  it('should include disable_web_page_preview in payload', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegram(mockMessage, mockToken, mockChatId);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const payload = JSON.parse(callArgs.body);

    expect(payload.disable_web_page_preview).toBe(false);
  });

  it('should handle Telegram API 400 error', async () => {
    const mockResponse: TelegramResponse = {
      ok: false,
      error_code: 400,
      description: 'Bad Request: message text is empty'
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await expect(sendTelegram(mockMessage, mockToken, mockChatId)).rejects.toThrow(
      'Telegram API error (400): Bad Request: message text is empty'
    );
  });

  it('should handle Telegram API 401 error', async () => {
    const mockResponse: TelegramResponse = {
      ok: false,
      error_code: 401,
      description: 'Unauthorized: invalid bot token'
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await expect(sendTelegram(mockMessage, mockToken, mockChatId)).rejects.toThrow(
      'Telegram API error (401): Unauthorized: invalid bot token'
    );
  });

  it('should handle Telegram API 500 error', async () => {
    const mockResponse: TelegramResponse = {
      ok: false,
      error_code: 500,
      description: 'Internal Server Error'
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await expect(sendTelegram(mockMessage, mockToken, mockChatId)).rejects.toThrow(
      'Telegram API error (500): Internal Server Error'
    );
  });

  it('should handle network fetch error', async () => {
    const fetchError = new Error('Network error');
    (global.fetch as jest.Mock).mockRejectedValueOnce(fetchError);

    await expect(sendTelegram(mockMessage, mockToken, mockChatId)).rejects.toThrow(
      'Failed to send Telegram message: Network error'
    );
  });

  it('should handle JSON parse error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON'))
    });

    await expect(sendTelegram(mockMessage, mockToken, mockChatId)).rejects.toThrow(
      'Failed to send Telegram message'
    );
  });

  it('should construct correct API URL', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegram(mockMessage, mockToken, mockChatId);

    const expectedUrl = `https://api.telegram.org/bot${mockToken}/sendMessage`;
    expect(global.fetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.any(Object)
    );
  });

  it('should send correct payload structure', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegram(mockMessage, mockToken, mockChatId);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const payload = JSON.parse(callArgs.body);

    expect(payload).toEqual({
      chat_id: mockChatId,
      text: mockMessage,
      parse_mode: 'Markdown',
      disable_web_page_preview: false
    });
  });
});

describe('sendTelegramHTML', () => {
  const mockToken = 'test-bot-token-12345';
  const mockChatId = '123456789';
  const mockMessage = '<b>Bold Message</b>';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should send message with HTML parse mode', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegramHTML(mockMessage, mockToken, mockChatId);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const payload = JSON.parse(callArgs.body);

    expect(payload.parse_mode).toBe('HTML');
  });
});

describe('sendTelegramMarkdown', () => {
  const mockToken = 'test-bot-token-12345';
  const mockChatId = '123456789';
  const mockMessage = '**Bold Message**';

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should send message with Markdown parse mode', async () => {
    const mockResponse: TelegramResponse = {
      ok: true,
      result: {
        message_id: 12345,
        chat: { id: 123456789 },
        text: mockMessage
      }
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await sendTelegramMarkdown(mockMessage, mockToken, mockChatId);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
    const payload = JSON.parse(callArgs.body);

    expect(payload.parse_mode).toBe('Markdown');
  });
});

describe('sendTelegramMock', () => {
  const mockToken = 'test-bot-token-12345';
  const mockChatId = '123456789';
  const mockMessage = 'This is a test message for mock mode';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log mock message without calling fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch' as any);

    await sendTelegramMock(mockMessage, mockToken, mockChatId);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
  });

  it('should log partial token for security', async () => {
    await sendTelegramMock(mockMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const tokenLogLine = calls.find((call: string) => call.includes('Token:'));

    expect(tokenLogLine).toContain('test-bot-t');
    expect(tokenLogLine).toContain('...');
  });

  it('should log chat ID', async () => {
    await sendTelegramMock(mockMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const chatLogLine = calls.find((call: string) => call.includes('Chat:'));

    expect(chatLogLine).toContain(mockChatId);
  });

  it('should log message length', async () => {
    await sendTelegramMock(mockMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const lengthLogLine = calls.find((call: string) => call.includes('Message length:'));

    expect(lengthLogLine).toContain(`${mockMessage.length} chars`);
  });

  it('should log first 500 chars of message', async () => {
    const shortMessage = 'Short message';
    await sendTelegramMock(shortMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const messageLogged = calls.some((call: string) => call === shortMessage);

    expect(messageLogged).toBe(true);
  });

  it('should truncate message longer than 500 chars', async () => {
    const longMessage = 'A'.repeat(600);
    await sendTelegramMock(longMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const truncatedLine = calls.find((call: string) => call.includes('truncated'));

    expect(truncatedLine).toBe('... (truncated)');
  });

  it('should not truncate message shorter than 500 chars', async () => {
    const shortMessage = 'Short test message';
    await sendTelegramMock(shortMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const truncatedLine = calls.find((call: string) => call.includes('truncated'));

    expect(truncatedLine).toBeUndefined();
  });

  it('should include separator lines in output', async () => {
    await sendTelegramMock(mockMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const separators = calls.filter((call: string) => call === '---');

    expect(separators.length).toBeGreaterThanOrEqual(2);
  });

  it('should include Telegram Mock label', async () => {
    await sendTelegramMock(mockMessage, mockToken, mockChatId);

    const calls = (console.log as jest.Mock).mock.calls.flat();
    const hasMockLabel = calls.some((call: string) => call.includes('[Telegram Mock]'));

    expect(hasMockLabel).toBe(true);
  });
});
