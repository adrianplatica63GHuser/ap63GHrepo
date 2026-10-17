/**
 * Manual, en-GB, chapter 5. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 5 Properties {#properties}

A property is a parcel: a piece of land, built on or not. In the archive it is identified by its tarla and parcela, sometimes also by its cadastral number and its land-registry („Carte Funciara”) number, and its corners, in order, put it on the map. This chapter shows the list of properties, how to add one, what its type changes, how to work with a parcel's corners and map, and how to get there with your phone.

## 5.1 The list of properties {#properties-list}

Open „Domain” in the sidebar, then „Properties”. The list „Properties” opens (Figure [[fig-properties-list]]).

The search box at the top of the list searches by code, nickname, cadastral number, land-registry number, tarla or parcela — as the box itself says. Beside it, the list's filters narrow what you see by any field of the property (section [[properties-list-filters]]). Below the table, „Showing … of …” says how many properties you are seeing out of how many there are.

The first column after the tick box is always „Nickname”, the name you give the property. It is always shown and is not among the options in „Choose fields”. The property's code has no column in the list; you find it on the property's screen, in the corner of its first tile.

„Choose fields” adds up to four columns after „Nickname”. You can choose from the cadastral fields and the locality:

- „Tarla/Solă” and „Parcelă”;
- „Official (m²)” and „Calculated (m²)” — the two areas, official and calculated;
- „Carte Funciara” and „Cadastral No.” — the land-registry and cadastral numbers;
- „Use Category” and „Property Type”, shown by their names;
- „Locality”.

The button shows how many columns you have chosen, for instance „Choose fields 2/4”. Once four are ticked, the other boxes turn grey until you untick one. At first the list shows only „Property Type”. The choice is kept in this browser, so you find it again next time.

On the right, above the table, are two buttons: „Full map” opens the map of all properties (chapter [[map]]), and „Add new Property” creates a new one (section [[properties-add]]). While the full map is open, the navigation bar reads „Home › Properties › Full map”, and a click on „Properties” takes you back to the list.

![5.1 The list of properties](properties-list.png){#fig-properties-list}

### 5.1.1 The list's filters {#properties-list-filters}

Each filter is a rounded label above the table, with the field's name and what you chose, for instance „Property Type” House. The list shows only the properties that pass every filter at once.

1. Choose the field from the „+ Filter” list. The filter's window opens below it.
2. Choose what you want to see. The list changes at once, with no button to apply.
3. Click outside the window, or press Esc, to close it. The label stays; a click on it opens the window again, and its X removes the filter.

What you choose depends on the field:

- **„Property Type”, „Use Category”, „Tarla/Solă”, „Locality”, „County / Sector” and „Group”** — a list with ticks. Beside each value is how many properties hold it, counted with the other filters already set, so the number says how many rows would remain. Tick several values to see the properties that hold any of them. „(empty)” means the properties whose field is blank. The box „Search for a value…” shortens the list;
- **„Official Surface Area (m²)” and „Calculated Area (m²)”** — „From” and „To”, either or both;
- **„Cadastral No.”, „Carte Funciara” and „Parcela”** — „Contains”: the properties whose field contains what you typed remain.

The columns from „Choose fields” carry a small funnel in their header: a click on it opens that column's filter. A filled funnel shows the list is filtered by that column. A filter stays when you hide its column, and its label stays above the table, so the list is never filtered without your seeing it.

„Clear filters” removes them all at once. The filters are kept in the page's address, as the search is: they survive a reload, a return to the list with „Back”, and an address sent to someone.

## 5.2 A property added by hand {#properties-add}

Press „Add new Property”. The window „Add Property” opens, with two ways in:

| The way | What it does |
|---|---|
| Manual data entry | You fill in the property's details by hand. |
| From a text file | You upload a .txt file with the corners' coordinates and choose the tarla and the parcel (section [[properties-coord-file]]). |

Both check whether the parcel already has a property (section [[properties-add-one-parcel]]). A whole folder, with documents and coordinates, comes in through the import (chapter [[import]]).

This section follows „Manual data entry”. The screen „New Property” opens, with the cadastral data, the corners, the address and the map.

### 5.2.1 The cadastral data {#properties-add-cadastral}

The main fields are:

- „Nickname” — the name by which you recognise the property in the list;
- „Property Type” — for instance land outside the built-up area, or built-up land (section [[properties-type]]);
- „Tarla / Sola” — chosen from a list, not typed: the list holds „none” and the tarlas already in the archive;
- „Parcela” — typed freely;
- „Cadastral No.” and „Carte Funciara”;
- „Use Category” — the list offers only the uses the chosen type allows; a use saved earlier that the type no longer allows stays, and under the field it reads „The type „…” does not list this use category among the ones it allows.” (section [[admin-reference-data-property-types]]);
- „Official Surface Area (m²)” — the area in the papers; it must be a positive number;
- „Calculated Area (m²)” — calculated by the application from the corners (section [[properties-corners]]);
- „Notes”.

„Save”, „Delete” and „Cancel” are at the very bottom, below the map. The buttons are icons — a floppy disk, a bin, an X — and show their names when you move the mouse over them.

When you press „Save” on a new property, you go back to the list. The new property is at the top, badged „New!”, and the count below the list has gone up by one.

### 5.2.2 The address {#properties-add-address}

The „Address” tile has the fields „Street, No., Floor, Apt”, „Postal Code”, „Locality”, „County / Sector”, „Country” and „Notes”. If you leave „Country” empty and fill in the address, „România” is saved.

„Fetch from Street View” fills the field „Street View address” with the address Google finds at the centre of the corners. It needs at least one corner and writes over what was in the field, so check the result. Every click is a look-up that Google charges for.

Some property types do not show the address at all (section [[properties-type-hidden]]).

### 5.2.3 One property per parcel {#properties-add-one-parcel}

The archive keeps one property per parcel in a locality (section [[properties-tarla]]). If you save a new property with a tarla and a parcela that already have a property — by hand or from a coordinate file — the application refuses it: you stay on „New Property”, and below the form appears „This parcel already has a property”, explaining that no new property was created. The link „Open …” under the message takes you to the property that exists. Nothing is written, and the list holds as many properties as before.

### 5.2.4 Changing and deleting {#properties-add-edit}

On an open property, change the fields and press „Save”. While you have unsaved changes, the top of the form reads „Unsaved changes” and „Save” is active. Every save adds a version, and the header of the screen shows „v …” and „… versions” (section [[links-versions]]).

The bin („Delete”) asks first: „Delete property?”. „No” leaves you on the screen; „Yes” deletes the property and takes you back to the list.

### 5.2.5 A tarla and its locality {#properties-tarla}

Tarla numbers restart in every locality: T50 in Bragadiru is not T50 in Cornetu. So a tarla belongs to a locality, and the rule „one property per parcel” (section [[properties-add-one-parcel]]) compares only parcels in the same locality: parcel 1 on T50 in Cornetu is not refused because parcel 1 on T50 in Bragadiru exists.

In „Reference Data” → „Tarla Codes”, each tarla has a „Locality” and a „County”, read together on its row, for instance Bragadiru, Ilfov. The same code can exist once in each locality. In a property's „Tarla / Sola”, a code two tarlale share shows its locality in brackets, and the button „Open the tarla's page” under the list opens the chosen tarla.

Each tarla has a page of its own, „Tarlale” → the tarla, opened with „Open the tarla's page” from „Tarla Codes” or from the property. On the page:

- at the top, the box „About tarla boundaries”: which sources exist for tarla boundaries and what is not available. It also stands above the „Tarlale” list, because it is what to read before looking for a boundary;
- „Code”, „Locality”, „County”, „Description” and „Notes”, saved with „Save”;
- „Outline”: optional, the tarla's corners, entered as on a property (section [[properties-corners-table]]);
- the properties on the tarla and the documents linked to them. A tarla has no documents, groups or tags of its own.

An import adds its tarla codes in the locality given in the property step: „The tarlale's locality” is read from the name of the folder chosen, for instance Clinceni from a folder named CLINCENI.3, and can be changed (section [[import-overview]]).

## 5.3 The property's type and its tiles {#properties-type}

A property's screen is headed by its nickname, then its type, in brackets and in italics — for instance „(Teren extravilan)” — and an ⓘ, „About the property type”. Its bubble says which tiles this type shows and which it does not, and whether „Tarla/Solă” and „Parcelă” appear in „Cadastral identification”.

You choose the type in „Property Type”. When you choose another type, the heading and the bubble change at once, before saving. If you choose „none”, nothing appears after the nickname. What each type shows is set in „Reference Data” (section [[admin-reference-data]]).

### 5.3.1 A property's tiles {#properties-type-tiles}

The ticks at the top of the screen („Parts shown”) choose the tiles, as on any object (section [[start-tiles]]):

| The tile | What it shows |
|---|---|
| Cadastral identification | Tarla, parcela, land-registry number, cadastral number, areas. |
| Address | The property's postal address. |
| Links | Persons, properties and documents linked to this property (section [[links-related]]). |
| Classification | Importance, relevance, provenance (section [[links-classify]]). |
| Tags and groups | Tags, groups, stamps, see also (section [[links-classify]]). |
| Map | The parcel drawn on the map (section [[properties-corners-map]]). |
| Corners | The parcel's corners, in order (section [[properties-corners-table]]). |
| Street View | The street view next to the parcel (section [[properties-corners-street-view]]). |

„Default” shows „Cadastral identification”, „Address”, „Map” and „Corners”. The tiles „Map”, „Corners” and „Street View” stand in a column on the right, one under another, are light purple and do not move. On a narrow screen the column drops below the other tiles.

When you untick the map tiles, the screen shows only the data: the cadastral identification and the address (Figure [[fig-properties-record]]).

![5.2 A property's screen: its cadastral data and address](properties-record.png){#fig-properties-record}

### 5.3.2 The tiles a type does not show {#properties-type-hidden}

A type may not show „Address” and „Street View” — arable land, for instance, has no postal address. For such a type the two ticks are unticked and inactive, their names in italics, and their message says that the chosen type does not show the tile. „All” and „Default” do not touch them. If you choose a type that shows the tile, the tick comes back as you had left it.

## 5.4 A parcel's corners and its map {#properties-corners}

The parcel's shape is given by its corners, in the order in which they are joined. You see them in two tiles that work together: „Corners”, the table of corners, and „Map”, their drawing. What you change in one shows at once in the other, even before saving.

### 5.4.1 „Corners” {#properties-corners-table}

The table has the columns „#” (the order), „Orig. #” (the corner's number in the file or plan it comes from), then the coordinates. „Display:” chooses how the coordinates are shown: „DD” (decimal degrees), „DMS” (degrees, minutes, seconds) or „Stereo 70” (North and East, in metres). You type them in the same form.

Each row has four buttons:

- „Move up” and „Move down” — change the order of the corners, and so the parcel's shape;
- „Edit” — turns the row into fields to type in, with „Save” and „Cancel” on the row;
- „Delete” — removes the corner.

Below the table, „+ Add Corner” adds a new corner at the end.

„Calculated Area (m²)” follows the corners at once: change a corner and the area changes immediately. A row's „Save” does not yet write anything to the archive: the corners are saved only with the „Save” at the bottom, together with the rest of the property, and the version before keeps the old corners.

If the order of the corners makes the sides cross, „The corner order crosses itself” appears, and the calculated area no longer means anything. „Straighten the order” shows you the shape as it is and the straightened shape, with their areas. The corners stay where they are; only the order in which they are joined changes. Then save as usual.

### 5.4.2 The „Map” tile {#properties-corners-map}

The „Map” tile draws the parcel. At its top right, on one line, it has:

- „Expand map” — opens the map on the whole screen;
- „Draw” — places corners by clicks on the map;
- „Show Angles” — shows the corners' angles; pressed again, it becomes „Hide Angles”;
- „STR” and „SAT” — the street map or the satellite image.

Below the map is „Navigate” (section [[properties-navigate]]).

### 5.4.3 Drawing and dragging corners {#properties-corners-draw}

1. Press „Draw”. „Done” appears in its place, and below the buttons a prompt: „Click map to place first corner”.
2. Click the map for each corner, in order.
3. To close the shape, click the first point again or press „Done”.
4. The drawn corners appear in „Corners”. Save the property so that they stay.

A corner placed wrongly is corrected by dragging it with the mouse on the map. The table and the calculated area follow the drag.

### 5.4.4 The expanded map {#properties-corners-expanded}

„Expand map” opens the same map on the whole screen, with „Draw”, „Show Angles” and „STR” / „SAT”. A corner drawn here is the property's corner. „Collapse” or the Escape key closes the expanded map and takes you back to the tile, with the drawing kept.

### 5.4.5 The „Street View” tile {#properties-corners-street-view}

The „Street View” tile shows the street view next to the parcel. It is off until you tick it, because Google charges for every view opened. It needs at least one corner; if Google has no images nearby, the tile says so. The full map has Street View too (section [[map-street-view]]).

## 5.5 A parcel from a coordinate file {#properties-coord-file}

A text file with the Stereo 70 coordinates of the corners — from a surveyor, for instance — becomes a whole property, without typing the corners by hand.

1. In „Properties”, press „Add new Property”, then „From a text file”.
2. In the window „Upload coordinate file”, choose the file at „Select the coordinate file”. The file window shows only .txt files.
3. Under the file, at „Tarla and parcel”, choose the tarla at „Tarla / Sola” and type the parcel at „Parcela”. Until both are filled in, „Import” stays grey.
4. Press „Import”.
5. „Property imported successfully.” appears, and in the list, at the top, the new property badged „New!”. Press „Close” or „Open the property”.

If the parcel already has a property, no other is created: the window stays open and shows „This parcel already has a property”, with a link to the property that exists (section [[properties-add-one-parcel]]).

The file has one row per corner, the values separated by a tab or a comma: the corner's index, X (North) and Y (East), in metres. Rows that hold no coordinates are ignored. If the file does not have at least three rows with valid coordinates, the application says it found no valid Stereo 70 coordinates.

What the new property gets:

- „Nickname” — the file's name;
- the corners, in the file's order, each with its number from the file in „Orig. #”;
- „Calculated Area (m²)”, from the corners, and the map drawn;
- the provenance „Coordinate file (.txt)”;
- the tarla and the parcel chosen in the window.

The rest of the cadastral data — the cadastral number, the land book, the area in the deeds — you fill in on the property's screen, in „Cadastral identification”.

## 5.6 „Navigate” {#properties-navigate}

„Navigate”, below the „Map” tile, helps you get to the property by car. It opens a window with the route in Google Maps and the same route as a QR code, for the phone.

The application chooses the destination:

- if the property has corners, the route goes to the parcel's centre („To the parcel: its centre on the map.”);
- if it has only an address, the route goes to its address („To the address: …”);
- if it has neither corners nor an address, the „Navigate” button is inactive and says why.

At „Start” you choose where you start from:

- „My location” — the phone that scans the code starts from where it is; on the computer, Google Maps asks for the browser's location;
- „From an address” — type the starting address at „Start address”; until you type it, the link and the QR code do not appear.

Scan the QR code with the phone, and Google Maps starts the navigation. On the computer, „Open in Google Maps” opens the route in a new tab, and „Copy link” copies it, so you can send it to someone. Google Maps draws the route, up to the nearest road on its map.

„Navigate” is also in a property's bubble on the full map (chapter [[map]]).

## 5.7 Examples and use cases {#properties-examples}

### 5.7.1 Add a plot in Bragadiru and draw it on the map {#properties-example-draw}

1. In „Properties”, press „Add new Property”, then „Manual data entry” (section [[properties-add]]).
2. Type the nickname, for instance „Bragadiru plot”, choose the tarla in „Tarla / Sola”, and type the parcela and the area from the papers.
3. On the map, press „Draw” and place the corners; close the shape on the first point (section [[properties-corners-draw]]).
4. Compare „Calculated Area (m²)” with „Official Surface Area (m²)”.
5. Press „Save”. The property appears at the top of the list, badged „New!”.

### 5.7.2 Bring in a parcel from a surveyor's file {#properties-example-file}

1. „Add new Property”, then „From a text file”; choose the .txt file, the tarla and the parcel, and press „Import” (section [[properties-coord-file]]).
2. Open the new property and check on the map that the sides do not cross; if they do, use „Straighten the order” (section [[properties-corners-table]]).
3. Fill in what else the deeds tell you in „Cadastral identification” — the cadastral number, the land book — and save.

### 5.7.3 Go to the plot with your phone {#properties-example-navigate}

1. Open the property and press „Navigate”, below the map (section [[properties-navigate]]).
2. Leave „My location” at „Start”.
3. Scan the QR code with the phone: Google Maps starts the navigation from where you are.

### 5.7.4 Correct a wrong corner {#properties-example-corner}

1. Open the property; in „Corners”, press „Edit” on the corner's row (section [[properties-corners-table]]).
2. Type the correct coordinate and press the row's „Save”. The calculated area changes at once.
3. Press „Save” at the bottom. The version before keeps the old corner (section [[links-versions]]).
`;
