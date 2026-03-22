# Casa Helper

This repository is split so you can ship **only what you need**:

| Folder | What it is |
|--------|------------|
| **`browser-extension/`** | Chrome extension — in Chrome, “Load unpacked” = select **this folder**. To publish, zip it (omit `node_modules/` if present; it is only for optional webpack tooling). |
| **`telegram-server/`** | Vercel serverless API for Telegram — deploy with **Root Directory** = `telegram-server`. |
