/**
 * Manual, en-GB, chapter 4. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 4 Judicial persons {#companies}

A judicial person is a firm, an institution, a local council or an association — anyone who appears in a document or in a land book without being a natural person. This chapter shows you the list of firms, how to add and edit a firm, and how to link it to its people, to documents and to properties. A firm's screen reads like a natural person's (chapter [[persons]]), with tiles of its own.

## 4.1 The list of judicial persons {#companies-list}

The list opens from the sidebar: „Domeniu”, then „Persoane Juridice”. The screen is called „Persoană juridică” and, like every list (section [[start-lists]]), shows 15 firms a page, with the columns „Denumire” (name) and „Poreclă” (nickname).

The search box at the top of the list („caută după cod, nume, poreclă sau ID”) is the list's only filter. It finds a firm by its name, by its nickname and by its CUI: type the CUI and the firms that have it remain. When nothing is found, the list says „Nu există persoane juridice”.

„Câmpuri afișate” (the columns shown) adds columns to the list. On the list of firms you can choose four:

| Field | What the column shows |
|---|---|
| Tip | The firm's form: SRL, SA, PFA, Instituție and the others. |
| Nr. înregistrare (CUI) | The unique registration code. |
| Nr. registru comerțului | The Trade Register number. |
| Persoană de contact | The name of the firm's contact person. |

The button shows how many fields you chose, for instance „Câmpuri afișate 1/4”. The CUI column does not appear until you tick it, but searching by CUI works regardless. Under „Persoană de contact” you see the firm's first contact person; if the first slot is empty, you see the second (section [[companies-people-contact]]).

Each row carries „Previzualizare” (preview), „Incursiune”, „Legături” (links) and „Deschide” (open). A firm's preview shows its name, followed by the number of its contact persons in brackets — for instance „(2 contacte)” —, then its nickname. „Incursiune” shows the firm's „Interacțiuni” tile beside the list, and „Legături” shows, also beside it, whom the firm is linked to, without opening it.

A firm added recently stands at the top of the list, marked „Nou!” (new).

## 4.2 A firm added and edited {#companies-add}

On the list of firms, press „Adaugă persoană juridică” (add judicial person). The form „Persoană juridică nouă” opens straight away, with no other question. Fill in what you have; the rest can be added at any time, once the firm is saved.

The only required field is „Denumire”. A firm that has only its name is a real record and is completed later. When you press „Salvează” (save), at the bottom, the application takes you back to the list, where the new firm stands at the top, marked „Nou!”. You open it with „Deschide”.

The screen of an open firm carries its name and its version at the top („v 0” for a firm just created), and its tiles below (Figure [[fig-companies-record]]):

| Tile | What it holds | Shown from the start |
|---|---|---|
| Date de înregistrare | Name, CUI, Trade Register | yes |
| Reprezentanți și contact | The firm's phone and e-mail, the contact persons | yes |
| Adrese | The registered office and the correspondence address | yes |
| Legături | The persons, properties and documents linked to the firm | no |
| Clasificare | Importance, relevance, provenance | no |
| Etichete și grupuri | Tags, groups, stamps, „vezi și” | no |
| Interacțiuni | The history of interactions with this firm | yes |

The tiles are chosen with ticks, as on any record (section [[start-tiles]]). The choice made on a firm belongs to firms: it does not change the tiles you see on natural persons. Unlike a property, a firm has no „Persoane” tile: the firm's people are seen in „Reprezentanți și contact” and in „Legături” (section [[companies-people]]).

![4.1 A judicial person's screen](companies-record.png){#fig-companies-record}

### 4.2.1 The „Date de înregistrare” tile {#companies-add-identity}

The first tile holds the firm's details:

- „Denumire” — the firm's name, the only required field.
- „Poreclă” — a short name of your own, by which you find it more easily.
- „Tip” — the firm's form: „Consiliu Local”, „Instituție”, „SRL”, „SA”, „SRL-D”, „PFA”, „II”, „IF”, „ONG” or „Altele”; „—” means none is chosen.
- „Nr. înregistrare (CUI)” — the unique registration code.
- „Nr. registru comerțului” — the Trade Register number.

The firm's system ID, which begins with JPERS, stands in the top right-hand corner of this tile. It is not a field and is not typed by hand.

The application does not check the shape of the CUI: it accepts whatever you type. So check it against the document before you save. Once saved, the rule appears under the CUI: „CUI-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba” (the CUI cannot be changed once set — delete and create again to change it). A wrong CUI is therefore put right by deleting the firm and creating it again.

### 4.2.2 The firm's phone and e-mail {#companies-add-contact}

The „Reprezentanți și contact” tile starts with the firm's own details: „Telefon firmă” (firm phone) and „E-mail firmă” (firm e-mail). They belong to the firm, not to a contact person.

An e-mail that does not have the shape of an address is not saved: under the field appears „Adresa de e-mail nu pare corectă — de exemplu office@firma.ro”, and the firm stays unchanged. Correct the address and press „Salvează” again.

### 4.2.3 The addresses {#companies-add-addresses}

The „Adrese” tile holds „Adresă sediu social” (registered office) and „Adresă corespondență” (correspondence address). When the firm receives its post at its office, tick „Aceeași cu adresa sediului social” (same as the registered office) and do not type the address a second time.

### 4.2.4 Editing and the history {#companies-add-edit}

On the firm's screen, change what you need and press „Salvează”, at the bottom. This time the screen stays on the firm. Every save makes a new version: the top of the screen goes from „v 0” to „v 1” and shows how many versions the firm has, for instance „2 versiuni”.

With „Versiunea anterioară” (previous version) and „Versiunea următoare” (next version) you see the firm as it was at each save. The firm's phone and e-mail are kept in the history too: on the version in which they were written, their fields are framed in green, the mark of a value added then. On versions and „Fă curentă”, see section [[links-versions]].

A few things worth knowing:

- A change made in a tile that you then hide is still saved.
- If a hidden tile holds a mistake — „Denumire” emptied, say —, at „Salvează” the tile comes back, the screen scrolls to the field with the problem, and nothing is saved.
- While you have unsaved changes, the top says „Modificări nesalvate” (unsaved changes).

### 4.2.5 Deleting a firm {#companies-add-delete}

Press „Șterge” (delete), at the bottom of the firm's screen, and answer „Da” (yes) to the question „Ștergeți persoana juridică?”. A deletion cannot be undone.

A firm opened from another record — from a document or from a property — is not deleted from there. The application tells you to dissociate it first from the record you opened it from, then to open it from the sidebar and delete it there.

## 4.3 A firm's people {#companies-people}

A firm has people in two ways. The contact persons are the people you keep in touch with; they stand in the „Reprezentanți și contact” tile. The representatives — the director, an agent — are linked to the firm with a role, in the „Legături” tile, and are seen from both ends.

### 4.3.1 The contact persons {#companies-people-contact}

In the „Reprezentanți și contact” tile, under the firm's phone and e-mail, stand „Persoană de contact 1” and „Persoană de contact 2” (contact person 1 and 2). A contact person is not typed by hand: it is chosen from the natural persons already in the archive. The screen reminds you: „Dacă persoana nu este în sistem, trebuie introdusă mai întâi prin funcționalitatea Persoană Fizică.” (if the person is not in the system, they must first be entered as a natural person). So add the person in „Persoane Fizice” first (chapter [[persons]]), then choose them here.

The contact person is also seen in the list of firms, in the „Persoană de contact” column (section [[companies-list]]).

### 4.3.2 The representatives, read from both ends {#companies-people-representatives}

A representative is linked from the firm's screen:

1. Tick the „Legături” tile. A firm with no links shows „Nimic corelat încă.” (nothing related yet), with the buttons „Asociază persoană”, „Asociază proprietate”, „Asociază act” and „Dezasociază”.
2. Press „Asociază persoană” (associate person). „Asociere persoană corelată” opens, with the firm's name under the title.
3. Search for the person by „Nume” (name) and tick their row.
4. Under „Rol” (role), choose „Reprezentant legal / Mandatar” (legal representative / agent). Beside it, it says that the role is the one the ticked person has towards the firm.
5. Press „Asociază selecția” (associate the selection).

Back on the firm, „Legături” shows the person on one row, with their role in brackets: „Surname First name (Reprezentant legal / Mandatar)”.

The same link reads from the other end as well. On the person's screen, in their own „Legături” tile, the firm appears with the role turned round: „Firm's name (Reprezentat(ă) / Mandant(ă))” — the person represents the firm, so the firm is the one represented. „Vizualizare” (view), on each row, opens the other end, read-only.

A wrong link is taken out by selecting its row in „Legături” and pressing „Dezasociază” (dissociate). The „Legături” tile is described in full in section [[links-related]].

### 4.3.3 The firm on a document and on a property {#companies-people-records}

A firm can be a party to a document or the owner of a piece of land, just as a natural person can. The link is made from the firm's screen, again from „Legături”, or from the other end.

- „Asociază act” opens „Asociere act”. Tick the document, then choose „Rol”: once you have ticked the document, the list of roles narrows to those that type of document has. On a „Contract de Vânzare” (sale contract), for instance: „Cumpărător”, „Moștenitor”, „Notar”, „Reprezentant legal / Mandatar”, „Vânzător”. On the document, the firm then appears in the „Părți” (parties) tile, with its role. On parties, roles and the share, see sections [[documents-parties]] and [[documents-sale]].
- „Asociază proprietate” opens „Asociere proprietate”. Tick the property and choose „Rol”: „Coproprietari / Coindivizari”, „Cumpărător”, „Proprietar” or „Titular de drept”. On the property, the firm appears in „Legături”, for instance „Firm's name (Proprietar)”.

From the document or the property, „Vizualizare” on the firm's row opens the firm's screen — not a natural person's —, read-only, with „Înapoi la listă” (back to the list) and „Modifică” (edit) at the bottom. Associating records in general is in chapter [[links]].

### 4.3.4 The firm's interactions {#companies-people-interactions}

The „Interacțiuni” tile stands on the right of the screen, apart from the other tiles, and is ticked from the start. It shows the history of interactions with the firm. Unticked, the tile goes; ticked again, it comes back. For how an interaction is recorded, see section [[persons-interactions]]; all interactions, in one place, are in the „Interacțiuni” report (section [[reports-interactions]]).

## 4.4 Examples and use cases {#companies-examples}

### 4.4.1 Add a new firm, with its contact person {#companies-example-new}

The situation: a firm sends you an offer for a piece of land, and the person you are talking to is not in the archive yet.

1. First add the person in „Persoane Fizice” (chapter [[persons]]).
2. On „Persoane Juridice”, press „Adaugă persoană juridică”, type „Denumire”, choose „Tip” and type the CUI, checked against the document (section [[companies-add-identity]]).
3. Press „Salvează”; open the firm from the top of the list, where it is marked „Nou!”.
4. In „Reprezentanți și contact”, type „Telefon firmă” and „E-mail firmă” and choose the person as „Persoană de contact 1” (sections [[companies-add-contact]] and [[companies-people-contact]]).
5. Press „Salvează”.

### 4.4.2 Find a firm by its CUI {#companies-example-cui}

The situation: a document gives only a firm's CUI.

1. Open „Persoane Juridice”.
2. Type the CUI into the search box (section [[companies-list]]).
3. To see the CUI in the table as well, tick „Nr. înregistrare (CUI)” in „Câmpuri afișate”.
4. Press „Deschide” on the firm's row.

### 4.4.3 Record a firm's director {#companies-example-representative}

The situation: a person signs on behalf of a firm and you want the link to show from both sides.

1. Open the firm and tick the „Legături” tile.
2. Press „Asociază persoană”, search for the person, tick them and choose „Reprezentant legal / Mandatar” (section [[companies-people-representatives]]).
3. Press „Asociază selecția”.
4. Press „Vizualizare” on the person's row: in their „Legături” tile, the firm appears as „Reprezentat(ă) / Mandant(ă)”.

### 4.4.4 Record a firm as the owner of a piece of land in Bragadiru {#companies-example-owner}

The situation: a firm has bought a piece of land in Bragadiru through a sale contract.

1. Open the firm and tick the „Legături” tile.
2. Press „Asociază proprietate”, search for the land, tick it and choose „Rol” „Proprietar” (section [[companies-people-records]]).
3. Press „Asociază selecția”.
4. Press „Asociază act”, tick the contract and choose „Cumpărător”; then „Asociază selecția”.
5. On the land, in „Legături”, and on the contract, in „Părți”, the firm now appears with its role (chapters [[documents]] and [[links]]).
`;
