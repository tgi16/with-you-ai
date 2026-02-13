# AGENTS.md

## Purpose
This file defines how agents should execute work in this repository.
Priorities: correctness, minimal diffs, and verifiable results.

## Standard Workflows

### 1) Quick Change Workflow
1. Inspect repo state (`git status --short`, `rg --files`).
2. Locate target code (`rg "<pattern>"`).
3. Make the smallest possible change to satisfy the request.
4. Run relevant checks from the command matrix below.
5. Summarize edits with file paths and what was verified.

### 2) Feature Workflow
1. Confirm acceptance criteria from the user request.
2. Identify impacted files and interfaces.
3. Implement in small, reviewable steps.
4. Add or update tests for new behavior.
5. Run lint, tests, and build/type-check before handoff.

### 3) Bugfix Workflow
1. Reproduce or isolate the failure.
2. Patch root cause (not just symptoms).
3. Add regression coverage where possible.
4. Run focused tests first, then full relevant suite.
5. Document behavior change and risk notes in handoff.

### 4) Review Workflow
1. Prioritize findings by severity: correctness, regressions, test gaps.
2. Cite exact file paths and line numbers for issues.
3. Keep summary short; findings come first.
4. If no issues, state that explicitly and call out residual risk.

## Command Matrix
Use the first matching toolchain in this order.

### Repository Discovery
- List files: `rg --files`
- Find text: `rg "<pattern>"`
- Show status: `git status --short`
- Show diff: `git diff -- <path>`

### JavaScript / TypeScript (`package.json`)
- Install deps: `npm ci`
- Lint: `npm run lint`
- Type-check: `npm run typecheck`
- Test: `npm test -- --runInBand`
- Build: `npm run build`

### Python (`pyproject.toml`)
- Install deps: `uv sync`
- Lint: `uv run ruff check .`
- Format check: `uv run ruff format --check .`
- Test: `uv run pytest -q`
- Type-check: `uv run mypy .`

### Go (`go.mod`)
- Format: `gofmt -w .`
- Vet: `go vet ./...`
- Test: `go test ./...`
- Build: `go build ./...`

### Rust (`Cargo.toml`)
- Format check: `cargo fmt -- --check`
- Lint: `cargo clippy --all-targets --all-features -- -D warnings`
- Test: `cargo test --all-features`
- Build: `cargo build --all-features`

### Makefile Projects (`Makefile`)
If make targets exist, prefer:
- `make lint`
- `make test`
- `make build`

## Change Guardrails
- Never run destructive git commands (`git reset --hard`, `git checkout --`) unless explicitly requested.
- Do not revert unrelated local changes.
- Keep commits and diffs focused on the user request.
- Prefer `rg` for search and `apply_patch` for targeted edits.

## Handoff Checklist
Before finishing, include:
1. What changed and why.
2. Exact files touched.
3. Commands run and outcomes.
4. Any remaining risks, assumptions, or follow-up steps.

## FB Copywriting (API) - Human Tone + Booking Intent
ဤ repo/agent က Facebook caption/content ကို API နဲ့ generate လုပ်တဲ့အခါ “စက်ရုပ်ပုံစံ” မပေါက်အောင် prompt + output format ကို တင်းတင်းကျပ်ကျပ်သတ်မှတ်ထားရန်။

### Prompt Pack (Recommended)
System message (တစ်ခါတည်းထား):
- You are a Myanmar FB copywriter for a local photo studio. Write natural Burmese with short lines. Avoid corporate tone and buzzwords. Be specific. Ask exactly one question. Include exactly one soft CTA to DM. No emojis. No hashtags unless requested.

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
- Bullet list ကိုအလွန်ရှည်မရေးပါနဲ့ (FB caption အတွက် line breaks ပိုသုံး)။
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
1. Model name (ဥပမာ `gpt-4o-mini` စသဖြင့်)
2. Posts per day (တစ်နေ့ generate မယ့် post အရေအတွက်)
3. Images per post (တစ် post ကို API ထဲပို့မယ့် ပုံအရေအတွက်)

## 7 Day Growth Plan (Photo Studio Specific) - Facebook Algorithm Re-Activation
Goal: Page reach/engagement ျပန္တက်လာအောင် “consistent, native, high-retention content” နဲ့ ၇ ရက်အတွင်း signal အသစ်ပြန်တင်ပေးခြင်း။

### Re-Activation Rules (Must Follow)
- 7 ရက်အတွင်း “နေ့စဉ် တစ်ကြိမ်” (အနည်းဆုံး 1 post/day) ကိုတိတိကျကျ ထိန်းထားပါ။
- Link ထည့်ပြီး platform အပြင်ထွက်ခိုင်းတဲ့ post (website link) ကို 7 ရက်လောက်လျော့/ရှောင်ပါ။ Booking ကို DM/Call-to-Action (CTA) နဲ့ပဲ ခေါ်ပါ။
- Same content ကို copy/paste အလုပ်ကြီး (နာရီတိုတိုအတွင်း ထပ်တင်) မလုပ်ပါနဲ့။
- Post တင်မယ့်အချိန်မတင်ခင် 15 မိနစ် + တင်ပြီး 30 မိနစ်: Comment/DM ပြန်၊ Other pages/groups မှာ genuine engagement လုပ်ပါ (spam မလုပ်ပါနဲ့)။
- Video/Reels အတွက်: 2–3 sec hook, caption subtitles, 6–20 sec (သို့) 20–45 sec BTS လိုမျိုး retention ကောင်းအောင်။
- “Hard sell” 7 ရက်လုံး မကာလတောင် မလုပ်ပါနဲ့။ 80% value/trust, 20% offer လိုမျိုးပဲ။

### Content Pillars (Photo Studio)
- Portfolio: Best shots, carousel before/after (တစ်ပုံထဲမဟုတ်)।
- BTS: lighting setup, posing direction, retouch workflow။
- Proof: client testimonial, review screenshot (permission ရှိရင်)။
- Education: “How to prepare for shoot”, outfit/pose tips။
- Offer: package, limited slots, seasonal promo (soft CTA)။

### 7-Day Posting Plan (What to Post Each Day)
Recommended posting window: သင့် audience အလုပ်ပြီးချိန် (အများအားဖြင့် 7–9pm) ကိုစပြီး Facebook Insights နဲ့အချိန်တိတိကျကျ ပြန်ညှိပါ။

Day 1 (Re-Introduce + Trust)
- Post: Carousel (5–10 photos) “Best of last season” + short story (studio vibe, style) + CTA: “DM ‘BOOK’”
- Story: 3–5 frames (studio tour + today availability poll)
- Comment prompt: “ဘယ်စတိုင်ကိုပိုကြိုက်လဲ? (A/B)”

Day 2 (BTS Reel)
- Post: Reel 10–25 sec “1 setup, 3 looks” (lighting + pose cues)
- Caption: “Shoot မတိုင်ခင် outfit 2–3 ခုယူလာဖို့ recommend…”
- Story: Q&A sticker “မေးချင်တာရှိလား?” (pose/outfit)

Day 3 (Before/After Retouch)
- Post: Carousel (Before/After + close-up) + explain “natural retouch policy”
- CTA: “DM ‘PRICE’ ဆိုရင် package list ပို့ပေးမယ်”
- Story: slider “natural vs glam” preference

Day 4 (Client Proof + Review)
- Post: Single image + review screenshot (permission) သို့မဟုတ် quote card
- Caption: client experience, timing, delivery days
- CTA: “Slots limited this week: DM”

Day 5 (Education Post)
- Post: Text+photo (or carousel) “Shoot day checklist (5 items)”
- Example points: outfit colors, ironing, hair/makeup timing, arrive early, reference poses
- CTA: “ဒီ checklist ကို save လုပ်ထားပါ”

Day 6 (Mini Offer + Scarcity)
- Post: Graphic/short reel “Weekend mini-session (X mins, Y photos)”
- Rules: clear deliverables, price range, deposit/booking method
- CTA: “Comment ‘MINI’ or DM”

Day 7 (Live/Behind-the-Scenes + Booking Push)
- Post: Live 10–15 min (studio setup, camera talk, Q&A) သို့မဟုတ် Reel recap
- Story: countdown sticker “Next week slots”
- CTA: “Next week booking open: DM/Call”

### Daily Engagement Checklist (Repeat Every Day)
- Reply to all comments within 1–2 hours (first 30 mins အရေးကြီး)။
- DM inquiries ကို template နဲ့ချက်ချင်းပြန် (price/package + available dates)။
- 5–10 related local pages/communities မှာ genuine comment (no link drop) 10 မိနစ်။
- Story တင် (poll/slider/Q&A) အနည်းဆုံး 1 ခု။

### Caption / CTA Templates (Copy-Safe)
- Booking CTA: "Booking ချင်ရင် DM 'BOOK' လို့ပို့ပါ။ Date/Time/Style ပြောပေးရုံပါပဲ။"
- Price CTA: "Package/Price list လိုချင်ရင် DM 'PRICE' လို့ပို့ပါ။"
- Save CTA: "နောက်မှ ပြန်ကြည့်လွယ်အောင် save လုပ်ထားပါ။"
- Comment CTA: "A/B ထဲက ဘယ် look ကိုပိုကြိုက်လဲ? Comment ထားပေးပါ။"

### Simple Metrics (Track for 7 Days)
- Reach, 3-sec video views, average watch time (Reels)
- Shares + Saves (အရေးကြီး)
- Comments + DMs (booking intent)
- Confirmed bookings (အဆုံးသတ် KPI)

### After Day 7
- Best performing post type (carousel vs reel vs education) ကိုရွေးပြီး နောက် ၂ ပတ်အတွက် 70% ကိုအဲဒီ format အခြေခံ ပြန်ချဲ့ပါ။
