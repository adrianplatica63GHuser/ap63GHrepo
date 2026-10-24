/**
 * Manual, en-GB, chapter 4. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 4 Juridical persons {#companies}

A juridical person is a firm, an institution, a local council or an association — anyone who appears in a document or in a land book without being a natural person. This chapter shows you the list of firms, how to add and edit a firm, and how to link it to its people, to documents and to properties. A firm's screen reads like a natural person's (chapter [[persons]]), with tiles of its own.

## 4.1 The list of juridical persons {#companies-list}

The list opens from the sidebar: „Domain”, then „Juridical Persons”. The screen is called „Juridical Persons” and, like every list (section [[start-lists]]), shows 15 firms a page, with the columns „Name” and „Nickname”.

The search box at the top of the list („search by ID, Name, Nickname, Registration No. (CUI), Firm's phone or Firm's e-mail”) finds a firm by its ID, name, nickname, CUI, phone and e-mail: type the CUI and the firms that have it remain. Rest the mouse on the box to read its whole text. When nothing is found, the list says „No juridical persons found”.

„Choose fields” adds columns to the list. On the list of firms you can choose four of five; in the table's header the columns carry the short names of the first column below, and the mouse rested on a name shows the whole one:

| Column | Field | What the column shows |
|---|---|---|
| Type | Type | The firm's form: „SRL”, „SA”, „PFA”, „Instituție” and the others. |
| CUI | Registration No. (CUI) | The unique registration code. |
| Trade Reg# | Trade Register No. | The Trade Register number. |
| Contact | Contact person | The name of the firm's contact person. |
| Locality | Locality | The locality of the head office's address. |

The button shows how many fields you chose, for instance „Choose fields 1/4”. The CUI column does not appear until you tick it, but searching by CUI works regardless. Under „Contact” you see the firm's first contact person; if the first slot is empty, you see the second (section [[companies-people-contact]]).

Each row carries „Preview”, „Peek inside”, „Links” and „Open”. A firm's preview shows its name, then its nickname. „Peek inside” shows the firm's „Interactions” tile beside the list, and „Links” shows, also beside it, whom the firm is linked to, without opening it.

A firm added recently stands at the top of the list, marked „New!”.

### 4.1.1 The list's filters {#companies-list-filters}

The list is filtered like the list of properties: from the funnel in the corner of a column's name, with a label for each filter and „Clear filters” (section [[properties-list-filters]]). Beside each value is how many firms hold it, counted with the other filters already set.

On the list of firms two columns filter, both with ticks:

- **„Type”** — the values of the list of juridical-person types, as they stand in the archive now;
- **„Locality”** — the locality of the head office's address.

„CUI”, „Trade Reg#” and „Contact” have no funnel; a firm is found by its CUI with the search box.

## 4.2 A firm added and edited {#companies-add}

On the list of firms, press „New” — with a + before it and a building after it; under the mouse it shows its whole name, „Add new Juridical Person”. The form „New Juridical Person” opens straight away, with no other question. Fill in what you have; the rest can be added at any time, once the firm is saved.

The only required field is „Name”. A firm that has only its name is a real object and is completed later. When you press „Save”, at the bottom, the application takes you back to the list, where the new firm stands at the top, marked „New!”. You open it with „Open”.

The screen of an open firm carries its name and its version at the top („v 0” for a firm just created), and its tiles below (Figure [[fig-companies-record]]):

| Tile | What it holds | Shown from the start |
|---|---|---|
| Registration details | Name, CUI, Trade Register | yes |
| Representatives and contact | The firm's phone and e-mail, the contact persons | yes |
| Addresses | The registered office and the correspondence address | yes |
| Links | The persons, properties and documents linked to the firm | no |
| Classification | Importance, relevance, provenance | no |
| Tags and groups | Tags, groups, stamps, „See Also” | no |
| Interactions | The history of interactions with this firm | yes |

The tiles are chosen with ticks, as on any object (section [[start-tiles]]). The choice made on a firm belongs to firms: it does not change the tiles you see on natural persons. Unlike a property, a firm has no „Persons” tile: the firm's people are seen in „Representatives and contact” and in „Links” (section [[companies-people]]).

![4.1 A juridical person's screen](companies-record.png){#fig-companies-record}

### 4.2.1 The „Registration details” tile {#companies-add-identity}

The first tile holds the firm's details:

- „Name” — the firm's name, the only required field.
- „Nickname” — a short name of your own, by which you find it more easily.
- „Type” — the firm's form: „Consiliu Local”, „Instituție”, „SRL”, „SA”, „SRL-D”, „PFA”, „II”, „IF”, „ONG”, one of the seven public-body types (section [[companies-add-public-bodies]]) or „Altele”; „—” means none is chosen.
- „Registration No. (CUI)” — the unique registration code.
- „Trade Register No.” — the Trade Register number.

The firm's system ID, which begins with JPERS, stands in the top right-hand corner of this tile. It is not a field and is not typed by hand.

The application does not check the shape of the CUI: it accepts whatever you type. So check it against the document before you save. Once saved, the rule appears under the CUI: „CUI cannot be changed once set — delete and recreate to change”. A wrong CUI is therefore put right by deleting the firm and creating it again.

### 4.2.2 The firm's phone and e-mail {#companies-add-contact}

The „Representatives and contact” tile starts with the firm's own details: „Firm's phone” and „Firm's e-mail”. They belong to the firm, not to a contact person.

An e-mail that does not have the shape of an address is not saved: under the field appears „That does not look like an e-mail address — for example office@firm.ro”, and the firm stays unchanged. Correct the address and press „Save” again.

### 4.2.3 The addresses {#companies-add-addresses}

The „Addresses” tile holds „Registered Address” and „Correspondence Address”. When the firm receives its post at its office, tick „Same as registered address” and do not type the address a second time.

### 4.2.4 Editing and the history {#companies-add-edit}

On the firm's screen, change what you need and press „Save”, at the bottom. This time the screen stays on the firm. Every save makes a new version: the top of the screen goes from „v 0” to „v 1” and shows how many versions the firm has, for instance „2 versions”.

With „Previous version” and „Next version” you see the firm as it was at each save. The firm's phone and e-mail are kept in the history too: on the version in which they were written, their fields are framed in green, the mark of a value added then. On versions and „Make Current”, see section [[links-versions]].

A few things worth knowing:

- A change made in a tile that you then hide is still saved.
- If a hidden tile holds a mistake — „Name” emptied, say —, at „Save” the tile comes back, the screen scrolls to the field with the problem, and nothing is saved.
- While you have unsaved changes, the top says „Unsaved changes”.

### 4.2.5 Deleting a firm {#companies-add-delete}

Press „Delete”, at the bottom of the firm's screen, and answer „Yes” to the question „Delete juridical person?”. A deletion cannot be undone.

A firm opened from another object — from a document or from a property — is not deleted from there. The application tells you to dissociate it first from the object you opened it from, then to open it from the sidebar and delete it there.

### 4.2.6 „Fill in from ANAF” {#companies-add-anaf}

Under the CUI and „Trade Register No.” stands „Fill in from ANAF”. Type the CUI — with or without RO in front — and press it: the app asks ANAF's public register and shows, in a window, what it would change. Without a CUI the button is grey and says „Type the CUI first.”.

The window has a row for each field ANAF knows: „Name”, „Trade Register No.”, „Firm's phone”, „Type” (proposed from the legal form — a limited liability company becomes SRL) and the head office address, with its locality, county and postcode. Each row shows what the firm holds now and what ANAF says, with a tick under „Take”:

- an empty field is ticked — it is filled in;
- a field that holds something else is not ticked; tick it only if you want ANAF's value;
- a field ANAF does not know does not appear, so nothing is emptied.

„Take the ticked” puts the ticked values on the form. Nothing is saved until you press „Save”: check the fields first. „Cancel” closes the window with no change.

A firm that is inactive for tax shows a warning in the window, and „Notes” gets a line with the date of the check and the date it became inactive. A firm that has been struck off has its own warning. If ANAF does not know the CUI, the window says so; if ANAF is not answering, it says „ANAF is not answering right now. Try again in a few minutes.”.

Public bodies are in ANAF's register too, by their tax code; the button works for them the same way once the code is typed in the CUI box.

### 4.2.7 Institutions are juridical persons {#companies-add-public-bodies}

The bodies that issue documents — a notary's office, a court, a town hall, the cadastre office, ANAF — are juridical persons too, under one of seven public-body types:

| Type | For instance |
|---|---|
| „Autoritate publică centrală” | ANAF, the national cadastre agency, a ministry |
| „Instituție publică teritorială” | the county cadastre office, the county tax office, the Prefect's office |
| „Autoritate locală” | a town hall, a local council, the county council |
| „Instanță” | a court of first instance, a tribunal, a court of appeal |
| „Birou notarial” | a notary's office, or a professional company of notaries |
| „Birou de executor judecătoresc” | a bailiff's office |
| „Cabinet sau societate de avocatură” | a lawyer's practice, or a law firm |

In „Type” they stand after the company forms, with „Altele” last. Each has a tax code in ANAF's register, so „Fill in from ANAF” fills them in like any firm (section [[companies-add-anaf]]).

A document's issuer — the field of its form whose label changes with its type — is chosen among them: its list holds the juridical persons of a public-body type, and its search finds any juridical person (section [[documents-identification]]). Which types count as public bodies is a tick in Reference Data (section [[admin-reference-data-public-bodies]]).

The archive's former list of institutions became juridical persons of these types, each with a JPERS code. Those that named no particular body — the generic notary's office, court or town hall — carry the note „generic — de înlocuit cu instituția exactă” (generic — to be replaced with the exact institution). Open one, put the exact body's name and CUI in place of the generic ones, and save: every document it issued then names the exact body.

## 4.3 A firm's people {#companies-people}

A firm has people in two ways. The contact persons are the people you keep in touch with; they stand in the „Representatives and contact” tile. The representatives — the director, an agent — are linked to the firm with a role, in the „Links” tile, and are seen from both ends.

### 4.3.1 The contact persons {#companies-people-contact}

In the „Representatives and contact” tile, under the firm's phone and e-mail, stand „Contact Person 1” and „Contact Person 2”. A contact person is not typed by hand: it is chosen from the natural persons already in the archive. The screen reminds you: „If the person is not in the system, they must be entered first using the Natural Person functionality.” So add the person in „Natural Persons” first (chapter [[persons]]), then choose them here.

The contact person is also seen in the list of firms, in the „Contact person” column (section [[companies-list]]).

### 4.3.2 The representatives, read from both ends {#companies-people-representatives}

A representative is linked from the firm's screen:

1. Tick the „Links” tile. A firm with no links shows „Nothing related yet.”, with the buttons „Associate person”, „Associate property”, „Associate document” and „Dissociate”.
2. Press „Associate person”. „Associate Related Person” opens, with the firm's name under the title.
3. Search for the person by „Name” and tick their row.
4. Under „Role”, choose „Reprezentant legal / Mandatar” (legal representative / agent). Beside it, it says that the role is the one the ticked person has towards the firm.
5. Press „Associate Selected”.

Back on the firm, „Links” shows the person on one row, with their role in brackets: „Surname First name (Reprezentant legal / Mandatar)”.

The same link reads from the other end as well. On the person's screen, in their own „Links” tile, the firm appears with the role turned round: „Firm's name (Reprezentat(ă) / Mandant(ă))” — the person represents the firm, so the firm is the one represented. „View”, on each row, opens the other end, read-only.

A wrong link is taken out by selecting its row in „Links” and pressing „Dissociate”. The „Links” tile is described in full in section [[links-related]].

### 4.3.3 The firm on a document and on a property {#companies-people-records}

A firm can be a party to a document or the owner of a piece of land, just as a natural person can. The link is made from the firm's screen, again from „Links”, or from the other end.

- „Associate document” opens „Associate Document”. Tick the document, then choose „Role”: once you have ticked the document, the list of roles narrows to those that type of document has. On a „Contract de Vânzare” (sale contract), for instance: „Cumpărător”, „Moștenitor”, „Notar”, „Reprezentant legal / Mandatar”, „Vânzător”. On the document, the firm then appears in the „Parties” tile, with its role. On parties, roles and the share, see sections [[documents-parties]] and [[documents-sale]].
- „Associate property” opens „Associate Property”. Tick the property and choose „Role”: „Coproprietar”, „Cumpărător”, „Proprietar” or „Titular de drept”. On the property, the firm appears in „Links”, for instance „Firm's name (Proprietar)”.

From the document or the property, „View” on the firm's row opens the firm's screen — not a natural person's —, read-only, with „Back to list” and „Modify” at the bottom. Associating objects in general is in chapter [[links]].

### 4.3.4 The firm's interactions {#companies-people-interactions}

The „Interactions” tile starts on the right of the screen, is dragged elsewhere like any tile and is ticked from the start; it is as tall as what it holds, as „Links” is. It shows the history of interactions with the firm. Unticked, the tile goes; ticked again, it comes back. For how an interaction is recorded, see section [[persons-interactions]]; all interactions, in one place, are in the „Interactions” report (section [[reports-interactions]]).

## 4.4 Examples and use cases {#companies-examples}

### 4.4.1 Add a new firm, with its contact person {#companies-example-new}

The situation: a firm sends you an offer for a piece of land, and the person you are talking to is not in the archive yet.

1. First add the person in „Natural Persons” (chapter [[persons]]).
2. On „Juridical Persons”, press „New”, type „Name”, choose „Type” and type the CUI, checked against the document (section [[companies-add-identity]]).
3. Press „Save”; open the firm from the top of the list, where it is marked „New!”.
4. In „Representatives and contact”, type „Firm's phone” and „Firm's e-mail” and choose the person as „Contact Person 1” (sections [[companies-add-contact]] and [[companies-people-contact]]).
5. Press „Save”.

### 4.4.2 Find a firm by its CUI {#companies-example-cui}

The situation: a document gives only a firm's CUI.

1. Open „Juridical Persons”.
2. Type the CUI into the search box (section [[companies-list]]).
3. To see the CUI in the table as well, tick „CUI” in „Choose fields”.
4. Press „Open” on the firm's row.

### 4.4.3 Record a firm's director {#companies-example-representative}

The situation: a person signs on behalf of a firm and you want the link to show from both sides.

1. Open the firm and tick the „Links” tile.
2. Press „Associate person”, search for the person, tick them and choose „Reprezentant legal / Mandatar” (section [[companies-people-representatives]]).
3. Press „Associate Selected”.
4. Press „View” on the person's row: in their „Links” tile, the firm appears as „Reprezentat(ă) / Mandant(ă)”.

### 4.4.4 Record a firm as the owner of a piece of land in Bragadiru {#companies-example-owner}

The situation: a firm has bought a piece of land in Bragadiru through a sale contract.

1. Open the firm and tick the „Links” tile.
2. Press „Associate property”, search for the land, tick it and choose „Role” „Proprietar” (section [[companies-people-records]]).
3. Press „Associate Selected”.
4. Press „Associate document”, tick the contract and choose „Cumpărător”; then „Associate Selected”.
5. On the land, in „Links”, and on the contract, in „Parties”, the firm now appears with its role (chapters [[documents]] and [[links]]).
`;
