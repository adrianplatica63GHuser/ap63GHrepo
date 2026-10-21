# TC-HELP-02 — „Manual de utilizare”: din bara laterală, o secțiune deschisă după link, descărcat ca Word

| | |
|---|---|
| **Area** | help |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-14 |

## What this proves

Slice #39.37 gave the user manual a screen, „Manual de utilizare”, in the new sidebar section „Ajutor și
învățare”. It opens from the sidebar; the contents are on the left and one chapter on the right; the
section is in the address (`/manual?s=<id>`), so a link from anywhere opens it at that section; a
cross-reference in the text is a link to the section it names; an address naming no section opens the first
chapter and says so; and „Descarcă (Word)” hands out the same manual as a Word document. Since #39.46 there
are two manuals, one wholly in each language, and „Descarcă în engleză (Word)” beside it hands out the English
one from this Romanian screen.

The defect is any of these: the screen unreachable from the sidebar; a section link that opens the wrong
chapter, or the right chapter scrolled elsewhere; a cross-reference that is not a link or names the wrong
number; a figure without its picture; a download that does not happen, or is not a Word document holding
the manual; a download in the wrong language, or one that mixes the two.

## Before you start

- TC-AUTH-01 is green; signed in as the superuser.
- Nothing to create: the case reads the manual.
- The language is Română.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Ajutor și învățare” → „Manual de utilizare” | The heading „Manual de utilizare” and the buttons „Descarcă (Word)” and „Descarcă în engleză (Word)”; on the left „Cuprins” with the thirteen chapters, „1 Introducere” first and „13 Ajutor și învățare” last; on the right „1 Introducere”. The breadcrumb „Acasă › Ajutor și învățare › Manual de utilizare” |
| 2 | In „Cuprins”, presses „2 Primii pași” | The address ends `?s=start`; on the right „2 Primii pași”; in „Cuprins”, under it, its nine sections, „2.1 Conectarea” first and „2.9 Exemple și cazuri de utilizare” last |
| 3 | Presses „2.2 Bara laterală” | The address ends `?s=start-sidebar`; the heading „2.2 Bara laterală” at the top of the view; the table „Secțiunea” / „Ce cuprinde”, its last row „Ajutor și învățare”; under it the picture captioned „Figura 2.1 — Bara laterală, cu secțiunea „Domeniu” deschisă” |
| 4 | In section 2.3, presses the link „2.8” | The address ends `?s=start-help`; the heading „2.8 Ajutorul din spatele „?”” at the top of the view |
| 5 | Types `/manual?s=fig-list` into the address bar | Chapter 2, with the picture captioned „Figura 2.4 — Lista persoanelor fizice, cu „Câmpuri afișate” deschis” in view |
| 6 | Types `/manual?s=nu-exista` into the address bar | „Secțiunea „nu-exista” nu există în manual; s-a deschis primul capitol.” and „1 Introducere” on the right |
| 7 | At the end of chapter 1, presses „Capitolul următor: 2 Primii pași” | „2 Primii pași” on the right; the address ends `?s=start` |
| 8 | Presses „Descarcă (Word)” | A file „Manual de utilizare GA40.docx” is downloaded. Opened, it is a Word document titled „Manual de utilizare”, with „Cuprins”, then the chapters, „1  Introducere” first and „13  Ajutor și învățare” last, and the figures in it |
| 9 | Presses „Descarcă în engleză (Word)” | A file „GA40 User Manual.docx” is downloaded. Opened, it is wholly English: titled „User manual”, with „Contents”, „1  Introduction” first, its figures shot in the English interface, and no „Cuprins” |

## At the end — leaving things as they were found

Nothing to undo: the case reads only. The downloaded file may be deleted.

## Notes from the runs

**2026-10-14 — run 1, `driven` (Slice #39.37).** Driven in the desktop app's browser pane, its viewport
emulated at 1920 × 1080, against `npm run dev` on 3000, by script (`click()` on the sidebar's section and
link, the contents' links and the cross-reference; the address typed for steps 5 and 6). Step 1: the heading,
„Descarcă (Word)", „Cuprins" with 13 chapters from „1 Introducere" to „13 Ajutor și învățare", „1 Introducere"
on the right, the breadcrumb „Acasă › Ajutor și învățare › Manual de utilizare". Step 2: `?s=start`, 9 sections
„2.1 Conectarea" … „2.9 Exemple și cazuri de utilizare". Step 3: `?s=start-sidebar`, the heading at the top of
the view, the table's last row „Ajutor și învățare", Figura 2.1 captioned as above, its picture 224 px wide.
Step 4: the link „2.8", `?s=start-help`, its heading in view. Step 5: Figura 2.4 at the top of the view. Step
6: the sentence above and „1 Introducere". Step 7: `?s=start`. Step 8: the download was caught in the page —
„Manual de utilizare.docx", 626 287 bytes, a ZIP holding word/document.xml with the title, „Cuprins",
„1  Introducere" … „13  Ajutor și învățare" and six pictures; the same package, built from the same six
pictures in the sandbox and opened in LibreOffice, is 21 pages, the chapters each on their own page. The case
file needed no correction.

**2026-10-14 — run 2, `confirmed`.** The same pane and window, every step again, unchanged and green.

**2026-10-14 — `automated`.** `e2e/help/manual.spec.ts`, translated from this file, green in the runner's
targeted run 20261015T005652Z-31201 on a98ef35. Its first run (20261015T005213Z-17172) found the router's
hidden copy of the page before — two `#fig-list` after `page.goto` — and both the screen and the spec now take
the visible one (FU-330).
