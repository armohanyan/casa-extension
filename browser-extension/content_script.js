/**
 * Scrapes listing data from list.am item page.
 * Returns data only; sending is handled by popup (Telegram or CRM).
 */
function pickLargestFromSrcset(srcset) {
  if (!srcset || typeof srcset !== 'string') return null;
  // Example: "https://... 320w, https://... 640w"
  const candidates = srcset
    .split(',')
    .map((chunk) => chunk.trim())
    .map((chunk) => {
      const parts = chunk.split(/\s+/).filter(Boolean);
      const url = parts[0];
      const sizeToken = parts[1] || '';
      const widthMatch = sizeToken.match(/^(\d+)w$/);
      const densityMatch = sizeToken.match(/^(\d+(?:\.\d+)?)x$/);
      const score = widthMatch ? Number(widthMatch[1]) : densityMatch ? Number(densityMatch[1]) * 1000 : 0;
      return { url, score };
    })
    .filter((c) => c.url);
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].url || null;
}

function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    return new URL(url, window.location.href).toString();
  } catch {
    return null;
  }
}

function looksLikeImageUrl(url) {
  if (!url) return false;
  // Keep it permissive: some CDNs omit extensions, but most gallery links keep them.
  return /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url) || url.includes('/img/');
}

function extractImagesFromJsonLd() {
  const out = [];
  const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const node of nodes) {
    const text = (node.textContent || '').trim();
    if (!text) continue;
    try {
      const json = JSON.parse(text);
      const stack = Array.isArray(json) ? [...json] : [json];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur) continue;
        if (typeof cur === 'string') continue;
        if (Array.isArray(cur)) {
          for (const v of cur) stack.push(v);
          continue;
        }
        if (cur.image) stack.push(cur.image);
        if (cur.contentUrl) stack.push(cur.contentUrl);
        if (cur.url) stack.push(cur.url);
        for (const v of Object.values(cur)) {
          if (v && typeof v === 'object') stack.push(v);
        }
      }
      // Second pass: collect any string values that look like image URLs.
      const collect = (v) => {
        if (!v) return;
        if (typeof v === 'string') {
          const n = normalizeUrl(v);
          if (n && looksLikeImageUrl(n)) out.push(n);
        } else if (Array.isArray(v)) {
          v.forEach(collect);
        } else if (typeof v === 'object') {
          Object.values(v).forEach(collect);
        }
      };
      collect(json);
    } catch {
      // ignore bad JSON-LD
    }
  }
  return out;
}

function getScrapedData() {
  const bodyEl = document.querySelector('#pcontent > div > div.body');
  const message = bodyEl ? bodyEl.textContent.trim() : '';
  // Try to collect the best-available (usually original / large) image URLs.
  const contentRoot = document.querySelector('#pcontent');

  const imageUrlSet = new Set();

  // 0) Common page-level hints.
  const ogImage = normalizeUrl(document.querySelector('meta[property="og:image"]')?.getAttribute('content'));
  if (ogImage && looksLikeImageUrl(ogImage)) imageUrlSet.add(ogImage);
  const imageSrc = normalizeUrl(document.querySelector('link[rel="image_src"]')?.getAttribute('href'));
  if (imageSrc && looksLikeImageUrl(imageSrc)) imageUrlSet.add(imageSrc);

  for (const url of extractImagesFromJsonLd()) imageUrlSet.add(url);

  if (contentRoot) {
    // 1) Prefer gallery anchors (often point to the "opened" large image).
    for (const a of Array.from(contentRoot.querySelectorAll('a[href]'))) {
      const href = normalizeUrl(a.getAttribute('href'));
      if (href && looksLikeImageUrl(href)) imageUrlSet.add(href);
    }

    // 2) Use best candidate from each <img>.
    for (const img of Array.from(contentRoot.querySelectorAll('img'))) {
      const srcsetPick = pickLargestFromSrcset(img.getAttribute('srcset'));
      const dataPick =
        img.getAttribute('data-src') ||
        img.getAttribute('data-original') ||
        img.getAttribute('data-large') ||
        img.getAttribute('data-full');
      const chosen = normalizeUrl(srcsetPick || dataPick || img.currentSrc || img.src);
      if (chosen && looksLikeImageUrl(chosen)) imageUrlSet.add(chosen);
    }
  }

  const uniqueImageLinks = Array.from(imageUrlSet);
  const pageUrl = window.location.href;

  return {
    message,
    imageLinks: uniqueImageLinks,
    pageUrl,
    title: document.title || '',
  };
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'getInfo') {
    try {
      const data = getScrapedData();
      sendResponse({ success: true, data });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true; // keep channel open for async sendResponse
});
