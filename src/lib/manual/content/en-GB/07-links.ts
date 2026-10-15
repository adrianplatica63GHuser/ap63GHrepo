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

On a record's „Links” tile (section [[links-related]]) there are three buttons: „Associate person”, „Associate property” and „Associate document”. Each opens an association screen, with three tiles one under another (Figure [[fig-links-associate]]):

- „Search” — the filters. For persons they are „Name” and „Code”; for properties and documents there is a single box, „Search”, which searches by code and by name or title.
- „Results” — the records found. Tick the row or rows you want to link. Natural and judicial persons stand in the same table, and the „Type” column says which is which: „Natural” or „Judicial”.
- „Association” — „Role” or „Link type”, where the link has one, then „Associate Selected” and „Cancel”. The tile stays in sight at the bottom of the screen, even under a long list of results.

Until you tick something, the line under the buttons says what is missing — for instance „Select at least one person”. „Associate Selected” takes you back to the record you started from, with the new link in „Links”. „Cancel” takes you back without linking anything.

![7.1 The association screen: „Search”, „Results” and „Association”](links-associate.png){#fig-links-associate}

### 7.1.2 What can be linked to what {#links-associate-kinds}

| The link | Where you make it | What you choose in „Association” |
|---|---|---|
| Person – document | from the document or from the person | the person's role in the document, for instance „Cumpărător” (buyer), „Vânzător” (seller) or „Notar” (notary) |
| Company – document | from the document or from the company | the company's role in the document, as for a person |
| Property – document | from the document or from the property | nothing: the link has no role |
| Person – property | from the property or from the person | the person's role, for instance owner or co-owner |
| Company – property | from the property or from the company | the company's role, from the same list as for a person |
| Person – company | from the company or from the person | the role, for instance „Reprezentant legal / Mandatar” (legal representative / agent) |
| Person – person | from either of them | the family tie, for instance „Părinte” (parent), „Soț” (husband) or „Frate” (brother) |
| Document – document | from either of them | „Link type” (section [[links-references]]) |
| Property – property | from either of them | „Link type” (section [[links-references]]) |

A person's share in a document is written after the association, on the document (section [[documents-parties]]).

### 7.1.3 The role {#links-associate-role}

- The role is not compulsory: an association can also be made with „no role”.
- When you link a document to a person starting from the person, **tick the document first and only then choose the role**. On the tick, the „Role” list narrows to the roles of that document's type and goes back to „no role”; a role chosen before the tick is lost, and the link would be saved without a role.
- Between two persons, the role is the ticked person's, towards the person whose screen you are on; the sentence beside „Role” says so: „The role the ticked person has towards …”. The other end shows the reverse role, matched to the person's gender: if on a daughter's screen you tick her father as „Părinte”, on the father's screen she appears as „Fiică” (daughter).
- A person linked to a company as „Reprezentant legal / Mandatar” sees the company, on their own screen, with the role „Reprezentat(ă) / Mandant(ă)” (represented / principal).
- If the document's type has no role prepared, the screen says so in place of the „Role” list, and the association is made without a role. Roles are prepared in „Reference Data” (section [[admin-reference-data]]).

### 7.1.4 Removing a link {#links-associate-remove}

On „Links”, choose the row with the round button at its left, then press „Dissociate”. The link disappears from both ends, without any question; the two records stay in the archive, untouched. One row is chosen at a time, whatever its kind. „Dissociate” can be used only with a row chosen, and while a row is chosen the three „Associate …” cannot be used.

## 7.2 The „Links” tile {#links-related}

Every natural person, company, property and document has the „Links” tile: everything linked to the record, in one place (Figure [[fig-links-related]]). If you do not see it, tick „Links” among the tiles at the top of the screen (section [[start-tiles]]). When nothing is linked, the tile says „Nothing related yet.”.

The rows always come in the same order — natural persons, judicial persons, properties, documents — with a thin line between two kinds and the kind's icon at the start of the row. Each row stays on one line:

- a person or a company: the name and, in brackets, the role;
- a property: the name and, when the link has a role, the role in brackets;
- a document: the short label and, in brackets, the document's type.

A row can carry a few buttons:

- „Relationship” shows, in a bubble, what links the two records: the person's role in the document (for instance Role: „Vânzător”) or the sentence of a link with a direction (section [[links-references]]). A click outside the bubble or the Esc key closes it.
- „View” opens the linked record read-only; „Modify”, at the bottom of its screen, makes it editable.
- „Preview” opens it alongside, without leaving the screen (section [[start-preview]]).
- „Share”, in orange, holds a person's share in a document (section [[documents-parties]]).

Under the rows are „Associate person”, „Associate property”, „Associate document” and „Dissociate”; on a document, after them, also „Cited instruments” (section [[links-references]]). On a sale contract, the sellers and buyers stand in the „Parties” tile, grouped by role, and „Links” holds the contract's other links.

![7.2 A record's „Links” tile](links-related.png){#fig-links-related}

## 7.3 Cited deeds and included properties {#links-references}

Some links have a direction. A certificate of inheritance is the earlier title of a contract, not the other way round; a parcel is included in a larger plot, not the other way round. Between two documents and between two properties you choose the link from „Link type”, and the application reads it the right way from both ends, as a sentence.

### 7.3.1 A document linked to the deed it cites {#links-references-documents}

On a document, „Associate document” opens „Associate Document Reference”. Search for and tick the other document, choose the link in „Link type” — for instance „Titlu anterior al” (earlier title of), „Anexă la” (annex to), „Act adițional la” (addendum to) or „Înlocuiește” (replaces) — and press „Associate Selected”.

Read the link as a sentence that starts with the document you are on: „this document “Titlu anterior al” the ticked document” (this document is the earlier title of …). If the sentence does not say what the deeds say, make the link from the other document. From the certificate of inheritance, „Titlu anterior al” with the contract ticked says exactly that the seller's right comes from the certificate.

After the association, „Relationship” shows on the certificate „this document “Titlu anterior al”” followed by the contract, and on the contract the same link, read from the other end: the certificate, „Titlu anterior al”, „this document”.

The „Cited instruments” button, on a document's „Links” tile, opens and closes the panel „Instruments cited in this document”: the deeds the AI found mentioned in the document. „Review the cited instruments” takes them one at a time and offers the documents in the archive that might match: „Link” makes the link, „Leave” leaves the deed unlinked, and „Create a stub” makes a new document, with no pages, that stands in for the deed. Most deeds cited by an old document are not in the archive, so „Leave” is often the right answer.

### 7.3.2 A property included in another {#links-references-properties}

On a property, „Associate property” opens „Associate Related Property”, with „Link type”. Three links have a direction — „Inclus în” (included in), „Subdiviziune a” (subdivision of) and „Acces prin” (access through) — and the others („Adiacent”, „Contiguu”, „Suprapus cu”, „Alipit de”: adjacent, contiguous, overlapping, joined to) say the same from both ends.

As with documents, the link is read from the property you are on. From the parcel, tick the whole plot and choose „Inclus în”. „Relationship” then shows on the parcel „this property “Inclus în”” (this property is included in) followed by the whole plot, and on the whole plot the parcel, „Inclus în”, „this property”.

## 7.4 The „Classification” and „Tags and groups” tiles {#links-classify}

Every record has two tiles that concern how you work with it: „Classification” and „Tags and groups”. Rest the mouse on a field's title to learn what it is for, or on the chosen value to learn what it means.

### 7.4.1 „Classification” {#links-classify-classification}

| The field | Its values | What it says |
|---|---|---|
| Importance | Low, Medium, High | how much the record matters to you, with no justification needed |
| Relevance | Inactive, Historical, Current, Future | where the record stands in time; an old deed can be historical and still very important |
| Provenance | for instance „Manual (Add new)”, „AI interpretation”, „Coordinate file (.txt)” | how the record came into the archive |

Under „Provenance”, „History” keeps every change, with its date. „Save”, on the line of „History”, cannot be pressed until you change a value; after the save it reads „✓ Saved”. The save adds a version of the record (section [[links-versions]]).

### 7.4.2 Tags {#links-classify-tags}

Tags are free words by which you find records again — „lease”, „dispute”, „inheritance”. In „Tags and groups”, under „Tags / Keywords”, type the tag into „Enter a tag…” and press „Add” or Enter. The tag is saved at once, without „Save”, and is written in lower case. To remove it, rest the mouse on it and press the „×” that appears in its corner.

You find every record with a tag in „Global Search”: type the tag into „Tag” and press „Search” (section [[reports-search]]).

„Administration” → „Tags” shows „Tag cloud”: every tag in the archive, each with the number of records that carry it, the most used ones larger. A double click on a tag selects it or lets it go:

- with one tag selected, „Rename tag” turns it into a box right in the cloud; type the new name and press Enter, or Esc to leave it as it was;
- with two or more selected, „Merge tags” opens „Merge tags”; choose „Keep this” on the tag that stays and press „Merge”.

A tag removed from the last record that carried it disappears from the cloud.

### 7.4.3 Groups {#links-classify-groups}

A group gathers, for a short-lived task, records of one kind — for instance the plots of land for a valuation. The group is made in „Administration” → „Groups” (section [[admin-groups]]): „Add”, choose „Target” and type „Description”, then „Save”; the code, in the form GRP-001, is given automatically. „Edit” on the group's row opens its screen: tick records in „Members available to include”, press „Add to Group” and then „Save group”. Until „Save group” nothing is written, and the screen shows „Unsaved changes”.

On a record, „Groups” in „Tags and groups” shows its groups. „+ Add to group” opens the list of groups; „×” on a group takes the record out of it. Beside the group's code, the number in brackets is how many members the group has now — for instance „GRP-001 [2]”, with „2 members” when you rest the mouse on it.

A record can belong to at most three groups. At the third, „+” can no longer be pressed and under the list it says: „An object can belong to at most 3 groups. Remove it from one to add it to another.”. You find a group's members in „Global Search”, by „Group code”. A deleted group does not take its records with it.

### 7.4.4 Stamps {#links-classify-stamps}

A stamp marks a lasting characteristic, on records of any kind. It is made in „Administration” → „Stamps”, with „Create stamp”: „Short description” and „Notes”, and the code is given on saving. „Apply”, on the stamp's row, opens its screen: choose the kind of records in „Object type”, tick them in „Objects available to stamp”, press „Apply stamp” and then „Save stamps”. The list of stamps shows, for each, how many records carry it.

On the record, the stamp appears in „Tags and groups”, under „Stamps”, where „+ Apply stamp” puts on another and „×” takes it off. A deleted stamp disappears from every record.

## 7.5 Versions and „Make Current” {#links-versions}

Every save of a record keeps a new version and leaves the one before untouched (section [[intro-versions]]). Versions are counted from 0: a record just created shows „v 0” at the top right. „Save” cannot be pressed until you change something, so a new version appears only when something has changed. After the save you stay on the record.

When it has several versions, the top right shows „N versions”, for instance „2 versions”. Pressed, it takes you one version back and shows „Previous version”, „Next version” and „Make Current” (Figure [[fig-links-versions]]). On an old version:

- the fields can only be read, and „Save” is missing;
- the screen's title still shows the current name, not the one in the version you are reading;
- „Previous version” and „Next version” move you one version at a time; that is how you compare two versions, reading the fields of one, then of the other.

„Make Current” makes the version you are reading the current one again, **by copying it into a new version**. The application first asks „Make this version current?” and says what will happen, for instance: „Version 0 will be copied to a new version 3, which becomes the current version. Continue?”. „OK” does it, „Cancel” gives it up. Nothing is lost: the versions in between stay in the history, and the list shows the values of the new current version.

![7.3 A record's versions](links-versions.png){#fig-links-versions}

## 7.6 The same record in two windows {#links-two-windows}

The same record can be open in two windows or tabs of the browser, and one does not silently cover what was saved in the other:

- When you save in one window, the other reloads by itself, if it has nothing unsaved.
- If you have started typing in the other, it is not reloaded over what you typed. Under the „Unsaved changes” band appears, in red: „This object was saved in another window. Your changes here are not saved, and saving them will be refused.”, with „Reload”.
- If you press „Save” there anyway, nothing is written: „Nothing was saved: this object was saved in another window or by another user since you opened it. What you typed is still on screen.”.
- „Reload” asks „Reload the object?”: the unsaved values are lost and the current version is loaded.
- If the record is deleted in one window, the other says „This object was deleted in another window.”.

The version history holds only the saves that went through. The safest way is to change a record in one window only.

## 7.7 Examples and use cases {#links-examples}

### 7.7.1 Link the owner to a plot of land and check from the other end {#links-example-owner}

A plot of land in Bragadiru has an owner who is already in the archive.

1. Open the land and, on „Links”, press „Associate person” (section [[links-associate]]).
2. Type part of the person's name into „Name” and tick their row in „Results”.
3. Choose the owner's role in „Role” and press „Associate Selected”.
4. On „Links”, press „View” on the person's row: on their „Links” tile the land appears, with the role in brackets (section [[links-related]]).

### 7.7.2 Show that the seller inherited the land {#links-example-title}

A sale contract cites the certificate of inheritance the seller's right comes from, and both are in the archive.

1. Open the certificate of inheritance and, on „Links”, press „Associate document”.
2. Search for the contract in „Search” and tick it.
3. In „Link type”, choose „Titlu anterior al” and press „Associate Selected” (section [[links-references]]).
4. Open the contract and press „Relationship” on the certificate's row: the link reads the certificate, „Titlu anterior al”, „this document”.

### 7.7.3 Gather a few plots for a valuation {#links-example-group}

1. In „Administration” → „Groups”, make a group with „Target” „Property” and a description, for instance „Spring valuation” (section [[links-classify-groups]]).
2. On the group's screen, tick the plots, press „Add to Group”, then „Save group”.
3. In „Global Search”, type the group's code into „Group code” and press „Search”: every plot in the group appears (section [[reports-search]]).
4. When the valuation is over, delete the group; the plots stay in the archive.

### 7.7.4 Take a person back to an earlier value {#links-example-version}

You corrected a person's first name and saved, then learned that the old form was the right one.

1. On the person's screen, press „N versions”, at the top right (section [[links-versions]]).
2. With „Previous version” and „Next version”, find the version with the old first name.
3. Press „Make Current” and then „OK”: that version is copied into a new, current one, and the one with the corrected first name stays in the history.
`;
