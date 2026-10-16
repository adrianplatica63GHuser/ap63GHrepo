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

Beside it, „Download in Romanian (Word)” gives the Romanian manual. There are two manuals, one per language: each is written wholly in its language, and its figures are shot in the application used in that language.

The figures are photographed from the application, on invented objects. Where real people's data would have appeared on the screen, it is blurred.

## 13.2 The „?” help and its texts {#learning-help}

Every screen has a „?” in the top bar. Pressed, it shows a „Background” — why the screen exists — and a „How To” — what is done on it (section [[start-help]]). Under them stands „See in the manual: …”, with the number and title of the section of this manual that describes the screen in full; press it and the manual opens there. „?” is the short form of the manual, and the manual is the long form of „?”.

The texts behind „?” are written in „Help & learning” → „Help Information” (section [[admin-help]]): pick the screen from the list, write in the boxes, watch „Preview” and press „Save”.

### 13.2.1 Proposed texts {#learning-help-proposals}

When the manual changes, a screen's text can fall behind: it points at a section that no longer exists, or names a tab whose name has changed. Then „Proposal” appears beside that screen in the list: a proposed text, written from this manual. Above the list, a line says how many screens have a proposal. When no proposal waits, that line does not appear either.

Open the screen: the current text and the proposal stand side by side, field by field, in Romanian and in English.

- „Accept” saves the proposal as the screen's text; „?” shows it at once.
- „Edit” puts the proposal in the boxes underneath, so you can change it. Nothing is saved until you press „Save”.
- „Not now” sets it aside; you find it again the next time you open „Help Information”.

To accept them all at once, press the „Accept all” button above the list, which also shows how many there are. A confirmation, „Accept every proposal?”, names the screens: „Accept all” saves them one after another, and „Cancel” changes nothing. At the end, a line says how many texts were saved.

Your text is never changed without your choosing. A proposal is tied to the text it found: if you write something else over it, the proposal disappears by itself, because it no longer answers the text you have. „Accept all” does not write over a text changed in the meantime either: that screen is skipped.

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
| „Obsolete” | grey, with the green tick, its frame green and thick | mastered, and every skill that builds on it is mastered: no arrow leaves it any more |

A skill with nothing before it — every basic one — is open from the start. When you pass a quiz, the skill becomes mastered, and in „My progress” the arrows that lead to it disappear. A skill that no arrow leaves any more — every skill that builds on it is mastered — becomes obsolete: you have gone past it, but it still counts as mastered. That is the only way a skill becomes obsolete. One that still leads to a skill not yet mastered stays mastered, coloured, with its green tick, and one that never had an arrow leaving it — an expert skill — never becomes obsolete. „Overview” shows every arrow, as before.

### 13.3.2 On the map {#learning-skills-use}

- Press an open box to take its quiz (section [[learning-quizzes]]).
- A closed box, pressed, shows which skills it needs to open, each with its state. A mastered or obsolete box says since when it is mastered.
- When you hold the mouse over a box, its arrows come forward and the others fade. In „My progress” only the arrows still drawn come forward.
- Above the map stand the paths, from „Persons” to „Workspace” (section [[learning-skills-paths]]). „All paths” shows the whole map.
- „Fit” fits the map to the window's width, and „100%” shows it at full size. „List” shows the same skills as a list, by level; „Diagram” brings the map back.

### 13.3.3 The paths and the two views {#learning-skills-paths}

A path is everything you need to reach its expert skills: its expert skills, every skill they build on, from any path, and the path's other skills. So the „Properties” path also holds „Workspace”, „Persons” and „Links” skills, because without them there is no reaching the properties' expert. Each box keeps its own path's name.

- Choose a path, and its skills stay in front; the others fade, where they stand, so the map does not jump from one path to another. Under the paths it says how many skills the path has.
- An arrow is dark blue only when both its ends are in the path. The others are light grey, their heads just as grey. When you hold the mouse over a box, its arrows come forward, heads included, even outside the path.
- A path is mastered when all its advanced and expert skills are mastered or obsolete; it then carries the green tick. A skill mastered on one path is mastered on every path that needs it.

The map can be seen two ways, with the buttons beside the paths:

| The button | What it shows |
|---|---|
| „My progress” | where you stand: every box in its state — open, mastered, closed or obsolete (section [[learning-skills-states]]). The page opens this way |
| „Overview” | the map as it is meant: every box in its level's colour, open, with no grey and no ticks (Figure [[fig-learning-skills-path]]). A box, pressed, shows what the skill covers and where the manual teaches it |

The choice holds for „All paths” and for „List” too: in „Overview”, the list has no „State” column.

![13.2 The „Properties” path, in „Overview”](skills-map-path.png){#fig-learning-skills-path}

## 13.4 The quizzes {#learning-quizzes}

Every skill of the map has a quiz; you open it by pressing its box while it is open (section [[learning-skills]]). Progress belongs to the account: each person sees their own quizzes, on whatever computer they sign in; on an installation without accounts, progress belongs to the installation. That is why, on Ciprian's computer, which has no accounts, only Ciprian takes the quizzes: „Only Ciprian!”, beside „My progress” and „Overview”, says why.

### 13.4.1 Taking a quiz {#learning-quizzes-take}

The page shows a few questions, each with three or four answers, only one of which is right. Choose one answer to each question; „Send” can be pressed only once you have answered them all, and under it you see how many you have done. Pressed, „Send” sends the answers once.

- The questions and the answers come in a different order every time.
- A skill has at least two variants of its quiz; a new attempt gives you a variant other than the last.
- Nothing is recorded until „Send”. If you leave the page with answers chosen, the application asks first: „Discard” leaves without recording anything, so leaving costs you no wait.

### 13.4.2 The result {#learning-quizzes-result}

You pass with at least 80 % right answers — for example 5 of 6, or 8 of 10.

| The result | What you see | What changes on the map |
|---|---|---|
| Passed | how many right answers you had and, for each question, the right answer with its explanation and the manual section it comes from | the skill becomes mastered and the arrows into it disappear; a skill before it becomes obsolete once every skill that builds on it is mastered; the skills that waited only on this one open |
| Failed | how many right answers you had, how many were needed, the manual sections to read again, and the date and hour from which you can try again | nothing; the skill stays open |

After a failed quiz the right answers are not shown: you would carry them into the next attempt. Read the suggested sections again.

A failed quiz can be taken again after three days, counted from the failed attempt. The date and hour are given in Toronto time, on the result page and on the skill's page.

## 13.5 Ask {#learning-ask}

„Ask” answers, from this manual, a question written in your own words. Open it from the sidebar, „Help & learning” → „Ask”; the same box also stands at the top of „User manual”.

### 13.5.1 How the answer is found {#learning-ask-search}

Type the question — for example „how do I add a person?” — and press Enter or „Ask”. The question goes to Claude together with the manual's outline: every section, with its number, its title and a line saying what it answers. Claude picks, by what the question means rather than by the words it shares with the manual, at most five sections that answer it, then writes from their text an answer of at most three sentences.

The page shows one of two things, never anything in between:

- **an answer**, which names the sections it rests on, for example „§3.2” — press the number to read the section —, and under it the same sections, with their number and title, each a link into the manual;
- **„The manual does not answer this question.”**, with „Open the manual's contents”, when no section answers it. No list appears then: a list of sections that only look like the question does not help you.

The answer is written by AI: check the section it names before relying on it.

### 13.5.2 What it sends and what it costs {#learning-ask-ai}

- Claude receives only the question, the manual's outline and the text of the sections it picked — nothing from the archive's objects, and no earlier questions.
- Every question is paid for: one read to pick the sections and, when it finds some, another to write the answer. Together they usually cost under a cent. „Settings” → „Costs” → „AI” counts them with the other paid reads (section [[admin-settings-costs]]).
- Diacritics, word order and the way the question is worded do not matter: what you ask does.
`;
