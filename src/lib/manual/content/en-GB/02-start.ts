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
| Administration | Reference Data, Users & Access, Groups, Stamps, Tags and, last, Settings — the application's thresholds, defaults and costs. |
| Help & learning | Help Information and this user manual. |

A click on a section shows its screens, and a click on a screen opens it; the open screen stays marked in the bar. „Collapse sidebar” narrows the bar to one icon per section, to leave the screen more room, and „Expand sidebar” brings it back.

![2.1 The sidebar, with the „Domain” section open](sidebar.png){#fig-sidebar}

At the top, in the middle of the bar, two flags, one above the other, change the screens' language; at the left, under „GA40”, stands the box „Night”: ticked, the whole application turns dark at once, without reloading the page; unticked, it is light again (Figure [[fig-dark]]). The choice is kept in this browser, also after you close it, and is changed the same way in „Settings”, under „Appearance” (section [[admin-settings-account]]). The computer's own colour setting no longer counts: unticked, the application is light. With the sidebar collapsed, the flags and the box do not show.

![2.2 The dashboard with „Night” ticked](dark.png){#fig-dark}

## 2.3 The navigation bar and „Back” {#start-breadcrumb}

Above every screen, the navigation bar shows where you are: „Home”, then the section and the screen — for instance „Home › Administration › Tags”. A name in the bar that is a link takes you back to that screen (Figure [[fig-breadcrumb]]).

The bar's first button, „Back”, returns you to the screen before. If you changed something and did not save it, the application asks first: „Cancel” keeps you on the screen with what you typed, and „Discard” leaves without saving.

Right beside it, „Forward” goes the other way. Once you have gone back with „Back” — or with the browser's own back button —, it takes you again to the screen you left. Until then it is grey and cannot be pressed, and a new screen you open makes it grey again, like the browser's forward button. It too asks first when you have unsaved changes.

At the right-hand end of the bar is „?”, the screen's help (section [[start-help]]).

![2.3 The navigation bar: „Back”, „Forward”, the way to the screen, and „?”](breadcrumb.png){#fig-breadcrumb}

## 2.4 „Recently viewed” {#start-recent}

„Recently viewed”, at the bottom of the sidebar, holds the objects you opened last. A click on „Recently viewed” opens or folds the list, and a click on an object in it opens that object again.

## 2.5 The lists and their columns {#start-lists}

Each of the four lists — Natural Persons, Juridical Persons, Properties, Documents — shows 15 objects a page, and the buttons under the table move from page to page. The search box at the top of the list is as wide as the „Add new …” button at the row's end and says inside what it searches; if the text does not fit, rest the mouse on the box and you read it whole. A list is filtered by its columns: a column that can be filtered has a funnel under its name (section [[properties-list-filters]]). The table's header is two rows tall. A column's name and, on a column that can be filtered, the funnel after it stand together in the middle, across and down; a name too long for its column goes on to the second row, and the funnel stays beside the last row. The column names are short — „DoB”, „Prop. Type”, „Doc.#” —; rest the mouse on a name and you see the field's whole name, as the form gives it.

„Choose fields” chooses the list's columns: tick what you want to see and untick what you do not need (Figure [[fig-list]]). „Open”, on a row, opens the object; „Add new …”, above the table, creates a new one.

The lists have no tick boxes, neither on the rows nor at the head of the table: an object is opened from the list and deleted from its own screen. The table starts with its first column with a name; „New!” stands in it, after the text, on the rows of objects added or changed recently.

![2.4 The list of natural persons, with „Choose fields” open](list.png){#fig-list}

Under the list's top bar stands a row with the labels of the filters set and „Clear filters” — but only while a filter is set; with no filter, the table starts right under the bar.

**The list fits the window.** When the window is not tall enough for the whole page of rows, the page no longer scrolls up and down: only the rows scroll, inside the list's frame, by its own scroll bar. The table's header, with the column names and the funnels, stays at the top, and the row „Showing … of …” with „Page x of y” stands right under the frame, in sight. Only in a very short window, where not even the header and three rows would fit, does the page scroll again. The frame keeps its scroll bar's room even while the rows fit — a narrow strip on the right —, so the list does not change width as the bar comes or goes, for instance when you maximise the window.

**Hidden columns.** When the columns chosen are wider than the window, the list also scrolls sideways, by the scroll bar at the frame's bottom. While there are columns out of sight on the right, three red „>” stand one over another at the right edge of the table's header; while there are columns hidden on the left, three „<” stand at its left edge (Figure [[fig-list-fit]]). The signs pulse slowly — they fade a little and come back, about once every two and a half seconds —, so that you notice them without being bothered; while the mouse rests on them they stay still. Rest the mouse on them and a bubble, under the table's header, says what they mean: „More columns to the right. Scroll right to see them.” or „More columns to the left. Scroll left to see them.”. A click on them scrolls the list that way, by nearly as much as shows of it — a little of what was in sight stays in sight —, so a funnel under the signs comes out from under them. They can be reached from the keyboard too, with Tab, and Enter presses them. When every column fits, neither appears.

When you open an object from the list and come back with „Back”, the list is scrolled where you left it, down and sideways.

![2.5 The list of properties in a short, narrow window: the header at the top, „Page x of y” under the frame, and the red signs of the hidden columns at both edges](list-fit.png){#fig-list-fit}

**The columns' widths.** A thin line stands between the columns, from the table's header down to the last row, in the colour of the lines between the rows. In the header the line can be grabbed: rest the mouse on it and the pointer becomes a two-headed arrow, and a bubble says „Drag to widen or narrow the column; a double-click gives it its usual width back.”. Dragged to the right, the line widens the column on its left; dragged to the left, it narrows it, as the mouse moves (Figure [[fig-list-resize]]). The table widens or narrows with it; no column gets narrower than room for the funnel and a few letters. While you drag, nothing under the mouse is pressed.

The width chosen is kept for that list, in this browser, also after the page is reloaded; a column taken out in „Choose fields” finds its width again when you put it back. A double-click on the line gives the column its usual width back. From the keyboard, reach the line with Tab; the left and right arrows narrow or widen it a little at a time, and Home gives it its usual width back.

The line is dragged the same way in every table of this kind: the association screens, „Global Search”, „Users & Access”, „Groups”, „Stamps”, the side-road calculation, the lists in „Reference Data” and the dashboard. Where the table fills a tile or a frame — „Groups”, „Stamps”, the association screens —, what one column gains the wide column, the description or the name, loses, and the table stays as wide as the tile; the wide column has no line of its own to drag.

![2.6 The line between two columns, dragged in the table's header: the column on its left widens](list-resize.png){#fig-list-resize}

**The columns' order.** A column is moved by its name, in the table's header: grab the name with the mouse and drag it left or right. While you hold it, the name follows the mouse, half-transparent, and a blue line shows where it will land (Figure [[fig-list-drag]]); let it go there and the column, with its rows, moves. Any column with a name moves, the ones that are always in the list too; the rows' buttons stay at the end. Near the frame's edge the list scrolls sideways by itself. Esc stops the move, and a name let go far from the table's header moves nothing. A click on a funnel still opens its filter, and the line between columns still changes the width.

The order is kept for that list, in this browser. A column ticked later in „Choose fields” comes at the end; one unticked leaves the order. While you have moved something, „Choose fields” ends with „Default order”, which puts the columns back. From the keyboard, reach the column's name with Tab, and Alt + ← and Alt + → move it one place.

![2.7 A column dragged by its name: its name under the mouse and the line where it will land](list-drag.png){#fig-list-drag}

## 2.6 An object's screen: its tiles {#start-tiles}

An open object shows its data in tiles — panels with a name each, written at the top in capitals, in dark blue (Figure [[fig-record]]). A natural person has, for instance, their identity, „Links”, „Classification”, „Tags and groups” and „Interactions”.

- The tick boxes at the top of the screen choose which tiles show; „All” shows them all, and „Default” returns to the usual set. Your own set is saved in „Settings”, under „My defaults”.
- A tile is dragged by its empty space into a free place; a double-click raises it under the tile above.
- To put a tile where another stands, drag it over that one and hold it still: after a second — as long as „Hold time over another tile” in „Settings” says (section [[admin-settings-thresholds]]) — the tile underneath slides down, in its own columns, to the first free place large enough, and the outline shows that the place is free (Figure [[fig-make-room]]). Drop the tile there; Esc puts everything back. The light purple tiles do not move aside.
- The light purple tiles — the map, the corners, Street View, a document's pages — stay where they are.
- The object's system ID sits in the top right-hand corner of the first tile.
- The button bar, the last thing on the screen, holds the pencil (edit), the save and the bin (delete). An icon button shows its name when the mouse passes over it.

![2.8 A natural person's screen, with its tiles](record.png){#fig-record}

![2.9 A tile held over another: the one underneath has slid down to the first place it fits whole](make-room.png){#fig-make-room}

## 2.7 The preview {#start-preview}

A linked object can be opened beside the one you are working on, with „Preview”, without leaving your screen — for instance the buyer, beside the sale contract. At most two previews open at a time, and an unsaved change on the main screen is left untouched. From a list, a row's preview opens beside the table.

## 2.8 The help behind „?” {#start-help}

The „?” button at the end of the navigation bar opens the screen's help: what the screen is for and how it is worked (Figure [[fig-help]]). Where a gesture cannot be seen — a drag, a double-click — a small light bulb beside that place explains it. The help texts are written by the administrator, in „Help Information” (section [[admin-help]]).

![2.10 A screen's help, opened from „?”](help.png){#fig-help}

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
