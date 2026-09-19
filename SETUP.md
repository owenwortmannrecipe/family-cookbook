# Setting up the updated cookbook

## 1. Upload the files to GitHub

Add all 9 files to your `family-cookbook` repo, replacing the old `index.html`:

```
index.html
manifest.json
sw.js
icon-192.png
icon-512.png
icon-512-maskable.png
apple-touch-icon.png
favicon.ico
favicon-32.png
```

Easiest way: on github.com, open your `family-cookbook` repo → **Add file → Upload files** → drag all 9 in → commit. Give GitHub Pages a minute or two to redeploy, then hard-refresh the site (Ctrl/Cmd+Shift+R).

## 2. Turn on Anonymous Authentication

Favorites and the safer write rules below both need this.

1. [console.firebase.google.com](https://console.firebase.google.com) → your project → **Build → Authentication**.
2. Click **Get started** if you haven't used Auth before.
3. **Sign-in method** tab → **Anonymous** → toggle **Enable** → **Save**.

That's it — the site signs each visitor in silently in the background; nobody sees a login screen.

## 3. Update Firestore rules

**Firestore Database → Rules**, replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /recipes/{recipeId} {
      allow read: if true;
      allow create, update: if request.auth != null;
      allow delete: if false;
    }
  }
}
```

Click **Publish**. What this does: anyone with the link can still browse recipes with no login. Adding, editing, favoriting, and "soft deleting" (moving to Trash) requires the invisible anonymous sign-in, which blocks simple drive-by bots. Real, permanent deletes are blocked completely at the database level — the app can only move a recipe to Trash, never erase it. If you ever do want to erase something forever, do it from the Firebase console's Firestore data viewer.

## 4. Add Storage rules (for phone photo uploads)

**Build → Storage** → if you've never used it, click **Get started** and pick the same region as your Firestore database → **Rules** tab, replace with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /recipe-photos/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 8 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Click **Publish**. This caps uploads at 8MB and requires them to actually be images.

## What's new

- **Photos from your phone** — the Add Recipe form now has a file picker next to the URL field
- **Favorites** — heart icon on any recipe, "Favorites Only" filter chip
- **Last cooked** — "Mark as Cooked Today" button in the recipe view, shown on cards
- **Family Notes** — anyone can leave a tip or memory on a recipe
- **Shopping List** — "Add to Shopping List" on any recipe, its own page with checkboxes, print button (lives on your device only)
- **Cook Mode timers** — auto-detected from step text ("bake 25 minutes"), with start/pause/reset
- **Trash** — deleting now moves a recipe to Trash instead of erasing it; restore anytime
- **Backup Recipes (JSON)** — one-click download of every recipe as a JSON file, for extra peace of mind
- **Installable app** — "Add to Home Screen" now actually installs a real, icon-bearing, offline-capable app
- **Recipe Clipper (new)** — a bookmarklet that pulls a recipe straight from NYT Cooking, justtherecipe.com, or almost any recipe site into your Add Recipe form. No Firebase setup needed — see below.

## Using the Recipe Clipper (NYT Cooking, justtherecipe.com, etc.)

Go to **Import from Web** in your cookbook's sidebar. There's a **📖 Clip Recipe** button — drag it to your browser's bookmarks bar. Then, on any recipe page (signed into NYT Cooking, or on a justtherecipe.com result), click that bookmark. It reads the recipe right out of the page you're already viewing — since it runs in your own signed-in browser tab rather than fetching from a server, paywalls and bot-blocking don't apply — and opens your cookbook with everything filled in for you to review and save. Full instructions, including a mobile workaround and a copy-paste fallback, are on that page.

## Trade-offs worth knowing

- Favorites and shopping lists are stored **per browser/device**, not per person — if a family member switches phones or clears their browser data, that device's favorites/list resets, but recipes themselves are always safe in the shared database.
- The write protection (step 3) stops casual bots and accidental damage but isn't bank-grade security — a determined bad actor with some technical skill could still sign in anonymously and write junk data. For a family recipe site this is a reasonable trade-off between safety and simplicity.
