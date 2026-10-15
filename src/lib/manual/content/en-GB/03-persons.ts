/**
 * Manual, en-GB, chapter 3. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 3 Natural persons {#persons}

A natural person is a human being: their name, CNP, date of birth, identity document, telephone numbers, e-mail addresses and addresses. This chapter shows how you find a person, how you add one — by hand or from an identity card —, how you record a death, how you link relatives, and what the „Inheritance tree” and „Interactions” tiles mean.

## 3.1 The list of natural persons {#persons-list}

In the sidebar, open „Domain”, then „Natural Persons”. The screen is called „Natural Person” and shows a table with the columns „Name” and „Nickname”, 15 rows to a page (section [[start-lists]]). In the „Name” column the first name comes first: a person whose surname is Popescu and whose first name is Ion appears as „Ion Popescu”.

The search box („search by code, name, email, or phone”) keeps in the table only the persons who match what you type; part of the name is enough. The list has no „Importance” or „Relevance” filter.

„Choose fields” adds columns to the table, at most four at a time. You can choose them from:

- „CNP”
- „Date of Birth”
- „Age”
- „Gender”
- „Date of death”
- „Place of Birth”
- „Professional type”

The button shows how many columns you have chosen, for instance „Choose fields 2/4”. The choice stays until you change it.

A few marks on the rows:

- „New!” stands beside a person added or changed recently.
- „†” after the name means the person has died; if you move the mouse over it, it reads „Deceased” (section [[persons-identity]]).
- The person's system ID does not appear in the list; you see it on their screen, in the corner of the „Identity” tile.

Each row has four buttons:

| The button | What it does |
|---|---|
| „Preview” | Shows, beside the list, a short summary: the name, then the nickname and the CNP, then „born:” with the date and place of birth. |
| „Peek inside” | Shows, beside the list, the person's „Interactions” tile (section [[persons-interactions]]). |
| „Links” | Shows, beside the list, the person's links, read-only (section [[links-related]]). |
| „Open” | Opens the person's screen. |

A second click on the same button closes what it opened.

## 3.2 A person added by hand {#persons-add}

On the list of natural persons, press „Add new Person”. The screen „New Natural Person” opens straight away: an empty form divided into tiles (Figure [[fig-persons-new]]).

![3.1 The form of a new natural person](persons-new.png){#fig-persons-new}

### 3.2.1 The form's tiles {#persons-add-tiles}

| The tile | What it holds |
|---|---|
| „Identity” | „Last Name”, „First Name”, „Nickname”, „CNP”, „Gender”, „Date of Birth”, „Deceased” and „Date of death”, „Place of Birth”. |
| „Identity document” | „ID Type” („ID Card” or „Passport”) and the document's details. |
| „Contact” | The telephone numbers and e-mail addresses. |
| „Addresses” | „Home Address” and „Correspondence Address”. |

The ticks at the top of the screen show or hide tiles, as on any record (section [[start-tiles]]). A hidden tile does not lose its data: what you typed in it is saved all the same.

### 3.2.2 Saving {#persons-add-save}

The only thing required is the name: fill in at least „Last Name” or „First Name”. The rest can be filled in later. If you know the CNP, type it now: once saved it can no longer be changed (section [[persons-identity]]).

1. Fill in „Last Name” and „First Name”, then whatever else you know about the person.
2. Press „Save”.
3. The application returns you to the list. The new person is at the top, with „New!” beside the name.

If a required field was left empty in a hidden tile, on saving the tile reappears, the application takes you to that field and writes underneath what is missing. Nothing is saved until you fill it in.

Later, a person is changed on their own screen: change the fields and press „Save”. Every save makes a new version (section [[links-versions]]). To delete a person, press „Delete” and answer „Yes” to the question „Delete person?”; the deletion cannot be undone.

## 3.3 A person from an identity card {#persons-id-card}

A Romanian identity card also prints the parents' first names. The application makes use of that: together with the card's holder, it can create the father and the mother and link them to the holder as „Tată” (father) and „Mamă” (mother). This is done in two ways.

### 3.3.1 When adding by hand {#persons-id-card-manual}

1. On the „New Natural Person” screen, fill in the holder: „Last Name”, „First Name”, „Gender” and whatever else you have from the card.
2. In the „Identity document” tile, under „ID Type”, choose „ID Card”. Under the tile, „The holder's parents” appears.
3. Tick „Also create the father” and type his first name. Tick „Also create the mother” and type her first name.
4. Each parent's surname is filled in with the holder's and marked „The holder's surname, assumed — check it: a mother's may be her maiden name.” Correct it if you know another.
5. Press „Save”. The holder is created first.
6. A window follows for each ticked parent: „The holder's father”, „Parent 1 of 2”, then „The holder's mother”, „Parent 2 of 2”.

Without a CNP, the application looks for the parent by name only, and the window tells you so. If it finds nobody, it reads „New person”: press „Create and link”. If it finds persons with a similar name, it shows them as suggestions, not as sure matches: choose „Link this person” only if it really is the same person, otherwise „None of these — create a new person”. „Skip” passes over that parent.

At the end you return to the list of persons. On the holder's screen, in „Links”, the father appears with „(Tată)” and the mother with „(Mamă)”; on the father's screen, the holder appears with „(Fiu)” (son) or „(Fiică)” (daughter). For each parent created this way, „Provenance” is „From a relative's identity document”, and „Notes” says from whose card they were created.

### 3.3.2 From an identity card already in the archive {#persons-id-card-document}

When the identity card is already a document in the archive, with its scan as a page, the persons are created from the document's screen.

1. Open the document of type „Carte de Identitate”.
2. Press „Create people from the ID card”, beside „Modify”. The application reads the card from the first page and opens the window „Create person from ID card”.
3. Check the holder and press „Create and link”. If the holder is already in the archive, the application finds them by CNP and does not make a second person.
4. In „The holder's parents”, the father and mother read from the card are already ticked, with the holder's surname, marked as assumed. Check them, then press „Create and link” for each.
5. Under the button, the application writes what it did: „The holder was created and linked to the document.”, „Father: created and linked”, „Mother: created and linked”.

The holder is linked to the document as „Titular act de identitate” (identity-document holder), and the parents are linked to the holder as „Tată” and „Mamă”. If the reading does not find the parents' first names, the two rows appear empty and unticked, with the note „The card does not print the parents' first names, or the read did not find them…”: you can type them yourself.

How the application reads an identity card when a whole folder is imported, see section [[import-scanning]].

## 3.4 The CNP and a death {#persons-identity}

### 3.4.1 The CNP does not change any more {#persons-identity-cnp}

The CNP is what the application uses to recognise a person, for instance when it reads an identity card (section [[persons-id-card-document]]). That is why, once saved, it can no longer be changed.

The „CNP” field looks like any other and you can type in it. When you move the mouse over it or enter it with the keyboard, the note „CNP cannot be changed once set — delete and recreate to change” appears; Escape hides it. If you change the CNP anyway and press „Save”, the same sentence appears in red under the form, „Unsaved changes” stays on screen, and the CNP kept is the old one.

A wrong CNP is put right this way: delete the person and add them again, with the correct CNP.

### 3.4.2 A death {#persons-identity-death}

In the „Identity” tile, under „Date of Birth”, is the „Deceased” tick, unticked at first. Beside it, „Date of death” can be filled in only while „Deceased” is ticked; the date is not required.

1. Open the person and tick „Deceased”.
2. Type „Date of death”, if you know it.
3. Press „Save”.

After the death, „Age” no longer grows: it shows the age at death, followed by „†” — for instance „76 †”. A person ticked „Deceased” but with no date has „Age” „—”. In the lists, „†” appears after their name.

The application refuses a date of death that makes no sense and writes under the field why:

- „The date of death cannot be before the date of birth.”
- „The date of death cannot be in the future.”

If you ticked „Deceased” by mistake, untick it and save: the date of death is emptied, and „Age” shows today's age again.

## 3.5 Relatives and the inheritance tree {#persons-relatives}

### 3.5.1 A relative linked from „Links” {#persons-relatives-link}

A person's „Links” tile gathers everything linked to them: persons, properties and documents (section [[links-related]]). A relative is linked from here.

1. On the person's screen, in „Links”, press „Associate person”. „Associate Related Person” opens.
2. Find the relative by „Name” and tick them.
3. Under „Role”, choose what the ticked person is to the one on screen — for instance „Părinte” (parent), „Fiu”, „Fiică”, „Soț” (husband), „Soție” (wife), „Frate” (brother), „Soră” (sister). The sentence beside „Role” reminds you of the direction: „The role the ticked person has towards …”.
4. Press „Associate Selected”. You return to the person's screen, and the relative appears in „Links”, with the role in brackets.

The link reads correctly from both ends. If Ion is „Părinte” to Ana, on Ion's screen Ana appears as „Fiică”: each end shows the other person's role, in that person's gender. For a person with no „Gender” filled in, the application uses the neutral form, for instance „Copil” (child). The pairs of roles are set in „Reference Data”, under „Person Roles”, in the „Converse role” column (section [[admin-reference-data]]).

A link is removed from „Links”: choose the row and press „Dissociate”.

### 3.5.2 The „Inheritance tree” tile {#persons-relatives-tree}

The „Inheritance tree” tile, light blue, draws the person's family: parents and grandparents up to great-grandparents, children down to great-grandchildren, siblings and the husband or wife (Figure [[fig-persons-tree]]). If you do not see it, tick „Inheritance tree” at the top of the screen.

![3.2 A person's „Inheritance tree” tile](persons-tree.png){#fig-persons-tree}

Only links with a kinship role go into the tree — the roles marked „Kinship” in „Person Roles”. A person with no such links shows „No family ties yet.”

Under the drawing, a single large button, „Add or remove a relative”, opens the panel of family ties. When you reach the person from „Reporting” → „Inheritance trees”, with a click on their name (section [[reports-inheritance]]), the panel is already open.

- „The person's family ties” shows their relatives, each with the role.
- To add a relative: under „Relative”, type the name and choose the person; under „What they are to …”, choose the kinship; press „Add the tie”. The relative appears in the drawing.
- To remove a relative: press „Remove the tie with …”, then „Remove”. The relative disappears from the drawing and from the list.

The ties added here are the same as those in „Links”: a relative linked in one place appears in the other too.

## 3.6 A person's interactions {#persons-interactions}

The „Interactions” tile is the history of what has happened with the person: calls, e-mails, meetings. It stands fixed at the right of the screen, light purple, and is ticked from the start; its tick is the last at the top of the screen. A person with no interactions shows „No interaction logged with this person.” „Open in Interactions” takes you to the screen with all the interactions.

Under the history, the large button „Log interaction” opens the form, already tied to this person:

1. Press „Log interaction”.
2. Choose the channel, for instance „Phone”, and type the subject.
3. Press „Save”. „Interaction logged” appears, and the interaction appears in the history.

A click on an interaction in the history opens it in the form: change what is needed and press „Save changes”, or press „Delete record”, then „Delete”. „Collapse” folds the form away again.

From the list of persons, „Peek inside” shows the history only; a click on an interaction there opens the person's screen, with the interaction in the form. The „Interactions” screen, with its filters, is described in section [[reports-interactions]].

## 3.7 Examples and use cases {#persons-examples}

### 3.7.1 Add a person from their identity card, together with the parents {#persons-example-parents}

You have in front of you the identity card of a person who is not yet in the archive.

1. „Natural Persons” → „Add new Person” (section [[persons-add]]).
2. Fill in the surname, first name, gender, CNP and date of birth from the card.
3. Under „ID Type”, choose „ID Card”; tick „Also create the father” and „Also create the mother” and type their first names (section [[persons-id-card-manual]]).
4. Check the mother's surname: it may be her maiden name.
5. „Save”, then „Create and link” for each parent.
6. Open the person: in „Links” they have a „(Tată)” and a „(Mamă)”.

### 3.7.2 Record a person's death {#persons-example-death}

You learn from a certificate of inheritance that a person in the archive has died.

1. Find the person in the „Natural Persons” list and press „Open” (section [[persons-list]]).
2. In „Identity”, tick „Deceased” and type „Date of death” (section [[persons-identity-death]]).
3. „Save”. „Age” now shows the age at death, with „†”.
4. Back in the list, „†” stands after their name.

### 3.7.3 Link a son to his father and check the tree {#persons-example-tree}

Two persons are in the archive, but nothing says they are father and son.

1. Open the son.
2. In „Inheritance tree”, press „Add or remove a relative” (section [[persons-relatives-tree]]).
3. Under „Relative”, choose the father; under „What they are to …”, choose „Tată”; press „Add the tie”.
4. The father appears in the drawing above the son, and in „Links” each sees the other (section [[persons-relatives-link]]).

### 3.7.4 Record a telephone call {#persons-example-call}

A person rang to ask about the sale-and-purchase contract for a plot of land in Bragadiru.

1. Open the person.
2. In „Interactions”, press „Log interaction” (section [[persons-interactions]]).
3. Choose „Phone”, type the subject, then press „Save”.
4. The call appears in the person's history and on the „Interactions” screen (section [[reports-interactions]]).
`;
