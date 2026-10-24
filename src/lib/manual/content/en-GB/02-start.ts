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

Each of the four lists — Natural Persons, Juridical Persons, Properties, Documents — shows 15 objects a page, and the buttons under the table move from page to page. Before each list's title stands an icon of several objects of its kind: a group of people, three buildings, a map with three pins, three pages. The search box at the top of the list says inside what it searches; if the text does not fit, rest the mouse on the box and you read it whole. A list is filtered by its columns: a column that can be filtered has a small funnel in the bottom right corner of its name (section [[properties-list-filters]]). The table's header is two rows of names tall. A column's name stands alone in the middle, across and down; a name too long for its column goes on to the second row. The header, the rows and the buttons on them are compact, so that as many rows as possible fit on the page. The column names are short — „DoB”, „Prop. Type”, „Doc.#” —; rest the mouse on a name and you see the field's whole name, as the form gives it.

„Choose fields” chooses the list's columns: tick what you want to see and untick what you do not need (Figure [[fig-list]]). On all four lists you can also choose „Added on”, the day the object came into the archive. „Open”, on a row, opens the object; the button on the right, above the table, creates a new one. It has no words: a + and the list's icon in the sidebar, with a few rays, as if brand new; under the mouse it shows its whole name — „Add new Person”, „Add new Juridical Person”, „Add new Property”, „Add new Document”.

The lists have no tick boxes, neither on the rows nor at the head of the table: an object is opened from the list and deleted from its own screen. The table starts with its first column with a name; „New!” stands in it, after the text, on the rows of objects added or changed recently.

![2.4 The list of natural persons, with „Choose fields” open](list.png){#fig-list}

Under the list's top bar stands a row with the labels of the filters set — but only while a filter is set; with no filter, the table starts right under the bar. „Clear filters”, on the top bar, right of the order button, removes them all at once; the search and the list's order stay. While no filter is set the button is grey and, under the mouse, says „No filter is on.”. A column's funnel has two looks: unused, the funnel alone, thin; with a filter set on its column, filled, dark blue, in a dark blue circle.

**The list's order.** A list opens with the objects changed most recently first; an object just added counts as changed. The button after „Choose fields” — on „Documents”, after the ⓘ of „Type-specific field:” — says the order: „Recent first”. Pressed, it turns the list round, „Older first”; pressed again, it brings it back. Under the mouse it says what the list is ordered by.

The columns that can be sorted have, in the bottom right corner of their name, left of the funnel, an icon with two arrows, one up and one down: on „Natural Persons” „Added on”, „DoB”, „Age” and „DoD”; on „Juridical Persons” „Added on”; on „Properties” „Added on”, „Tarla”, „Parcelă”, „Supr.Ofic.” and „Supr.Calc.”; on „Documents” „Added on”, „Date”, „Pages”, „Persons” and „Properties”. A click on the icon sorts the whole list by that column — „Added on” from the newest, the others from the smallest number or the oldest date —, and a second click turns the order round. While the list is sorted by a column, its icon has a single thick arrow, dark blue, in a dark blue circle, up or down by the direction, and the button on the bar reads, for instance, „Sorted by Age” (Figure [[fig-list-sorted]]). Pressed, the button brings back the order by the last change. The order is kept in the page's address, like the filters: it stays after you reload the page and after „Back”.

![2.5 The list of natural persons sorted by „Age”: the column's thick arrow in its circle, and the button „Sorted by Age”](list-sorted.png){#fig-list-sorted}

**The list fits the window.** When the window is not tall enough for the whole page of rows, the page no longer scrolls up and down: only the rows scroll, inside the list's frame, by its own scroll bar. The table's header, with the column names and the funnels, stays at the top, and the row „Showing … of …” with „Page x of y” stands right under the frame, in sight. Only in a very short window, where not even the header and three rows would fit, does the page scroll again. The frame keeps its scroll bar's room even while the rows fit — a narrow strip on the right —, so the list does not change width as the bar comes or goes, for instance when you maximise the window. The grey band of column names runs to the frame's edge, across that strip too; after the rows' last button, „Open”, it leaves only as much as the first button leaves from the line on its left. The add button ends at the same right-hand edge.

**Hidden columns.** When the columns chosen are wider than the window, the list also scrolls sideways, by the scroll bar at the frame's bottom. While there are columns out of sight on the right, three red „>” stand one over another at the right edge of the table's header; while there are columns hidden on the left, three „<” stand at its left edge (Figure [[fig-list-fit]]). The signs pulse slowly — they fade a little and come back, about once every two and a half seconds —, so that you notice them without being bothered; while the mouse rests on them they stay still. Rest the mouse on them and a bubble, under the table's header, says what they mean: „More columns to the right. Scroll right to see them.” or „More columns to the left. Scroll left to see them.”. A click on them scrolls the list that way, by nearly as much as shows of it — a little of what was in sight stays in sight —, so a funnel under the signs comes out from under them. They can be reached from the keyboard too, with Tab, and Enter presses them. When every column fits, neither appears.

When you open an object from the list and come back with „Back”, the list is scrolled where you left it, down and sideways.

![2.6 The list of properties in a short, narrow window: the header at the top, „Page x of y” under the frame, and the red signs of the hidden columns at both edges](list-fit.png){#fig-list-fit}

**The columns' widths.** A thin line stands between the columns, from the table's header down to the last row, in the colour of the lines between the rows. In the header the line can be grabbed: rest the mouse on it and the pointer becomes a two-headed arrow, and a bubble says „Drag to widen or narrow the column; a double-click gives it its usual width back.”. Dragged to the right, the line widens the column on its left; dragged to the left, it narrows it, as the mouse moves (Figure [[fig-list-resize]]). The table widens or narrows with it; no column gets narrower than room for the funnel and a few letters. While you drag, nothing under the mouse is pressed.

The width chosen is kept for that list, in this browser, also after the page is reloaded; a column taken out in „Choose fields” finds its width again when you put it back. A double-click on the line gives the column its usual width back. From the keyboard, reach the line with Tab; the left and right arrows narrow or widen it a little at a time, and Home gives it its usual width back.

The line is dragged the same way in every table of this kind: the association screens, „Global Search”, „Users & Access”, „Groups”, „Stamps”, the side-road calculation, the lists in „Reference Data” and the dashboard. Where the table fills a tile or a frame — „Groups”, „Stamps”, the association screens —, what one column gains the wide column, the description or the name, loses, and the table stays as wide as the tile; the wide column has no line of its own to drag.

![2.7 The line between two columns, dragged in the table's header: the column on its left widens](list-resize.png){#fig-list-resize}

**The columns' order.** A column is moved by its name, in the table's header: grab the name with the mouse and drag it left or right. While you hold it, the name follows the mouse, half-transparent, and a blue line shows where it will land (Figure [[fig-list-drag]]); let it go there and the column, with its rows, moves. Any column with a name moves, the ones that are always in the list too; the rows' buttons stay at the end. Near the frame's edge the list scrolls sideways by itself. Esc stops the move, and a name let go far from the table's header moves nothing. A click on a funnel still opens its filter, and the line between columns still changes the width.

The order is kept for that list, in this browser. A column ticked later in „Choose fields” comes at the end; one unticked leaves the order. While you have moved something, „Choose fields” ends with „Default order”, which puts the columns back. From the keyboard, reach the column's name with Tab, and Alt + ← and Alt + → move it one place.

![2.8 A column dragged by its name: its name under the mouse and the line where it will land](list-drag.png){#fig-list-drag}

## 2.6 An object's screen: its tiles {#start-tiles}

An open object shows its data in tiles — panels with a name each, written at the top in capitals, in dark blue (Figure [[fig-record]]). A natural person has, for instance, their identity, „Links”, „Classification”, „Tags and groups” and „Interactions”.

- The tick boxes at the top of the screen choose which tiles show; „All” shows them all, and „Default” returns to the usual set. Your own set is saved in „Settings”, under „My defaults”. The tick boxes stand on two rows: those of one colour together, the buttons at the end of the second row, and the first row a little longer than the second.
- „All up”, left of „All”, raises every tile, from the top down, each in its own columns, to right under the tile above it or to the top. Then, while one column of tiles ends much lower than another, its bottom tile moves under the shortest column — if it fits there and the screen then ends higher (Figures [[fig-all-up-before]] and [[fig-all-up-after]]). The tiles slide to their new places, and the arrangement is kept as after a drag; „Default” undoes it.
- Right of the tick boxes, a small sketch shows the tiles on the screen: one rectangle for each, in its colour, with no name, placed as the tile stands and as tall as it, at one scale for all — a tile twice as tall has a rectangle twice as tall, and no rectangle is so small that it cannot be seen. It changes with the tiles. When the tick boxes fill the row up to the version buttons, the sketch has no room and does not show.
- A rectangle of the sketch is dragged like its tile: press on it and move it — the hand shows it can be grabbed. The tile moves with it on the screen, and its outline shows where it would land; while the place is taken, the rectangle has a red rim. Held still over another rectangle for as long as „Hold time over another tile” says, the tile underneath slides down, on the screen and in the sketch, as with a drag on the screen. Dropped, the tile stays there and is kept as after any drag; Esc, or the rectangle dropped outside the sketch, puts everything back. A plain click on a rectangle does nothing.
- A tile is dragged by its empty space into a free place; a double-click raises it under the tile above.
- To put a tile where another stands, drag it over that one and hold it still: after a second — as long as „Hold time over another tile” in „Settings” says (section [[admin-settings-thresholds]]) — the tile underneath slides down, in its own columns, to the first free place large enough, and the outline shows that the place is free (Figure [[fig-make-room]]). Drop the tile there; Esc puts everything back.
- The light purple tiles — the map, the corners, Street View, a document's pages, a person's interactions — start by the right edge, one under another, and are dragged like any other tile; the place you leave them in is kept, and „Default” puts them back on the right.
- The object's system ID sits in the top right-hand corner of the first tile.
- The button bar, the last thing on the screen, holds the pencil (edit), the save and the bin (delete). An icon button shows its name when the mouse passes over it.

![2.9 A natural person's screen, with its tiles](record.png){#fig-record}

![2.10 A tile held over another: the one underneath has slid down to the first place it fits whole](make-room.png){#fig-make-room}

![2.11 Before „All up”: one tile dragged far from the others](all-up-before.png){#fig-all-up-before}

![2.12 After „All up”: the tiles raised and the columns evened; right of the tick boxes, the sketch of the tiles](all-up-after.png){#fig-all-up-after}

## 2.7 The preview {#start-preview}

A linked object can be opened beside the one you are working on, with „Preview”, without leaving your screen — for instance the buyer, beside the sale contract. At most two previews open at a time, and an unsaved change on the main screen is left untouched. From a list, a row's preview opens beside the table.

## 2.8 The help behind „?” {#start-help}

The „?” button at the end of the navigation bar opens the screen's help: what the screen is for and how it is worked (Figure [[fig-help]]). Where a gesture cannot be seen — a drag, a double-click — a small light bulb beside that place explains it. The help texts are written by the administrator, in „Help Information” (section [[admin-help]]).

![2.13 A screen's help, opened from „?”](help.png){#fig-help}

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
