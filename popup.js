const DEFAULT_TELEGRAM_API_URL = 'https://casa-extension.vercel.app/api/send-to-telegram';

const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');
const btnTelegram = document.getElementById('btnTelegram');
const btnCrm = document.getElementById('btnCrm');
const telegramApiUrlInput = document.getElementById('telegramApiUrl');
const crmUrlInput = document.getElementById('crmUrl');

let scrapedData = null;

function getTelegramApiUrl() {
  const value = (telegramApiUrlInput?.value || '').trim();
  return value || DEFAULT_TELEGRAM_API_URL;
}

function getCrmApiUrl() {
  return (crmUrlInput?.value || '').trim();
}

function showStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = 'status show ' + type;
}

function hideStatus() {
  statusEl.className = 'status';
}

function setLoading(loading) {
  btnTelegram.disabled = loading;
  btnCrm.disabled = loading;
}

function loadData() {
  hideStatus();
  setLoading(true);
  chrome.storage.local.get(['telegramApiUrl', 'crmApiUrl'], (result) => {
    if (telegramApiUrlInput) telegramApiUrlInput.value = result.telegramApiUrl || DEFAULT_TELEGRAM_API_URL;
    if (result.crmApiUrl && crmUrlInput) crmUrlInput.value = result.crmApiUrl;
  });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url || !tab.url.includes('list.am/item')) {
      showStatus('Խնդրում ենք բացել list.am-ի հայտի էջը։', 'info');
      setLoading(false);
      btnTelegram.disabled = true;
      btnCrm.disabled = true;
      return;
    }
    chrome.tabs.sendMessage(tab.id, { action: 'getInfo' }, (response) => {
      setLoading(false);
      if (chrome.runtime.lastError) {
        showStatus('Տվյալները կարդալ չհաջողվեց։ Թարմացրեք էջը։', 'error');
        return;
      }
      if (response?.success && response.data) {
        scrapedData = response.data;
        const snippet = (response.data.message || '').slice(0, 80);
        previewEl.textContent = snippet ? snippet + '…' : 'Տեքստ չի գտնվել';
        previewEl.style.display = 'block';
        btnTelegram.disabled = false;
        btnCrm.disabled = false;
      } else {
        showStatus(response?.error || 'Տվյալներ չեն գտնվել։', 'error');
      }
    });
  });
}

function sendToTelegram() {
  if (!scrapedData) return;
  const apiUrl = getTelegramApiUrl();
  chrome.storage.local.set({ telegramApiUrl: apiUrl });
  setLoading(true);
  showStatus('Ուղարկվում է…', 'info');

  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: scrapedData.message,
      imageLinks: scrapedData.imageLinks || [],
    }),
  })
    .then(async (res) => {
      const text = await res.text();
      let errBody;
      try {
        errBody = text ? JSON.parse(text) : null;
      } catch {
        errBody = null;
      }
      if (res.ok) {
        showStatus('Հաջողությամբ ուղարկվեց Թելեգրամ։', 'success');
      } else {
        const msg = errBody?.error || res.statusText || text || 'Սերվերը պատասխանեց սխալով։';
        showStatus(msg, 'error');
      }
    })
    .catch(() => {
      showStatus('Ցանցի սխալ։ Ստուգեք URL և կրկին փորձեք։', 'error');
    })
    .finally(() => setLoading(false));
}

function sendToCrm() {
  if (!scrapedData) return;
  const crmApiUrl = getCrmApiUrl();
  if (!crmApiUrl) {
    showStatus('Խնդրում ենք մուտքագրել CRM API հասցեն։', 'error');
    return;
  }
  chrome.storage.local.set({ crmApiUrl });
  setLoading(true);
  showStatus('Ուղարկվում է CRM…', 'info');
  fetch(crmApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: scrapedData.message,
      imageLinks: scrapedData.imageLinks,
      pageUrl: scrapedData.pageUrl,
      title: scrapedData.title,
    }),
  })
    .then((res) => {
      if (res.ok) {
        showStatus('Հաջողությամբ պահպանվեց CRM-ում։', 'success');
      } else {
        showStatus('CRM-ը պատասխանեց սխալով։', 'error');
      }
    })
    .catch(() => {
      showStatus('CRM-ին միանալ չհաջողվեց։ Ստուգեք հասցեն։', 'error');
    })
    .finally(() => setLoading(false));
}

btnTelegram.addEventListener('click', sendToTelegram);
btnCrm.addEventListener('click', sendToCrm);

loadData();
