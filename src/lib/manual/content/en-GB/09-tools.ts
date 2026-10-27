/**
 * Manual, en-GB, chapter 9. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 9 Tools {#tools}

The sidebar's „Tools” section holds two working tools, „DocTypeEngine” and „Calculation of a Side Road”, and three guides to the map's buttons: „Measurements on map”, „Groupings of properties” and „Navigation”. Each does something different and costs something different, so it is worth knowing beforehand:

- „DocTypeEngine” builds the form of a document type from a few sample documents. The samples are read by the AI, and **that reading is paid for**.
- „Calculation of a Side Road” splits a parcel between its owners, with a shared road, and **creates real properties** in the archive — but only when you confirm.
- „Measurements on map”, „Groupings of properties” and „Navigation” only explain the map's buttons; the first two then open the map, with the buttons pointed out. They write nothing.

## 9.1 DocTypeEngine {#tools-doc-type-engine}

A document type can have a form: fields of its own, on top of the general fields every document has (section [[documents-type]]). The form matters above all at import: every document of a type with a form fills in its fields by itself, from what the AI reads on the pages. For a type with no form, the import stops and sends you here (section [[import-scanning]]).

„DocTypeEngine” builds that form. You give it a folder holding several documents of the same kind; each is read in full, the documents are compared with one another, and the tool proposes the form with the information they have in common. You correct it, you approve it, and from then on the import reads that type with its form. **Nothing is imported**: no document is created and nothing else is written to the archive. The only thing that changes is one type's form.

The screen opens on „Choose the type, the sample folder and the threshold” (Figure [[fig-tools-doc-type-engine]]).

![9.1 The „DocTypeEngine” screen](tools-doc-type-engine.png){#fig-tools-doc-type-engine}

You also get here from other places, with the type already chosen: from the line „This type has no form yet; its form is built in DocTypeEngine.” under a document's „Document Type” (section [[documents-type]]), and from „Build the form in DocTypeEngine” on the screen where the import stops (section [[import-scanning]]). To see which types have no form yet, open „Reference Data” → „Document Types” and tick „Without a form” (section [[admin-reference-data]]).

### 9.1.1 The type, the samples and the threshold {#tools-doc-type-engine-pick}

**„The document type that gets the form”** — choose the type from the list. Two marks in the list tell you something:

- „already has a form” — the type can still be chosen. The new fields are added to the ones it has; none of the existing ones is changed or removed.
- „cannot have a form” — the four identity document types, whose fields the application defines (section [[documents-identity]]), and the catch-all type, which gathers the documents whose type could not be established.

**„Choose the sample folder…”** — point at a folder on the computer holding documents of the same kind, usually between ten and twenty. The browser asks your permission to read the folder; give it. It works in Chrome, Edge or another Chromium-based browser. JPEG, PNG, GIF or WebP images and PDF files are read; TIFF, BMP, Word or text cannot be. One run reads a limited number of samples: if the folder holds more, the screen tells you how many will not be read, and if you want them all, split the folder.

**„Matching %”** — the threshold. A piece of information becomes a field on the form if it appears in at least this percentage of the samples that were actually read. The rest is not lost: at every future import it goes into the document's „Enhanced Notes”, as it does today.

### 9.1.2 The reading and its cost {#tools-doc-type-engine-cost}

Before you start, the screen tells you what you will pay for: „AI reading costs money”, how many samples will be read in full, plus one comparison call at the end. It also tells you how long it will take at least, because only a limited number of readings is sent per minute. Reading each sample costs money, so choose the samples with care: whole, legible documents, all of the same kind.

„Start reading” starts it. The screen shows how many samples have finished; when it waits for the per-minute limit, it counts down the seconds, and no sample is lost because of it.

„Stop reading” stops the waiting and the samples not yet sent; those are not paid for. A reading already under way finishes, because it is paid for anyway, and the samples read so far are still compared, so that they were not paid for in vain.

If the samples were read but comparing them fails, the readings have already been paid for, and starting again pays for them a second time.

### 9.1.3 The proposed form {#tools-doc-type-engine-review}

After the comparison, „The proposed form” opens. Its first line says how many samples were read out of how many you chose — for example „14 of 20 chosen samples were read.” Every percentage below it is out of the samples read, not the samples chosen.

The information found is split into three:

- **the fields on the form** — those above the threshold. Each has a tick box (ticked to start with), „Label”, „Kind” („Text”, „Long text”, „Date” or „Number”), in how many samples it was found, how it is written on the documents („Printed on the documents as: …”), „AI hint” and „See the values read out of … samples”, which shows what was read on each document;
- **the information below the threshold** — it does not become fields; at future imports it goes into „Enhanced Notes”;
- **the information the type already has** — above the threshold, but the type already has a field for each, so it is not proposed again.

Change the label however you like: the AI goes on reading the same way, because „AI hint” keeps the wording found on the page. Untick a field to keep it off the form. Every ticked field needs a label, and a field cannot take the name of a field the type already has.

„Matching %” can be moved here too: nothing is re-read and nothing is paid for; the information simply moves between „on the form” and „below the line”. A document type can have a limited number of fields; if the form would exceed it, raise the percentage or untick a few fields. „Start over” discards what you see and takes you back to the choice.

### 9.1.4 Approving the form {#tools-doc-type-engine-save}

„Approve the form”, with the number of ticked fields in brackets, writes only the ticked fields. Nothing else in the archive changes. „The form has been saved” appears: from now on every document of this type fills in these fields by itself, at import, without asking, and an import that stopped for this type can be started again from the beginning. „Go to Import to the System” takes you to the import (chapter [[import]]).

A form can also be built or corrected by hand, on the type's page under „Reference Data” → „Document Types”, on the „Form” tab (section [[admin-reference-data]]).

## 9.2 The side-road calculation {#tools-side-road}

„Calculation of a Side Road” splits a four-cornered property in the archive between its owners, by their shares, with a shared access road along one side. It shows you the split on the map, lets you choose the order of the owners and where the road goes and, at the end, creates one property for each owner, one for the road and a group holding them all. Every calculation is recorded in „Calculation History”.

In the sidebar, open „Tools” → „Calculation of a Side Road”. The „Calculation of a Side Road” screen opens (Figure [[fig-tools-calculation]]): the history icon, then „The property”, „The owners” and „The road”.

![9.2 The „Calculation of a Side Road” screen](tools-calculation.png){#fig-tools-calculation}

**Nothing is created until „Create the properties”**. Everything you see on the map and in the table is a preview; you can try as many orders and as many roads as you like.

### 9.2.1 The property, the owners and the road {#tools-side-road-file}

The first step gathers three things, all already in the archive or typed there and then:

| What | How | The rule |
|---|---|---|
| „The property” | you find it in „Find the property”, by code, nickname, cadastral number or CF | exactly 4 corners; one without corners is greyed out and cannot be chosen |
| „The owners” | you find them one at a time in „Find an owner”, natural or juridical persons — by name, its words in any order and with or without diacritics, or by code, CNP or CUI — and type each one's „Share” | at least 2, each only once; shares with at most two decimals, adding up to 100% or 99.99% |
| „Road width” | you type it, in metres | above 0 and under 15 m |

The screen keeps what you chose and typed while you look up a code or a name on another screen, until you press „Reset”, right of „Divide the property”.

Each owner gets a colour, the same its slice will have on the map. Whatever breaks a rule is written under the form, after „The data cannot be used:”, and „Divide the property” stays off until everything is right. For example:

- „The shares add up to 98.00%; they must add up to 100% or 99.99%.”
- „The road is 15 m wide; it must be above 0 and under 15 m.”

„Divide the property” opens the steps below. „Change the data” takes you back to the first step, with everything you typed.

### 9.2.2 The owners on the map {#tools-side-road-owners}

„Divide the property” brings the parcel onto the map, its corners numbered as on the property, cut into one slice per owner, in a random order. Above it, a line says what was divided: the property's code, how many owners there are and the road's width. The screen shows „Parcel area”, „Road width”, the length of each side („Side 16–17” and so on) and the table of owners.

You change the order of the slices in two ways: drag one slice onto another to swap them, or use the ↑ ↓ buttons in the table's „Move” column. Each slice keeps its area, and the cutting lines move. Each owner keeps its colour as well: the swatch beside its name in the table has the colour of its slice on the map, wherever it moves — the one it was given in the first step.

If the shares add up to 99.99%, the line under the table says that the last slice in the order takes the missing 0.01%, and its figures include it.

### 9.2.3 The road {#tools-side-road-road}

At „Step 3 — the road”, click the corner the road starts from — its number on the map — or choose it further down, at „Road corner”. The screen then names the two sides that start from that corner; click the side's name, written at its middle, or choose it at „Road side”. A side that does not start from the chosen corner is refused, and the corner stays chosen.

The road appears in white on the map: a strip as wide as chosen in the first step, inside the parcel, along the chosen side, starting from the chosen corner. The owners are laid out along it, the borders between them perpendicular to the road; the first sits at the corner where the road starts, and the last, beyond the road's end, reaches the road at its end. Each owner receives, by its share, its part of the parcel without the road and, also by its share, a part of the road. The road's length is worked out by itself, so that the areas come out right.

The screen shows „Road length” and „Road area”, and the table has the columns:

| Column | What it shows |
|---|---|
| „No.”, „Owner”, „Share” | the order, the name and the share |
| „Share × parcel (m²)” | what the owner is due from the whole parcel |
| „Road share (m²)” | the owner's part of the road's area |
| „Own area (m²)” | the owner's slice, without the road |
| „Own + road (m²)” | the two together |
| „Difference (m²)” | on a successful calculation, 0.00 |

The order of the owners can still be changed after you have set the road: the road keeps its corner and its side, and its length is recalculated. „Choose another road” lets you choose another corner or another side.

Sometimes the shape of the parcel does not allow the chosen road — the road would be longer than the side, would leave the parcel, would leave no room for the owners, or an owner's slice would not reach it. The screen says which of these it is and asks for another side, another corner or another order.

### 9.2.4 Creating the properties {#tools-side-road-create}

Further down stands „Create … properties — the owners and the road — and a group”, with two fields:

- „Group description” — filled in by itself with „Diviz —” followed by the divided property's code. Choosing another property writes it again, so write your own description after you have chosen the property.
- „Road nickname” — starts as „Common road”.

Each new property takes as its nickname its owner's name followed by „(după divizare)” (after the split) — for instance „Ion Popescu (după divizare)” —, and the owner is linked to it with the role „Proprietar” (section [[links-associate]]). The road has no owner. The property divided stays as it was: it is neither changed nor deleted.

„Create the properties” creates the properties and the group. The screen reads „Created group GRP-… with the following properties:”, the calculation's code („Calculation recorded: CALC…”) and a link to each new property. Each property's corners carry, in „Orig. #”, the numbers of the divided property's corners, where a corner of the parcel landed on it (section [[properties-corners-table]]). You find the group in „Groups” (section [[links-classify-groups]]). The calculation is the first row of „Calculation History”, which the history icon beside the title opens (section [[tools-side-road-history]]).

### 9.2.5 The calculation history {#tools-side-road-history}

The history icon, the only one on the „Calculation of a Side Road” screen, beside the title, opens „Calculation History”: one row per calculation, with „Code”, „Algorithm” („Side road”), „Parcels” (how many properties it created), „Group”, „Status”, „Created by” and „Date”. „Back to Calculation” takes you back.

„Details”, on a row, opens „Calculation Detail”: „Calculation parameters”, „Group description”, „Calculation steps” (the table of owners), „Map preview” (the slices, in the owners' colours) and „Created parcels” — each property, with „Role” („Owner parcel” or „Common road”) and „View property”. A property deleted since shows „(deleted)”. Under the header, the page says which property was divided.

„Re-run with these parameters” reopens „Calculation of a Side Road” on the same corners — those of the day of the calculation, even if the property's have changed since —, with the same owners, in the same order, and the road already set; „Change the data” does not appear then. A calculation made from a data file, before the division started from a property in the archive, can be looked at but can no longer be re-run; so can an even older one, made with the five-section file.

„Delete calculation”, on a calculation's row, asks „Delete the calculation?” and says that the properties and the group it created stay. „Delete” removes the calculation from the history; the properties and the group are deleted separately, if need be. A deleted calculation's code is never given to another.

## 9.3 The map's guides {#tools-area}

„Tools” holds three guides to the buttons of the map of all properties. Each opens a box that shows the buttons, drawn as on the map, and says what each does. The box opens every time you press its item.

- „Measurements on map” — „Angles”, „Ruler”, „Area of a delimited zone” and „Area of any zone” (sections [[map-ruler]] and [[map-area]]).
- „Groupings of properties” — „Tarlale”, „Groups” and „Select” (sections [[map-what-tarlale]], [[map-what-groups]] and [[map-select]]).
- „Navigation” — „Navigate”, which is on the property's screen and in a property's bubble on the map (section [[properties-navigate]]).

For the first two, „OK” opens the map of all properties, „All Properties”, with those buttons pulsing together, in violet, three times; then they settle. None is pressed for you: press the one you need. If you reload the page, the buttons are pointed out again. For „Navigation”, „OK” only closes the box. No guide writes anything to the archive.

## 9.4 Examples and use cases {#tools-examples}

### 9.4.1 Build the form of a document type that has none yet {#tools-example-form}

The import stopped because the „Certificat de Moștenitor” type has no form, and you have fifteen scanned certificates.

1. Put the certificates, as PDFs or images, in a folder of their own.
2. Open „Tools” → „DocTypeEngine” and choose the type at „The document type that gets the form” (section [[tools-doc-type-engine-pick]]).
3. „Choose the sample folder…”, leave „Matching %” as it is and read what it will cost (section [[tools-doc-type-engine-cost]]).
4. „Start reading”, and wait until „The proposed form” opens.
5. Give the fields clear labels, choose the right „Kind” and untick what you do not need (section [[tools-doc-type-engine-review]]).
6. „Approve the form”, then start the import again, from the beginning (section [[tools-doc-type-engine-save]]).

### 9.4.2 Split a plot in Bragadiru between three heirs, with an access road {#tools-example-road}

The surveyor has sent you the plot's corners, and the three heirs each hold a third.

1. „Tools” → „Calculation of a Side Road”.
2. Choose the plot, add the three heirs at 33.33 each and the road width, for example 3, then „Divide the property” (section [[tools-side-road-file]]).
3. Put the owners in the order you want, by dragging the slices or with ↑ ↓ (section [[tools-side-road-owners]]).
4. Click the corner by the public road, then the side the road runs along; check that „Difference (m²)” reads 0.00 on every row (section [[tools-side-road-road]]).
5. Write „Group description”, then press „Create the properties” (section [[tools-side-road-create]]). Each heir is linked to their property by itself.

### 9.4.3 Redo a calculation made with the owners in the wrong order {#tools-example-redo}

You created the properties, but the owners stood in a different order from the one they should have.

1. Open „Calculation History” from the „Calculation of a Side Road” screen, then „Details” on the wrong calculation's row and „Re-run with these parameters”: the same property, the same owners, the same road (section [[tools-side-road-history]]).
2. Set the right order, then „Create the properties” (section [[tools-side-road-create]]).
3. In „Calculation History”, „Delete calculation” on the wrong calculation's row, and „Delete”; then delete the properties and the group it created, which stayed (sections [[properties-add-edit]] and [[admin-groups]]).
`;
