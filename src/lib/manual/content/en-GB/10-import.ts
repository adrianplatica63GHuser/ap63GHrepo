/**
 * Manual, en-GB, chapter 10. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 10 Import {#import}

The import brings a whole file from the computer into the archive: one folder for each property, with the scans of its documents, its coordinate file and the identity cards of the people in those documents. From it come the documents, the properties with their corners and, with your confirmation, the persons. This chapter says what you decide at each step, and why.

## 10.1 How an import runs {#import-overview}

In the sidebar, open „Import”, then „Dosare de proprietăți” (property files). The „Import” screen shows the steps at the top, on two lines (Figure [[fig-import-steps]]):

| Line | Steps |
|---|---|
| Pregătire și verificare (preparation and checking) | „Informare”, „Precondiții”, „Structură”, „Restricții”, „Duplicate” |
| Clasificare și import (classification and import) | „Deja în sistem”, „Scanare”, „Evaluare”, „Import”, „Rezultat” |

The first five steps look only at the chosen folder; from „Deja în sistem” (already in the system) onwards, the system looks at the archive too.

![10.1 The import at its first step: the two lines of steps](import-steps.png){#fig-import-steps}

„Informare” (information) says, in the box „Cum decurge importul” (how the import runs), what holds for everything after it:

- **The system does not touch your files.** It never moves, renames or deletes them. When it finds something to put right, it stops and tells you what; you make the change in File Explorer, come back and press the check button again. That is not a fault — this is how the import is designed.
- Nothing enters the archive until the „Import” step, and until then you can give up at any time.

Press „Am înțeles” (I understand). „Precondiții” (preconditions) checks eight things by itself — among them, that the browser can open a folder on the computer (Google Chrome or Microsoft Edge) and that you have import rights. A row marked „problemă” (problem) says what to do; whatever belongs to the system is fixed by the administrator.

Every checking step works the same way: read the rules, tick that you have read them, press the check button. The tick is asked for again at every check, so also after every fix. The step's „Salvează … ca pagină” (save … as a page) button downloads the rules and the list of things to put right, so that you have them in front of you while you work in File Explorer.

### 10.1.1 The two ticks at the top of the screen {#import-overview-ticks}

Both are ticked when you open the import:

- „Oprește-te după fiecare pas” (stop after every step) — the import stops after each step with nothing to put right and goes on when you press „Continuă la pasul „…”” (continue to the „…” step). Nothing is spent while you read. Unticked, it passes over those steps by itself.
- „Începe fiecare pas cu regulile la vedere” (start every step with the rules in view) — each step opens with its rules showing, and after the check they fold away, so that what you have to put right stays in front. „Arată regulile” and „Ascunde regulile” (show / hide the rules) change that at any time.

For your first imports leave both ticked: that way you see everything that happens.

### 10.1.2 „Renunță la import” {#import-overview-cancel}

„Renunță la import” (cancel the import), at the top, stops the import at any step and takes you back to „Informare”; it is also how you choose another folder once an import has started. First it asks „Renunțați la import?” (cancel the import?) and says what is left behind: the files on the computer stay untouched; whatever was classified is lost and, if you start again, paid for again; documents and properties already created stay in the archive. „Da, renunț la import” (yes, cancel) cancels, „Nu, continui importul” (no, carry on) leaves you where you were.

## 10.2 What the folder must look like {#import-folder}

At the „Structură” (structure) step you choose the folder. Read the rules, tick „Respect regulile de structură” (I follow the structure rules) and press „Alege folderul…” (choose the folder…), then choose the folder in the Windows window. The check answers „Structura folderului este în regulă.” (the folder's structure is in order) or lists the things to put right, each with the folder concerned and what to do.

### 10.2.1 The structure rules {#import-folder-structure}

| Where | The rule |
|---|---|
| The chosen folder | Holds only folders: one for each property, plus, if you need them, „comune” and „flotante”. No file directly in it. The number of properties has a limit, written in the rule. Two folders may not mean the same property. |
| A property folder | Its name is the tarla, a dash, the parcel and, if you like, another dash and a description. „per” stands for the „/” sign, which a folder name cannot contain: tarla 40, parcel 212/40 is written „40-212per40”. At most one coordinate file, a .txt whose name starts with „coord”; without one, the property is created with no outline. |
| A page folder | The pages of a scanned document sit in a subfolder whose name is the document's title. It holds only files named with just a number — 1.jpg, 2.jpg, 3.jpg — with no two the same and no gaps. |

A file lying directly in the property folder is a document in its own right, with its file name as the title.

When the structure is in order, „Cum a fost citit numele fiecărui folder de proprietate” (how each property folder's name was read) shows the tarla, the parcel and the rest of the name. Look at it: the documents' tag is made from that same name. If it is not what you expected, rename the folder and check again. A name without „per”, such as „48-50D”, becomes the question „Acest folder este o proprietate?” (is this folder a property?): answer „Da, este o proprietate” (yes, it is a property) or „Nu este o proprietate” (it is not a property).

### 10.2.2 Files refused and files ignored {#import-folder-files}

„Restricții” (constraints) checks the same folder: tick „Am citit restricțiile privind fișierele” (I have read the file constraints) and press „Verifică fișierele” (check the files). Scans, photographs, PDFs, Word, Excel and OpenOffice documents and text files are imported. These are refused, and must be replaced or taken out of the folder:

- .csv tables — save them as PDF;
- iPhone photographs (.heic) — copy them off the phone again, as .jpg;
- files the system does not recognise, for example with no extension;
- empty files, of 0 KB, and those over the size limit written on the screen;
- a scan named „folder.jpg”, a name Windows uses for the folder's icon.

Windows system files, hidden files, drawings, archives and backup copies are ignored, without stopping you. Word and Excel files are kept, but their content cannot be read or searched.

### 10.2.3 The „comune” and „flotante” folders {#import-folder-shared}

- „comune” (shared) — documents that concern every property in the import; each is linked to every property.
- „flotante” (floating) — documents that concern no property; they are saved with their tags, but unlinked.

Neither is required. They are spelt exactly so, in small letters („Comune” is a mistake the check points out), and they hold no coordinate files.

## 10.3 Duplicates and „Deja în sistem” {#import-duplicates}

„Duplicate” compares the files in the chosen folder with each other; „Deja în sistem” compares the folder with the archive.

### 10.3.1 Copies inside the folder {#import-duplicates-copies}

Tick „Am citit ce se consideră duplicat” (I have read what counts as a duplicate) and press „Caută duplicate” (look for duplicates). The system finds the same file more than once — by name and size, ignoring the „ - Copie” that Windows adds — and the same document in two page folders, by its pages, even when the folders are named differently. It says the files look alike, not that they are: look at them before taking anything out. Keep the copy in the right place; if they are different documents, rename one.

### 10.3.2 Documents already in the archive {#import-duplicates-archive}

Tick „Am citit ce se întâmplă cu documentele care se află deja în sistem” (I have read what happens to documents already in the system) and press „Vezi ce se află deja în sistem” (see what is already in the system). This step stops nothing: it only says what will happen.

A document is already in the system when the archive holds one brought in under the same name — the file's or the page folder's — and with the same files, of the same sizes. Then:

- if it sits in a property folder, the archived document is linked to the property, not imported a second time; otherwise nothing happens to it;
- an identity card is imported anyway: the one in the archive may have expired, and a person twice is less harm than a person missing — check the persons after the import;
- the coordinate file is imported anyway, because every corner has to show which document it was read from.

Each row shows the code and the title of the archived document. If it is not the one you had in mind, rename the file or the page folder and it will be imported as a new document. What is already in the system is neither sent for classification nor read, so a re-import costs little.

Below the list, the screen says how many images the next button will send for classification: „acesta este primul pas care costă” (this is the first step that costs). Further down, „De verificat înainte de a continua” (to check before going on) shows the ignored files and the remarks about the folder; read it, because some remarks say not to start the import.

## 10.4 Scanning, and what the AI reads {#import-scanning}

The AI works twice in an import: at „Scanare” (scanning) it recognises each document's type, and after „Importă” (import) it reads each document and fills in its form. A document added by hand does not go through this reading.

### 10.4.1 Classification, at „Scanare” {#import-scanning-classify}

Only the first page of each document is sent, enough for its type to be recognised. Word, Excel and text files, and those already in the system, are not sent. The table „Cale” · „Descriere AI” · „Status” (path · AI description · status) shows, as they arrive, the type recognised, the confidence („Încredere ridicată”, „Încredere medie”, „Încredere scăzută” — high, medium, low) and the state: „Scanat” (scanned), „Nescanabil” (not scannable) or „Deja în sistem”. A page folder is a single row, with „Grup de 3 pagini” (group of 3 pages), for example. Nothing enters the archive yet. Where the confidence is low, check the document's type after the import.

### 10.4.2 The two stops after scanning {#import-scanning-stops}

**Several people's documents on one scan.** The import stops: „Importul s-a oprit: o scanare conține actele de identitate ale mai multor persoane” (the import has stopped: a scan holds the identity documents of several people). The file would become one document carrying several people's papers and, in a property folder, even one person blended out of two real ones, so there is no „continue anyway”. Press „Oprește importul” (stop the import), split the file in File Explorer — one person, one file — and start again. If the file is in a page folder, take the page out and put each identity card beside the folder as a file of its own.

**Document types with no form.** The import stops: „Importul s-a oprit: unele tipuri de documente nu au încă formular” (the import has stopped: some document types have no form yet), with the types and their files. You have two roads:

- „Oprește importul”, build the forms in „Distilare Tipizate” (section [[tools-doc-type-engine]]) and start the import again from the beginning. The checks before it cost nothing, but the classification is paid for a second time. The link „Creați formularul în „Distilare Tipizate”” (build the form in „Distilare Tipizate”) opens in a new tab.
- „Continuă fără formulare” (continue without forms): the documents are created with their scans, the fields belonging to the type stay empty, and what is read for them goes into the Notes. New types are created without a form. The classification is not paid for a second time.

Files that received no type go to the „neclasificat” (unclassified) type and do not stop the import.

### 10.4.3 What the AI reads, and what it does not {#import-scanning-read}

After „Importă”, every document created is read by the AI, and the fields of its form fill themselves in — on a sale contract, for example, the price with its currency and the date of authentication. Whatever has no field stays as a short note in „Note extinse” (extended notes), and „Stare procesare” (processing state) shows „Procesat cu AI” (processed with AI) (section [[documents-identification]]). Sometimes the reading gives the document the title printed on it. The instruments the document cites wait for your answer (section [[links-references-documents]]).

The AI does not read Word, Excel, .rtf or .txt files; an identity card has a reading of its own, below; an image holding several people's documents is not read at all. And it neither creates nor links a person without your confirmation.

### 10.4.4 Identity cards, and the persons proposed {#import-scanning-people}

Towards the end of the import two kinds of window open, one after another.

„Creează persoană din cartea de identitate” (create a person from the identity card) („Card 1 din 2”, for example) shows the name, the CNP, „Serie și număr” (series and number) and „Eliberat de” (issued by), read from the card, and looks for the holder in the archive by CNP. If it finds them, „Persoana există deja” (the person already exists): compare the details and press „Confirmă și leagă” (confirm and link). If not, „Persoană nouă” (new person): press „Creează și leagă” (create and link). Persons with a similar name appear under „Potriviri posibile” (possible matches), as suggestions, not as sure matches. The holder is linked to the card as „Titular act de identitate” (identity-document holder). Below, „Părinții titularului” (the holder's parents) proposes the father and mother from the card, then linked to the holder as „Tată” and „Mamă” (section [[persons-id-card]]).

„Confirmați persoanele din acest document” (confirm the persons in this document) shows, one by one, the persons the AI found in a document — the sellers, the buyer, the notary — with each one's role. Choose „Da, asociază această persoană” (yes, associate this person) for someone in the archive, „Creează și asociază” (create and associate) or „Nu, creează o persoană nouă” (no, create a new person) for someone new, or „Omite” (skip).

**Answer then.** Once you close the import's window, the persons found in documents are not offered again: „După ce închideți, nu mai există unde.” (after you close, there is nowhere else). An identity card left unanswered still has „Creează persoane din CI” (create persons from the ID card), on the document's screen (section [[persons-id-card-document]]).

## 10.5 Evaluation, import and the result {#import-result}

### 10.5.1 „Evaluare” {#import-result-evaluation}

„Ce va face acest import” (what this import will do) says in figures what comes next: „Documente care vor fi create” (documents to be created), „Documente aflate deja în sistem (se leagă, nu se creează)” (documents already in the system — linked, not created), „Imagini pentru clasificare automată” (images for automatic classification), „Fișier de coordonate” (coordinate file), „Fișiere care vor fi ignorate” (files to be ignored), „De încărcat” (to upload). A page folder is a single document; the coordinate file is counted too, as a document in its own right. Nothing has been saved yet.

If a property folder holds a file with possible coordinates whose name does not start with „coord”, the screen tells you. Rename it and press „Verifică din nou folderul (clasificarea de până acum se pierde)” (check the folder again — the classification so far is lost) — exactly what it says: the paid classification is lost. Otherwise carry on; the corners can be added later too.

### 10.5.2 „Import”: the button that writes to the archive {#import-result-run}

The „Import” screen shows „Ce se întâmplă când apăsați „Importă”” (what happens when you press „Importă”) and the price, for example „Citirea AI se plătește: cel mult 2 documente vor fi citite.” (the AI reading is paid for: at most 2 documents will be read). „Importă” is the first button that writes to the archive. Then:

1. „Proprietățile acestui import” (this import's properties) — each property folder, with the tarla, the parcel, the documents and the coordinate file. A new property is created with the corners from the file. One that already exists, found by tarla and parcel, is linked: tick „Confirm legarea …” (I confirm linking …); its corners stay unchanged (you change them on the property's screen, section [[properties-corners]]). If the same parcel has several properties in the archive, keep only one and press „Încearcă din nou” (try again). Then „Continuă” (continue).
2. „Creare etichete din dosare” (create tags from the folders) — each document will be tagged with its folders; tags help searching and link nothing. „Da, pregătește etichetele” (yes, prepare the tags), then „Importă Fișierele (3)” (import the files).
3. „Se importă fișierele…” (importing the files…) — a row per document, with what was done and „Deschide” (open), then the windows for persons (section [[import-scanning-people]]). At the end, „3 documente importate.” (3 documents imported) and „Închide” (close).

A row marked ⚠ needs attention, for example a scan from which not every page arrived. Where the AI reading failed, „Încearcă citirea din nou” (try the reading again) repeats it, as a new, paid reading.

### 10.5.3 „Rezultat” and the report {#import-result-report}

„Importul s-a încheiat” (the import has finished), and „Pe scurt” (in short) gives the figures: „Documente create” (documents created), „Existau deja și au fost legate de proprietate” (already existed and were linked to the property), „Proprietăți create sau confirmate pentru acest import” (properties created or confirmed for this import), „Documente citite de AI (inclusiv cărțile de identitate)” (documents read by the AI, identity cards included), „Persoane găsite de AI și neconfirmate” (persons found by the AI and not confirmed), „Cărți de identitate fără răspuns” (identity cards unanswered), „Tipuri de documente rămase fără formular” (document types left without a form) and others.

„Salvează raportul (HTML)” (save the report) keeps it on the computer, with links into the archive. „Închide și vezi proprietățile” (close and see the properties) opens the list of properties. Open a few properties and a few documents: now is when something is easiest to correct. A finished import is not run again — it would create the documents a second time; for another folder, „Începe alt import” (start another import).

### 10.5.4 Coming back to the last import {#import-result-resume}

On the import screen, „Reia ultimul import (…)” (resume the last import), with the folder's name, reopens the last import's report and says whether its documents are still in the archive. It is a report, not an import: once the browser tab is closed, the application can no longer reach the files, so only the links remain. „Import nou” (new import) starts another one.

### 10.5.5 What an import costs {#import-result-cost}

Two things are paid for, each announced on the screen before its button:

- at „Scanare”, one classification for each document that is an image or a PDF (from a page folder, only the first page), announced at „Deja în sistem”;
- after „Importă”, one reading for each such document, identity cards included, announced at „Import”. The reading of a card is paid for even if you press „Omite”.

Word, .rtf and .txt files, and documents already in the system, cost nothing. A file with one identity card, one three-page contract and one coordinate file costs four AI operations: two classifications and two readings. Imported a second time, unchanged, it costs nothing.

## 10.6 Examples and use cases {#import-examples}

### 10.6.1 Import the file of a plot in Bragadiru {#import-example-first}

You have a sale contract scanned on three pages, the seller's identity card and the plot's coordinate file.

1. In File Explorer make the folder „Import Bragadiru” and, inside it, „40-212per40-Bragadiru”, with the „coord …” file, the identity card and the subfolder „Contract vanzare 2008”, holding the pages 1.jpg, 2.jpg, 3.jpg (section [[import-folder-structure]]).
2. „Import” → „Dosare de proprietăți”, „Am înțeles”, „Precondiții” (section [[import-overview]]).
3. At „Structură”, choose „Import Bragadiru” and check how the name was read: tarla 40, parcel 212/40.
4. Go through „Restricții”, „Duplicate” and „Deja în sistem” (section [[import-duplicates]]): two images for classification.
5. „Scanare” recognises the card and the contract; „Evaluare” announces three documents.
6. „Importă”: confirm the new property and the tags, then the persons (sections [[import-result-run]] and [[import-scanning-people]]).
7. „Închide și vezi proprietățile”: the plot has its corners, and its „Acte” (documents) shows the three documents.

### 10.6.2 Bring a new document into a file already imported {#import-example-again}

You have received a land-register extract for a plot whose file you have already imported.

1. Put the extract in the property folder, without renaming anything else, and import the folder again (section [[import-folder]]).
2. At „Deja în sistem”, the old documents appear with their codes, „legate, nu importate din nou” (linked, not imported again); the coordinate file is imported anyway (section [[import-duplicates-archive]]).
3. Only the extract is classified and read.
4. The property already exists: tick „Confirm legarea …”; its corners stay.
5. In „Acte”, the old documents do not appear twice; the extract and the coordinate file are new documents.

### 10.6.3 The import stopped for a type with no form {#import-example-no-form}

After scanning, the import stops: „Încheiere de Intabulare” has no form yet.

1. Read the list of types and their files (section [[import-scanning-stops]]).
2. You want the fields filled in from now on: build the form in „Distilare Tipizate” (section [[tools-doc-type-engine]]), then „Oprește importul” and start it again; the classification is paid for a second time.
3. Otherwise, „Continuă fără formulare”: the documents go in with their scans, and what was read goes into the Notes.
4. At „Rezultat”, „Tipuri de documente rămase fără formular” reminds you what is left to do.
`;
