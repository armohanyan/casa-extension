# Casa Helper — Թելեգրամ ուղարկում (սեփական սերվեր)

Քանի որ հին սերվերին (tg.sandia.site) հասանելիություն չունեք, կարող եք մի քանի րոպեում բացել սեփական handler և extension-ը կուղարկի տվյալներ ու **բոլոր** նկարները Թելեգրամ։

## 1. Ստեղծել Թելեգրամ բոտ և ստանալ token

1. Թելեգրամում բացեք [@BotFather](https://t.me/BotFather)։
2. Ուղարկեք `/newbot` և հետևեք հրահանգներին (անուն, username)։
3. BotFather կտա **token** (օր. `123456789:ABCdefGHI...`) — պահեք այն։

## 2. Ստանալ Chat ID (ո՞ւր ուղարկել)

- **Ձեզ** ուղարկելու համար: Թելեգրամում բացեք [@userinfobot](https://t.me/userinfobot), սկսեք (Start), նա կցույց տա ձեր **Id** — դա ձեր `TELEGRAM_CHAT_ID`-ն է։
- **Խմբի/ալիքի** համար: Ավելացրեք ձեր բոտը խմբին/ալիքին, ապա օգտագործեք [@userinfobot](https://t.me/userinfobot) կամ [@getidsbot](https://t.me/getidsbot) խմբում — ստացված ID-ն (հաճախ բացասական, օր. `-1001234567890`) կլինի `TELEGRAM_CHAT_ID`։

## 3. Deploy Vercel-ում (միայն Node server-ը, ոչ ամբողջ extension-ը)

1. Գրանցվեք [vercel.com](https://vercel.com) (GitHub-ով արագ է)։
2. **Add New** → **Project** → **Import** արեք այս repo-ն։
3. **Կարևոր:** **Root Directory** դրեք **`telegram-server`** (ոչ repo-ի root):  
   Settings → General → Root Directory → `telegram-server` → Save.  
   Այդպես Vercel-ը կdeploy-ի միայն Node server-ը, **npm run build** չի թողնի ամբողջ extension-ի համար։
4. **Settings** → **Environment Variables** — ավելացրեք:
   - `TELEGRAM_BOT_TOKEN` = ձեր բոտի token (BotFather-ից)
   - `TELEGRAM_CHAT_ID` = chat/channel ID (userinfobot/getidsbot-ից)
5. **Deploy** (կամ Redeploy): build-ը կանցնի, որովհետև `telegram-server`-ում dependencies/build չկա։

Deploy-ից հետո URL-ը կլինի մոտավորապես այսպիսին:
`https://your-project-name.vercel.app/api/send-to-telegram`

## 4. Extension-ում մուտքագրել URL

1. Բացեք extension-ի popup-ը։
2. **«Թելեգրամ API հասցե»** դաշտում մուտքագրեք ձեր Vercel URL-ը, օրինակ:
   `https://your-project-name.vercel.app/api/send-to-telegram`
3. Սեղմեք **«Ուղարկել Թելեգրամ»** — extension-ը կուղարկի տեքստը և **բոլոր** list.am-ի property նկարները Թելեգրամ (նախ տեքստ, ապա նկարների ալբոմներ)։

## Այլընտրանք — այլ host

Եթե Vercel չեք օգտագործում, կարող եք `telegram-server/api/send-to-telegram.js` logic-ը տեղափոխել ձեր Node.js/Express, Netlify Function, Cloudflare Worker և այլն: Պահանջը — POST body `{ message, imageLinks }` և env-ում `TELEGRAM_BOT_TOKEN` ու `TELEGRAM_CHAT_ID`:
