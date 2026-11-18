# Task Capture

Quick-capture task app. Add a task in seconds, then see everything grouped by priority and check it off. Syncs live between computer and phone through Supabase.

## One-time setup

1. **Database**: In Supabase, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**. Then do the same, in order, with `supabase/daily-checklist.sql`, `supabase/calendar-feed.sql`, `supabase/areas.sql` and `supabase/notes.sql`.
2. **Sign-ups**: In Supabase, go to **Authentication → Sign In / Providers → Email**.
   - Leave **Allow new users to sign up** ON (so partners can make accounts).
   - Turn **Confirm email** OFF (Supabase's free email only sends ~2 per hour, so confirmations would get stuck).
3. **Where email links go**: In Supabase, go to **Authentication → URL Configuration**.
   - **Site URL**: `http://localhost:5173` for now (change it to the live web address once it's online).
   - **Redirect URLs**: add `http://localhost:5173` (and the live address later).
   - Without this, "Forgot password" emails send people to the wrong page.
4. **Keys**: Copy `.env.example` to a new file called `.env.local`, then fill in:
   - `VITE_SUPABASE_URL`: from **Project Settings → Data API**
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: from **Project Settings → API Keys** (the *publishable* one, never the secret one)

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5173 and click **Create an account**.

Everyone who signs up gets their own private task list. Nobody can see anyone else's tasks.

## Shortcuts

- **N**: add a task
- **Enter**: save · **Shift+Enter**: new line · **Esc**: cancel

## Calendar feed

The Apple Calendar subscription is served by a small Supabase service in `supabase/functions/calendar`.
After changing it, upload it again:

```bash
npx supabase login
npx supabase functions deploy calendar --remote=fkcwonyczeheiuwzqitb --no-verify-jwt --use-api
```

`--no-verify-jwt` is needed because calendar apps can't log in; the secret token in each person's link is what protects it.

## Areas

Each person has their own areas. Edit them in the app: the **Edit** button next to the Area filter, or in the add-task form.
New accounts start with Personal, Work, Health, Family and Finance (set in `supabase/areas.sql`).

## Mac quick-add popup (⌥Space)

A tiny menu-bar app in `mac/`. Press **⌥Space** anywhere and a floating add-task window pops up; Add or Cancel and you're back where you were. It shows the website's `/?popup=1` page, so form changes on the website show up there automatically.

### Install it (no coding needed)

1. Go to this project's **[Releases page](https://github.com/ethaninocando-sys/task-capture/releases/latest)** and download **Task-Capture-Mac.zip**.
2. Double-click the zip, then drag **Task Capture** into your **Applications** folder.
3. Open it. The first time, macOS says it can't verify the app (it isn't from the App Store). Click **Done**, then go to **System Settings → Privacy & Security**, scroll down, click **Open Anyway** next to Task Capture, and confirm. You only do this once.
4. A ☑ icon appears in your menu bar. Press **⌥Space** and sign in with your Task Capture account (make one at [task-capture.vercel.app](https://task-capture.vercel.app) if you don't have one).

Works on Macs with Apple chips and Intel, macOS 13 or newer. If ⌥Space does nothing, another app (like Raycast or Alfred) may already use that shortcut.

### Share a new version (for the owner)

```bash
bash mac/package.sh
```

This makes `mac/build/Task-Capture-Mac.zip`. On GitHub, open **Releases → Draft a new release**, create a tag like `mac-v1.1` (match the version in `mac/Info.plist`), attach the zip, and click **Publish release**.

### Build it yourself

Build and install it (needs Apple's free Command Line Tools):

```bash
bash mac/build.sh
open ~/Applications/"Task Capture.app"
```

- It turns on **Start at login** the first time it runs (toggle it from the menu bar icon).
- `taskcapture://add` also opens the popup (useful for Shortcuts or a Stream Deck button).
- To test against your local copy instead of the live site:
  `defaults write app.taskcapture.mac url "http://localhost:5173/?popup=1"` (undo with `defaults delete app.taskcapture.mac url`).
