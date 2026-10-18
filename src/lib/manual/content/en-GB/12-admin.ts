/**
 * Manual, en-GB, chapter 12. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 12 Administration and Settings {#admin}

This chapter is for whoever looks after the archive: the lists the other screens choose from, colleagues' accounts, groups, stamps and tags, the help texts and the application's settings. Its screens are in the sidebar: in the „Administration” section — „Reference Data”, „Users & Access”, „Groups”, „Stamps”, „Tags” —, in „Settings” and, for the help texts, in „Help & learning”.

## 12.1 Reference data {#admin-reference-data}

„Reference Data” holds the archive's vocabulary: nearly every list you choose a value from on a screen — the type of a property, a person's citizenship, the type of a document, a person's role in a document — is filled from here. You open it from „Administration” → „Reference Data”.

The screen is a single page (Figure [[fig-admin-value-lists]]). On the left are the lists, in three groups; on the right, the chosen list. Until you choose one, the right side reads „Choose a list on the left.”. The chosen list stays marked on the left, and the browser's back button takes you to the list you had before.

A page with several lists shows them as tiles: they stand side by side as far as they fit, each as wide as its columns need, and can be dragged elsewhere, as on a property's screen. „Default”, at the top right, puts them back; where they stand is kept in your browser.

![12.1 „Reference Data”](admin-value-lists.png){#fig-admin-value-lists}

| Group | The lists |
|---|---|
| Object types | „Natural Person Types”, „Juridical Person Types”, „Property Types and Uses”, „Document Types” |
| Roles and links | „Person Roles”, „Property → Property Links”, „Document → Document Links” |
| Value lists | „Tarla Codes”, „Citizenship”, „Relationship to the business” |

„Use Categories” has no button of its own: it is the second tile of the page „Property Types and Uses” (section [[admin-reference-data-property-types]]).

Every row stands on a single line. A value too long for its column ends in „…”; hold the mouse over it and you see it whole. In a long list only the rows scroll: the column titles stay at the top.

### 12.1.1 The values of a list {#admin-reference-data-values}

Above the table are „Add” and the number of values, for instance „8 values”. On each row are „Edit”, „Merge” and „Delete”.

The „Used by” column says how many objects use the value: „1 object”, „2 objects”. A value that nothing uses reads „unused”, in grey, and stands after the values in use.

- **A new value.** „Add” opens „Add a new value”. Fill in „Name” — it is required — and the list's other fields, then press „Save”. The new value appears last in the list.
- **A value renamed.** „Edit” opens „Edit the value”, with the current value. Change it and press „Save”.
- **Two values merged.** When the same value has got into the list twice, spelt differently, press „Merge” on the one that should go. The window „Merge “…” into another value” says how many objects move, for instance „One object moves to the value kept:”. Choose the value that stays in „Value to keep” and press „Merge”. The objects move to the value kept, and the other disappears from the list.
- **A value deleted.** „Delete” asks „Delete “…”?” and first checks what depends on the value: „Checking what depends on this value…”. If nothing does, it reads „Nothing depends on this value. Deleting it removes it permanently — this cannot be undone.”; „Delete” deletes it, „Cancel” gives up. If objects use it, the window says how many, and deleting is not possible until you move them onto another value: choose it under „Move them to:” and press „Move”.

Old versions of the objects do not change: each keeps the value as it was when it was saved (section [[links-versions]]).

### 12.1.2 Roles and links {#admin-reference-data-roles}

„Person Roles” holds the roles a person can have: in a document („Vânzător”, „Cumpărător” — seller, buyer), on a property, or towards another person. The list's columns:

- „Name” — the role's name; you read its description by holding the mouse over the name.
- „Person → Property” and „Person → Person” — a ✓ says the role can be chosen on that link. On kinship roles the kinship stands in place of the ✓, for instance „Parent” or „Child”.
- „Converse role (man, woman)” — how the role reads from the other end of the link, separated by commas, for instance „Vânzător, Vânzătoare” (section [[links-associate-role]]).
- „Used by” — how many objects use it.

„Edit” opens the role's panel, in a tile of its own, beside the list. It holds the name, the converse names — „Converse role”, „Converse role — man”, „Converse role — woman” — and „Applies to”, with three buttons: „Document”, „Property” and „Person”. „Property” offers the role on the link between a person and a property, „Person” on the link between two persons. While „Person” is pressed, the panel also shows „Kinship”: „Parent”, „Child”, „Spouse”, „Sibling”, „Other relative” or „No family tie”. On a role that the import of an identity card looks for, the kinship cannot be changed, and the panel says why.

„Document” opens „Document types”: the types of document the role is offered on. Choose a type in „Add a document type” and press „Add the type”. Each type in the list has:

- „Holds a share” — ticked, the role brings the share onto the link (section [[documents-parties]]); the tick is saved at once;
- how many links already use it, for instance „1 link”;
- „Remove “…”” — the role is no longer offered on that type. Links already made stay, but the role can no longer be chosen for that type of document.

A new role is saved first; only then can its document types be chosen.

Above the three lists of „Roles and links” stands the tile „How objects are linked to each other”: a triangle with „Person”, „Property” and „Document” at its corners. A corner means a link between two objects of the same kind, a side a link between two kinds. Beside the drawing, the six links are numbered as in the drawing and explained, each with „See:” and the place where it is configured. A click on a number or a name opens that list. The „Document – Property” side is dotted and opens nothing: the link has no list, because the document's type says what it means. The ⓘ button after notes 5 and 6 shows, step by step, how the link is made.

„Property → Property Links” and „Document → Document Links” hold the directed links between two properties and between two documents, for instance „Inclus în” (included in) or „Titlu anterior al” (prior title of) (section [[links-references]]).

### 12.1.3 Document types {#admin-reference-data-document-types}

„Document Types” has the columns „Name”, „Short name”, „Status” and „Used by (n objects)”. „Status” says where the type comes from and whether it has a form: „Added by hand”, „Created by an import” or „Has a form”. Hold the mouse over a type's name and the bubble shows the full name, with the type's key under it, for instance „CONTRACT_VANZARE”.

Above the table are two ticks: „With a form” shows only the types that have a form, „Without a form” only those that do not. Both ticked, or neither, shows every type. When an import stops at a type without a form, its link opens the list with „Without a form” ticked (chapter [[import]]).

„Open”, on a type's row, opens the type's page, with three tabs:

- „General” — „Name”, „Short name”, „Code” and „Status”, with „Save”. The code can only be read: „The code does not change: exported forms, the AI request and the tests use it.”. The short name is the one in the „Type” column of the documents list (section [[documents-list]]).
- „Form” — the fields of the documents of this type (section [[documents-identification]]). Without a form, the tab reads „This type has no form yet.” and offers „Create the form”; with one, „Edit the form”, with the number of fields. Each field has a label in Romanian and one in English. The key under the label is set when the field is added and never changes, so a label can be renamed without worry. The identity card and the catch-all type for unclassified documents cannot have a form.
- „Roles” — the roles a person can have in a document of this type. Choose a role in „Add a role” and press „Add the role”; tick „Holds a share” where the role brings a share.

A type's „Roles” tab and „Document” on a role's panel show the same pairs, from two ends: a role added on a type also appears on the role's panel, with its tick. „← Document Types” takes you back to the list.

### 12.1.4 Property Types and Uses {#admin-reference-data-property-types}

„Property Types and Uses” is one page with three tiles, set side by side as far as they fit:

- „Property Types” — what the property is: „Teren extravilan”, „Teren intravilan”, „Teren construit”, „Liniară”, „Casă”, „Apartament”, „Garaj”, „Spațiu comercial”, „Birou”. On each row three ticks say what the type shows: the tarla and parcel, the address and Street View (section [[properties-type]]).
- „Use Categories” — the land's legal category of use: „Arabil”, „Pășune”, „Fânețe”, „Vie”, „Livadă”, „Pădure”, „Ape”, „Neproductiv”, „Curți-construcții”, „Drumuri”. A value sits in one list only: „Pășune” or „Vie” are uses, not types.
- „Uses allowed for each type” — a table with a row per type and a column per use. Tick the uses a type may have; the tick is saved at once. A type with no tick allows them all, and its row reads „(all)”.

The property form offers in „Use Category” only the uses the chosen type allows (section [[properties-add-cadastral]]). A property that already holds a use its type no longer allows keeps it; under the field it says the use is not among the ones its type allows.

### 12.1.5 Public bodies {#admin-reference-data-public-bodies}

On „Juridical Person Types”, every type has the tick „Public body”. The seven public-body types have it — „Autoritate publică centrală”, „Instituție publică teritorială”, „Autoritate locală”, „Instanță”, „Birou notarial”, „Birou de executor judecătoresc”, „Cabinet sau societate de avocatură” (section [[companies-add-public-bodies]]) — and the company forms do not. The list of a document's issuer holds the juridical persons whose type is ticked (section [[documents-identification]]): tick a type of your own and its firms join that list; untick one and they leave it, though a document that names one keeps it.

The archive no longer has a list of institutions: its institutions became juridical persons of these types.

## 12.2 Users and access {#admin-users}

A colleague without an account asks for access from the sign-in page (section [[start-sign-in]]). The request arrives in „Administration” → „Users & Access”, where the screen says: „Review and act on account requests. Approving creates an account and emails the applicant their temporary password.”.

The screen has two tabs:

- „Pending Requests”, with the number of requests in its title. Each row shows „Username”, „Email” and „Submitted”, and under „Actions” the buttons „Approve” and „Reject”. With no requests, the tab reads „No pending requests.”.
- „History” — the requests that have been answered, with „Status” („Approved” or „Rejected”), „Processed” and „By”, that is, who answered.

„Approve” creates the account and e-mails the colleague the temporary password; the screen confirms with „Account created and email sent.”. „Reject” refuses the request and tells the applicant: „Request rejected and applicant notified.”. Either way the request leaves „Pending Requests” and stays in „History” for good. If the e-mail could not be sent, the message says so in brackets; the account, or the refusal, has been recorded all the same.

An approved account cannot be deleted from the application, so approve only the requests you recognise. The colleague can change the temporary password themselves, in „Settings” → „My account” (section [[admin-settings-account]]).

## 12.3 Groups, stamps and tags {#admin-groups}

Groups, stamps and tags are put on objects from each object's „Tags and groups” tile (section [[links-classify]]). Here are the screens that hold them all together.

### 12.3.1 Groups {#admin-groups-groups}

„Administration” → „Groups” shows the panel „Ce este un Grup?” (what is a group?), „Add”, the number of groups, for instance „4 groups”, and the table „Code” · „Description”. Each row has the group's code, with the number of members in brackets, the kind of objects it gathers, the description, „Edit” and „Delete”.

1. „Add” opens „Add new group”. Choose „Target” — „Property”, „Physical person”, „Juridical person” or „Document” —, write „Description” and press „Save”. You stay on the list, with the new group first; the code, of the form GRP-001, is given on saving.
2. „Edit” opens „Group GRP-…”, with three tiles: „Group identity” („Target” and „Code” read-only, „Description”), „Members available to include” and „In Group already”.
3. Search in „Search…”, tick the objects and press „Add to Group”; to take one out, tick it in „In Group already” and press „Remove from Group”. Members added carry „[new]”, and the screen shows „Unsaved changes”: nothing has been written yet.
4. „Save group” writes the changes; „[new]” becomes the member's position in the group, „[01]”, „[02]”.

The screen's tiles can be moved by dragging them by an empty spot, and „Default”, at the top right, puts them back. „Delete” on a group's row asks „Delete this group? This cannot be undone.”; the objects in the group stay in the archive.

### 12.3.2 Stamps {#admin-groups-stamps}

„Administration” → „Stamps” shows the panel „Ce este o Ștampilă?” (what is a stamp?), the number of stamps and the table „Stamp” · „Members”: each row has the stamp's code and description, its note, how many objects carry it, „Apply” and „Delete”.

1. The „+” button, „Create stamp”, opens the form: „Short description” (required, at most 200 characters) and „Notes”. The code, of the form STMP-AAA, is given on saving. „Save” leaves you on the list, with the new stamp first.
2. „Apply” opens „Apply stamp: …”, with four tiles: „Stamp description”, „Object type”, „Objects available to stamp” and „Objects already stamped”.
3. Choose the kind of objects in „Object type”; the lists show only objects of that kind. Tick them and press „Apply stamp”, or, in the other list, „Remove stamp”. The screen shows „Unsaved changes”.
4. „Save stamps”, the floppy-disk button, writes the changes. A stamp can sit on objects of different kinds: change „Object type” and carry on.

As with groups, the tiles are moved by dragging, and „Default” puts them back. „Delete” asks „Delete this stamp and remove it from all items? …”: the stamp disappears from the objects as well, and the objects stay.

### 12.3.3 Tags {#admin-groups-tags}

„Administration” → „Tags” shows „Tag cloud”: every tag in the archive, how many distinct ones there are and, on each, how many times it is used, for instance „×1”. The most used are larger. When they do not fit in the window, only the tags scroll; the title and the buttons stay at the top.

A double click on a tag selects it, and a second one deselects it; a selected tag appears pressed.

- With one tag selected, „Rename tag” turns it into a box right in the cloud. Type the new name and press Enter, or Esc to leave it as it was. The name is written in lower case; if the new name already exists, the two tags are combined.
- With two or more selected, „Merge tags” opens „Merge tags”, with them ticked. Choose „Keep this” on the tag that stays; the window says what will happen, for instance „Tags "arenda" will become "arendă".”. Press „Merge”.

With no tag selected, both buttons are inactive.

## 12.4 Help information {#admin-help}

The texts behind the „?” button and the light-bulb hints on the screens (section [[start-help]]) are not fixed: the administrator writes them, in „Help & learning” → „Help Information”. The screen has two tabs, „Screens” and „Micro-hints”.

„Screens” shows the list of the application's screens, for instance „Administration — Tags” or „Properties — List”, each with „Complete” or „Missing”. Choose a screen and fill in the four fields:

| The field | What you write |
|---|---|
| Background (Romanian) | what the screen is for |
| How To (Romanian) | what you do on it, step by step |
| Background (English) | the same background, in English |
| How To (English) | the same instructions, in English |

„Preview” shows the text as it will appear, as you type. „Save” saves it, and the screen confirms with „Saved”. From then on, the „?” on that screen opens the „Help” panel, with „Background” and „How To”, as you wrote them, and under them „See in the manual: …”, with the section of this manual that describes the screen. A screen marked „Proposal” has a text proposed from the manual, which you accept, edit or set aside (section [[learning-help-proposals]]).

„Micro-hints” holds the light-bulb hints: choose a hint from the list and write its text in „Hint text (Romanian)” and „Hint text (English)”. A hint that stands on several screens says „Appears on … screens — saving writes to all of them.”.

## 12.5 Settings {#admin-settings}

„Settings” opens from the sidebar (Figure [[fig-admin-settings]]). As on an object's screen, the boxes at the top choose which parts are shown, and „Default” brings them back (section [[start-tiles]]). The parts are „My account”, „Time thresholds”, „Backups”, „About” and, in the „Costs” group, one for each provider that can cost money.

![12.2 „Settings”](admin-settings.png){#fig-admin-settings}

### 12.5.1 „My account” {#admin-settings-account}

„My account” holds what is yours, not the archive's:

- **The password.** Type the new password in „New password” — at least 8 characters — and once more in „Confirm password”, then press „Change password”. The application confirms with „Password changed!”. If the two do not match, it says „The passwords do not match.”.
- **The language.** Under „Language” choose „Română” or „English”.
- **„My defaults”**. For each kind of object — „Natural person”, „Juridical person”, „Property”, „Document” — tick the tiles you want „Default” to show on its screen and press „Save”; „Saved.” appears. The set belongs to the account, not to the browser, so it stays after a reload, and in any browser. „Back to default” forgets your set and brings back the application's usual one: „Back to default.”. At least one tile stays ticked.

„Sign out” is at the bottom of the sidebar.

### 12.5.2 „Time thresholds” {#admin-settings-thresholds}

„Time thresholds” holds ten numbers that decide when something is „new”, „soon” or „old”, in four groups: „Dashboard”, „Documents”, „Persons” and „The „New!” badge”. Each threshold has a name, a sentence, a number with its unit and an example. The example changes at once, with the number you type: on „Expiring-soon filter window”, with 30 it reads „Example: A document shows «expiring soon» 30 days ahead.”, and with 45, „… 45 days ahead.”.

Among other things, the thresholds decide:

- how many days back „Recent” counts on „Dashboard”, and how many days ahead it shows the documents that expire;
- how long before a document shows „expiring soon”;
- how long before its expiry an identity card is flagged („ID card expiring soon threshold”);
- how long a changed object carries the „New!” badge, red and then amber, and after how long the badge disappears.

As soon as you change a number, „Cancel” appears beside „Save” and brings back the saved value. „Save” confirms with „Saved successfully.”. The values are whole numbers between 1 and 3650. The thresholds belong to the archive, not to an account: a change is seen by every user.

### 12.5.3 „Costs” {#admin-settings-costs}

The „Costs” group has one part for each provider that can cost money: „AI”, „Claude subscription”, „Google Maps”, „Street View”, „Address look-ups”, „Supabase”, „Vercel”, „Resend (e-mail)”, „GitHub”, „Web domain” and „Testing”. Each opens collapsed to one line, in CA$: „This month: … · forecast: …”. On „AI” the line starts with „Estimated this month”, because there the cost is an estimate.

„Details” opens the part, and „Collapse” folds it back. Open, it shows:

- „What is paid for”, „Free” — what the provider gives without charge — and „How it is priced”, with „Prices checked on …” and a link to „the provider's pricing page”;
- „This month, to date”, „Forecast for the month” and „Cost over time”;
- on „AI”, what the application uses paid reads for — for instance „Extracting a document's data” — and the model of each;
- on „Street View” and „Address look-ups”, the month's use against the free part; what comes from people is an estimate, and the screen says so.

Where an amount comes from an invoice, you enter it under „Amounts entered”: „From”, „To”, „Amount”, „Currency”, „Rate in CA$” and, if you like, „Note”, then press „Add an amount”. The new row shows the amount and its CA$ equivalent, and the month's figures count it. „Delete the amount” takes it out.

### 12.5.4 „Backups” and „About” {#admin-settings-about}

„Backups” can only be read: „Last backup” and „Last restore drill”, with its result. On an installation that cannot read them, the part says so in one sentence. „About” shows „Version”, „Commit”, „Environment” and „Database”: copy them when you report a problem.

## 12.6 Examples and use cases {#admin-examples}

### 12.6.1 Merge a land-use category entered twice {#admin-example-merge}

In „Use Categories” there are two values that say the same thing, spelt differently.

1. Open „Administration” → „Reference Data” and choose „Property Types and Uses”; „Use Categories” is the page's second tile (section [[admin-reference-data-property-types]]).
2. Read „Used by” on the two rows and decide which value stays.
3. Press „Merge” on the other, choose the first in „Value to keep” and press „Merge” (section [[admin-reference-data-values]]).
4. Check that the merged value has gone and that „Used by” on the value kept has grown.

### 12.6.2 Offer a role with a share on a document type {#admin-example-role}

On a sale-purchase contract you want to choose a role that is not yet offered on this type, with its share.

1. In „Reference Data”, open „Document Types” and press „Open” on „Contract de Vânzare” (section [[admin-reference-data-document-types]]).
2. On the „Roles” tab, choose the role in „Add a role” and press „Add the role”.
3. Tick „Holds a share” on its row.
4. Open „Person Roles” and press „Edit” on the role: under „Document”, the contract appears with „Holds a share” ticked (section [[admin-reference-data-roles]]).
5. On a contract, associate a person with this role; their row in „Links” has „Share” (section [[documents-parties]]).

### 12.6.3 Give a new colleague access {#admin-example-access}

A colleague has asked for access from the sign-in page.

1. Open „Administration” → „Users & Access”, the „Pending Requests” tab (section [[admin-users]]).
2. Check the name and e-mail on the row and press „Approve”.
3. Tell the colleague to look for the temporary password in their e-mail and to change it in „Settings” → „My account” (section [[admin-settings-account]]).
4. On the „History” tab, the request shows „Approved”, with the day and your name under „By”.

### 12.6.4 Change a threshold and put it back {#admin-example-threshold}

You want documents to show „expiring soon” earlier, for a month of checks.

1. Open „Settings”, the „Time thresholds” part (section [[admin-settings-thresholds]]).
2. Note the current value of „Expiring-soon filter window”.
3. Type the new value and read the example under it; press „Save” and wait for „Saved successfully.”.
4. After the month, type the noted value back and press „Save”. Reload the page and check that it has stayed.
`;
