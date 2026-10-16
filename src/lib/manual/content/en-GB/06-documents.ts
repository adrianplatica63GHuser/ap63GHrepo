/**
 * Manual, en-GB, chapter 6. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 6 Documents {#documents}

A document is a deed held in the archive — a contract, a certificate, a permit, a plan — of a given type, with its scanned pages attached. This chapter shows you the list of documents, how to add a document and its pages, what a document's type and its form mean, how to link people and properties to a document, and what the three documents with a screen of their own look like: the sale contract, the preliminary contract that prepares it, the addendum and the certificate of inheritance.

## 6.1 The list of documents {#documents-list}

In the sidebar, open „Domain”, then „Documents”. The list shows every document in the archive, in the columns „Type” and „Title”. The title is the document's „Short Label”. A document just added appears at the top, badged „New!”. Lists work the same everywhere (section [[start-lists]]).

The bar above the table has two rows:

- on the first, the search box („search by code, title, or document no.”), „Choose fields” and, at its end, „Add new Document”;
- on the second, „Document type:”, a round sign and „Type-specific field:”, with an ⓘ beside it.

**„Type” shows the type's short name** — for example „CVC” for „Contract de Vânzare”, „Intabulare” for „Încheiere de Intabulare”. Rest the mouse on the cell and the bubble shows the full name. The short name is chosen for each type in „Reference Data”, under „Document Types”, in the field „Short name” (section [[admin-reference-data]]). Left empty, the list shortens the name by itself, dropping a leading „Contract de”, „Act de”, „Încheiere de”, „Certificat de”. Two types may not share a short name.

**„Choose fields”** adds up to four columns: „Document No.”, „Date”, „Institution / Notariat”, „Subject”, „Pages”, „Persons”, „Properties”, „Added on”.

**„Document type:”** opens a list of tick boxes, one per type. The button says what you chose: „All types”, the type's name when exactly one is ticked, „2 types shown” when several are, „No type” when none is — the list then asks „Please select at least one document type”. There are many types, so under „All types” there is a search box: type part of the name, even without diacritics („mostenitor” finds „Certificat de Moștenitor”), and only the matching types remain. The search only hides rows; it never changes a tick.

**„Type-specific field:”** filters by one of a type's own fields — for example the sale contract's „Stare plată” (payment status). It works only when exactly one type is ticked under „Document type:”, and that type has a form with fields that have a closed list of values. The sign between the two says whether you can use it: green (a circle with a check) yes, red (a circle with a bar) no; rest the mouse on it and it tells you why. Choose the field, then one of its values — each with the number of documents that have it, for instance „Achitat integral” (paid in full) — and only those documents remain. „All” drops the filter.

## 6.2 A new document and its pages {#documents-add}

Press „Add new Document”. „New Document” opens, with the tile „Document identification”. Choose „Document Type” first (section [[documents-type]]), then fill in the fields and press „Save”. The document opens on its own screen, its title at the head of the screen and its status „Not processed”. Every save makes a new version of the document (section [[links-versions]]).

The pages are shown in the „Pages” tile, purple, to the right of the form — on a narrow screen, below it (Figure [[fig-documents-pages]]). A document with no pages reads „No pages yet”.

![6.1 A document's „Pages” tile](documents-pages.png){#fig-documents-pages}

### 6.2.1 Adding pages {#documents-add-pages}

On a saved document, „+ Add Page” opens the dialog „Add Page”: „Page Number” (already filled in), „Page Name”, „Page Notes” and „Upload”, which picks the file from the computer. „Save” stays disabled until you choose a file. If you leave „Page Name” empty, the page takes the file's name.

A page can be a photograph or a scan, a PDF, or a Word, Excel, OpenOffice or text document. Any other kind of file is refused on the spot, with the explanation „This kind of file cannot be added as a page”.

**Pages can be chosen before the first save, too.** On „New Document”, „+ Add Page” picks one or several files at once. They wait in „Pages”, each with its thumbnail, and you change their order with „Move up” and „Move down”; „Remove page” removes one. On „Save” the document is created and the pages are then uploaded, in that order. If you leave the form with pages chosen, the application asks first, as with any unsaved change.

### 6.2.2 Reading the pages {#documents-add-read}

A click on a page's row shows it in the tile. With two pages or more, their count appears as well. „Expand Pages” opens the pages over the whole window, large enough to read; „Collapse” closes them.

- A PDF is shown as the page alone, without the browser's column of thumbnails.
- A file the browser cannot show (a Word document, for example) says „This file type cannot be previewed in the browser.” and can be downloaded.
- A page whose file is missing from the archive shows a quiet picture, „The page's file is not available”, not an error.

### 6.2.3 Rotating a page and its notes {#documents-add-rotate}

A page scanned the wrong way round is turned with „Turn right”: each press turns it a quarter turn. „Save the turn” keeps the turn, and from then on the page opens that way, in „Expand Pages” too. The file itself is not changed. An unsaved turn is lost when you leave, without a question. Only image pages can be rotated.

On each page's row are „Page notes” (a pen), „Print” and „Delete”. The pen opens the page's notes: write, change or clear „Page Notes” and press „Save”; the row's „Notes” column shows what you saved.

### 6.2.4 Deleting a document {#documents-add-delete}

„Delete”, on the document's button bar, asks „Delete document?”. „Yes” deletes it and takes you back to „Documents”; „No” keeps it. A delete cannot be undone. If the delete fails, the application says why — for example „This document is no longer in the archive — it may have been deleted in the meantime.” — and leaves the document open.

## 6.3 The document's type {#documents-type}

„Document Type” says what kind of document it is, and the type decides which fields the form has, what the issuer, the number and the date are called, and which roles the people linked to the document can have. On „New Document” the field starts empty.

Types that have a form of their own read „(has a form)” after their name in the list — for example „Contract de Vânzare (has a form)”. As soon as you choose such a type, the form grows with its tiles. A type with no form keeps only the document's general fields. For a user with the superuser role, under „Document Type” on a type with no form it reads „This type has no form yet; its form is built in DocTypeEngine.”, and „DocTypeEngine” opens the tool with the type already chosen (section [[tools-doc-type-engine]]).

The tiles shown are chosen with the ticks at the head of the screen, as on any object (section [[start-tiles]]), and the choice is remembered per type: a sale contract and a plan each keep their own arrangement. If you change a document's type, the tiles change with it.

## 6.4 The document's identification and form {#documents-identification}

Every document begins with the tile „Document identification”: „Document Type”, then the document's issuer, number and date. Their names depend on the type:

| The type | The issuer | The number | The date |
|---|---|---|---|
| A type with no names of its own | Issuer | Document No. | Date |
| „Contract de Vânzare” | Notary Office | Authentic Deed No. | Authentication date |
| „Certificat de Moștenitor” | Notary Office | Certificate of Inheritance No. | Issue date |

The general fields sit here too: „Short Label”, the document's title — the one in the list's „Title” column —, „Subject” and „Enhanced Notes”. The boxes you type text into grow by themselves as far as they need.

The type's own fields sit on separate tiles. On a type with few fields, they are on one tile, „Document details”. On the sale contract they are spread over several tiles, each with its panels, named in square brackets, for example „[Preț]” (section [[documents-sale]]).

Many of a type's fields are drop-downs. The blank choice reads „no value”, in italics: it means nothing has been chosen. To clear a chosen value, choose „no value” again.

A document brought into the archive by the import has its form filled in by AI from what it read on the pages, and „Processing status” reads „Imported” or „AI processed”. What has no place in the form remains as a short note in „Enhanced Notes”. The import is described in chapter [[import]] (section [[import-scanning]]).

The document's classification, tags, groups and stamps sit on the tiles „Classification” and „Tags and groups”; they work as on any object (section [[links-classify]]).

## 6.5 Parties, roles and shares {#documents-parties}

The people, properties and documents linked to a document sit on the tile „Links” (section [[links-related]]): natural persons first, then judicial persons, properties and documents, each row on a single line, with the icon of its kind. A person reads „Name (Role)”, a document „Short label (Type)”. On a document's row, „Relationship” shows how the two documents are linked. Under the rows are „Associate person”, „Associate property”, „Associate document” and „Dissociate”, which removes the selected row's link (section [[links-associate]]). „Cited instruments” opens the panel of the deeds the document cites (section [[links-references]]). On a document with a „Parties” tile, the parties stand there (below).

**The „Parties” tile.** The deeds made between parties that hold a share, or that give them ownership, have, besides „Links”, the tile „Parties”, with the same rule on all of them: the sale contract, the addendum, the preliminary contract, the certificate of inheritance, the deed of gift, the partition contract and deed, the will, the deed of adjudication and the title of ownership. A party is a person whose role holds a share on that type of document: a contract's seller and buyer, a preliminary contract's promising seller and promising buyer, the donor and the donee, a certificate's heir, a will's legatee. The documents that only show the owner — the land register extract, the encumbrance certificate, the cadastral deed, the permits — keep their people on „Links”. While „Parties” is ticked, the parties stand there only, grouped under their role's name, each with its „Share”, and „Links” holds the document's other links — the notary, a certificate's deceased — and, above them, a line saying how many parties are in „Parties”, for instance „The document's parties (3) are in the “Parties” tile.”. Press „Parties” in that line to reach the tile. If you untick „Parties”, the parties go back to „Links”. So each link has one place where it is seen and from which it is removed.

**The role** says in what capacity the person appears in the document: „Vânzător” (seller), „Cumpărător” (buyer), „Notar” (notary), „Reprezentant legal / Mandatar” (legal representative / proxy). It is chosen under „Role”, on the screen „Associate Person”, and the roles offered depend on the document's type.

**The share** exists only for roles that hold a share on that type of document — the seller and the buyer, yes; the notary or the designer, no. Such a row has the orange button „Share”. Rest the mouse on it to see the values; press it to change them:

- „Share” — type for example 50, 50%, 63,64 or 1/2;
- „Equivalent area (sqm)”;
- „How the share is held” — „in his/her own name”, „joint marital property”, „co-ownership in shares” or „through a proxy”.

The values are saved when you close the panel, with Esc or with a click outside it. A solid orange „Share” is still empty; an orange outline means it holds values.

Under the rows, the application adds up the shares per role: „Total Cumpărător: 100%”. If the sum is not 100%, it reads for example „The shares for “Cumpărător” add up to 50%, not 100%. The document saves anyway — check what the deed says.”. The archive records what the deed says, even when the shares do not add up.

Which role holds a share is decided in „Reference Data”, under „Person Roles”: in the role, under „Document”, the tick „Holds a share” for each type of document (section [[admin-reference-data]]). If the tick is removed later, the saved shares remain, read-only.

## 6.6 The sale contract {#documents-sale}

The sale contract („Contract de Vânzare”, „CVC” in the list) has the richest form in the archive (Figure [[fig-documents-sale]]). Its tile ticks are, in order: „Document identification”, „Preț și plată”, „Obiectul vânzării”, „Carte funciară”, „Declarații și garanții”, „Taxe și cheltuieli”, „Parties”, „Links”, „Classification”, „Tags and groups” and „Pages”. In „Document identification”, besides „Notary Office”, „Authentic Deed No.” and „Authentication date”, there are „Calitate exemplar” (copy status), „Exemplare emise” (copies issued), „Temei autentificare” (authentication basis) and „Data conținutului” (date of the content).

![6.2 A sale contract](documents-sale.png){#fig-documents-sale}

The form's tiles and their panels:

| The tile | Its panels |
|---|---|
| „Preț și plată” (price and payment) | „[Preț]”, „[Plată]” |
| „Obiectul vânzării” (object of the sale) | „[Descriere]”, „[Scop și predare]”, „[Obiect declarat]” |
| „Carte funciară” (land register) | „[Dosar cadastral]”, „[Situația în cartea funciară]”, „[Excepția de la cadastru]” |
| „Declarații și garanții” (statements and warranties) | „[Declarațiile vânzătorului]”, „[Garanții]”, „[Declarații legale]” |
| „Taxe și cheltuieli” (taxes and costs) | „[Taxe și onorarii]”, „[Cheltuieli]” |

„[Taxe și onorarii]” holds „Timbru judiciar”, „Onorariu notarial”, „Impozit transfer” and „Taxă timbru și publicitate”.

**The „Parties” tile** holds the sellers and the buyers, by the rule in section [[documents-parties]]. The parties are grouped under their role's name — „Vânzător” first, then „Cumpărător” —, each row with its „Share” (section [[documents-parties]]). A contract with no parties reads „No party linked yet. Link the parties with their role and share.”. „Associate person” adds a party: search for the person by „Name” or „Code”, choose „Role”, tick the row and press „Associate Selected”. „Dissociate” removes the selected party. The contract's other people, the notary for instance, sit on „Links”, and the properties sold are linked from there too.

**„Obiectul vânzării”** says what is being sold. „Descrierea obiectului” (description of the object) is composed from the contract's properties, its parties and „Scop vânzare” (purpose of the sale) — for example „2 imobile, 7.400 mp în total” (2 properties, 7,400 m² in all). It fills itself in when you open a contract with the field empty. After you link a new property, press „Recompose” to have it written again, then „Save”.

A contract signed after a preliminary contract is linked to it, and „Temei preț” and „Stare plată” can mention the preliminary contract (section [[documents-antecontract]]).

## 6.7 The preliminary contract {#documents-antecontract}

The preliminary contract — the antecontract, a promise to sell — is the deed by which the seller and the buyer bind themselves to sign the sale contract later. It does not transfer ownership; the sale contract that fulfils it does (section [[documents-sale]]). It usually states the price, the date by which the contract is to be signed, and the advance paid.

In the archive, a preliminary contract is a document of the type „Antecontract”. You add it like any document, with its pages (section [[documents-add]]). Its „Document identification” tile has the general names — „Issuer”, „Document No.” and „Date” — and the general fields „Short Label”, „Subject” and „Enhanced Notes” (section [[documents-identification]]).

**The preliminary contract has no form of its own.** The „Document Type” list shows just „Antecontract”, without „(has a form)”, so the document keeps only the general fields: what it promises is read from its pages, and what you want to find easily — the price, the date — you write in „Subject” or „Enhanced Notes”. The sale contract, by contrast, has the richest form in the archive, with its tiles from „Preț și plată” to „Taxe și cheltuieli”, because it is the deed that transfers ownership. A type's form is built in „DocTypeEngine” from documents of that type; the preliminary contract has none yet, and a superuser can build one there (section [[tools-doc-type-engine]]).

The preliminary contract has the „Parties” tile, as the sale contract does (section [[documents-parties]]): the promising seller and the promising buyer hold a share, so they stand there, under „Promitent vânzător” and „Promitent cumpărător”, each with their „Share”; the notary stands on „Links”. You link them with „Associate person”, from „Parties” or from „Links”, with their role (section [[links-associate]]). The roles are prepared in „Reference Data”, under „Person Roles” (section [[admin-reference-data]]); as long as the type has no role prepared, the association screen says so, and the person is linked without a role and stands on „Links”.

**The link to the contract.** When the sale contract that fulfils the preliminary contract is in the archive too, link them: on the preliminary contract press „Associate document”, tick the contract, choose „Antecontract al” under „Link type” and press „Associate Selected” (section [[links-references-documents]]). „Relationship” then shows on the preliminary contract „this document “Antecontract al”” followed by the contract, and on the contract the preliminary contract, „Antecontract al”, „this document” (Figure [[fig-documents-antecontract]]). A contract brought in by the import that mentions the preliminary contract has it among its „Cited instruments”; if the preliminary contract is in the archive, „Link” makes the same link.

![6.3 The „Links” tile of a preliminary contract, linked to the sale contract that fulfils it](documents-antecontract.png){#fig-documents-antecontract}

On the contract, the preliminary contract shows in the form too: in „[Preț]”, „Temei preț” holds the deed the price rests on — the preliminary contract, for instance, with its number and date —, and in „[Plată]”, „Stare plată” can be „Achitat la antecontract”.

## 6.8 The addendum and the certificate of inheritance {#documents-dependent}

### 6.8.1 The addendum {#documents-dependent-addendum}

An addendum amends another document. It has the tiles „Document identification” (with the notarial names and „Onorariu notarial”), „Actul modificat” (the amended document), „Ce modifică” (what it changes) and „Parties”, which holds, as on the contract, the sellers and the buyers (section [[documents-parties]]).

„Actul modificat” links the addendum to the contract it amends. Save the addendum first, then press „Link the amended deed”, search under „Search for the amended deed” by label or number, and press „Link “…”” on the right document. The tile then shows the linked document, its type and „Open”; „Unlink” undoes the link.

If the amended document is not in the archive, the tile reads „The amended deed is not in the archive — its details, as the addendum gives them:” and offers four fields, „Nr. act părinte” (parent deed number) first. When you link the document, these fields are hidden but not cleared; if you unlink it, they come back with their values. An addendum amends a single document: a second one is refused with „This addendum already amends “…”. Unlink it first.”.

„Ce modifică” holds „Motiv completare” (reason for the addition), „Efect urmărit” (intended effect), „Preț neschimbat” (price unchanged) and the clauses changed.

### 6.8.2 The certificate of inheritance {#documents-dependent-inheritance}

The „Document identification” of a certificate of inheritance holds „Notary Office”, „Certificate of Inheritance No.” and „Issue date”. The deceased and the heirs are added from the „Parties” tile:

1. Press „Associate person”. „Add Party to Certificate” opens.
2. Search for the person by „Name” or „Code” and choose them — here one person is chosen at a time.
3. Choose „Defunct” (deceased) or „Moștenitor” (heir) under „Role” and press „Add Party”.

The certificate follows the contract's rule (section [[documents-parties]]): the heirs hold a share, so they are its parties and stand in „Parties”, under „Moștenitor”, each with their „Share”; the deceased holds none, so he stands on „Links”, with the notary. „Dissociate” removes the selected link. Each person sees the certificate among their own links, with their role.

## 6.9 Examples and use cases {#documents-examples}

### 6.9.1 File a sale contract {#documents-example-sale}

You have a scanned sale contract for a plot of land in Bragadiru.

1. „Documents” → „Add new Document”; under „Document Type” choose „Contract de Vânzare (has a form)” (section [[documents-type]]).
2. With „+ Add Page” choose the scans, put them in order, and fill in „Short Label”, „Notary Office”, „Authentic Deed No.” and „Authentication date” (sections [[documents-add]] and [[documents-identification]]).
3. Press „Save”; rotate the page that was scanned the wrong way round and save the rotation.
4. Tick „Parties” and associate the seller and the buyer with their roles, then type in their shares (section [[documents-parties]]).
5. On „Links”, associate the plot, then in „Obiectul vânzării” press „Recompose” and „Save” (section [[documents-sale]]).

### 6.9.2 Record a preliminary contract and the contract that fulfils it {#documents-example-antecontract}

The seller and the buyer of a plot in Bragadiru first signed a preliminary contract, and a few months later the sale contract.

1. „Documents” → „Add new Document”; under „Document Type” choose „Antecontract”, add the pages, fill in „Short Label”, „Document No.” and „Date” and press „Save” (section [[documents-antecontract]]).
2. On „Parties”, associate the seller with the role „Promitent vânzător” and the buyer with „Promitent cumpărător”, then enter their shares (section [[documents-parties]]).
3. File the sale contract (section [[documents-example-sale]]). If the price was paid under the preliminary contract, choose „Achitat la antecontract” for „Stare plată” in „[Plată]”.
4. Open the preliminary contract, press „Associate document”, tick the contract, choose „Antecontract al” and press „Associate Selected”. On the contract, „Relationship” reads: the preliminary contract, „Antecontract al”, „this document” (section [[links-references-documents]]).

### 6.9.3 Record a certificate of inheritance {#documents-example-inheritance}

A person has died, and two heirs have received a certificate of inheritance.

1. Add a document of the type „Certificat de Moștenitor” and save it (section [[documents-add]]).
2. With „Associate person”, on „Parties”, add the deceased with the role „Defunct”, then each heir with the role „Moștenitor” (section [[documents-dependent-inheritance]]). The deceased appears on „Links”, the heirs in „Parties”.
3. In „Parties”, press „Share” on each heir and type in their share (section [[documents-parties]]).

### 6.9.4 Find the contracts paid in full {#documents-example-filter}

1. On „Documents”, open „Document type:”, untick „All types” and tick only „Contract de Vânzare” (section [[documents-list]]).
2. Under „Type-specific field:” choose „Stare plată”, then „Achitat integral”.
3. To see the contracts' dates too, tick „Date” in „Choose fields”.
`;
