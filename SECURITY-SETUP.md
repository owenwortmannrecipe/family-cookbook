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
3. **Publish the Storage rules.** Storage → Rules → paste `storage.rules` → Publish.
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
- Recipe photo links are long unguessable URLs. Only approved family can see them in the
  app, but anyone who is *given* a link can open that one photo.
- A person who creates an account but is not approved can still store their own name/email
  profile and upload a photo to Storage (images only, 10 MB max). They cannot read anything.
