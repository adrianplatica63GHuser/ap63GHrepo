/**
 * Manual, en-GB, chapter 8. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 8 The properties map {#map}

The properties map shows, on a single screen, every piece of land in the archive that has corners. On it you see where the properties lie in relation to one another, open one with a double-click, measure a distance or an angle, find the area of a zone and spot the properties entered twice. Corners are not drawn or moved on this map: a parcel's shape is changed on its own screen, in the „Map” tile (section [[properties-corners]]).

A few of the map's gestures are not shown on any label: dragging a rectangle, the double-click, clicking a corner. The small light bulb beside where they happen explains them briefly (section [[start-help]]); this chapter explains them in full.

## 8.1 What the map shows {#map-what}

The screen is called „All Properties”. The map opens fitted so that every property it draws fits on it. Each property with corners appears as a blue shape, its sides joined in the order of its corners, and its corners are small dots of the same colour. When you zoom out and a shape becomes too small to read, a drop appears in its place (section [[map-what-drops]]). A property without corners has no outline, so it does not appear on the map; corners can be added to it at any time, in „Corners” (section [[properties-corners-table]]).

At the top of the map are its buttons. „STR” and „SAT” choose the street map or the satellite image, as on a property's „Map” tile. The other buttons are the map's tools, explained below:

- „Select” — picks several properties at once (section [[map-select]]);
- „Ruler” and „Angles” — measure a distance and an angle (section [[map-ruler]]);
- „Area of a delimited zone” and „Area of any zone” — calculate the area of a zone (section [[map-area]]);
- „Tarlale” — each tarla's outline (section [[map-what-tarlale]]);
- „Groups” — chooses which properties are shown (section [[map-what-groups]]);
- „Map settings” — the distance at which drops merge (section [[map-what-drops]]).

### 8.1.1 Opening the map {#map-what-open}

The map opens from two places:

- from the „Properties” list, with the „Full map” button, on the right, beside „Add new Property” (section [[properties-list]]). The navigation bar then reads „Home › Properties › Full map”, and a click on „Properties” takes you back to the list. In the sidebar, „Properties” stays lit;
- from the sidebar, „Tools” → „Area Calculation”. The same map opens, but its two area buttons pulse together, three times, in a violet ring, so that you find them easily. Neither is pressed for you: choose the one you need (section [[map-area]]). In the sidebar, „Area Calculation” stays lit.

### 8.1.2 A property's bubble and the double-click {#map-what-bubble}

A click inside a property opens a bubble above it, with the property's name and the buttons:

- „Open” — takes you to the property's screen;
- „Navigate” — the route to the land, in Google Maps and as a QR code for a phone (section [[properties-navigate]]).

A click on the map outside any property closes the bubble.

Faster still, a **double-click** on a property opens it directly, with no bubble.

### 8.1.3 Duplicate properties {#map-what-duplicates}

A property that **blinks pink** is a duplicate property: the same piece of land is entered twice in the archive. Open both, compare them and keep the right one (section [[map-example-duplicate]]).

On saving, the archive refuses from the start a second property with the same tarla and the same parcel (section [[properties-add-one-parcel]]). The blinking on the map shows you the duplicates that have reached the archive all the same.

### 8.1.4 The „Groups” filter {#map-what-groups}

„Groups” opens a list with ticks: „All (in groups or not)”, „Not in a group” and the archive's groups of properties. With them you choose which properties the map draws — for example only the land of a group made for a valuation (section [[links-classify-groups]]). When the archive has no group with a description, the list says „No named groups”.

### 8.1.5 Drops and numbered drops {#map-what-drops}

While a property is large enough on screen, the map draws its shape. When you zoom out and the longer side of the shape falls under 24 pixels, a blue **drop** appears in its place, its tip at the middle of the property. Each property changes on its own size: a large field stays a shape long after a small lot beside it has become a drop. A drop stays the same size however far you zoom out.

Drops that come too close to one another merge into a **numbered drop**, larger, with the number of properties it covers written in white. When numbered drops merge too, their numbers add up. When you zoom in, everything comes apart in reverse: numbered drops split, and drops become shapes again.

- A click on a drop opens the same bubble as a click on the property's shape, with „Open” and „Navigate” (section [[map-what-bubble]]).
- A click on a numbered drop zooms the map in until its properties fit. If the map cannot zoom in any further, the bubble opens with the list of them.

The colours say what they say on the shapes: red, a selected property (section [[map-select]]); blinking pink, a duplicate property (section [[map-what-duplicates]]). Two duplicate properties have the same corners, so from afar they always end up in the same numbered drop, which blinks pink. A numbered drop is red when a selected property is in it.

„Map settings”, on the map's toolbar, chooses the distance under which drops merge: „Drops merge under” between 20 and 80 pixels, 40 by default. A smaller distance shows more drops, a larger one fewer. The choice is kept in the browser where you made it; another computer or another browser starts from 40.

### 8.1.6 The „Tarlale” layer {#map-what-tarlale}

„Tarlale” draws each tarla's outline: a dashed grey-green line with no fill, so it is never mistaken for a property. The layer is off when the map opens; pressing the button turns it on, pressing it again turns it off.

A tarla's outline is its own corners, if they were entered on the tarla's page (section [[properties-tarla]]). Otherwise it is the shape around all the tarla's properties that have corners — the smallest shape without dents that holds them all. It grows as the archive grows, and it is not an official boundary: no public source gives tarla boundaries. A tarla with no corners and no properties with corners has no outline.

The tarla's code appears on the outline when you zoom the map in to a few kilometres. A click on the outline or on the code opens the tarla's page.

## 8.2 Selecting {#map-select}

Selecting picks several properties at once, so that you can see them separately or delete them.

1. Press „Select”. The map enters selection mode: from now on, a drag with the mouse no longer moves the map but draws a rectangle.
2. Drag a rectangle over the properties you want. They become selected.
3. „Display all selected” opens, beside „All Properties”, the tab „Selected Properties”, with only the selected properties.
4. „Cancel select” takes you out of selection mode, and the map moves again when dragged.

The „Delete all selected (…)” button shows in brackets how many properties are selected. **It deletes the properties from the archive, not just the selection.** First the application asks: „This will delete … selected properties. This action cannot be undone.” Read the number, then choose „Delete” or „Cancel”. If the deletion fails, „The selected properties could not be deleted. Try again.” appears.

For a single property, deleting it from its own screen is safer: there you see what you are deleting (section [[properties-add-edit]]).

## 8.3 The ruler and the angles {#map-ruler}

The ruler and the angles only measure: they change nothing, and what you measure is not saved.

### 8.3.1 „Ruler” {#map-ruler-distance}

„Ruler” measures the straight-line distance between two points.

1. Press „Ruler”.
2. Click the map at the first point.
3. Click at the second point. The distance between them appears on the map.

When you click close to a property's corner, the end of the ruler snaps to the corner. That way a measurement from one corner to another is exact, not as steady as your hand was.

### 8.3.2 „Angles” {#map-ruler-angles}

„Angles” shows the angle at a corner.

1. Press „Angles”.
2. Click a property's corner. Its angle appears on the map.

Where several properties meet at a single corner, the angle of each appears. On a property's screen, „Show Angles” shows the angles of all its corners at once (section [[properties-corners-map]]).

## 8.4 The area of a zone {#map-area}

Two buttons calculate the area of a zone on the map: „Area of a delimited zone”, drawn as a rectangle with a dot at each corner, and „Area of any zone”, a rectangle with a dotted line. The zone appears as a light violet polygon, with its area written inside it: „… m² (… ha)”. The area is calculated the same way as a parcel's area, from the Stereo 70 coordinates.

The two buttons behave alike:

- one press starts the tool, and the button stays pressed;
- only one is used at a time: when you press the second, the first is released;
- while one is pressed, the rest of the map does not respond, and „Ruler” and „Groups” are inactive. If the map tells you „Release the area button first.”, press the area button again;
- pressed a second time, the button is released, and the polygon, its corners and the area disappear.

Nothing is written to the archive: the zone is only a measurement.

### 8.4.1 „Area of a delimited zone” {#map-area-delimited}

Here the zone is bounded by corners that already exist, those of the properties on the map.

1. Press „Area of a delimited zone”. The prompt appears: „Pick property corners one after another; Backspace removes the last.”
2. Click the corners one after another, in the order in which they follow along the edge of the zone. Each chosen corner gets a dot, and the violet polygon passes through them.
3. Read the area in the polygon.

A click on the map far from any corner changes nothing. The Backspace key removes the last corner chosen. If you choose the corners jumping from one side to another, the sides cross and the application tells you: „The sides cross — pick the corners in order.”

If you choose all the corners of a single property, in their order, the area in the polygon is exactly its calculated area. With the corners along the edge of two neighbouring plots, you find their area together.

### 8.4.2 „Area of any zone” {#map-area-free}

Here you draw the zone freely, anywhere on the map, as with a property's corners (section [[properties-corners-draw]]).

1. Press „Area of any zone”. „Done” appears.
2. Click the map for each corner of the zone. A line follows the mouse, and the area in the polygon changes as you move it, as though the mouse were the next corner.
3. To close the polygon, click the first corner again or press „Done”.
4. Once it is closed, a corner can be dragged with the mouse; the polygon and the area follow it.

### 8.4.3 From „Tools” {#map-area-tools}

You find the same calculation in the sidebar, under „Tools” → „Area Calculation”: it opens the map with the two buttons pointed out (section [[map-what-open]]). The tool is described, together with the others, in section [[tools-area]].

## 8.5 Street View {#map-street-view}

On the properties map, Street View opens with Google's little figure: drag it onto a street, and the map shows the street image at that spot.

Google charges for every Street View image opened, so drag the figure only when you need the image. For a single property, its „Street View” tile shows the image beside the parcel (section [[properties-corners-street-view]]).

## 8.6 Examples and use cases {#map-examples}

### 8.6.1 Find the area of two neighbouring plots in Bragadiru {#map-example-area}

You want to know how much two adjoining plots measure together, before an offer.

1. In „Properties”, press „Full map” and find the two plots (section [[map-what-open]]).
2. Press „Area of a delimited zone”.
3. Click, in order, the corners along the outer edge of the two plots, going round them together (section [[map-area-delimited]]).
4. Read the area in the violet polygon. A corner chosen by mistake is removed with Backspace.
5. Press the button again: the polygon disappears, and nothing has been written to the archive.

### 8.6.2 Measure how far a plot is from the road {#map-example-ruler}

1. Open the properties map and press „SAT”, to see the road.
2. Press „Ruler” (section [[map-ruler-distance]]).
3. Click the plot's corner nearest the road: the ruler snaps to it.
4. Click the edge of the road and read the distance.

### 8.6.3 Find a property entered twice {#map-example-duplicate}

On the map, a plot blinks pink (section [[map-what-duplicates]]).

1. Double-click the plot to open it, and look at its code and at what it has in „Links” (section [[map-what-bubble]]).
2. Go back to the map with „Back” (section [[start-breadcrumb]]) and open the other object of the same plot too.
3. Decide which one is right and link to it whatever it lacks (chapter [[links]]).
4. Delete the other one from its own screen (section [[properties-add-edit]]).

### 8.6.4 See only the plots of a group {#map-example-group}

You have gathered the plots for a valuation into a group (section [[links-example-group]]) and want to see them on the map.

1. Open the properties map and press „Groups” (section [[map-what-groups]]).
2. Leave only the valuation's group ticked.
3. The group's plots remain on the map. A click on one opens the bubble, and „Open” takes you to its screen.
`;
