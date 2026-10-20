/**
 * Manual, ro-RO, chapter 2. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 2 Primii pași {#start}

Capitolul acesta vă arată ce folosiți peste tot în aplicație: conectarea, bara laterală, bara de navigare, listele, fișele unui obiect și ajutorul. Odată știute, orice alt ecran se citește la fel.

## 2.1 Conectarea {#start-sign-in}

Deschideți aplicația în browser și conectați-vă cu adresa de e-mail și parola contului dumneavoastră, apoi apăsați „Conectare”. Se deschide tabloul de bord (secțiunea [[intro-purpose]]).

Sus, în bara laterală, scrie cu ce nume sunteți conectat („Autentificat ca …”). Jos, în bara laterală, sunt „Schimbă parola” și „Ieșire”.

Cine nu are încă un cont cere acces din pagina de conectare. Cererea ajunge la administrator, care o aprobă sau o respinge în „Utilizatori & Acces” (secțiunea [[admin-users]]).

## 2.2 Bara laterală {#start-sidebar}

Bara laterală, în stânga, deschide orice ecran al aplicației (Figura [[fig-sidebar]]). Este împărțită în secțiuni:

| Secțiunea | Ce cuprinde |
|---|---|
| Tablou de bord | Primul ecran: noutățile și ce cere atenție. |
| Domeniu | Cele patru liste: Persoane Fizice, Persoane Juridice, Proprietăți, Acte. |
| Instrumente | Distilare Tipizate, Calcul drum lateral, Măsurători pe hartă, Grupări de proprietăți, Navigare. |
| Import | Dosare de proprietăți: aducerea în arhivă a unui dosar întreg. |
| Rapoarte | Interacțiuni, Arbori de moștenire, Căutare globală. |
| Administrare | Date de referință, Utilizatori & Acces, Grupuri, Ștampile, Etichete. |
| Setări | Pragurile, implicitele și costurile aplicației. |
| Ajutor și învățare | Informații de ajutor și acest manual de utilizare. |

Un clic pe o secțiune îi arată ecranele, iar un clic pe un ecran îl deschide; ecranul deschis rămâne marcat în bară. „Restrânge bara laterală” o strânge la câte o pictogramă pentru fiecare secțiune, ca să lase mai mult loc ecranului, iar „Extinde bara laterală” o readuce.

![2.1 Bara laterală, cu secțiunea „Domeniu” deschisă](sidebar.png){#fig-sidebar}

## 2.3 Bara de navigare și „Înapoi” {#start-breadcrumb}

Deasupra fiecărui ecran, bara de navigare arată unde vă aflați: „Acasă”, apoi secțiunea și ecranul — de exemplu „Acasă › Administrare › Etichete”. Un nume din bară care este link vă duce înapoi la ecranul acela (Figura [[fig-breadcrumb]]).

Primul buton al barei, „Înapoi”, vă întoarce la ecranul de dinainte. Dacă ați schimbat ceva și nu ați salvat, aplicația vă întreabă întâi: „Anulează” vă lasă pe ecran cu ce ați scris, iar „Renunță” pleacă fără să salveze.

Imediat în dreapta lui, „Înainte” face drumul invers. După ce v-ați întors cu „Înapoi” — sau cu butonul Înapoi al browserului —, vă duce din nou la ecranul de pe care ați plecat. Până atunci este gri și nu se poate apăsa, iar un ecran nou deschis îl face din nou gri, ca butonul Înainte al browserului. Și el vă întreabă întâi, dacă aveți modificări nesalvate.

La capătul din dreapta al barei stă „?”, ajutorul ecranului (secțiunea [[start-help]]).

![2.2 Bara de navigare: „Înapoi”, „Înainte”, drumul până la ecran și „?”](breadcrumb.png){#fig-breadcrumb}

## 2.4 „Recente” {#start-recent}

„Recente”, jos în bara laterală, ține ultimele obiecte pe care le-ați deschis. Un clic pe „Recente” deschide sau strânge lista, iar un clic pe un obiect din ea îl redeschide.

## 2.5 Listele și coloanele lor {#start-lists}

Fiecare dintre cele patru liste — Persoane Fizice, Persoane Juridice, Proprietăți, Acte — arată câte 15 obiecte pe pagină, iar butoanele de sub tabel trec de la o pagină la alta. Caseta de căutare din capul listei este cât butonul „Adaugă …” de la capătul rândului și spune în ea după ce caută; dacă textul nu încape, țineți mouse-ul pe casetă și îl citiți întreg. O listă se filtrează după coloanele ei: o coloană care se poate filtra are, sub nume, o pâlnie (secțiunea [[properties-list-filters]]). Capul tabelului are înălțimea a trei rânduri: numele pe primele două, pâlnia pe al treilea, iar numele unei coloane fără filtru stă la mijloc.

„Câmpuri afișate” alege coloanele listei: bifați ce vreți să vedeți și debifați ce nu vă trebuie (Figura [[fig-list]]). „Deschide”, pe un rând, deschide obiectul; „Adaugă …”, deasupra tabelului, creează unul nou.

Bifa din capul tabelului selectează rândurile paginii curente, nu ale întregii liste.

![2.3 Lista persoanelor fizice, cu „Câmpuri afișate” deschis](list.png){#fig-list}

Sub bara de sus a listei stă un rând cu etichetele filtrelor puse și „Șterge filtrele” — dar numai cât timp este pus un filtru; fără niciun filtru, tabelul începe chiar sub bară.

**Lista încape în fereastră.** Când fereastra nu este destul de înaltă pentru toată pagina de rânduri, pagina nu se mai derulează în sus și în jos: se derulează doar rândurile, în chenarul listei, cu bara lui de derulare. Capul tabelului, cu numele coloanelor, bifa și pâlniile, rămâne sus, iar rândul „Se afișează … din …” cu „Pagina x din y” stă chiar sub chenar, la vedere. Numai într-o fereastră foarte scundă, în care n-ar mai încăpea nici capul tabelului și trei rânduri, se derulează iar pagina.

**Coloanele ascunse.** Când coloanele alese sunt mai late decât fereastra, lista se derulează și în lateral, cu bara de derulare de la baza chenarului. Cât timp în dreapta sunt coloane care nu se văd, la marginea dreaptă a capului tabelului stau trei semne roșii „>”, unul sub altul; cât timp sunt coloane ascunse în stânga, trei „<” stau la marginea stângă (Figura [[fig-list-fit]]). Sunt doar semne: o pâlnie de sub ele se apasă ca de obicei. Când toate coloanele încap, nu apare niciunul.

Când deschideți un obiect din listă și vă întoarceți cu „Înapoi”, lista este derulată unde o lăsaserăți, în jos și în lateral.

![2.4 Lista proprietăților într-o fereastră scundă și îngustă: capul tabelului sus, „Pagina x din y” sub chenar și semnele roșii ale coloanelor ascunse la ambele margini](list-fit.png){#fig-list-fit}

## 2.6 Ecranul unui obiect: fișele {#start-tiles}

Un obiect deschis își arată datele în fișe — panouri cu câte un nume (Figura [[fig-record]]). Pe o persoană fizică sunt, de exemplu, identitatea ei, „Legături”, „Clasificare”, „Etichete și grupuri” și „Interacțiuni”.

- Bifele din capul ecranului aleg ce fișe se văd; „Toate” le arată pe toate, iar „Implicit” revine la setul obișnuit. Setul vostru se salvează în „Setări”, la „Implicitele mele”.
- O fișă se trage de spațiul ei gol într-un loc liber; un dublu-clic pe ea o urcă sub fișa de deasupra.
- Ca să puneți o fișă unde stă alta, trageți-o peste aceea și țineți-o nemișcată: după o secundă — cât spune „Timp de ținere peste altă fișă”, în „Setări” (secțiunea [[admin-settings-thresholds]]) — fișa de dedesubt alunecă în jos, în coloanele ei, la primul loc liber destul de mare, iar conturul arată că locul e liber (Figura [[fig-make-room]]). Lăsați fișa acolo; Esc pune totul înapoi. Fișele mov deschis nu se dau la o parte.
- Fișele mov deschis — harta, colțurile, Street View, paginile unui act — stau pe loc.
- ID-ul de sistem al obiectului stă în colțul din dreapta-sus al primei fișe.
- Bara de butoane, ultimul lucru de pe ecran, ține creionul (modificați), salvarea și coșul (ștergeți). Un buton cu pictogramă își arată numele când treceți cu mouse-ul peste el.

![2.5 Ecranul unei persoane fizice, cu fișele ei](record.png){#fig-record}

![2.6 O fișă ținută peste alta: cea de dedesubt a alunecat în jos, la primul loc în care încape întreagă](make-room.png){#fig-make-room}

## 2.7 Previzualizarea {#start-preview}

Un obiect legat se poate deschide alături, cu „Previzualizare”, fără să plecați de pe ecranul pe care lucrați — de exemplu cumpărătorul, lângă contractul de vânzare. Se deschid cel mult două previzualizări odată, iar o modificare nesalvată pe ecranul principal rămâne neatinsă. Dintr-o listă, previzualizarea unui rând se deschide lângă tabel.

## 2.8 Ajutorul din spatele „?” {#start-help}

Butonul „?” din capătul barei de navigare deschide ajutorul ecranului: la ce folosește ecranul și cum se lucrează pe el (Figura [[fig-help]]). Acolo unde un gest nu se vede — o tragere, un dublu-clic — un bec mic, lângă locul acela, îl explică. Textele de ajutor le scrie administratorul, în „Informații de ajutor” (secțiunea [[admin-help]]).

![2.7 Ajutorul unui ecran, deschis din „?”](help.png){#fig-help}

## 2.9 Exemple și cazuri de utilizare {#start-examples}

### 2.9.1 Găsiți o persoană după o parte din nume {#start-example-find}

1. În bara laterală, deschideți „Domeniu”, apoi „Persoane Fizice”.
2. Scrieți în caseta de căutare o parte din nume.
3. Dacă rămân mai multe persoane cu același nume, adăugați din „Câmpuri afișate” o coloană care le deosebește, de pildă data nașterii.
4. Apăsați „Deschide” pe rândul căutat.

### 2.9.2 Plecați de pe un ecran fără să pierdeți ce ați scris {#start-example-back}

1. Pe ecranul unei persoane, schimbați un câmp, fără să salvați.
2. Apăsați „Înapoi”: aplicația vă întreabă ce faceți cu modificările.
3. „Anulează” vă lasă pe ecran, cu ce ați scris. Salvați, apoi apăsați din nou „Înapoi”.

### 2.9.3 Faceți loc pe ecran {#start-example-room}

1. Strângeți bara laterală cu „Restrânge bara laterală”.
2. Debifați fișele de care nu aveți nevoie acum.
3. Când ați terminat, „Implicit” readuce fișele obișnuite.
`;
