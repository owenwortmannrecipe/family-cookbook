# How the Cookbook Works

A technical tour for anyone who wants to understand or change the site. No prior Firebase knowledge needed.

## 1. The big picture

The site is a **single-page app** made of a few static files. There is no backend code to run or pay for. Everything dynamic is handled by Firebase.

| Piece | Where | Job |
|---|---|---|
| App | `index.html` | All screens, styles, and logic (plain HTML, CSS, and JavaScript — no framework, no build step) |
| Parser | `recipe-parser.js` | Reads recipes from web pages; parses and scales ingredient quantities |
| Offline | `sw.js` | Service worker: caches the app so it opens with no signal |
| Install | `manifest.json` | Lets people add it to their home screen as an app |
| Accounts | Firebase Authentication | Email + password sign-in |
| Data | Cloud Firestore | Recipes, members, shared lists and planners, photos |
| Rules | `firestore.rules` | Server-side permissions (who may read or write what) |

Libraries are loaded from CDNs at runtime: Firebase SDK 10.12.0 (`gstatic.com`), html2pdf.js 0.10.1 (`cdnjs`), and Lora and Nunito fonts (Google Fonts).

## 2. Screens (pages)

`index.html` contains every page as a `<div class="page" id="page-…">`. Navigation just shows one and hides the rest (`showPage()`).

`recipes` · `planner` · `shopping` · `trash` · `preface` · `import` · `family` (owner only) · `guide` (five Kitchen Guide tabs) · `conversions` · `weights` · `doneness` · `export`

On screens narrower than 900px the sidebar becomes a drawer plus a bottom tab bar.

## 3. Sign-in and approval

Signing in is a two-gate system:

1. **Account:** the person creates an email + password account. A profile (`users/<uid>`) stores their name and email so everyone can see who wrote what. Anonymous sessions are signed out on purpose.
2. **Approval:** the person must also have a document at `family/<uid>`. Until then they see a "waiting for approval" screen showing their ID.

The **owner** approves people from the **Family Members** page (this writes `family/<uid>` with `role: "member"`). The very first owner is created by hand in the Firebase console (see BUILD-YOUR-OWN, Step 7). Removing a member deletes their `family/<uid>` document, which locks them out immediately.

> The app hides screens based on these checks, but **`firestore.rules` is what actually enforces them**. Hiding things in the browser is not security by itself.

Rules worth knowing (all enforced by `firestore.rules`):

- Only an owner can list the approval list or approve/remove people; everyone else can only check their own entry.
- The app can never create an owner. Owners are made by hand in the Firebase console by setting `role` to `owner`.
- An owner's own document can't be changed or deleted from the app.
- A recipe can only be permanently deleted once it is already in the Trash.
- Only a group's members can change that shared list or planner.

Day-to-day owner tasks are in [SECURITY-SETUP.md](SECURITY-SETUP.md).

## 4. Data model (Firestore)

| Collection | Contents |
|---|---|
| `recipes/{id}` | One recipe: `name`, `category`, `cuisine`, `author`, `servings`, `active`, `passive`, `description`, `ingredients[]` (`name`, `qty`, `unit`), `steps[]`, `diets[]`, `tags[]`, nutrition (`cal`, `protein`, `carbs`, `fat`), `pairings`, `sourceUrl`, `favoritedBy[]`, `notes[]`, `thumb`, `hasFullPhoto`, `deleted`/`deletedAt` for trash, `addedByUid`, `createdAt` |
| `recipePhotos/{recipeId}` | The full-size photo (`photo`), kept separate so recipe lists load fast |
| `users/{uid}` | Display name, email, last backup time |
| `family/{uid}` | Approval record: `name`, `role` (`owner` or `member`), `approvedAt`, `approvedBy` |
| `lists/{id}` and `lists/{id}/items/{itemId}` | Shared shopping lists (`name`, `ownerUid`, `members[]`) and their items |
| `planners/{id}` and `planners/{id}/entries/{entryId}` | Shared meal planners and their entries (`date`, `slot`, `recipeId`, `title`) |

Things worth knowing:

- **Photos:** a small thumbnail (roughly 10–20 KB) is stored inside the recipe, and the full photo lives in `recipePhotos`. Photos are compressed in the browser before saving. Firebase Storage is not used.
- **Delete is soft:** deleting sets `deleted: true`; the Trash page lists those and can restore or permanently remove them (the rules only allow permanent removal from the Trash).
- **Shopping lists and planners are groups:** everyone always has an open "Family List" and "Family Planner", and anyone can start their own and let others join. They live in Firestore.
- Ingredient `qty` is text (like `"1 1/2"` or `"3-4"`), which is why the parser handles fractions and ranges.

The file `data/wortmann-family-recipes.json` shows the exact recipe shape.

## 5. Offline support

Two layers work together:

- **Service worker (`sw.js`)** caches the app files (`index.html`, `recipe-parser.js`, `manifest.json`, icons) and the third-party files needed to start (Firebase SDK, html2pdf, fonts). It tries the network first and falls back to the cache. It never intercepts Firestore requests.
- **Firestore's local cache** (IndexedDB) keeps a copy of the recipes on the device. Changes made offline are queued and sync automatically. The app shows an "Offline" pill.

If the browser blocks local storage (for example private mode), the app falls back to a memory-only cache and still works online.

**Updating:** change `CACHE_NAME` in `sw.js` whenever you change app files, or users may keep seeing the old version.

## 6. Importing recipes

All three import paths share one parser, so they behave the same:

| Method | How it works | Best for |
|---|---|---|
| **Clipper bookmarklet** | Runs the parser inside the recipe page in your own browser, then sends the result to the cookbook | Any site, including paywalled ones |
| **Fetch by link** | Fetches the page through a public relay (`allorigins.win`, falling back to `corsproxy.io`) | Most recipe blogs |
| **Paste page source** | You paste the page's HTML (or just its recipe JSON-LD) | Sites that block everything else |

The parser tries four extraction strategies in order and merges results field by field, so a page missing steps in one format still gets them from another:

1. **JSON-LD** `schema.org/Recipe` (handles `@graph`, arrays, sections)
2. **Microdata** (`itemtype=schema.org/Recipe`)
3. **Site adapters** (small per-site extractors)
4. **Heading heuristics** (an "Ingredients" or "Directions" heading followed by a list)

The same file also provides the helpers used across the app: quantity parsing and formatting, scaling, metric conversion, merging shopping-list quantities (`1 cup + 1/2 cup`), and mapping ingredients to store aisles.

Because "fetch by link" depends on third-party relays, treat it as a convenience that may stop working someday. The bookmarklet and paste options don't depend on them.

## 7. Backup, export, and install

- **JSON backup** downloads all recipes; **import from file** restores them (8 MB limit).
- **PDF cookbook** is generated in the browser with html2pdf.js.
- **Install:** the manifest plus the service worker make the site installable ("Add to Home Screen" on iOS, "Install app" in Chrome and Edge).

## 8. File-editing cautions

- `recipe-parser.js`: obey the rules at the top of the file (no `//` comments inside `wfcParserLib()`, always use semicolons) because the bookmarklet embeds it as text.
- `sw.js`: if you add a new file the app needs offline, add it to `SHELL_FILES` and bump `CACHE_NAME`.
- Changing the data model? Update `firestore.rules` too, then republish them.
