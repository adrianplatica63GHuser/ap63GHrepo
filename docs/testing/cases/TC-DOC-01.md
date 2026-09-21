# TC-DOC-01 — Act creat, pagină atașată, pagina se deschide

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\01.smoke.one.property` |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A document can be created by hand, a scanned page can be attached to it from disk, and
that page can then be opened and read on screen. This is the path every document that
was **not** imported takes.

## Before you start

- TC-AUTH-01 is green.
- The data folder exists. This case uses **one file** out of it:
  `01.smoke.one.property\40-212per40IE55818-Sud Costache Mihail\CVC Costache S 2008\530.jpg`
  — the first page of a Contract de Vânzare.

## What Adrian is asked for

**One thing, and only if Claude cannot reach the file picker:** place
`530.jpg` somewhere the browser's file dialog can reach, and say where. The operating
system's file dialog is not part of the web page, so it is the one step in this catalogue
that may need a hand on the keyboard.

## The record this case creates

**„Titlu" is `TC-DOC-01 Contract de test`.**

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Acte" in the left sidebar, then „Contract de Vânzare" | The list of documents of that type, and a button „Adaugă act" |
| 2 | Presses „Adaugă act" | The heading „Act nou", with a section „Tip document" and a section „Date generale" |
| 3 | Confirms the type is „Contract de Vânzare" | The type is selected |
| 4 | Types `TC-DOC-01 Contract de test` into „Titlu" | The value appears |
| 5 | Presses „Salvează" | The screen becomes the document's own detail screen, carrying a code |
| 6 | Finds the section „Pagini" | It is empty, with a button „Adaugă pagină" |
| 7 | Presses „Adaugă pagină" | The operating system's file dialog opens. The hint under the control says the dialog shows only images |
| 8 | Chooses `530.jpg` | The page appears in „Pagini", and the indicator reads „1 / 1" |
| 9 | Presses „Pagini extinse" | The page opens large enough to read — a Romanian sale contract, first page |
| 10 | Presses „Restrânge" | The large view closes |

## At the end — leaving things as they were found

**This case leaves one document behind, on purpose** — TC-ASSOC-01, TC-ASSOC-02 and
TC-SRCH-01 use it. Remove it after those: open it, press „Șterge", confirm „Ștergeți" —
which also removes its page.

**It does not touch the data folder.** The file is read, never moved, and never written
back. `C:\dev\TEST.DATA\` is read-only to this catalogue.

## Notes from the runs

_(filled in by the first run)_
