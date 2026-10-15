/**
 * Manual, en-GB, chapter 13 — 13.1 written in #39.39, 13.2 in #39.40, 13.3 in #39.42, 13.4 in #39.43, 13.5 in #39.45. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 13 Help and learning {#learning}

This chapter describes what helps you learn the application: the manual, the „?” help, the skills map, the quizzes and „Ask”, which answers a question from the manual.

## 13.1 The user manual {#learning-manual}

The manual opens from the sidebar, „Help & learning” → „User manual”. On the left is „Contents”, with every chapter and its sections; on the right, one chapter. Press a heading in the contents to go to it.

- The numbers in the text that point at another section, another chapter or a figure are links: press one and the manual opens there.
- At the end of each chapter, „Previous chapter” and „Next chapter” take you on without going back to the contents.
- The address in the browser names the section that is open. You can keep it as a bookmark or send it to someone: opened, it goes straight to the same section, even if the manual has gained chapters in the meantime and the numbers have changed.
- An address naming a section that no longer exists opens the first chapter and tells you so.

„Download (Word)” turns the manual into a Word document, in the language you use the application in: the title, the contents, each chapter on its own page and every figure. It is the same text as on the screen, so a document downloaded today says what the screen says today.

The figures are photographed from the application, on invented records. Where real people's data would have appeared on the screen, it is blurred.

## 13.2 The „?” help and its texts {#learning-help}

Every screen has a „?” in the top bar. Pressed, it shows a „Background” — why the screen exists — and a „How To” — what is done on it (section [[start-help]]). Under them stands „See in the manual: …”, with the number and title of the section of this manual that describes the screen in full; press it and the manual opens there. „?” is the short form of the manual, and the manual is the long form of „?”.

The texts behind „?” are written in „Help & learning” → „Help Information” (section [[admin-help]]): pick the screen from the list, write in the boxes, watch „Preview” and press „Save”.

### 13.2.1 Proposed texts {#learning-help-proposals}

Beside some screens in the list stands „Proposal”: for them there is a proposed text, written from this manual, usually because the current text points at a chapter that no longer exists or names a tab whose name has changed. Above the list, a line says how many screens have a proposal.

Open the screen: the current text and the proposal stand side by side, field by field, in Romanian and in English.

- „Accept” saves the proposal as the screen's text; „?” shows it at once.
- „Edit” puts the proposal in the boxes underneath, so you can change it. Nothing is saved until you press „Save”.
- „Not now” sets it aside; you find it again the next time you open „Help Information”.

Your text is never changed without your choosing. A proposal is tied to the text it found: if you write something else over it, the proposal disappears by itself, because it no longer answers the text you have.

## 13.3 The skills map {#learning-skills}

„Help & learning” → „Skills map” shows what there is to learn about working with the archive, as a map (Figure [[fig-learning-skills-map]]). Each box is a skill, with its number, its name and its path. The boxes stand in four columns, from left to right: „Basic”, „Intermediate”, „Advanced” and „Expert”. An arrow runs from a skill to one that builds on it.

![13.1 „Skills map”, with the four states](skills-map.png){#fig-learning-skills-map}

### 13.3.1 The colours and the states {#learning-skills-states}

A box's colour is its level's and never changes: pale blue with navy text for „Basic”, blue for „Intermediate”, deep blue for „Advanced”, navy with a gold frame and gold text for „Expert”. Over the colour, the box shows where you stand:

| The state | What it looks like | What it means |
|---|---|---|
| „Open” | coloured, no tick | every skill before it is mastered; its quiz is available |
| „Mastered” | coloured, with the green tick | its quiz has been passed |
| „Closed” | grey, no tick, its frame dotted | at least one skill before it is missing |
| „Obsolete” | grey, with the green tick, its frame green and thick | mastered, and a skill that builds on it is mastered too |

A skill with nothing before it — every basic one — is open from the start. When you pass a quiz, the skill becomes mastered, and the ones before it become obsolete: you have gone past them, but they still count as mastered for the other skills that build on them.

### 13.3.2 On the map {#learning-skills-use}

- Press an open box to take its quiz (section [[learning-quizzes]]).
- A closed box, pressed, shows which skills it needs to open, each with its state. A mastered or obsolete box says since when it is mastered.
- When you hold the mouse over a box, its arrows come forward and the others fade.
- Above the map stand the paths, from „Persons” to „Workspace”. Choose one to keep only its skills in front; „All paths” brings them all back. A path is mastered when all its advanced and expert skills are mastered or obsolete; it then carries the green tick.
- „Fit” fits the map to the window's width, and „100%” shows it at full size. „List” shows the same skills as a list, by level; „Diagram” brings the map back.

## 13.4 The quizzes {#learning-quizzes}

Every skill of the map has a quiz; you open it by pressing its box while it is open (section [[learning-skills]]).

### 13.4.1 Taking a quiz {#learning-quizzes-take}

The page shows a few questions, each with three or four answers, only one of which is right. Choose one answer to each question; „Send” can be pressed only once you have answered them all, and under it you see how many you have done. Pressed, „Send” sends the answers once.

- The questions and the answers come in a different order every time.
- A skill has at least two variants of its quiz; a new attempt gives you a variant other than the last.
- Nothing is recorded until „Send”. If you leave the page with answers chosen, the application asks first: „Discard” leaves without recording anything, so leaving costs you no wait.

### 13.4.2 The result {#learning-quizzes-result}

You pass with at least 80 % right answers — for example 5 of 6, or 8 of 10.

| The result | What you see | What changes on the map |
|---|---|---|
| Passed | how many right answers you had and, for each question, the right answer with its explanation and the manual section it comes from | the skill becomes mastered, and the ones before it become obsolete; the skills that rested only on these open |
| Failed | how many right answers you had, how many were needed, the manual sections to read again, and the date and hour from which you can try again | nothing; the skill stays open |

After a failed quiz the right answers are not shown: you would carry them into the next attempt. Read the suggested sections again.

A failed quiz can be taken again after three days, counted from the failed attempt. The date and hour are given in Toronto time, on the result page and on the skill's page.

## 13.5 Ask {#learning-ask}

„Ask” answers, from this manual, a question written in your own words. Open it from the sidebar, „Help & learning” → „Ask”; the same box also stands at the top of „User manual”.

### 13.5.1 The search {#learning-ask-search}

Type the question — for example „how do I add a person?” — and press Enter or „Search”. At once, at most five sections of the manual that answer it appear, the best match first. Each shows its number and title, its chapter and the sentences that match the question, with the words found marked. Press the title to read the section in the manual.

- The search sends nothing outside the application and costs nothing.
- Diacritics do not matter: „vanzare” and „vânzare” find the same sections.
- The beginning of a word is enough: „interact” also finds „interactions”.
- Small words, such as „how”, „where” or „a”, are not searched for.

If no section matches, the application says „The manual does not seem to answer this question.” Try other words, or look in „Contents” (section [[learning-manual]]).

### 13.5.2 „AI answer” {#learning-ask-ai}

Below the sections found stands „AI answer”. Only if you press it, the application sends the question and those sections to Claude, which writes from them an answer of at most three sentences. The answer names the sections it rests on, for example „§3.2”; press the number to read the section.

- Claude receives only the question and the text of the sections found — nothing from the archive's records, and no earlier questions.
- If the sections do not answer the question, the application says the manual does not say, instead of guessing.
- An AI answer is a paid read, under a cent. „Settings” → „Costs” → „AI” counts it with the other paid reads (section [[admin-settings-costs]]).
- The answer is written by AI: check the section it names before relying on it.
`;
