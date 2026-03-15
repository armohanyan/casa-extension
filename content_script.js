/**
 * Scrapes listing data from list.am item page.
 * Returns data only; sending is handled by popup (Telegram or CRM).
 */
function getScrapedData() {
  const bodyEl = document.querySelector('#pcontent > div > div.body');
  const message = bodyEl ? bodyEl.textContent.trim() : '';
  // All images in listing content (gallery can be .p > div > img or nested)
  const contentRoot = document.querySelector('#pcontent');
  const imageLinks = contentRoot
    ? Array.from(contentRoot.querySelectorAll('img'))
        .filter((e) => e.src && !e.src.includes('item'))
        .map((e) => e.src)
    : [];
  // Deduplicate by URL (thumbnails and full-size may repeat)
  const uniqueImageLinks = [...new Set(imageLinks)];
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
