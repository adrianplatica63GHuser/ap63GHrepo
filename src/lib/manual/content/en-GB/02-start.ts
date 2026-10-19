/**
 * Manual, en-GB, chapter 2. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 2 Getting started {#start}

This chapter shows what you use everywhere in the application: signing in, the sidebar, the navigation bar, the lists, an object's tiles and the help. Once you know them, every other screen reads the same way.

## 2.1 Signing in {#start-sign-in}

Open the application in the browser, sign in with your account's e-mail address and password, and press „Sign in”. The dashboard opens (section [[intro-purpose]]).

At the top of the sidebar it says whom you are signed in as („Signed in as …”). At its bottom are „Change password” and „Sign out”.

Someone without an account yet requests access from the sign-in page. The request reaches the administrator, who approves or rejects it in „Users & Access” (section [[admin-users]]).

## 2.2 The sidebar {#start-sidebar}

The sidebar, on the left, opens any screen of the application (Figure [[fig-sidebar]]). It is divided into sections:

| Section | What it holds |
|---|---|
| Dashboard | The first screen: what is new and what needs attention. |
| Domain | The four lists: Natural Persons, Juridical Persons, Properties, Documents. |
| Tools | DocTypeEngine, Calculation of a Side Road, Measurements on map, Groupings of properties, Navigation. |
| Import | Property folders: bringing a whole folder into the archive. |
| Reporting | Interactions, Inheritance trees, Global Search. |
| Administration | Reference Data, Users & Access, Groups, Stamps, Tags. |
| Settings | The application's thresholds, defaults and costs. |
| Help & learning | Help Information and this user manual. |

A click on a section shows its screens, and a click on a screen opens it; the open screen stays marked in the bar. „Collapse sidebar” narrows the bar to one icon per section, to leave the screen more room, and „Expand sidebar” brings it back.

![2.1 The sidebar, with the „Domain” section open](sidebar.png){#fig-sidebar}

## 2.3 The navigation bar and „Back” {#start-breadcrumb}

Above every screen, the navigation bar shows where you are: „Home”, then the section and the screen — for instance „Home › Administration › Tags”. A name in the bar that is a link takes you back to that screen (Figure [[fig-breadcrumb]]).

The bar's first button, „Back”, returns you to the screen before. If you changed something and did not save it, the application asks first: „Cancel” keeps you on the screen with what you typed, and „Discard” leaves without saving.

At the right-hand end of the bar is „?”, the screen's help (section [[start-help]]).

![2.2 The navigation bar: „Back”, the way to the screen, and „?”](breadcrumb.png){#fig-breadcrumb}

## 2.4 „Recently viewed” {#start-recent}

„Recently viewed”, at the bottom of the sidebar, holds the objects you opened last. A click on „Recently viewed” opens or folds the list, and a click on an object in it opens that object again.

## 2.5 The lists and their columns {#start-lists}

Each of the four lists — Natural Persons, Juridical Persons, Properties, Documents — shows 15 objects a page, and the buttons under the table move from page to page. The search box at the top of the list is as wide as the „Add new …” button at the row's end and says inside what it searches; if the text does not fit, rest the mouse on the box and you read it whole. A list is filtered by its columns: a column that can be filtered has a funnel under its name (section [[properties-list-filters]]). The table's header is three rows tall: the name on the first two, the funnel on the third, and the name of a column with no filter stands in the middle.

„Choose fields” chooses the list's columns: tick what you want to see and untick what you do not need (Figure [[fig-list]]). „Open”, on a row, opens the object; „Add new …”, above the table, creates a new one.

The tick box at the head of the table selects the rows of the current page, not of the whole list.

![2.3 The list of natural persons, with „Choose fields” open](list.png){#fig-list}

## 2.6 An object's screen: its tiles {#start-tiles}

An open object shows its data in tiles — panels with a name each (Figure [[fig-record]]). A natural person has, for instance, their identity, „Links”, „Classification”, „Tags and groups” and „Interactions”.

- The tick boxes at the top of the screen choose which tiles show; „All” shows them all, and „Default” returns to the usual set. Your own set is saved in „Settings”, under „My defaults”.
- A tile is dragged by its empty space into a free place; a double-click raises it under the tile above.
- To put a tile where another stands, drag it over that one and hold it still: after a second — as long as „Hold time over another tile” in „Settings” says (section [[admin-settings-thresholds]]) — the tile underneath slides down, in its own columns, to the first free place large enough, and the outline shows that the place is free (Figure [[fig-make-room]]). Drop the tile there; Esc puts everything back. The light purple tiles do not move aside.
- The light purple tiles — the map, the corners, Street View, a document's pages — stay where they are.
- The object's system ID sits in the top right-hand corner of the first tile.
- The button bar, the last thing on the screen, holds the pencil (edit), the save and the bin (delete). An icon button shows its name when the mouse passes over it.

![2.4 A natural person's screen, with its tiles](record.png){#fig-record}

![2.5 A tile held over another: the one underneath has slid down to the first place it fits whole](make-room.png){#fig-make-room}

## 2.7 The preview {#start-preview}

A linked object can be opened beside the one you are working on, with „Preview”, without leaving your screen — for instance the buyer, beside the sale contract. At most two previews open at a time, and an unsaved change on the main screen is left untouched. From a list, a row's preview opens beside the table.

## 2.8 The help behind „?” {#start-help}

The „?” button at the end of the navigation bar opens the screen's help: what the screen is for and how it is worked (Figure [[fig-help]]). Where a gesture cannot be seen — a drag, a double-click — a small light bulb beside that place explains it. The help texts are written by the administrator, in „Help Information” (section [[admin-help]]).

![2.6 A screen's help, opened from „?”](help.png){#fig-help}

## 2.9 Examples and use cases {#start-examples}

### 2.9.1 Find a person by part of their name {#start-example-find}

1. In the sidebar, open „Domain”, then „Natural Persons”.
2. Type part of the name in the search box.
3. If several persons with the same name remain, add from „Choose fields” a column that tells them apart, such as the date of birth.
4. Press „Open” on the row you want.

### 2.9.2 Leave a screen without losing what you typed {#start-example-back}

1. On a person's screen, change a field without saving.
2. Press „Back”: the application asks what to do with the changes.
3. „Cancel” keeps you on the screen with what you typed. Save, then press „Back” again.

### 2.9.3 Make room on the screen {#start-example-room}

1. Narrow the sidebar with „Collapse sidebar”.
2. Untick the tiles you do not need now.
3. When you are done, „Default” brings the usual tiles back.
`;
