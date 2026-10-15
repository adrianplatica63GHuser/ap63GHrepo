/**
 * Manual, en-GB, chapter 7. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 7 Links, versions and history {#links}

In the archive a record seldom stands alone: a contract has sellers and buyers, a plot of land has owners, a person has relatives and companies they represent. This chapter shows how you link two records and read the link from both ends, how you classify records and find them again by tags, groups and stamps, and how you go back to an older version of a record.

## 7.1 Linking two records {#links-associate}

A link between two records is called an association. It is made once, from either end, and it shows from both: if you link a plot of land from a contract's screen, the contract also appears on the land's screen.

### 7.1.1 The association screen {#links-associate-screen}

On a record's „Legături” tile (section [[links-related]]) there are three buttons: „Asociază persoană” (associate a person), „Asociază proprietate” (associate a property) and „Asociază act” (associate a document). Each opens an association screen, with three tiles one under another (Figure [[fig-links-associate]]):

- „Căutare” (search) — the filters. For persons they are „Nume” (name) and „Cod” (code); for properties and documents there is a single box, „Căutare”, which searches by code and by name or title.
- „Rezultate” (results) — the records found. Tick the row or rows you want to link. Natural and judicial persons stand in the same table, and the „Tip” column says which is which: „Fizică” (natural) or „Juridică” (judicial).
- „Asociere” (association) — „Rol” (role) or „Tip legătură” (link type), where the link has one, then „Asociază selecția” (associate the selection) and „Anulează” (cancel). The tile stays in sight at the bottom of the screen, even under a long list of results.

Until you tick something, the line under the buttons says what is missing — for instance „Selectați cel puțin o persoană” (select at least one person). „Asociază selecția” takes you back to the record you started from, with the new link in „Legături”. „Anulează” takes you back without linking anything.

![7.1 The association screen: „Căutare”, „Rezultate” and „Asociere”](links-associate.png){#fig-links-associate}

### 7.1.2 What can be linked to what {#links-associate-kinds}

| The link | Where you make it | What you choose in „Asociere” |
|---|---|---|
| Person – document | from the document or from the person | the person's role in the document, for instance „Cumpărător” (buyer), „Vânzător” (seller) or „Notar” (notary) |
| Company – document | from the document or from the company | the company's role in the document, as for a person |
| Property – document | from the document or from the property | nothing: the link has no role |
| Person – property | from the property or from the person | the person's role, for instance owner or co-owner |
| Company – property | from the property or from the company | the company's role, from the same list as for a person |
| Person – company | from the company or from the person | the role, for instance „Reprezentant legal / Mandatar” (legal representative / agent) |
| Person – person | from either of them | the family tie, for instance „Părinte” (parent), „Soț” (husband) or „Frate” (brother) |
| Document – document | from either of them | „Tip legătură” (section [[links-references]]) |
| Property – property | from either of them | „Tip legătură” (section [[links-references]]) |

A person's share in a document is written after the association, on the document (section [[documents-parties]]).

### 7.1.3 The role {#links-associate-role}

- The role is not compulsory: an association can also be made with „— fără rol —” (no role).
- When you link a document to a person starting from the person, **tick the document first and only then choose the role**. On the tick, the „Rol” list narrows to the roles of that document's type and goes back to „— fără rol —”; a role chosen before the tick is lost, and the link would be saved without a role.
- Between two persons, the role is the ticked person's, towards the person whose screen you are on; the sentence beside „Rol” says so: „Rolul pe care persoana bifată îl are față de …” (the role the ticked person has towards …). The other end shows the reverse role, matched to the person's gender: if on a daughter's screen you tick her father as „Părinte”, on the father's screen she appears as „Fiică” (daughter).
- A person linked to a company as „Reprezentant legal / Mandatar” sees the company, on their own screen, with the role „Reprezentat(ă) / Mandant(ă)” (represented / principal).
- If the document's type has no role prepared, the screen says so in place of the „Rol” list, and the association is made without a role. Roles are prepared in „Date de referință” (section [[admin-reference-data]]).

### 7.1.4 Removing a link {#links-associate-remove}

On „Legături”, choose the row with the round button at its left, then press „Dezasociază” (dissociate). The link disappears from both ends, without any question; the two records stay in the archive, untouched. One row is chosen at a time, whatever its kind. „Dezasociază” can be used only with a row chosen, and while a row is chosen the three „Asociază …” cannot be used.

## 7.2 The „Legături” tile {#links-related}

Every natural person, company, property and document has the „Legături” (links) tile: everything linked to the record, in one place (Figure [[fig-links-related]]). If you do not see it, tick „Legături” among the tiles at the top of the screen (section [[start-tiles]]). When nothing is linked, the tile says „Nimic corelat încă.” (nothing linked yet).

The rows always come in the same order — natural persons, judicial persons, properties, documents — with a thin line between two kinds and the kind's icon at the start of the row. Each row stays on one line:

- a person or a company: the name and, in brackets, the role;
- a property: the name and, when the link has a role, the role in brackets;
- a document: the short label and, in brackets, the document's type.

A row can carry a few buttons:

- „Relația” (the relationship) shows, in a bubble, what links the two records: the person's role in the document (for instance Rol: „Vânzător”) or the sentence of a link with a direction (section [[links-references]]). A click outside the bubble or the Esc key closes it.
- „Vizualizare” (view) opens the linked record read-only; „Modifică” (edit), at the bottom of its screen, makes it editable.
- „Previzualizare” (preview) opens it alongside, without leaving the screen (section [[start-preview]]).
- „Cotă” (share), in orange, holds a person's share in a document (section [[documents-parties]]).

Under the rows are „Asociază persoană”, „Asociază proprietate”, „Asociază act” and „Dezasociază”; on a document, after them, also „Înscrisuri citate” (section [[links-references]]). On a sale contract, the sellers and buyers stand in the „Părți” (parties) tile, grouped by role, and „Legături” holds the contract's other links.

![7.2 A record's „Legături” tile](links-related.png){#fig-links-related}

## 7.3 Cited deeds and included properties {#links-references}

Some links have a direction. A certificate of inheritance is the earlier title of a contract, not the other way round; a parcel is included in a larger plot, not the other way round. Between two documents and between two properties you choose the link from „Tip legătură”, and the application reads it the right way from both ends, as a sentence.

### 7.3.1 A document linked to the deed it cites {#links-references-documents}

On a document, „Asociază act” opens „Asociază Document”. Search for and tick the other document, choose the link in „Tip legătură” — for instance „Titlu anterior al” (earlier title of), „Anexă la” (annex to), „Act adițional la” (addendum to) or „Înlocuiește” (replaces) — and press „Asociază selecția”.

Read the link as a sentence that starts with the document you are on: „acest document „Titlu anterior al” the ticked document” (this document is the earlier title of …). If the sentence does not say what the deeds say, make the link from the other document. From the certificate of inheritance, „Titlu anterior al” with the contract ticked says exactly that the seller's right comes from the certificate.

After the association, „Relația” shows on the certificate „acest document „Titlu anterior al”” followed by the contract, and on the contract the same link, read from the other end: the certificate, „Titlu anterior al”, „acest document”.

The „Înscrisuri citate” (cited deeds) button, on a document's „Legături” tile, opens and closes the panel „Înscrisuri citate în acest document” (deeds cited in this document): the deeds the AI found mentioned in the document. „Verifică înscrisurile citate” (check the cited deeds) takes them one at a time and offers the documents in the archive that might match: „Leagă” (link) makes the link, „Lasă” (leave) leaves the deed unlinked, and „Creează schiță” (create a draft) makes a new document, with no pages, that stands in for the deed. Most deeds cited by an old document are not in the archive, so „Lasă” is often the right answer.

### 7.3.2 A property included in another {#links-references-properties}

On a property, „Asociază proprietate” opens „Asociere proprietate corelată” (associate a related property), with „Tip legătură”. Three links have a direction — „Inclus în” (included in), „Subdiviziune a” (subdivision of) and „Acces prin” (access through) — and the others („Adiacent”, „Contiguu”, „Suprapus cu”, „Alipit de”: adjacent, contiguous, overlapping, joined to) say the same from both ends.

As with documents, the link is read from the property you are on. From the parcel, tick the whole plot and choose „Inclus în”. „Relația” then shows on the parcel „această proprietate „Inclus în”” (this property is included in) followed by the whole plot, and on the whole plot the parcel, „Inclus în”, „această proprietate”.

## 7.4 The „Clasificare” and „Etichete și grupuri” tiles {#links-classify}

Every record has two tiles that concern how you work with it: „Clasificare” (classification) and „Etichete și grupuri” (tags and groups). Rest the mouse on a field's title to learn what it is for, or on the chosen value to learn what it means.

### 7.4.1 „Clasificare” {#links-classify-classification}

| The field | Its values | What it says |
|---|---|---|
| Importanță (importance) | Scăzută, Medie, Ridicată (low, medium, high) | how much the record matters to you, with no justification needed |
| Relevanță (relevance) | Inactiv, Istoric, Actual, De perspectivă (inactive, historical, current, prospective) | where the record stands in time; an old deed can be historical and still very important |
| Proveniență (provenance) | for instance „Manual (Adaugă nou)”, „Interpretare AI”, „Fișier de coordonate (.txt)” | how the record came into the archive |

Under „Proveniență”, „Istoric” (history) keeps every change, with its date. „Salvează” (save), on the line of „Istoric”, cannot be pressed until you change a value; after the save it reads „✓ Salvat”. The save adds a version of the record (section [[links-versions]]).

### 7.4.2 Tags {#links-classify-tags}

Tags are free words by which you find records again — „arendă” (lease), „litigiu” (dispute), „moștenire” (inheritance). In „Etichete și grupuri”, under „Etichete / Cuvinte cheie” (tags / keywords), type the tag into „Introduceți o etichetă…” and press „Adaugă” (add) or Enter. The tag is saved at once, without „Salvează”, and is written in lower case. To remove it, rest the mouse on it and press the „×” that appears in its corner.

You find every record with a tag in „Căutare globală”: type the tag into „Etichetă” and press „Caută” (section [[reports-search]]).

„Administrare” → „Etichete” shows „Nor de etichete” (the tag cloud): every tag in the archive, each with the number of records that carry it, the most used ones larger. A double click on a tag selects it or lets it go:

- with one tag selected, „Redenumește etichetă” (rename tag) turns it into a box right in the cloud; type the new name and press Enter, or Esc to leave it as it was;
- with two or more selected, „Fuzionează etichete” (merge tags) opens „Fuzionare etichete”; choose „Păstrează aceasta” (keep this one) on the tag that stays and press „Fuzionează”.

A tag removed from the last record that carried it disappears from the cloud.

### 7.4.3 Groups {#links-classify-groups}

A group gathers, for a short-lived task, records of one kind — for instance the plots of land for a valuation. The group is made in „Administrare” → „Grupuri” (section [[admin-groups]]): „Adaugă”, choose „Țintă” (target) and type „Descriere” (description), then „Salvează”; the code, in the form GRP-001, is given automatically. „Editează” (edit) on the group's row opens its screen: tick records in „Membri disponibili pentru includere” (members available to include), press „Adaugă în grup” (add to group) and then „Salvează grupul” (save the group). Until „Salvează grupul” nothing is written, and the screen shows „Modificări nesalvate” (unsaved changes).

On a record, „Grupuri” in „Etichete și grupuri” shows its groups. „+ Adaugă în grup” opens the list of groups; „×” on a group takes the record out of it. Beside the group's code, the number in brackets is how many members the group has now — for instance „GRP-001 [2]”, with „2 membri” (2 members) when you rest the mouse on it.

A record can belong to at most three groups. At the third, „+” can no longer be pressed and under the list it says: „Un obiect poate face parte din cel mult 3 grupuri. Scoateți-l dintr-un grup pentru a-l adăuga în altul.” (an item can belong to at most 3 groups; take it out of one to add it to another). You find a group's members in „Căutare globală”, by „Cod grup” (group code). A deleted group does not take its records with it.

### 7.4.4 Stamps {#links-classify-stamps}

A stamp marks a lasting characteristic, on records of any kind. It is made in „Administrare” → „Ștampile”, with „Creare ștampilă” (create stamp): „Descriere scurtă” (short description) and „Note” (notes), and the code is given on saving. „Aplică” (apply), on the stamp's row, opens its screen: choose the kind of records in „Tip element” (item type), tick them in „Elemente disponibile pentru ștampilare” (items available for stamping), press „Aplică ștampila” and then „Salvează ștampilele” (save the stamps). The list of stamps shows, for each, how many records carry it.

On the record, the stamp appears in „Etichete și grupuri”, under „Ștampile”, where „+ Aplică ștampilă” puts on another and „×” takes it off. A deleted stamp disappears from every record.

## 7.5 Versions and „Fă curentă” {#links-versions}

Every save of a record keeps a new version and leaves the one before untouched (section [[intro-versions]]). Versions are counted from 0: a record just created shows „v 0” at the top right. „Salvează” cannot be pressed until you change something, so a new version appears only when something has changed. After the save you stay on the record.

When it has several versions, the top right shows „N versiuni” (N versions), for instance „2 versiuni”. Pressed, it takes you one version back and shows „Versiunea anterioară” (previous version), „Versiunea următoare” (next version) and „Fă curentă” (make current) (Figure [[fig-links-versions]]). On an old version:

- the fields can only be read, and „Salvează” is missing;
- the screen's title still shows the current name, not the one in the version you are reading;
- „Versiunea anterioară” and „Versiunea următoare” move you one version at a time; that is how you compare two versions, reading the fields of one, then of the other.

„Fă curentă” makes the version you are reading the current one again, **by copying it into a new version**. The application first asks „Faceți această versiune curentă?” (make this version current?) and says what will happen, for instance: „Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?” (version 0 will be copied into a new version 3, which becomes the current version; continue?). „OK” does it, „Anulează” gives it up. Nothing is lost: the versions in between stay in the history, and the list shows the values of the new current version.

![7.3 A record's versions](links-versions.png){#fig-links-versions}

## 7.6 The same record in two windows {#links-two-windows}

The same record can be open in two windows or tabs of the browser, and one does not silently cover what was saved in the other:

- When you save in one window, the other reloads by itself, if it has nothing unsaved.
- If you have started typing in the other, it is not reloaded over what you typed. Under the „Modificări nesalvate” band appears, in red: „Acest obiect a fost salvat în altă fereastră. Modificările de aici nu sunt salvate, iar salvarea lor va fi refuzată.” (this item was saved in another window; the changes here are not saved, and saving them will be refused), with „Reîncarcă” (reload).
- If you press „Salvează” there anyway, nothing is written: „Nu s-a salvat nimic: obiectul a fost salvat între timp în altă fereastră sau de alt utilizator. Valorile introduse au rămas pe ecran.” (nothing was saved: the item was saved meanwhile in another window or by another user; the values you typed have stayed on screen).
- „Reîncarcă” asks „Reîncărcați obiectul?” (reload the item?): the unsaved values are lost and the current version is loaded.
- If the record is deleted in one window, the other says „Acest obiect a fost șters în altă fereastră.” (this item was deleted in another window).

The version history holds only the saves that went through. The safest way is to change a record in one window only.

## 7.7 Examples and use cases {#links-examples}

### 7.7.1 Link the owner to a plot of land and check from the other end {#links-example-owner}

A plot of land in Bragadiru has an owner who is already in the archive.

1. Open the land and, on „Legături”, press „Asociază persoană” (section [[links-associate]]).
2. Type part of the person's name into „Nume” and tick their row in „Rezultate”.
3. Choose the owner's role in „Rol” and press „Asociază selecția”.
4. On „Legături”, press „Vizualizare” on the person's row: on their „Legături” tile the land appears, with the role in brackets (section [[links-related]]).

### 7.7.2 Show that the seller inherited the land {#links-example-title}

A sale contract cites the certificate of inheritance the seller's right comes from, and both are in the archive.

1. Open the certificate of inheritance and, on „Legături”, press „Asociază act”.
2. Search for the contract in „Căutare” and tick it.
3. In „Tip legătură”, choose „Titlu anterior al” and press „Asociază selecția” (section [[links-references]]).
4. Open the contract and press „Relația” on the certificate's row: the link reads the certificate, „Titlu anterior al”, „acest document”.

### 7.7.3 Gather a few plots for a valuation {#links-example-group}

1. In „Administrare” → „Grupuri”, make a group with „Țintă” „Proprietate” and a description, for instance „Evaluare primăvară” (spring valuation) (section [[links-classify-groups]]).
2. On the group's screen, tick the plots, press „Adaugă în grup”, then „Salvează grupul”.
3. In „Căutare globală”, type the group's code into „Cod grup” and press „Caută”: every plot in the group appears (section [[reports-search]]).
4. When the valuation is over, delete the group; the plots stay in the archive.

### 7.7.4 Take a person back to an earlier value {#links-example-version}

You corrected a person's first name and saved, then learned that the old form was the right one.

1. On the person's screen, press „N versiuni”, at the top right (section [[links-versions]]).
2. With „Versiunea anterioară” and „Versiunea următoare”, find the version with the old first name.
3. Press „Fă curentă” and then „OK”: that version is copied into a new, current one, and the one with the corrected first name stays in the history.
`;
