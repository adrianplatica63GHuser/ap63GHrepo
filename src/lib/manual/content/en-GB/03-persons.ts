/**
 * Manual, en-GB, chapter 3. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 3 Natural persons {#persons}

A natural person is a human being: their name, CNP, date of birth, identity document, telephone numbers, e-mail addresses and addresses. This chapter shows how you find a person, how you add one — by hand or from an identity card —, how you record a death, how you link relatives, and what the „Arbore de moștenire” and „Interacțiuni” tiles mean.

## 3.1 The list of natural persons {#persons-list}

In the sidebar, open „Domeniu”, then „Persoane Fizice”. The screen is called „Persoană fizică” and shows a table with the columns „Nume” (name) and „Poreclă” (nickname), 15 rows to a page (section [[start-lists]]). In the „Nume” column the first name comes first: a person whose surname is Popescu and whose first name is Ion appears as „Ion Popescu”.

The search box („caută după cod, nume, email sau telefon”) keeps in the table only the persons who match what you type; part of the name is enough. The list has no „Importanță” or „Relevanță” filter.

„Câmpuri afișate” (the columns shown) adds columns to the table, at most four at a time. You can choose them from:

- „CNP”
- „Data nașterii” (date of birth)
- „Vârstă” (age)
- „Gen” (gender)
- „Data decesului” (date of death)
- „Locul nașterii” (place of birth)
- „Tip profesional” (professional type)

The button shows how many columns you have chosen, for instance „Câmpuri afișate 2/4”. The choice stays until you change it.

A few marks on the rows:

- „Nou!” stands beside a person added or changed recently.
- „†” after the name means the person has died; if you move the mouse over it, it reads „Decedat” (section [[persons-identity]]).
- The person's system ID does not appear in the list; you see it on their screen, in the corner of the „Identitate” tile.

Each row has four buttons:

| The button | What it does |
|---|---|
| „Previzualizare” | Shows, beside the list, a short summary: the name, then the nickname and the CNP, then „născut:” (or „născută:”) with the date and place of birth. |
| „Incursiune” | Shows, beside the list, the person's „Interacțiuni” tile (section [[persons-interactions]]). |
| „Legături” | Shows, beside the list, the person's links, read-only (section [[links-related]]). |
| „Deschide” | Opens the person's screen. |

A second click on the same button closes what it opened.

## 3.2 A person added by hand {#persons-add}

On the list of natural persons, press „Adaugă persoană” (add person). The screen „Persoană fizică nouă” opens straight away: an empty form divided into tiles (Figure [[fig-persons-new]]).

![3.1 The form of a new natural person](persons-new.png){#fig-persons-new}

### 3.2.1 The form's tiles {#persons-add-tiles}

| The tile | What it holds |
|---|---|
| „Identitate” | „Nume”, „Prenume” (first name), „Poreclă”, „CNP”, „Gen”, „Data nașterii”, „Decedat” and „Data decesului”, „Locul nașterii”. |
| „Act de identitate” | „Tip document” („Carte de identitate” or „Pașaport”) and the document's details. |
| „Contact” | The telephone numbers and e-mail addresses. |
| „Adrese” | „Adresă domiciliu” (home address) and „Adresă corespondență” (correspondence address). |

The ticks at the top of the screen show or hide tiles, as on any record (section [[start-tiles]]). A hidden tile does not lose its data: what you typed in it is saved all the same.

### 3.2.2 Saving {#persons-add-save}

The only thing required is the name: fill in at least „Nume” or „Prenume”. The rest can be filled in later. If you know the CNP, type it now: once saved it can no longer be changed (section [[persons-identity]]).

1. Fill in „Nume” and „Prenume”, then whatever else you know about the person.
2. Press „Salvează” (save).
3. The application returns you to the list. The new person is at the top, with „Nou!” beside the name.

If a required field was left empty in a hidden tile, on saving the tile reappears, the application takes you to that field and writes underneath what is missing. Nothing is saved until you fill it in.

Later, a person is changed on their own screen: change the fields and press „Salvează”. Every save makes a new version (section [[links-versions]]). To delete a person, press „Șterge” (delete) and answer „Da” (yes) to the question „Ștergeți persoana?”; the deletion cannot be undone.

## 3.3 A person from an identity card {#persons-id-card}

A Romanian identity card also prints the parents' first names. The application makes use of that: together with the card's holder, it can create the father and the mother and link them to the holder as „Tată” (father) and „Mamă” (mother). This is done in two ways.

### 3.3.1 When adding by hand {#persons-id-card-manual}

1. On the „Persoană fizică nouă” screen, fill in the holder: „Nume”, „Prenume”, „Gen” and whatever else you have from the card.
2. In the „Act de identitate” tile, under „Tip document”, choose „Carte de identitate”. Under the tile, „Părinții titularului” (the holder's parents) appears.
3. Tick „Creează și tatăl” (create the father too) and type his first name. Tick „Creează și mama” (create the mother too) and type her first name.
4. Each parent's surname is filled in with the holder's and marked „Numele titularului, presupus — verificați-l: al mamei poate fi cel de dinainte de căsătorie.” (the holder's surname, assumed — check it: the mother's may be her maiden name). Correct it if you know another.
5. Press „Salvează”. The holder is created first.
6. A window follows for each ticked parent: „Tatăl titularului”, „Părintele 1 din 2”, then „Mama titularului”, „Părintele 2 din 2”.

Without a CNP, the application looks for the parent by name only, and the window tells you so. If it finds nobody, it reads „Persoană nouă” (new person): press „Creează și leagă” (create and link). If it finds persons with a similar name, it shows them as suggestions, not as sure matches: choose „Leagă această persoană” (link this person) only if it really is the same person, otherwise „Niciuna — creează persoană nouă” (none — create a new person). „Omite” (skip) passes over that parent.

At the end you return to the list of persons. On the holder's screen, in „Legături”, the father appears with „(Tată)” and the mother with „(Mamă)”; on the father's screen, the holder appears with „(Fiu)” (son) or „(Fiică)” (daughter). For each parent created this way, „Proveniență” (provenance) is „Din actul de identitate al unei rude”, and „Note” says from whose card they were created.

### 3.3.2 From an identity card already in the archive {#persons-id-card-document}

When the identity card is already a document in the archive, with its scan as a page, the persons are created from the document's screen.

1. Open the document of type „Carte de identitate”.
2. Press „Creează persoane din CI” (create persons from the ID card), beside „Modifică”. The application reads the card from the first page and opens the window „Creează persoană din cartea de identitate”.
3. Check the holder and press „Creează și leagă”. If the holder is already in the archive, the application finds them by CNP and does not make a second person.
4. In „Părinții titularului”, the father and mother read from the card are already ticked, with the holder's surname, marked as assumed. Check them, then press „Creează și leagă” for each.
5. Under the button, the application writes what it did: „Titularul a fost creat și legat de act.”, „Tatăl: creat(ă) și legat(ă)”, „Mama: creat(ă) și legat(ă)”.

The holder is linked to the document as „Titular act de identitate” (identity-document holder), and the parents are linked to the holder as „Tată” and „Mamă”. If the reading does not find the parents' first names, the two rows appear empty and unticked, with the note „Cartea nu tipărește prenumele părinților, sau citirea nu le-a găsit…”: you can type them yourself.

How the application reads an identity card when a whole folder is imported, see section [[import-scanning]].

## 3.4 The CNP and a death {#persons-identity}

### 3.4.1 The CNP does not change any more {#persons-identity-cnp}

The CNP is what the application uses to recognise a person, for instance when it reads an identity card (section [[persons-id-card-document]]). That is why, once saved, it can no longer be changed.

The „CNP” field looks like any other and you can type in it. When you move the mouse over it or enter it with the keyboard, the note „CNP-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba” (the CNP cannot be changed once set — delete and create again to change it) appears; Escape hides it. If you change the CNP anyway and press „Salvează”, the same sentence appears in red under the form, „Modificări nesalvate” (unsaved changes) stays on screen, and the CNP kept is the old one.

A wrong CNP is put right this way: delete the person and add them again, with the correct CNP.

### 3.4.2 A death {#persons-identity-death}

In the „Identitate” tile, under „Data nașterii”, is the „Decedat” (deceased) tick, unticked at first. Beside it, „Data decesului” can be filled in only while „Decedat” is ticked; the date is not required.

1. Open the person and tick „Decedat”.
2. Type „Data decesului”, if you know it.
3. Press „Salvează”.

After the death, „Vârstă” no longer grows: it shows the age at death, followed by „†” — for instance „76 †”. A person ticked „Decedat” but with no date has „Vârstă” „—”. In the lists, „†” appears after their name.

The application refuses a date of death that makes no sense and writes under the field why:

- „„Data decesului” nu poate fi înainte de „Data nașterii”.” (it cannot be before the date of birth)
- „„Data decesului” nu poate fi în viitor.” (it cannot be in the future)

If you ticked „Decedat” by mistake, untick it and save: the date of death is emptied, and „Vârstă” shows today's age again.

## 3.5 Relatives and the inheritance tree {#persons-relatives}

### 3.5.1 A relative linked from „Legături” {#persons-relatives-link}

A person's „Legături” (links) tile gathers everything linked to them: persons, properties and documents (section [[links-related]]). A relative is linked from here.

1. On the person's screen, in „Legături”, press „Asociază persoană” (associate a person). „Asociere persoană corelată” opens.
2. Find the relative by „Nume” and tick them.
3. Under „Rol” (role), choose what the ticked person is to the one on screen — for instance „Părinte” (parent), „Fiu”, „Fiică”, „Soț” (husband), „Soție” (wife), „Frate” (brother), „Soră” (sister). The sentence beside „Rol” reminds you of the direction: „Rolul pe care persoana bifată îl are față de …” (the role the ticked person holds towards …).
4. Press „Asociază selecția”. You return to the person's screen, and the relative appears in „Legături”, with the role in brackets.

The link reads correctly from both ends. If Ion is „Părinte” to Ana, on Ion's screen Ana appears as „Fiică”: each end shows the other person's role, in that person's gender. For a person with no „Gen” filled in, the application uses the neutral form, for instance „Copil” (child). The pairs of roles are set in „Date de referință”, under „Roluri Persoane”, in the „Rol invers” (converse role) column (section [[admin-reference-data]]).

A link is removed from „Legături”: choose the row and press „Dezasociază” (dissociate).

### 3.5.2 The „Arbore de moștenire” tile {#persons-relatives-tree}

The „Arbore de moștenire” (inheritance tree) tile, light blue, draws the person's family: parents and grandparents up to great-grandparents, children down to great-grandchildren, siblings and the husband or wife (Figure [[fig-persons-tree]]). If you do not see it, tick „Arbore de moștenire” at the top of the screen.

![3.2 A person's „Arbore de moștenire” tile](persons-tree.png){#fig-persons-tree}

Only links with a kinship role go into the tree — the roles marked „Rudenie” (kinship) in „Roluri Persoane”. A person with no such links shows „Nicio legătură de familie încă.” (no family tie yet).

Under the drawing, a single large button, „Adaugă sau scoate o rudă” (add or remove a relative), opens the panel of family ties. When you reach the person from „Rapoarte” → „Arbori de moștenire”, with a click on their name (section [[reports-inheritance]]), the panel is already open.

- „Legăturile de familie ale persoanei” (the person's family ties) shows their relatives, each with the role.
- To add a relative: under „Ruda” (the relative), type the name and choose the person; under „Ce este pentru …” (what they are to …), choose the kinship; press „Adaugă legătura” (add the tie). The relative appears in the drawing.
- To remove a relative: press „Scoate legătura cu …” (remove the tie with …), then „Scoate”. The relative disappears from the drawing and from the list.

The ties added here are the same as those in „Legături”: a relative linked in one place appears in the other too.

## 3.6 A person's interactions {#persons-interactions}

The „Interacțiuni” (interactions) tile is the history of what has happened with the person: calls, e-mails, meetings. It stands fixed at the right of the screen, light purple, and is ticked from the start; its tick is the last at the top of the screen. A person with no interactions shows „Nicio interacțiune înregistrată cu această persoană.” (no interaction recorded with this person). „Deschide în „Interacțiuni”” takes you to the screen with all the interactions.

Under the history, the large button „Înregistrează o interacțiune” (record an interaction) opens the form, already tied to this person:

1. Press „Înregistrează o interacțiune”.
2. Choose the channel, for instance „Telefon” (telephone), and type the subject.
3. Press „Salvează”. „Interacțiune înregistrată” (interaction recorded) appears, and the interaction appears in the history.

A click on an interaction in the history opens it in the form: change what is needed and press „Salvează modificările” (save the changes), or press „Șterge înregistrarea” (delete the record), then „Șterge”. „Restrânge” (collapse) folds the form away again.

From the list of persons, „Incursiune” shows the history only; a click on an interaction there opens the person's screen, with the interaction in the form. The „Interacțiuni” screen, with its filters, is described in section [[reports-interactions]].

## 3.7 Examples and use cases {#persons-examples}

### 3.7.1 Add a person from their identity card, together with the parents {#persons-example-parents}

You have in front of you the identity card of a person who is not yet in the archive.

1. „Persoane Fizice” → „Adaugă persoană” (section [[persons-add]]).
2. Fill in the surname, first name, gender, CNP and date of birth from the card.
3. Under „Tip document”, choose „Carte de identitate”; tick „Creează și tatăl” and „Creează și mama” and type their first names (section [[persons-id-card-manual]]).
4. Check the mother's surname: it may be her maiden name.
5. „Salvează”, then „Creează și leagă” for each parent.
6. Open the person: in „Legături” they have a „(Tată)” and a „(Mamă)”.

### 3.7.2 Record a person's death {#persons-example-death}

You learn from a certificate of inheritance that a person in the archive has died.

1. Find the person in the „Persoane Fizice” list and press „Deschide” (section [[persons-list]]).
2. In „Identitate”, tick „Decedat” and type „Data decesului” (section [[persons-identity-death]]).
3. „Salvează”. „Vârstă” now shows the age at death, with „†”.
4. Back in the list, „†” stands after their name.

### 3.7.3 Link a son to his father and check the tree {#persons-example-tree}

Two persons are in the archive, but nothing says they are father and son.

1. Open the son.
2. In „Arbore de moștenire”, press „Adaugă sau scoate o rudă” (section [[persons-relatives-tree]]).
3. Under „Ruda”, choose the father; under „Ce este pentru …”, choose „Tată”; press „Adaugă legătura”.
4. The father appears in the drawing above the son, and in „Legături” each sees the other (section [[persons-relatives-link]]).

### 3.7.4 Record a telephone call {#persons-example-call}

A person rang to ask about the sale-and-purchase contract for a plot of land in Bragadiru.

1. Open the person.
2. In „Interacțiuni”, press „Înregistrează o interacțiune” (section [[persons-interactions]]).
3. Choose „Telefon”, type the subject, then press „Salvează”.
4. The call appears in the person's history and on the „Interacțiuni” screen (section [[reports-interactions]]).
`;
