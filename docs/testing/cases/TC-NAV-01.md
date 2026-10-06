# TC-NAV-01 — Bara laterală în nouă secțiuni: fiecare legătură își deschide ecranul, fiecare „În curând" e inactiv, „Rapoarte" → „În lucru" arată textul

| | |
|---|---|
| **Area** | nav |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-06 |

## What this proves

Since Slice #38.20 the left sidebar reads, top to bottom, nine sections: „Tablou de bord", „Domeniu",
„Funcții", „Import", „Rapoarte", „Administrare", „Setări", „Studiu", „Ajutor". Every screen that exists
is reachable from it, and opening it lights up its item. An item whose screen does not exist yet is
drawn disabled, „În curând" as its tooltip, and pressing it goes nowhere. „Rapoarte" → „În lucru" opens
a page that says, in a business user's words, what reports will offer. „Setări" no longer has
„Altele". A breadcrumb names the section that holds the screen, where it said „Admin". Collapsed, the sidebar shows one icon per section. A screen that cannot be reached, a
placeholder that navigates, or a section missing or out of order is the defect.

## Before you start

- TC-AUTH-01 is green; signed in as the superuser (a `user`'s reach is #38.21's, and jest's until then).
- Nothing to create: the case reads the sidebar and the screens it opens.
- The window is **1920 × 1080**; the language is Română.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Looks at the sidebar | Top to bottom: „Tablou de bord", „Domeniu", „Funcții", „Import", „Rapoarte", „Administrare", „Setări", „Studiu", „Ajutor" |
| 2 | Opens each section in turn | „Domeniu": Persoane Fizice, Persoane Juridice, Proprietăți, Acte, Date de referință. „Funcții": Căutare globală, Distilare Tipizate, Verificare corelări, Calcul drum lateral, Arbori de moștenire. „Import": Dosare de proprietăți, Dosare diverse, Fișier individual. „Rapoarte": În lucru. „Administrare": Utilizatori & Acces, Grupuri, Ștampile, Etichete, Informații de ajutor. „Studiu": Cursuri, Chestionare, Punctaj. „Ajutor": Manual de utilizare, Întreabă AI |
| 3 | Presses each link in turn: „Tablou de bord", the five of „Domeniu", „Căutare globală", „Distilare Tipizate", „Calcul drum lateral", „Dosare de proprietăți", „În lucru", the five of „Administrare", „Setări" | Each opens its screen — its title „Tablou de bord", „Persoană fizică", „Persoană juridică", „Proprietăți", „Acte", „Date de referință", „Căutare globală", „Distilare Tipizate", „Calcul", „Import", „Rapoarte — în lucru", „Utilizatori & Acces", „Grupuri", „Ștampile", „Etichete", „Informații de ajutor", „Setări" — and the item pressed is the sidebar's active one |
| 4 | Points at each of the nine placeholders (Verificare corelări, Arbori de moștenire, Dosare diverse, Fișier individual, Cursuri, Chestionare, Punctaj, Manual de utilizare, Întreabă AI), then presses it | Each drawn faded, the cursor „not allowed"; the tooltip „În curând"; pressing it leaves the page where it was |
| 5 | „Rapoarte" → „În lucru" | „Rapoarte — în lucru", then five paragraphs: „Aici veți putea pune arhivei întrebări de business și primi răspunsurile ca tabele și grafice." … „Nu e nevoie de cunoștințe tehnice: alegeți ce vreți să aflați, iar sistemul face analiza." The breadcrumb „Acasă › Rapoarte" |
| 6 | „Setări" | „Setări" with „Intervale de timp" and „Opțiuni pentru dezvoltator"; no „Altele" and no links to Grupuri, Ștampile or Etichete. The breadcrumb „Acasă › Setări" |
| 7 | „Restrânge bara laterală" | Nine icons, one per section, each named by its section; then „Extinde bara laterală" |
| 8 | „Administrare" → „Etichete"; „Funcții" → „Căutare globală"; „Domeniu" → „Date de referință"; „Import" → „Dosare de proprietăți" | The breadcrumb names the section, not „Admin": „Acasă › Administrare › Etichete", „Acasă › Funcții › Căutare globală", „Acasă › Domeniu › Date de referință" — the section as plain text, not a link (it has no screen); „Acasă › Import" (the section is not said twice) |

## At the end — leaving things as they were found

Nothing was created. The sidebar is left expanded.

## Notes from the runs

**2026-10-06 — run 1, `driven` (Slice #38.20).** Driven in the desktop app's browser pane, its viewport
emulated at 1920 × 1080, against `npm run dev` on 3000, by script (FU-290: `click()` on the section
buttons and links, a dispatched `pointerover` for the tooltips).
- Steps 1–2: the nine sections and their items as above; every placeholder `aria-disabled="true"`,
  in tab order.
- Step 3: all seventeen links opened their screens with the titles above; `aria-current="page"` on the
  item pressed each time. (Two links first came back wrong — „Date de referință" lit nothing, „Grupuri"
  landed on „Ștampile" — because an earlier script that had timed out was still clicking in the same
  page. Re-driven alone, both were right.)
- Step 4: all nine: tooltip „În curând", `cursor: not-allowed`, opacity 0.6, the address unchanged.
- Step 5: the title and five paragraphs, the breadcrumb „Acasă › Rapoarte".
- Step 6: headings „Setări", „Intervale de timp", „Opțiuni pentru dezvoltator"; no „Altele"; no link in
  the page body.
- Step 7: nine rows, icons `layout-dashboard`, `database`, `workflow`, `upload`, `chart-column`,
  `shield-check`, `settings`, `graduation-cap`, `life-buoy`, each named by its section. The language
  was switched to English by mistake on the way (the sections read „Dashboard" … „Help", as en-GB
  says) and back.

**2026-10-06 — run 2, `confirmed`.** The same pane and window, every step again, unchanged (steps 3–4
in one script, then 5, then 1, 2, 6 and 7 in another): the nine sections and their items as in run 1;
all seventeen links right first time, each its item active; all nine placeholders as in run 1; the
Reports page and its breadcrumb as in run 1; Settings without „Altele" and with no link in its body;
collapsed, the nine icons named „Tablou de bord" … „Ajutor", then „Extinde bara laterală" brought the
sidebar back.

**2026-10-06 — steps 6 (its breadcrumb) and 8, added after run 2, each driven twice.** The pictures
showed „Acasă › Admin › Setări": „Admin" named the two „Admin-…" sections that no longer exist. The
crumb now names the section that holds the screen. Driven twice in the same pane (its own size), by
script: „Acasă › Administrare › Etichete", „Acasă › Funcții › Căutare globală", „Acasă › Domeniu ›
Date de referință" — the middle crumb a `<span>`, not a link — „Acasă › Setări" and „Acasă › Import",
the same both times.
