/**
 * Manual, ro-RO, chapter 2. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 2 Primii pași {#start}

Capitolul acesta vă arată ce folosiți peste tot în aplicație: conectarea, bara laterală, bara de navigare, listele, fișele unei înregistrări și ajutorul. Odată știute, orice alt ecran se citește la fel.

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
| Instrumente | Distilare Tipizate, Calcul drum lateral, Calcul suprafață. |
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

La capătul din dreapta al barei stă „?”, ajutorul ecranului (secțiunea [[start-help]]).

![2.2 Bara de navigare: „Înapoi”, drumul până la ecran și „?”](breadcrumb.png){#fig-breadcrumb}

## 2.4 „Recente” {#start-recent}

„Recente”, jos în bara laterală, ține ultimele înregistrări pe care le-ați deschis. Un clic pe „Recente” deschide sau strânge lista, iar un clic pe o înregistrare din ea o redeschide.

## 2.5 Listele și coloanele lor {#start-lists}

Fiecare dintre cele patru liste — Persoane Fizice, Persoane Juridice, Proprietăți, Acte — arată câte 15 înregistrări pe pagină, iar butoanele de sub tabel trec de la o pagină la alta. Caseta de căutare din capul listei caută după cod, nume și, la persoane, după e-mail sau telefon.

„Câmpuri afișate” alege coloanele listei: bifați ce vreți să vedeți și debifați ce nu vă trebuie (Figura [[fig-list]]). „Deschide”, pe un rând, deschide înregistrarea; „Adaugă …”, deasupra tabelului, creează una nouă.

Bifa din capul tabelului selectează rândurile paginii curente, nu ale întregii liste.

![2.3 Lista persoanelor fizice, cu „Câmpuri afișate” deschis](list.png){#fig-list}

## 2.6 Ecranul unei înregistrări: fișele {#start-tiles}

O înregistrare deschisă își arată datele în fișe — panouri cu câte un nume (Figura [[fig-record]]). Pe o persoană fizică sunt, de exemplu, identitatea ei, „Corelate”, „Clasificări”, „Conexiuni” și „Interacțiuni”.

- Bifele din capul ecranului aleg ce fișe se văd; „Toate” le arată pe toate, iar „Implicit” revine la setul obișnuit. Setul vostru se salvează în „Setări”, la „Implicitele mele”.
- O fișă se trage de spațiul ei gol într-un loc liber; un dublu-clic pe ea o urcă sub fișa de deasupra.
- Fișele mov deschis — harta, colțurile, Street View, paginile unui act — stau pe loc.
- ID-ul de sistem al înregistrării stă în colțul din dreapta-sus al primei fișe.
- Bara de butoane, ultimul lucru de pe ecran, ține creionul (modificați), salvarea și coșul (ștergeți). Un buton cu pictogramă își arată numele când treceți cu mouse-ul peste el.

![2.4 Ecranul unei persoane fizice, cu fișele ei](record.png){#fig-record}

## 2.7 Previzualizarea {#start-preview}

O înregistrare legată se poate deschide alături, cu „Previzualizare”, fără să plecați de pe ecranul pe care lucrați — de exemplu cumpărătorul, lângă contractul de vânzare. Se deschid cel mult două previzualizări odată, iar o modificare nesalvată pe ecranul principal rămâne neatinsă. Dintr-o listă, previzualizarea unui rând se deschide lângă tabel.

## 2.8 Ajutorul din spatele „?” {#start-help}

Butonul „?” din capătul barei de navigare deschide ajutorul ecranului: la ce folosește ecranul și cum se lucrează pe el (Figura [[fig-help]]). Acolo unde un gest nu se vede — o tragere, un dublu-clic — un bec mic, lângă locul acela, îl explică. Textele de ajutor le scrie administratorul, în „Informații de ajutor” (secțiunea [[admin-help]]).

![2.5 Ajutorul unui ecran, deschis din „?”](help.png){#fig-help}

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
