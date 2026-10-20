# Accounts and cloud sync

Archirift works without accounts: progress is saved in the browser (IndexedDB) on that device. Turn on accounts to let learners sign in with **Google** or **email and password**, so their progress is tied to their account and follows them to every device.

Accounts use Firebase Authentication and Cloud Firestore. Both are free for a college-sized audience: the Spark plan includes 50,000 sign-ins a month and 20,000 Firestore writes a day.

## 1. Create the Firebase project (about 10 minutes)

1. Go to <https://console.firebase.google.com>, choose **Create a project**, and name it (for example `archirift`). Google Analytics is optional.
2. In **Build → Authentication → Get started**, then **Sign-in method**, enable:
   - **Google** (choose a support email).
   - **Email/Password**.
3. In **Authentication → Settings → Authorized domains**, add every domain the site runs on, for example `archirift.vercel.app` and your custom domain. `localhost` is there already.
4. In **Build → Firestore Database → Create database**, choose production mode and a region close to your learners (for India, `asia-south1`).
5. In **Firestore → Rules**, replace the rules with the contents of [`firestore.rules`](../firestore.rules) and click **Publish**. Each learner can then only read and write their own data. (Or run `npx firebase-tools deploy --only firestore:rules`.)
6. In **Project settings → General → Your apps**, add a **Web app**. Copy these values from the config it shows: `apiKey`, `authDomain`, `projectId` and `appId`.

## 2. Give the values to the site

Locally, copy `.env.example` to `.env.local` and fill it in:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=archirift-xxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=archirift-xxxx
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234:web:abcd
```

On Vercel, open **Project → Settings → Environment Variables**, add the same four variables, then redeploy.

These values are public by design: they identify the project, they don't grant access. The Firestore rules are what protect data.

## How it works

- **Local first.** Every change is written to IndexedDB first, so the app is instant and works offline.
- **Per-account storage.** Guests use the `archirift` database. Each signed-in account gets its own database (`archirift-u-<uid>`), so two people on one laptop never mix progress.
- **Guest progress comes along.** The first time someone signs in on a device, everything they did as a guest is moved into their account.
- **Sync.** Learning events are append-only with deterministic ids, so sending one twice is harmless. Level snapshots carry revision numbers, and the newer revision wins on both sides. Sync runs a few seconds after each change, when the tab regains focus, when the network returns, and every 90 seconds. See `src/sync/engine.ts` and its tests.
- **Leaderboard (opt-in).** Learners can choose to publish their display name, XP, level count and streak to `leaderboard/{uid}`. Nothing else is public.

## Data stored per learner

```
users/{uid}/events/{eventId}       { json, at, syncedAt }        append-only learning history
users/{uid}/snapshots/{id}         { json, revision, syncedAt }  where each level was left
leaderboard/{uid}                  { name, xp, levels, streak }  only if the learner opts in
```

To delete a learner's data, delete `users/{uid}` and `leaderboard/{uid}` in the Firestore console, and the user in Authentication.
