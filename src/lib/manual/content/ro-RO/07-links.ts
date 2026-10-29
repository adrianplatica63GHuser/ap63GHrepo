/**
 * Manual, ro-RO, chapter 7. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 7 Legături, versiuni și istoric {#links}

În arhivă, un obiect rareori stă singur: un contract are vânzători și cumpărători, un teren are proprietari, o persoană are rude și firme pe care le reprezintă. Capitolul acesta arată cum legați două obiecte și cum citiți legătura din ambele capete, cum le clasificați și le regăsiți după etichete, grupuri și ștampile, și cum vă întoarceți la o versiune mai veche a unui obiect.

## 7.1 Asocierea a două obiecte {#links-associate}

Legătura dintre două obiecte se numește asociere. Se face o singură dată, din orice direcție, și se vede din amândouă: dacă legați un teren de pe ecranul unui contract, contractul apare și pe ecranul terenului.

### 7.1.1 Ecranul de asociere {#links-associate-screen}

Pe fișa „Legături” a unui obiect (secțiunea [[links-related]]) stau trei butoane: „Asociază persoană”, „Asociază proprietate” și „Asociază act”, fiecare cu două pictograme — lanțul și persoana, proprietatea sau actul; „Dezasociază” are lanțul și o za ruptă. Fiecare „Asociază …” deschide un ecran de asociere, cu trei fișe una sub alta (Figura [[fig-links-associate]]):

- „Căutare” — filtrele. Pentru persoane sunt „Nume” și „Cod”; pentru proprietăți și acte este o singură casetă, „Căutare”, care caută după cod și după denumire sau titlu.
- „Rezultate” — obiectele găsite. Bifați rândul sau rândurile pe care vreți să le legați. Persoanele fizice și cele juridice stau în același tabel, iar coloana „Tip” spune care este care: „Fizică” sau „Juridică”.
- „Asociere” — „Rol” sau „Tip legătură”, acolo unde legătura are așa ceva, apoi „Asociază selecția” și „Anulează”. Fișa rămâne la vedere jos pe ecran, chiar și sub o listă lungă de rezultate.

Până nu bifați nimic, sub butoane scrie ce lipsește — de exemplu „Selectați cel puțin o persoană”. „Asociază selecția” vă întoarce pe obiectul de la care ați plecat, cu legătura nouă în „Legături”. „Anulează” vă întoarce fără să lege nimic.

![7.1 Ecranul de asociere: „Căutare”, „Rezultate” și „Asociere”](links-associate.png){#fig-links-associate}

### 7.1.2 Ce se poate lega de ce {#links-associate-kinds}

| Legătura | De unde o faceți | Ce alegeți la „Asociere” |
|---|---|---|
| Persoană – act | de pe act sau de pe persoană | rolul persoanei în act, de exemplu „Cumpărător”, „Vânzător” sau „Notar” |
| Firmă – act | de pe act sau de pe firmă | rolul firmei în act, la fel ca pentru o persoană |
| Proprietate – act | de pe act sau de pe proprietate | nimic: legătura nu are rol |
| Persoană – proprietate | de pe proprietate sau de pe persoană | rolul persoanei, de exemplu proprietar sau coproprietar |
| Firmă – proprietate | de pe proprietate sau de pe firmă | rolul firmei, din aceeași listă ca pentru o persoană |
| Persoană – firmă | de pe firmă sau de pe persoană | rolul, de exemplu „Reprezentant legal / Mandatar” |
| Persoană – persoană | de pe oricare dintre ele | legătura de familie, de exemplu „Părinte”, „Soț” sau „Frate” |
| Act – act | de pe oricare dintre ele | „Tip legătură” (secțiunea [[links-references]]) |
| Proprietate – proprietate | de pe oricare dintre ele | „Tip legătură” (secțiunea [[links-references]]) |

Cota-parte a unei persoane pe un act se scrie după asociere, pe act (secțiunea [[documents-parties]]).

### 7.1.3 Rolul {#links-associate-role}

- Rolul nu este obligatoriu: o asociere se poate face și cu „fără rol”.
- Când legați un act de o persoană pornind de pe persoană, **bifați întâi actul și abia apoi alegeți rolul**. La bifare, lista „Rol” se strânge la rolurile pe care le are tipul acelui act și revine la „fără rol”; un rol ales înainte de bifare se pierde, iar legătura s-ar salva fără rol.
- Între două persoane, rolul este al persoanei bifate față de persoana pe al cărei ecran sunteți; propoziția de lângă „Rol” o spune: „Rolul pe care persoana bifată îl are față de …”. Celălalt capăt arată rolul invers, potrivit genului persoanei: dacă pe ecranul unei fiice îl bifați pe tatăl ei ca „Părinte”, pe ecranul tatălui ea apare ca „Fiică”.
- O persoană legată de o firmă ca „Reprezentant legal / Mandatar” vede firma, pe ecranul ei, cu rolul „Reprezentat(ă) / Mandant(ă)”.
- Dacă tipul actului nu are niciun rol pregătit, ecranul spune asta în locul listei „Rol”, iar asocierea se face fără rol. Rolurile se pregătesc în „Date de referință” (secțiunea [[admin-reference-data]]).

### 7.1.4 Dezasocierea {#links-associate-remove}

Pe „Legături”, alegeți rândul cu butonul rotund din stânga lui, apoi apăsați „Dezasociază”. Legătura dispare din ambele capete, fără nicio întrebare; cele două obiecte rămân în arhivă, neatinse. Se alege un singur rând odată, de orice fel ar fi. „Dezasociază” se poate folosi doar cu un rând ales, iar cât timp un rând este ales, cele trei „Asociază …” nu se pot folosi.

## 7.2 Fișa „Legături” {#links-related}

Fiecare persoană fizică, firmă, proprietate și act are fișa „Legături”: tot ce este legat de obiect, într-un singur loc (Figura [[fig-links-related]]). Dacă nu o vedeți, bifați „Legături” în „Panouri” (secțiunea [[start-tiles]]). Când nu e legat nimic, fișa spune „Nimic corelat încă.”.

Rândurile vin mereu în aceeași ordine — persoanele fizice, persoanele juridice, proprietățile, actele —, iar fiecare fel începe cu un titlu subțire: numele lui, ca în bara laterală, și, la dreapta, câte rânduri are. Un fel fără rânduri nu are titlu. Pictograma felului stă la începutul rândului. Fiecare rând stă pe o singură linie:

- o persoană sau o firmă: numele și rolul;
- o proprietate: denumirea și, când legătura are un rol, rolul;
- un act: eticheta scurtă și tipul actului.

Rolul — la un act, tipul — stă într-o etichetă mică, la marginea dreaptă a rândului, așa că etichetele se aliniază de sus în jos, iar un nume lung se taie cu trei puncte înaintea rolului.

Numele de pe rând este un link: un clic pe el deschide obiectul legat numai pentru citire, iar „Modifică”, jos pe ecranul lui, îl face modificabil.

Pe rânduri pot sta câteva butoane, palide cât stă mouse-ul în altă parte și pline pe rândul de sub mouse:

- „Relația” arată, într-o bulă, ce leagă cele două obiecte: rolul persoanei în act (de pildă Rol: „Vânzător”) sau propoziția unei legături cu sens (secțiunea [[links-references]]). Un clic în afara bulei sau tasta Esc o închide.
- „Previzualizare” o deschide alături, fără să plecați de pe ecran (secțiunea [[start-preview]]).
- „Cotă”, portocaliu, ține cota-parte a unei persoane pe un act (secțiunea [[documents-parties]]).

Sub rânduri stau „Asociază persoană”, „Asociază proprietate”, „Asociază act” și „Dezasociază”; pe un act, după ele, și „Înscrisuri citate” (secțiunea [[links-references]]). Pe un contract de vânzare-cumpărare, un act adițional sau un certificat de moștenitor, părțile stau în fișa „Părți”, grupate pe rol, iar „Legături” ține celelalte legături ale actului și, deasupra lor, un rând care spune câte părți sunt în „Părți” (secțiunea [[documents-parties]]).

Dacă un fel de legături nu se poate încărca, celelalte rămân la vedere, iar sub rânduri un rând roșu spune care listă nu s-a încărcat și de ce — de pildă că baza de date nu a răspuns sau că sesiunea s-a încheiat —, cu butonul „Reîncearcă”, care o cere din nou.

![7.2 Fișa „Legături” a unui obiect](links-related.png){#fig-links-related}

## 7.3 Înscrisuri citate și proprietăți incluse {#links-references}

Unele legături au un sens. Un certificat de moștenitor este titlul anterior al unui contract, nu invers; o parcelă este inclusă într-un teren mai mare, nu invers. Între două acte și între două proprietăți alegeți legătura din „Tip legătură”, iar aplicația o citește în sensul corect din ambele capete, ca pe o propoziție.

### 7.3.1 Un act legat de înscrisul pe care îl citează {#links-references-documents}

Pe un act, „Asociază act” deschide „Asociază Document”. Căutați și bifați celălalt act, alegeți legătura din „Tip legătură” — de exemplu „Titlu anterior al”, „Anexă la”, „Act adițional la” sau „Înlocuiește” — și apăsați „Asociază selecția”.

Citiți legătura ca pe o propoziție care începe cu actul pe care vă aflați: „acest document „Titlu anterior al” actul bifat”. Dacă propoziția nu spune ce scrie în acte, faceți legătura de pe celălalt act. De pe certificatul de moștenitor, „Titlu anterior al” cu contractul bifat spune exact că dreptul vânzătorului vine din certificat.

După asociere, „Relația” arată pe certificat „acest document „Titlu anterior al”” urmat de contract, iar pe contract aceeași legătură, citită din celălalt capăt: certificatul, „Titlu anterior al”, „acest document”.

Butonul „Înscrisuri citate”, pe fișa „Legături” a unui act, deschide și închide panoul „Înscrisuri citate în acest document”: înscrisurile pe care AI-ul le-a găsit pomenite în act. „Verifică înscrisurile citate” le ia pe rând și propune actele din arhivă care s-ar putea potrivi: „Leagă” face legătura, „Lasă” lasă înscrisul nelegat, iar „Creează schiță” face un act nou, fără pagini, care ține locul înscrisului. Cele mai multe înscrisuri citate de un act vechi nu sunt în arhivă, așa că „Lasă” este adesea răspunsul potrivit.

### 7.3.2 O proprietate inclusă în alta {#links-references-properties}

Pe o proprietate, „Asociază proprietate” deschide „Asociere proprietate corelată”, cu „Tip legătură”. Trei legături au sens — „Inclus în”, „Subdiviziune a” și „Acces prin” — iar celelalte („Adiacent”, „Contiguu”, „Suprapus cu”, „Alipit de”) spun același lucru din ambele capete.

Ca la acte, legătura se citește de la proprietatea pe care vă aflați. De pe parcelă, bifați terenul întreg și alegeți „Inclus în”. „Relația” arată apoi pe parcelă „această proprietate „Inclus în”” urmat de terenul întreg, iar pe terenul întreg parcela, „Inclus în”, „această proprietate”.

## 7.4 Fișele „Clasificare” și „Etichete și grupuri” {#links-classify}

Pe orice obiect stau două fișe care țin de felul în care lucrați cu el: „Clasificare” și „Etichete și grupuri”. Țineți mouse-ul pe titlul unui câmp ca să aflați la ce folosește, sau pe valoarea aleasă ca să aflați ce înseamnă.

### 7.4.1 „Clasificare” {#links-classify-classification}

| Câmpul | Valorile | Ce spune |
|---|---|---|
| Importanță | Scăzută, Medie, Ridicată | cât contează obiectul pentru dumneavoastră, fără vreo justificare |
| Relevanță | Inactiv, Istoric, Actual, De perspectivă | unde stă obiectul în timp; un act vechi poate fi istoric și totuși foarte important |
| Proveniență | de exemplu „Manual (Adaugă nou)”, „Interpretare AI”, „Fișier de coordonate (.txt)” | cum a intrat obiectul în arhivă |

Sub „Proveniență”, „Istoric” ține fiecare schimbare, cu data ei. „Salvează”, pe linia lui „Istoric”, nu se poate apăsa până nu schimbați o valoare; după salvare scrie „✓ Salvat”. Salvarea adaugă o versiune a obiectului (secțiunea [[links-versions]]).

### 7.4.2 Etichetele {#links-classify-tags}

Etichetele sunt cuvinte libere după care regăsiți obiectele — „arendă”, „litigiu”, „moștenire”. În „Etichete și grupuri”, la „Etichete / Cuvinte cheie”, scrieți eticheta în „Introduceți o etichetă…” și apăsați „Adaugă” sau Enter. Eticheta se salvează pe loc, fără „Salvează”, și se scrie cu litere mici. Ca s-o scoateți, țineți mouse-ul pe ea și apăsați „×”-ul care apare în colțul ei.

Toate obiectele cu o etichetă le găsiți în „Căutare globală”: scrieți eticheta în „Etichetă” și apăsați „Caută” (secțiunea [[reports-search]]).

„Administrare” → „Etichete” arată „Nor de etichete”: toate etichetele din arhivă, fiecare cu numărul de obiecte care o poartă, cele mai folosite mai mari. Un dublu-clic pe o etichetă o alege sau o lasă:

- cu o etichetă aleasă, „Redenumește etichetă” o face casetă chiar în nor; scrieți noul nume și apăsați Enter, sau Esc ca s-o lăsați cum era;
- cu două sau mai multe alese, „Fuzionează etichete” deschide „Fuzionare etichete”; alegeți „Păstrează aceasta” la eticheta care rămâne și apăsați „Fuzionează”.

O etichetă scoasă de pe ultimul obiect care o purta dispare din nor.

### 7.4.3 Grupurile {#links-classify-groups}

Un grup strânge, pentru o treabă de scurtă durată, obiecte de un singur fel — de exemplu terenurile pentru o evaluare. Grupul se face în „Administrare” → „Grupuri” (secțiunea [[admin-groups]]): „Adaugă”, alegeți „Țintă” și scrieți „Descriere”, apoi „Salvează”; codul, de forma GRP-001, se dă singur. „Editează” pe rândul grupului deschide ecranul lui: bifați obiecte în „Membri disponibili pentru includere”, apăsați „Adaugă în grup” și apoi „Salvează grupul”. Până la „Salvează grupul” nu se scrie nimic, iar ecranul arată „Modificări nesalvate”.

Pe un obiect, „Grupuri” din „Etichete și grupuri” arată grupurile lui. „+ Adaugă în grup” deschide lista grupurilor; „×” pe un grup îl scoate din grup. Lângă codul grupului, numărul din paranteze este câți membri are grupul acum — de exemplu „GRP-001 [2]”, cu „2 membri” când țineți mouse-ul pe el.

Un obiect poate face parte din cel mult trei grupuri. La al treilea, „+” nu se mai poate apăsa și sub listă scrie: „Un obiect poate face parte din cel mult 3 grupuri. Scoateți-l dintr-un grup pentru a-l adăuga în altul.” Membrii unui grup îi găsiți în „Căutare globală”, după „Cod grup”. Un grup șters nu ia cu el obiectele.

### 7.4.4 Ștampilele {#links-classify-stamps}

O ștampilă marchează o însușire de durată, pe obiecte de orice fel. Se face în „Administrare” → „Ștampile”, cu „Creare ștampilă”: „Descriere scurtă” și „Note”, iar codul se dă la salvare. „Aplică”, pe rândul ștampilei, deschide ecranul ei: alegeți felul obiectelor în „Tip element”, bifați-le în „Elemente disponibile pentru ștampilare”, apăsați „Aplică ștampila” și apoi „Salvează ștampilele”. Lista ștampilelor arată la fiecare câte obiecte o poartă.

Pe obiect, ștampila apare în „Etichete și grupuri”, la „Ștampile”, unde „+ Aplică ștampilă” pune alta și „×” o scoate. O ștampilă ștearsă dispare de pe toate obiectele.

## 7.5 Versiunile și „Fă curentă” {#links-versions}

Fiecare salvare a unui obiect păstrează o versiune nouă și o lasă neatinsă pe cea dinainte (secțiunea [[intro-versions]]). Versiunile se numără de la 0: un obiect abia creat arată „v 0” în dreapta-sus. „Salvează” nu se poate apăsa până nu schimbați ceva, așa că o versiune nouă apare doar când s-a schimbat ceva. După salvare rămâneți pe obiect.

Când are mai multe versiuni, în dreapta-sus stă „N versiuni”, de exemplu „2 versiuni”. Apăsat, vă duce cu o versiune înapoi și arată „Versiunea anterioară”, „Versiunea următoare” și „Fă curentă” (Figura [[fig-links-versions]]). Pe o versiune veche:

- câmpurile se pot doar citi, iar „Salvează” lipsește;
- titlul ecranului arată tot numele curent, nu pe cel din versiunea pe care o citiți;
- „Versiunea anterioară” și „Versiunea următoare” vă mută câte o versiune; așa comparați două versiuni, citind câmpurile uneia, apoi ale celeilalte.

„Fă curentă” face versiunea pe care o citiți din nou cea curentă, **copiind-o într-o versiune nouă**. Aplicația întreabă întâi „Faceți această versiune curentă?” și spune ce se va întâmpla, de exemplu: „Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?”. „OK” o face, „Anulează” renunță. Nimic nu se pierde: versiunile dintre ele rămân în istoric, iar lista arată valorile noii versiuni curente.

![7.3 Versiunile unui obiect](links-versions.png){#fig-links-versions}

## 7.6 Același obiect în două ferestre {#links-two-windows}

Același obiect poate fi deschis în două ferestre sau file ale browserului, iar una nu acoperă pe ascuns ce s-a salvat în cealaltă:

- Când salvați într-o fereastră, cealaltă se reîncarcă singură, dacă nu are nimic nesalvat.
- Dacă în cealaltă ați început să scrieți, ea nu se reîncarcă peste ce ați scris. Sub banda „Modificări nesalvate” apare, cu roșu: „Acest obiect a fost salvat în altă fereastră. Modificările de aici nu sunt salvate, iar salvarea lor va fi refuzată.”, alături de „Reîncarcă”.
- Dacă apăsați totuși „Salvează” acolo, nu se scrie nimic: „Nu s-a salvat nimic: obiectul a fost salvat între timp în altă fereastră sau de alt utilizator. Valorile introduse au rămas pe ecran.”.
- „Reîncarcă” întreabă „Reîncărcați obiectul?”: valorile nesalvate se pierd și se încarcă versiunea curentă.
- Dacă obiectul este șters într-o fereastră, cealaltă spune „Acest obiect a fost șters în altă fereastră.”.

Istoricul versiunilor ține doar salvările care au trecut. Cel mai sigur este să modificați un obiect într-o singură fereastră.

## 7.7 Exemple și cazuri de utilizare {#links-examples}

### 7.7.1 Legați proprietarul de un teren și verificați din celălalt capăt {#links-example-owner}

Un teren din Bragadiru are un proprietar care este deja în arhivă.

1. Deschideți terenul și, pe „Legături”, apăsați „Asociază persoană” (secțiunea [[links-associate]]).
2. Scrieți o parte din numele persoanei în „Nume” și bifați rândul ei în „Rezultate”.
3. Alegeți rolul de proprietar în „Rol” și apăsați „Asociază selecția”.
4. Pe „Legături”, faceți clic pe numele persoanei, pe rândul ei: pe fișa ei „Legături” apare terenul, cu rolul în paranteză (secțiunea [[links-related]]).

### 7.7.2 Arătați că vânzătorul a moștenit terenul {#links-example-title}

Un contract de vânzare-cumpărare citează certificatul de moștenitor din care vine dreptul vânzătorului, iar amândouă sunt în arhivă.

1. Deschideți certificatul de moștenitor și, pe „Legături”, apăsați „Asociază act”.
2. Căutați contractul în „Căutare” și bifați-l.
3. În „Tip legătură”, alegeți „Titlu anterior al” și apăsați „Asociază selecția” (secțiunea [[links-references]]).
4. Deschideți contractul și apăsați „Relația” pe rândul certificatului: legătura se citește certificatul, „Titlu anterior al”, „acest document”.

### 7.7.3 Strângeți câteva terenuri pentru o evaluare {#links-example-group}

1. În „Administrare” → „Grupuri”, faceți un grup cu „Țintă” „Proprietate” și o descriere, de exemplu „Evaluare primăvară” (secțiunea [[links-classify-groups]]).
2. Pe ecranul grupului, bifați terenurile, apăsați „Adaugă în grup”, apoi „Salvează grupul”.
3. În „Căutare globală”, scrieți codul grupului în „Cod grup” și apăsați „Caută”: apar toate terenurile grupului (secțiunea [[reports-search]]).
4. Când evaluarea s-a încheiat, ștergeți grupul; terenurile rămân în arhivă.

### 7.7.4 Întoarceți o persoană la o valoare de dinainte {#links-example-version}

Ați corectat prenumele unei persoane și ați salvat, apoi ați aflat că forma veche era cea bună.

1. Pe ecranul persoanei, apăsați „N versiuni”, în dreapta-sus (secțiunea [[links-versions]]).
2. Cu „Versiunea anterioară” și „Versiunea următoare”, căutați versiunea cu prenumele vechi.
3. Apăsați „Fă curentă” și apoi „OK”: versiunea aceea se copiază într-una nouă, curentă, iar cea cu prenumele corectat rămâne în istoric.
`;
