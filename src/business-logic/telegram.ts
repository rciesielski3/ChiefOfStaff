/**
 * Send a message to Telegram via Bot API
 *
 * Algorithm:
 * 1. Validate inputs (token, chat ID, message)
 * 2. Call Telegram Bot API sendMessage endpoint
 * 3. Parse response and verify success
 * 4. Return success or throw error
 *
 * Uses: https://core.telegram.org/bots/api#sendmessage
 */

export interface TelegramResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat: { id: number };
    text: string;
  };
  error_code?: number;
  description?: string;
}

/**
 * Send a message to Telegram
 *
 * @param message - Message text to send
 * @param botToken - Telegram bot token (from @BotFather)
 * @param chatId - Chat ID to send to (negative for groups)
 * @param parseMode - Message format: 'HTML', 'Markdown', or plain text (default: plain)
 * @throws Error if API call fails or validation fails
 */
export async function sendTelegram(
  message: string,
  botToken: string,
  chatId: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'Markdown'
): Promise<void> {
  // Validate inputs
  if (!botToken || botToken.trim() === '') {
    throw new Error('Missing TELEGRAM_BOT_TOKEN');
  }
  if (!chatId || chatId.trim() === '') {
    throw new Error('Missing TELEGRAM_CHAT_ID');
  }
  if (!message || message.trim() === '') {
    throw new Error('Message cannot be empty');
  }

  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: parseMode,
    disable_web_page_preview: false
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as TelegramResponse;

    if (!data.ok) {
      throw new Error(
        `Telegram API error (${data.error_code}): ${data.description}`
      );
    }

    console.log(
      `[Telegram] Message sent successfully. Message ID: ${data.result?.message_id}`
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to send Telegram message: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Send a message to Telegram with HTML formatting
 * Convenience wrapper for HTML parse mode
 */
export async function sendTelegramHTML(
  message: string,
  botToken: string,
  chatId: string
): Promise<void> {
  await sendTelegram(message, botToken, chatId, 'HTML');
}

/**
 * Send a message to Telegram with Markdown formatting
 * Convenience wrapper for Markdown parse mode
 */
export async function sendTelegramMarkdown(
  message: string,
  botToken: string,
  chatId: string
): Promise<void> {
  await sendTelegram(message, botToken, chatId, 'Markdown');
}

/**
 * Mock Telegram send for testing (no actual API call)
 * Useful for dry-run scenarios
 */
export async function sendTelegramMock(
  message: string,
  botToken: string,
  chatId: string
): Promise<void> {
  console.log('[Telegram Mock]');
  console.log(`Token: ${botToken.substring(0, 10)}...`);
  console.log(`Chat: ${chatId}`);
  console.log(`Message length: ${message.length} chars`);
  console.log('---');
  console.log(message.substring(0, 500));
  if (message.length > 500) {
    console.log('... (truncated)');
  }
  console.log('---');
}
