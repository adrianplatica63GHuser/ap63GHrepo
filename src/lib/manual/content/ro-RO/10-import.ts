/**
 * Manual, ro-RO, chapter 10. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 10 Import {#import}

Importul aduce în arhivă un dosar întreg de pe calculator: câte un folder pentru fiecare proprietate, cu scanările actelor ei, fișierul ei de coordonate și cărțile de identitate ale oamenilor din acte. Din el se fac documentele, proprietățile cu colțurile lor și, cu confirmarea dumneavoastră, persoanele. Capitolul spune ce hotărâți la fiecare pas și de ce.

## 10.1 Cum decurge importul {#import-overview}

În bara laterală, deschideți „Import”, apoi „Dosare de proprietăți”. Ecranul „Import” arată sus pașii, pe două linii (Figura [[fig-import-steps]]):

| Linia | Pașii |
|---|---|
| Pregătire și verificare | „Informare”, „Precondiții”, „Structură”, „Restricții”, „Duplicate” |
| Clasificare și import | „Deja în sistem”, „Scanare”, „Evaluare”, „Import”, „Rezultat” |

Primii cinci pași se uită doar în folderul ales; de la „Deja în sistem” încolo, sistemul se uită și în arhivă.

![10.1 Importul, la primul pas: cele două linii de pași](import-steps.png){#fig-import-steps}

„Informare” spune, în caseta „Cum decurge importul”, ce ține pentru tot restul:

- **Sistemul nu vă atinge fișierele.** Nu le mută, nu le redenumește și nu le șterge niciodată. Când găsește ceva de îndreptat, se oprește și vă spune ce; faceți schimbarea în File Explorer, reveniți și apăsați din nou butonul de verificare. Nu este o defecțiune — așa este gândit importul.
- Nimic nu intră în arhivă până la pasul „Import”, iar până atunci puteți renunța oricând.

Apăsați „Am înțeles”. „Precondiții” verifică singur opt lucruri — printre ele, că browserul poate deschide un folder de pe calculator (Google Chrome sau Microsoft Edge) și că aveți drepturi de import. Un rând cu „problemă” spune ce este de făcut; ce ține de sistem rezolvă administratorul.

Fiecare pas de verificare se lucrează la fel: citiți regulile, bifați că le-ați citit, apăsați butonul de verificare. Bifa se cere din nou la fiecare verificare, deci și după fiecare îndreptare. Butonul „Salvează … ca pagină” al pasului descarcă regulile și lista lucrurilor de îndreptat, ca să le aveți în față cât lucrați în File Explorer.

### 10.1.1 Cele două bife din capul ecranului {#import-overview-ticks}

Amândouă sunt bifate când deschideți importul:

- „Oprește-te după fiecare pas” — importul se oprește după fiecare pas fără nimic de îndreptat și merge mai departe când apăsați „Continuă la pasul „…””. Cât citiți, nu se consumă nimic. Nebifată, trece singur peste acești pași.
- „Începe fiecare pas cu regulile la vedere” — fiecare pas începe cu regulile lui deschise, iar după verificare ele se strâng, ca să rămână în față ce aveți de îndreptat. „Arată regulile” și „Ascunde regulile” le schimbă oricând.

La primele importuri lăsați-le bifate: așa vedeți tot ce se întâmplă.

### 10.1.2 „Renunță la import” {#import-overview-cancel}

„Renunță la import”, sus, oprește importul la orice pas și vă întoarce la „Informare”; tot așa alegeți alt folder după ce importul a pornit. Întâi întreabă „Renunțați la import?” și spune ce rămâne în urmă: fișierele de pe calculator rămân neatinse; ce s-a clasificat se pierde și, la reluare, se plătește din nou; documentele și proprietățile deja create rămân în arhivă. „Da, renunț la import” renunță, „Nu, continui importul” vă lasă unde erați.

## 10.2 Cum trebuie să arate dosarul {#import-folder}

La pasul „Structură” alegeți folderul. Citiți regulile, bifați „Respect regulile de structură” și apăsați „Alege folderul…”, apoi alegeți folderul în fereastra Windows. Verificarea răspunde „Structura folderului este în regulă.” sau listează lucrurile de îndreptat, fiecare cu folderul în cauză și cu ce este de făcut.

### 10.2.1 Regulile de structură {#import-folder-structure}

| Unde | Regula |
|---|---|
| Folderul ales | Conține numai foldere: câte unul pentru fiecare proprietate, plus, dacă vă trebuie, „comune” și „flotante”. Niciun fișier direct în el. Numărul de proprietăți are o limită, scrisă în regulă. Două foldere nu pot însemna aceeași proprietate. |
| Un folder de proprietate | Numele este tarlaua, o liniuță, parcela și, dacă vreți, încă o liniuță și o descriere. „per” ține locul semnului „/”, interzis în numele unui folder: tarlaua 40, parcela 212/40 se scrie „40-212per40”. Cel mult un fișier de coordonate, .txt, cu numele început cu „coord”; fără el, proprietatea se creează fără contur. |
| Un folder de pagini | Paginile unui document scanat stau într-un subfolder al cărui nume este titlul documentului. Conține numai fișiere numite doar cu un număr — 1.jpg, 2.jpg, 3.jpg —, fără două la fel și fără sărituri. |

Un fișier aflat direct în folderul proprietății este un document în sine, cu denumirea lui ca titlu.

Când structura este în regulă, „Cum a fost citit numele fiecărui folder de proprietate” arată tarlaua, parcela și restul numelui. Uitați-vă: din același nume se face și eticheta documentelor. Dacă nu este cum vă așteptați, redenumiți folderul și verificați din nou. Un nume fără „per”, ca „48-50D”, devine întrebarea „Acest folder este o proprietate?”: răspundeți „Da, este o proprietate” sau „Nu este o proprietate”.

### 10.2.2 Fișierele refuzate și cele ignorate {#import-folder-files}

„Restricții” verifică același folder: bifați „Am citit restricțiile privind fișierele” și apăsați „Verifică fișierele”. Se importă scanări, fotografii, PDF-uri, documente Word, Excel și OpenOffice și fișiere text. Sunt refuzate și trebuie înlocuite sau scoase din folder:

- tabelele .csv — salvați-le ca PDF;
- fotografiile de iPhone (.heic) — copiați-le din nou de pe telefon, ca .jpg;
- fișierele pe care sistemul nu le recunoaște, de exemplu fără terminație;
- fișierele goale, de 0 KB, și cele peste limita de mărime scrisă pe ecran;
- o scanare numită „folder.jpg”, nume pe care Windows îl folosește pentru iconița folderului.

Fișierele de sistem Windows, cele ascunse, desenele, arhivele și copiile de siguranță sunt ignorate, fără să vă oprească. Fișierele Word și Excel se păstrează, dar conținutul lor nu poate fi citit sau căutat.

### 10.2.3 Folderele „comune” și „flotante” {#import-folder-shared}

- „comune” — documente care privesc toate proprietățile din import; fiecare este legat de fiecare proprietate.
- „flotante” — documente care nu privesc nicio proprietate; se salvează etichetate, dar nelegate.

Niciunul nu este obligatoriu. Se scriu exact așa, cu litere mici („Comune” este o greșeală pe care verificarea o arată), și nu conțin fișiere de coordonate.

## 10.3 Duplicate și „Deja în sistem” {#import-duplicates}

„Duplicate” compară fișierele din folderul ales între ele; „Deja în sistem” compară folderul cu arhiva.

### 10.3.1 Copiile din folder {#import-duplicates-copies}

Bifați „Am citit ce se consideră duplicat” și apăsați „Caută duplicate”. Sistemul găsește același fișier de mai multe ori — după nume și mărime, trecând peste „ - Copie” pe care o adaugă Windows — și același document în două foldere de pagini, după pagini, chiar dacă folderele se numesc altfel. Spune că fișierele par la fel, nu că sunt: uitați-vă la ele înainte să scoateți ceva. Păstrați copia din locul potrivit; dacă sunt documente diferite, redenumiți-l pe unul.

### 10.3.2 Documentele aflate deja în arhivă {#import-duplicates-archive}

Bifați „Am citit ce se întâmplă cu documentele care se află deja în sistem” și apăsați „Vezi ce se află deja în sistem”. Pasul nu oprește nimic: spune doar ce se va întâmpla.

Un document este deja în sistem când arhiva are unul adus cu aceeași denumire — a fișierului sau a folderului de pagini — și cu aceleași fișiere, de aceleași mărimi. Atunci:

- dacă stă într-un folder de proprietate, documentul din arhivă este legat de proprietate, nu importat a doua oară; altfel nu se întâmplă nimic cu el;
- o carte de identitate se importă totuși: cea din arhivă poate fi expirată, iar o persoană de două ori este mai puțin grav decât una lipsă — verificați persoanele după import;
- fișierul de coordonate se importă totuși, pentru că orice colț trebuie să arate din ce document a fost citit.

Fiecare rând arată codul și titlul documentului din arhivă. Dacă nu este cel la care vă gândeați, redenumiți fișierul sau folderul de pagini și va fi importat ca document nou. Ce se află deja în sistem nu se trimite la clasificare și nu se citește, așa că reimportul costă puțin.

Sub listă, ecranul spune câte imagini vor fi trimise spre clasificare la butonul următor: „acesta este primul pas care costă”. Mai jos, „De verificat înainte de a continua” arată fișierele ignorate și observațiile despre folder; citiți-l, pentru că unele observații spun să nu porniți importul.

## 10.4 Scanarea și ce citește AI-ul {#import-scanning}

AI-ul lucrează la import de două ori: la „Scanare” recunoaște tipul fiecărui document, iar după „Importă” citește fiecare document și îi completează formularul. Un act adăugat de mână nu trece prin această citire.

### 10.4.1 Clasificarea, la „Scanare” {#import-scanning-classify}

Se trimite doar prima pagină a fiecărui document, atât cât să i se recunoască tipul. Fișierele Word, Excel și text și cele aflate deja în sistem nu se trimit. Tabelul „Cale” · „Descriere AI” · „Status” arată, pe măsură ce sosesc, tipul recunoscut, încrederea („Încredere ridicată”, „Încredere medie”, „Încredere scăzută”) și starea: „Scanat”, „Nescanabil” sau „Deja în sistem”. Un folder de pagini este un singur rând, cu „Grup de 3 pagini”, de exemplu. Nimic nu intră încă în arhivă. La o încredere scăzută, verificați tipul documentului după import.

### 10.4.2 Cele două opriri de după scanare {#import-scanning-stops}

**Actele mai multor persoane pe o scanare.** Importul se oprește: „Importul s-a oprit: o scanare conține actele de identitate ale mai multor persoane”. Din fișier s-ar face un document cu actele mai multor oameni și, într-un folder de proprietate, chiar o persoană amestecată din doi oameni reali, așa că nu există „continuă oricum”. Apăsați „Oprește importul”, împărțiți fișierul în File Explorer — o persoană, un fișier — și porniți din nou. Dacă fișierul stă într-un folder de pagini, scoateți pagina și puneți fiecare carte de identitate ca fișier separat, lângă folder.

**Tipuri de documente fără formular.** Importul se oprește: „Importul s-a oprit: unele tipuri de documente nu au încă formular”, cu tipurile și fișierele lor. Aveți două drumuri:

- „Oprește importul”, faceți formularele în „Distilare Tipizate” (secțiunea [[tools-doc-type-engine]]) și reluați importul de la început. Verificările de dinainte nu costă nimic, dar clasificarea se plătește a doua oară. Legătura „Creați formularul în „Distilare Tipizate”” se deschide într-o filă nouă.
- „Continuă fără formulare”: documentele se creează cu scanările lor, câmpurile proprii tipului rămân necompletate, iar ce se citește pentru ele ajunge în Note. Tipurile noi se creează fără formular. Clasificarea nu se plătește a doua oară.

Fișierele care nu au primit niciun tip ajung la tipul „neclasificat” și nu opresc importul.

### 10.4.3 Ce citește AI-ul și ce nu {#import-scanning-read}

După „Importă”, fiecare document creat este citit de AI, iar câmpurile formularului se completează singure — la un contract de vânzare-cumpărare, de exemplu, prețul cu moneda și data autentificării. Ce nu are loc într-un câmp rămâne o notă scurtă în „Note extinse”, iar „Stare procesare” arată „Procesat cu AI” (secțiunea [[documents-identification]]). Uneori citirea îi dă documentului titlul tipărit pe el. Înscrisurile pe care le citează documentul vă așteaptă răspunsul (secțiunea [[links-references-documents]]).

AI-ul nu citește fișierele Word, Excel, .rtf și .txt; o carte de identitate are citirea ei, mai jos, iar un plan parcelar se mai citește o dată, pentru tarla lui; o imagine cu actele mai multor persoane nu se citește deloc. Și nu creează, nici nu leagă vreo persoană fără confirmarea dumneavoastră.

### 10.4.4 Cărțile de identitate și persoanele propuse {#import-scanning-people}

Spre sfârșitul importului se deschid, pe rând, două feluri de ferestre.

„Creează persoană din cartea de identitate” („Card 1 din 2”, de exemplu) arată numele, CNP-ul, „Serie și număr” și „Eliberat de”, citite de pe carte, și caută titularul în arhivă după CNP. Dacă îl găsește, „Persoana există deja”: comparați datele și apăsați „Confirmă și leagă”. Dacă nu, „Persoană nouă”: apăsați „Creează și leagă”. Persoanele cu nume asemănător apar la „Potriviri posibile”, ca sugestii, nu ca potriviri sigure. Titularul este legat de carte ca „Titular act de identitate”. Sub el, „Părinții titularului” propune tatăl și mama de pe carte, legați apoi de titular ca „Tată” și „Mamă” (secțiunea [[persons-id-card]]).

„Confirmați persoanele din acest document” arată, una câte una, persoanele găsite de AI într-un document — vânzătorii, cumpărătorul, notarul —, cu rolul fiecăreia. Alegeți „Da, asociază această persoană” pentru cineva din arhivă, „Creează și asociază” sau „Nu, creează o persoană nouă” pentru cineva nou, ori „Omite”.

Pentru o firmă nouă al cărei CUI l-a citit AI-ul, fereastra are și „Completează din ANAF” (secțiunea [[companies-add-anaf]]). Apăsat, arată ce ar completa ANAF față de ce a citit AI-ul — numărul de la registrul comerțului, telefonul, tipul, adresa sediului —, cu aceleași bife: câmpurile goale bifate, cele citite altfel doar dacă le bifați. La „Creează și asociază”, firma se creează cu valorile bifate, deci ajunge în arhivă completă.

**Răspundeți atunci.** După ce închideți fereastra importului, persoanele găsite în documente nu mai sunt oferite: „După ce închideți, nu mai există unde.” Unei cărți de identitate rămase fără răspuns îi rămâne „Creează persoane din CI”, pe ecranul actului (secțiunea [[persons-id-card-document]]).

### 10.4.5 Planurile parcelare și tarla lor {#import-scanning-tarla}

Un document de tipul „Plan Parcelar” se citește a doua oară, numai pentru tarla lui: localitatea, codul tarlalei și parcelele desenate, fiecare cu numărul, suprafața în m² și folosința, când sunt tipărite. Proprietarii de pe plan nu se citesc și nu se păstrează. Ecranul „Import” spune dinainte că citirea aceasta se plătește: „Planul parcelar se citește încă o dată, pentru tarla lui.”

După ferestrele persoanelor se deschide, pentru fiecare plan, „Tarla din planul parcelar”. Arată ce s-a citit: „Tarla”, „Localitate” și „Județ”, pe care le puteți corecta, apoi parcelele, iar sub ele ce nu s-a putut citi. Propunerea urmează codul și localitatea de deasupra:

- când tarla cu acest cod există deja în localitate (secțiunea [[properties-tarla]]), „Leagă planul de tarla” leagă planul de ea și îi adaugă parcelele pe care nu le are. Parcelele pe care le are rămân cum erau;
- când nu există, „Creează tarla și leagă planul” o creează, cu parcelele ei;
- „Sari peste” nu scrie nimic.

Nimic nu se scrie înainte să apăsați. Pe rândul documentului rămâne ce s-a întâmplat, de exemplu „tarla TCP9 creată, cu 4 parcele”, și tot așa în raportul salvat.

## 10.5 Evaluare, import și rezultat {#import-result}

### 10.5.1 „Evaluare” {#import-result-evaluation}

„Ce va face acest import” spune în cifre ce urmează: „Documente care vor fi create”, „Documente aflate deja în sistem (se leagă, nu se creează)”, „Imagini pentru clasificare automată”, „Fișier de coordonate”, „Fișiere care vor fi ignorate”, „De încărcat”. Un folder de pagini este un singur document; fișierul de coordonate se numără și el, ca document în sine. Nimic nu s-a salvat încă.

Dacă un folder de proprietate are un fișier cu posibile coordonate al cărui nume nu începe cu „coord”, ecranul vă spune. Redenumiți-l și apăsați „Verifică din nou folderul (clasificarea de până acum se pierde)” — exact ce scrie: clasificarea plătită se pierde. Altfel continuați; colțurile se pot adăuga și mai târziu.

### 10.5.2 „Import”: butonul care scrie în arhivă {#import-result-run}

Ecranul „Import” arată „Ce se întâmplă când apăsați „Importă”” și prețul, de exemplu „Citirea AI se plătește: cel mult 2 documente vor fi citite.” „Importă” este primul buton care scrie în arhivă. Urmează:

1. „Proprietățile acestui import” — fiecare folder de proprietate, cu tarlaua, parcela, documentele și fișierul de coordonate. O proprietate nouă se creează cu colțurile din fișier. Una care există deja, găsită după tarla și parcelă, se leagă: bifați „Confirm legarea …”; colțurile ei rămân neschimbate (le schimbați pe ecranul proprietății, secțiunea [[properties-corners]]). Dacă aceeași parcelă are mai multe proprietăți în arhivă, păstrați una singură și apăsați „Încearcă din nou”. Apoi „Continuă”.
2. „Creare etichete din dosare” — fiecare document va fi etichetat cu dosarele lui; etichetele ajută la căutare și nu leagă nimic. „Da, pregătește etichetele”, apoi „Importă Fișierele (3)”.
3. „Se importă fișierele…” — câte un rând pe document, cu ce s-a făcut și cu „Deschide”, apoi ferestrele pentru persoane (secțiunea [[import-scanning-people]]). La sfârșit, „3 documente importate.” și „Închide”.

Un rând cu ⚠ cere atenție, de exemplu o scanare din care n-au ajuns toate paginile. Unde citirea AI n-a reușit, „Încearcă citirea din nou” o reia, ca citire nouă, plătită.

### 10.5.3 „Rezultat” și raportul {#import-result-report}

„Importul s-a încheiat”, iar „Pe scurt” dă cifrele: „Documente create”, „Existau deja și au fost legate de proprietate”, „Proprietăți create sau confirmate pentru acest import”, „Documente citite de AI (inclusiv cărțile de identitate)”, „Persoane găsite de AI și neconfirmate”, „Cărți de identitate fără răspuns”, „Tipuri de documente rămase fără formular” și altele.

„Salvează raportul (HTML)” îl păstrează pe calculator, cu legături spre arhivă. „Închide și vezi proprietățile” deschide lista proprietăților. Deschideți câteva proprietăți și câteva documente: acum este cel mai ușor de corectat ceva. Un import încheiat nu se reia — ar crea documentele a doua oară; pentru alt folder, „Începe alt import”.

### 10.5.4 Revenirea la ultimul import {#import-result-resume}

Pe ecranul importului, „Reia ultimul import (…)”, cu numele folderului, redeschide raportul ultimului import și spune dacă documentele lui mai sunt în arhivă. Este un raport, nu un import: după închiderea filei browserului, aplicația nu mai ajunge la fișiere, așa că rămân doar legăturile. „Import nou” pornește altul.

### 10.5.5 Cât costă un import {#import-result-cost}

Se plătesc două lucruri, anunțate pe ecran înainte de butonul lor:

- la „Scanare”, o clasificare pentru fiecare document imagine sau PDF (dintr-un folder de pagini, doar prima pagină), anunțată la „Deja în sistem”;
- după „Importă”, o citire pentru fiecare astfel de document, cărțile de identitate incluse, anunțată la „Import”. Citirea unei cărți se plătește și dacă apăsați „Omite”.

Fișierele Word, .rtf și .txt și documentele aflate deja în sistem nu costă nimic. Un dosar cu o carte de identitate, un contract de trei pagini și un fișier de coordonate costă patru operații AI: două clasificări și două citiri. Importat a doua oară, neschimbat, nu costă nimic.

## 10.6 Exemple și cazuri de utilizare {#import-examples}

### 10.6.1 Importați dosarul unui teren din Bragadiru {#import-example-first}

Aveți un contract de vânzare-cumpărare scanat pe trei pagini, cartea de identitate a vânzătoarei și fișierul de coordonate al terenului.

1. În File Explorer faceți folderul „Import Bragadiru” și în el „40-212per40-Bragadiru”, cu fișierul „coord …”, cartea de identitate și subfolderul „Contract vanzare 2008”, cu paginile 1.jpg, 2.jpg, 3.jpg (secțiunea [[import-folder-structure]]).
2. „Import” → „Dosare de proprietăți”, „Am înțeles”, „Precondiții” (secțiunea [[import-overview]]).
3. La „Structură”, alegeți „Import Bragadiru” și verificați citirea numelui: tarla 40, parcela 212/40.
4. Treceți prin „Restricții”, „Duplicate” și „Deja în sistem” (secțiunea [[import-duplicates]]): două imagini pentru clasificare.
5. „Scanare” recunoaște cartea și contractul; „Evaluare” anunță trei documente.
6. „Importă”: confirmați proprietatea nouă și etichetele, apoi persoanele (secțiunile [[import-result-run]] și [[import-scanning-people]]).
7. „Închide și vezi proprietățile”: terenul are colțurile, iar în „Acte” cele trei documente.

### 10.6.2 Aduceți un act nou într-un dosar deja importat {#import-example-again}

Ați primit un extras de carte funciară pentru un teren al cărui dosar l-ați importat deja.

1. Puneți extrasul în folderul proprietății, fără să redenumiți nimic altceva, și importați din nou folderul (secțiunea [[import-folder]]).
2. La „Deja în sistem”, documentele vechi apar cu codurile lor, „legate, nu importate din nou”; fișierul de coordonate se importă totuși (secțiunea [[import-duplicates-archive]]).
3. Doar extrasul se clasifică și se citește.
4. Proprietatea există deja: bifați „Confirm legarea …”; colțurile ei rămân.
5. În „Acte”, documentele vechi nu apar de două ori; extrasul și fișierul de coordonate sunt documente noi.

### 10.6.3 Importul s-a oprit pentru un tip fără formular {#import-example-no-form}

După scanare, importul se oprește: „Încheiere de Intabulare” nu are încă formular.

1. Citiți lista tipurilor și a fișierelor lor (secțiunea [[import-scanning-stops]]).
2. Vreți câmpurile completate de acum: faceți formularul în „Distilare Tipizate” (secțiunea [[tools-doc-type-engine]]), apoi „Oprește importul” și reluați-l; clasificarea se plătește a doua oară.
3. Altfel, „Continuă fără formulare”: documentele intră cu scanările, iar ce s-a citit ajunge în Note.
4. La „Rezultat”, „Tipuri de documente rămase fără formular” vă amintește ce a rămas de făcut.
`;
