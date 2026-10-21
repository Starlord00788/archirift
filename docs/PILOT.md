# Running a small pilot

Tests prove Archirift works. They don't prove students come back. Before building more, watch
10–20 real students use it. A pilot this small won't give you statistics; it shows you where people
get stuck.

## Who

Final-year and pre-final-year students preparing for placements: a mix of people who will face an
LLD round, an HLD round, or both. Include a few who already know OOP well; they will tell you
whether the skip tests respect their time.

## The three questions

1. **Can they find the right starting point without help?** Open the site, say nothing. Note
   whether they make a plan, take a skip test or just start a level, and how long it takes them to
   begin a level.
2. **Can they finish a useful session and explain what they learned?** After one session, ask them
   to explain the level's idea in their own words, as they would in an interview. A good level
   makes this easy; a level they tapped through doesn't.
3. **Do they come back on day 3 and day 7 without being asked?** Don't remind them. Ask on day 8
   whether they returned and why (or why not).

## What to watch during the session

- Where they hesitate for more than a few seconds, and the words they're reading at that moment.
- Whether they understand Pain, Play, Proof and Recall without asking.
- What they do after "One step from sealing it": try again, move on or leave.
- Whether Recall feels like a quiz they want to win or an exam they want to escape.
- Whether they notice that their progress lives in this browser until they sign in.

## What the app already records (on the learner's device)

Everything is in the local event log (IndexedDB), and in the learner's own cloud copy only if they
sign in. Nothing is sent anywhere else. With a student's permission you can read it from the
browser's developer tools:

| Question | Events |
|---|---|
| Started a level, and which beat they reached | `activityVisited` |
| Answered, used hints, how confident they were | `attemptSubmitted` (`hintsUsed`, `confidence`) |
| Sealed a level | `lessonCompleted` |
| Made or changed a plan | `goalSet` |
| Passed a skip test | `levelsTestedOut` |
| Came back for a review (the delayed recall check) | `reviewGraded` |

Abandoning a level shows up as an `activityVisited` with no `lessonCompleted` after it.

If you later add analytics, track only these events, say so plainly on the site, and keep it
opt-in.

## After the pilot

Fix the friction you saw at least twice before adding anything new. Only then is a larger
cohort, measured over weeks, worth the effort.
