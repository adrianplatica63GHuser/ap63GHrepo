/**
 * Manual, en-GB, chapter 1. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 1 Introduction {#intro}

This manual shows you how to work with the archive: what it holds, how to find and add a record, and how records are linked to one another. It is written for the people who use the archive every day, and it names the screens and buttons as the application itself names them.

## 1.1 What the archive is for {#intro-purpose}

The archive keeps in one place the persons the business works with, their properties, and the documents that concern them — contracts, certificates, permits, identity cards — together with the scanned pages of each document. From any record you can reach everything linked to it: from a parcel to its owners, and to the documents through which it passed from one owner to the next.

The first screen after signing in is the **Dashboard** (Figure [[fig-dashboard]]): what was added in the last seven days, the records whose metadata has not been updated for a long time, the documents that expire soon, and what was worked on recently.

![1.1 The dashboard, the first screen after signing in](dashboard.png){#fig-dashboard}

## 1.2 The three main objects {#intro-objects}

Everything in the archive starts from three kinds of record:

- **Persons** — natural persons, that is people, and judicial persons: firms, associations, institutions.
- **Properties** — land and buildings, with their shape on the map when the corners are known.
- **Documents** — any document: a contract, a certificate, a permit, an identity card, with its pages.

They are linked. A person is a party to a document, with a role — „Vânzător” (seller), „Cumpărător” (buyer), „Moștenitor” (heir). A property is the object of a document. A person owns a property, with a share. Links read from both ends: on the document you see the property, and on the property you see the document. Chapter [[links]] shows them all.

Every record has a system code that says what kind of record it is: **PPERS** for a natural person, **JPERS** for a judicial person, **PROP** for a property and **DOC** for a document.

## 1.3 What a version is {#intro-versions}

Every time you save a record, the archive keeps a new version of it and leaves the previous one untouched. You can always go back to an earlier version, read it and, if need be, make it current again. Nothing that was saved is lost; section [[links-versions]] shows how.

## 1.4 How to read this manual {#intro-how-to-read}

Chapter [[start]] takes you through what every screen shares: signing in, the sidebar, the lists, a record's tiles and the help. Chapters [[persons]]–[[admin]] take each part of the application in turn, in the sidebar's order, and chapter [[learning]] shows how to check and grow what you know.

Chapters, sections and figures are numbered, so a reference such as „section 2.5” or „Figure 2.3” is found by its number in the contents. Every chapter ends with examples and use cases: ordinary tasks, step by step.

The names of buttons, fields and screens are written in quotation marks, as they appear in the application: „Add new Property”, „Choose fields”, „Links”.

## 1.5 Examples {#intro-examples}

- **Everything about a parcel.** Open the property and read its „Links” tile: its owners, documents and linked parcels are there.
- **What changed on a person.** On the person's screen, step back through the versions: every save is one of them.
- **What was worked on today.** On the dashboard, „Recent activity” shows the records touched last.
`;
