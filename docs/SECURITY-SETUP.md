# Locking the cookbook to approved family members

**Who gets in:** only someone who (1) signs in with an email + password account **and**
(2) is on the family approval list. Guests see only the sign-in screen and cannot read,
add, or edit anything. Anyone can *create* an account, but a new account sees nothing
until you approve it.

## Do these in this order (the order prevents locking yourself out)

1. **Add yourself and current family to the approval list.**
   Firebase console → Firestore Database → open the **`users`** collection. Each document's
   ID is a person's UID (the document shows their name and email).
   - Click **Start collection** → Collection ID: `family`
   - Document ID: paste a person's UID (copy it from the `users` collection)
   - Add one field: `name` (string) = their name. Save.
   - Repeat for every family member who should keep access. **Do yourself first.**
2. **Publish the Firestore rules.** Firestore Database → Rules → paste `firestore.rules` → Publish.
3. **Storage: nothing to do.** The app no longer uses Cloud Storage at all (it needs a paid plan now).
   Chosen photos are shrunk in the browser and saved inside the recipe in Firestore, so they are
   protected by `firestore.rules` like everything else. You can ignore Storage in the console.
4. **Turn off anonymous sign-in.** Authentication → Sign-in method → Anonymous → Disable.
   (Optional cleanup: Authentication → Users → delete the old "anonymous" rows.)
5. **Upload** the new `index.html`, `recipe-parser.js`, and `sw.js` to GitHub Pages.
   Everyone must reload once (close and reopen the installed app) to pick up the new version.

## Approving a new family member later
**Easiest (owner only):** open **Family Members** in the sidebar, find the person under *Waiting for approval*
and tap **Approve**. Their screen unlocks by itself within a second or two. (See "Updating for: the Family
Members page" below for the one-time setup.)

**By hand (still works, and always works from the console):** they create an account in the app and see a
"Waiting for approval" screen with a code. In Firestore, add a document to `family` whose **Document ID is
that code**, with a `name` field (and optionally `role` = `member`).

## Removing someone
Owner: **Family Members → Remove**. Or by hand: delete their document from `family`. Either way they are
locked out immediately (even mid-session). To fully remove the account, also delete them under
Authentication → Users.

## If you get locked out
The Firebase console ignores these rules, so you can always fix things there. Check that your
own UID has a document in `family`, and that the rules were published without errors.

## Known limits (worth knowing)
- The page's HTML (reference pages like Cooking Tips, Unit Conversions) is still public
  static content on GitHub Pages — only the **recipes, notes, favorites and profiles** are
  protected. Don't put anything private in the static pages.
- "Download site" (offline copy) embeds every recipe in a file. Treat that file as private.
- Photos you choose from your device live inside the recipe, so only approved family can read them.
  Photos added by pasting a web link are just links to wherever they are hosted.
- Photos uploaded *before* this change are still in Cloud Storage. Their links keep working only
  while that bucket exists; if one stops loading, re-add the photo (or paste a link).
- A person who creates an account but is not approved can still store their own name/email
  profile (that is how you find their code). They cannot read anything else.

---

## Updating for: shared lists & planners, tags, new layout

**What changed in the data:** shopping lists and meal planners are now *groups*. Everyone always has the
open **Family List** and **Family Planner**; anyone can also start their own, and anyone in the family
can view it and **join** it to add to it. Data lives in `lists/{id}/items`, `planners/{id}/entries`
(plus the `lists` and `planners` documents that hold each group's name, owner and members).
Recipes and tags are unchanged.

**Do these in order:**
1. **Publish the new rules first.** Firestore Database → Rules → replace everything with the new
   `firestore.rules` → Publish. Upload the site before this and the lists/planner will show
   "could not update" errors until the rules are in.
2. Upload the new `index.html` and `recipe-parser.js`. (`sw.js` is unchanged.)
3. Reload once on each device, and re-drag the **Clip Recipe** bookmarklet from *Import a Recipe*.

**Nothing to create by hand.** Collections appear automatically on first use.

**Your old per-device shopping list moves itself** into the Family List the first time an approved person
opens the app after the update (same items combine), and the local copy is then removed.

**If you tested the earlier "Phase 4" build against your real Firebase:** it stored items in flat
`shoppingItems` and `mealPlan` collections. The new build doesn't read those, and the new rules no longer
allow them. Delete them in the console if they hold anything you don't need.

**How sharing works (and its limits):**
- Everyone approved can *see* every list and planner (that's how you find one to join). Only a group's
  **members** can change what's on it. Joining adds only yourself; you can't add other people.
- The owner can delete their list/planner; any member can rename it or leave it.
- This is built for a family you trust: members of a group can edit each other's items.

**Cost:** Firestore only (no Storage), so no billing change.

---

## Updating for: the Family Members page + safer deletes

**What changed:** you (the owner) can approve and remove family members inside the app. Also, a recipe can now
only be deleted *for good* once it is already in Trash, so a bug can't wipe a live recipe.

**Do these in order (the order matters):**
1. **Make yourself the owner — in the console, before anything else.**
   Firebase console → Firestore Database → `family` → open **your own** document (the one whose ID is your UID;
   your UID is shown on your `users` document) → **Add field** → name `role`, type string, value `owner` → Save.
   (This is harmless with the old rules, so you can't lock yourself out by doing it first.)
2. **Publish the new rules.** Firestore Database → Rules → replace everything with the new `firestore.rules`
   → Publish. Do this *before* uploading the site, otherwise the new page shows "could not approve" errors.
3. **Upload** the new `index.html` (and `recipe-parser.js`) to GitHub Pages. `sw.js` is unchanged.
4. **Reload once** on your device. **Family Members** appears in the sidebar for you only. Anyone waiting for
   approval shows under *Waiting for approval* (with a number badge on the sidebar item).

**Rules of the road (enforced by the rules, not just the page):**
- Only an owner can list the approval list or approve/remove people. Everyone else can only check their own
  entry.
- The app can never create a new owner. Owners are made by hand in the console (step 1). To add a second owner,
  edit that person's `family` document in the console and set `role` to `owner`.
- An owner's own document can't be changed or deleted from the app, so nobody can lock themselves — or another
  owner — out by accident. To remove an owner, do it in the console.
- Approving gives a person the same access as everyone else; it does not make them an owner.

**If the new page says it can't approve or the list is empty:** the new rules probably aren't published yet,
or your `family` document doesn't have `role` = `owner` (check spelling and that it's a string).
The console always works: it ignores these rules.

**Safer deletes:** "Delete recipe" (move to Trash) works exactly as before. *Permanently delete* and *Empty Trash*
work on recipes that are already in Trash. If you ever need to erase a live recipe for good, move it to Trash
first (or delete it in the console).

**Cost:** Firestore only, so no billing change.

---

## Updating for: offline recipes + faster photos

**What changed:** (1) after one online visit, the cookbook opens and browses with no signal, and edits you make
offline sync by themselves later; (2) photos no longer slow the recipe list down.

**Do these in order:**
1. **Publish the new rules** (Firestore Database → Rules → paste the new `firestore.rules` → Publish). The only
   addition is a `recipePhotos` block. Publish it *before* uploading the site, or saving a recipe with a photo will
   show "full photo could not be saved".
2. **Upload** the new `index.html` **and `sw.js`** to GitHub Pages. (`recipe-parser.js` is unchanged this time.)
3. **Reload once** on each device. The new service worker also keeps the few files the app needs to *start* offline.
4. **Owner:** open **Backup, Export & Install** and tap **Optimize photos** once (it only appears while some recipes
   still carry a full-size photo inside the recipe). It is safe to run again if it is interrupted.

### Offline: how it works and where it stops
- **Open the cookbook once while online** on each device. After that, recipes open offline, and offline edits
  (new recipes, edits, favorites, shopping list ticks) are saved on the device and sync when you reconnect. A small
  "📴 Offline" pill shows at the top, and confirmations say "saved on this device, will sync".
- **First visit while offline** shows a message asking you to connect once. Nothing is downloaded until then.
- **Signing out removes the local copy** from that device. If another tab of the cookbook is still open the browser may
  refuse to clear it; close other tabs and sign out again.
- **Removing someone** locks them out as soon as their device next connects. Until then a device that was already
  approved can still show its local copy of the recipes. That is the nature of offline access.
- **Offline changes to the same item** made on two devices are settled by Firestore (last one to sync wins).
- **Photos offline:** you see the small version of any photo you haven't opened while online; opened ones show full size.
- Private/incognito windows and some old browsers can't keep a local copy; the app then works online only, as before.

### Photos: what changed
- Each recipe now holds a tiny thumbnail (about 11 KB). The full photo lives in its own document
  (`recipePhotos/<recipe id>`) and is loaded only when you open the recipe.
- **Backups and the Offline copy include the full photos.** Importing a backup rebuilds the thumbnails and photo documents.
  If a photo can't be read when you make a backup (for example you are offline), you get a warning and the
  "last backup" reminder is **not** reset.
- Deleting a recipe for good (Permanently delete / Empty Trash) also deletes its stored photo. Restoring keeps it.
- Recipes whose photo is a pasted web link are left as they are.
- Rules: only approved family can read/write `recipePhotos`; a document may hold just the `photo` field, up to 450,000
  characters.

**Cost:** Firestore only (a handful of extra reads when recipes are opened), so no billing change.

---

## Optional hardening: restrict the Firebase browser key (about 10 minutes, no code change)

**Why:** The `apiKey` in `index.html` is *not a password* — every Firebase website shows it, and it can't be
hidden. Your recipes are protected by the Firestore rules and the approval list, not by this key. Restricting the key
is an extra layer: it stops other websites (and unrelated Google APIs) from using *your* key and your quota.
It is optional, and it's easy to undo if anything misbehaves.

**Do this in a normal browser tab while signed in as the project owner. Don't close your current session until the
test at the end passes.**

1. Open **console.cloud.google.com**, choose the project **wortmann-family-recipes** (top bar).
2. Go to **APIs & Services → Credentials**. Under **API Keys**, open the key named something like
   **"Browser key (auto created by Firebase)"**. (Its value matches the `apiKey` in `index.html`. Don't touch the
   "Server key" or any other key.)
3. **Application restrictions:** choose **Websites (HTTP referrers)** and add these entries:
   - `https://owenwortmannrecipe.github.io/*`
   - `https://wortmann-family-recipes.firebaseapp.com/*`  *(needed for the password-reset email page, which Firebase
     hosts on this address)*
   - Only if you test from your own computer: `http://localhost/*`
4. **API restrictions:** choose **Restrict key** and tick only:
   - **Cloud Firestore API**
   - **Identity Toolkit API**
   - **Token Service API**
5. **Save.** It can take up to about 5 minutes to take effect.
6. **Also check** (Firebase console → Authentication → Settings → **Authorized domains**) that
   `owenwortmannrecipe.github.io` is listed — sign-in needs it. It normally is.

**Test (use a private/incognito window so nothing is cached):**
1. Open the cookbook and **sign in** — works.
2. Recipes load and you can edit one — works.
3. Request a **password reset** for a test account — the email arrives and its link opens.
4. If any of these fails with a message about an API key or "referer"/"referrer" not allowed, go back to the key
   and loosen it: first set API restrictions to **Don't restrict key**; if that fixes it, add the missing API name
   it complains about. Worst case, set Application restrictions back to **None** — you're back where you started.

**Things this does *not* do:** it doesn't make the key secret, and it can't stop someone who copies your site's
address in their requests. For stronger protection you can later turn on **Firebase App Check** — that is a bigger
change and not needed for a family cookbook.

*These are the usual steps for a Firebase web key. Google occasionally renames menu items, so if a label looks
different, look for the same idea (HTTP referrers; restrict to those three APIs).*
