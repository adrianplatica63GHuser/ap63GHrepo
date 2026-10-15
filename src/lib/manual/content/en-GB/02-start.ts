/**
 * Manual, en-GB, chapter 2. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 2 Getting started {#start}

This chapter shows what you use everywhere in the application: signing in, the sidebar, the navigation bar, the lists, a record's tiles and the help. Once you know them, every other screen reads the same way.

## 2.1 Signing in {#start-sign-in}

Open the application in the browser, sign in with your account's e-mail address and password, and press „Conectare”. The dashboard opens (section [[intro-purpose]]).

At the top of the sidebar it says whom you are signed in as („Autentificat ca …”). At its bottom are „Schimbă parola” (change password) and „Ieșire” (sign out).

Someone without an account yet requests access from the sign-in page. The request reaches the administrator, who approves or rejects it in „Utilizatori & Acces” (section [[admin-users]]).

## 2.2 The sidebar {#start-sidebar}

The sidebar, on the left, opens any screen of the application (Figure [[fig-sidebar]]). It is divided into sections:

| Section | What it holds |
|---|---|
| Tablou de bord | The first screen: what is new and what needs attention. |
| Domeniu | The four lists: Persoane Fizice, Persoane Juridice, Proprietăți, Acte. |
| Instrumente | Distilare Tipizate, Calcul drum lateral, Calcul suprafață. |
| Import | Dosare de proprietăți: bringing a whole folder into the archive. |
| Rapoarte | Interacțiuni, Arbori de moștenire, Căutare globală. |
| Administrare | Date de referință, Utilizatori & Acces, Grupuri, Ștampile, Etichete. |
| Setări | The application's thresholds, defaults and costs. |
| Ajutor și învățare | Informații de ajutor and this user manual. |

A click on a section shows its screens, and a click on a screen opens it; the open screen stays marked in the bar. „Restrânge bara laterală” narrows the bar to one icon per section, to leave the screen more room, and „Extinde bara laterală” brings it back.

![2.1 The sidebar, with the „Domeniu” section open](sidebar.png){#fig-sidebar}

## 2.3 The navigation bar and „Înapoi” {#start-breadcrumb}

Above every screen, the navigation bar shows where you are: „Acasă” (home), then the section and the screen — for instance „Acasă › Administrare › Etichete”. A name in the bar that is a link takes you back to that screen (Figure [[fig-breadcrumb]]).

The bar's first button, „Înapoi” (back), returns you to the screen before. If you changed something and did not save it, the application asks first: „Anulează” keeps you on the screen with what you typed, and „Renunță” leaves without saving.

At the right-hand end of the bar is „?”, the screen's help (section [[start-help]]).

![2.2 The navigation bar: „Înapoi”, the way to the screen, and „?”](breadcrumb.png){#fig-breadcrumb}

## 2.4 „Recente” {#start-recent}

„Recente”, at the bottom of the sidebar, holds the records you opened last. A click on „Recente” opens or folds the list, and a click on a record in it opens that record again.

## 2.5 The lists and their columns {#start-lists}

Each of the four lists — Persoane Fizice, Persoane Juridice, Proprietăți, Acte — shows 15 records a page, and the buttons under the table move from page to page. The search box at the top of the list searches by code, by name and, for persons, by e-mail or phone.

„Câmpuri afișate” chooses the list's columns: tick what you want to see and untick what you do not need (Figure [[fig-list]]). „Deschide”, on a row, opens the record; „Adaugă …”, above the table, creates a new one.

The tick box at the head of the table selects the rows of the current page, not of the whole list.

![2.3 The list of natural persons, with „Câmpuri afișate” open](list.png){#fig-list}

## 2.6 A record's screen: its tiles {#start-tiles}

An open record shows its data in tiles — panels with a name each (Figure [[fig-record]]). A natural person has, for instance, their identity, „Corelate”, „Clasificări”, „Conexiuni” and „Interacțiuni”.

- The tick boxes at the top of the screen choose which tiles show; „Toate” shows them all, and „Implicit” returns to the usual set. Your own set is saved in „Setări”, under „Implicitele mele”.
- A tile is dragged by its empty space into a free place; a double-click raises it under the tile above.
- The light purple tiles — the map, the corners, Street View, a document's pages — stay where they are.
- The record's system ID sits in the top right-hand corner of the first tile.
- The button bar, the last thing on the screen, holds the pencil (edit), the save and the bin (delete). An icon button shows its name when the mouse passes over it.

![2.4 A natural person's screen, with its tiles](record.png){#fig-record}

## 2.7 The preview {#start-preview}

A linked record can be opened beside the one you are working on, with „Previzualizare”, without leaving your screen — for instance the buyer, beside the sale contract. At most two previews open at a time, and an unsaved change on the main screen is left untouched. From a list, a row's preview opens beside the table.

## 2.8 The help behind „?” {#start-help}

The „?” button at the end of the navigation bar opens the screen's help: what the screen is for and how it is worked (Figure [[fig-help]]). Where a gesture cannot be seen — a drag, a double-click — a small light bulb beside that place explains it. The help texts are written by the administrator, in „Informații de ajutor” (section [[admin-help]]).

![2.5 A screen's help, opened from „?”](help.png){#fig-help}

## 2.9 Examples and use cases {#start-examples}

### 2.9.1 Find a person by part of their name {#start-example-find}

1. In the sidebar, open „Domeniu”, then „Persoane Fizice”.
2. Type part of the name in the search box.
3. If several persons with the same name remain, add from „Câmpuri afișate” a column that tells them apart, such as the date of birth.
4. Press „Deschide” on the row you want.

### 2.9.2 Leave a screen without losing what you typed {#start-example-back}

1. On a person's screen, change a field without saving.
2. Press „Înapoi”: the application asks what to do with the changes.
3. „Anulează” keeps you on the screen with what you typed. Save, then press „Înapoi” again.

### 2.9.3 Make room on the screen {#start-example-room}

1. Narrow the sidebar with „Restrânge bara laterală”.
2. Untick the tiles you do not need now.
3. When you are done, „Implicit” brings the usual tiles back.
`;
