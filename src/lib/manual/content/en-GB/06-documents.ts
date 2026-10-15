/**
 * Manual, en-GB, chapter 6. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 6 Documents {#documents}

A document is a deed held in the archive — a contract, a certificate, a permit, a plan — of a given type, with its scanned pages attached. This chapter shows you the list of documents, how to add a document and its pages, what a document's type and its form mean, how to link people and properties to a document, and what the three documents with a screen of their own look like: the sale contract, the addendum and the certificate of inheritance.

## 6.1 The list of documents {#documents-list}

In the sidebar, open „Domeniu”, then „Acte” (Documents). The list shows every document in the archive, in the columns „Tip” (type) and „Titlu” (title). The title is the document's „Etichetă scurtă” (short label). A document just added appears at the top, badged „Nou!”. Lists work the same everywhere (section [[start-lists]]).

The bar above the table has two rows:

- on the first, the search box („caută după cod, titlu sau nr. document” — search by code, title or document number), „Câmpuri afișate” and, at its end, „Adaugă act” (add document);
- on the second, „Tip document:” (document type), a round sign and „Câmp specific:” (specific field), with an ⓘ beside it.

**„Tip” shows the type's short name** — for example „CVC” for „Contract de Vânzare”, „Intabulare” for „Încheiere de Intabulare”. Rest the mouse on the cell and the bubble shows the full name. The short name is chosen for each type in „Date de referință”, under „Tipuri de Document”, in the field „Denumire scurtă” (short name) (section [[admin-reference-data]]). Left empty, the list shortens the name by itself, dropping a leading „Contract de”, „Act de”, „Încheiere de”, „Certificat de”. Two types may not share a short name.

**„Câmpuri afișate”** (the columns shown) adds up to four columns: „Nr. document”, „Data”, „Instituție / Notariat”, „Subiect”, „Nr. pagini”, „Persoane”, „Proprietăți”, „Adăugat la”.

**„Tip document:”** opens a list of tick boxes, one per type. The button says what you chose: „Toate tipurile” (all types), the type's name when exactly one is ticked, „2 tipuri afișate” when several are, „Niciun tip” when none is — the list then asks „Selectați cel puțin un tip de document” (select at least one document type). There are many types, so under „Toate tipurile” there is a search box: type part of the name, even without diacritics („mostenitor” finds „Certificat de Moștenitor”), and only the matching types remain. The search only hides rows; it never changes a tick.

**„Câmp specific:”** filters by one of a type's own fields — for example the sale contract's „Stare plată” (payment status). It works only when exactly one type is ticked under „Tip document:”, and that type has a form with fields that have a closed list of values. The sign between the two says whether you can use it: green (a circle with a check) yes, red (a circle with a bar) no; rest the mouse on it and it tells you why. Choose the field, then one of its values — each with the number of documents that have it, for instance „Achitat integral” (paid in full) — and only those documents remain. „Toate” drops the filter.

## 6.2 A new document and its pages {#documents-add}

Press „Adaugă act”. „Act nou” (new document) opens, with the tile „Identificarea actului”. Choose „Tip document” first (section [[documents-type]]), then fill in the fields and press „Salvează” (save). The document opens on its own screen, its title at the head of the screen and its status „Neprocesat” (not processed). Every save makes a new version of the document (section [[links-versions]]).

The pages are shown in the „Pagini” (pages) tile, purple, to the right of the form — on a narrow screen, below it (Figure [[fig-documents-pages]]). A document with no pages reads „Nicio pagină adăugată”.

![6.1 A document's „Pagini” tile](documents-pages.png){#fig-documents-pages}

### 6.2.1 Adding pages {#documents-add-pages}

On a saved document, „+ Adaugă pagină” opens the dialog „Adaugă pagină” (add page): „Număr pagină” (page number, already filled in), „Denumire pagină” (page name), „Note pagină” (page notes) and „Încarcă” (upload), which picks the file from the computer. „Salvează” stays disabled until you choose a file. If you leave „Denumire pagină” empty, the page takes the file's name.

A page can be a photograph or a scan, a PDF, or a Word, Excel, OpenOffice or text document. Any other kind of file is refused on the spot, with the explanation „Acest tip de fișier nu poate fi adăugat ca pagină” (this type of file cannot be added as a page).

**Pages can be chosen before the first save, too.** On „Act nou”, „+ Adaugă pagină” picks one or several files at once. They wait in „Pagini”, each with its thumbnail, and you change their order with „Mută mai sus” and „Mută mai jos” (move up, move down); „Elimină pagina” removes one. On „Salvează” the document is created and the pages are then uploaded, in that order. If you leave the form with pages chosen, the application asks first, as with any unsaved change.

### 6.2.2 Reading the pages {#documents-add-read}

A click on a page's row shows it in the tile. With two pages or more, their count appears as well. „Pagini extinse” (expanded pages) opens the pages over the whole window, large enough to read; „✕ Restrânge” (collapse) closes them.

- A PDF is shown as the page alone, without the browser's column of thumbnails.
- A file the browser cannot show (a Word document, for example) says „Acest tip de fișier nu poate fi previzualizat în browser.” (this type of file cannot be previewed in the browser) and can be downloaded.
- A page whose file is missing from the archive shows a quiet picture, „Fișierul paginii nu este disponibil” (the page's file is not available), not an error.

### 6.2.3 Rotating a page and its notes {#documents-add-rotate}

A page scanned the wrong way round is turned with „Rotește la dreapta” (rotate right): each press turns it a quarter turn. „Salvează rotirea” (save rotation) keeps the turn, and from then on the page opens that way, in „Pagini extinse” too. The file itself is not changed. An unsaved turn is lost when you leave, without a question. Only image pages can be rotated.

On each page's row are „Notițe pagină” (page notes, a pen), „Tipărire” (print) and „Șterge” (delete). The pen opens the page's notes: write, change or clear „Note pagină” and press „Salvează”; the row's „Note” column shows what you saved.

### 6.2.4 Deleting a document {#documents-add-delete}

„Șterge”, on the document's button bar, asks „Ștergeți actul?” (delete the document?). „Da” (yes) deletes it and takes you back to „Acte”; „Nu” (no) keeps it. A delete cannot be undone. If the delete fails, the application says why — for example „Actul nu mai există în arhivă — poate a fost șters între timp.” (the document is no longer in the archive — it may have been deleted meanwhile) — and leaves the document open.

## 6.3 The document's type {#documents-type}

„Tip document” says what kind of document it is, and the type decides which fields the form has, what the issuer, the number and the date are called, and which roles the people linked to the document can have. On „Act nou” the field starts empty.

Types that have a form of their own read „(are formular)” (has a form) after their name in the list — for example „Contract de Vânzare (are formular)”. As soon as you choose such a type, the form grows with its tiles. A type with no form keeps only the document's general fields. For a user with the superuser role, under „Tip document” on a type with no form it reads „Acest tip nu are încă formular; formularul se construiește în Distilare Tipizate.” (this type has no form yet; the form is built in Distilare Tipizate), and „Distilare Tipizate” opens the tool with the type already chosen (section [[tools-doc-type-engine]]).

The tiles shown are chosen with the ticks at the head of the screen, as on any record (section [[start-tiles]]), and the choice is remembered per type: a sale contract and a plan each keep their own arrangement. If you change a document's type, the tiles change with it.

## 6.4 The document's identification and form {#documents-identification}

Every document begins with the tile „Identificarea actului” (the document's identification): „Tip document”, then the document's issuer, number and date. Their names depend on the type:

| The type | The issuer | The number | The date |
|---|---|---|---|
| A type with no names of its own | Emitent | Nr. document | Data |
| Contract de Vânzare | Notariat | Nr. act autentic | Data autentificării |
| Certificat de Moștenitor | Notariat | Nr. certificat de moștenitor | Data eliberării |

The general fields sit here too: „Etichetă scurtă”, the document's title — the one in the list's „Titlu” column —, „Subiect” (subject) and „Note extinse” (extended notes). The boxes you type text into grow by themselves as far as they need.

The type's own fields sit on separate tiles. On a type with few fields, they are on one tile, „Detalii act” (document details). On the sale contract they are spread over several tiles, each with its panels, named in square brackets, for example „[Preț]” (section [[documents-sale]]).

Many of a type's fields are drop-downs. The blank choice reads „fără valoare” (no value), in italics: it means nothing has been chosen. To clear a chosen value, choose „fără valoare” again.

A document brought into the archive by the import has its form filled in by AI from what it read on the pages, and „Stare procesare” (processing status) reads „Importat” or „Procesat cu AI”. What has no place in the form remains as a short note in „Note extinse”. The import is described in chapter [[import]] (section [[import-scanning]]).

The document's classification, tags, groups and stamps sit on the tiles „Clasificare” and „Etichete și grupuri”; they work as on any record (section [[links-classify]]).

## 6.5 Parties, roles and shares {#documents-parties}

The people, properties and documents linked to a document sit on the tile „Legături” (links) (section [[links-related]]): natural persons first, then judicial persons, properties and documents, each row on a single line, with the icon of its kind. A person reads „Name (Role)”, a document „Short label (Type)”. On a document's row, „Relația” (the relationship) shows how the two documents are linked. Under the rows are „Asociază persoană”, „Asociază proprietate”, „Asociază act” (associate a person, a property, a document) and „Dezasociază” (dissociate), which removes the selected row's link (section [[links-associate]]). „Înscrisuri citate” opens the panel of the deeds the document cites (section [[links-references]]).

**The role** says in what capacity the person appears in the document: „Vânzător” (seller), „Cumpărător” (buyer), „Notar” (notary), „Reprezentant legal / Mandatar” (legal representative / proxy). It is chosen under „Rol”, on the screen „Asociere persoană”, and the roles offered depend on the document's type.

**The share** exists only for roles that hold a share on that type of document — the seller and the buyer, yes; the notary or the designer, no. Such a row has the orange button „Cotă” (share). Rest the mouse on it to see the values; press it to change them:

- „Cotă-parte” (share) — type for example 50, 50%, 63,64 or 1/2;
- „Suprafață echivalentă (mp)” (equivalent area, m²);
- „Mod de deținere” (manner of holding) — „în nume propriu” (in one's own name), „devălmășie” (joint ownership), „indiviziune” (undivided co-ownership) or „prin mandatar” (through a proxy).

The values are saved when you close the panel, with Esc or with a click outside it. A solid orange „Cotă” is still empty; an orange outline means it holds values.

Under the rows, the application adds up the shares per role: „Total Cumpărător: 100%”. If the sum is not 100%, it reads for example „Cotele pentru „Cumpărător” însumează 50%, nu 100%. Actul se salvează oricum — verificați ce scrie în act.” (the shares for the buyer add up to 50%, not 100%; the document is saved anyway — check what the deed says). The archive records what the deed says, even when the shares do not add up.

Which role holds a share is decided in „Date de referință”, under „Roluri Persoane”: in the role, under „Act”, the tick „Deține cotă” (holds a share) for each type of document (section [[admin-reference-data]]). If the tick is removed later, the saved shares remain, read-only.

## 6.6 The sale contract {#documents-sale}

The sale contract („Contract de Vânzare”, „CVC” in the list) has the richest form in the archive (Figure [[fig-documents-sale]]). Its tile ticks are, in order: „Identificarea actului”, „Preț și plată”, „Obiectul vânzării”, „Carte funciară”, „Declarații și garanții”, „Taxe și cheltuieli”, „Părți”, „Legături”, „Clasificare”, „Etichete și grupuri” and „Pagini”. In „Identificarea actului”, besides „Notariat”, „Nr. act autentic” and „Data autentificării”, there are „Calitate exemplar” (copy status), „Exemplare emise” (copies issued), „Temei autentificare” (authentication basis) and „Data conținutului” (date of the content).

![6.2 A sale contract](documents-sale.png){#fig-documents-sale}

The form's tiles and their panels:

| The tile | Its panels |
|---|---|
| Preț și plată (price and payment) | [Preț], [Plată] |
| Obiectul vânzării (object of the sale) | [Descriere], [Scop și predare], [Obiect declarat] |
| Carte funciară (land register) | [Dosar cadastral], [Situația în cartea funciară], [Excepția de la cadastru] |
| Declarații și garanții (statements and warranties) | [Declarațiile vânzătorului], [Garanții], [Declarații legale] |
| Taxe și cheltuieli (taxes and costs) | [Taxe și onorarii], [Cheltuieli] |

„[Taxe și onorarii]” holds „Timbru judiciar”, „Onorariu notarial”, „Impozit transfer” and „Taxă timbru și publicitate”.

**The „Părți” tile** (parties) holds the sellers and the buyers; it is not shown at first, so tick it. The parties are grouped under their role's name — „Vânzător” first, then „Cumpărător” —, each row with its „Cotă” (section [[documents-parties]]). A contract with no parties reads „Nicio parte asociată încă. Asociați vânzătorii și cumpărătorii cu rolul și cota lor.” (no party associated yet; associate the sellers and buyers with their role and share). „Asociază persoană” adds a party: search for the person by „Nume” (name) or „Cod” (code), choose „Rol”, tick the row and press „Asociază selecția” (associate the selection). „Dezasociază” removes the selected party. The contract's other people, the notary for instance, sit on „Legături”, and the properties sold are linked from there too.

**„Obiectul vânzării”** says what is being sold. „Descrierea obiectului” (description of the object) is composed from the contract's properties, its parties and „Scop vânzare” (purpose of the sale) — for example „2 imobile, 7.400 mp în total” (2 properties, 7,400 m² in all). It fills itself in when you open a contract with the field empty. After you link a new property, press „Recompune” (recompose) to have it written again, then „Salvează”.

## 6.7 The addendum and the certificate of inheritance {#documents-dependent}

### 6.7.1 The addendum {#documents-dependent-addendum}

An addendum amends another document. It has the tiles „Identificarea actului” (with the notarial names and „Onorariu notarial”), „Actul modificat” (the amended document), „Ce modifică” (what it changes) and „Părți”.

„Actul modificat” links the addendum to the contract it amends. Save the addendum first, then press „Leagă actul modificat” (link the amended document), search under „Caută actul modificat” by label or number, and press „Leagă” (link) on the right document. The tile then shows the linked document, its type and „Deschide” (open); „Dezleagă” (unlink) undoes the link.

If the amended document is not in the archive, the tile reads „Actul modificat nu e în arhivă — datele lui, așa cum le dă actul adițional:” (the amended document is not in the archive — its details as the addendum gives them) and offers four fields, „Nr. act părinte” (parent deed number) first. When you link the document, these fields are hidden but not cleared; if you unlink it, they come back with their values. An addendum amends a single document: a second one is refused with „Acest act adițional modifică deja „…”. Dezlegați-l întâi.” (this addendum already amends „…”; unlink it first).

„Ce modifică” holds „Motiv completare” (reason for the addition), „Efect urmărit” (intended effect), „Preț neschimbat” (price unchanged) and the clauses changed.

### 6.7.2 The certificate of inheritance {#documents-dependent-inheritance}

The „Identificarea actului” of a certificate of inheritance holds „Notariat”, „Nr. certificat de moștenitor” and „Data eliberării”. The deceased and the heirs are the certificate's parties, in „Părți”:

1. Press „+ Adaugă parte” (add party). „Adaugă parte la certificat” opens.
2. Search for the person by „Nume” or „Cod” and choose them — here one person is chosen at a time.
3. Choose „Defunct” (deceased) or „Moștenitor” (heir) under „Rol” and press „Adaugă parte”.

„Părți” shows a table of „Nume” and „Rol”; „Elimină” (remove) takes a party out. On „Legături” the heirs have „Cotă” and the deceased does not. Each person sees the certificate among their own links, with their role.

## 6.8 Examples and use cases {#documents-examples}

### 6.8.1 File a sale contract {#documents-example-sale}

You have a scanned sale contract for a plot of land in Bragadiru.

1. „Acte” → „Adaugă act”; under „Tip document” choose „Contract de Vânzare (are formular)” (section [[documents-type]]).
2. With „+ Adaugă pagină” choose the scans, put them in order, and fill in „Etichetă scurtă”, „Notariat”, „Nr. act autentic” and „Data autentificării” (sections [[documents-add]] and [[documents-identification]]).
3. Press „Salvează”; rotate the page that was scanned the wrong way round and save the rotation.
4. Tick „Părți” and associate the seller and the buyer with their roles, then type in their shares (section [[documents-parties]]).
5. On „Legături”, associate the plot, then in „Obiectul vânzării” press „Recompune” and „Salvează” (section [[documents-sale]]).

### 6.8.2 Record a certificate of inheritance {#documents-example-inheritance}

A person has died, and two heirs have received a certificate of inheritance.

1. Add a document of the type „Certificat de Moștenitor” and save it (section [[documents-add]]).
2. In „Părți”, add the deceased with the role „Defunct”, then each heir with the role „Moștenitor” (section [[documents-dependent-inheritance]]).
3. On „Legături”, press „Cotă” on each heir and type in their share (section [[documents-parties]]).

### 6.8.3 Find the contracts paid in full {#documents-example-filter}

1. On „Acte”, open „Tip document:”, untick „Toate tipurile” and tick only „Contract de Vânzare” (section [[documents-list]]).
2. Under „Câmp specific:” choose „Stare plată”, then „Achitat integral”.
3. To see the contracts' dates too, tick „Data” in „Câmpuri afișate”.
`;
