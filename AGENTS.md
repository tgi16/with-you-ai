# AGENTS.md

## Purpose
This file defines how agents should execute work in this repository.
Priorities: correctness, minimal diffs, and verifiable results.

## Project Notes (with-you-ai)
- UI: `/Users/Sailao/Documents/GitHub/with-you-ai/index.html`
- Generate API (Gemini): `/Users/Sailao/Documents/GitHub/with-you-ai/api/generate.js`
- Publish API (Facebook Graph): `/Users/Sailao/Documents/GitHub/with-you-ai/api/publish.js`

### Environment Variables
- `GEMINI_API_KEY` (required for `/api/generate`)
- `FACEBOOK_PAGE_ID` (required for `/api/publish` with `platform=facebook`)
- `FACEBOOK_PAGE_ACCESS_TOKEN` (required for `/api/publish` with `platform=facebook`)

## Standard Workflows

### 1) Quick Change Workflow
1. Inspect repo state (`git status --short`, `rg --files`).
2. Locate target code (`rg "<pattern>"`).
3. Make the smallest possible change to satisfy the request.
4. Run relevant checks (at minimum: basic syntax/sanity and smoke test).
5. Summarize edits with file paths and what was verified.

### 2) Feature Workflow
1. Confirm acceptance criteria from the user request.
2. Identify impacted files and interfaces.
3. Implement in small, reviewable steps.
4. Add or update tests if the repo has a test harness; otherwise add a manual test checklist.
5. Validate behavior end-to-end before handoff.

### 3) Bugfix Workflow
1. Reproduce or isolate the failure.
2. Patch root cause (not just symptoms).
3. Add regression coverage where possible.
4. Run focused checks first, then broader checks.
5. Document behavior change and risk notes in handoff.

## Command Matrix

### Repository Discovery
- List files: `rg --files`
- Find text: `rg "<pattern>"`
- Show status: `git status --short`
- Show diff: `git diff -- <path>`

### Local Smoke (No Tooling Assumed)
- Search API routes usage: `rg -n \"api/generate|api/publish\" index.html api -S`

## Change Guardrails
- Never run destructive git commands (`git reset --hard`, `git checkout --`) unless explicitly requested.
- Do not revert unrelated local changes.
- Keep commits and diffs focused on the user request.

## FB Copywriting (API) - Human Tone + Booking Intent
ဒီ project ထဲက `/api/generate` ကို caption/content generate လုပ်ရာမှာ “စက်ရုပ်ပုံစံ” မပေါက်အောင် prompt + output format ကိုတင်းကျပ်စွာသတ်မှတ်ပါ။

### Prompt Pack (Recommended)
System message (တစ်ခါတည်းထား):
- You are a Myanmar FB copywriter for a local photo studio in Taunggyi. Write natural Burmese with short lines. Avoid corporate tone and buzzwords. Be specific. Ask exactly one question. Include exactly one soft CTA to DM. No emojis unless requested. No hashtags unless requested.

User message (post တစ်ခုချင်းစီ):
- Studio type: (portrait/couple/wedding/graduation/product)
- Target audience: (city + age range + intent)
- Offer/slot: (mini session, weekday slots, seasonal)
- Proof: (delivery days, review summary, client count - only true info)
- Constraints: (120-220 words, short lines, one question, one CTA: DM 'BOOK')
- Output: JSON with fields `hook`, `caption`, `cta`, `hashtags` (hashtags optional)

### Anti-Robotic Checklist
- “ကျွန်ုပ်တို့၏ ဝန်ဆောင်မှု…” လို corporate opening မသုံးပါနဲ့။
- အထွေထွေစကား (“အကောင်းဆုံး/အထူးကောင်း/အံ့သြဖွယ်”) ကိုလျော့ပါ။
- Bullet list အလွန်ရှည်မရေးပါနဲ့ (FB caption အတွက် line breaks ပိုသုံး)။
- CTA ကိုတိတိကျကျ (DM keyword + ဘာအချက်အလက်ပြောရမလဲ) ထည့်ပါ။

### Caption Templates (Copy-Safe)
Template A (Portrait):
- "Pose မတတ်ဘူးဆိုပြီး စိတ်မပူပါနဲ့။
Shoot အတွင်းမှာ လက်/မျက်နှာ/ခန္ဓာကိုယ် pose ကို တစ်ချက်ချင်း လမ်းညွှန်ပေးမယ်။
သင့် vibe အတိုင်း natural ဖြစ်အောင်ပဲ ရိုက်ပေးချင်တယ်။
ဒီအပတ် slot နည်းနည်းပဲကျန်တယ်။
DM 'BOOK' လို့ပို့ပြီး date/time/style ပြောပေးပါ။
မင်း portrait ကို ဘယ် vibe နဲ့လိုချင်လဲ (natural / glam)?"

Template B (Couple):
- "Couple photo ဆိုတာ pose ထက် moment ကပိုအရေးကြီးတယ်။
စကားပြောရင်း/ရယ်ရင်းကနေ အလှဆုံး frame ထွက်လာတတ်တယ်။
အေးအေးဆေးဆေး direction ပေးမယ်၊ မ awkward ဖြစ်အောင်လုပ်ပေးမယ်။
DM 'BOOK' လို့ပို့ပြီး date + location/style ပြောပေးပါ။
မင်းတို့ couple vibe က ဘယ်လိုမျိုး (sweet / cinematic)?"

Template C (Product/Business):
- "ပစ္စည်းကောင်းတာတစ်ချက်၊ ပုံကောင်းတာက ရောင်းအားကို တစ်ချက်တင်ပြောင်းတတ်တယ်။
အလင်းမညီ/အရောင်မတိမကျတဲ့ပုံတွေကို clean, consistent ဖြစ်အောင် setup လုပ်ပေးမယ်။
DM 'PRICE' လို့ပို့လိုက်ရင် package နဲ့ available dates ပို့ပေးမယ်။
မင်းရောင်းချင်တဲ့ product က ဘာအမျိုးအစားလဲ?"

### Cost/Rate Notes (Image Optional)
Image ကို “file size compression” လုပ်တာတင်နဲ့ cost/rate အရမ်းမကျသေးတတ်ပါ။ အများအားဖြင့် request complexity နဲ့ image count/dimensions ပေါ်မူတည်ပါတယ်။
Best practice pipeline:
1. (လိုအပ်မှ) Vision call 1 ခေါက်နဲ့ photo summary (mood/style/scene) ထုတ်။
2. Caption variants ကို text-only calls နဲ့ generate (မြန်၊ သက်သာ)။

Cost/Rate သုံးသပ်ရန် မဖြစ်မနေလိုတဲ့ input 3 ခု:
1. Model name (ဥပမာ `gemini-2.5-flash`)
2. Posts per day (တစ်နေ့ generate မယ့် post အရေအတွက်)
3. Images per post (တစ် post ကို API ထဲပို့မယ့် ပုံအရေအတွက်)

## 7 Day Growth Plan (Photo Studio Specific) - Facebook Algorithm Re-Activation
Goal: Page reach/engagement ျပန္တက်လာအောင် “consistent, native, high-retention content” နဲ့ ၇ ရက်အတွင်း signal အသစ်ပြန်တင်ပေးခြင်း။

### Re-Activation Rules (Must Follow)
- 7 ရက်အတွင်း “နေ့စဉ် တစ်ကြိမ်” (အနည်းဆုံး 1 post/day) ကိုတိတိကျကျ ထိန်းထားပါ။
- Link ထည့်ပြီး platform အပြင်ထွက်ခိုင်းတဲ့ post (website link) ကို 7 ရက်လောက်လျော့/ရှောင်ပါ။ Booking ကို DM/Call-to-Action (CTA) နဲ့ပဲ ခေါ်ပါ။
- Same content ကို copy/paste (နာရီတိုတိုအတွင်း ထပ်တင်) မလုပ်ပါနဲ့။
- Post မတင်ခင် 15 မိနစ် + တင်ပြီး 30 မိနစ်: comment/DM ပြန်၊ genuine engagement လုပ်ပါ (spam မလုပ်ပါနဲ့)။
- Reels: 2-3 sec hook, subtitles, 6-20 sec သို့ 20-45 sec BTS လိုမျိုး retention ကောင်းအောင်။
- “Hard sell” မကာလတောင် မလုပ်ပါနဲ့။ 80% value/trust, 20% offer လိုမျိုး။

### Content Pillars (Photo Studio)
- Portfolio: best shots, carousel
- BTS: lighting setup, posing direction, retouch workflow
- Proof: client testimonial/review (permission ရှိရင်)
- Education: outfit/pose tips, shoot prep
- Offer: package/slots/seasonal promo (soft CTA)

### 7-Day Posting Plan (What to Post Each Day)
Recommended window: 7-9pm ကိုစပြီး Facebook Insights နဲ့ပြန်ညှိပါ။

Day 1 (Re-Introduce + Trust)
- Post: Carousel (5-10) “Best of last season” + short story + CTA: DM 'BOOK'
- Story: studio tour + availability poll
- Prompt: A/B preference question

Day 2 (BTS Reel)
- Post: Reel 10-25 sec “1 setup, 3 looks”
- Story: Q&A sticker (pose/outfit)

Day 3 (Before/After Retouch)
- Post: Carousel (before/after) + natural retouch policy
- Story: slider “natural vs glam”

Day 4 (Client Proof + Review)
- Post: review/quote card + delivery timeline

Day 5 (Education Post)
- Post: “Shoot day checklist (5 items)”

Day 6 (Mini Offer + Scarcity)
- Post: “Weekend mini-session” (deliverables + rules + CTA)

Day 7 (Live/BTS + Booking Push)
- Post: Live 10-15 min (setup/Q&A) or recap reel
- Story: countdown sticker “Next week slots”

### Daily Engagement Checklist (Repeat Every Day)
- Comment reply 1-2 hours အတွင်း (first 30 mins အရေးကြီး)
- DM inquiry ကို template နဲ့ချက်ချင်းပြန်
- Local pages/communities genuine comment 10 mins (no link drop)
- Story အနည်းဆုံး 1 ခု (poll/slider/Q&A)

### Simple Metrics (Track for 7 Days)
- Reach, 3-sec views, avg watch time (Reels)
- Shares + Saves
- Comments + DMs
- Confirmed bookings

