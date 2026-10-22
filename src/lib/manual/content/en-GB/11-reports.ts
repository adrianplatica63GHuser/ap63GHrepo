/**
 * Manual, en-GB, chapter 11. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 11 Reports {#reports}

The „Reporting” section of the sidebar gathers three screens that look at the archive from above, across all the objects: „Interactions”, the log of contacts with clients; „Inheritance trees”, the archive's families drawn in one place; and „Global Search”, which finds persons, properties and documents from a single screen. Open „Reporting” in the sidebar (section [[start-sidebar]]) and press the screen you want.

## 11.1 Interactions {#reports-interactions}

An interaction is a contact with a client: a phone call, an e-mail, a WhatsApp message, a text message, a meeting or a letter sent by post. The „Interactions” screen, subtitled „The log of contacts with clients”, shows all these contacts in one place, for every client. It is the history alone: here you search and read. A new interaction is recorded on the person's screen, in their „Interactions” tile (section [[persons-interactions]]); the way there starts from this very screen, from the person's name.

### 11.1.1 The history and its filters {#reports-interactions-history}

When you open the screen, „All clients” stands under the title, the period is „Last 90 days”, and the order is „Newest first”. Each row is one interaction, with the columns „Date”, „Channel”, „Direction”, „Person”, „Subject”, „Docs” and „Status”. Above the list you see how many interactions are in the view and how many of them are „Needs reply”.

The toolbar above the list narrows it:

- „Search person or subject…” — type part of the person's name or of the subject.
- „Period” — „Today”, „Last 7 days”, „Last 30 days”, „Last 90 days”, „This year” or „Custom”, with „From” and „To”. An interaction outside the chosen period does not appear.
- The channels — one button each for „Email”, „WhatsApp”, „SMS”, „Phone”, „Meeting” and „Paper mail”. Pressed, the button fills and the list shows only that channel; pressed again, the filter goes.
- „Direction” — „All”, „In”, the contacts that came from the client, or „Out”, those that went out from you.
- „Search person…” — choose a person, and the list shows only their interactions; the bar under the title names them. „Show all clients” takes you back to the whole list.
- „Newest first” — pressed, it becomes „Oldest first” and reverses the order. The order you chose stays even after you reload the page.

A column's header has its own filter too: in „Channel”, „Filter by Channel” opens a list of the channels to tick; in „Docs” you choose „With linked documents” or „Without linked documents”. The header's filter and the toolbar's buttons are the same filter: what you tick in one place shows in the other. An interaction's description is not used for filtering — search by subject.

„Needs reply: …” counts the received interactions still in the status „Needs reply”, that is, the clients who wrote to you or rang you and have not yet had a reply. Pressed, it leaves only those interactions in the list and chooses „In”.

As soon as a filter is set, „Clear filters” appears. Pressed, it puts everything back: the last 90 days, every channel, „All”, the search box empty and „Newest first”.

A click on a row selects it and shows the interaction's description under its subject. Nothing can be typed into the list. When an interaction has linked documents, a paperclip with their number appears in the „Docs” column; pressed, the paperclip lists them, and a click on a document opens it from the archive. The person's name in a row is a link: it opens the person's screen, with the form already open on a new interaction.

### 11.1.2 Recording an interaction {#reports-interactions-log}

On the person's screen, under the history in the „Interactions” tile, press the button „Log interaction”. The form has no box for the person: the interaction belongs to the person on the screen. The form has five sections, each a title followed by an arrow; a click on the title opens the section, a second click closes it. When the form opens, only „Manual entry” is open.

- „Connected accounts” — Gmail and WhatsApp Business, each „Not connected”. The „Connect” buttons do nothing yet: an interaction is recorded by hand, with no account connected, and „Nothing is sent without confirmation.”.
- „Manual entry” — „Channel”, „Direction”, „Status”, „Date and time” (now, by default), „Subject” and „Description”. The subject is what appears in the history and what filtering uses, so keep it short. The description holds the rest; the question written in it changes with the channel — for „Phone”, for instance, „What was agreed?”.
- „Related” — the documents, tags and property linked to the interaction (section [[reports-interactions-links]]).
- „Follow-up” — tick „Set reminder” and choose „Reminder date”. The date is kept and shown in the history; the application sends no notifications.
- „Internal note” — a note „Visible only to your team”.

A closed section that holds something says so after its title, for instance „Related · 1 tag”. One that holds a mistake says the mistake, for instance „Follow-up · Choose the reminder date.”.

The status can be „Logged”, „Needs reply”, „Sent”, „Completed” or „Scheduled”. A date in the future can be chosen only with the status „Scheduled”: otherwise „Future dates are for scheduled items. …” appears.

„Save” does not respond until the form is complete. With no subject, „Add a short subject. This is what the grid will show.” appears. When the mistake is in a closed section, saving opens it and puts the cursor on the field to correct.

- „Save” — „Interaction logged” appears, and the interaction appears first in the person's history.
- „Save and new” — saves and leaves the form ready for the next one, with the same channel and the same direction, the subject empty.
- „Cancel” — if you typed something, it first asks „Discard the interaction you have not saved?”: „Discard it” empties the form, „Keep editing” lets you carry on typing.
- Ctrl+S does the same as „Save”.

„Collapse” folds the form back into its button.

### 11.1.3 Linked documents, tags and a property {#reports-interactions-links}

In the „Related” section you link the interaction to what already exists in the archive.

- „Linked documents” — press „Add link” and find the document in „Search a document”, by title or code. The document is not copied or uploaded again: the interaction only points at it. A document already linked is not offered a second time. The „×” beside a document removes the link.
- „Tags” — press „Add tag”, type the tag and press Enter. A tag used on one interaction is suggested on the next ones.
- „Related property” — find the property in „Search a property”, by nickname or code. It is optional and does not appear in the history. The „×” removes it.

After saving, the interaction's row shows the paperclip and the number of linked documents.

### 11.1.4 Changing and deleting {#reports-interactions-edit}

A click on an interaction in the person's history loads it into the form: the mode moves from „New interaction” to „Edit selected”, and the form shows who created it and who last changed it, and when. Change what is needed and press „Save changes”; „Changes saved” appears, and the history shows the new value.

Nothing you typed is lost without a question. If you choose another row with unsaved changes, the form asks „Discard the changes you have not saved?”. If you leave the screen, the application asks „Unsaved changes”, and „Cancel” keeps you where you are, with what you typed.

If someone else saved the same interaction before you, your save does not go over theirs: „This interaction was updated by someone else. Reload, or overwrite?” appears. „Reload” brings their version; „Overwrite” keeps what you typed.

To delete an interaction, press „Delete interaction”. The question „Delete the interaction?” names the person and the date and says „Linked documents stay in the archive; the person and the property do not change.”. „Delete” deletes it for good: „Interaction deleted” appears, the row goes, and the form returns to „New interaction”.

### 11.1.5 „Export” {#reports-interactions-export}

„Export”, in the toolbar of the „Interactions” screen, downloads the rows the filters show, in the list's order, into a file that opens straight into columns in Excel, with its diacritics in place. The file's name starts with „interactiuni-”, followed by the day's date.

The file's columns are „Date and time”, „Channel”, „Direction”, „Person”, „Subject”, „Description”, „Linked documents”, „Status”, „Follow-up” and „Tags”. The description goes in whole, in a single cell, even when it runs to several lines. The internal note does not go into the file. So set the filters first — a person, a channel, a period — and export afterwards: the file holds exactly what you see.

### 11.1.6 On the person's screen and in „Peek inside” {#reports-interactions-person}

The „Interactions” tile on a person's screen shows the same list, for that person only, with the form under it (section [[persons-interactions]]). „Open in Interactions” takes you to this screen, already narrowed to the person.

From the list of persons, „Peek inside” shows the „Interactions” tile with the history alone, no form. A click on an interaction there opens the person's screen, with the interaction loaded into the form.

## 11.2 Inheritance trees {#reports-inheritance}

„Inheritance Trees” draws, over the whole page, every natural person who has a family tie — a tie with a role marked „Kinship” in „Person Roles” (section [[admin-reference-data]]). The screen is for reading only: relatives are linked from the person's „Inheritance tree” tile (section [[persons-relatives-tree]]) or from „Links” (section [[persons-relatives-link]]). When there is no family tie yet, the screen tells you where to choose „Kinship”.

The tree shows no CNP, identity card or address: each person is shown only by name, nickname, gender, date of birth and, where it applies, the death.

### 11.2.1 The drawing, the levels and the search {#reports-inheritance-levels}

The generations read from top to bottom: the grandparents on one row, the parents under them, the children further down. Husband and wife stand side by side, and a child under its parents. Each family has its own lane, apart from the others; above the tree it says how many persons and how many families are drawn.

The tree has three levels, and its bar tells you which one you are on: „Level … of 3 — the wheel zooms, a drag pans”.

- Level 1 — a dot and the first name, so that you see a large family at a glance.
- Level 2 — the name and the year of birth, for instance „b. 1982”.
- Level 3 — the name, the date of birth and the gender, for instance „b. 15.01.1982 · woman”, and the family ties.

Turn the mouse wheel over the tree to go from one level to another, and drag with the mouse to move it about the page.

To reach a person, type their name into „Find a person…” and press „Find”: the tree centres on them, at the nearest level, and their card opens alongside. When the name is not in the tree, „No person by that name in the tree.” appears.

When you hold the mouse over a person, a small card shows their name, their date of birth and how many family ties they have. A click on them opens the side card, with „Open” and „Close”. Any name opens the person's screen, with the relatives' panel of the „Inheritance tree” tile already open — from there you add or remove a relative.

A person marked „Deceased” has „†” after the name and the years of their life under it, for instance „1955–2010”.

From a person's „Inheritance tree” tile, „Open the whole tree” opens this screen centred on them.

### 11.2.2 The documents in the tree and „Shared documents” {#reports-inheritance-documents}

From the middle level, each person who appears on documents carries a badge with their number, for instance „1 document”. A click on the badge opens „Documents … is on”, with each document: its type, number and date, for instance „no. 123/2001 · of 02.05.2001”. A click on a document opens it.

„Shared documents”, off at first, puts on the line between two relatives how many documents both of them are on. A click on the number opens „Shared documents: … and …”, with the list of those documents. So you see at once, for instance, the contract on which both the father and the daughter appear.

### 11.2.3 The family over time: „Year” {#reports-inheritance-year}

„Year” starts at „today”. Move it to a year in the past and the tree shows the family as it was then: whoever was born after the chosen year appears faded, and whoever had died by then carries „†”. A person who died later is not marked as deceased in the chosen year.

## 11.3 Global search {#reports-search}

„Global search” searches from one place across all three kinds of object: persons (natural and legal), properties and documents (Figure [[fig-reports-search]]). It is where you search when you do not know which list holds what you are after, or when you want to see together everything that carries a name, a tag or a stamp.

![11.1 „Global search”, with the results of a search](reports-search.png){#fig-reports-search}

### 11.3.1 The filters {#reports-search-filters}

Fill in one or more filters, then press „Search”. All the filters set apply together (AND): a result must meet every one of them. For example, „Entity type: Property” together with „Tag: priority” finds only the properties tagged „priority” — not the persons with that tag, nor the properties without it. The explanation under the screen's title gives the same example.

The filter boxes are narrow, several to a row. Each shows a short example inside it, for instance „Popescu”; rest the mouse on the box and you read it whole, for instance „e.g. Popescu or PPERS00012”.

- „Name / code search” — part of a name or of a code, for instance „Popescu”.
- „Entity type” — „Any”, „Person”, „Property” or „Document”. „Person subtype” chooses between „Natural person” and „Juridical person”.
- „Importance”, „Relevance” and „Provenance” — the values in the object's „Classification” tile (section [[links-classify-classification]]). „Provenance” says how the object came into the archive, for instance „Manual (Add new)” for one typed in by hand.
- „Group code”, „Stamp code” and „Tag” — the groups, stamps and tags in the „Tags and groups” tile (sections [[links-classify-groups]], [[links-classify-stamps]] and [[links-classify-tags]]).
- „Has metadata”, with „Metadata updated from” and „Metadata updated to”.

„Reset” empties every filter and hides the results.

### 11.3.2 The results {#reports-search-results}

Above the table it says how many results were found, for instance „3 results”. The columns are „Type”, „Name”, „Groups”, „Stamps”, „Importance”, „Relevance”, „Provenance”, „Updated by” and „Metadata updated”. „Type” says „Person”, „Property” or „Document”. A property is named by its tarla and parcel, with its nickname in brackets.

At most 50 results are shown for each kind of object, 15 to a page. When there are more, the screen says so and asks you to narrow the search — add a filter.

When nothing matches, „No entities match the selected filters.” appears.

## 11.4 Examples and use cases {#reports-examples}

### 11.4.1 Answer the clients who are waiting {#reports-example-reply}

In the morning you want to see who wrote to you or rang you and is still waiting for a reply.

1. Open „Reporting” → „Interactions” (section [[reports-interactions-history]]).
2. Press „Needs reply: …”. Only the received contacts you have not answered remain.
3. Press the person's name in a row. Their screen opens, with the form ready.
4. Once you have rung them, choose „Phone” and „Sent”, type the subject and press „Save” (section [[reports-interactions-log]]).
5. In their history, press the interaction that was waiting, choose „Completed” under „Status” and press „Save changes” (section [[reports-interactions-edit]]).

### 11.4.2 Send the calls with a client in an Excel file {#reports-example-export}

A person asks you for the list of every phone call of the last month about a plot of land in Bragadiru.

1. On the „Interactions” screen, under „Search person…”, choose the person (section [[reports-interactions-history]]).
2. Under „Period”, choose „Last 30 days”, then press the „Phone” button.
3. Check the rows in the list: exactly these go into the file.
4. Press „Export” and open the file in Excel (section [[reports-interactions-export]]). The internal notes are not in it.

### 11.4.3 Find the documents a father and his daughter share {#reports-example-family}

You are preparing a succession and want to see on which documents the late father and his daughter appear together.

1. Open „Reporting” → „Inheritance trees” and search for the father in „Find a person…” (section [[reports-inheritance-levels]]).
2. Switch „Shared documents” on and press the number on the line between father and daughter (section [[reports-inheritance-documents]]).
3. Press a document in the list, for instance a contract of sale, to open it.
4. Move „Year” to the contract's year, to see who was alive then (section [[reports-inheritance-year]]).

### 11.4.4 Gather everything that carries a tag {#reports-example-tag}

You have tagged a few persons, plots of land and documents „priority” and want to see them all in one place.

1. Open „Reporting” → „Global Search” (section [[reports-search-filters]]).
2. Type „priority” under „Tag” and leave „Entity type” on „Any”.
3. Press „Search”. The persons, properties and documents appear in the same table (section [[reports-search-results]]).
4. To see only the plots of land, choose „Property” under „Entity type” and press „Search” again.
`;
