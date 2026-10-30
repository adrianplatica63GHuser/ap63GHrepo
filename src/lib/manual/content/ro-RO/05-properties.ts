/**
 * Manual, ro-RO, chapter 5. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 5 Proprietăți {#properties}

O proprietate este o parcelă: un teren, cu sau fără construcție. În arhivă o identifică tarlaua și parcela, uneori și numărul cadastral și numărul de carte funciară, iar pe hartă o așază colțurile ei, în ordine. Capitolul acesta arată lista proprietăților, cum adăugați una, ce schimbă tipul ei, cum se lucrează cu colțurile și cu harta unei parcele și cum ajungeți la ea cu telefonul.

## 5.1 Lista proprietăților {#properties-list}

Deschideți „Domeniu” în bara laterală, apoi „Proprietăți”. Se deschide lista „Proprietăți” (Figura [[fig-properties-list]]).

Caseta de căutare din capul listei caută după „Cod”, „Poreclă”, „Nr. cadastru”, „Nr. CF”, „Tarla/Solă” și „Parcelă” — așa scrie și în ea; țineți mouse-ul pe ea ca să citiți textul întreg. Filtrele listei se pun din coloane (secțiunea [[properties-list-filters]]). Sub tabel, „Se afișează … din …” spune câte proprietăți vedeți din câte sunt.

Prima coloană este „Poreclă”, numele pe care îl dați proprietății; „Nou!” stă în ea, după poreclă, și „Încrucișat” după el, la o proprietate cu colțurile încrucișate. Ea se vede întotdeauna și nu apare printre opțiunile din „Câmpuri afișate”; o puteți muta, ca orice coloană, trăgând-o de nume (secțiunea [[start-lists]]). Codul proprietății nu are coloană în listă; îl găsiți pe ecranul proprietății, în colțul primei fișe.

„Câmpuri afișate” adaugă până la patru coloane după „Poreclă”. Puteți alege dintre câmpurile cadastrale și localitate, cu numele lor scurte:

- „Tarla” și „Parcelă”;
- „Supr. Ofic.” și „Supr. Calc.” — cele două suprafețe, oficială și calculată;
- „# CF” și „# Cadastru” — numărul de carte funciară și numărul cadastral;
- „Categ.Folos.” și „Tip Prop.” — categoria de folosință și tipul proprietății, arătate cu numele lor;
- „Localitate”;
- „Modificat la” — ziua în care proprietatea a fost schimbată ultima oară (adăugarea contează ca schimbare).

Butonul arată câte coloane ați ales, de exemplu „Câmpuri afișate 2/4”. Când ați bifat patru, celelalte căsuțe devin gri până debifați una. La început lista arată doar „Tip Prop.”. Alegerea se păstrează în browserul acesta, așa că o regăsiți data viitoare.

În dreapta, deasupra tabelului, stau două butoane: „Hartă completă” — o săgeată spre dreapta și un glob cu meridiane și două repere, fără cuvinte; ținut sub mouse, își arată numele — deschide harta tuturor proprietăților (capitolul [[map]]), iar „Adaugă proprietate” — un + și harta, cu câteva raze, fără cuvinte; ținut sub mouse, își arată numele — creează una nouă (secțiunea [[properties-add]]). Cât timp harta completă e deschisă, bara de navigare arată „Acasă › Proprietăți › Hartă completă”, iar un clic pe „Proprietăți” vă întoarce la listă.

![5.1 Lista proprietăților](properties-list.png){#fig-properties-list}

### 5.1.1 Filtrele listei {#properties-list-filters}

Lista se filtrează după coloanele ei. O coloană aleasă în „Câmpuri afișate” care se poate filtra are o pâlnie mică în colțul din dreapta jos al numelui; un clic pe pâlnie deschide, chiar sub ea, fereastra filtrului coloanei. Lista arată doar proprietățile care trec de toate filtrele odată.

1. Bifați coloana în „Câmpuri afișate”, dacă nu este deja în tabel.
2. Apăsați pâlnia din colțul numelui ei și alegeți ce vreți să vedeți. Lista se schimbă pe loc, fără niciun buton de aplicat.
3. Apăsați în afara ferestrei sau tasta Esc ca s-o închideți.

Pe lista proprietăților se filtrează șapte coloane:

- **„Tarla/Solă”, „Categorie de folosință”, „Tip proprietate” și „Localitate”** — o listă cu bife. Lângă fiecare valoare stă câte proprietăți o au, numărate cu celelalte filtre deja puse, așa că numărul spune câte rânduri ar rămâne. Bifați mai multe valori ca să vedeți proprietățile care au oricare dintre ele. „(necompletat)” înseamnă proprietățile la care câmpul este gol. Caseta „Caută o valoare…” scurtează lista;
- **„Oficială (m²)” și „Calculată (m²)”** — „De la” și „Până la”, oricare dintre ele, sau amândouă;
- **„Parcelă”** — „Conține”: rămân proprietățile a căror parcelă conține ce ați scris.

„Poreclă”, „# Cadastru”, „# CF” și „Modificat la” nu au pâlnie; o proprietate se găsește după ele cu caseta de căutare.

Fiecare filtru pus devine o etichetă rotunjită sub caseta de căutare, pe un rând care apare doar cât timp este pus un filtru, cu numele coloanei și ce ați ales, de exemplu „Tip proprietate” Casă. Un clic pe etichetă redeschide fereastra, chiar sub etichetă, iar X-ul ei scoate filtrul. O pâlnie plină, albastru închis, într-un cerc, arată că lista este filtrată după acea coloană. Un filtru rămâne și dacă îi ascundeți coloana: eticheta lui stă mai departe sub caseta de căutare, așa că lista nu este niciodată filtrată fără să vedeți asta.

„Șterge filtrele”, pe bara de sus, le scoate pe toate deodată, iar rândul etichetelor dispare; căutarea și ordinea listei rămân. Cât timp nu e pus niciun filtru, butonul este gri. Filtrele se păstrează în adresa paginii, ca și căutarea: rămân după ce reîncărcați pagina, după ce vă întoarceți la listă cu „Înapoi” și când trimiteți adresa cuiva.

Capul tabelului are înălțimea a două rânduri, la fel pe cele patru liste, oricâte coloane ați ales. Numele coloanei stă singur la mijloc, pe orizontală și pe verticală, iar pâlnia, la o coloană care se poate filtra, stă în colțul din dreapta jos; la o coloană care ordonează lista — „Modificat la”, „Tarla”, „Parcelă”, „Supr. Ofic.”, „Supr. Calc.” —, pictograma de ordine stă la stânga ei (secțiunea [[start-lists]]). Un nume prea lung pentru coloana lui trece pe al doilea rând; niciun nume nu ia trei rânduri.

## 5.2 O proprietate adăugată de mână {#properties-add}

Apăsați „Adaugă proprietate”. Se deschide fereastra „Adaugă Proprietate”, cu două căi:

| Calea | Ce face |
|---|---|
| Introducere manuală | Completați detaliile proprietății manual. |
| Din fișier text | Încărcați un fișier .txt cu coordonatele colțurilor și alegeți tarlaua și parcela (secțiunea [[properties-coord-file]]). |

Amândouă verifică dacă parcela are deja o proprietate (secțiunea [[properties-add-one-parcel]]). Un dosar întreg, cu acte și coordonate, se aduce prin import (capitolul [[import]]).

Secțiunea aceasta urmează „Introducere manuală”. Se deschide ecranul „Proprietate nouă”, cu datele cadastrale, colțurile, adresa și harta.

### 5.2.1 Datele cadastrale {#properties-add-cadastral}

Câmpurile principale sunt:

- „Poreclă” — numele după care recunoașteți proprietatea în listă;
- „Tip proprietate” — de exemplu teren extravilan sau teren construit (secțiunea [[properties-type]]);
- „Nr. tarla / sola” — se alege dintr-o listă, nu se scrie: lista cuprinde „niciunul” și tarlalele care există deja în arhivă, fiecare cu codul ei; descrierea tarlalei apare când țineți mouse-ul pe cod;
- „Nr. parcelă” — se scrie liber;
- „Nr. cadastru” și „Nr. CF”;
- „Categorie de folosință” — lista oferă doar folosințele pe care tipul ales le permite; o folosință salvată înainte, pe care tipul n-o mai permite, rămâne, iar sub câmp scrie „Tipul „…” nu are această categorie de folosință printre cele permise.” (secțiunea [[admin-reference-data-property-types]]);
- „Suprafață oficială (m²)” — suprafața din acte; trebuie să fie un număr pozitiv;
- „Suprafață calculată (m²)” — o calculează aplicația din colțuri (secțiunea [[properties-corners]]);
- „Note”.

Pe o proprietate nouă, „Salvează”, „Șterge” și „Anulează” stau jos de tot, sub hartă; pe una salvată, fiecare fișă se salvează singură, iar jos rămân „Șterge” și „Anulează”. Butoanele sunt pictograme — o dischetă, un coș, un X — și își arată numele când treceți cu mouse-ul peste ele.

Când apăsați „Salvează” pe o proprietate nouă, vă întoarceți în listă. Proprietatea nouă stă sus, cu insigna „Nou!”, iar numărul de sub listă a crescut cu unu.

### 5.2.2 Adresa {#properties-add-address}

Fișa „Adresă” are câmpurile „Stradă, Nr., etaj, ap”, „Cod poștal”, „Oraș / Localitate”, „Județ / Sector”, „Țară” și „Note”. Dacă lăsați „Țară” gol și completați adresa, se salvează „România”.

„Preia din Street View” completează câmpul „Adresă Street View” cu adresa pe care Google o găsește la centrul colțurilor. Are nevoie de cel puțin un colț și scrie peste ce era în câmp, așa că verificați rezultatul. Fiecare clic este o căutare pe care Google o taxează.

Unele tipuri de proprietate nu arată adresa deloc (secțiunea [[properties-type-hidden]]).

### 5.2.3 O singură proprietate pentru o parcelă {#properties-add-one-parcel}

Arhiva ține o singură proprietate pentru fiecare parcelă dintr-o localitate (secțiunea [[properties-tarla]]). Dacă salvați o proprietate nouă cu o tarla și o parcelă care au deja o proprietate — de mână sau dintr-un fișier cu coordonate —, aplicația o refuză: rămâneți pe „Proprietate nouă”, iar sub formular apare „Această parcelă are deja o proprietate”, cu explicația că nu s-a creat o proprietate nouă. Linkul „Deschide …” de sub mesaj vă duce la proprietatea care există. Nu se scrie nimic, iar lista are tot atâtea proprietăți ca înainte.

### 5.2.4 Modificarea și ștergerea {#properties-add-edit}

Pe o proprietate deschisă, apăsați „Editează” pe fișa de schimbat — „Identificare cadastrală”, „Puncte de contur” sau „Adresă” —, schimbați câmpurile și apăsați „Salvează”-ul fișei (secțiunea [[start-read-edit]]). Cât timp aveți schimbări nesalvate, sus în formular scrie „Modificări nesalvate”, iar „Salvează” este activ. Fiecare salvare adaugă o versiune, iar în bara de sus apar „v …” și „… versiuni” (secțiunea [[links-versions]]).

Coșul („Șterge”) întreabă întâi „Ștergeți proprietatea?”. „Nu” vă lasă pe ecran; „Da” șterge proprietatea și vă întoarce în listă.

### 5.2.5 Tarla și localitatea ei {#properties-tarla}

Numerele de tarla o iau de la capăt în fiecare localitate: T50 din Bragadiru nu este T50 din Cornetu. De aceea o tarla aparține unei localități, iar regula unei singure proprietăți pentru o parcelă (secțiunea [[properties-add-one-parcel]]) compară doar parcelele din aceeași localitate: parcela 1 pe T50 din Cornetu nu este refuzată pentru că există parcela 1 pe T50 din Bragadiru.

În „Date de referință” → „Indicative Tarla”, fiecare tarla are „Localitate” și „Județ”, citite împreună pe rând, de exemplu Bragadiru, Ilfov. Același cod poate exista o dată în fiecare localitate. Pe „Nr. tarla / sola” al unei proprietăți, un cod pe care îl au două tarlale își arată localitatea între paranteze, iar butonul „Deschide pagina tarlalei” de sub listă deschide tarla aleasă.

Fiecare tarla are o pagină a ei, „Tarlale” → tarla, deschisă cu „Deschide pagina tarlalei” din „Indicative Tarla” sau de pe proprietate. Pe pagină:

- prima fișă, „Despre limitele tarlalelor”: ce surse există pentru limitele tarlalelor și ce nu este disponibil. Pe lista „Tarlale” același chenar stă deasupra listei, cât lista de lat, pentru că este informația de citit înainte de a căuta o limită;
- „Indicativ”, „Localitate”, „Județ”, „Descriere” și „Note”;
- „Contur”: o hartă cu conturul tarlalei și proprietățile ei, apoi colțurile tarlalei, opționale, introduse ca la o proprietate (secțiunea [[properties-corners-table]]). Fiecare colț stă pe un singur rând, cu cele patru butoane ale lui — „Mută mai sus”, „Mută mai jos”, „Editează”, „Șterge” — unul lângă altul. Fără colțuri, conturul este forma din jurul proprietăților tarlalei (secțiunea [[map-what-tarlale]]);
- planurile parcelare legate de tarla la import și parcelele desenate de ele: numărul, suprafața și folosința, fără proprietari (secțiunea [[import-scanning-tarla]]);
- proprietățile de pe tarla și actele legate de ele. În afară de planuri, o tarla nu are acte, grupuri sau etichete ale ei.

Aceste părți ale paginii sunt fișe, ca pe ecranul unei proprietăți: le trageți în alt loc, iar „Implicit”, din dreapta sus, le pune la loc; locul lor se păstrează în browserul vostru. Pe o fereastră mare, „Despre limitele tarlalelor”, „Tarla”, „Contur”, planurile și parcelele stau câte trei pe rând, iar proprietățile și actele câte două. Lista proprietăților, cea a parcelelor și cea a actelor se opresc la două treimi din înălțimea ferestrei și se derulează în fișa lor, cu rândul de titluri mereu sus.

Jos, sub ultima fișă și sub o linie, stau „Salvează”, „Șterge” și „Anulează”, ca pe ecranul unei proprietăți — o dischetă, un coș, un X:

- „Salvează” scrie datele tarlalei și colțurile ei împreună; lângă butoane apare „Salvat.”, sau motivul pentru care salvarea a fost refuzată;
- „Anulează” pune la loc ce era salvat și vă lasă pe pagină. Cât timp nu ați schimbat nimic, nu se poate apăsa;
- „Șterge” deschide aceeași fereastră ca în „Date de referință” → „Indicative Tarla” (secțiunea [[admin-reference-data-values]]): o tarla pe care stau proprietăți, planuri sau parcele nu se poate șterge până nu le mutați pe altă tarla; una de care nu depinde nimic se șterge, iar pagina vă întoarce la lista „Tarlale”.

Un import adaugă codurile de tarla în localitatea dată în pasul proprietăților: „Localitatea tarlalelor” este citită din numele dosarului ales, de exemplu Clinceni dintr-un dosar numit CLINCENI.3, și se poate schimba (secțiunea [[import-overview]]).

## 5.3 Tipul proprietății și fișele lui {#properties-type}

Ecranul unei proprietăți are în cap porecla ei, apoi tipul, între paranteze și în cursiv — de exemplu „(Teren extravilan)” — și un ⓘ, „Despre tipul proprietății”. Bula lui spune ce fișe arată tipul acesta și ce fișe nu arată, și dacă „Tarla/Solă” și „Parcelă” apar în „Identificare cadastrală”.

Tipul îl alegeți în „Tip proprietate”. Când alegeți alt tip, titlul și bula se schimbă pe loc, înainte de salvare. Dacă alegeți „niciunul”, după poreclă nu mai apare nimic. Ce arată fiecare tip se stabilește în „Date de referință” (secțiunea [[admin-reference-data]]).

### 5.3.1 Fișele unei proprietăți {#properties-type-tiles}

Bifele din „Panouri” („Părți afișate”) aleg fișele, ca pe orice obiect (secțiunea [[start-tiles]]):

| Fișa | Ce arată |
|---|---|
| Identificare cadastrală | Tarla, parcelă, CF, nr. cadastral, suprafețe. |
| Adresă | Adresa poștală a proprietății. |
| Legături | Persoane, proprietăți și acte legate de această proprietate (secțiunea [[links-related]]). |
| Clasificare | Importanță, relevanță, proveniență (secțiunea [[links-classify]]). |
| Etichete și grupuri | Etichete, grupuri, ștampile, vezi și (secțiunea [[links-classify]]). |
| Hartă | Parcela desenată pe hartă (secțiunea [[properties-corners-map]]). |
| Puncte de contur | Colțurile parcelei, în ordine (secțiunea [[properties-corners-table]]). |
| Street View | Imaginea străzii de lângă parcelă (secțiunea [[properties-corners-street-view]]). |

„Implicit” arată „Identificare cadastrală”, „Adresă”, „Hartă” și „Puncte de contur”. Fișele „Hartă”, „Puncte de contur” și „Street View” pornesc din dreapta, una sub alta, sunt mov deschis și se trag în alt loc ca orice fișă (secțiunea [[start-tiles]]). Pe un ecran îngust, coboară sub celelalte fișe.

Când debifați fișele de hartă, ecranul arată doar datele: identificarea cadastrală și adresa (Figura [[fig-properties-record]]).

![5.2 Ecranul unei proprietăți: datele cadastrale și adresa](properties-record.png){#fig-properties-record}

### 5.3.2 Fișele pe care tipul nu le arată {#properties-type-hidden}

Un tip poate să nu arate „Adresă” și „Street View” — un teren arabil, de exemplu, nu are adresă poștală. Pentru un asemenea tip, cele două bife sunt nebifate și inactive, cu numele în cursiv, iar mesajul lor spune că tipul ales nu afișează fișa. „Toate” și „Implicit” nu le ating. Dacă alegeți un tip care arată fișa, bifa revine așa cum o lăsaserăți.

## 5.4 Colțurile și harta unei parcele {#properties-corners}

Forma parcelei o dau colțurile ei, în ordinea în care sunt unite. Le vedeți în două fișe care lucrează împreună: „Puncte de contur”, tabelul colțurilor, și „Hartă”, desenul lor. Ce schimbați într-una se vede imediat în cealaltă, chiar înainte de salvare.

### 5.4.1 „Puncte de contur” {#properties-corners-table}

Tabelul are coloanele „Nr.” (ordinea), „Nr. orig.” (numărul colțului în fișierul sau planul din care vine), apoi coordonatele. „Afișare:” alege cum se arată coordonatele: „DD” (grade zecimale), „DMS” (grade, minute, secunde) sau „Stereo 70” (Nord și Est, în metri). În același fel le și scrieți.

Fiecare rând are patru butoane:

- „Mută mai sus” și „Mută mai jos” — schimbă ordinea colțurilor, deci și forma parcelei;
- „Editează” — face din rând câmpuri de scris, cu „Salvează” și „Anulează” pe rând. Butoanele rândurilor și „+ Adaugă punct” stau acolo cât timp „Puncte de contur” este deschisă cu „Editează”-ul fișei; un colț tras pe hartă o deschide singur;
- „Șterge” — scoate colțul.

„+ Adaugă punct” adaugă un colț nou la sfârșit. Nu se vede până apăsați „Editează” pe fișă; atunci stă pe rândul lui „Afișare:”, în dreapta.

„Suprafață calculată (m²)” urmează colțurile pe loc: schimbați un colț și suprafața se schimbă imediat. „Salvează” de pe un rând nu scrie încă nimic în arhivă: colțurile se salvează abia cu „Salvează”-ul fișei „Puncte de contur”, sub tabel, iar versiunea de dinainte păstrează colțurile vechi.

Dacă ordinea colțurilor face ca laturile să se încrucișeze, apare „Ordinea colțurilor se încrucișează”, iar suprafața calculată nu mai are sens. „Îndreaptă ordinea” vă arată forma de acum și forma îndreptată, cu suprafețele lor. Colțurile rămân unde sunt; se schimbă doar ordinea în care sunt unite. Apoi salvați ca de obicei.

### 5.4.2 Fișa „Hartă” {#properties-corners-map}

Fișa „Hartă” desenează parcela. Are deasupra titlul ei, ca orice fișă; sub titlu, în dreapta, are pe un rând:

- „Hartă extinsă” — deschide harta pe tot ecranul;
- „Desenează” — pune colțuri cu clicuri pe hartă;
- „Arată Unghiuri” — arată unghiurile colțurilor; apăsat din nou, devine „Ascunde Unghiuri”;
- „Navighează” — traseul până la proprietate (secțiunea [[properties-navigate]]);
- „HARTĂ” și „SATELIT” — harta străzilor sau imaginea din satelit.

Colțurile proprietății sunt puncte mici, albastre, de culoarea laturilor, ca pe harta completă (secțiunea [[map-what]]). Când treceți cu mouse-ul peste un rând din „Puncte de contur”, colțul lui primește un cerc în jur.

### 5.4.3 Desenarea și tragerea colțurilor {#properties-corners-draw}

1. Apăsați „Desenează”. În locul lui apare „Gata”, iar sub butoane un îndemn: „Apasă pe hartă pentru a plasa primul punct”.
2. Apăsați pe hartă pentru fiecare colț, în ordine.
3. Ca să închideți forma, apăsați din nou pe primul punct sau apăsați „Gata”.
4. Colțurile desenate apar în „Puncte de contur”. Salvați proprietatea ca să rămână.

Un colț așezat greșit se corectează trăgându-l cu mouse-ul pe hartă. Tabelul și suprafața calculată urmează tragerea.

### 5.4.4 Harta extinsă {#properties-corners-expanded}

„Hartă extinsă” deschide harta pe tot ecranul, centrată pe proprietate și la scara de pe fișă, așa că proprietatea are aceeași mărime ca acolo. Proprietatea este roșie, cu colțurile ei roșii, iar în jurul ei stau toate celelalte proprietăți din arhivă, albastre, cum le arată harta completă — de departe, picături (secțiunea [[map-what]]). Celelalte proprietăți sunt doar de privit: un clic pe ele nu face nimic.

Harta extinsă are „Desenează”, „Arată Unghiuri” și „HARTĂ” / „SATELIT”. Un colț desenat sau tras aici este colțul acestei proprietăți. „Restrânge” sau tasta Escape închide harta extinsă și vă întoarce la fișă, cu desenul păstrat.

### 5.4.5 Fișa „Street View” {#properties-corners-street-view}

Fișa „Street View” arată imaginea străzii de lângă parcelă, sub titlul fișei. Este oprită până o bifați, pentru că Google taxează fiecare imagine deschisă. Are nevoie de cel puțin un colț; dacă Google nu are imagini în apropiere, fișa vă spune. Harta completă are și ea Street View (secțiunea [[map-street-view]]).

## 5.5 O parcelă dintr-un fișier cu coordonate {#properties-coord-file}

Un fișier text cu coordonatele Stereo 70 ale colțurilor — de pildă de la un topograf — devine o proprietate întreagă, fără să scrieți colțurile de mână.

1. În „Proprietăți”, apăsați „Adaugă proprietate”, apoi „Din fișier text”.
2. În fereastra „Încarcă fișier cu coordonate”, alegeți fișierul la „Selectați fișierul cu coordonate”. Fereastra de alegere arată doar fișiere .txt.
3. Sub fișier, la „Tarla și parcelă”, alegeți tarlaua la „Nr. tarla / sola” și scrieți parcela la „Nr. parcelă”. Până nu le completați pe amândouă, „Importă” rămâne gri.
4. Apăsați „Importă”.
5. Apare „Proprietatea a fost importată cu succes.”, iar în listă, sus, proprietatea nouă cu insigna „Nou!”. Apăsați „Închide” sau „Deschide proprietatea”.

Dacă parcela are deja o proprietate, nu se creează alta: fereastra rămâne deschisă și arată „Această parcelă are deja o proprietate”, cu un link spre proprietatea care există (secțiunea [[properties-add-one-parcel]]).

Fișierul are câte un rând pe colț, cu valorile separate prin tab sau virgulă: indexul colțului, X (Nord) și Y (Est), în metri. Rândurile care nu conțin coordonate sunt ignorate. Dacă fișierul nu are cel puțin trei rânduri cu coordonate valide, aplicația spune că nu a găsit coordonate Stereo 70 valide.

Ce primește proprietatea nouă:

- „Poreclă” — numele fișierului;
- colțurile, în ordinea din fișier, fiecare cu numărul lui din fișier în „Nr. orig.”;
- „Suprafață calculată (m²)”, din colțuri, și harta desenată;
- proveniența „Fișier de coordonate (.txt)”;
- tarlaua și parcela alese în fereastră.

Restul datelor cadastrale — numărul cadastral, cartea funciară, suprafața din acte — le completați pe ecranul proprietății, în „Identificare cadastrală”.

## 5.6 „Navighează” {#properties-navigate}

„Navighează”, pe rândul de sus al fișei „Hartă”, vă ajută să ajungeți la proprietate cu mașina. Se deschide o fereastră cu traseul în Google Maps și cu același traseu sub forma unui cod QR, pentru telefon.

Destinația o alege aplicația:

- dacă proprietatea are colțuri, traseul duce la centrul parcelei („Spre parcelă: centrul ei pe hartă.”);
- dacă are doar adresă, traseul duce la adresa ei („Spre adresa: …”);
- dacă nu are nici colțuri, nici adresă, butonul „Navighează” este inactiv și spune de ce.

La „Pornire” alegeți de unde porniți:

- „Locația mea” — telefonul care scanează codul pornește de unde se află; pe calculator, Google Maps cere locația browserului;
- „De la o adresă” — scrieți adresa de pornire la „Adresa de pornire”; până o scrieți, linkul și codul QR nu apar.

Scanați codul QR cu telefonul, iar Google Maps pornește navigarea. Pe calculator, „Deschide în Google Maps” deschide traseul într-o filă nouă, iar „Copiază linkul” îl copiază, ca să-l trimiteți cuiva. Traseul îl trasează Google Maps, până la cel mai apropiat drum din hartă.

„Navighează” se găsește și în bula unei proprietăți de pe harta completă (capitolul [[map]]).

## 5.7 Exemple și cazuri de utilizare {#properties-examples}

### 5.7.1 Adăugați un teren din Bragadiru și desenați-l pe hartă {#properties-example-draw}

1. În „Proprietăți”, apăsați „Adaugă proprietate”, apoi „Introducere manuală” (secțiunea [[properties-add]]).
2. Scrieți porecla, de pildă „Teren Bragadiru”, alegeți tarlaua din „Nr. tarla / sola”, scrieți parcela și suprafața din acte.
3. Pe hartă, apăsați „Desenează” și puneți colțurile; închideți forma pe primul punct (secțiunea [[properties-corners-draw]]).
4. Comparați „Suprafață calculată (m²)” cu „Suprafață oficială (m²)”.
5. Apăsați „Salvează”. Proprietatea apare sus în listă, cu „Nou!”.

### 5.7.2 Aduceți o parcelă din fișierul unui topograf {#properties-example-file}

1. „Adaugă proprietate”, apoi „Din fișier text”; alegeți fișierul .txt, tarlaua și parcela, și apăsați „Importă” (secțiunea [[properties-coord-file]]).
2. Deschideți proprietatea nouă și verificați pe hartă că laturile nu se încrucișează; dacă se încrucișează, folosiți „Îndreaptă ordinea” (secțiunea [[properties-corners-table]]).
3. Completați în „Identificare cadastrală” ce mai știți din acte — numărul cadastral, cartea funciară — și salvați.

### 5.7.3 Mergeți la teren cu telefonul {#properties-example-navigate}

1. Deschideți proprietatea și apăsați „Navighează”, pe rândul de sus al hărții (secțiunea [[properties-navigate]]).
2. Lăsați „Locația mea” la „Pornire”.
3. Scanați codul QR cu telefonul: Google Maps pornește navigarea de unde vă aflați.

### 5.7.4 Corectați un colț greșit {#properties-example-corner}

1. Deschideți proprietatea; în „Puncte de contur”, apăsați „Editează” pe rândul colțului (secțiunea [[properties-corners-table]]).
2. Scrieți coordonata corectă și apăsați „Salvează” pe rând. Suprafața calculată se schimbă imediat.
3. Apăsați „Salvează” sub tabel, al fișei. Versiunea de dinainte păstrează colțul vechi (secțiunea [[links-versions]]).
`;
