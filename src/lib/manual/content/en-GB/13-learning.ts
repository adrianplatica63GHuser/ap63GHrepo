/**
 * Manual, en-GB, chapter 13 — 13.1 written in #39.39, 13.2 in #39.40, 13.3 in #39.42, 13.4 in #39.43; 13.5 is a heading until 39.45 writes it. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 13 Help and learning {#learning}

This chapter describes what helps you learn the application. The first four sections, about the manual, the „?” help, the skills map and the quizzes, are written; the others are written as their screens are ready.

## 13.1 The user manual {#learning-manual}

The manual opens from the sidebar, „Ajutor și învățare” → „Manual de utilizare” (the user manual). On the left is „Cuprins” (contents), with every chapter and its sections; on the right, one chapter. Press a heading in the contents to go to it.

- The numbers in the text that point at another section, another chapter or a figure are links: press one and the manual opens there.
- At the end of each chapter, „Capitolul anterior” and „Capitolul următor” (previous and next chapter) take you on without going back to the contents.
- The address in the browser names the section that is open. You can keep it as a bookmark or send it to someone: opened, it goes straight to the same section, even if the manual has gained chapters in the meantime and the numbers have changed.
- An address naming a section that no longer exists opens the first chapter and tells you so.

„Descarcă (Word)” (download as Word) turns the manual into a Word document, in the language you use the application in: the title, the contents, each chapter on its own page and every figure. It is the same text as on the screen, so a document downloaded today says what the screen says today.

The figures are photographed from the application, on invented records. Where real people's data would have appeared on the screen, it is blurred.

## 13.2 The „?” help and its texts {#learning-help}

Every screen has a „?” in the top bar. Pressed, it shows a „Context” (background) — why the screen exists — and a „Cum se folosește” (how to use it) — what is done on it (section [[start-help]]). Under them stands „Vezi în manual” (see in the manual), with the number and title of the section of this manual that describes the screen in full; press it and the manual opens there. „?” is the short form of the manual, and the manual is the long form of „?”.

The texts behind „?” are written in „Ajutor și învățare” → „Informații de ajutor” (section [[admin-help]]): pick the screen from the list, write in the boxes, watch „Previzualizare” (preview) and press „Salvează” (save).

### 13.2.1 Proposed texts {#learning-help-proposals}

Beside some screens in the list stands „Propunere” (proposal): for them there is a proposed text, written from this manual, usually because the current text points at a chapter that no longer exists or names a tab whose name has changed. Above the list, a line says how many screens have a proposal.

Open the screen: the current text and the proposal stand side by side, field by field, in Romanian and in English.

- „Acceptă” (accept) saves the proposal as the screen's text; „?” shows it at once.
- „Editează” (edit) puts the proposal in the boxes underneath, so you can change it. Nothing is saved until you press „Salvează”.
- „Nu acum” (not now) sets it aside; you find it again the next time you open „Informații de ajutor”.

Your text is never changed without your choosing. A proposal is tied to the text it found: if you write something else over it, the proposal disappears by itself, because it no longer answers the text you have.

## 13.3 The skills map {#learning-skills}

„Ajutor și învățare” → „Harta competențelor” (the skills map) shows what there is to learn about working with the archive, as a map (Figure [[fig-learning-skills-map]]). Each box is a skill, with its number, its name and its path. The boxes stand in four columns, from left to right: „De bază” (basic), „Intermediar” (intermediate), „Avansat” (advanced) and „Expert”. An arrow runs from a skill to one that builds on it.

![13.1 „Harta competențelor”, with the four states](skills-map.png){#fig-learning-skills-map}

### 13.3.1 The colours and the states {#learning-skills-states}

A box's colour is its level's and never changes: pale blue with navy text for „De bază”, blue for „Intermediar”, deep blue for „Avansat”, navy with a gold frame and gold text for „Expert”. Over the colour, the box shows where you stand:

| The state | What it looks like | What it means |
|---|---|---|
| „Deschisă” (open) | coloured, no tick | every skill before it is mastered; its quiz is available |
| „Stăpânită” (mastered) | coloured, with the green tick | its quiz has been passed |
| „Închisă” (closed) | grey, no tick, its frame dotted | at least one skill before it is missing |
| „Depășită” (obsolete) | grey, with the green tick, its frame green and thick | mastered, and a skill that builds on it is mastered too |

A skill with nothing before it — every basic one — is open from the start. When you pass a quiz, the skill becomes mastered, and the ones before it become obsolete: you have gone past them, but they still count as mastered for the other skills that build on them.

### 13.3.2 On the map {#learning-skills-use}

- Press an open box to take its quiz (section [[learning-quizzes]]).
- A closed box, pressed, shows which skills it needs to open, each with its state. A mastered or obsolete box says since when it is mastered.
- When you hold the mouse over a box, its arrows come forward and the others fade.
- Above the map stand the paths, from „Persoane” (persons) to „Spațiul de lucru” (the workspace). Choose one to keep only its skills in front; „Toate traseele” (all paths) brings them all back. A path is mastered when all its advanced and expert skills are mastered or obsolete; it then carries the green tick.
- „Potrivește” (fit) fits the map to the window's width, and „100%” shows it at full size. „Listă” (list) shows the same skills as a list, by level; „Diagramă” (diagram) brings the map back.

## 13.4 The quizzes {#learning-quizzes}

Every skill of the map has a quiz; you open it by pressing its box while it is open (section [[learning-skills]]).

### 13.4.1 Taking a quiz {#learning-quizzes-take}

The page shows a few questions, each with three or four answers, only one of which is right. Choose one answer to each question; „Trimite” (send) can be pressed only once you have answered them all, and under it you see how many you have done. Pressed, „Trimite” sends the answers once.

- The questions and the answers come in a different order every time.
- A skill has at least two variants of its quiz; a new attempt gives you a variant other than the last.
- Nothing is recorded until „Trimite”. If you leave the page with answers chosen, the application asks first: „Renunță” (discard) leaves without recording anything, so leaving costs you no wait.

### 13.4.2 The result {#learning-quizzes-result}

You pass with at least 80 % right answers — for example 5 of 6, or 8 of 10.

| The result | What you see | What changes on the map |
|---|---|---|
| Passed | how many right answers you had and, for each question, the right answer with its explanation and the manual section it comes from | the skill becomes mastered, and the ones before it become obsolete; the skills that rested only on these open |
| Failed | how many right answers you had, how many were needed, the manual sections to read again, and the date and hour from which you can try again | nothing; the skill stays open |

After a failed quiz the right answers are not shown: you would carry them into the next attempt. Read the suggested sections again.

A failed quiz can be taken again after three days, counted from the failed attempt. The date and hour are given in Toronto time, on the result page and on the skill's page.

## 13.5 Ask {#learning-ask}
`;
