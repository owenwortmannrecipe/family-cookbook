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
They create an account in the app and see a "Waiting for approval" screen with a code.
They send you that code. In Firestore, add a document to `family` whose **Document ID is that
code**. Their screen unlocks by itself within a second or two.

## Removing someone
Delete their document from `family`. They are locked out immediately (even mid-session).
To fully remove the account, also delete them under Authentication → Users.

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
