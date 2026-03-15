/**
 * Vercel serverless function.
 * Receives POST from Casa Helper extension (message + imageLinks), sends to Telegram.
 *
 * Env vars (in Vercel): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const TELEGRAM_BASE = 'https://api.telegram.org/bot';
const MEDIA_GROUP_LIMIT = 10;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).setHeader(corsHeaders()).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).setHeader(corsHeaders()).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    res.status(500).setHeader(corsHeaders()).json({
      error: 'Server misconfiguration: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set',
    });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    res.status(400).setHeader(corsHeaders()).json({ error: 'Invalid JSON body' });
    return;
  }

  const { message = '', imageLinks = [] } = body;
  const baseUrl = `${TELEGRAM_BASE}${token}`;

  try {
    if (message.trim()) {
      const msgRes = await fetch(`${baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.trim(),
          disable_web_page_preview: true,
        }),
      });
      if (!msgRes.ok) {
        const err = await msgRes.text();
        throw new Error(`sendMessage: ${err}`);
      }
    }

    const validUrls = imageLinks.filter((url) => typeof url === 'string' && url.startsWith('http'));
    for (let i = 0; i < validUrls.length; i += MEDIA_GROUP_LIMIT) {
      const batch = validUrls.slice(i, i + MEDIA_GROUP_LIMIT);
      const media = batch.map((url) => ({ type: 'photo', media: url }));

      const mediaRes = await fetch(`${baseUrl}/sendMediaGroup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, media }),
      });

      if (!mediaRes.ok) {
        const err = await mediaRes.text();
        throw new Error(`sendMediaGroup: ${err}`);
      }
    }

    res.status(200).setHeader(corsHeaders()).json({ success: true });
  } catch (err) {
    console.error('Telegram send error:', err);
    res.status(500).setHeader(corsHeaders()).json({
      error: err.message || 'Failed to send to Telegram',
    });
  }
};
