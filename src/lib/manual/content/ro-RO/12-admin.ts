/**
 * Manual, ro-RO, chapter 12. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 12 Administrare și Setări {#admin}

Capitolul acesta este pentru cine îngrijește arhiva: listele din care aleg celelalte ecrane, conturile colegilor, grupurile, ștampilele și etichetele, textele de ajutor și setările aplicației. Ecranele lui stau în bara laterală: în secțiunea „Administrare” — „Date de referință”, „Utilizatori & Acces”, „Grupuri”, „Ștampile”, „Etichete” —, în „Setări” și, pentru textele de ajutor, în „Ajutor și învățare”.

## 12.1 Date de referință {#admin-reference-data}

„Date de referință” ține vocabularul arhivei: aproape fiecare listă din care alegeți o valoare pe un ecran — tipul unei proprietăți, cetățenia unei persoane, tipul unui act, rolul unei persoane într-un act — se umple de aici. Îl deschideți din „Administrare” → „Date de referință”.

Ecranul este o singură pagină (Figura [[fig-admin-value-lists]]). În stânga stau listele, în trei grupe; în dreapta, lista aleasă. Până nu alegeți una, în dreapta scrie „Alegeți o listă din stânga.”. Lista aleasă rămâne marcată în stânga, iar butonul de întoarcere al browserului vă duce la lista de dinainte.

![12.1 „Date de referință”](admin-value-lists.png){#fig-admin-value-lists}

| Grupa | Listele |
|---|---|
| Tipuri de obiecte | „Tipuri de Persoană Fizică”, „Tipuri de Persoană Juridică”, „Tipuri de Proprietate”, „Tipuri de Document” |
| Roluri și legături | „Roluri Persoane”, „Legături Proprietate → Proprietate”, „Legături Document → Document” |
| Liste de valori | „Indicative Tarla”, „Categorii Folosință”, „Cetățenie”, „Instituții” |

Fiecare rând stă pe o singură linie. O valoare prea lungă pentru coloana ei se termină în „…”; țineți mouse-ul pe ea și o vedeți întreagă. La o listă lungă se derulează doar rândurile: titlurile coloanelor rămân sus.

### 12.1.1 Valorile unei liste {#admin-reference-data-values}

Deasupra tabelului stau „Adaugă” și numărul valorilor, de exemplu „8 valori”. Pe fiecare rând stau „Editează”, „Unește” și „Șterge”.

Coloana „Folosit de” spune câte obiecte folosesc valoarea: „1 obiect”, „2 obiecte”. O valoare pe care nu o folosește nimeni scrie „nefolosit”, cu gri, și stă după valorile folosite.

- **O valoare nouă.** „Adaugă” deschide „Adaugă o valoare nouă”. Completați „Denumire” — este obligatorie — și celelalte câmpuri ale listei, apoi apăsați „Salvează”. Valoarea nouă apare ultima în listă.
- **O valoare redenumită.** „Editează” deschide „Editează valoarea”, cu valoarea de acum. Schimbați-o și apăsați „Salvează”.
- **Două valori unite.** Când aceeași valoare a ajuns în listă de două ori, scrisă diferit, apăsați „Unește” pe cea care trebuie să dispară. Fereastra „Unește „…” cu altă valoare” spune câte obiecte se mută, de exemplu „Un obiect se mută pe valoarea păstrată:”. Alegeți în „Valoarea păstrată” valoarea care rămâne și apăsați „Unește”. Obiectele trec pe valoarea păstrată, iar cealaltă dispare din listă.
- **O valoare ștearsă.** „Șterge” întreabă „Ștergeți „…”?” și verifică întâi ce depinde de valoare: „Se verifică ce depinde de această valoare…”. Dacă nu depinde nimic, scrie „Nimic nu depinde de această valoare. La ștergere dispare definitiv — acțiunea nu poate fi anulată.”; „Șterge” o șterge, „Anulează” renunță. Dacă o folosesc obiecte, fereastra spune câte, iar ștergerea nu este posibilă până nu le mutați pe altă valoare: alegeți-o la „Mutați-le pe:” și apăsați „Mută”.

Versiunile vechi ale obiectelor nu se schimbă: fiecare păstrează valoarea așa cum era când a fost salvată (secțiunea [[links-versions]]).

### 12.1.2 Rolurile și legăturile {#admin-reference-data-roles}

„Roluri Persoane” ține rolurile pe care le poate avea o persoană: într-un act („Vânzător”, „Cumpărător”), pe o proprietate sau față de altă persoană. Coloanele listei:

- „Denumire” — numele rolului; descrierea lui o citiți ținând mouse-ul pe nume.
- „Persoană → Proprietate” și „Persoană → Persoană” — un ✓ spune că rolul se poate alege la legătura aceea. La rolurile de rudenie, în locul ✓-ului stă rudenia, de exemplu „Părinte” sau „Copil”.
- „Rol invers (bărbat, femeie)” — cum se citește rolul din celălalt capăt al legăturii, despărțit prin virgulă, de exemplu „Vânzător, Vânzătoare” (secțiunea [[links-associate-role]]).
- „Folosit de” — câte obiecte îl folosesc.

„Editează” deschide panoul rolului. Acolo stau numele, numele inverse — „Rol invers”, „Rol invers — bărbat”, „Rol invers — femeie” — și „Se aplică la”, cu trei butoane: „Act”, „Proprietate” și „Persoană”. „Proprietate” oferă rolul la legătura unei persoane cu o proprietate, „Persoană” la legătura dintre două persoane. Cât timp „Persoană” este apăsat, panoul arată și „Rudenie”: „Părinte”, „Copil”, „Soț/soție”, „Frate/soră”, „Altă rudă” sau „Nicio rudenie”. La un rol pe care îl caută importul unei cărți de identitate, rudenia nu se poate schimba, iar panoul spune de ce.

„Act” deschide „Tipuri de act”: tipurile de act pe care este oferit rolul. Alegeți un tip în „Adaugă un tip de act” și apăsați „Adaugă tipul”. Fiecare tip din listă are:

- „Deține cotă” — bifat, rolul aduce cota-parte pe legătură (secțiunea [[documents-parties]]); bifa se salvează pe loc;
- câte legături îl folosesc deja, de exemplu „1 legătură”;
- „Scoate „…”” — rolul nu mai este oferit pe acel tip. Legăturile făcute deja rămân, dar rolul nu mai poate fi ales pentru acel tip de act.

Un rol nou se salvează întâi; abia apoi i se pot alege tipurile de act.

Deasupra celor trei liste din „Roluri și legături” stă fișa „Cum se leagă obiectele între ele”: un triunghi cu „Persoană”, „Proprietate” și „Document” în colțuri. Un colț înseamnă o legătură între două obiecte de același fel, o latură o legătură între două feluri. Lângă desen, cele șase legături sunt numerotate ca în desen și explicate, fiecare cu „Vezi:” și locul unde se configurează. Un clic pe un număr sau pe un nume deschide lista aceea. Latura „Document – Proprietate” este punctată și nu deschide nimic: legătura nu are o listă, pentru că tipul actului spune ce înseamnă. Butonul ⓘ de după notele 5 și 6 arată, pas cu pas, cum se face legătura.

„Legături Proprietate → Proprietate” și „Legături Document → Document” țin legăturile cu sens dintre două proprietăți și dintre două acte, de exemplu „Inclus în” sau „Titlu anterior al” (secțiunea [[links-references]]).

### 12.1.3 Tipurile de document {#admin-reference-data-document-types}

„Tipuri de Document” are coloanele „Denumire”, „Denumire scurtă”, „Stare” și „Folosit de (n obiecte)”. „Stare” spune de unde vine tipul și dacă are formular: „Adăugat manual”, „Creat la import” sau „Are formular”. Țineți mouse-ul pe denumirea unui tip și bula arată denumirea întreagă, iar sub ea cheia tipului, de exemplu „CONTRACT_VANZARE”.

Deasupra tabelului stau două bife: „Cu formular” arată doar tipurile care au formular, „Fără formular” doar pe cele care nu au. Amândouă bifate, sau niciuna, arată toate tipurile. Când un import se oprește la un tip fără formular, legătura lui deschide lista cu „Fără formular” bifat (capitolul [[import]]).

„Deschide”, pe rândul unui tip, deschide pagina tipului, cu trei file:

- „General” — „Denumire”, „Denumire scurtă”, „Cod” și „Stare”, cu „Salvează”. Codul se poate doar citi: „Codul nu se schimbă: formularele exportate, cererea către AI și testele îl folosesc.”. Denumirea scurtă este cea din coloana „Tip” a listei actelor (secțiunea [[documents-list]]).
- „Formular” — câmpurile proprii ale actelor de acest tip (secțiunea [[documents-identification]]). Fără formular, fila spune „Acest tip nu are încă formular.” și oferă „Creează formularul”; cu formular, „Editează formularul”, cu numărul câmpurilor. Fiecare câmp are o etichetă în română și una în engleză. Cheia de sub etichetă se stabilește la adăugarea câmpului și nu se mai schimbă, așa că o etichetă se poate redenumi fără grijă. Cartea de identitate și tipul de rezervă pentru actele neclasificate nu pot avea formular.
- „Roluri” — rolurile pe care le poate avea o persoană într-un act de acest tip. Alegeți un rol în „Adaugă un rol” și apăsați „Adaugă rolul”; bifați „Deține cotă” acolo unde rolul aduce o cotă-parte.

Fila „Roluri” a unui tip și „Act” din panoul unui rol arată aceleași perechi, din două capete: un rol adăugat pe un tip apare și în panoul rolului, cu bifa lui. „← Tipuri de Document” vă întoarce la listă.

## 12.2 Utilizatori și acces {#admin-users}

Un coleg fără cont cere acces din pagina de conectare (secțiunea [[start-sign-in]]). Cererea lui ajunge în „Administrare” → „Utilizatori & Acces”, unde ecranul spune: „Revizuiți și gestionați cererile de cont. Aprobarea creează un cont și trimite solicitantului parola temporară pe email.”.

Ecranul are două file:

- „Cereri în așteptare”, cu numărul cererilor în titlu. Fiecare rând arată „Utilizator”, „Email” și „Trimis la”, iar la „Acțiuni” butoanele „Aprobă” și „Respinge”. Fără cereri, fila spune „Nu există cereri în așteptare.”.
- „Istoric” — cererile la care s-a răspuns, cu „Stare” („Aprobat” sau „Respins”), „Procesat la” și „De”, adică cine a răspuns.

„Aprobă” creează contul și îi trimite colegului parola temporară pe e-mail; ecranul confirmă cu „Cont creat și email trimis.”. „Respinge” refuză cererea și îl anunță pe solicitant: „Cerere respinsă și solicitantul notificat.”. În ambele cazuri cererea pleacă din „Cereri în așteptare” și rămâne pentru totdeauna în „Istoric”. Dacă e-mailul nu a putut fi trimis, mesajul o spune în paranteză; contul, sau refuzul, s-a înregistrat totuși.

Un cont aprobat nu se poate șterge din aplicație, așa că aprobați doar cererile pe care le recunoașteți. Parola temporară o poate schimba colegul însuși, în „Setări” → „Contul meu” (secțiunea [[admin-settings-account]]).

## 12.3 Grupuri, ștampile și etichete {#admin-groups}

Grupurile, ștampilele și etichetele se pun pe obiecte din fișa „Etichete și grupuri” a fiecăruia (secțiunea [[links-classify]]). Aici sunt ecranele care le țin pe toate laolaltă.

### 12.3.1 Grupurile {#admin-groups-groups}

„Administrare” → „Grupuri” arată panoul „Ce este un Grup?”, „Adaugă”, numărul grupurilor, de exemplu „4 grupuri”, și tabelul „Cod” · „Descriere”. Fiecare rând are codul grupului, cu numărul membrilor în paranteză, felul obiectelor pe care le strânge, descrierea, „Editează” și „Șterge”.

1. „Adaugă” deschide „Adaugă grup nou”. Alegeți „Țintă” — „Proprietate”, „Persoană fizică”, „Persoană juridică” sau „Document” —, scrieți „Descriere” și apăsați „Salvează”. Rămâneți pe listă, cu grupul nou primul; codul, de forma GRP-001, se dă la salvare.
2. „Editează” deschide „Grup GRP-…”, cu trei fișe: „Identitatea grupului” („Țintă” și „Cod” doar de citit, „Descriere”), „Membri disponibili pentru includere” și „Deja în grup”.
3. Căutați în „Caută…”, bifați obiectele și apăsați „Adaugă în grup”; ca să scoateți unul, bifați-l în „Deja în grup” și apăsați „Elimină din grup”. Membrii adăugați poartă „[nou]”, iar ecranul arată „Modificări nesalvate”: încă nu s-a scris nimic.
4. „Salvează grupul” scrie schimbările; „[nou]” devine poziția membrului în grup, „[01]”, „[02]”.

Fișele ecranului se pot muta trăgându-le de un loc gol, iar „Implicit”, sus în dreapta, le pune la loc. „Șterge” pe rândul unui grup întreabă „Ștergeți acest grup? Această acțiune nu poate fi anulată.”; obiectele din grup rămân în arhivă.

### 12.3.2 Ștampilele {#admin-groups-stamps}

„Administrare” → „Ștampile” arată panoul „Ce este o Ștampilă?”, numărul ștampilelor și tabelul „Ștampilă” · „Elemente”: fiecare rând are codul și descrierea ștampilei, nota ei, câte obiecte o poartă, „Aplică” și „Șterge”.

1. Butonul cu „+”, „Creare ștampilă”, deschide formularul: „Descriere scurtă” (obligatorie, cel mult 200 de caractere) și „Note”. Codul, de forma STMP-AAA, se dă la salvare. „Salvează” vă lasă pe listă, cu ștampila nouă prima.
2. „Aplică” deschide „Aplică ștampila: …”, cu patru fișe: „Descrierea ștampilei”, „Tip element”, „Elemente disponibile pentru ștampilare” și „Elemente deja ștampilate”.
3. Alegeți în „Tip element” felul obiectelor; listele arată doar obiecte de felul acela. Bifați-le și apăsați „Aplică ștampila”, sau, în cealaltă listă, „Elimină ștampila”. Ecranul arată „Modificări nesalvate”.
4. „Salvează ștampilele”, butonul cu discheta, scrie schimbările. O ștampilă poate sta pe obiecte de feluri diferite: schimbați „Tip element” și continuați.

Ca la grupuri, fișele se mută trăgându-le, iar „Implicit” le pune la loc. „Șterge” întreabă „Ștergeți această ștampilă și o eliminați de pe toate elementele?”: ștampila dispare și de pe obiecte, iar obiectele rămân.

### 12.3.3 Etichetele {#admin-groups-tags}

„Administrare” → „Etichete” arată „Nor de etichete”: toate etichetele din arhivă, câte distincte sunt și, pe fiecare, de câte ori este folosită, de exemplu „×1”. Cele mai folosite sunt mai mari. Când nu încap în fereastră, se derulează doar etichetele; titlul și butoanele rămân sus.

Un dublu-clic pe o etichetă o alege, iar al doilea o lasă; eticheta aleasă apare apăsată.

- Cu o etichetă aleasă, „Redenumește etichetă” o face casetă chiar în nor. Scrieți noul nume și apăsați Enter, sau Esc ca s-o lăsați cum era. Numele se scrie cu litere mici; dacă noul nume există deja, cele două etichete se contopesc.
- Cu două sau mai multe alese, „Fuzionează etichete” deschide „Fuzionare etichete”, cu ele bifate. Alegeți „Păstrează aceasta” la eticheta care rămâne; fereastra spune ce se va întâmpla, de exemplu „Etichetele „arenda” vor deveni „arendă”.”. Apăsați „Fuzionează”.

Fără nicio etichetă aleasă, ambele butoane sunt inactive.

## 12.4 Informații de ajutor {#admin-help}

Textele din spatele butonului „?” și sfaturile cu bec de pe ecrane (secțiunea [[start-help]]) nu sunt fixe: le scrie administratorul, în „Ajutor și învățare” → „Informații de ajutor”. Ecranul are două file, „Ecrane” și „Sfaturi rapide”.

„Ecrane” arată lista ecranelor aplicației, de exemplu „Administrare — Etichete” sau „Proprietăți — Listă”, fiecare cu „Complet” sau „Lipsă”. Alegeți un ecran și completați cele patru câmpuri:

| Câmpul | Ce scrieți |
|---|---|
| Context (Română) | la ce folosește ecranul |
| Cum se folosește (Română) | ce faceți pe el, pas cu pas |
| Context (Engleză) | același context, în engleză |
| Cum se folosește (Engleză) | aceleași instrucțiuni, în engleză |

„Previzualizare” arată textul așa cum va apărea, pe măsură ce scrieți. „Salvează” îl salvează, iar ecranul confirmă cu „Salvat”. De acum, „?” de pe ecranul acela deschide panoul „Ajutor”, cu „Context” și „Cum se folosește”, așa cum le-ați scris, iar sub ele „Vezi în manual”, cu secțiunea acestui manual care descrie ecranul. Un ecran marcat „Propunere” are un text propus din manual, pe care îl acceptați, îl editați sau îl lăsați deoparte (secțiunea [[learning-help-proposals]]).

„Sfaturi rapide” ține sfaturile cu bec: alegeți un sfat din listă și scrieți-i textul în „Text sfat (Română)” și „Text sfat (Engleză)”. Un sfat care stă pe mai multe ecrane spune „Apare pe … ecrane — textul se salvează pe toate.”.

## 12.5 Setări {#admin-settings}

„Setări” se deschide din bara laterală (Figura [[fig-admin-settings]]). Ca pe ecranul unui obiect, căsuțele de sus aleg ce părți se văd, iar „Implicit” le aduce înapoi (secțiunea [[start-tiles]]). Părțile sunt „Contul meu”, „Praguri de timp”, „Copii de siguranță”, „Despre” și, în grupa „Costuri”, câte una pentru fiecare furnizor care poate costa bani.

![12.2 „Setări”](admin-settings.png){#fig-admin-settings}

### 12.5.1 „Contul meu” {#admin-settings-account}

„Contul meu” ține ce este al dumneavoastră, nu al arhivei:

- **Parola.** Scrieți parola nouă în „Parola nouă” — cel puțin 8 caractere — și încă o dată în „Confirmă parola”, apoi apăsați „Schimbă parola”. Aplicația confirmă cu „Parola a fost schimbată!”. Dacă cele două nu se potrivesc, spune „Parolele nu coincid.”.
- **Limba.** La „Limba” alegeți „Română” sau „English”.
- **„Implicitele mele”.** Pentru fiecare fel de obiect — „Persoană fizică”, „Persoană juridică”, „Proprietate”, „Act” — bifați fișele pe care vreți să le arate „Implicit” pe ecranul lui și apăsați „Salvează”; apare „Salvat.”. Setul este al contului, nu al browserului, așa că rămâne și după o reîncărcare, și în orice browser. „Revino la implicit” uită setul dumneavoastră și readuce setul obișnuit al aplicației: „Revenit la implicit.”. Cel puțin o fișă rămâne bifată.

„Ieșire” stă jos în bara laterală.

### 12.5.2 „Praguri de timp” {#admin-settings-thresholds}

„Praguri de timp” ține zece numere care hotărăsc când ceva este „nou”, „curând” sau „vechi”, în patru grupe: „Tablou de bord”, „Acte”, „Persoane” și „Insigna „Nou!””. Fiecare prag are un nume, o propoziție, un număr cu unitatea lui și un exemplu. Exemplul se schimbă pe loc, după numărul pe care îl scrieți: la „Fereastră filtru expiră curând”, cu 30 scrie „Exemplu: Un act apare «expiră curând» cu 30 de zile înainte.”, iar cu 45, „… cu 45 de zile înainte.”.

Pragurile hotărăsc, printre altele:

- câte zile în urmă numără „Recente” pe „Tablou de bord” și câte zile înainte arată acolo actele care expiră;
- cu cât timp înainte un act apare „expiră curând”;
- cu cât timp înainte de expirare este semnalată o carte de identitate („Prag CI expiră curând”);
- cât timp poartă un obiect schimbat insigna „Nou!”, roșie și apoi chihlimbar, și după cât timp insigna dispare.

Cum schimbați un număr, lângă „Salvează” apare „Anulează”, care readuce valoarea salvată. „Salvează” confirmă cu „Salvat cu succes.”. Valorile sunt numere întregi între 1 și 3650. Pragurile sunt ale arhivei, nu ale unui cont: o schimbare se vede la toți utilizatorii.

### 12.5.3 „Costuri” {#admin-settings-costs}

Grupa „Costuri” are câte o parte pentru fiecare furnizor care poate costa bani: „AI”, „Abonament Claude”, „Google Maps”, „Street View”, „Adrese căutate”, „Supabase”, „Vercel”, „Resend (e-mail)”, „GitHub”, „Domeniu web” și „Testare”. Fiecare se deschide strânsă la un rând, în CA$: „Luna aceasta: … · prognoză: …”. La „AI” rândul începe cu „Estimat luna aceasta”, pentru că acolo costul este o estimare.

„Detalii” deschide partea, iar „Restrânge” o strânge la loc. Deschisă, arată:

- „Ce se plătește”, „Gratuit” — ce dă furnizorul fără plată — și „Cum se plătește”, cu „Prețuri verificate la …” și o legătură spre „pagina de prețuri a furnizorului”;
- „Luna aceasta, până azi”, „Prognoză la sfârșitul lunii” și „Costul în timp”;
- la „AI”, la ce folosește aplicația citirile plătite — de exemplu „Extragerea datelor din acte” — și modelul fiecăreia;
- la „Street View” și „Adrese căutate”, folosirea lunii față de partea gratuită; ce vine de la oameni este o estimare, iar ecranul o spune.

Acolo unde suma vine de pe o factură, o scrieți la „Sume introduse”: „De la”, „Până la”, „Suma”, „Moneda”, „Curs în CA$” și, dacă vreți, „Notă”, apoi apăsați „Adaugă o sumă”. Rândul nou arată suma și echivalentul ei în CA$, iar cifrele lunii o socotesc. „Șterge suma” o scoate.

### 12.5.4 „Copii de siguranță” și „Despre” {#admin-settings-about}

„Copii de siguranță” se poate doar citi: „Ultima copie” și „Ultima probă de restaurare”, cu rezultatul ei. Pe o instalare care nu le poate citi, partea spune asta într-o propoziție. „Despre” arată „Versiune”, „Commit”, „Mediu” și „Bază de date”: copiați-le când semnalați o problemă.

## 12.6 Exemple și cazuri de utilizare {#admin-examples}

### 12.6.1 Uniți o categorie de folosință scrisă de două ori {#admin-example-merge}

În „Categorii Folosință” stau două valori care spun același lucru, scrise diferit.

1. Deschideți „Administrare” → „Date de referință” și alegeți „Categorii Folosință” (secțiunea [[admin-reference-data]]).
2. Citiți „Folosit de” pe cele două rânduri și hotărâți care valoare rămâne.
3. Apăsați „Unește” pe cealaltă, alegeți-o pe prima în „Valoarea păstrată” și apăsați „Unește” (secțiunea [[admin-reference-data-values]]).
4. Verificați că valoarea unită a dispărut și că „Folosit de” al valorii păstrate a crescut.

### 12.6.2 Oferiți un rol cu cotă pe un tip de act {#admin-example-role}

Pe un contract de vânzare-cumpărare vreți să alegeți un rol care încă nu este oferit pe acest tip, cu cota-parte lui.

1. În „Date de referință”, deschideți „Tipuri de Document” și apăsați „Deschide” pe „Contract de Vânzare” (secțiunea [[admin-reference-data-document-types]]).
2. Pe fila „Roluri”, alegeți rolul în „Adaugă un rol” și apăsați „Adaugă rolul”.
3. Bifați „Deține cotă” pe rândul lui.
4. Deschideți „Roluri Persoane” și apăsați „Editează” pe rol: la „Act”, contractul apare cu „Deține cotă” bifat (secțiunea [[admin-reference-data-roles]]).
5. Pe un contract, asociați o persoană cu acest rol; rândul ei din „Legături” are „Cotă” (secțiunea [[documents-parties]]).

### 12.6.3 Dați acces unui coleg nou {#admin-example-access}

Un coleg a cerut acces din pagina de conectare.

1. Deschideți „Administrare” → „Utilizatori & Acces”, fila „Cereri în așteptare” (secțiunea [[admin-users]]).
2. Verificați numele și e-mailul de pe rând și apăsați „Aprobă”.
3. Spuneți-i colegului să-și caute parola temporară în e-mail și să și-o schimbe în „Setări” → „Contul meu” (secțiunea [[admin-settings-account]]).
4. Pe fila „Istoric”, cererea apare „Aprobat”, cu ziua și cu numele dumneavoastră la „De”.

### 12.6.4 Schimbați un prag și puneți-l la loc {#admin-example-threshold}

Vreți ca actele să apară „expiră curând” mai devreme, pentru o lună de verificări.

1. Deschideți „Setări”, partea „Praguri de timp” (secțiunea [[admin-settings-thresholds]]).
2. Notați valoarea de acum de la „Fereastră filtru expiră curând”.
3. Scrieți valoarea nouă și citiți exemplul de sub ea; apăsați „Salvează” și așteptați „Salvat cu succes.”.
4. După lună, scrieți la loc valoarea notată și apăsați „Salvează”. Reîncărcați pagina și verificați că a rămas.
`;
