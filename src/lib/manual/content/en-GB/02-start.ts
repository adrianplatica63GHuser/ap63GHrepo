/**
 * Manual, en-GB, chapter 2. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 2 Getting started {#start}

This chapter shows what you use everywhere in the application: signing in, the sidebar, the navigation bar, the lists, an object's tiles and the help. Once you know them, every other screen reads the same way.

## 2.1 Signing in {#start-sign-in}

Open the application in the browser, sign in with your account's e-mail address and password, and press „Sign in”. The dashboard opens (section [[intro-purpose]]).

At the bottom of the sidebar stands your account: the icon of a person, the name you are signed in as and an arrow. A click on it opens a small menu upwards: first „Signed in as …”, then „Sign out” (Figure [[fig-account-menu]]); while the sidebar is collapsed, the menu holds „Language” and „Appearance” too (section [[start-sidebar]]). Esc or a click outside the menu closes it. The password is changed in „Settings” (section [[admin-settings-account]]).

![2.1 The account menu, opened from the bottom of the sidebar](account-menu.png){#fig-account-menu}

Someone without an account yet requests access from the sign-in page. The request reaches the administrator, who approves or rejects it in „Users & Access” (section [[admin-users]]).

## 2.2 The sidebar {#start-sidebar}

The sidebar, on the left, opens any screen of the application (Figure [[fig-sidebar]]). At the top it holds „GA40”, the two small switches „Language” and „Appearance”, and the button that collapses it; at the bottom, the account (section [[start-sign-in]]). It is divided into sections:

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

![2.2 The sidebar, with the „Domain” section open](sidebar.png){#fig-sidebar}

At the top of the sidebar, beside „GA40”, „Language” has two words, RO and EN: the language you work in is filled in dark slate, with white letters, and a click on the other changes the screens' language. „Appearance” has a sun and a moon — „Day” and „Night”, as their hover hints say: „Night” turns the whole application dark at once, without reloading the page, and „Day” makes it light again (Figure [[fig-dark]]). The choice is kept in this browser, also after you close it, and is changed the same way in „Settings”, with the box „Night (Dark Mode)” (section [[admin-settings-account]]). The computer's own colour setting does not count: without „Night”, the application is light. While the sidebar is collapsed to its icons, the two switches move into the account menu (section [[start-sign-in]]).

In a narrow window, under 1024 pixels, the sidebar is always collapsed to its icons. „Expand sidebar” then opens it over the page, which darkens; Esc, a click on the page or a chosen screen collapses it again. When you widen the window, the sidebar is back as you left it.

![2.3 The dashboard in „Night”](dark.png){#fig-dark}

## 2.3 The navigation bar and „Back” {#start-breadcrumb}

Above every screen, the navigation bar shows where you are: „Home”, then the section and the screen — for instance „Home › Administration › Tags”. A name in the bar that is a link takes you back to that screen (Figure [[fig-breadcrumb]]).

The bar's first button, „Back”, returns you to the screen before. If you changed something and did not save it, the application asks first: „Cancel” keeps you on the screen with what you typed, and „Discard” leaves without saving.

Right beside it, „Forward” goes the other way. Once you have gone back with „Back” — or with the browser's own back button —, it takes you again to the screen you left. Until then it is grey and cannot be pressed, and a new screen you open makes it grey again, like the browser's forward button. It too asks first when you have unsaved changes.

At the right-hand end of the bar is „?”, the screen's help (section [[start-help]]). On the screen of a person, a firm, a property or a document, left of „?” stand the object's versions — „Previous version”, „v 2”, „Next version” — and „Panels” (sections [[links-versions]] and [[start-tiles]]); the object's name stays at the top of the screen.

The bar always stays at the top: when you scroll a long screen, the tiles pass under it, and „Back”, the versions, „Panels” and „?” stay within reach. In a narrow window the bar stays on one line: the names in the way shorten first, the earlier ones down to „…”, then the last; hold the mouse on one to read it whole.

![2.4 The navigation bar: „Back”, „Forward”, the way to the screen, the versions, „Panels” and „?”](breadcrumb.png){#fig-breadcrumb}

## 2.4 „Recently viewed” {#start-recent}

„Recently viewed”, at the bottom of the sidebar, holds the objects you opened last. A click on „Recently viewed” opens or folds the list, and a click on an object in it opens that object again.

## 2.5 The lists and their columns {#start-lists}

Each of the four lists — Natural Persons, Juridical Persons, Properties, Documents — shows on a page as many rows as fit in the window, but never fewer than 10, and the buttons under the table move from page to page. When you resize the window, the page fits itself again and stays on the rows you had in view. Before each list's title stands an icon of several objects of its kind: a group of people, three buildings, a map with three pins, three pages. The search box at the top of the list says inside what it searches; if the text does not fit, rest the mouse on the box and you read it whole. A list is filtered by its columns: a column that can be filtered has a small funnel in the bottom right corner of its name (section [[properties-list-filters]]). The table's header is two rows of names tall. A column's name stands alone in the middle, across and down; a name too long for its column goes on to the second row. The header, the rows and the buttons on them are compact, so that as many rows as possible fit on the page. The column names are short — „DoB”, „Prop. Type”, „Doc.#” —; rest the mouse on a name and you see the field's whole name, as the form gives it.

„Choose fields” chooses the list's columns: tick what you want to see and untick what you do not need (Figure [[fig-list]]). Until you choose otherwise, each list opens on four columns: the properties on the parcel block, the parcel, the property type and the locality; the natural persons on the CNP, the date of birth, the professional type and the date last modified; the juridical persons on the type, the CUI, the locality and the date last modified; the documents on the number, the date, the institution and the date last modified. On all four lists you can also choose „Modified on”, the day the object was last changed; its adding counts as a change, so it is the very date the list is ordered by when it opens. „Documents” also has „Added on”, the day the document came into the archive. The object's name, on its row, is a link: a click on it, or anywhere on the row, opens the object, and Ctrl + click or a middle click opens it in a new tab. On „Documents” the link is the document's title. The row's other three buttons — „Preview”, „Peek inside” and „Links” — stay faded and light up on the row under the mouse. The button on the right, above the table, creates a new object. It has no words: a + and the list's icon in the sidebar, with a few rays, as if brand new; under the mouse it shows its whole name — „Add new Person”, „Add new Juridical Person”, „Add new Property”, „Add new Document”.

The lists have no tick boxes, neither on the rows nor at the head of the table: an object is opened from the list and deleted from its own screen. The table starts with its first column with a name; „New!” stands in it, after the text, on the rows of objects added or changed recently.

![2.5 The list of natural persons, with „Choose fields” open](list.png){#fig-list}

Under the list's top bar stands a row with the labels of the filters set — but only while a filter is set; with no filter, the table starts right under the bar. „Clear filters”, on the top bar, right of the order button, removes them all at once; the search and the list's order stay. While no filter is set the button is grey and, under the mouse, says „No filter is on.”. A column's funnel has two looks: unused, the funnel alone, thin; with a filter set on its column, filled, dark blue, in a dark blue circle.

**The list's order.** A list opens with the objects changed most recently first; an object just added counts as changed. The button after „Choose fields” — on „Documents”, after the ⓘ of „Type-specific field:” — says the order: „Recent first”. Pressed, it turns the list round, „Older first”; pressed again, it brings it back. Under the mouse it says what the list is ordered by.

The columns that can be sorted have, in the bottom right corner of their name, left of the funnel, an icon with two arrows, one up and one down: on „Natural Persons” „Modified on”, „DoB”, „Age” and „DoD”; on „Juridical Persons” „Modified on”; on „Properties” „Modified on”, „Tarla”, „Parcelă”, „Supr.Ofic.” and „Supr.Calc.”; on „Documents” „Modified on”, „Added on”, „Date”, „Pages”, „Persons” and „Properties”. A click on the icon sorts the whole list by that column — „Added on” from the newest, the others from the smallest number or the oldest date —, and a second click turns the order round. „Modified on” is the very order the list opens in: while the list stands in „Recent first”, its icon keeps the two arrows, and a click on it turns the list round, „Older first”, as the button on the bar does. While the list is sorted by a column, its icon has a single thick arrow, dark blue, in a dark blue circle, up or down by the direction, and the button on the bar reads, for instance, „Sorted by Age” (Figure [[fig-list-sorted]]). Pressed, the button brings back the order by the last change. The order is kept in the page's address, like the filters: it stays after you reload the page and after „Back”.

![2.6 The list of natural persons sorted by „Age”: the column's thick arrow in its circle, and the button „Sorted by Age”](list-sorted.png){#fig-list-sorted}

**The list fits the window.** When the window is not tall enough for the whole page of rows, the page no longer scrolls up and down: only the rows scroll, inside the list's frame, by its own scroll bar. The table's header, with the column names and the funnels, stays at the top, and the row „Showing … of …” with „Page x of y” stands right under the frame, in sight. Only in a very short window, where not even the header and three rows would fit, does the page scroll again. The frame keeps its scroll bar's room even while the rows fit — a narrow strip on the right —, so the list does not change width as the bar comes or goes, for instance when you maximise the window. The grey band of column names runs to the frame's edge, across that strip too; after the rows' last button, „Links”, it leaves only as much as the first button leaves from the line on its left. The add button ends at the same right-hand edge.

**Hidden columns.** When the columns chosen are wider than the window, the list also scrolls sideways, by the scroll bar at the frame's bottom. While there are columns out of sight on the right, three red „>” stand one over another at the right edge of the table's header; while there are columns hidden on the left, three „<” stand at its left edge (Figure [[fig-list-fit]]). The signs pulse slowly — they fade a little and come back, about once every two and a half seconds —, so that you notice them without being bothered; while the mouse rests on them they stay still. Rest the mouse on them and a bubble, under the table's header, says what they mean: „More columns to the right. Scroll right to see them.” or „More columns to the left. Scroll left to see them.”. A click on them scrolls the list that way, by nearly as much as shows of it — a little of what was in sight stays in sight —, so a funnel under the signs comes out from under them. They can be reached from the keyboard too, with Tab, and Enter presses them. When every column fits, neither appears.

When you open an object from the list and come back with „Back”, the list is scrolled where you left it, down and sideways.

![2.7 The list of properties in a short, narrow window: the header at the top, „Page x of y” under the frame, and the red signs of the hidden columns at both edges](list-fit.png){#fig-list-fit}

**The columns' widths.** A thin line stands between the columns, from the table's header down to the last row, in the colour of the lines between the rows. In the header the line can be grabbed: rest the mouse on it and the pointer becomes a two-headed arrow, and a bubble says „Drag to widen or narrow the column; a double-click gives it its usual width back.”. Dragged to the right, the line widens the column on its left; dragged to the left, it narrows it, as the mouse moves (Figure [[fig-list-resize]]). The table widens or narrows with it; no column gets narrower than room for the funnel and a few letters. While you drag, nothing under the mouse is pressed.

The width chosen is kept for that list, in this browser, also after the page is reloaded; a column taken out in „Choose fields” finds its width again when you put it back. A double-click on the line gives the column its usual width back. From the keyboard, reach the line with Tab; the left and right arrows narrow or widen it a little at a time, and Home gives it its usual width back.

The line is dragged the same way in every table of this kind: the association screens, „Global Search”, „Users & Access”, „Groups”, „Stamps”, the side-road calculation, the lists in „Reference Data” and the dashboard. Where the table fills a tile or a frame — „Groups”, „Stamps”, the association screens —, what one column gains the wide column, the description or the name, loses, and the table stays as wide as the tile; the wide column has no line of its own to drag.

![2.8 The line between two columns, dragged in the table's header: the column on its left widens](list-resize.png){#fig-list-resize}

**The columns' order.** A column is moved by its name, in the table's header: grab the name with the mouse and drag it left or right. While you hold it, the name follows the mouse, half-transparent, and a blue line shows where it will land (Figure [[fig-list-drag]]); let it go there and the column, with its rows, moves. Any column with a name moves, the ones that are always in the list too; the rows' buttons stay at the end. Near the frame's edge the list scrolls sideways by itself. Esc stops the move, and a name let go far from the table's header moves nothing. A click on a funnel still opens its filter, and the line between columns still changes the width.

The order is kept for that list, in this browser. A column ticked later in „Choose fields” comes at the end; one unticked leaves the order. While you have moved something, „Choose fields” ends with „Default order”, which puts the columns back. From the keyboard, reach the column's name with Tab, and Alt + ← and Alt + → move it one place.

![2.9 A column dragged by its name: its name under the mouse and the line where it will land](list-drag.png){#fig-list-drag}

## 2.6 An object's screen: its tiles {#start-tiles}

An open object shows its data in tiles — panels with a name each, written at the top in capitals, in dark blue (Figure [[fig-record]]). A natural person has, for instance, their identity, „Links”, „Classification”, „Tags and groups” and „Interactions”.

- „Panels”, in the top bar, right after the versions and before „?”, opens under the bar, lined up on the right with the button, a panel with the tick boxes that choose which tiles show; „All” shows them all, and „Default” returns to the usual set. Your own set is saved in „Settings”, under „My defaults”. A tick leaves the panel open; Esc, a click outside it or another click on „Panels” closes it; while it is open it stays put, even when you scroll the screen. Closed, the screen goes from the object's name straight to its data. On a document, a blue number on the button says how many hidden tiles hold a field a version marks. In the panel, the tick boxes stand on two rows: those of one colour together, the buttons at the end of the second row, and the first row a little longer than the second.
- „All up”, left of „All”, raises every tile, from the top down, each in its own columns, to right under the tile above it or to the top. Then, while one column of tiles ends much lower than another, its bottom tile moves under the shortest column — if it fits there and the screen then ends higher (Figures [[fig-all-up-before]] and [[fig-all-up-after]]). The tiles slide to their new places, and the arrangement is kept as after a drag; „Default” undoes it.
- Right of the tick boxes, a small sketch shows the tiles on the screen: one rectangle for each, in its colour, with no name, placed as the tile stands and as tall as it, at one scale for all — a tile twice as tall has a rectangle twice as tall, and no rectangle is so small that it cannot be seen. It changes with the tiles.
- A rectangle of the sketch is dragged like its tile: press on it and move it — the hand shows it can be grabbed. The tile moves with it on the screen, and its outline shows where it would land; while the place is taken, the rectangle has a red rim. Held still over another rectangle for as long as „Hold time over another tile” says, the tile underneath slides down, on the screen and in the sketch, as with a drag on the screen. Dropped, the tile stays there and is kept as after any drag; Esc, or the rectangle dropped outside the sketch, puts everything back. A plain click on a rectangle does nothing.
- A tile is dragged by its empty space into a free place; a double-click raises it under the tile above.
- To put a tile where another stands, drag it over that one and hold it still: after a second — as long as „Hold time over another tile” in „Settings” says (section [[admin-settings-thresholds]]) — the tile underneath slides down, in its own columns, to the first free place large enough, and the outline shows that the place is free (Figure [[fig-make-room]]). Drop the tile there; Esc puts everything back.
- The light purple tiles — the map, the corners, Street View, a document's pages, a person's interactions — start by the right edge, one under another, and are dragged like any other tile; the place you leave them in is kept, and „Default” puts them back on the right.
- The object's system ID sits in the top right-hand corner of the first tile.
- A form tile with nothing in it stands on one line: its name, „not filled in” (or its own state, such as „same as home address”) and „Add” — the plus —, which opens it with the cursor in its first field. An object's first tile — a person's or a firm's identity, „Cadastral identification”, „Document identification” — never folds.
- In a tile that holds something, the empty fields are hidden behind a link — such as „Show 4 empty fields” —, followed by their names in grey; hold the mouse on the link to read them all. A click shows them until you leave the object. A group of empty fields hides together with its heading — such as „[Garanții]” (warranties) on a sale contract —, and the link brings it back. On a document, as on a person, the tile hides its empty fields straight after „Save”, without reloading the page. A few fields always show, even empty, because their absence says something: for a person the last name, the first name and the CNP; for a firm the name and the CUI; for a property the type, the locality, the parcel block and the parcel; for a document the type, the title, the date and the number.
- In a narrow window, under about 1000 pixels, the tiles stand in one column, in the order they are arranged in, top to bottom; nothing is dragged there and nothing is kept. A tile wider than the window scrolls inside itself; the versions and „Panels” stay in the top bar, however long the name.
- The button bar, the last thing on the screen, holds the bin (delete) and the way back; on a new object, the save; on an object opened only for reading, the pencil „Modify”. An icon button shows its name when the mouse passes over it. On the grey tiles the buttons show only their icon — „Edit”, „Associate person”, „Dissociate” and the rest —, and you read their name by holding the mouse over them; this manual calls them by name, as their hints do.

![2.10 A natural person's screen, with its tiles](record.png){#fig-record}

![2.11 A tile held over another: the one underneath has slid down to the first place it fits whole](make-room.png){#fig-make-room}

![2.12 Before „All up”: one tile dragged far from the others](all-up-before.png){#fig-all-up-before}

![2.13 After „All up”: the tiles raised and the columns evened; right of the tick boxes, the sketch of the tiles](all-up-after.png){#fig-all-up-after}

### 2.6.1 Reading a tile, and „Edit” {#start-read-edit}

A form's fields have no frame at rest: the field's name is small and navy, like the tile's title, above, and the value, bolder, under it; an empty field has a broken line beneath it. The white frame shows when the mouse passes over a field you can type in, and the blue one while you type in it.

Each field has its own width and does not widen as you type. A value longer than the field goes onto the next line, and the field grows taller — a drop-down list too: a long choice reads on two lines, and the open list shows every value whole. A list value that is too long can be shortened in „Reference Data” (section [[admin-reference-data]]).

A saved object is read: each form tile shows its values as text — the date of birth with the age beside it, such as 15.06.1985 (41 years), a chosen list item by its words, tick boxes as a short list. „Edit” — the pencil —, in the tile, at the right of the line under its title, opens it as a form: the tile gets a blue outline, and „Save” — the floppy disk — and „Cancel” — an X — appear under the fields (Figure [[fig-tile-edit]]). „Save” keeps only that tile's fields and makes one new version; „Cancel” puts the tile back as it was and writes nothing. „Save” can be pressed from the first change, and a choice from a list is a change. An open tile shows all its fields, the empty ones too, and „Add”, on an empty tile, opens it straight as a form.

One tile is open at a time. „Edit” on another, while the first has unsaved changes, asks first: save, discard or stay — as when you leave the screen (section [[start-breadcrumb]]). From the keyboard, Tab reaches „Edit”, Enter opens the tile with the cursor in its first field, Enter in an open tile saves it, and Esc is „Cancel”.

A new object is still one form, with one „Save”. An old version is read, with no „Edit”. The tiles with their own buttons — „Links”, „Tags and groups”, „Interactions”, the inheritance tree, the map, a document's pages — work as before. „Classification” is read and opened with „Edit” like a form tile (section [[links-classify-classification]]).

![2.14 „Identity” opened with „Edit”: the blue outline, „Save” and „Cancel” under the fields](tile-edit.png){#fig-tile-edit}

## 2.7 The preview {#start-preview}

A linked object can be opened beside the one you are working on, with „Preview”, without leaving your screen — for instance the buyer, beside the sale contract. At most two previews open at a time, and an unsaved change on the main screen is left untouched. From a list, a row's preview opens beside the table.

## 2.8 The help behind „?” {#start-help}

The „?” button at the end of the navigation bar opens the screen's help: what the screen is for and how it is worked (Figure [[fig-help]]). Where a gesture cannot be seen — a drag, a double-click — a small light bulb beside that place explains it. The help texts are written by the administrator, in „Help Information” (section [[admin-help]]).

![2.15 A screen's help, opened from „?”](help.png){#fig-help}

## 2.9 Examples and use cases {#start-examples}

### 2.9.1 Find a person by part of their name {#start-example-find}

1. In the sidebar, open „Domain”, then „Natural Persons”.
2. Type part of the name in the search box.
3. If several persons with the same name remain, add from „Choose fields” a column that tells them apart, such as the date of birth.
4. Press the name on the row you want.

### 2.9.2 Leave a screen without losing what you typed {#start-example-back}

1. On a person's screen, change a field without saving.
2. Press „Back”: the application asks what to do with the changes.
3. „Cancel” keeps you on the screen with what you typed. Save, then press „Back” again.

### 2.9.3 Make room on the screen {#start-example-room}

1. Narrow the sidebar with „Collapse sidebar”.
2. Untick the tiles you do not need now.
3. When you are done, „Default” brings the usual tiles back.
`;
