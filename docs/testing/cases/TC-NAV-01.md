# TC-NAV-01 — Bara laterală arată doar ce există: șase secțiuni, fiecare legătură își deschide ecranul, niciun „În curând"

| | |
|---|---|
| **Area** | nav |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-06 |

## What this proves

Since Slice #38.42 the left sidebar draws only what exists. Top to bottom it reads six sections:
„Tablou de bord", „Domeniu", „Instrumente" (called „Funcții" until #38.42), „Import", „Administrare"
and „Setări".
- **Placeholders are not drawn.** An item whose screen is not built draws nothing, and neither does a
  section left empty by that. So „Rapoarte", „Studiu" and „Ajutor" are gone, and so are the four
  placeholders inside „Instrumente" and „Import". (#38.20 had drawn them disabled, with „În curând" as
  the tooltip.)
- **„Date de referință" is under „Administrare".**
- **Every screen that exists is still reachable from the sidebar,** and opening it lights up its item.
- **The Reports page still opens from its address.**
- **A breadcrumb names the section that holds the screen.**
- **Collapsed, the sidebar shows one icon per section.**

The defect is any of these: a screen that cannot be reached; a placeholder drawn; a section that is
missing, empty or out of order.

## Before you start

- TC-AUTH-01 is green; signed in as the superuser (a `user`'s reach is #38.21's, and jest's until then).
- Nothing to create: the case reads the sidebar and the screens it opens.
- The window is **1920 × 1080**; the language is Română.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Looks at the sidebar | Top to bottom: „Tablou de bord", „Domeniu", „Instrumente", „Import", „Administrare", „Setări" — no „Funcții", „Rapoarte", „Studiu" or „Ajutor" |
| 2 | Opens each section in turn | „Domeniu": Persoane Fizice, Persoane Juridice, Proprietăți, Acte. „Instrumente": Căutare globală, Distilare Tipizate, Calcul drum lateral. „Import": Dosare de proprietăți. „Administrare": Date de referință, Utilizatori & Acces, Grupuri, Ștampile, Etichete, Informații de ajutor. No item is drawn faded, and nothing says „În curând" |
| 3 | Presses each link in turn: „Tablou de bord", the four of „Domeniu", the three of „Instrumente", „Dosare de proprietăți", the six of „Administrare", „Setări" | Each opens its screen — its title „Tablou de bord", „Persoană fizică", „Persoană juridică", „Proprietăți", „Acte", „Căutare globală", „Distilare Tipizate", „Calcul", „Import", „Date de referință", „Utilizatori & Acces", „Grupuri", „Ștampile", „Etichete", „Informații de ajutor", „Setări" — and the item pressed is the sidebar's active one |
| 4 | Types `/reports` into the address bar | „Rapoarte — în lucru", then five paragraphs: „Aici veți putea pune arhivei întrebări de business și primi răspunsurile ca tabele și grafice." … „Nu e nevoie de cunoștințe tehnice: alegeți ce vreți să aflați, iar sistemul face analiza." The breadcrumb „Acasă › Rapoarte" |
| 5 | „Setări" | „Setări" with „Praguri de timp" (#38.40; #38.41 put „Contul meu" first); no „Altele" and no links to Grupuri, Ștampile or Etichete. The breadcrumb „Acasă › Setări" |
| 6 | „Restrânge bara laterală" | Six icons, one per section, each named by its section; then „Extinde bara laterală" |
| 7 | „Administrare" → „Etichete"; „Instrumente" → „Căutare globală"; „Administrare" → „Date de referință"; „Import" → „Dosare de proprietăți" | The breadcrumb names the section: „Acasă › Administrare › Etichete", „Acasă › Instrumente › Căutare globală", „Acasă › Administrare › Date de referință" — the section as plain text, not a link (it has no screen); „Acasă › Import" (the section is not said twice) |

## At the end — leaving things as they were found

Nothing was created. The sidebar is left expanded.

## Notes from the runs

**2026-10-08 — Slice #38.42, rewritten.** The case was „nine sections, every placeholder disabled";
the sidebar now draws only what exists, so steps 1–4 and 7–8 changed and the old steps 4–5 became
step 4 (the Reports page by its address). The runs below are of the nine-section case.

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

**2026-10-06 — `automated`.** `e2e/ui/sidebar-nine-sections.spec.ts`, translated from this file, green
inside a whole `npm run e2e`: the runner's full run 20261006T194613Z-28897 on 6712163 (100 passed).

**2026-10-06 — Slice #38.22, step 6 driven twice.** The developer-notes panel is gone from every
build, so Settings holds „Intervale de timp" alone. Driven twice in the browser pane by script
(„Tablou de bord", then „Setări"): headings „Setări" and „Intervale de timp", no „dezvoltator", no
„Altele", no link in the page body — the same both times. The spec asserted only „Intervale de
timp" and no „Altele", so it is unchanged.
