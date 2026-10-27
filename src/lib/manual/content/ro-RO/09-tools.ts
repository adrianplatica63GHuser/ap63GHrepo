/**
 * Manual, ro-RO, chapter 9. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 9 Instrumente {#tools}

Secțiunea „Instrumente” din bara laterală ține două unelte de lucru, „Distilare Tipizate” și „Calcul drum lateral”, și trei ghiduri ale butoanelor hărții: „Măsurători pe hartă”, „Grupări de proprietăți” și „Navigare”. Fiecare face altceva și costă altfel, așa că merită știut dinainte:

- „Distilare Tipizate” face formularul unui tip de act din câteva acte-mostră. Citirea mostrelor o face AI-ul și **se plătește**.
- „Calcul drum lateral” împarte o parcelă între proprietarii ei, cu un drum comun, și **creează proprietăți reale** în arhivă — dar numai când confirmați.
- „Măsurători pe hartă”, „Grupări de proprietăți” și „Navigare” doar explică butoanele hărții; primele două deschid apoi harta, cu butoanele arătate. Nu scriu nimic.

## 9.1 Distilare Tipizate {#tools-doc-type-engine}

Un tip de act poate avea un formular: câmpurile lui proprii, pe lângă câmpurile generale ale oricărui act (secțiunea [[documents-type]]). Formularul contează mai ales la import: fiecare act de un tip cu formular își completează singur câmpurile, din ce citește AI-ul pe pagini. Pentru un tip fără formular, importul se oprește și vă trimite aici (secțiunea [[import-scanning]]).

„Distilare Tipizate” face acel formular. Îi dați un folder cu mai multe acte de același fel; fiecare este citit în întregime, actele sunt comparate între ele, iar instrumentul vă propune formularul cu informațiile pe care le au în comun. Îl corectați, îl aprobați, și de atunci importul citește acel tip cu formularul lui. **Nu se importă nimic**: niciun act nu se creează și nimic altceva nu se scrie în arhivă. Singurul lucru care se schimbă este formularul unui tip.

Ecranul se deschide pe „Alegeți tipul, folderul cu mostre și pragul” (Figura [[fig-tools-doc-type-engine]]).

![9.1 Ecranul „Distilare Tipizate”](tools-doc-type-engine.png){#fig-tools-doc-type-engine}

Se ajunge aici și din alte locuri, cu tipul deja ales: din linia „Acest tip nu are încă formular; formularul se construiește în Distilare Tipizate.” de sub „Tip document” al unui act (secțiunea [[documents-type]]) și din „Creați formularul în „Distilare Tipizate”” de pe ecranul la care se oprește importul (secțiunea [[import-scanning]]). Ca să vedeți ce tipuri nu au încă formular, deschideți „Date de referință” → „Tipuri de Document” și bifați „Fără formular” (secțiunea [[admin-reference-data]]).

### 9.1.1 Tipul, mostrele și pragul {#tools-doc-type-engine-pick}

**„Tipul de document care primește formularul”** — alegeți tipul din listă. Două semne din listă spun ceva:

- „are deja formular” — tipul se poate alege și așa. Câmpurile noi se adaugă la cele pe care le are; niciunul dintre cele existente nu este modificat sau șters.
- „nu poate primi formular” — cele patru tipuri de act de identitate, ale căror câmpuri le definește aplicația (secțiunea [[documents-identity]]), și tipul de rezervă, care adună actele al căror tip nu s-a putut stabili.

**„Alege folderul cu mostre…”** — arătați un folder de pe calculator cu acte de același fel, de obicei între zece și douăzeci. Browserul vă cere voie să citească folderul; dați-i-o. Merge în Chrome, Edge sau alt browser bazat pe Chromium. Se citesc imagini JPEG, PNG, GIF sau WebP și fișiere PDF; TIFF, BMP, Word sau text nu se pot citi. O rulare citește un număr limitat de mostre: dacă folderul are mai multe, ecranul vă spune câte rămân necitite, iar dacă le vreți pe toate, împărțiți folderul.

**„Procent de potrivire”** — pragul. O informație devine câmp pe formular dacă apare în cel puțin acest procent din mostrele care chiar au fost citite. Restul nu se pierde: la fiecare import viitor ajunge în „Note extinse” ale actului, ca până acum.

### 9.1.2 Citirea și costul ei {#tools-doc-type-engine-cost}

Înainte să porniți, ecranul vă spune ce veți plăti: „Citirea AI se plătește”, câte mostre vor fi citite în întregime, plus un apel de comparare la final. Vă spune și cât durează cel puțin, pentru că se trimite doar un număr limitat de citiri pe minut. Citirea fiecărei mostre costă, așa că alegeți mostrele cu grijă: acte întregi, lizibile, toate de același fel.

„Începe citirea” pornește. Ecranul arată câte mostre s-au încheiat; când așteaptă limita pe minut, numără secundele, iar nicio mostră nu se pierde din această cauză.

„Oprește citirea” oprește așteptarea și mostrele încă netrimise; acestea nu se plătesc. O citire deja pornită se termină, pentru că este oricum plătită, iar mostrele citite până atunci se compară totuși, ca să nu fi fost plătite degeaba.

Dacă mostrele s-au citit, dar compararea lor nu reușește, citirile s-au plătit deja, iar reluarea le plătește din nou.

### 9.1.3 Formularul propus {#tools-doc-type-engine-review}

După comparare se deschide „Formularul propus”. Primul rând spune câte mostre s-au citit din câte ați ales — de exemplu „S-au citit 14 din 20 de mostre alese.” Toate procentele de sub el sunt din mostrele citite, nu din cele alese.

Informațiile găsite sunt împărțite în trei:

- **câmpurile de pe formular** — cele care trec pragul. Fiecare are o bifă (bifată de la început), „Etichetă”, „Fel” („Text”, „Text lung”, „Dată” sau „Număr”), în câte mostre a fost găsit, cum este scris pe acte („Scris pe documente ca: …”), „Indiciu pentru AI” și „Vezi valorile citite din … mostre”, care arată ce s-a citit pe fiecare act;
- **informațiile sub prag** — nu devin câmpuri; la importurile viitoare ajung în „Note extinse”;
- **informațiile pe care tipul le are deja** — trec pragul, dar tipul are deja câte un câmp pentru ele, așa că nu se propun din nou.

Eticheta o schimbați cum doriți: AI-ul citește în continuare la fel, pentru că „Indiciu pentru AI” păstrează formularea de pe pagină. Debifați un câmp ca să nu ajungă pe formular. Fiecare câmp bifat are nevoie de o etichetă, iar un câmp nu poate primi numele unui câmp pe care tipul îl are deja.

„Procent de potrivire” se poate muta și aici: nu se recitește nimic și nu costă nimic, doar se mută informațiile între „pe formular” și „sub prag”. Un tip de act poate avea un număr limitat de câmpuri; dacă formularul l-ar depăși, ridicați procentul sau debifați câteva câmpuri. „Ia de la capăt” renunță la ce vedeți și vă întoarce la alegere.

### 9.1.4 Aprobarea formularului {#tools-doc-type-engine-save}

„Aprobă formularul”, cu numărul de câmpuri bifate în paranteză, scrie doar câmpurile bifate. Nimic altceva din arhivă nu se modifică. Apare „Formularul a fost salvat”: de acum, fiecare act de acest tip își completează aceste câmpuri singur, la import, fără să mai întrebe, iar un import care s-a oprit pentru acest tip poate fi pornit din nou de la început. „Mergi la Import în sistem” vă duce la import (capitolul [[import]]).

Un formular se poate face sau corecta și de mână, pe pagina tipului din „Date de referință” → „Tipuri de Document”, la fila „Formular” (secțiunea [[admin-reference-data]]).

## 9.2 Calculul drumului lateral {#tools-side-road}

„Calcul drum lateral” împarte o proprietate cu patru colțuri, din arhivă, între proprietarii ei, după cotele-părți, cu un drum comun de acces pe o latură. Vă arată împărțirea pe hartă, vă lasă să alegeți ordinea proprietarilor și locul drumului și, la sfârșit, creează câte o proprietate pentru fiecare proprietar, una pentru drum și un grup cu toate. Fiecare calcul se înregistrează în „Istoricul calculelor”.

În bara laterală, deschideți „Instrumente” → „Calcul drum lateral”. Se deschide ecranul „Calcul drum lateral” (Figura [[fig-tools-calculation]]): pictograma istoricului, apoi „Proprietatea”, „Proprietarii” și „Drumul”.

![9.2 Ecranul „Calcul drum lateral”](tools-calculation.png){#fig-tools-calculation}

**Până la „Creează proprietățile” nu se creează nimic.** Tot ce vedeți pe hartă și în tabel este o previzualizare; puteți încerca oricâte ordini și oricâte drumuri.

### 9.2.1 Proprietatea, proprietarii și drumul {#tools-side-road-file}

Primul pas strânge trei lucruri, toate deja în arhivă sau scrise pe loc:

| Ce | Cum | Regula |
|---|---|---|
| „Proprietatea” | o căutați în „Caută proprietatea”, după cod, poreclă, nr. cadastral sau CF | exact 4 colțuri; una fără colțuri apare estompată și nu se poate alege |
| „Proprietarii” | îi căutați pe rând în „Caută un proprietar”, persoane fizice sau juridice — după nume, în orice ordine a cuvintelor și cu sau fără diacritice, după cod, CNP sau CUI — și scrieți fiecăruia „Cota-parte” | cel puțin 2, fiecare o singură dată; cote cu cel mult două zecimale, care însumează 100% sau 99,99% |
| „Lățime drum” | o scrieți, în metri | peste 0 și sub 15 m |

Ecranul păstrează ce ați ales și ce ați scris cât timp căutați un cod sau un nume pe alt ecran, până apăsați „Resetează”, la dreapta lui „Împarte proprietatea”.

Fiecare proprietar primește o culoare, aceeași pe care o va avea felia lui pe hartă. Ce nu respectă o regulă se scrie sub formular, după „Datele nu pot fi folosite:”, iar „Împarte proprietatea” rămâne inactiv până când totul e în regulă. De exemplu:

- „Proprietatea are 5 colțuri; trebuie să aibă exact 4.”
- „Cotele-părți însumează 98,00%; trebuie să fie 100% sau 99,99%.”
- „Lățimea drumului este 15 m; trebuie să fie peste 0 și sub 15 m.”

„Împarte proprietatea” deschide pașii de mai jos. „Modifică datele” vă întoarce la primul pas, cu tot ce ați scris.

### 9.2.2 Proprietarii pe hartă {#tools-side-road-owners}

„Împarte proprietatea” aduce parcela pe hartă, cu colțurile numerotate ca pe proprietate, tăiată în câte o felie pentru fiecare proprietar, într-o ordine aleatorie. Deasupra, un rând spune ce s-a împărțit: codul proprietății, câți proprietari sunt și lățimea drumului. Ecranul arată „Suprafața parcelei”, „Lățime drum”, lungimea fiecărei laturi („Latura 16–17” și așa mai departe) și tabelul proprietarilor.

Ordinea feliilor o schimbați în două feluri: trageți o felie peste alta, ca să le schimbați între ele, sau folosiți butoanele ↑ ↓ din coloana „Mută” a tabelului. Fiecare felie își păstrează suprafața, iar liniile de tăiere se mută. Fiecare proprietar își păstrează și culoarea: pătrățelul de lângă numele lui din tabel are culoarea feliei lui de pe hartă, oriunde s-ar muta — aceeași pe care a primit-o la primul pas.

Dacă cotele însumează 99,99%, sub tabel scrie că ultima felie din ordine preia diferența de 0,01%, iar cifrele ei o includ.

### 9.2.3 Drumul {#tools-side-road-road}

La „Pasul 3 — drumul”, faceți clic pe colțul din care pornește drumul — pe numărul lui de pe hartă — sau alegeți-l mai jos, la „Colțul drumului”. Ecranul vă spune apoi cele două laturi care pornesc din acel colț; faceți clic pe numele laturii, scris la mijlocul ei, sau alegeți-o la „Latura drumului”. O latură care nu pornește din colțul ales este refuzată, iar colțul rămâne ales.

Drumul apare alb pe hartă: o fâșie de lățimea aleasă la primul pas, în interiorul parcelei, de-a lungul laturii alese, pornind din colțul ales. Proprietarii se înșiră de-a lungul lui, cu granițele dintre ei perpendiculare pe drum; primul stă la colțul de unde pornește drumul, iar ultimul, dincolo de capătul drumului, ajunge la drum prin capătul lui. Fiecare proprietar primește, după cotă, partea lui din parcela fără drum și tot după cotă o parte din drum. Lungimea drumului se calculează singură, cât să iasă suprafețele.

Ecranul arată „Lungime drum” și „Suprafață drum”, iar tabelul are coloanele:

| Coloana | Ce arată |
|---|---|
| „Nr.”, „Proprietar”, „Cotă” | ordinea, numele și cota-parte |
| „Cotă × parcelă (m²)” | cât i se cuvine din toată parcela |
| „Cotă din drum (m²)” | partea lui din suprafața drumului |
| „Suprafață proprie (m²)” | felia lui, fără drum |
| „Proprie + drum (m²)” | cele două la un loc |
| „Diferență (m²)” | la un calcul reușit, 0,00 |

Ordinea proprietarilor se poate schimba și după ce ați pus drumul: drumul își păstrează colțul și latura, iar lungimea lui se recalculează. „Alege alt drum” vă lasă să alegeți alt colț sau altă latură.

Uneori forma parcelei nu permite drumul ales — drumul ar fi mai lung decât latura, ar ieși din parcelă, nu ar lăsa loc proprietarilor sau felia unui proprietar nu ar ajunge la el. Ecranul spune care dintre acestea este și vă cere altă latură, alt colț sau altă ordine.

### 9.2.4 Crearea proprietăților {#tools-side-road-create}

Mai jos stă „Creează … proprietăți — proprietarii și drumul — și un grup”, cu două câmpuri:

- „Descrierea grupului” — se completează singură cu „Diviz —” urmat de codul proprietății împărțite. Alegerea altei proprietăți o scrie din nou, așa că scrieți descrierea dumneavoastră după ce ați ales proprietatea.
- „Poreclă drum” — pornește cu „Drum comun”.

Fiecare proprietate nouă primește ca poreclă numele proprietarului ei urmat de „(după divizare)” — de pildă „Ion Popescu (după divizare)” —, iar proprietarul se leagă de ea, cu rolul „Proprietar” (secțiunea [[links-associate]]). Drumul nu are proprietar. Proprietatea împărțită rămâne cum era: nu se schimbă și nu se șterge.

„Creează proprietățile” creează proprietățile și grupul. Ecranul scrie „S-a creat grupul GRP-… cu următoarele proprietăți:”, codul calculului („Calculul înregistrat: CALC…”) și câte un link spre fiecare proprietate nouă. Colțurile fiecărei proprietăți poartă, în „Nr. orig.”, numerele colțurilor proprietății împărțite, acolo unde un colț al parcelei a ajuns pe ea (secțiunea [[properties-corners-table]]). Grupul îl găsiți în „Grupuri” (secțiunea [[links-classify-groups]]). Calculul apare primul în „Istoricul calculelor”, pe care îl deschide pictograma istoricului de lângă titlu (secțiunea [[tools-side-road-history]]).

### 9.2.5 Istoricul calculelor {#tools-side-road-history}

Pictograma istoricului, singura de pe ecranul „Calcul drum lateral”, lângă titlu, deschide „Istoricul calculelor”: câte un rând pentru fiecare calcul, cu „Cod”, „Algoritm” („Drum lateral”), „Parcele” (câte proprietăți a creat), „Grup”, „Stare”, „Creat de” și „Data”. „Înapoi la Calcul” vă întoarce.

„Detalii”, pe un rând, deschide „Detalii calcul”: „Parametrii calculului”, „Descriere grup”, „Pașii calculului” (tabelul proprietarilor), „Previzualizare hartă” (feliile, în culorile proprietarilor) și „Parcele create” — fiecare proprietate, cu „Rol” („Parcelă proprietar” sau „Drum comun”) și „Vezi proprietatea”. O proprietate ștearsă între timp apare cu „(ștearsă)”. Sub antet, pagina spune ce proprietate s-a împărțit.

„Re-rulează cu acești parametri” redeschide „Calcul drum lateral” pe aceleași colțuri — cele de la data calculului, chiar dacă ale proprietății s-au schimbat între timp —, cu aceiași proprietari, în aceeași ordine, și cu drumul deja pus; „Modifică datele” nu apare atunci. Un calcul făcut dintr-un fișier de date, înainte ca împărțirea să pornească de la o proprietate din arhivă, se poate consulta, dar nu se mai poate re-rula; la fel unul și mai vechi, făcut cu fișierul în cinci secțiuni.

„Șterge calculul”, pe rândul unui calcul, întreabă „Ștergeți calculul?” și spune că proprietățile și grupul create rămân. „Șterge” scoate calculul din istoric; proprietățile și grupul se șterg separat, dacă e cazul. Codul unui calcul șters nu se mai dă altuia.

## 9.3 Ghidurile hărții {#tools-area}

„Instrumente” ține trei ghiduri ale butoanelor hărții tuturor proprietăților. Fiecare deschide o casetă care arată butoanele, desenate ca pe hartă, și spune ce face fiecare. Caseta se deschide de fiecare dată când apăsați elementul din meniu.

- „Măsurători pe hartă” — „Unghiuri”, „Riglă”, „Suprafața unei zone delimitate” și „Suprafața unei zone oarecare” (secțiunile [[map-ruler]] și [[map-area]]).
- „Grupări de proprietăți” — „Tarlale”, „Grupuri” și „Selectează” (secțiunile [[map-what-tarlale]], [[map-what-groups]] și [[map-select]]).
- „Navigare” — „Navighează”, care stă pe ecranul proprietății și în bula unei proprietăți de pe hartă (secțiunea [[properties-navigate]]).

La primele două, „OK” deschide harta tuturor proprietăților, „Toate Proprietățile”, cu butoanele acelea pulsând împreună, în violet, de trei ori; apoi se liniștesc. Niciunul nu este apăsat în locul dumneavoastră: apăsați-l pe cel de care aveți nevoie. Dacă reîncărcați pagina, butoanele sunt arătate din nou. La „Navigare”, „OK” doar închide caseta. Niciun ghid nu scrie ceva în arhivă.

## 9.4 Exemple și cazuri de utilizare {#tools-examples}

### 9.4.1 Faceți formularul unui tip de act care nu are încă unul {#tools-example-form}

Importul s-a oprit pentru că tipul „Certificat de Moștenitor” nu are formular, iar aveți cincisprezece certificate scanate.

1. Puneți certificatele, ca PDF sau imagini, într-un folder doar al lor.
2. Deschideți „Instrumente” → „Distilare Tipizate” și alegeți tipul la „Tipul de document care primește formularul” (secțiunea [[tools-doc-type-engine-pick]]).
3. „Alege folderul cu mostre…”, lăsați „Procent de potrivire” cum este și citiți ce va costa (secțiunea [[tools-doc-type-engine-cost]]).
4. „Începe citirea” și așteptați până se deschide „Formularul propus”.
5. Dați câmpurilor etichete clare, alegeți „Fel”-ul potrivit și debifați ce nu vă trebuie (secțiunea [[tools-doc-type-engine-review]]).
6. „Aprobă formularul”, apoi porniți importul din nou, de la început (secțiunea [[tools-doc-type-engine-save]]).

### 9.4.2 Împărțiți un teren din Bragadiru între trei moștenitori, cu drum de acces {#tools-example-road}

Topograful v-a trimis colțurile terenului, iar cei trei moștenitori au câte o treime fiecare.

1. „Instrumente” → „Calcul drum lateral”.
2. Alegeți terenul, adăugați cei trei moștenitori cu 33,33 fiecare și lățimea drumului, de exemplu 3, apoi „Împarte proprietatea” (secțiunea [[tools-side-road-file]]).
3. Puneți proprietarii în ordinea dorită, trăgând feliile sau cu ↑ ↓ (secțiunea [[tools-side-road-owners]]).
4. Faceți clic pe colțul de la drumul public, apoi pe latura pe care merge drumul; verificați că „Diferență” arată 0,00 pe fiecare rând (secțiunea [[tools-side-road-road]]).
5. Scrieți „Descrierea grupului”, apoi apăsați „Creează proprietățile” (secțiunea [[tools-side-road-create]]). Fiecare moștenitor se leagă singur de proprietatea lui.

### 9.4.3 Refaceți un calcul făcut cu proprietarii în altă ordine {#tools-example-redo}

Ați creat proprietățile, dar proprietarii stăteau în altă ordine decât trebuia.

1. Deschideți „Istoricul calculelor” de pe ecranul „Calcul drum lateral”, apoi „Detalii” pe rândul calculului greșit și „Re-rulează cu acești parametri”: aceeași proprietate, aceiași proprietari, același drum (secțiunea [[tools-side-road-history]]).
2. Puneți ordinea bună, apoi „Creează proprietățile” (secțiunea [[tools-side-road-create]]).
3. În „Istoricul calculelor”, „Șterge calculul” pe rândul calculului greșit și „Șterge”; apoi ștergeți proprietățile și grupul create de el, care au rămas (secțiunile [[properties-add-edit]] și [[admin-groups]]).
`;
