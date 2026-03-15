/**
 * Vercel serverless function.
 * Receives POST from Casa Helper extension (message + imageLinks), sends to Telegram.
 *
 * Env vars (in Vercel): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const TELEGRAM_BASE = 'https://api.telegram.org/bot';
const MEDIA_GROUP_LIMIT = 10;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, body) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    sendJson(res, 500, {
      error: 'Server misconfiguration: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set',
    });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  const { message = '', imageLinks = [] } = body;
  const baseUrl = `${TELEGRAM_BASE}${token}`;

  try {
    if (message && String(message).trim()) {
      const msgRes = await fetch(`${baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: String(message).trim(),
          disable_web_page_preview: true,
        }),
      });
      if (!msgRes.ok) {
        const err = await msgRes.text();
        throw new Error(`sendMessage: ${err}`);
      }
    }

    const validUrls = (Array.isArray(imageLinks) ? imageLinks : [])
      .filter((url) => typeof url === 'string' && url.startsWith('http'));
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

    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error('Telegram send error:', err);
    sendJson(res, 500, { error: err.message || 'Failed to send to Telegram' });
  }
};
