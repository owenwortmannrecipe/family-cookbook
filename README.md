# 📖 Family Cookbook

A shared, private family recipe book that works like an app. Everyone in the family can browse, cook from, add to, and plan meals with the same collection — on a phone, tablet, or computer, even without signal.


---

## What it does

| Area | Highlights |
|---|---|
| **Recipes** | Search and filter by category, cuisine, and diet. Photos, notes from family members, favorites, "last cooked", and a "mine only" filter. |
| **Cooking view** | Scale servings up or down (fractions stay readable, like `1 1/2`), and switch between US and metric. |
| **Shopping list** | Add a recipe's ingredients in one tap. Duplicates merge and add up, items are grouped by store aisle, and you can print the list. Shared lists are supported. |
| **Meal planner** | Plan meals by day, then add the whole week to the shopping list. Shared planners are supported. |
| **Import** | Pull in recipes from other sites with a **bookmarklet clipper**, **fetch by link**, or **paste page source** (works on paywalled sites). Also import from a backup file. |
| **Trash** | Deleted recipes go to the trash first and can be restored. |
| **Family Members** | Owner-only page to approve or remove people. |
| **Kitchen Guide & Reference** | Techniques, flavor and wine, cooking terms, equipment, seasonal produce, unit conversions, ingredient weights, and meat doneness. |
| **Backup & Export** | One-click JSON backup, printable PDF cookbook, and an install-to-phone guide. |
| **Offline** | Installable (PWA). Opens with no signal, and changes sync when you're back online. |

## How it works (short version)

```
 Browser (index.html)  ──►  Firebase Authentication   who you are (email + password)
        │               ──►  Firestore database       recipes, members, lists, plans
        │
        └── Service worker (sw.js) keeps the app and a local copy of the data for offline use
```

- **No build step, no server of your own.** The whole front end is static files served from GitHub Pages (or any static host).
- **Firebase** provides sign-in and the shared database. The recipes live in Firestore, not in this repo.
- **Access is two-step:** create an account, then the owner approves you. Approval is a document at `family/<your-uid>` in Firestore, and the database rules enforce it on the server.
- **Importing recipes** uses one shared parser (`recipe-parser.js`) for the bookmarklet, fetch-by-link, and paste-source paths.

Full details are in **[docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md)**.

## Repository layout

```
family-cookbook/
├── index.html            The entire app: page layout, styles, and logic
├── recipe-parser.js      Recipe import parser + quantity/unit helpers
├── sw.js                 Service worker (offline support) — must stay at the root
├── manifest.json         "Install to home screen" settings
├── icons/                App icons (home-screen icon, favicon)
├── firestore.rules       Database security rules (the copy published in Firebase)
├── data/
│   └── wortmann-family-recipes.json   Starter recipes (import via Backup & Export)
├── docs/
│   ├── HOW-IT-WORKS.md   Architecture, data model, offline, import pipeline
│   ├── BUILD-YOUR-OWN.md Step-by-step guide to make your own family cookbook
│   └── SECURITY-SETUP.md Owner's guide: approving/removing members, rules, key hardening
└── README.md
```

`index.html`, `sw.js`, `manifest.json`, and `recipe-parser.js` stay together at the root on purpose: the service worker can only control files at or below its own folder, and the paths are written relative to each other.

## Making changes

There is nothing to install. Edit a file, commit, and push — GitHub Pages republishes in a minute or two.

1. **Edit** `index.html` (or `recipe-parser.js`).
2. **Bump the cache name** in `sw.js` (for example `wfc-shell-v3` → `wfc-shell-v4`) so phones pick up the new version instead of the old cached copy.
3. **Test locally** (optional) with `python3 -m http.server 8000` and open `http://localhost:8000`. Service workers only run on `localhost` or HTTPS, not by double-clicking the file.

> **Editing `recipe-parser.js`:** the clipper bookmarklet embeds this file's function as text, so inside `wfcParserLib()` don't use `//` line comments, always end statements with `;`, and avoid multi-line template literals. The rules are written at the top of the file.

## Backups

Open **Backup, Export & Install** in the app and download a **JSON backup** regularly (the app shows a dot when it's time). Keep a copy somewhere outside Firebase. You can also export a printable **PDF cookbook** from the same page.

## Security notes

- The Firebase config in `index.html` (including the `apiKey`) is **meant to be public** in web apps. It identifies your project; it does not grant access. **The security rules are what protect your data**, so keep `firestore.rules` published and review it if you change the data model.
- **Run the family:** approving and removing members, publishing rules, and restricting the API key are covered in **[docs/SECURITY-SETUP.md](docs/SECURITY-SETUP.md)**.
- Keep `firestore.rules` in this repo identical to what is published in the Firebase console, so the repo is the source of truth.
- Never put an Admin SDK key, service-account file, or passwords in this repo.
- Optional hardening: in Google Cloud Console, restrict the API key to your site's address (HTTP referrers).

## Make your own

Want one for your family? Follow **[docs/BUILD-YOUR-OWN.md](docs/BUILD-YOUR-OWN.md)**. It takes about 30 minutes and doesn't require coding.

## Credits

Built for the Wortmann family. Fonts: Lora and Nunito (Google Fonts). Firebase by Google. PDF export uses html2pdf.js.
