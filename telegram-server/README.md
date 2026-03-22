# Casa Telegram Server

Small **Node server** (no app build). Receives data from the Casa Helper extension and sends it to Telegram.

- **Extension** → POST to this server (`message` + `imageLinks`)
- **This server** → Telegram Bot API (sendMessage + sendMediaGroup)

## Deploy to Vercel (only this folder)

1. Go to [vercel.com](https://vercel.com) → Add New → Project → Import your repo.
2. **Important:** In project settings, set **Root Directory** to **`telegram-server`** (not the repo root).
3. Add environment variables:
   - `TELEGRAM_BOT_TOKEN` (from @BotFather)
   - `TELEGRAM_CHAT_ID` (from @userinfobot or your channel/group)
4. Deploy.

Your URL will be: `https://your-project.vercel.app/api/send-to-telegram`

Paste that URL in the extension’s “Թելեգրամ API հասցե” field.

Vercel runs `npm install` on deploy (`sharp` is used to crop listing watermarks off photos before sending).
