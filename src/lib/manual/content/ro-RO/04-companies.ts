/**
 * Manual, ro-RO, chapter 4. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 4 Persoane juridice {#companies}

O persoană juridică este o firmă, o instituție, un consiliu local sau o asociație — oricine apare într-un act sau într-o carte funciară fără să fie o persoană fizică. Capitolul acesta vă arată lista firmelor, cum adăugați și modificați o firmă și cum o legați de oamenii ei, de acte și de proprietăți. Ecranul unei firme se citește ca al unei persoane fizice (capitolul [[persons]]), cu fișele lui proprii.

## 4.1 Lista persoanelor juridice {#companies-list}

Lista se deschide din bara laterală: „Domeniu”, apoi „Persoane Juridice”. Ecranul se numește „Persoană juridică” și arată, ca orice listă (secțiunea [[start-lists]]), câte 15 firme pe pagină, cu coloanele „Denumire” și „Poreclă”.

Caseta de căutare din capul listei („caută după cod, nume, poreclă sau ID”) este singurul filtru al listei. Ea găsește o firmă după denumire, după poreclă și după CUI: scrieți CUI-ul și rămân firmele care îl au. Când nu se găsește nimic, lista spune „Nu există persoane juridice”.

„Câmpuri afișate” adaugă coloane listei. Pe lista firmelor puteți alege patru:

| Câmpul | Ce arată coloana |
|---|---|
| Tip | Forma firmei: SRL, SA, PFA, Instituție și celelalte. |
| Nr. înregistrare (CUI) | Codul unic de înregistrare. |
| Nr. registru comerțului | Numărul de la Registrul Comerțului. |
| Persoană de contact | Numele persoanei de contact a firmei. |

Butonul arată câte câmpuri ați ales, de exemplu „Câmpuri afișate 1/4”. Coloana CUI nu apare până nu o bifați, dar căutarea după CUI merge oricum. La „Persoană de contact” se vede prima persoană de contact a firmei; dacă primul loc e gol, se vede a doua (secțiunea [[companies-people-contact]]).

Pe fiecare rând stau „Previzualizare”, „Incursiune”, „Legături” și „Deschide”. Previzualizarea unei firme arată denumirea ei, apoi porecla. „Incursiune” arată, alături de listă, fișa „Interacțiuni” a firmei, iar „Legături” arată, tot alături, cu cine este legată firma, fără să o deschideți.

O firmă adăugată de curând apare în capul listei, marcată „Nou!”.

## 4.2 O firmă adăugată și modificată {#companies-add}

Pe lista firmelor, apăsați „Adaugă persoană juridică”. Se deschide direct formularul „Persoană juridică nouă”, fără altă întrebare. Completați ce aveți; restul se adaugă oricând, după ce firma este salvată.

Singurul câmp obligatoriu este „Denumire”. O firmă care are doar denumirea este un obiect adevărat și se completează mai târziu. Când apăsați „Salvează”, jos, aplicația vă întoarce la listă, unde firma nouă stă sus, marcată „Nou!”. O deschideți cu „Deschide”.

Ecranul unei firme deschise are în cap denumirea și versiunea („v 0” pentru o firmă abia creată), iar dedesubt fișele ei (Figura [[fig-companies-record]]):

| Fișa | Ce cuprinde | Se vede de la început |
|---|---|---|
| Date de înregistrare | Denumire, CUI, Registrul Comerțului | da |
| Reprezentanți și contact | Telefonul și e-mailul firmei, persoanele de contact | da |
| Adrese | Sediul social și adresa de corespondență | da |
| Legături | Persoanele, proprietățile și actele legate de firmă | nu |
| Clasificare | Importanță, relevanță, proveniență | nu |
| Etichete și grupuri | Etichete, grupuri, ștampile, „vezi și” | nu |
| Interacțiuni | Istoricul interacțiunilor cu această firmă | da |

Fișele se aleg cu bife, ca pe orice obiect (secțiunea [[start-tiles]]). Alegerea făcută pe o firmă este a firmelor: nu schimbă fișele pe care le vedeți la persoanele fizice. Spre deosebire de o proprietate, firma nu are o fișă „Persoane”: oamenii firmei se văd în „Reprezentanți și contact” și în „Legături” (secțiunea [[companies-people]]).

![4.1 Ecranul unei persoane juridice](companies-record.png){#fig-companies-record}

### 4.2.1 Fișa „Date de înregistrare” {#companies-add-identity}

Prima fișă ține datele firmei:

- „Denumire” — numele firmei, singurul câmp obligatoriu.
- „Poreclă” — un nume scurt, al vostru, după care o găsiți mai ușor.
- „Tip” — forma firmei: „Consiliu Local”, „Instituție”, „SRL”, „SA”, „SRL-D”, „PFA”, „II”, „IF”, „ONG” sau „Altele”; „—” înseamnă că nu e ales.
- „Nr. înregistrare (CUI)” — codul unic de înregistrare.
- „Nr. registru comerțului” — numărul de la Registrul Comerțului.

ID-ul de sistem al firmei, care începe cu JPERS, stă în colțul din dreapta-sus al acestei fișe. Nu este un câmp și nu se scrie de mână.

Aplicația nu verifică forma CUI-ului: primește orice scrieți. Verificați-l deci pe act înainte să salvați. Odată salvat, sub CUI apare regula: „CUI-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba”. Un CUI greșit se îndreaptă, așadar, ștergând firma și creând-o din nou.

### 4.2.2 Telefonul și e-mailul firmei {#companies-add-contact}

Fișa „Reprezentanți și contact” începe cu datele firmei însăși: „Telefon firmă” și „E-mail firmă”. Ele sunt ale firmei, nu ale unei persoane de contact.

Un e-mail care nu are forma unei adrese nu se salvează: sub câmp apare „Adresa de e-mail nu pare corectă — de exemplu office@firma.ro”, iar firma rămâne neschimbată. Îndreptați adresa și apăsați din nou „Salvează”.

### 4.2.3 Adresele {#companies-add-addresses}

Fișa „Adrese” ține „Adresă sediu social” și „Adresă corespondență”. Când firma primește corespondența la sediu, bifați „Aceeași cu adresa sediului social” și nu mai scrieți adresa a doua oară.

### 4.2.4 Modificarea și istoricul {#companies-add-edit}

Pe ecranul firmei schimbați ce trebuie și apăsați „Salvează”, jos. De data aceasta ecranul rămâne pe firmă. Fiecare salvare face o versiune nouă: capul ecranului trece de la „v 0” la „v 1” și arată câte versiuni are firma, de exemplu „2 versiuni”.

Cu „Versiunea anterioară” și „Versiunea următoare” vedeți firma așa cum era la fiecare salvare. Și telefonul, și e-mailul firmei sunt păstrate în istoric: pe versiunea în care au fost scrise, câmpurile lor sunt încadrate cu verde, semnul unei valori adăugate atunci. Despre versiuni și „Fă curentă”, vedeți secțiunea [[links-versions]].

Câteva lucruri bune de știut:

- O modificare făcută într-o fișă pe care apoi o ascundeți se salvează totuși.
- Dacă o fișă ascunsă are o greșeală — de pildă „Denumire” golită —, la „Salvează” fișa reapare, ecranul coboară la câmpul cu problema, iar nimic nu se salvează.
- Cât timp aveți modificări nesalvate, sus scrie „Modificări nesalvate”.

### 4.2.5 Ștergerea unei firme {#companies-add-delete}

Apăsați „Șterge”, jos pe ecranul firmei, și răspundeți „Da” la întrebarea „Ștergeți persoana juridică?”. Ștergerea nu se poate anula.

O firmă deschisă dintr-un alt obiect — de pe un act sau de pe o proprietate — nu se șterge de acolo. Aplicația vă spune să o dezasociați întâi de obiectul din care ați deschis-o, apoi să o deschideți din bara laterală și să o ștergeți de acolo.

## 4.3 Persoanele unei firme {#companies-people}

O firmă are oameni în două feluri. Persoanele de contact sunt oamenii cu care țineți legătura; ele stau în fișa „Reprezentanți și contact”. Reprezentanții — administratorul, un mandatar — sunt legați de firmă cu un rol, în fișa „Legături”, și se văd de la ambele capete.

### 4.3.1 Persoanele de contact {#companies-people-contact}

În fișa „Reprezentanți și contact”, sub telefonul și e-mailul firmei, stau „Persoană de contact 1” și „Persoană de contact 2”. O persoană de contact nu se scrie de mână: se alege dintre persoanele fizice care sunt deja în arhivă. Ecranul vă amintește: „Dacă persoana nu este în sistem, trebuie introdusă mai întâi prin funcționalitatea Persoană Fizică.” Așadar, adăugați întâi persoana în „Persoane Fizice” (capitolul [[persons]]), apoi alegeți-o aici.

Persoana de contact se vede și în lista firmelor, în coloana „Persoană de contact” (secțiunea [[companies-list]]).

### 4.3.2 Reprezentanții, citiți din ambele capete {#companies-people-representatives}

Un reprezentant se leagă din ecranul firmei:

1. Bifați fișa „Legături”. O firmă fără legături arată „Nimic corelat încă.”, cu butoanele „Asociază persoană”, „Asociază proprietate”, „Asociază act” și „Dezasociază”.
2. Apăsați „Asociază persoană”. Se deschide „Asociere persoană corelată”, cu numele firmei sub titlu.
3. Căutați persoana după „Nume” și bifați rândul ei.
4. La „Rol”, alegeți „Reprezentant legal / Mandatar”. Lângă el scrie că rolul este cel pe care persoana bifată îl are față de firmă.
5. Apăsați „Asociază selecția”.

Înapoi pe firmă, „Legături” arată persoana pe un rând, cu rolul ei între paranteze: „Nume Prenume (Reprezentant legal / Mandatar)”.

Aceeași legătură se citește și de la celălalt capăt. Pe ecranul persoanei, în fișa ei „Legături”, firma apare cu rolul întors: „Denumirea firmei (Reprezentat(ă) / Mandant(ă))” — persoana o reprezintă pe firmă, deci firma este cea reprezentată. „Vizualizare”, pe fiecare rând, deschide celălalt capăt, doar pentru citit.

O legătură greșită se scoate selectând rândul ei în „Legături” și apăsând „Dezasociază”. Fișa „Legături” este descrisă pe larg în secțiunea [[links-related]].

### 4.3.3 Firma într-un act și pe o proprietate {#companies-people-records}

O firmă poate fi parte într-un act sau proprietar al unui teren, la fel ca o persoană fizică. Legătura se face din ecranul firmei, tot din „Legături”, sau de la celălalt capăt.

- „Asociază act” deschide „Asociere act”. Bifați actul, apoi alegeți „Rol”: după ce ați bifat actul, lista rolurilor se strânge la cele pe care tipul acela de act le are. La un „Contract de Vânzare”, de pildă: „Cumpărător”, „Moștenitor”, „Notar”, „Reprezentant legal / Mandatar”, „Vânzător”. Pe act, firma apare apoi în fișa „Părți”, cu rolul ei. Despre părți, roluri și cota-parte, vedeți secțiunile [[documents-parties]] și [[documents-sale]].
- „Asociază proprietate” deschide „Asociere proprietate”. Bifați proprietatea și alegeți „Rol”: „Coproprietar”, „Cumpărător”, „Proprietar” sau „Titular de drept”. Pe proprietate, firma apare în „Legături”, de exemplu „Denumirea firmei (Proprietar)”.

De pe act sau de pe proprietate, „Vizualizare” pe rândul firmei deschide ecranul firmei — nu al unei persoane fizice —, doar pentru citit, cu „Înapoi la listă” și „Modifică” jos. Asocierea în general este în capitolul [[links]].

### 4.3.4 Interacțiunile firmei {#companies-people-interactions}

Fișa „Interacțiuni” stă în dreapta ecranului, separată de celelalte fișe, și este bifată de la început. Ea arată istoricul interacțiunilor cu firma. Debifată, fișa dispare; bifată din nou, revine. Cum se înregistrează o interacțiune, vedeți secțiunea [[persons-interactions]]; toate interacțiunile, la un loc, sunt în raportul „Interacțiuni” (secțiunea [[reports-interactions]]).

## 4.4 Exemple și cazuri de utilizare {#companies-examples}

### 4.4.1 Adăugați o firmă nouă, cu persoana ei de contact {#companies-example-new}

Situația: o firmă vă trimite o ofertă pentru un teren, iar omul cu care vorbiți nu este încă în arhivă.

1. Adăugați întâi omul în „Persoane Fizice” (capitolul [[persons]]).
2. Pe „Persoane Juridice”, apăsați „Adaugă persoană juridică”, scrieți „Denumire”, alegeți „Tip” și scrieți CUI-ul, verificat pe act (secțiunea [[companies-add-identity]]).
3. Apăsați „Salvează”; deschideți firma din capul listei, unde e marcată „Nou!”.
4. În „Reprezentanți și contact”, scrieți „Telefon firmă” și „E-mail firmă” și alegeți omul la „Persoană de contact 1” (secțiunile [[companies-add-contact]] și [[companies-people-contact]]).
5. Apăsați „Salvează”.

### 4.4.2 Găsiți o firmă după CUI {#companies-example-cui}

Situația: pe un act scrie doar CUI-ul unei firme.

1. Deschideți „Persoane Juridice”.
2. Scrieți CUI-ul în caseta de căutare (secțiunea [[companies-list]]).
3. Ca să vedeți CUI-ul și în tabel, bifați „Nr. înregistrare (CUI)” în „Câmpuri afișate”.
4. Apăsați „Deschide” pe rândul firmei.

### 4.4.3 Notați administratorul unei firme {#companies-example-representative}

Situația: o persoană semnează în numele unei firme și vreți ca legătura să se vadă din ambele părți.

1. Deschideți firma și bifați fișa „Legături”.
2. Apăsați „Asociază persoană”, căutați persoana, bifați-o și alegeți „Reprezentant legal / Mandatar” (secțiunea [[companies-people-representatives]]).
3. Apăsați „Asociază selecția”.
4. Apăsați „Vizualizare” pe rândul persoanei: în fișa ei „Legături”, firma apare ca „Reprezentat(ă) / Mandant(ă)”.

### 4.4.4 Treceți o firmă ca proprietar al unui teren din Bragadiru {#companies-example-owner}

Situația: o firmă a cumpărat un teren din Bragadiru printr-un contract de vânzare-cumpărare.

1. Deschideți firma și bifați fișa „Legături”.
2. Apăsați „Asociază proprietate”, căutați terenul, bifați-l și alegeți „Rol” „Proprietar” (secțiunea [[companies-people-records]]).
3. Apăsați „Asociază selecția”.
4. Apăsați „Asociază act”, bifați contractul și alegeți „Cumpărător”; apoi „Asociază selecția”.
5. Pe teren, în „Legături”, și pe contract, în „Părți”, firma apare acum cu rolul ei (capitolele [[documents]] și [[links]]).
`;
