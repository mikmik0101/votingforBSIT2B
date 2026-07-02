# 🗳️ BSIT Class Election Website

A lightweight, Messenger-Poll-style election website with Student ID
verification, nominations, voting, an election schedule, and automatic
winner announcements — built with **HTML, CSS, Bootstrap 5, vanilla
JavaScript, and Firebase Firestore**. No backend server required.

---

## 1. Folder Structure

```
index.html            → main voting site students use
import.html           → admin-only page to import students & set schedule
css/style.css          → blue & white theme
js/firebase-config.js  → paste your Firebase config here
js/app.js               → all app logic (verification, voting, results)
data/students.json      → your class list (for reference)
data/students.json.js   → same list, loaded by import.html
README.md
```

---

## 2. Create Your Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** and follow the steps (Google Analytics is optional).
3. Once created, click the **Web icon (`</>`)** to register a web app.
4. Firebase will show you a config object like this:

   ```js
   const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

5. Copy those values into **`js/firebase-config.js`**, replacing the
   placeholder text.

---

## 3. Enable Firestore Database

1. In the Firebase Console, go to **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location close to your class, then select **Start in test
   mode** (fine for a short-lived class election).
4. Once your election is done, you can lock it down with rules like:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /students/{id} {
         allow read: if true;
         allow write: if false; // students should never edit their own doc directly
       }
       match /nominees/{id} {
         allow read: if true;
         allow create: if true;
         allow update: if request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(['votes']);
       }
       match /votes/{id} {
         allow read: if true;
         allow create: if true;
       }
       match /settings/{id} {
         allow read: if true;
         allow write: if false;
       }
     }
   }
   ```

   > ⚠️ Test mode is open to anyone with your Firebase config, which is
   > normal for small class projects but not meant for production apps
   > with sensitive data.

---

## 4. Import Student IDs

1. Open **`data/students.json.js`** and edit the `STUDENT_IDS` array so
   it matches your class list (one Student ID per line, in quotes).
   `data/students.json` is kept as a plain-JSON reference copy — only
   the `.js` file is actually used by `import.html`.
2. Open **`import.html`** in your browser (you can just double-click the
   file, or open it through GitHub Pages once deployed).
3. Click **Import Students**. This writes each Student ID into the
   `students` Firestore collection with `voted: false`. Running it again
   later is safe — duplicates already in Firestore are skipped.
4. **`import.html` is for you (the admin) only.** It isn't linked from
   the main site — keep the link private, or delete the file once setup
   is done.

---

## 5. Set the Election Schedule

Still on **`import.html`**:

1. Pick your **Election Start** and **Election End** date/time.
2. Click **Save Schedule**.

This writes one document to `settings/schedule` with `electionStart`
and `electionEnd`. The main site reads this automatically:

- **Before start** → shows a live countdown, voting & nominations disabled.
- **During the window** → voting & nominations enabled.
- **After end** → shows "Election Closed", results become visible.

You can come back to `import.html` any time to change the schedule.

---

## 6. Deploy to GitHub Pages

1. Create a new GitHub repository and push this whole folder to it.
2. In the repo, go to **Settings → Pages**.
3. Under **Source**, choose the branch (usually `main`) and root folder,
   then save.
4. GitHub gives you a URL like `https://yourusername.github.io/repo-name/`.
   Share that link with your classmates.

That's it — no build step, no server, no npm install.

---

## 7. How Voting Works

1. A student opens the site and types their **Student ID**.
   - If it's not found → *"Invalid Student ID."*
   - If they've already voted → *"You have already voted."*
   - Otherwise, they see the election.
2. For each position, they tap **❤️ Vote** next to a nominee. Tapping a
   different nominee automatically switches their selection; tapping the
   same one again deselects it.
3. Anyone (not just candidates) can click **+ Add Nominee** on a card
   while voting is open, following the required name format:
   **FIRST NAME + LAST NAME INITIAL, ALL CAPS** (e.g. `JOHN C`). The
   field auto-uppercases as you type and checks for duplicates live.
4. When ready, the student clicks **SUBMIT MY VOTES**, confirms once,
   and their choices are saved. Their `students/voted` field is set to
   `true`, permanently locking further votes for that ID.
5. After the election end time passes, the site automatically shows
   **📊 Election Results** with vote counts, percentages, and a
   **🏆 WINNER** tag (or **Tie** if there's a draw).

---

## 8. Firestore Collections Reference

```
students
  studentId: string
  voted: boolean

nominees
  position: string
  name: string
  votes: number

votes
  studentId: string
  position: string
  nominee: string   (nominee document ID)
  timestamp: server timestamp

settings/schedule
  electionStart: timestamp
  electionEnd: timestamp
```

---

## 9. Notes on the Imported Student List

A few entries in the uploaded sheet had inconsistent ID formats
compared to the rest (e.g. some use dashes like `C2025-010980`, and one
— `C20250092` — is shorter than the standard `C2025xxxxx` pattern).
These were imported exactly as they appeared in the sheet. Double-check
those specific rows before your election goes live, and correct them
directly in `data/students.json.js` if they were typos.

---

## 10. Troubleshooting

- **Nothing loads / console shows Firebase errors** → double-check
  `js/firebase-config.js` values match your Firebase project exactly.
- **"Invalid Student ID" for everyone** → make sure you ran the import
  step and that Firestore rules allow reads on `students`.
- **Votes not saving** → check the browser console for permission
  errors; you may still be in test mode restrictions or your rules
  block writes to `votes`/`nominees`.
- **Countdown stuck on "Loading…"** → you haven't saved a schedule yet
  via `import.html`.
