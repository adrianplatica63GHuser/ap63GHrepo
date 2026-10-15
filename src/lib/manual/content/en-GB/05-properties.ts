/**
 * Manual, en-GB, chapter 5. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 5 Properties {#properties}

A property is a parcel: a piece of land, built on or not. In the archive it is identified by its tarla and parcela, sometimes also by its cadastral number and its land-registry (carte funciară) number, and its corners, in order, put it on the map. This chapter shows the list of properties, how to add one, what its type changes, how to work with a parcel's corners and map, and how to get there with your phone.

## 5.1 The list of properties {#properties-list}

Open „Domeniu” in the sidebar, then „Proprietăți”. The list „Proprietăți” opens (Figure [[fig-properties-list]]).

The search box at the top of the list searches by code, nickname, cadastral number, land-registry number, tarla or parcela — as the box itself says. The list has no filters: neither „Importanță” (importance) nor „Relevanță” (relevance). Below the table, „Se afișează … din …” says how many properties you are seeing out of how many there are.

The first column after the tick box is always „Poreclă” (nickname), the name you give the property. It is always shown and is not among the options in „Câmpuri afișate”. The property's code has no column in the list; you find it on the property's screen, in the corner of its first tile.

„Câmpuri afișate” (the columns shown) adds up to four columns after „Poreclă”. You can choose from the cadastral fields and the locality:

- „Tarla/Solă” and „Parcelă”;
- „Oficială (m²)” and „Calculată (m²)” — the two areas, official and calculated;
- „Nr. CF” and „Nr. cadastru” — the land-registry and cadastral numbers;
- „Categorie de folosință” (land-use category) and „Tip proprietate” (property type), shown by their names;
- „Localitate” (locality).

The button shows how many columns you have chosen, for instance „Câmpuri afișate 2/4”. Once four are ticked, the other boxes turn grey until you untick one. At first the list shows only „Tip proprietate”. The choice is kept in this browser, so you find it again next time.

On the right, above the table, are two buttons: „Hartă completă” (the full map) opens the map of all properties (chapter [[map]]), and „Adaugă proprietate” (add property) creates a new one (section [[properties-add]]). While the full map is open, the navigation bar reads „Acasă › Proprietăți › Hartă completă”, and a click on „Proprietăți” takes you back to the list.

![5.1 The list of properties](properties-list.png){#fig-properties-list}

## 5.2 A property added by hand {#properties-add}

Press „Adaugă proprietate”. The window „Adaugă Proprietate” opens, with four ways in:

| The way | What it does |
|---|---|
| Introducere manuală | You fill in the property's details by hand. |
| Din imagine scanată | You upload a photo or a scan, and the coordinates are extracted from it. |
| Din fișier text | You upload a .txt file with the corners' coordinates (section [[properties-coord-file]]). |
| Din folder text | You choose a folder, and every .txt file in it becomes a separate property. |

This section follows „Introducere manuală” (manual entry). The screen „Proprietate nouă” (new property) opens, with the cadastral data, the corners, the address and the map.

### 5.2.1 The cadastral data {#properties-add-cadastral}

The main fields are:

- „Poreclă” — the name by which you recognise the property in the list;
- „Tip proprietate” — for instance arable land or built-up land (section [[properties-type]]);
- „Nr. tarla / sola” — chosen from a list, not typed: the list holds „niciunul” (none) and the tarlas already in the archive;
- „Nr. parcelă” — typed freely;
- „Nr. cadastru” and „Nr. CF”;
- „Categorie de folosință”;
- „Suprafață oficială (m²)” — the area in the papers; it must be a positive number;
- „Suprafață calculată (m²)” — calculated by the application from the corners (section [[properties-corners]]);
- „Note” (notes).

„Salvează” (save), „Șterge” (delete) and „Anulează” (cancel) are at the very bottom, below the map. The buttons are icons — a floppy disk, a bin, an X — and show their names when you move the mouse over them.

When you press „Salvează” on a new property, you go back to the list. The new property is at the top, badged „Nou!”, and the count below the list has gone up by one.

### 5.2.2 The address {#properties-add-address}

The „Adresă” tile has the fields „Stradă, Nr., etaj, ap” (street, number, floor, flat), „Cod poștal” (postcode), „Oraș / Localitate” (town), „Județ / Sector” (county), „Țară” (country) and „Note”. If you leave „Țară” empty and fill in the address, „România” is saved.

„Preia din Street View” (take from Street View) fills the field „Adresă Street View” with the address Google finds at the centre of the corners. It needs at least one corner and writes over what was in the field, so check the result. Every click is a look-up that Google charges for.

Some property types do not show the address at all (section [[properties-type-hidden]]).

### 5.2.3 One property per parcel {#properties-add-one-parcel}

The archive keeps one property per parcel. If you save a new property with a tarla and a parcela that already have a property, the application refuses it: you stay on „Proprietate nouă”, and below the form appears „Această parcelă are deja o proprietate” (this parcel already has a property), explaining that no new property was created. The link „Deschide …” under the message takes you to the property that exists. Nothing is written, and the list holds as many properties as before.

### 5.2.4 Changing and deleting {#properties-add-edit}

On an open property, change the fields and press „Salvează”. While you have unsaved changes, the top of the form reads „Modificări nesalvate” (unsaved changes) and „Salvează” is active. Every save adds a version, and the header of the screen shows „v …” and „… versiuni” (section [[links-versions]]).

The bin („Șterge”) asks first: „Ștergeți proprietatea?” (delete the property?). „Nu” (no) leaves you on the screen; „Da” (yes) deletes the property and takes you back to the list.

## 5.3 The property's type and its tiles {#properties-type}

A property's screen is headed by its nickname, then its type, in brackets and in italics — for instance „(Teren Arabil)” — and an ⓘ, „Despre tipul proprietății” (about the property's type). Its bubble says which tiles this type shows and which it does not, and whether „Tarla/Solă” and „Parcelă” appear in „Identificare cadastrală”.

You choose the type in „Tip proprietate”. When you choose another type, the heading and the bubble change at once, before saving. If you choose „niciunul”, nothing appears after the nickname. What each type shows is set in „Date de referință” (section [[admin-reference-data]]).

### 5.3.1 A property's tiles {#properties-type-tiles}

The ticks at the top of the screen („Părți afișate”, the parts shown) choose the tiles, as on any record (section [[start-tiles]]):

| The tile | What it shows |
|---|---|
| Identificare cadastrală | Tarla, parcela, land-registry number, cadastral number, areas. |
| Adresă | The property's postal address. |
| Legături | Persons, properties and documents linked to this property (section [[links-related]]). |
| Clasificare | Importance, relevance, provenance (section [[links-classify]]). |
| Etichete și grupuri | Tags, groups, stamps, see also (section [[links-classify]]). |
| Hartă | The parcel drawn on the map (section [[properties-corners-map]]). |
| Puncte de contur | The parcel's corners, in order (section [[properties-corners-table]]). |
| Street View | The street view next to the parcel (section [[properties-corners-street-view]]). |

„Implicit” (default) shows „Identificare cadastrală”, „Adresă”, „Hartă” and „Puncte de contur”. The tiles „Hartă”, „Puncte de contur” and „Street View” stand in a column on the right, one under another, are light purple and do not move. On a narrow screen the column drops below the other tiles.

When you untick the map tiles, the screen shows only the data: the cadastral identification and the address (Figure [[fig-properties-record]]).

![5.2 A property's screen: its cadastral data and address](properties-record.png){#fig-properties-record}

### 5.3.2 The tiles a type does not show {#properties-type-hidden}

A type may not show „Adresă” and „Street View” — arable land, for instance, has no postal address. For such a type the two ticks are unticked and inactive, their names in italics, and their message says that the chosen type does not show the tile. „Toate” (all) and „Implicit” do not touch them. If you choose a type that shows the tile, the tick comes back as you had left it.

## 5.4 A parcel's corners and its map {#properties-corners}

The parcel's shape is given by its corners, in the order in which they are joined. You see them in two tiles that work together: „Puncte de contur” (the boundary points), the table of corners, and „Hartă” (map), their drawing. What you change in one shows at once in the other, even before saving.

### 5.4.1 „Puncte de contur” {#properties-corners-table}

The table has the columns „Nr.” (the order), „Nr. orig.” (the corner's number in the file or plan it comes from), then the coordinates. „Afișare:” (display) chooses how the coordinates are shown: „DD” (decimal degrees), „DMS” (degrees, minutes, seconds) or „Stereo 70” (North and East, in metres). You type them in the same form.

Each row has four buttons:

- „Mută mai sus” and „Mută mai jos” (move up, move down) — change the order of the corners, and so the parcel's shape;
- „Editează” (edit) — turns the row into fields to type in, with „Salvează” and „Anulează” on the row;
- „Șterge” — removes the corner.

Below the table, „+ Adaugă punct” (add point) adds a new corner at the end.

„Suprafață calculată (m²)” follows the corners at once: change a corner and the area changes immediately. A row's „Salvează” does not yet write anything to the archive: the corners are saved only with the „Salvează” at the bottom, together with the rest of the property, and the version before keeps the old corners.

If the order of the corners makes the sides cross, „Ordinea colțurilor se încrucișează” (the order of the corners crosses) appears, and the calculated area no longer means anything. „Îndreaptă ordinea” (straighten the order) shows you the shape as it is and the straightened shape, with their areas. The corners stay where they are; only the order in which they are joined changes. Then save as usual.

### 5.4.2 The „Hartă” tile {#properties-corners-map}

The „Hartă” tile draws the parcel. At its top right, on one line, it has:

- „Hartă extinsă” (expanded map) — opens the map on the whole screen;
- „Desenează” (draw) — places corners by clicks on the map;
- „Arată Unghiuri” (show angles) — shows the corners' angles; pressed again, it becomes „Ascunde Unghiuri” (hide angles);
- „HARTĂ” and „SATELIT” — the street map or the satellite image.

Below the map is „Navighează” (section [[properties-navigate]]).

### 5.4.3 Drawing and dragging corners {#properties-corners-draw}

1. Press „Desenează”. „Gata” (done) appears in its place, and below the buttons a prompt: „Apasă pe hartă pentru a plasa primul punct” (click the map to place the first point).
2. Click the map for each corner, in order.
3. To close the shape, click the first point again or press „Gata”.
4. The drawn corners appear in „Puncte de contur”. Save the property so that they stay.

A corner placed wrongly is corrected by dragging it with the mouse on the map. The table and the calculated area follow the drag.

### 5.4.4 The expanded map {#properties-corners-expanded}

„Hartă extinsă” opens the same map on the whole screen, with „Desenează”, „Arată Unghiuri” and „HARTĂ” / „SATELIT”. A corner drawn here is the property's corner. „Restrânge” (collapse) or the Escape key closes the expanded map and takes you back to the tile, with the drawing kept.

### 5.4.5 The „Street View” tile {#properties-corners-street-view}

The „Street View” tile shows the street view next to the parcel. It is off until you tick it, because Google charges for every view opened. It needs at least one corner; if Google has no images nearby, the tile says so. The full map has Street View too (section [[map-street-view]]).

## 5.5 A parcel from a coordinate file {#properties-coord-file}

A text file with the Stereo 70 coordinates of the corners — from a surveyor, for instance — becomes a whole property, without typing the corners by hand.

1. In „Proprietăți”, press „Adaugă proprietate”, then „Din fișier text” (from a text file).
2. In the window „Încarcă fișier cu coordonate” (upload a coordinate file), choose the file at „Selectați fișierul cu coordonate”. The file window shows only .txt files.
3. Press „Importă” (import).
4. „Proprietatea a fost importată cu succes.” (the property was imported successfully) appears, and in the list, at the top, the new property badged „Nou!”. Press „Închide” (close).

The file has one row per corner, the values separated by a tab or a comma: the corner's index, X (North) and Y (East), in metres. Rows that hold no coordinates are ignored. If the file does not have at least three rows with valid coordinates, the application says it found no valid Stereo 70 coordinates.

What the new property gets:

- „Poreclă” — the file's name;
- the corners, in the file's order, each with its number from the file in „Nr. orig.”;
- „Suprafață calculată (m²)”, from the corners, and the map drawn;
- the provenance „Fișier de coordonate (.txt)” (coordinate file).

The file brings no tarla and no parcela. That is why, already in the window, the application warns you that the property will have no cadastral identity: it cannot be found by its parcel, and it cannot be checked for being a duplicate. Open the property and fill in „Nr. tarla / sola” and „Nr. parcelă” in „Identificare cadastrală”.

## 5.6 „Navighează” (directions) {#properties-navigate}

„Navighează”, below the „Hartă” tile, helps you get to the property by car. It opens a window with the route in Google Maps and the same route as a QR code, for the phone.

The application chooses the destination:

- if the property has corners, the route goes to the parcel's centre („Spre parcelă: centrul ei pe hartă.”, to the parcel: its centre on the map);
- if it has only an address, the route goes to its address („Spre adresa: …”);
- if it has neither corners nor an address, the „Navighează” button is inactive and says why.

At „Pornire” (start) you choose where you start from:

- „Locația mea” (my location) — the phone that scans the code starts from where it is; on the computer, Google Maps asks for the browser's location;
- „De la o adresă” (from an address) — type the starting address at „Adresa de pornire”; until you type it, the link and the QR code do not appear.

Scan the QR code with the phone, and Google Maps starts the navigation. On the computer, „Deschide în Google Maps” (open in Google Maps) opens the route in a new tab, and „Copiază linkul” (copy the link) copies it, so you can send it to someone. Google Maps draws the route, up to the nearest road on its map.

„Navighează” is also in a property's bubble on the full map (chapter [[map]]).

## 5.7 Examples and use cases {#properties-examples}

### 5.7.1 Add a plot in Bragadiru and draw it on the map {#properties-example-draw}

1. In „Proprietăți”, press „Adaugă proprietate”, then „Introducere manuală” (section [[properties-add]]).
2. Type the nickname, for instance „Teren Bragadiru”, choose the tarla in „Nr. tarla / sola”, and type the parcela and the area from the papers.
3. On the map, press „Desenează” and place the corners; close the shape on the first point (section [[properties-corners-draw]]).
4. Compare „Suprafață calculată (m²)” with „Suprafață oficială (m²)”.
5. Press „Salvează”. The property appears at the top of the list, badged „Nou!”.

### 5.7.2 Bring in a parcel from a surveyor's file {#properties-example-file}

1. „Adaugă proprietate”, then „Din fișier text”; choose the .txt file and press „Importă” (section [[properties-coord-file]]).
2. Open the new property and check on the map that the sides do not cross; if they do, use „Îndreaptă ordinea” (section [[properties-corners-table]]).
3. Fill in the tarla and the parcela in „Identificare cadastrală” and save.

### 5.7.3 Go to the plot with your phone {#properties-example-navigate}

1. Open the property and press „Navighează”, below the map (section [[properties-navigate]]).
2. Leave „Locația mea” at „Pornire”.
3. Scan the QR code with the phone: Google Maps starts the navigation from where you are.

### 5.7.4 Correct a wrong corner {#properties-example-corner}

1. Open the property; in „Puncte de contur”, press „Editează” on the corner's row (section [[properties-corners-table]]).
2. Type the correct coordinate and press the row's „Salvează”. The calculated area changes at once.
3. Press „Salvează” at the bottom. The version before keeps the old corner (section [[links-versions]]).
`;
