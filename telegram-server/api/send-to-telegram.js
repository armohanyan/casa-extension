/**
 * Vercel serverless function.
 * Receives POST from Casa Helper extension (message + imageLinks), sends to Telegram.
 * Listing photos are cropped (top strip) to remove the site watermark before upload.
 *
 * Env vars (in Vercel): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

const sharp = require('sharp');

const TELEGRAM_BASE = 'https://api.telegram.org/bot';
const MEDIA_GROUP_LIMIT = 10;
/** Fraction of height removed from the top (watermark sits in the top band). */
const WATERMARK_CROP_TOP_RATIO = 0.09;

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

/**
 * Fetch image, crop top strip where list.am-style watermark appears, return JPEG buffer.
 * On failure returns null so caller can fall back to the original URL.
 */
async function fetchAndCropListingPhoto(imageUrl) {
  const res = await fetch(imageUrl, {
    headers: { 'User-Agent': 'CasaHelper/1.0' },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  try {
    const img = sharp(buf);
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return null;
    const cropTop = Math.max(1, Math.round(meta.height * WATERMARK_CROP_TOP_RATIO));
    if (meta.height - cropTop < 32) return null;
    return await img
      .extract({
        left: 0,
        top: cropTop,
        width: meta.width,
        height: meta.height - cropTop,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    console.warn('crop skipped for', imageUrl, e.message || e);
    return null;
  }
}

/**
 * Send a batch of photos via sendMediaGroup. Cropped buffers use multipart attach://;
 * failed crops fall back to original HTTPS URLs.
 */
async function sendMediaGroupMultipart(baseUrl, chatId, urls) {
  const media = [];
  const form = new FormData();
  form.append('chat_id', String(chatId));

  let attachIdx = 0;
  for (const url of urls) {
    const cropped = await fetchAndCropListingPhoto(url);
    if (cropped) {
      const name = `photo${attachIdx}`;
      media.push({ type: 'photo', media: `attach://${name}` });
      form.append(name, new Blob([cropped]), `${name}.jpg`);
      attachIdx += 1;
    } else {
      media.push({ type: 'photo', media: url });
    }
  }

  form.append('media', JSON.stringify(media));

  const mediaRes = await fetch(`${baseUrl}/sendMediaGroup`, {
    method: 'POST',
    body: form,
  });

  if (!mediaRes.ok) {
    const err = await mediaRes.text();
    throw new Error(`sendMediaGroup: ${err}`);
  }
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
      await sendMediaGroupMultipart(baseUrl, chatId, batch);
    }

    sendJson(res, 200, { success: true });
  } catch (err) {
    console.error('Telegram send error:', err);
    sendJson(res, 500, { error: err.message || 'Failed to send to Telegram' });
  }
};
