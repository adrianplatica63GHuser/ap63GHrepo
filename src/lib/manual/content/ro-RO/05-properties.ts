/**
 * Manual, ro-RO, chapter 5. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 5 Proprietăți {#properties}

O proprietate este o parcelă: un teren, cu sau fără construcție. În arhivă o identifică tarlaua și parcela, uneori și numărul cadastral și numărul de carte funciară, iar pe hartă o așază colțurile ei, în ordine. Capitolul acesta arată lista proprietăților, cum adăugați una, ce schimbă tipul ei, cum se lucrează cu colțurile și cu harta unei parcele și cum ajungeți la ea cu telefonul.

## 5.1 Lista proprietăților {#properties-list}

Deschideți „Domeniu” în bara laterală, apoi „Proprietăți”. Se deschide lista „Proprietăți” (Figura [[fig-properties-list]]).

Caseta de căutare din capul listei caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă — așa scrie și în ea. Lângă ea, filtrele listei îngustează ce vedeți după orice câmp al proprietății (secțiunea [[properties-list-filters]]). Sub tabel, „Se afișează … din …” spune câte proprietăți vedeți din câte sunt.

Prima coloană după bifă este mereu „Poreclă”, numele pe care îl dați proprietății. Ea se vede întotdeauna și nu apare printre opțiunile din „Câmpuri afișate”. Codul proprietății nu are coloană în listă; îl găsiți pe ecranul proprietății, în colțul primei fișe.

„Câmpuri afișate” adaugă până la patru coloane după „Poreclă”. Puteți alege dintre câmpurile cadastrale și localitate:

- „Tarla/Solă” și „Parcelă”;
- „Oficială (m²)” și „Calculată (m²)” — cele două suprafețe;
- „Nr. CF” și „Nr. cadastru”;
- „Categorie de folosință” și „Tip proprietate”, arătate cu numele lor;
- „Localitate”.

Butonul arată câte coloane ați ales, de exemplu „Câmpuri afișate 2/4”. Când ați bifat patru, celelalte căsuțe devin gri până debifați una. La început lista arată doar „Tip proprietate”. Alegerea se păstrează în browserul acesta, așa că o regăsiți data viitoare.

În dreapta, deasupra tabelului, stau două butoane: „Hartă completă” deschide harta tuturor proprietăților (capitolul [[map]]), iar „Adaugă proprietate” creează una nouă (secțiunea [[properties-add]]). Cât timp harta completă e deschisă, bara de navigare arată „Acasă › Proprietăți › Hartă completă”, iar un clic pe „Proprietăți” vă întoarce la listă.

![5.1 Lista proprietăților](properties-list.png){#fig-properties-list}

### 5.1.1 Filtrele listei {#properties-list-filters}

Fiecare filtru este o etichetă rotunjită deasupra tabelului, cu numele câmpului și ce ați ales, de exemplu „Tip proprietate” Casă. Lista arată doar proprietățile care trec de toate filtrele odată.

1. Alegeți câmpul din lista „+ Filtru”. Se deschide sub ea fereastra filtrului.
2. Alegeți ce vreți să vedeți. Lista se schimbă pe loc, fără niciun buton de aplicat.
3. Apăsați în afara ferestrei sau tasta Esc ca s-o închideți. Eticheta rămâne; un clic pe ea redeschide fereastra, iar X-ul ei scoate filtrul.

Ce alegeți depinde de câmp:

- **„Tip proprietate”, „Categorie de folosință”, „Tarla/Solă”, „Localitate”, „Județ / Sector” și „Grup”** — o listă cu bife. Lângă fiecare valoare stă câte proprietăți o au, numărate cu celelalte filtre deja puse, așa că numărul spune câte rânduri ar rămâne. Bifați mai multe valori ca să vedeți proprietățile care au oricare dintre ele. „(necompletat)” înseamnă proprietățile la care câmpul este gol. Caseta „Caută o valoare…” scurtează lista;
- **„Suprafață oficială (m²)” și „Suprafață calculată (m²)”** — „De la” și „Până la”, oricare dintre ele, sau amândouă;
- **„Nr. cadastru”, „Nr. CF” și „Nr. parcelă”** — „Conține”: rămân proprietățile la care câmpul conține ce ați scris.

Coloanele din „Câmpuri afișate” au în capul lor o pâlnie mică: un clic pe ea deschide filtrul coloanei. O pâlnie plină arată că lista este filtrată după acea coloană. Un filtru rămâne și dacă îi ascundeți coloana, iar eticheta lui stă deasupra tabelului, așa că lista nu este niciodată filtrată fără să vedeți asta.

„Șterge filtrele” le scoate pe toate deodată. Filtrele se păstrează în adresa paginii, ca și căutarea: rămân după ce reîncărcați pagina, după ce vă întoarceți la listă cu „Înapoi” și când trimiteți adresa cuiva.

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
- „Tip proprietate” — de exemplu teren arabil sau teren construit (secțiunea [[properties-type]]);
- „Nr. tarla / sola” — se alege dintr-o listă, nu se scrie: lista cuprinde „niciunul” și tarlalele care există deja în arhivă;
- „Nr. parcelă” — se scrie liber;
- „Nr. cadastru” și „Nr. CF”;
- „Categorie de folosință”;
- „Suprafață oficială (m²)” — suprafața din acte; trebuie să fie un număr pozitiv;
- „Suprafață calculată (m²)” — o calculează aplicația din colțuri (secțiunea [[properties-corners]]);
- „Note”.

„Salvează”, „Șterge” și „Anulează” stau jos de tot, sub hartă. Butoanele sunt pictograme — o dischetă, un coș, un X — și își arată numele când treceți cu mouse-ul peste ele.

Când apăsați „Salvează” pe o proprietate nouă, vă întoarceți în listă. Proprietatea nouă stă sus, cu insigna „Nou!”, iar numărul de sub listă a crescut cu unu.

### 5.2.2 Adresa {#properties-add-address}

Fișa „Adresă” are câmpurile „Stradă, Nr., etaj, ap”, „Cod poștal”, „Oraș / Localitate”, „Județ / Sector”, „Țară” și „Note”. Dacă lăsați „Țară” gol și completați adresa, se salvează „România”.

„Preia din Street View” completează câmpul „Adresă Street View” cu adresa pe care Google o găsește la centrul colțurilor. Are nevoie de cel puțin un colț și scrie peste ce era în câmp, așa că verificați rezultatul. Fiecare clic este o căutare pe care Google o taxează.

Unele tipuri de proprietate nu arată adresa deloc (secțiunea [[properties-type-hidden]]).

### 5.2.3 O singură proprietate pentru o parcelă {#properties-add-one-parcel}

Arhiva ține o singură proprietate pentru fiecare parcelă. Dacă salvați o proprietate nouă cu o tarla și o parcelă care au deja o proprietate — de mână sau dintr-un fișier cu coordonate —, aplicația o refuză: rămâneți pe „Proprietate nouă”, iar sub formular apare „Această parcelă are deja o proprietate”, cu explicația că nu s-a creat o proprietate nouă. Linkul „Deschide …” de sub mesaj vă duce la proprietatea care există. Nu se scrie nimic, iar lista are tot atâtea proprietăți ca înainte.

### 5.2.4 Modificarea și ștergerea {#properties-add-edit}

Pe o proprietate deschisă, schimbați câmpurile și apăsați „Salvează”. Cât timp aveți schimbări nesalvate, sus în formular scrie „Modificări nesalvate”, iar „Salvează” este activ. Fiecare salvare adaugă o versiune, iar în capul ecranului apar „v …” și „… versiuni” (secțiunea [[links-versions]]).

Coșul („Șterge”) întreabă întâi „Ștergeți proprietatea?”. „Nu” vă lasă pe ecran; „Da” șterge proprietatea și vă întoarce în listă.

## 5.3 Tipul proprietății și fișele lui {#properties-type}

Ecranul unei proprietăți are în cap porecla ei, apoi tipul, între paranteze și în cursiv — de exemplu „(Teren Arabil)” — și un ⓘ, „Despre tipul proprietății”. Bula lui spune ce fișe arată tipul acesta și ce fișe nu arată, și dacă „Tarla/Solă” și „Parcelă” apar în „Identificare cadastrală”.

Tipul îl alegeți în „Tip proprietate”. Când alegeți alt tip, titlul și bula se schimbă pe loc, înainte de salvare. Dacă alegeți „niciunul”, după poreclă nu mai apare nimic. Ce arată fiecare tip se stabilește în „Date de referință” (secțiunea [[admin-reference-data]]).

### 5.3.1 Fișele unei proprietăți {#properties-type-tiles}

Bifele din capul ecranului („Părți afișate”) aleg fișele, ca pe orice obiect (secțiunea [[start-tiles]]):

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

„Implicit” arată „Identificare cadastrală”, „Adresă”, „Hartă” și „Puncte de contur”. Fișele „Hartă”, „Puncte de contur” și „Street View” stau într-o coloană în dreapta, una sub alta, sunt mov deschis și nu se mută. Pe un ecran îngust, coloana coboară sub celelalte fișe.

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
- „Editează” — face din rând câmpuri de scris, cu „Salvează” și „Anulează” pe rând;
- „Șterge” — scoate colțul.

Sub tabel, „+ Adaugă punct” adaugă un colț nou la sfârșit.

„Suprafață calculată (m²)” urmează colțurile pe loc: schimbați un colț și suprafața se schimbă imediat. „Salvează” de pe un rând nu scrie încă nimic în arhivă: colțurile se salvează abia cu „Salvează” de jos, împreună cu restul proprietății, iar versiunea de dinainte păstrează colțurile vechi.

Dacă ordinea colțurilor face ca laturile să se încrucișeze, apare „Ordinea colțurilor se încrucișează”, iar suprafața calculată nu mai are sens. „Îndreaptă ordinea” vă arată forma de acum și forma îndreptată, cu suprafețele lor. Colțurile rămân unde sunt; se schimbă doar ordinea în care sunt unite. Apoi salvați ca de obicei.

### 5.4.2 Fișa „Hartă” {#properties-corners-map}

Fișa „Hartă” desenează parcela. Sus, în dreapta, are pe un rând:

- „Hartă extinsă” — deschide harta pe tot ecranul;
- „Desenează” — pune colțuri cu clicuri pe hartă;
- „Arată Unghiuri” — arată unghiurile colțurilor; apăsat din nou, devine „Ascunde Unghiuri”;
- „HARTĂ” și „SATELIT” — harta străzilor sau imaginea din satelit.

Sub hartă stă „Navighează” (secțiunea [[properties-navigate]]).

### 5.4.3 Desenarea și tragerea colțurilor {#properties-corners-draw}

1. Apăsați „Desenează”. În locul lui apare „Gata”, iar sub butoane un îndemn: „Apasă pe hartă pentru a plasa primul punct”.
2. Apăsați pe hartă pentru fiecare colț, în ordine.
3. Ca să închideți forma, apăsați din nou pe primul punct sau apăsați „Gata”.
4. Colțurile desenate apar în „Puncte de contur”. Salvați proprietatea ca să rămână.

Un colț așezat greșit se corectează trăgându-l cu mouse-ul pe hartă. Tabelul și suprafața calculată urmează tragerea.

### 5.4.4 Harta extinsă {#properties-corners-expanded}

„Hartă extinsă” deschide aceeași hartă pe tot ecranul, cu „Desenează”, „Arată Unghiuri” și „HARTĂ” / „SATELIT”. Un colț desenat aici este colțul proprietății. „Restrânge” sau tasta Escape închide harta extinsă și vă întoarce la fișă, cu desenul păstrat.

### 5.4.5 Fișa „Street View” {#properties-corners-street-view}

Fișa „Street View” arată imaginea străzii de lângă parcelă. Este oprită până o bifați, pentru că Google taxează fiecare imagine deschisă. Are nevoie de cel puțin un colț; dacă Google nu are imagini în apropiere, fișa vă spune. Harta completă are și ea Street View (secțiunea [[map-street-view]]).

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

„Navighează”, sub fișa „Hartă”, vă ajută să ajungeți la proprietate cu mașina. Se deschide o fereastră cu traseul în Google Maps și cu același traseu sub forma unui cod QR, pentru telefon.

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

1. Deschideți proprietatea și apăsați „Navighează”, sub hartă (secțiunea [[properties-navigate]]).
2. Lăsați „Locația mea” la „Pornire”.
3. Scanați codul QR cu telefonul: Google Maps pornește navigarea de unde vă aflați.

### 5.7.4 Corectați un colț greșit {#properties-example-corner}

1. Deschideți proprietatea; în „Puncte de contur”, apăsați „Editează” pe rândul colțului (secțiunea [[properties-corners-table]]).
2. Scrieți coordonata corectă și apăsați „Salvează” pe rând. Suprafața calculată se schimbă imediat.
3. Apăsați „Salvează” jos. Versiunea de dinainte păstrează colțul vechi (secțiunea [[links-versions]]).
`;
