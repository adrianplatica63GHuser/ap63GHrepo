/**
 * Manual, en-GB, chapter 11. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 11 Reports {#reports}

The „Rapoarte” (reports) section of the sidebar gathers three screens that look at the archive from above, across all the records: „Interacțiuni” (interactions), the log of contacts with clients; „Arbori de moștenire” (inheritance trees), the archive's families drawn in one place; and „Căutare globală” (global search), which finds persons, properties and documents from a single screen. Open „Rapoarte” in the sidebar (section [[start-sidebar]]) and press the screen you want.

## 11.1 Interactions {#reports-interactions}

An interaction is a contact with a client: a phone call, an e-mail, a WhatsApp message, a text message, a meeting or a letter sent by post. The „Interacțiuni” screen, subtitled „Jurnalul contactelor cu clienții” (the log of contacts with clients), shows all these contacts in one place, for every client. It is the history alone: here you search and read. A new interaction is recorded on the person's screen, in their „Interacțiuni” tile (section [[persons-interactions]]); the way there starts from this very screen, from the person's name.

### 11.1.1 The history and its filters {#reports-interactions-history}

When you open the screen, „Toți clienții” (all clients) stands under the title, the period is „Ultimele 90 de zile” (the last 90 days), and the order is „Cele mai noi întâi” (newest first). Each row is one interaction, with the columns „Data” (date), „Canal” (channel), „Sens” (direction), „Persoană” (person), „Subiect” (subject), „Acte” (documents) and „Stare” (status). Above the list you see how many interactions are in the view and how many of them are „Așteaptă răspuns” (awaiting a reply).

The toolbar above the list narrows it:

- „Caută persoană sau subiect…” (search person or subject) — type part of the person's name or of the subject.
- „Perioada” (the period) — „Azi” (today), „Ultimele 7 zile”, „Ultimele 30 de zile”, „Ultimele 90 de zile”, „Anul acesta” (this year) or „Personalizat” (custom), with „De la” (from) and „Până la” (to). An interaction outside the chosen period does not appear.
- The channels — one button each for „E-mail”, „WhatsApp”, „SMS”, „Telefon” (phone), „Întâlnire” (meeting) and „Poștă” (post). Pressed, the button fills and the list shows only that channel; pressed again, the filter goes.
- „Sens” — „Toate” (all), „Primite” (received: contacts that came from the client) or „Trimise” (sent: those that went out from you).
- „Caută persoană…” (search person) — choose a person, and the list shows only their interactions; the bar under the title names them. „Arată toți clienții” (show all clients) takes you back to the whole list.
- „Cele mai noi întâi” — pressed, it becomes „Cele mai vechi întâi” (oldest first) and reverses the order. The order you chose stays even after you reload the page.

A column's header has its own filter too: in „Canal”, „Filtrează după „Canal”” (filter by channel) opens a list of the channels to tick; in „Acte” you choose „Cu acte legate” (with linked documents) or „Fără acte legate” (without linked documents). The header's filter and the toolbar's buttons are the same filter: what you tick in one place shows in the other. An interaction's description is not used for filtering — search by subject.

„Așteaptă răspuns: …” counts the received interactions still in the status „Așteaptă răspuns”, that is, the clients who wrote to you or rang you and have not yet had a reply. Pressed, it leaves only those interactions in the list and chooses „Primite”.

As soon as a filter is set, „Șterge filtrele” (clear the filters) appears. Pressed, it puts everything back: the last 90 days, every channel, „Toate”, the search box empty and „Cele mai noi întâi”.

A click on a row selects it and shows the interaction's description under its subject. Nothing can be typed into the list. When an interaction has linked documents, a paperclip with their number appears in the „Acte” column; pressed, the paperclip lists them, and a click on a document opens it from the archive. The person's name in a row is a link: it opens the person's screen, with the recording form already open on a new interaction.

### 11.1.2 Recording an interaction {#reports-interactions-log}

On the person's screen, under the history in the „Interacțiuni” tile, press the large button „Înregistrează o interacțiune” (record an interaction). The form has no box for the person: the interaction belongs to the person on the screen. The form has five sections, each a title followed by an arrow; a click on the title opens the section, a second click closes it. When the form opens, only „Înregistrare manuală” (manual entry) is open.

- „Conturi conectate” (connected accounts) — Gmail and WhatsApp Business, each „Neconectat” (not connected). The „Conectează” (connect) buttons do nothing yet: an interaction is recorded by hand, with no account connected, and „Nimic nu se trimite fără confirmare.” (nothing is sent without confirmation).
- „Înregistrare manuală” — „Canal”, „Sens”, „Stare”, „Data și ora” (date and time; now, by default), „Subiect” and „Descriere” (description). The subject is what appears in the history and what filtering uses, so keep it short. The description holds the rest; the question written in it changes with the channel — for „Telefon”, for instance, „Ce s-a convenit?” (what was agreed?).
- „Asocieri” (associations) — the documents, tags and property linked to the interaction (section [[reports-interactions-links]]).
- „Memento” (reminder) — tick „Setează un memento” (set a reminder) and choose „Data mementoului” (the reminder's date). The date is kept and shown in the history; the application sends no notifications.
- „Notă internă” (internal note) — a note „Vizibilă doar echipei” (visible to the team only).

A closed section that holds something says so after its title, for instance „Asocieri · 1 etichetă” (one tag). One that holds a mistake says the mistake, for instance „Memento · Alege data mementoului.” (choose the reminder's date).

The status can be „Înregistrată” (logged), „Așteaptă răspuns”, „Trimisă” (sent), „Încheiată” (completed) or „Programată” (scheduled). A date in the future can be chosen only with the status „Programată”: otherwise „Datele viitoare sunt pentru ce e programat. …” (future dates are for what is scheduled) appears.

„Salvează” (save) does not respond until the form is complete. With no subject, „Adaugă un subiect scurt. Acesta apare în istoric.” (add a short subject; it appears in the history) appears. When the mistake is in a closed section, saving opens it and puts the cursor on the field to correct.

- „Salvează” — „Interacțiune înregistrată” (interaction recorded) appears, and the interaction appears first in the person's history.
- „Salvează și adaugă” (save and add) — saves and leaves the form ready for the next one, with the same channel and the same direction, the subject empty.
- „Renunță” (discard) — if you typed something, it first asks „Renunți la interacțiunea nesalvată?” (discard the unsaved interaction?): „Renunță la ea” (discard it) empties the form, „Continuă” (continue) lets you carry on typing.
- Ctrl+S does the same as „Salvează”.

„Restrânge” (collapse) folds the form back into the large button.

### 11.1.3 Linked documents, tags and a property {#reports-interactions-links}

In the „Asocieri” section you link the interaction to what already exists in the archive.

- „Acte legate” (linked documents) — press „Adaugă legătură” (add link) and find the document in „Caută un act” (search for a document), by title or code. The document is not copied or uploaded again: the interaction only points at it. A document already linked is not offered a second time. The „×” beside a document removes the link.
- „Etichete” (tags) — press „Adaugă etichetă” (add tag), type the tag and press Enter. A tag used on one interaction is suggested on the next ones.
- „Proprietate legată” (linked property) — find the property in „Caută o proprietate” (search for a property), by nickname or code. It is optional and does not appear in the history. The „×” removes it.

After saving, the interaction's row shows the paperclip and the number of linked documents.

### 11.1.4 Changing and deleting {#reports-interactions-edit}

A click on an interaction in the person's history loads it into the form: the mode moves from „Înregistrare nouă” (new record) to „Editează selecția” (edit the selection), and the form shows who created it and who last changed it, and when. Change what is needed and press „Salvează modificările” (save the changes); „Modificări salvate” (changes saved) appears, and the history shows the new value.

Nothing you typed is lost without a question. If you choose another row with unsaved changes, the form asks „Renunți la modificările nesalvate?” (discard the unsaved changes?). If you leave the screen, the application asks „Modificări nesalvate” (unsaved changes), and „Anulează” (cancel) keeps you where you are, with what you typed.

If someone else saved the same interaction before you, your save does not go over theirs: „Această înregistrare a fost modificată de altcineva. O reîncarci sau o suprascrii?” (this record was changed by someone else; reload it or overwrite it?) appears. „Reîncarcă” (reload) brings their version; „Suprascrie” (overwrite) keeps what you typed.

To delete an interaction, press „Șterge înregistrarea” (delete the record). The question „Ștergi interacțiunea?” (delete the interaction?) names the person and the date and says „Actele legate rămân în arhivă; persoana și proprietatea nu se schimbă.” (the linked documents stay in the archive; the person and the property do not change). „Șterge” (delete) deletes it for good: „Interacțiune ștearsă” (interaction deleted) appears, the row goes, and the form returns to „Înregistrare nouă”.

### 11.1.5 „Exportă” {#reports-interactions-export}

„Exportă” (export), in the toolbar of the „Interacțiuni” screen, downloads the rows the filters show, in the list's order, into a file that opens straight into columns in Excel, with its diacritics in place. The file's name starts with „interactiuni-”, followed by the day's date.

The file's columns are „Data și ora”, „Canal”, „Sens”, „Persoană”, „Subiect”, „Descriere”, „Acte legate”, „Stare”, „Memento” and „Etichete”. The description goes in whole, in a single cell, even when it runs to several lines. The internal note does not go into the file. So set the filters first — a person, a channel, a period — and export afterwards: the file holds exactly what you see.

### 11.1.6 On the person's screen and in „Incursiune” {#reports-interactions-person}

The „Interacțiuni” tile on a person's screen shows the same list, for that person only, with the form under it (section [[persons-interactions]]). „Deschide în „Interacțiuni”” (open in interactions) takes you to this screen, already narrowed to the person.

From the list of persons, „Incursiune” (the quick look) shows the „Interacțiuni” tile with the history alone, no form. A click on an interaction there opens the person's screen, with the interaction loaded into the form.

## 11.2 Inheritance trees {#reports-inheritance}

„Arbori de moștenire” draws, over the whole page, every natural person who has a family tie — a tie with a role marked „Rudenie” (kinship) in „Roluri Persoane” (person roles) (section [[admin-reference-data]]). The screen is for reading only: relatives are linked from the person's „Arbore de moștenire” (inheritance tree) tile (section [[persons-relatives-tree]]) or from „Legături” (links) (section [[persons-relatives-link]]). When there is no family tie yet, the screen tells you where to choose „Rudenie”.

The tree shows no CNP, identity card or address: each person is shown only by name, nickname, gender, date of birth and, where it applies, the death.

### 11.2.1 The drawing, the levels and the search {#reports-inheritance-levels}

The generations read from top to bottom: the grandparents on one row, the parents under them, the children further down. Husband and wife stand side by side, and a child under its parents. Each family has its own lane, apart from the others; above the tree it says how many persons and how many families are drawn.

The tree has three levels, and its bar tells you which one you are on: „Nivelul … din 3 — rotița mărește, tragerea mută” (level … of 3 — the wheel zooms, dragging moves).

- Level 1 — a dot and the first name, so that you see a large family at a glance.
- Level 2 — the name and the year of birth, for instance „n. 1982” (born 1982).
- Level 3 — the name, the date of birth and the gender, for instance „n. 15.01.1982 · femeie” (born 15.01.1982, female), and the family ties.

Turn the mouse wheel over the tree to go from one level to another, and drag with the mouse to move it about the page.

To reach a person, type their name into „Caută o persoană…” (search for a person) and press „Caută” (search): the tree centres on them, at the nearest level, and their card opens alongside. When the name is not in the tree, „Nicio persoană cu acest nume în arbore.” (no person with this name in the tree) appears.

When you hold the mouse over a person, a small card shows their name, their date of birth and how many family ties they have. A click on them opens the side card, with „Deschide” (open) and „Închide” (close). Any name opens the person's screen, with the relatives' panel of the „Arbore de moștenire” tile already open — from there you add or remove a relative.

A person marked „Decedat” (deceased) has „†” after the name and the years of their life under it, for instance „1955–2010”.

From a person's „Arbore de moștenire” tile, „Deschide arborele întreg” (open the whole tree) opens this screen centred on them.

### 11.2.2 The documents in the tree and „Acte comune” {#reports-inheritance-documents}

From the middle level, each person who appears on documents carries a badge with their number, for instance „Un act” (one document). A click on the badge opens „Actele pe care apare …” (the documents on which … appears), with each document: its type, number and date, for instance „nr. 123/2001 · din 02.05.2001”. A click on a document opens it.

„Acte comune” (shared documents), off at first, puts on the line between two relatives how many documents both of them are on. A click on the number opens „Acte comune: … și …” (shared documents: … and …), with the list of those documents. So you see at once, for instance, the contract on which both the father and the daughter appear.

### 11.2.3 The family over time: „Anul” {#reports-inheritance-year}

„Anul” (the year) starts at „azi” (today). Move it to a year in the past and the tree shows the family as it was then: whoever was born after the chosen year appears faded, and whoever had died by then carries „†”. A person who died later is not marked as deceased in the chosen year.

## 11.3 Global search {#reports-search}

„Căutare globală” searches from one place across all three kinds of record: persons (natural and legal), properties and documents (Figure [[fig-reports-search]]). It is where you search when you do not know which list holds what you are after, or when you want to see together everything that carries a name, a tag or a stamp.

![11.1 „Căutare globală”, with the results of a search](reports-search.png){#fig-reports-search}

### 11.3.1 The filters {#reports-search-filters}

Fill in one or more filters, then press „Caută”. All the filters set apply together: a result must meet every one of them.

- „Căutare nume / cod” (search name / code) — part of a name or of a code, for instance „Popescu”.
- „Tip entitate” (entity type) — „Orice” (any), „Persoană” (person), „Proprietate” (property) or „Document”. „Subtip persoană” (person subtype) chooses between „Persoană fizică” (natural person) and „Persoană juridică” (legal person).
- „Importanță” (importance), „Relevanță” (relevance) and „Proveniență” (provenance) — the values in the record's „Clasificare” (classification) tile (section [[links-classify-classification]]). „Proveniență” says how the record came into the archive, for instance „Manual (Adaugă nou)” (manual, added new) for one typed in by hand.
- „Cod grup” (group code), „Cod ștampilă” (stamp code) and „Etichetă” (tag) — the groups, stamps and tags in the „Etichete și grupuri” (tags and groups) tile (sections [[links-classify-groups]], [[links-classify-stamps]] and [[links-classify-tags]]).
- „Are metadate” (has metadata), with „Metadate actualizate de la” (metadata updated from) and „Metadate actualizate până la” (metadata updated to).

„Resetează” (reset) empties every filter and hides the results.

### 11.3.2 The results {#reports-search-results}

Above the table it says how many results were found, for instance „3 rezultate” (3 results). The columns are „Tip” (type), „Nume” (name), „Grupuri” (groups), „Ștampile” (stamps), „Importanță”, „Relevanță”, „Proveniență”, „Actualizat de” (updated by) and „Metadate actualizate” (metadata updated). „Tip” says „Persoană”, „Proprietate” or „Document”. A property is named by its tarla and parcel, with its nickname in brackets.

At most 50 results are shown for each kind of record, 15 to a page. When there are more, the screen says so and asks you to narrow the search — add a filter.

When nothing matches, „Nicio entitate nu corespunde filtrelor selectate.” (no entity matches the selected filters) appears.

## 11.4 Examples and use cases {#reports-examples}

### 11.4.1 Answer the clients who are waiting {#reports-example-reply}

In the morning you want to see who wrote to you or rang you and is still waiting for a reply.

1. Open „Rapoarte” → „Interacțiuni” (section [[reports-interactions-history]]).
2. Press „Așteaptă răspuns: …”. Only the received contacts you have not answered remain.
3. Press the person's name in a row. Their screen opens, with the form ready.
4. Once you have rung them, choose „Telefon” and „Trimisă”, type the subject and press „Salvează” (section [[reports-interactions-log]]).
5. In their history, press the interaction that was waiting, choose „Încheiată” under „Stare” and press „Salvează modificările” (section [[reports-interactions-edit]]).

### 11.4.2 Send the calls with a client in an Excel file {#reports-example-export}

A person asks you for the list of every phone call of the last month about a plot of land in Bragadiru.

1. On the „Interacțiuni” screen, under „Caută persoană…”, choose the person (section [[reports-interactions-history]]).
2. Under „Perioada”, choose „Ultimele 30 de zile”, then press the „Telefon” button.
3. Check the rows in the list: exactly these go into the file.
4. Press „Exportă” and open the file in Excel (section [[reports-interactions-export]]). The internal notes are not in it.

### 11.4.3 Find the documents a father and his daughter share {#reports-example-family}

You are preparing a succession and want to see on which documents the late father and his daughter appear together.

1. Open „Rapoarte” → „Arbori de moștenire” and search for the father in „Caută o persoană…” (section [[reports-inheritance-levels]]).
2. Switch „Acte comune” on and press the number on the line between father and daughter (section [[reports-inheritance-documents]]).
3. Press a document in the list, for instance a contract of sale, to open it.
4. Move „Anul” to the contract's year, to see who was alive then (section [[reports-inheritance-year]]).

### 11.4.4 Gather everything that carries a tag {#reports-example-tag}

You have tagged a few persons, plots of land and documents „prioritar” (priority) and want to see them all in one place.

1. Open „Rapoarte” → „Căutare globală” (section [[reports-search-filters]]).
2. Type „prioritar” under „Etichetă” and leave „Tip entitate” on „Orice”.
3. Press „Caută”. The persons, properties and documents appear in the same table (section [[reports-search-results]]).
4. To see only the plots of land, choose „Proprietate” under „Tip entitate” and press „Caută” again.
`;
