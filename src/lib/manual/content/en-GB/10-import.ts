/**
 * Manual, en-GB, chapter 10. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 10 Import {#import}

The import brings a whole file from the computer into the archive: one folder for each property, with the scans of its documents, its coordinate file and the identity cards of the people in those documents. From it come the documents, the properties with their corners and, with your confirmation, the persons. This chapter says what you decide at each step, and why.

## 10.1 How an import runs {#import-overview}

In the sidebar, open „Import”, then „Property folders”. The „Import” screen shows the steps at the top, on two lines (Figure [[fig-import-steps]]):

| Line | Steps |
|---|---|
| Preparation & verification | „Information”, „Preconditions”, „Structure”, „Constraints”, „Duplicates” |
| Classification & import | „Already in the system”, „Scanning”, „Evaluation”, „Import”, „Result” |

The first five steps look only at the chosen folder; from „Already in the system” onwards, the system looks at the archive too.

![10.1 The import at its first step: the two lines of steps](import-steps.png){#fig-import-steps}

„Information” says, in the box „How the import works”, what holds for everything after it:

- **The system does not touch your files.** It never moves, renames or deletes them. When it finds something to put right, it stops and tells you what; you make the change in File Explorer, come back and press the check button again. That is not a fault — this is how the import is designed.
- Nothing enters the archive until the „Import” step, and until then you can give up at any time.

Press „I understand”. „Preconditions” checks eight things by itself — among them, that the browser can open a folder on the computer (Google Chrome or Microsoft Edge) and that you have import rights. A row marked „problem” says what to do; whatever belongs to the system is fixed by the administrator.

Every checking step works the same way: read the rules, tick that you have read them, press the check button. The tick is asked for again at every check, so also after every fix. The step's „Save the … as a page” button downloads the rules and the list of things to put right, so that you have them in front of you while you work in File Explorer.

### 10.1.1 The two ticks at the top of the screen {#import-overview-ticks}

Both are ticked when you open the import:

- „Stop after every step” — the import stops after each step with nothing to put right and goes on when you press „Continue to the “…” step”. Nothing is spent while you read. Unticked, it passes over those steps by itself.
- „Start every step with the rules in view” — each step opens with its rules showing, and after the check they fold away, so that what you have to put right stays in front. „Show the rules” and „Hide the rules” change that at any time.

For your first imports leave both ticked: that way you see everything that happens.

### 10.1.2 „Cancel import” {#import-overview-cancel}

„Cancel import”, at the top, stops the import at any step and takes you back to „Information”; it is also how you choose another folder once an import has started. First it asks „Cancel the import?” and says what is left behind: the files on the computer stay untouched; whatever was classified is lost and, if you start again, paid for again; documents and properties already created stay in the archive. „Yes, cancel the import” cancels, „No, keep importing” leaves you where you were.

## 10.2 What the folder must look like {#import-folder}

At the „Structure” step you choose the folder. Read the rules, tick „I follow the structure rules” and press „Choose folder…”, then choose the folder in the Windows window. The check answers „The folder structure is correct.” or lists the things to put right, each with the folder concerned and what to do.

### 10.2.1 The structure rules {#import-folder-structure}

| Where | The rule |
|---|---|
| The chosen folder | Holds only folders: one for each property, plus, if you need them, „comune” and „flotante”. No file directly in it. The number of properties has a limit, written in the rule. Two folders may not mean the same property. |
| A property folder | Its name is the tarla, a dash, the parcel and, if you like, another dash and a description. „per” stands for the „/” sign, which a folder name cannot contain: tarla 40, parcel 212/40 is written „40-212per40”. At most one coordinate file, a .txt whose name starts with „coord”; without one, the property is created with no outline. |
| A page folder | The pages of a scanned document sit in a subfolder whose name is the document's title. It holds only files named with just a number — 1.jpg, 2.jpg, 3.jpg — with no two the same and no gaps. |

A file lying directly in the property folder is a document in its own right, with its file name as the title.

When the structure is in order, „How each property folder's name was read” shows the tarla, the parcel and the rest of the name. Look at it: the documents' tag is made from that same name. If it is not what you expected, rename the folder and check again. A name without „per”, such as „48-50D”, becomes the question „Is this folder a property?”: answer „Yes, it is a property” or „It is not a property”.

### 10.2.2 Files refused and files ignored {#import-folder-files}

„Constraints” checks the same folder: tick „I have read the file constraints” and press „Check the files”. Scans, photographs, PDFs, Word, Excel and OpenOffice documents and text files are imported. These are refused, and must be replaced or taken out of the folder:

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

## 10.3 Duplicates and „Already in the system” {#import-duplicates}

„Duplicates” compares the files in the chosen folder with each other; „Already in the system” compares the folder with the archive.

### 10.3.1 Copies inside the folder {#import-duplicates-copies}

Tick „I have read what counts as a copy” and press „Look for copies”. The system finds the same file more than once — by name and size, ignoring the „ - Copy” that Windows adds — and the same document in two page folders, by its pages, even when the folders are named differently. It says the files look alike, not that they are: look at them before taking anything out. Keep the copy in the right place; if they are different documents, rename one.

### 10.3.2 Documents already in the archive {#import-duplicates-archive}

Tick „I have read what happens to documents that are already in the system” and press „See what is already in the system”. This step stops nothing: it only says what will happen.

A document is already in the system when the archive holds one brought in under the same name — the file's or the page folder's — and with the same files, of the same sizes. Then:

- if it sits in a property folder, the archived document is linked to the property, not imported a second time; otherwise nothing happens to it;
- an identity card is imported anyway: the one in the archive may have expired, and a person twice is less harm than a person missing — check the persons after the import;
- the coordinate file is imported anyway, because every corner has to show which document it was read from.

Each row shows the code and the title of the archived document. If it is not the one you had in mind, rename the file or the page folder and it will be imported as a new document. What is already in the system is neither sent for classification nor read, so a re-import costs little.

Below the list, the screen says how many images the next button will send for classification: „that is the first step that costs anything”. Further down, „What to check before you continue” shows the ignored files and the remarks about the folder; read it, because some remarks say not to start the import.

## 10.4 Scanning, and what the AI reads {#import-scanning}

The AI works twice in an import: at „Scanning” it recognises each document's type, and after „Import” it reads each document and fills in its form. A document added by hand does not go through this reading.

### 10.4.1 Classification, at „Scanning” {#import-scanning-classify}

Only the first page of each document is sent, enough for its type to be recognised. Word, Excel and text files, and those already in the system, are not sent. The table „Path” · „AI Description” · „Status” shows, as they arrive, the type recognised, the confidence („High confidence”, „Medium confidence”, „Low confidence”) and the state: „Scanned”, „Not scannable” or „Already here”. A page folder is a single row, with „Group of 3 pages”, for example. Nothing enters the archive yet. Where the confidence is low, check the document's type after the import.

### 10.4.2 The two stops after scanning {#import-scanning-stops}

**Several people's documents on one scan.** The import stops: „The import has stopped: one scan holds more than one person's identity document”. The file would become one document carrying several people's papers and, in a property folder, even one person blended out of two real ones, so there is no „continue anyway”. Press „Stop the import”, split the file in File Explorer — one person, one file — and start again. If the file is in a page folder, take the page out and put each identity card beside the folder as a file of its own.

**Document types with no form.** The import stops: „The import has stopped: some document types have no form yet”, with the types and their files. You have two roads:

- „Stop the import”, build the forms in „DocTypeEngine” (section [[tools-doc-type-engine]]) and start the import again from the beginning. The checks before it cost nothing, but the classification is paid for a second time. The link „Build the form in DocTypeEngine” opens in a new tab.
- „Continue without forms”: the documents are created with their scans, the fields belonging to the type stay empty, and what is read for them goes into the Notes. New types are created without a form. The classification is not paid for a second time.

Files that received no type go to the „Unclassified” type and do not stop the import.

### 10.4.3 What the AI reads, and what it does not {#import-scanning-read}

After „Import”, every document created is read by the AI, and the fields of its form fill themselves in — on a sale contract, for example, the price with its currency and the date of authentication. Whatever has no field stays as a short note in „Enhanced Notes”, and „Processing status” shows „AI processed” (section [[documents-identification]]). Sometimes the reading gives the document the title printed on it. The issuer it reads is not written as the issuer: it waits beside the issuer field until you choose (section [[documents-identification]]). The instruments the document cites wait for your answer (section [[links-references-documents]]).

The AI does not read Word, Excel, .rtf or .txt files; an identity card has a reading of its own, below, and a plan parcelar is read once more, for its tarla; an image holding several people's documents is not read at all. And it neither creates nor links a person without your confirmation.

### 10.4.4 Identity cards, and the persons proposed {#import-scanning-people}

Towards the end of the import two kinds of window open, one after another.

„Create person from ID card” („Card 1 of 2”, for example) shows the name, the CNP, „Series and number” and „Issued by”, read from the card, and looks for the holder in the archive by CNP. If it finds them, „This person already exists”: compare the details and press „Confirm and link”. If not, „New person”: press „Create and link”. Persons with a similar name appear under „Possible matches”, as suggestions, not as sure matches. The holder is linked to the card as „Titular act de identitate” (identity-document holder). Below, „The holder's parents” proposes the father and mother from the card, then linked to the holder as „Tată” and „Mamă” (section [[persons-id-card]]). „Issuing institution” offers the issuers, judicial persons of a public-body type; when the card's authority is not among them, „Add “…” as a judicial person” makes it, with the type its name suggests (section [[companies-add-public-bodies]]).

„Confirm people from this document” shows, one by one, the persons the AI found in a document — the sellers, the buyer, the notary — with each one's role. Choose „Yes, link this person” for someone in the archive, „Create & link” or „No, create a new person instead” for someone new, or „Skip”.

For a new firm whose CUI the AI read, the window also has „Fill in from ANAF” (section [[companies-add-anaf]]). Pressed, it shows what ANAF would fill in beside what the AI read — the trade register number, the phone, the type, the head office address — with the same ticks: the empty fields ticked, those read differently only if you tick them. With „Create & link”, the firm is created with the ticked values, so it arrives in the archive complete.

**Answer then.** Once you close the import's window, the persons found in documents are not offered again: „Once you close, there is nowhere left.” An identity card left unanswered still has „Create people from the ID card”, on the document's screen (section [[persons-id-card-document]]).

### 10.4.5 Plans parcelare and their tarla {#import-scanning-tarla}

A document of the type „Plan Parcelar” is read a second time, for its tarla alone: the locality, the tarla's code and the parcels it draws, each with its number, its area in m² and its use when they are printed. The owners on the plan are neither read nor kept. The „Import” screen says beforehand that this reading is paid for: „The plan parcelar is read once more, for its tarla.”

After the persons' windows, each plan opens „The tarla from the plan parcelar”. It shows what was read: „Tarla”, „Locality” and „County”, which you can correct, then the parcels, and below them what could not be read. The proposal follows the code and locality above it:

- when the tarla with this code already exists in that locality (section [[properties-tarla]]), „Link the plan to the tarla” links the plan to it and adds the parcels it does not have. The parcels it has stay as they were;
- when it does not, „Create the tarla and link the plan” creates it, with its parcels;
- „Skip” writes nothing.

Nothing is written before you press. The document's row keeps what happened, for instance „tarla TCP9 created, with 4 parcels”, and so does the saved report.

## 10.5 Evaluation, import and the result {#import-result}

### 10.5.1 „Evaluation” {#import-result-evaluation}

„What this import will do” says in figures what comes next: „Documents that will be created”, „Documents already in the system (linked, not created)”, „Images for automatic classification”, „Coordinate file”, „Files that will be skipped”, „To upload”. A page folder is a single document; the coordinate file is counted too, as a document in its own right. Nothing has been saved yet.

If a property folder holds a file with possible coordinates whose name does not start with „coord”, the screen tells you. Rename it and press „Check this folder again (the classification so far is lost)” — exactly what it says: the paid classification is lost. Otherwise carry on; the corners can be added later too.

### 10.5.2 „Import”: the button that writes to the archive {#import-result-run}

The „Import” screen shows „What happens when you press “Import”” and the price, for example „AI reading costs money: at most 2 documents will be read.” „Import” is the first button that writes to the archive. Then:

1. „The properties in this import” — each property folder, with the tarla, the parcel, the documents and the coordinate file. A new property is created with the corners from the file. One that already exists, found by tarla and parcel, is linked: tick „I confirm linking …”; its corners stay unchanged (you change them on the property's screen, section [[properties-corners]]). If the same parcel has several properties in the archive, keep only one and press „Try again”. Then „Continue”.
2. „Create tags from folders” — each document will be tagged with its folders; tags help searching and link nothing. „Yes, prepare tags”, then „Import Files (3)”.
3. „Importing files…” — a row per document, with what was done and „Open”, then the windows for persons (section [[import-scanning-people]]). At the end, „3 documents imported.” and „Close”.

A row marked ⚠ needs attention, for example a scan from which not every page arrived. Where the AI reading failed, „Try the read again” repeats it, as a new, paid reading.

### 10.5.3 „Result” and the report {#import-result-report}

„The import has finished”, and „In brief” gives the figures: „Documents created”, „Already in the system and linked to the property”, „Properties created or confirmed for this import”, „Documents read by the AI (identity cards included)”, „People found by the AI and not confirmed”, „Identity cards left unanswered”, „Document types still without a form” and others.

„Save the report (HTML)” keeps it on the computer, with links into the archive. „Close and view properties” opens the list of properties. Open a few properties and a few documents: now is when something is easiest to correct. A finished import is not run again — it would create the documents a second time; for another folder, „Start another import”.

### 10.5.4 Coming back to the last import {#import-result-resume}

On the import screen, „Resume last import (…)”, with the folder's name, reopens the last import's report and says whether its documents are still in the archive. It is a report, not an import: once the browser tab is closed, the application can no longer reach the files, so only the links remain. „New import” starts another one.

### 10.5.5 What an import costs {#import-result-cost}

Two things are paid for, each announced on the screen before its button:

- at „Scanning”, one classification for each document that is an image or a PDF (from a page folder, only the first page), announced at „Already in the system”;
- after „Import”, one reading for each such document, identity cards included, announced at „Import”. The reading of a card is paid for even if you press „Skip”.

Word, .rtf and .txt files, and documents already in the system, cost nothing. A file with one identity card, one three-page contract and one coordinate file costs four AI operations: two classifications and two readings. Imported a second time, unchanged, it costs nothing.

## 10.6 Examples and use cases {#import-examples}

### 10.6.1 Import the file of a plot in Bragadiru {#import-example-first}

You have a sale contract scanned on three pages, the seller's identity card and the plot's coordinate file.

1. In File Explorer make the folder „Import Bragadiru” and, inside it, „40-212per40-Bragadiru”, with the „coord …” file, the identity card and the subfolder „Contract vanzare 2008”, holding the pages 1.jpg, 2.jpg, 3.jpg (section [[import-folder-structure]]).
2. „Import” → „Property folders”, „I understand”, „Preconditions” (section [[import-overview]]).
3. At „Structure”, choose „Import Bragadiru” and check how the name was read: tarla 40, parcel 212/40.
4. Go through „Constraints”, „Duplicates” and „Already in the system” (section [[import-duplicates]]): two images for classification.
5. „Scanning” recognises the card and the contract; „Evaluation” announces three documents.
6. „Import”: confirm the new property and the tags, then the persons (sections [[import-result-run]] and [[import-scanning-people]]).
7. „Close and view properties”: the plot has its corners, and its „Documents” shows the three documents.

### 10.6.2 Bring a new document into a file already imported {#import-example-again}

You have received a land-register extract for a plot whose file you have already imported.

1. Put the extract in the property folder, without renaming anything else, and import the folder again (section [[import-folder]]).
2. At „Already in the system”, the old documents appear with their codes, „linked, not imported again”; the coordinate file is imported anyway (section [[import-duplicates-archive]]).
3. Only the extract is classified and read.
4. The property already exists: tick „I confirm linking …”; its corners stay.
5. In „Documents”, the old documents do not appear twice; the extract and the coordinate file are new documents.

### 10.6.3 The import stopped for a type with no form {#import-example-no-form}

After scanning, the import stops: „Încheiere de Intabulare” has no form yet.

1. Read the list of types and their files (section [[import-scanning-stops]]).
2. You want the fields filled in from now on: build the form in „DocTypeEngine” (section [[tools-doc-type-engine]]), then „Stop the import” and start it again; the classification is paid for a second time.
3. Otherwise, „Continue without forms”: the documents go in with their scans, and what was read goes into the Notes.
4. At „Result”, „Document types still without a form” reminds you what is left to do.
`;
