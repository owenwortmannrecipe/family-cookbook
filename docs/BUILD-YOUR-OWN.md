# Build Your Own Family Cookbook

This guide takes you from nothing to your own private, shared, installable recipe site. **About 30–45 minutes. No coding required** — you will copy, paste, and click.

**What you'll end up with:** a website only your family can use, with its own sign-in, its own recipe database, and an owner (you) who approves each person.

**What it costs:** GitHub Pages and Firebase's free tier (the "Spark" plan) comfortably cover a family-sized cookbook. You don't need a credit card for Spark.

## What you'll need

- A free [GitHub](https://github.com) account
- A free Google account (for Firebase)
- This repository's files
- A text editor (Notepad, TextEdit in plain-text mode, or VS Code)

---

## Step 1 — Copy the code

1. Open this repository on GitHub and click **Fork** (top right), or **Use this template** if enabled. This makes your own copy.
2. Rename your copy to something like `our-family-cookbook`.

## Step 2 — Create your Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**. Name it (for example `smith-family-recipes`). You can turn Google Analytics off.
2. In the left menu choose **Build → Authentication → Get started**, then enable the **Email/Password** provider. Leave **Anonymous** turned off.
3. Choose **Build → Firestore Database → Create database**. Pick a location near your family and start in **production mode** (you'll add rules in Step 5). You don't need **Storage**: photos are saved in Firestore.

## Step 3 — Register the web app and get your config

1. On the project's home page click the **web icon `</>`** ("Add app"). Give it a nickname. You do **not** need Firebase Hosting.
2. Firebase shows a block that looks like this:

   ```js
   const firebaseConfig = {
     apiKey: "…",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.firebasestorage.app",
     messagingSenderId: "…",
     appId: "…"
   };
   ```

3. Keep this tab open. You'll paste these values next.

> It's normal and safe for this config to be public. The security rules in Step 5 are what protect your data.

## Step 4 — Put your config and name into the site

Open `index.html` in your editor (or edit it right on GitHub with the pencil icon).

1. **Config:** find `const firebaseConfig = {` near the top (around line 23) and replace all six values with yours.
2. **Name:** search for `Wortmann` and replace it with your family name. Places to change:
   - the page `<title>` and the description tags at the top
   - the sidebar title and footer
   - the two sign-in screens ("📖 … Family Cookbook")
   - the **Preface** page heading and text
   - the PDF cover and the exported file names (`wortmann-recipes-backup-…`, `wortmann-family-cookbook.html`)
3. In `manifest.json`, change `name` and `short_name`.
4. In `sw.js` and `recipe-parser.js` the name only appears in comments, so those are optional.

Also edit the **Preface** page text so it tells *your* family's story. Delete or rewrite the Wortmann-specific tips in the Kitchen Guide if you like.

## Step 5 — Add the security rules

This is the most important step. In Firebase go to **Firestore Database → Rules**, replace everything with the contents of `firestore.rules` from this repo, and click **Publish**. Do this **before** anyone signs in.

In plain English, the rules say:

- Only signed-in people **who have been approved** can read or write recipes, photos, lists, and planners.
- Anyone signed in can read *their own* approval record (so the app can tell them they're waiting), and keep their own name/email profile.
- Only the **owner** can approve or remove members.
- The app can never create an owner, and can't change or delete an owner's record. Owners are made by hand in the Firebase console (Step 7).
- A recipe can only be erased permanently after it's already in the Trash.

> After publishing, test with a second account (Step 8) to confirm an unapproved person **cannot** see recipes. If you add features that use new collections, extend the rules too. More on running the family and rules: [SECURITY-SETUP.md](SECURITY-SETUP.md).

## Step 6 — Turn on hosting with GitHub Pages

1. In your GitHub repo go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose branch `main` and folder `/ (root)`, then **Save**.
3. After a minute or two your site is live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.
4. Tell Firebase about the address: **Authentication → Settings → Authorized domains → Add domain**, and add `YOUR-USERNAME.github.io`. Without this, sign-in will fail on your live site.

## Step 7 — Become the owner (one-time)

The first owner has to be created by hand, because nobody can approve you yet.

1. Open your live site and **create an account** with your email and a password. You'll land on the "waiting for approval" screen, which shows your **account ID** — copy it.
2. In Firebase go to **Firestore Database → Data → Start collection**. (The console ignores your rules, so this works even though they're published.)
   - Collection ID: `family`
   - Document ID: *paste your account ID*
   - Add fields: `name` (string) = your name, `role` (string) = `owner`
3. Save, then refresh the site. You're in, and a **Family Members** page now appears in the sidebar.

## Step 8 — Invite your family

1. Send everyone the site address.
2. Each person creates an account. They'll see the waiting screen.
3. You open **Family Members**, see them listed under *waiting*, and tap **✓ Approve**.
4. To remove someone later, tap **Remove**. They're locked out immediately.

**Test the lock:** make a throwaway account, don't approve it, and check it can't see recipes.

## Step 9 — Add recipes

Pick any of these:

- **Type them in** with the add-recipe button on the Recipes page.
- **Import from a website** on the **Import a Recipe** page (bookmarklet, link, or paste source).
- **Load the starter set:** *Backup, Export & Install → Bring recipes in from a file*, and choose `data/wortmann-family-recipes.json` — or replace that file with your own recipes first. See that file for the exact format.

## Step 10 — Put it on phones

- **iPhone/iPad (Safari):** Share → **Add to Home Screen**
- **Android/Chrome:** menu → **Install app**
- **Computer (Chrome/Edge):** the install icon in the address bar

## Step 11 — Make it yours (optional)

- **Icons:** replace `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png`, `favicon-32.png`, and `favicon.ico` with your own (keep the same names and sizes).
- **Colors:** look at `:root{--parchment:…; --ink:…; --rust:…}` at the top of the `<style>` in `index.html`. Change those hex values, and `theme_color` / `background_color` in `manifest.json`.
- **Fonts:** swap Lora and Nunito in the Google Fonts `<link>` and the CSS.
- **Categories, cuisines, diets:** search for the lists used by the recipe form in `index.html`.

After any change to site files, bump `CACHE_NAME` in `sw.js` (for example `wfc-shell-v3` → `v4`) so phones fetch the new version.

---

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| Sign-in fails on the live site | Add your GitHub Pages domain under Firebase **Authentication → Authorized domains** |
| "Missing or insufficient permissions" | Rules not published, or your account has no `family/<uid>` document |
| Stuck on "waiting for approval" as the owner | The `family` document ID must equal your account ID exactly, with `role` = `owner` |
| Changes don't show up | Browser or phone is using the cached copy. Bump `CACHE_NAME` in `sw.js`, push, then reload twice |
| Site works but won't install | It must be served over HTTPS, and `manifest.json` and the icons must load |
| Import by link fails | Many sites block it. Use the bookmarklet or paste page source instead |
| Page is blank | Open the browser console (F12). A typo in the `firebaseConfig` block is the usual cause |

## Costs and limits

Firebase's free Spark plan has daily read/write limits that a family cookbook rarely approaches. If you share the site widely or store many large photos, keep an eye on usage in the Firebase console. Photos are compressed before saving to help.

## Keeping it safe

- Download a **JSON backup** every so often and store it outside Firebase.
- Only approve people you know. Anyone with the link can create an account, but they can't see recipes until you approve them.
- Don't commit service-account keys, passwords, or other secrets to the repo.
- Optional but recommended: restrict your API key to your site address. The steps are in [SECURITY-SETUP.md](SECURITY-SETUP.md) (last section).
