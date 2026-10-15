/**
 * Manual, en-GB, chapter 9. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 9 Tools {#tools}

The sidebar's „Instrumente” (tools) section holds three working tools: „Distilare Tipizate”, „Calcul drum lateral” (side-road calculation) and „Calcul suprafață” (area calculation). Each does something different and costs something different, so it is worth knowing beforehand:

- „Distilare Tipizate” builds the form of a document type from a few sample documents. The samples are read by the AI, and **that reading is paid for**.
- „Calcul drum lateral” splits a parcel between its owners, with a shared road, and **creates real properties** in the archive — but only when you confirm.
- „Calcul suprafață” only opens the map of properties, with the area tools pointed out. It writes nothing.

## 9.1 Distilare Tipizate (DocTypeEngine) {#tools-doc-type-engine}

A document type can have a form: fields of its own, on top of the general fields every document has (section [[documents-type]]). The form matters above all at import: every document of a type with a form fills in its fields by itself, from what the AI reads on the pages. For a type with no form, the import stops and sends you here (section [[import-scanning]]).

„Distilare Tipizate” builds that form. You give it a folder holding several documents of the same kind; each is read in full, the documents are compared with one another, and the tool proposes the form with the information they have in common. You correct it, you approve it, and from then on the import reads that type with its form. **Nothing is imported**: no document is created and nothing else is written to the archive. The only thing that changes is one type's form.

The screen opens on „Alegeți tipul, folderul cu mostre și pragul” (choose the type, the sample folder and the threshold) (Figure [[fig-tools-doc-type-engine]]).

![9.1 The „Distilare Tipizate” screen](tools-doc-type-engine.png){#fig-tools-doc-type-engine}

You also get here from other places, with the type already chosen: from the line „Acest tip nu are încă formular; formularul se construiește în Distilare Tipizate.” (this type has no form yet; the form is built in Distilare Tipizate) under a document's „Tip document” (section [[documents-type]]), and from „Creați formularul în „Distilare Tipizate”” on the screen where the import stops (section [[import-scanning]]). To see which types have no form yet, open „Date de referință” → „Tipuri de Document” and tick „Fără formular” (without a form) (section [[admin-reference-data]]).

### 9.1.1 The type, the samples and the threshold {#tools-doc-type-engine-pick}

**„Tipul de document care primește formularul”** (the document type that receives the form) — choose the type from the list. Two marks in the list tell you something:

- „are deja formular” (already has a form) — the type can still be chosen. The new fields are added to the ones it has; none of the existing ones is changed or removed.
- „nu poate primi formular” (cannot have a form) — the identity card, whose details are taken at import as persons rather than as values in a form, and the catch-all type, which gathers the documents whose type could not be established.

**„Alege folderul cu mostre…”** (choose the sample folder) — point at a folder on the computer holding documents of the same kind, usually between ten and twenty. The browser asks your permission to read the folder; give it. It works in Chrome, Edge or another Chromium-based browser. JPEG, PNG, GIF or WebP images and PDF files are read; TIFF, BMP, Word or text cannot be. One run reads a limited number of samples: if the folder holds more, the screen tells you how many will not be read, and if you want them all, split the folder.

**„Procent de potrivire”** (matching percentage) — the threshold. A piece of information becomes a field on the form if it appears in at least this percentage of the samples that were actually read. The rest is not lost: at every future import it goes into the document's „Note extinse” (extended notes), as it does today.

### 9.1.2 The reading and its cost {#tools-doc-type-engine-cost}

Before you start, the screen tells you what you will pay for: „Citirea AI se plătește” (the AI reading is paid for), how many samples will be read in full, plus one comparison call at the end. It also tells you how long it will take at least, because only a limited number of readings is sent per minute. Reading each sample costs money, so choose the samples with care: whole, legible documents, all of the same kind.

„Începe citirea” (start reading) starts it. The screen shows how many samples have finished; when it waits for the per-minute limit, it counts down the seconds, and no sample is lost because of it.

„Oprește citirea” (stop reading) stops the waiting and the samples not yet sent; those are not paid for. A reading already under way finishes, because it is paid for anyway, and the samples read so far are still compared, so that they were not paid for in vain.

If the samples were read but comparing them fails, the readings have already been paid for, and starting again pays for them a second time.

### 9.1.3 The proposed form {#tools-doc-type-engine-review}

After the comparison, „Formularul propus” (the proposed form) opens. Its first line says how many samples were read out of how many you chose — for example „S-au citit 14 din 20 de mostre alese.” (14 of 20 chosen samples were read). Every percentage below it is out of the samples read, not the samples chosen.

The information found is split into three:

- **the fields on the form** — those above the threshold. Each has a tick box (ticked to start with), „Etichetă” (label), „Fel” (kind: „Text”, „Text lung” — long text, „Dată” — date, or „Număr” — number), in how many samples it was found, how it is written on the documents („Scris pe documente ca: …”), „Indiciu pentru AI” (hint for the AI) and „Vezi valorile citite din … mostre” (see the values read from … samples), which shows what was read on each document;
- **the information below the threshold** — it does not become fields; at future imports it goes into „Note extinse”;
- **the information the type already has** — above the threshold, but the type already has a field for each, so it is not proposed again.

Change the label however you like: the AI goes on reading the same way, because „Indiciu pentru AI” keeps the wording found on the page. Untick a field to keep it off the form. Every ticked field needs a label, and a field cannot take the name of a field the type already has.

„Procent de potrivire” can be moved here too: nothing is re-read and nothing is paid for; the information simply moves between „on the form” and „below the threshold”. A document type can have a limited number of fields; if the form would exceed it, raise the percentage or untick a few fields. „Ia de la capăt” (start over) discards what you see and takes you back to the choice.

### 9.1.4 Approving the form {#tools-doc-type-engine-save}

„Aprobă formularul” (approve the form), with the number of ticked fields in brackets, writes only the ticked fields. Nothing else in the archive changes. „Formularul a fost salvat” (the form has been saved) appears: from now on every document of this type fills in these fields by itself, at import, without asking, and an import that stopped for this type can be started again from the beginning. „Mergi la Import în sistem” takes you to the import (chapter [[import]]).

A form can also be built or corrected by hand, on the type's page under „Date de referință” → „Tipuri de Document”, on the „Formular” tab (section [[admin-reference-data]]).

## 9.2 The side-road calculation {#tools-side-road}

„Calcul drum lateral” splits a four-cornered parcel between its owners, by their shares, with a shared access road along one side. From the data file it shows you the split on the map, lets you choose the order of the owners and where the road goes and, at the end, creates one property for each owner, one for the road and a group holding them all. Every calculation is recorded in „Istoricul calculelor” (the calculation history).

In the sidebar, open „Instrumente” → „Calcul drum lateral”. The „Calcul” screen opens (Figure [[fig-tools-calculation]]): the explanation of the file, the history icon and „Alegeți fișierul de date…” (choose the data file).

![9.2 The „Calcul drum lateral” screen](tools-calculation.png){#fig-tools-calculation}

**Nothing is created until „Creează proprietățile”** (create the properties). Everything you see on the map and in the table is a preview; you can try as many orders and as many roads as you like.

### 9.2.1 The data file {#tools-side-road-file}

The file has three sections, each opened by a line starting with „Secțiunea de”:

| Section | What it holds | The rule |
|---|---|---|
| „Colțuri” (corners) | one corner per line: the corner's number, X (North) and Y (East), in Stereo 70 | exactly 4 corners, written in the order the outline is walked |
| „Proprietari” (owners) | one owner per line: the name, then the share („24,33%”) | at least 2 owners; the shares add up to 100% or 99,99%, nothing else |
| „Lățime drum” (road width) | the width of the road, in metres | one single value, above 0 and below 15 m |

The columns are separated by a tab or spaces, and the numbers may have a decimal comma or point. Before the first section there may only be empty lines or lines of „*”.

A file that breaks a rule is rejected: the screen reads „Fișierul nu poate fi folosit:” (the file cannot be used) and the reason, and no map appears. For example:

- „Fișierul are 5 colțuri; trebuie să aibă exact 4.” (the file has 5 corners; it must have exactly 4)
- „Cotele-părți însumează 98,00%; trebuie să fie 100% sau 99,99%.” (the shares add up to 98,00%; they must be 100% or 99,99%)
- „Lățimea drumului este 15 m; trebuie să fie peste 0 și sub 15 m.” (the road width is 15 m; it must be above 0 and below 15 m)
- a section missing or appearing twice, a corner written twice, corners whose sides, in the file's order, cross each other, or a line that cannot be read — the screen then shows the line and what was expected on it.

Correct the file and choose it again.

### 9.2.2 The owners on the map {#tools-side-road-owners}

A good file brings the parcel onto the map, its corners numbered as in the file, cut into one slice per owner, in a random order. The screen shows „Suprafața parcelei” (the parcel's area), „Lățime drum”, the length of each side („Latura 16–17” and so on) and the table of owners.

You change the order of the slices in two ways: drag one slice onto another to swap them, or use the ↑ ↓ buttons in the table's „Mută” (move) column. Each slice keeps its area, and the cutting lines move. Each owner keeps its colour as well: the swatch beside its name in the table has the colour of its slice on the map, wherever it moves.

If the shares add up to 99,99%, the line under the table says that the last slice in the order takes the missing 0,01%, and its figures include it.

### 9.2.3 The road {#tools-side-road-road}

At „Pasul 3 — drumul” (step 3 — the road), click the corner the road starts from — its number on the map — or choose it further down, at „Colțul drumului” (the road's corner). The screen then names the two sides that start from that corner; click the side's name, written at its middle, or choose it at „Latura drumului” (the road's side). A side that does not start from the chosen corner is refused, and the corner stays chosen.

The road appears in white on the map: a strip as wide as the file says, inside the parcel, along the chosen side, starting from the chosen corner. The owners are laid out along it, the borders between them perpendicular to the road; the first sits at the corner where the road starts, and the last, beyond the road's end, reaches the road at its end. Each owner receives, by its share, its part of the parcel without the road and, also by its share, a part of the road. The road's length is worked out by itself, so that the areas come out right.

The screen shows „Lungime drum” (road length) and „Suprafață drum” (road area), and the table has the columns:

| Column | What it shows |
|---|---|
| „Nr.”, „Proprietar”, „Cotă” | the order, the name and the share |
| „Cotă × parcelă (m²)” | what the owner is due from the whole parcel |
| „Cotă din drum (m²)” | the owner's part of the road's area |
| „Suprafață proprie (m²)” | the owner's slice, without the road |
| „Proprie + drum (m²)” | the two together |
| „Diferență (m²)” | on a successful calculation, 0,00 |

The order of the owners can still be changed after you have set the road: the road keeps its corner and its side, and its length is recalculated. „Alege alt drum” (choose another road) lets you choose another corner or another side.

Sometimes the shape of the parcel does not allow the chosen road — the road would be longer than the side, would leave the parcel, would leave no room for the owners, or an owner's slice would not reach it. The screen says which of these it is and asks for another side, another corner or another order.

### 9.2.4 Creating the properties {#tools-side-road-create}

Further down stands „Creează … proprietăți — proprietarii și drumul — și un grup” (create … properties — the owners and the road — and a group), with two fields:

- „Descrierea grupului” (the group's description) — filled in by itself with „Diviz —” followed by the file's name. Choosing another file writes it again, so write your own description after you have chosen the file.
- „Poreclă drum” (the road's nickname) — starts as „Drum comun” (shared road).

The owners' names from the file are saved only as each property's nickname, as text. No persons are created and nobody is linked to the properties: the owners are linked separately, from each property's screen (section [[links-associate]]).

„Creează proprietățile” creates the properties and the group. The screen reads „S-a creat grupul GRP-… cu următoarele proprietăți:” (group GRP-… was created with the following properties), the calculation's code („Calculul înregistrat: CALC…”) and a link to each new property. Each property's corners carry, in „Nr. orig.”, the numbers of the parcel's corners from the file, where a corner of the parcel landed on it (section [[properties-corners-table]]). You find the group in „Grupuri” (section [[links-classify-groups]]). „Vezi istoricul calculului” (see the calculation's history) opens the calculation's page.

### 9.2.5 The calculation history {#tools-side-road-history}

The history icon, on the „Calcul” screen, opens „Istoricul calculelor”: one row per calculation, with „Cod” (code), „Algoritm” („Drum lateral”), „Parcele” (how many properties it created), „Grup”, „Stare” (status), „Creat de” (created by) and „Data” (date). „Înapoi la Calcul” takes you back.

„Detalii” (details), on a row, opens „Detalii calcul”: „Parametrii calculului” (the calculation's parameters), „Descriere grup”, „Pașii calculului” (the table of owners), „Previzualizare hartă” (the slices, in the owners' colours) and „Parcele create” (parcels created) — each property, with „Rol” („Parcelă proprietar” — owner's parcel, or „Drum comun”) and „Vezi proprietatea” (see the property). A property deleted since shows „(ștearsă)” (deleted).

„Re-rulează cu acești parametri” (re-run with these parameters) reopens „Calcul” on the same file, with the owners in the same order and the road already set. An old calculation, made with the former five-section file, can be looked at but can no longer be re-run.

„Șterge calculul” (delete the calculation), on a calculation's row, asks „Ștergeți calculul?” and says that the properties and the group it created stay. „Șterge” removes the calculation from the history; the properties and the group are deleted separately, if need be. A deleted calculation's code is never given to another.

## 9.3 The area calculation {#tools-area}

„Instrumente” → „Calcul suprafață” opens the map of all properties, „Toate Proprietățile”. In the sidebar „Calcul suprafață” stays marked, not „Proprietăți”.

To make them easy to find, the map toolbar's two area buttons pulse together, in violet, three times, then settle:

- „Suprafața unei zone delimitate” (area of a bounded zone) — you choose property corners, one after another;
- „Suprafața unei zone oarecare” (area of any zone) — you draw the zone freely, corner by corner, as for a new property.

Neither is pressed for you: press the one you need. How each one works is in section [[map-area]]. If you reload the page, the buttons are pointed out again.

## 9.4 Examples and use cases {#tools-examples}

### 9.4.1 Build the form of a document type that has none yet {#tools-example-form}

The import stopped because the „Certificat de Moștenitor” type has no form, and you have fifteen scanned certificates.

1. Put the certificates, as PDFs or images, in a folder of their own.
2. Open „Instrumente” → „Distilare Tipizate” and choose the type at „Tipul de document care primește formularul” (section [[tools-doc-type-engine-pick]]).
3. „Alege folderul cu mostre…”, leave „Procent de potrivire” as it is and read what it will cost (section [[tools-doc-type-engine-cost]]).
4. „Începe citirea”, and wait until „Formularul propus” opens.
5. Give the fields clear labels, choose the right „Fel” and untick what you do not need (section [[tools-doc-type-engine-review]]).
6. „Aprobă formularul”, then start the import again, from the beginning (section [[tools-doc-type-engine-save]]).

### 9.4.2 Split a plot in Bragadiru between three heirs, with an access road {#tools-example-road}

The surveyor has sent you the plot's corners, and the three heirs each hold a third.

1. Write the data file: the four corners, the three owners at „33,33%” each and the road width, for example 3 (section [[tools-side-road-file]]).
2. „Instrumente” → „Calcul drum lateral”, then „Alegeți fișierul de date…”.
3. Put the owners in the order you want, by dragging the slices or with ↑ ↓ (section [[tools-side-road-owners]]).
4. Click the corner by the public road, then the side the road runs along; check that „Diferență” reads 0,00 on every row (section [[tools-side-road-road]]).
5. Write „Descrierea grupului”, then press „Creează proprietățile” (section [[tools-side-road-create]]).
6. On each new property, link its heir (section [[links-associate]]).

### 9.4.3 Redo a calculation made with the owners in the wrong order {#tools-example-redo}

You created the properties, but the owners stood in a different order from the one they should have.

1. Open „Istoricul calculelor” from the „Calcul” screen, then „Șterge calculul” on the wrong calculation's row, and „Șterge” (section [[tools-side-road-history]]).
2. Delete the properties and the group it created, which stayed (sections [[properties-add-edit]] and [[admin-groups]]).
3. Choose the file again on „Calcul”, set the right order and the road, then „Creează proprietățile” (section [[tools-side-road-create]]).
`;
