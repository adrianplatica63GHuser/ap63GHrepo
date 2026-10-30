/**
 * Manual, ro-RO, chapter 3. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 3 Persoane fizice {#persons}

O persoană fizică este un om: numele, CNP-ul, data nașterii, cetățenia, actele de identitate, telefoanele, adresele de e-mail și adresele lui. Capitolul acesta vă arată cum găsiți o persoană, cum o adăugați — de mână sau dintr-o carte de identitate —, cum îi notați decesul, cum îi legați rudele și ce înseamnă fișele „Arbore de moștenire” și „Interacțiuni”.

## 3.1 Lista persoanelor fizice {#persons-list}

În bara laterală, deschideți „Domeniu”, apoi „Persoane Fizice”. Ecranul se numește „Persoane fizice” și arată un tabel cu coloanele „Nume” și „Poreclă”, 15 rânduri pe pagină (secțiunea [[start-lists]]). În coloana „Nume”, prenumele vine primul: o persoană cu numele Popescu și prenumele Ion apare ca „Ion Popescu”.

Caseta de căutare („caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu”) păstrează în tabel doar persoanele care se potrivesc cu ce scrieți; ajunge o parte din nume. Textul ei nu încape întreg: țineți mouse-ul pe casetă ca să-l citiți. Filtrele listei se pun din coloane (secțiunea [[persons-list-filters]]). Lista nu are filtre de „Importanță” sau „Relevanță”.

„Câmpuri afișate” adaugă coloane la tabel, cel mult patru odată. Numele sunt scurte; țineți mouse-ul pe unul și vedeți numele întreg al câmpului. Le puteți alege dintre:

- „CNP”
- „Născut pe” — data nașterii
- „Vârstă”
- „Gen”
- „Decedat pe” — data decesului
- „Născut la” — locul nașterii
- „Tip prof.” — tipul profesional
- „Rel.cu VM” — relația cu firma
- „Modificat la” — ziua în care persoana a fost schimbată ultima oară (adăugarea contează ca schimbare)

Butonul arată câte coloane ați ales, de exemplu „Câmpuri afișate 2/4”. Alegerea rămâne până o schimbați.

Câteva semne de pe rânduri:

- „Nou!” stă lângă o persoană adăugată sau schimbată de curând.
- „†” după nume înseamnă că persoana a murit; dacă treceți cu mouse-ul peste el, scrie „Decedat” (secțiunea [[persons-identity]]).
- ID-ul de sistem al persoanei nu apare în listă; îl vedeți pe ecranul ei, în colțul fișei „Identitate”.

Fiecare rând are patru butoane:

| Butonul | Ce face |
|---|---|
| „Previzualizare” | Arată, lângă listă, un rezumat scurt: numele, apoi porecla și CNP-ul, apoi „născut:” (sau „născută:”) cu data și locul nașterii. |
| „Incursiune” | Arată, lângă listă, fișa „Interacțiuni” a persoanei (secțiunea [[persons-interactions]]). |
| „Legături” | Arată, lângă listă, legăturile persoanei, numai pentru citit (secțiunea [[links-related]]). |
| numele, link | Deschide ecranul persoanei; Ctrl + clic, într-o filă nouă. |

Un al doilea clic pe același buton închide ce a deschis.

### 3.1.1 Filtrele listei {#persons-list-filters}

Lista se filtrează ca lista proprietăților: din pâlnia din colțul numelui unei coloane, cu o etichetă pentru fiecare filtru și „Șterge filtrele” (secțiunea [[properties-list-filters]]). Lângă fiecare valoare dintr-o listă cu bife stă câte persoane o au, numărate cu celelalte filtre deja puse. Filtrele se păstrează în adresa paginii.

Coloanele care se pot filtra, alese în „Câmpuri afișate”:

- **„Tip profesional”** — profesiile din listă, așa cum sunt acum în arhivă (secțiunea [[persons-add-profession]]);
- **„Relația cu firma”** — o persoană trece de filtru dacă are cel puțin una dintre relațiile bifate; „(necompletat)” arată persoanele fără nicio relație;
- **„Gen”** — „F” și „M”, ca în coloană;
- **„Locul nașterii”** — locurile scrise în arhivă, cu bife, ca o localitate;
- **„Data nașterii” și „Data decesului”** — „De la” și „Până la” sau, din „Perioadă…”, „Anul acesta” ori „Ultimele 12 luni”;
- **„Vârstă”** — „De la” și „Până la”. Este vârsta din listă: la o persoană decedată, vârsta la deces.

„Nume”, „Poreclă”, „CNP” și „Modificat la” nu au pâlnie; „Modificat la”, „Născut pe”, „Vârstă” și „Decedat pe” ordonează lista (secțiunea [[start-lists]]). O persoană se găsește după CNP cu caseta de căutare: scrieți CNP-ul sau o parte din el.

## 3.2 O persoană adăugată de mână {#persons-add}

Pe lista persoanelor fizice, apăsați „Adaugă persoană” — butonul din dreapta, deasupra tabelului, fără cuvinte: un + și persoana, pictograma listei din bara laterală, cu câteva raze; ținut sub mouse, își arată numele întreg. Se deschide direct ecranul „Persoană fizică nouă”, un formular gol împărțit în fișe (Figura [[fig-persons-new]]).

![3.1 Formularul unei persoane fizice noi](persons-new.png){#fig-persons-new}

### 3.2.1 Fișele formularului {#persons-add-tiles}

| Fișa | Ce cuprinde |
|---|---|
| „Identitate” | Pe rânduri: „Nume” și „Prenume”; „Poreclă”, singură; „CNP” și „Cetățenie”; „Data nașterii”, „Vârstă” și „Gen”; „Decedat” și „Data decesului”; „Locul nașterii”, cât fișa de lată; „Tip profesional”; „Note”. |
| „Acte de identitate” | Pe o persoană salvată: cărțile ei de identitate și pașapoartele, fiecare un act al ei (secțiunea [[persons-identity-documents]]). Pe „Persoană fizică nouă” nu apare: nu există încă persoana care să le dețină. |
| „Contact” | Telefoanele și adresele de e-mail. |
| „Adrese” | „Adresă domiciliu” și „Adresă corespondență”. |

„Gen” se scrie cu o literă: „M” sau „F” — în formular, pe ecranul persoanei, în coloana „Gen” a listei și în fereastra cărții de identitate. Ținut sub mouse, arată cuvântul întreg, „Masculin” sau „Feminin”. „Relația cu firma” ține tot rândul ei din „Identitate”, cu bifele una după alta. „Cetățenie” stă lângă „Locul nașterii”.

Bifele din „Panouri” arată sau ascund fișe, ca pe orice obiect (secțiunea [[start-tiles]]). O fișă ascunsă nu își pierde datele: ce ați scris în ea se salvează la fel.

### 3.2.2 Salvarea {#persons-add-save}

Singurul lucru cerut este numele: completați cel puțin „Nume” sau „Prenume”. Restul se poate completa și mai târziu. Dacă știți CNP-ul, scrieți-l acum: după salvare nu se mai poate schimba (secțiunea [[persons-identity]]).

1. Completați „Nume” și „Prenume”, apoi ce mai știți despre persoană.
2. Apăsați „Salvează”.
3. Aplicația vă întoarce la listă. Persoana nouă este sus, cu „Nou!” lângă nume.

Dacă un câmp cerut a rămas gol într-o fișă ascunsă, la salvare fișa reapare, aplicația vă duce la câmpul acela și scrie dedesubt ce lipsește. Nu se salvează nimic până nu îl completați.

Mai târziu, o persoană se modifică pe ecranul ei, fișă cu fișă: „Editează” pe fișa de schimbat, câmpurile, apoi „Salvează”-ul fișei (secțiunea [[start-read-edit]]). Fiecare salvare face o versiune nouă (secțiunea [[links-versions]]). Ca să ștergeți o persoană, apăsați „Șterge” și răspundeți „Da” la întrebarea „Ștergeți persoana?”; ștergerea nu se poate anula.
### 3.2.3 Tipul profesional și relația cu firma {#persons-add-profession}

În fișa „Identitate”, două câmpuri spun cine este persoana pentru firmă:

- **„Tip profesional”** — profesia ei, una singură: Notar, Avocat, Executor judecătoresc, Topograf / expert cadastral, Evaluator, Expert tehnic / judiciar, Agent imobiliar, Arhitect / proiectant, Constructor / meșter, Funcționar public, Contabil / consultant fiscal, Fermier / arendaș sau Persoană privată. O firmă, o instituție sau un ONG nu este persoană fizică: se adaugă ca persoană juridică (secțiunea [[companies-add]]);
- **„Relația cu firma”** — de ce este persoana în arhivă, cu câte o bifă pentru fiecare: Client, Vânzător de teren, Cumpărător, Moștenitor / familie, Colaborator, Vecin, Contact instituțional. O persoană poate avea mai multe bife.

Amândouă stau în „Identitate” și se salvează cu „Salvează”-ul ei. „Tip profesional” intră în versiunile persoanei; „Relația cu firma” nu: pe o versiune mai veche arată bifele de acum, iar sub ea scrie „Relația cu firma nu are versiuni: arată valorile de acum.”. Listele de valori se schimbă în „Date de referință” (secțiunea [[admin-reference-data]]).

## 3.3 O persoană dintr-o carte de identitate {#persons-id-card}

O carte de identitate românească — buletinul vechi, mai ales — tipărește și prenumele părinților. Aplicația se folosește de asta: odată cu titularul cărții, poate crea tatăl și mama și îi leagă de el ca „Tată” și „Mamă”. Se face în două feluri. Ce ține persoana și ce ține actul ei de identitate, vedeți în secțiunea [[persons-identity-documents]].

### 3.3.1 La adăugarea de mână {#persons-id-card-manual}

1. Pe ecranul „Persoană fizică nouă”, completați titularul: „Nume”, „Prenume”, „Gen” și ce mai aveți de pe carte.
2. Sub câmpurile fișei „Identitate” stă „Părinții titularului”, cu cele două rânduri nebifate.
3. Bifați „Creează și tatăl” și scrieți-i prenumele. Bifați „Creează și mama” și scrieți-i prenumele.
4. Numele de familie al fiecărui părinte este completat cu al titularului și marcat „Numele titularului, presupus — verificați-l: al mamei poate fi cel de dinainte de căsătorie.” Corectați-l dacă știți altul.
5. Apăsați „Salvează”. Titularul se creează întâi.
6. Urmează câte o fereastră pentru fiecare părinte bifat: „Tatăl titularului”, „Părintele 1 din 2”, apoi „Mama titularului”, „Părintele 2 din 2”.

Fără CNP, aplicația caută părintele doar după nume, iar fereastra vă spune asta. Dacă nu găsește pe nimeni, scrie „Persoană nouă”: apăsați „Creează și leagă”. Dacă găsește persoane cu nume asemănător, le arată ca sugestii, nu ca potriviri sigure: alegeți „Leagă această persoană” doar dacă este într-adevăr același om, altfel „Niciuna — creează persoană nouă”. „Omite” trece peste părintele acela.

La sfârșit vă întoarceți la lista persoanelor. Pe ecranul titularului, în „Legături”, tatăl apare cu „(Tată)” și mama cu „(Mamă)”; pe ecranul tatălui, titularul apare cu „(Fiu)” sau „(Fiică)”. La fiecare părinte creat astfel, „Proveniență” este „Din actul de identitate al unei rude”, iar „Note” spune din cartea cui a fost creat.

### 3.3.2 Dintr-o carte de identitate aflată în arhivă {#persons-id-card-document}

Când cartea de identitate este deja un act în arhivă, cu scanarea ei ca pagină, persoanele se creează de pe ecranul actului.

1. Deschideți actul de identitate: o „Carte de Identitate (tip nou)”, o „Carte de Identitate (tip vechi)”, un „Pașaport” sau un „Pașaport CRDS”.
2. Apăsați „Creează persoane din CI”, lângă „Modifică”. Aplicația citește cartea de pe prima pagină și deschide fereastra „Creează persoană din cartea de identitate”.
3. Verificați titularul și apăsați „Creează și leagă”. Dacă titularul există deja în arhivă, aplicația îl găsește după CNP și nu face o a doua persoană.
4. În „Părinții titularului”, tatăl și mama citiți de pe carte sunt deja bifați, cu numele de familie al titularului, marcat ca presupus. Verificați-i, apoi apăsați „Creează și leagă” pentru fiecare.
5. Sub buton, aplicația scrie ce a făcut: „Titularul a fost creat și legat de act.”, „Tatăl: creat(ă) și legat(ă)”, „Mama: creat(ă) și legat(ă)”.

Titularul este legat de act ca „Titular act de identitate”, iar părinții sunt legați de titular ca „Tată” și „Mamă”. Ce a tipărit actul se scrie pe act, în fișa lui „Act de identitate”; pe persoană ajung numele, CNP-ul, genul, nașterea și cetățenia, iar o persoană care exista deja primește doar câmpurile pe care nu le avea completate. Dacă citirea nu găsește prenumele părinților, cele două rânduri apar goale și nebifate, cu nota „Cartea nu tipărește prenumele părinților, sau citirea nu le-a găsit…”: le puteți scrie voi.

Cum citește aplicația o carte de identitate la importul unui dosar întreg, vedeți în secțiunea [[import-scanning]].

### 3.3.3 Actele de identitate: ce ține persoana și ce ține actul {#persons-identity-documents}

Arhiva cunoaște patru feluri de acte de identitate. Fiecare este un tip de act, cu câmpurile lui, așa cum le tipărește actul (secțiunea [[documents-identity]]):

| Tipul | Ce are al lui |
|---|---|
| „Carte de Identitate (tip vechi)” | Buletinul-carnet: „Prenumele tatălui”, „Prenumele mamei”, „Starea civilă”, „Lucrătorul care a eliberat-o”. Fără CNP, fără „Valabil până la”, fără MRZ. |
| „Carte de Identitate (tip nou)” | Cartea plastifiată sau electronică: „CNP”, „Sex”, „Valabil până la”, „MRZ” și, dacă e tipărit, „Nr. card”. |
| „Pașaport” | „Tip”, „Codul țării”, „Nr. pașaportului”, „CNP”, „MRZ” și „Domiciliu — județul”. |
| „Pașaport CRDS” | La fel ca pașaportul, dar cu „Domiciliu — țara”: al celui care locuiește în străinătate. |

Regula: **persoana ține ce este adevărat despre ea, oricare act l-ar purta; fiecare act ține ce a tipărit el.** Numele, CNP-ul, data și locul nașterii, genul și cetățenia stau în „Identitate”, câte o valoare. Seria și numărul, datele, emitentul și tot restul de pe act stau pe actul de identitate.

Pe ecranul unei persoane, fișa „Acte de identitate” îi arată actele (Figura [[fig-persons-identity-documents]]):

- pentru fiecare act: felul lui („CI”, „CI vechi”, „Pașaport” sau „Pașaport CRDS”), seria și numărul, „Valabil până la” și starea — „VALABIL”, „EXPIRAT” sau, aproape de expirare, „EXPIRĂ ÎN 30 ZILE”; codul actului îl deschide;
- primul este cel „curent”: cel valabil azi, cu data eliberării cea mai nouă; dacă niciunul nu mai e valabil, cel eliberat ultimul;
- fără niciun act, fișa stă pe un singur rând: „niciun act înregistrat”.

![3.2 Fișa „Acte de identitate” a unei persoane](persons-identity-documents.png){#fig-persons-identity-documents}

Un act nou se adaugă chiar de aici:

1. Apăsați „Adaugă act de identitate”. Aplicația întreabă „Ce act de identitate adăugați?”.
2. Alegeți felul actului și apăsați „Continuă”. Se deschide „Adaugă act”, cu tipul ales, cu persoana ca titular și cu numele, CNP-ul, genul și nașterea ei deja completate.
3. Completați restul de pe act și apăsați „Salvează”. Abia acum se salvează actul, iar persoana este legată de el ca „Titular act de identitate”.

O versiune a persoanei salvată înainte ca actele de identitate să fie acte separate arată, în fișa aceasta, și datele actului pe care le avea atunci — doar de citit, sub numele lor de atunci.

## 3.4 CNP-ul și decesul {#persons-identity}

### 3.4.1 CNP-ul nu se mai schimbă {#persons-identity-cnp}

CNP-ul este ceea ce folosește aplicația ca să recunoască o persoană, de exemplu când citește o carte de identitate (secțiunea [[persons-id-card-document]]). De aceea, odată salvat, nu se mai poate schimba.

Pe o persoană salvată, „CNP” se citește ca orice câmp; după „Editează” pe „Identitate” arată ca oricare altul și puteți scrie în el. Când treceți cu mouse-ul peste el sau intrați în el cu tastatura, apare nota „CNP-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba”; Escape o ascunde. Dacă schimbați totuși CNP-ul și apăsați „Salvează”, sub formular apare, cu roșu, aceeași frază, „Modificări nesalvate” rămâne afișat, iar CNP-ul păstrat este cel vechi.

Un CNP greșit se îndreaptă așa: ștergeți persoana și adăugați-o din nou, cu CNP-ul corect.

### 3.4.2 Decesul {#persons-identity-death}

În fișa „Identitate”, sub „Data nașterii”, stă bifa „Decedat”, nebifată la început. Lângă ea, „Data decesului” se poate completa doar cât timp „Decedat” este bifat; data nu este obligatorie.

1. Deschideți persoana, apăsați „Editează” pe „Identitate” și bifați „Decedat”.
2. Scrieți „Data decesului”, dacă o știți.
3. Apăsați „Salvează”, sub câmpurile fișei.

După deces, „Vârstă” nu mai crește: arată vârsta la moarte, urmată de „†” — de exemplu „76 †”. O persoană bifată „Decedat”, dar fără dată, are „Vârstă” „—”. În liste, „†” apare după numele ei.

Aplicația refuză o dată de deces care nu are sens și scrie sub câmp de ce:

- „„Data decesului” nu poate fi înainte de „Data nașterii”.”
- „„Data decesului” nu poate fi în viitor.”

Dacă ați bifat „Decedat” din greșeală, debifați-l și salvați: data decesului se golește, iar „Vârstă” arată din nou vârsta de azi.

## 3.5 Rudele și arborele de moștenire {#persons-relatives}

### 3.5.1 O rudă legată din „Legături” {#persons-relatives-link}

Fișa „Legături” a unei persoane strânge tot ce este legat de ea: persoane, proprietăți și acte (secțiunea [[links-related]]). O rudă se leagă de aici.

1. Pe ecranul persoanei, în „Legături”, apăsați „Asociază persoană”. Se deschide „Asociere persoană corelată”.
2. Găsiți ruda după „Nume” și bifați-o.
3. La „Rol”, alegeți ce este persoana bifată pentru cea de pe ecran — de exemplu „Părinte”, „Fiu”, „Fiică”, „Soț”, „Soție”, „Frate”, „Soră”. Fraza de lângă „Rol” vă amintește sensul: „Rolul pe care persoana bifată îl are față de …”.
4. Apăsați „Asociază selecția”. Vă întoarceți pe ecranul persoanei, iar ruda apare în „Legături”, cu rolul în paranteză.

Legătura se citește corect din ambele capete. Dacă Ion este „Părinte” pentru Ana, pe ecranul lui Ion Ana apare ca „Fiică”: fiecare capăt arată rolul celuilalt, la genul lui. Pentru o persoană fără „Gen” completat, aplicația folosește forma neutră, de exemplu „Copil”. Perechile de roluri se stabilesc în „Date de referință”, la „Roluri Persoane”, în coloana „Rol invers” (secțiunea [[admin-reference-data]]).

O legătură se scoate din „Legături”: alegeți rândul și apăsați „Dezasociază”.

### 3.5.2 Fișa „Arbore de moștenire” {#persons-relatives-tree}

Fișa „Arbore de moștenire”, albastru deschis, desenează familia persoanei: părinții și bunicii până la străbunici, copiii până la strănepoți, frații și soțul sau soția (Figura [[fig-persons-tree]]). Dacă nu o vedeți, bifați „Arbore de moștenire” în „Panouri”.

![3.3 Fișa „Arbore de moștenire” a unei persoane](persons-tree.png){#fig-persons-tree}

În arbore intră doar legăturile cu un rol de rudenie — rolurile marcate „Rudenie” în „Roluri Persoane”. O persoană fără astfel de legături arată „Nicio legătură de familie încă.”.

Sub desen, butonul „Adaugă sau scoate” deschide panoul legăturilor de familie; țineți mouse-ul pe el și vedeți numele lui întreg, „Adaugă sau scoate o rudă”. Când ajungeți la persoană din „Rapoarte” → „Arbori de moștenire”, cu un clic pe numele ei (secțiunea [[reports-inheritance]]), panoul este deja deschis.

- „Legăturile de familie ale persoanei” arată rudele ei, fiecare cu rolul.
- Ca să adăugați o rudă: la „Ruda”, scrieți numele și alegeți persoana; la „Ce este pentru …”, alegeți rudenia; apăsați „Adaugă legătura”. Ruda apare în desen.
- Ca să scoateți o rudă: apăsați „Scoate legătura cu …”, apoi „Scoate”. Ruda dispare din desen și din listă.

Legăturile adăugate aici sunt aceleași cu cele din „Legături”: o rudă legată într-un loc apare și în celălalt.

## 3.6 Interacțiunile unei persoane {#persons-interactions}

Fișa „Interacțiuni” este istoricul a ce s-a petrecut cu persoana: telefoane, e-mailuri, întâlniri. Pornește din dreapta ecranului, mov deschis, se trage în alt loc ca orice fișă și este bifată de la început; bifa ei este ultima din „Panouri”. Fișa este cât ce ține, ca „Legături”: o persoană fără interacțiuni arată doar „Nicio interacțiune înregistrată cu această persoană.” și butonul de sub ea; cu câteva, istoricul are înălțimea rândurilor lor, iar de la o vreme nu mai crește și se derulează în el. „Deschide în „Interacțiuni”” duce la ecranul cu toate interacțiunile.

Sub istoric, butonul „Înregistrează o interacțiune” deschide formularul, deja legat de persoana aceasta:

1. Apăsați „Înregistrează o interacțiune”.
2. Alegeți canalul, de exemplu „Telefon” — receptorul —, și scrieți subiectul. Butoanele formularului au doar pictograme; numele lor îl citiți ținând mouse-ul pe ele (secțiunea [[reports-interactions-log]]).
3. Apăsați „Salvează” — bifa. Apare „Interacțiune înregistrată”, iar interacțiunea apare în istoric.

Un clic pe o interacțiune din istoric o deschide în formular: schimbați ce trebuie și apăsați „Salvează modificările”, sau apăsați „Șterge interacțiunea”, apoi „Șterge”. „Restrânge” strânge formularul la loc.

Din lista persoanelor, „Incursiune” arată doar istoricul; un clic pe o interacțiune de acolo deschide ecranul persoanei, cu interacțiunea în formular. Ecranul „Interacțiuni”, cu filtrele lui, este descris în secțiunea [[reports-interactions]].

Fișa „Interacțiuni” se poate pune și în stânga, sub celelalte fișe: apucați-o de spațiul ei gol și trageți-o acolo (Figura [[fig-persons-interactions-moved]]). Locul ei se păstrează pentru toate persoanele.

![3.4 Fișa „Interacțiuni” trasă din dreapta în stânga ecranului, sub celelalte fișe](persons-interactions-moved.png){#fig-persons-interactions-moved}

## 3.7 Exemple și cazuri de utilizare {#persons-examples}

### 3.7.1 Adăugați o persoană de pe cartea ei de identitate, împreună cu părinții {#persons-example-parents}

Aveți în față cartea de identitate a unei persoane care nu este încă în arhivă.

1. „Persoane Fizice” → „Adaugă persoană” (secțiunea [[persons-add]]).
2. Completați numele, prenumele, genul, CNP-ul și data nașterii de pe carte.
3. Sub „Identitate”, în „Părinții titularului”, bifați „Creează și tatăl” și „Creează și mama” și scrieți prenumele lor (secțiunea [[persons-id-card-manual]]).
4. Verificați numele de familie al mamei: poate fi cel de dinainte de căsătorie.
5. „Salvează”, apoi „Creează și leagă” pentru fiecare părinte.
6. Deschideți persoana: în „Legături” are un „(Tată)” și o „(Mamă)”.
7. Tot pe ecranul ei, în „Acte de identitate”, apăsați „Adaugă act de identitate” și adăugați cartea de identitate pe care o aveți în față (secțiunea [[persons-identity-documents]]).

### 3.7.2 Notați decesul unei persoane {#persons-example-death}

Aflați dintr-un certificat de moștenitor că o persoană din arhivă a murit.

1. Găsiți persoana în lista „Persoane Fizice” și apăsați numele ei (secțiunea [[persons-list]]).
2. Apăsați „Editează” pe „Identitate”, bifați „Decedat” și scrieți „Data decesului” (secțiunea [[persons-identity-death]]).
3. „Salvează”. „Vârstă” arată acum vârsta la deces, cu „†”.
4. Înapoi în listă, „†” stă după numele ei.

### 3.7.3 Legați un fiu de tatăl lui și verificați arborele {#persons-example-tree}

Două persoane sunt în arhivă, dar nimic nu spune că sunt tată și fiu.

1. Deschideți fiul.
2. În „Arbore de moștenire”, apăsați „Adaugă sau scoate” (secțiunea [[persons-relatives-tree]]).
3. La „Ruda”, alegeți tatăl; la „Ce este pentru …”, alegeți „Tată”; apăsați „Adaugă legătura”.
4. Tatăl apare în desen deasupra fiului, iar în „Legături” fiecare îl vede pe celălalt (secțiunea [[persons-relatives-link]]).

### 3.7.4 Notați o convorbire telefonică {#persons-example-call}

O persoană a sunat să întrebe de contractul de vânzare-cumpărare pentru un teren din Bragadiru.

1. Deschideți persoana.
2. În „Interacțiuni”, apăsați „Înregistrează o interacțiune” (secțiunea [[persons-interactions]]).
3. Alegeți „Telefon”, scrieți subiectul, apoi apăsați „Salvează”.
4. Convorbirea apare în istoricul persoanei și pe ecranul „Interacțiuni” (secțiunea [[reports-interactions]]).
`;
