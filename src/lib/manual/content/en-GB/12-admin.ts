/**
 * Manual, en-GB, chapter 12. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 12 Administration and Settings {#admin}

This chapter is for whoever looks after the archive: the lists the other screens choose from, colleagues' accounts, groups, stamps and tags, the help texts and the application's settings. Its screens are in the sidebar: in the „Administrare” (administration) section — „Date de referință”, „Utilizatori & Acces”, „Grupuri”, „Ștampile”, „Etichete” —, in „Setări” (settings) and, for the help texts, in „Ajutor și învățare” (help and learning).

## 12.1 Reference data {#admin-reference-data}

„Date de referință” (reference data) holds the archive's vocabulary: nearly every list you choose a value from on a screen — the type of a property, a person's citizenship, the type of a document, a person's role in a document — is filled from here. You open it from „Administrare” → „Date de referință”.

The screen is a single page (Figure [[fig-admin-value-lists]]). On the left are the lists, in three groups; on the right, the chosen list. Until you choose one, the right side reads „Alegeți o listă din stânga.” (choose a list on the left). The chosen list stays marked on the left, and the browser's back button takes you to the list you had before.

![12.1 „Date de referință”](admin-value-lists.png){#fig-admin-value-lists}

| Group | The lists |
|---|---|
| Tipuri de obiecte (object types) | „Tipuri de Persoană Fizică”, „Tipuri de Persoană Juridică”, „Tipuri de Proprietate”, „Tipuri de Document” |
| Roluri și legături (roles and links) | „Roluri Persoane”, „Legături Proprietate → Proprietate”, „Legături Document → Document” |
| Liste de valori (value lists) | „Indicative Tarla”, „Categorii Folosință”, „Cetățenie”, „Instituții” |

Every row stands on a single line. A value too long for its column ends in „…”; hold the mouse over it and you see it whole. In a long list only the rows scroll: the column titles stay at the top.

### 12.1.1 The values of a list {#admin-reference-data-values}

Above the table are „Adaugă” (add) and the number of values, for instance „8 valori” (8 values). On each row are „Editează” (edit), „Unește” (merge) and „Șterge” (delete).

The „Folosit de” (used by) column says how many records use the value: „1 obiect”, „2 obiecte” (1 object, 2 objects). A value that nothing uses reads „nefolosit” (unused), in grey, and stands after the values in use.

- **A new value.** „Adaugă” opens „Adaugă o valoare nouă” (add a new value). Fill in „Denumire” (name) — it is required — and the list's other fields, then press „Salvează” (save). The new value appears last in the list.
- **A value renamed.** „Editează” opens „Editează valoarea” (edit the value), with the current value. Change it and press „Salvează”.
- **Two values merged.** When the same value has got into the list twice, spelt differently, press „Unește” on the one that should go. The window „Unește „…” cu altă valoare” (merge … with another value) says how many records move, for instance „Un obiect se mută pe valoarea păstrată:” (one object moves to the value kept). Choose the value that stays in „Valoarea păstrată” (the value kept) and press „Unește”. The records move to the value kept, and the other disappears from the list.
- **A value deleted.** „Șterge” asks „Ștergeți „…”?” (delete …?) and first checks what depends on the value: „Se verifică ce depinde de această valoare…” (checking what depends on this value). If nothing does, it reads „Nimic nu depinde de această valoare. La ștergere dispare definitiv — acțiunea nu poate fi anulată.” (nothing depends on this value; once deleted it is gone for good — this cannot be undone); „Șterge” deletes it, „Anulează” (cancel) gives up. If records use it, the window says how many, and deleting is not possible until you move them onto another value: choose it under „Mutați-le pe:” (move them to) and press „Mută” (move).

Old versions of the records do not change: each keeps the value as it was when it was saved (section [[links-versions]]).

### 12.1.2 Roles and links {#admin-reference-data-roles}

„Roluri Persoane” (person roles) holds the roles a person can have: in a document („Vânzător”, „Cumpărător” — seller, buyer), on a property, or towards another person. The list's columns:

- „Denumire” — the role's name; you read its description by holding the mouse over the name.
- „Persoană → Proprietate” and „Persoană → Persoană” (person to property, person to person) — a ✓ says the role can be chosen on that link. On kinship roles the kinship stands in place of the ✓, for instance „Părinte” (parent) or „Copil” (child).
- „Rol invers (bărbat, femeie)” (converse role, man, woman) — how the role reads from the other end of the link, separated by commas, for instance „Vânzător, Vânzătoare” (section [[links-associate-role]]).
- „Folosit de” — how many records use it.

„Editează” opens the role's panel. It holds the name, the converse names — „Rol invers”, „Rol invers — bărbat”, „Rol invers — femeie” — and „Se aplică la” (applies to), with three buttons: „Act” (document), „Proprietate” (property) and „Persoană” (person). „Proprietate” offers the role on the link between a person and a property, „Persoană” on the link between two persons. While „Persoană” is pressed, the panel also shows „Rudenie” (kinship): „Părinte”, „Copil”, „Soț/soție”, „Frate/soră”, „Altă rudă” (parent, child, spouse, sibling, other relative) or „Nicio rudenie” (no kinship). On a role that the import of an identity card looks for, the kinship cannot be changed, and the panel says why.

„Act” opens „Tipuri de act” (document types): the types of document the role is offered on. Choose a type in „Adaugă un tip de act” (add a document type) and press „Adaugă tipul” (add the type). Each type in the list has:

- „Deține cotă” (holds a share) — ticked, the role brings the share onto the link (section [[documents-parties]]); the tick is saved at once;
- how many links already use it, for instance „1 legătură” (1 link);
- „Scoate „…”” (remove …) — the role is no longer offered on that type. Links already made stay, but the role can no longer be chosen for that type of document.

A new role is saved first; only then can its document types be chosen.

Above the three lists of „Roluri și legături” stands the tile „Cum se leagă obiectele între ele” (how objects link to one another): a triangle with „Persoană”, „Proprietate” and „Document” at its corners. A corner means a link between two objects of the same kind, a side a link between two kinds. Beside the drawing, the six links are numbered as in the drawing and explained, each with „Vezi:” (see) and the place where it is configured. A click on a number or a name opens that list. The „Document – Proprietate” side is dotted and opens nothing: the link has no list, because the document's type says what it means. The ⓘ button after notes 5 and 6 shows, step by step, how the link is made.

„Legături Proprietate → Proprietate” and „Legături Document → Document” hold the directed links between two properties and between two documents, for instance „Inclus în” (included in) or „Titlu anterior al” (prior title of) (section [[links-references]]).

### 12.1.3 Document types {#admin-reference-data-document-types}

„Tipuri de Document” has the columns „Denumire”, „Denumire scurtă” (short name), „Stare” (status) and „Folosit de (n obiecte)”. „Stare” says where the type comes from and whether it has a form: „Adăugat manual” (added by hand), „Creat la import” (created at import) or „Are formular” (has a form). Hold the mouse over a type's name and the bubble shows the full name, with the type's key under it, for instance „CONTRACT_VANZARE”.

Above the table are two ticks: „Cu formular” (with a form) shows only the types that have a form, „Fără formular” (without a form) only those that do not. Both ticked, or neither, shows every type. When an import stops at a type without a form, its link opens the list with „Fără formular” ticked (chapter [[import]]).

„Deschide” (open), on a type's row, opens the type's page, with three tabs:

- „General” — „Denumire”, „Denumire scurtă”, „Cod” (code) and „Stare”, with „Salvează”. The code can only be read: „Codul nu se schimbă: formularele exportate, cererea către AI și testele îl folosesc.” (the code does not change: exported forms, the request to the AI and the tests use it). The short name is the one in the „Tip” column of the documents list (section [[documents-list]]).
- „Formular” (form) — the fields of the documents of this type (section [[documents-identification]]). Without a form, the tab reads „Acest tip nu are încă formular.” (this type has no form yet) and offers „Creează formularul” (create the form); with one, „Editează formularul” (edit the form), with the number of fields. Each field has a label in Romanian and one in English. The key under the label is set when the field is added and never changes, so a label can be renamed without worry. The identity card and the catch-all type for unclassified documents cannot have a form.
- „Roluri” (roles) — the roles a person can have in a document of this type. Choose a role in „Adaugă un rol” (add a role) and press „Adaugă rolul” (add the role); tick „Deține cotă” where the role brings a share.

A type's „Roluri” tab and „Act” on a role's panel show the same pairs, from two ends: a role added on a type also appears on the role's panel, with its tick. „← Tipuri de Document” takes you back to the list.

## 12.2 Users and access {#admin-users}

A colleague without an account asks for access from the sign-in page (section [[start-sign-in]]). The request arrives in „Administrare” → „Utilizatori & Acces” (users and access), where the screen says: „Revizuiți și gestionați cererile de cont. Aprobarea creează un cont și trimite solicitantului parola temporară pe email.” (review and manage account requests; approving creates an account and e-mails the applicant a temporary password).

The screen has two tabs:

- „Cereri în așteptare” (pending requests), with the number of requests in its title. Each row shows „Utilizator” (user), „Email” and „Trimis la” (sent at), and under „Acțiuni” (actions) the buttons „Aprobă” (approve) and „Respinge” (refuse). With no requests, the tab reads „Nu există cereri în așteptare.” (there are no pending requests).
- „Istoric” (history) — the requests that have been answered, with „Stare” („Aprobat” or „Respins” — approved or refused), „Procesat la” (processed at) and „De” (by), that is, who answered.

„Aprobă” creates the account and e-mails the colleague the temporary password; the screen confirms with „Cont creat și email trimis.” (account created and e-mail sent). „Respinge” refuses the request and tells the applicant: „Cerere respinsă și solicitantul notificat.” (request refused and the applicant notified). Either way the request leaves „Cereri în așteptare” and stays in „Istoric” for good. If the e-mail could not be sent, the message says so in brackets; the account, or the refusal, has been recorded all the same.

An approved account cannot be deleted from the application, so approve only the requests you recognise. The colleague can change the temporary password themselves, in „Setări” → „Contul meu” (section [[admin-settings-account]]).

## 12.3 Groups, stamps and tags {#admin-groups}

Groups, stamps and tags are put on records from each record's „Etichete și grupuri” (tags and groups) tile (section [[links-classify]]). Here are the screens that hold them all together.

### 12.3.1 Groups {#admin-groups-groups}

„Administrare” → „Grupuri” (groups) shows the panel „Ce este un Grup?” (what is a group?), „Adaugă”, the number of groups, for instance „4 grupuri”, and the table „Cod” · „Descriere” (code, description). Each row has the group's code, with the number of members in brackets, the kind of records it gathers, the description, „Editează” and „Șterge”.

1. „Adaugă” opens „Adaugă grup nou” (add a new group). Choose „Țintă” (target) — „Proprietate”, „Persoană fizică”, „Persoană juridică” or „Document” —, write „Descriere” and press „Salvează”. You stay on the list, with the new group first; the code, of the form GRP-001, is given on saving.
2. „Editează” opens „Grup GRP-…”, with three tiles: „Identitatea grupului” (the group's identity: „Țintă” and „Cod” read-only, „Descriere”), „Membri disponibili pentru includere” (members available to include) and „Deja în grup” (already in the group).
3. Search in „Caută…” (search), tick the records and press „Adaugă în grup” (add to group); to take one out, tick it in „Deja în grup” and press „Elimină din grup” (remove from group). Members added carry „[nou]” (new), and the screen shows „Modificări nesalvate” (unsaved changes): nothing has been written yet.
4. „Salvează grupul” (save the group) writes the changes; „[nou]” becomes the member's position in the group, „[01]”, „[02]”.

The screen's tiles can be moved by dragging them by an empty spot, and „Implicit” (default), at the top right, puts them back. „Șterge” on a group's row asks „Ștergeți acest grup? Această acțiune nu poate fi anulată.” (delete this group? this cannot be undone); the records in the group stay in the archive.

### 12.3.2 Stamps {#admin-groups-stamps}

„Administrare” → „Ștampile” (stamps) shows the panel „Ce este o Ștampilă?” (what is a stamp?), the number of stamps and the table „Ștampilă” · „Elemente” (stamp, items): each row has the stamp's code and description, its note, how many records carry it, „Aplică” (apply) and „Șterge”.

1. The „+” button, „Creare ștampilă” (create a stamp), opens the form: „Descriere scurtă” (short description; required, at most 200 characters) and „Note” (notes). The code, of the form STMP-AAA, is given on saving. „Salvează” leaves you on the list, with the new stamp first.
2. „Aplică” opens „Aplică ștampila: …” (apply the stamp), with four tiles: „Descrierea ștampilei” (the stamp's description), „Tip element” (item type), „Elemente disponibile pentru ștampilare” (items available for stamping) and „Elemente deja ștampilate” (items already stamped).
3. Choose the kind of records in „Tip element”; the lists show only records of that kind. Tick them and press „Aplică ștampila” (apply the stamp), or, in the other list, „Elimină ștampila” (remove the stamp). The screen shows „Modificări nesalvate”.
4. „Salvează ștampilele” (save the stamps), the floppy-disk button, writes the changes. A stamp can sit on records of different kinds: change „Tip element” and carry on.

As with groups, the tiles are moved by dragging, and „Implicit” puts them back. „Șterge” asks „Ștergeți această ștampilă și o eliminați de pe toate elementele?” (delete this stamp and remove it from every item?): the stamp disappears from the records as well, and the records stay.

### 12.3.3 Tags {#admin-groups-tags}

„Administrare” → „Etichete” (tags) shows „Nor de etichete” (tag cloud): every tag in the archive, how many distinct ones there are and, on each, how many times it is used, for instance „×1”. The most used are larger. When they do not fit in the window, only the tags scroll; the title and the buttons stay at the top.

A double click on a tag selects it, and a second one deselects it; a selected tag appears pressed.

- With one tag selected, „Redenumește etichetă” (rename tag) turns it into a box right in the cloud. Type the new name and press Enter, or Esc to leave it as it was. The name is written in lower case; if the new name already exists, the two tags are combined.
- With two or more selected, „Fuzionează etichete” (merge tags) opens „Fuzionare etichete” (merging tags), with them ticked. Choose „Păstrează aceasta” (keep this one) on the tag that stays; the window says what will happen, for instance „Etichetele „arenda” vor deveni „arendă”.” (the tags „arenda” will become „arendă”). Press „Fuzionează” (merge).

With no tag selected, both buttons are inactive.

## 12.4 Help information {#admin-help}

The texts behind the „?” button and the light-bulb hints on the screens (section [[start-help]]) are not fixed: the administrator writes them, in „Ajutor și învățare” → „Informații de ajutor” (help information). The screen has two tabs, „Ecrane” (screens) and „Sfaturi rapide” (quick hints).

„Ecrane” shows the list of the application's screens, for instance „Administrare — Etichete” or „Proprietăți — Listă”, each with „Complet” (complete) or „Lipsă” (missing). Choose a screen and fill in the four fields:

| The field | What you write |
|---|---|
| Context (Română) | what the screen is for (context, Romanian) |
| Cum se folosește (Română) | what you do on it, step by step (how to use it, Romanian) |
| Context (Engleză) | the same context, in English |
| Cum se folosește (Engleză) | the same instructions, in English |

„Previzualizare” (preview) shows the text as it will appear, as you type. „Salvează” saves it, and the screen confirms with „Salvat” (saved). From then on, the „?” on that screen opens the „Ajutor” (help) panel, with „Context” and „Cum se folosește”, as you wrote them, and under them „Vezi în manual” (see in the manual), with the section of this manual that describes the screen. A screen marked „Propunere” (proposal) has a text proposed from the manual, which you accept, edit or set aside (section [[learning-help-proposals]]).

„Sfaturi rapide” holds the light-bulb hints: choose a hint from the list and write its text in „Text sfat (Română)” and „Text sfat (Engleză)” (hint text, Romanian and English). A hint that stands on several screens says „Apare pe … ecrane — textul se salvează pe toate.” (appears on … screens — the text is saved on all of them).

## 12.5 Settings {#admin-settings}

„Setări” opens from the sidebar (Figure [[fig-admin-settings]]). As on a record's screen, the boxes at the top choose which parts are shown, and „Implicit” brings them back (section [[start-tiles]]). The parts are „Contul meu” (my account), „Praguri de timp” (time thresholds), „Copii de siguranță” (backups), „Despre” (about) and, in the „Costuri” (costs) group, one for each provider that can cost money.

![12.2 „Setări”](admin-settings.png){#fig-admin-settings}

### 12.5.1 „Contul meu” {#admin-settings-account}

„Contul meu” holds what is yours, not the archive's:

- **The password.** Type the new password in „Parola nouă” (new password) — at least 8 characters — and once more in „Confirmă parola” (confirm the password), then press „Schimbă parola” (change the password). The application confirms with „Parola a fost schimbată!” (the password has been changed). If the two do not match, it says „Parolele nu coincid.” (the passwords do not match).
- **The language.** Under „Limba” (language) choose „Română” or „English”.
- **„Implicitele mele”** (my defaults). For each kind of record — „Persoană fizică”, „Persoană juridică”, „Proprietate”, „Act” — tick the tiles you want „Implicit” to show on its screen and press „Salvează”; „Salvat.” appears. The set belongs to the account, not to the browser, so it stays after a reload, and in any browser. „Revino la implicit” (back to the default) forgets your set and brings back the application's usual one: „Revenit la implicit.” (back to the default). At least one tile stays ticked.

„Ieșire” (sign out) is at the bottom of the sidebar.

### 12.5.2 „Praguri de timp” {#admin-settings-thresholds}

„Praguri de timp” holds ten numbers that decide when something is „new”, „soon” or „old”, in four groups: „Tablou de bord” (dashboard), „Acte” (documents), „Persoane” (persons) and „Insigna „Nou!”” (the „Nou!” badge). Each threshold has a name, a sentence, a number with its unit and an example. The example changes at once, with the number you type: on „Fereastră filtru expiră curând” (expiring-soon filter window), with 30 it reads „Exemplu: Un act apare «expiră curând» cu 30 de zile înainte.” (example: a document shows „expiring soon” 30 days before), and with 45, „… cu 45 de zile înainte.”.

Among other things, the thresholds decide:

- how many days back „Recente” (recent) counts on „Tablou de bord”, and how many days ahead it shows the documents that expire;
- how long before a document shows „expiră curând” (expiring soon);
- how long before its expiry an identity card is flagged („Prag CI expiră curând”, the identity-card expiring-soon threshold);
- how long a changed record carries the „Nou!” badge, red and then amber, and after how long the badge disappears.

As soon as you change a number, „Anulează” appears beside „Salvează” and brings back the saved value. „Salvează” confirms with „Salvat cu succes.” (saved successfully). The values are whole numbers between 1 and 3650. The thresholds belong to the archive, not to an account: a change is seen by every user.

### 12.5.3 „Costuri” {#admin-settings-costs}

The „Costuri” group has one part for each provider that can cost money: „AI”, „Abonament Claude” (Claude subscription), „Google Maps”, „Street View”, „Adrese căutate” (address look-ups), „Supabase”, „Vercel”, „Resend (e-mail)”, „GitHub”, „Domeniu web” (web domain) and „Testare” (testing). Each opens collapsed to one line, in CA$: „Luna aceasta: … · prognoză: …” (this month: … · forecast: …). On „AI” the line starts with „Estimat luna aceasta” (estimated this month), because there the cost is an estimate.

„Detalii” (details) opens the part, and „Restrânge” (collapse) folds it back. Open, it shows:

- „Ce se plătește” (what is paid for), „Gratuit” (free) — what the provider gives without charge — and „Cum se plătește” (how it is charged), with „Prețuri verificate la …” (prices checked on …) and a link to „pagina de prețuri a furnizorului” (the provider's pricing page);
- „Luna aceasta, până azi” (this month, to date), „Prognoză la sfârșitul lunii” (forecast at the end of the month) and „Costul în timp” (cost over time);
- on „AI”, what the application uses paid reads for — for instance „Extragerea datelor din acte” (extracting data from documents) — and the model of each;
- on „Street View” and „Adrese căutate”, the month's use against the free part; what comes from people is an estimate, and the screen says so.

Where an amount comes from an invoice, you enter it under „Sume introduse” (amounts entered): „De la” (from), „Până la” (to), „Suma” (amount), „Moneda” (currency), „Curs în CA$” (rate in CA$) and, if you like, „Notă” (note), then press „Adaugă o sumă” (add an amount). The new row shows the amount and its CA$ equivalent, and the month's figures count it. „Șterge suma” (delete the amount) takes it out.

### 12.5.4 „Copii de siguranță” and „Despre” {#admin-settings-about}

„Copii de siguranță” can only be read: „Ultima copie” (the last backup) and „Ultima probă de restaurare” (the last restore check), with its result. On an installation that cannot read them, the part says so in one sentence. „Despre” shows „Versiune” (version), „Commit”, „Mediu” (environment) and „Bază de date” (database): copy them when you report a problem.

## 12.6 Examples and use cases {#admin-examples}

### 12.6.1 Merge a land-use category entered twice {#admin-example-merge}

In „Categorii Folosință” (land-use categories) there are two values that say the same thing, spelt differently.

1. Open „Administrare” → „Date de referință” and choose „Categorii Folosință” (section [[admin-reference-data]]).
2. Read „Folosit de” on the two rows and decide which value stays.
3. Press „Unește” on the other, choose the first in „Valoarea păstrată” and press „Unește” (section [[admin-reference-data-values]]).
4. Check that the merged value has gone and that „Folosit de” on the value kept has grown.

### 12.6.2 Offer a role with a share on a document type {#admin-example-role}

On a sale-purchase contract you want to choose a role that is not yet offered on this type, with its share.

1. In „Date de referință”, open „Tipuri de Document” and press „Deschide” on „Contract de Vânzare” (section [[admin-reference-data-document-types]]).
2. On the „Roluri” tab, choose the role in „Adaugă un rol” and press „Adaugă rolul”.
3. Tick „Deține cotă” on its row.
4. Open „Roluri Persoane” and press „Editează” on the role: under „Act”, the contract appears with „Deține cotă” ticked (section [[admin-reference-data-roles]]).
5. On a contract, associate a person with this role; their row in „Legături” has „Cotă” (section [[documents-parties]]).

### 12.6.3 Give a new colleague access {#admin-example-access}

A colleague has asked for access from the sign-in page.

1. Open „Administrare” → „Utilizatori & Acces”, the „Cereri în așteptare” tab (section [[admin-users]]).
2. Check the name and e-mail on the row and press „Aprobă”.
3. Tell the colleague to look for the temporary password in their e-mail and to change it in „Setări” → „Contul meu” (section [[admin-settings-account]]).
4. On the „Istoric” tab, the request shows „Aprobat”, with the day and your name under „De”.

### 12.6.4 Change a threshold and put it back {#admin-example-threshold}

You want documents to show „expiră curând” earlier, for a month of checks.

1. Open „Setări”, the „Praguri de timp” part (section [[admin-settings-thresholds]]).
2. Note the current value of „Fereastră filtru expiră curând”.
3. Type the new value and read the example under it; press „Salvează” and wait for „Salvat cu succes.”.
4. After the month, type the noted value back and press „Salvează”. Reload the page and check that it has stayed.
`;
