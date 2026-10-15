/**
 * Manual, ro-RO, chapter 8. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 8 Harta proprietăților {#map}

Harta proprietăților arată, pe un singur ecran, toate terenurile din arhivă care au colțuri. Pe ea vedeți unde stau proprietățile una față de alta, deschideți una cu un dublu-clic, măsurați o distanță sau un unghi, aflați suprafața unei zone și găsiți proprietățile trecute de două ori. Pe harta aceasta nu se desenează și nu se mută colțuri: forma unei parcele se schimbă pe ecranul ei, în fișa „Hartă” (secțiunea [[properties-corners]]).

Câteva gesturi ale hărții nu se văd pe nicio etichetă: tragerea unui dreptunghi, dublu-clicul, apăsarea unui colț. Becul mic de lângă locul lor le explică pe scurt (secțiunea [[start-help]]); capitolul acesta le explică pe larg.

## 8.1 Ce arată harta {#map-what}

Ecranul se numește „Toate Proprietățile”. Harta se deschide potrivită astfel încât să încapă toate proprietățile pe care le desenează. Fiecare proprietate cu colțuri apare ca o formă albastră, cu laturile unite în ordinea colțurilor ei. O proprietate fără colțuri nu are contur, deci nu apare pe hartă; colțurile i se pot adăuga oricând, în „Puncte de contur” (secțiunea [[properties-corners-table]]).

Sus, pe hartă, stau butoanele ei. „HARTĂ” și „SATELIT” aleg harta străzilor sau imaginea din satelit, ca pe fișa „Hartă” a unei proprietăți. Celelalte butoane sunt uneltele hărții, explicate mai jos:

- „Selectează” — alege mai multe proprietăți deodată (secțiunea [[map-select]]);
- „Riglă” și „Unghiuri” — măsoară o distanță și un unghi (secțiunea [[map-ruler]]);
- „Suprafața unei zone delimitate” și „Suprafața unei zone oarecare” — calculează suprafața unei zone (secțiunea [[map-area]]);
- „Grupuri” — alege ce proprietăți se văd (secțiunea [[map-what-groups]]).

### 8.1.1 Deschiderea hărții {#map-what-open}

Harta se deschide din două locuri:

- din lista „Proprietăți”, cu butonul „Hartă completă”, din dreapta, de lângă „Adaugă proprietate” (secțiunea [[properties-list]]). Bara de navigare arată atunci „Acasă › Proprietăți › Hartă completă”, iar un clic pe „Proprietăți” vă întoarce la listă. În bara laterală rămâne aprins „Proprietăți”;
- din bara laterală, „Instrumente” → „Calcul suprafață”. Se deschide aceeași hartă, dar cele două butoane de suprafață pulsează împreună, de trei ori, într-un inel violet, ca să le găsiți ușor. Niciunul nu se apasă singur: alegeți-l pe cel de care aveți nevoie (secțiunea [[map-area]]). În bara laterală rămâne aprins „Calcul suprafață”.

### 8.1.2 Bula unei proprietăți și dublu-clicul {#map-what-bubble}

Un clic în interiorul unei proprietăți deschide deasupra ei o bulă, cu numele proprietății și butoanele:

- „Deschide” — vă duce pe ecranul proprietății;
- „Navighează” — traseul până la teren, în Google Maps și ca cod QR pentru telefon (secțiunea [[properties-navigate]]).

Un clic pe hartă, în afara oricărei proprietăți, închide bula.

Mai repede, un **dublu-clic** pe o proprietate o deschide direct, fără bulă.

### 8.1.3 Proprietățile duplicate {#map-what-duplicates}

O proprietate care **clipește în roz** este o proprietate duplicată: aceeași bucată de teren este trecută de două ori în arhivă. Deschideți-le pe amândouă, comparați-le și păstrați-o pe cea bună (secțiunea [[map-example-duplicate]]).

La salvare, arhiva refuză de la început o a doua proprietate cu aceeași tarla și aceeași parcelă (secțiunea [[properties-add-one-parcel]]). Clipirea de pe hartă vă arată dublurile ajunse totuși în arhivă.

### 8.1.4 Filtrul „Grupuri” {#map-what-groups}

„Grupuri” deschide o listă cu bife: „Toate (în grup sau nu)”, „Fără grup” și grupurile de proprietăți ale arhivei. Cu ele alegeți ce proprietăți desenează harta — de exemplu doar terenurile unui grup făcut pentru o evaluare (secțiunea [[links-classify-groups]]). Când arhiva nu are niciun grup cu descriere, lista spune „Niciun grup denumit”.

## 8.2 Selecția {#map-select}

Selecția alege mai multe proprietăți deodată, ca să le vedeți separat sau să le ștergeți.

1. Apăsați „Selectează”. Harta intră în modul de selecție: de acum, o tragere cu mouse-ul nu mai mută harta, ci desenează un dreptunghi.
2. Trageți un dreptunghi peste proprietățile pe care le vreți. Ele devin selectate.
3. „Afișează selectate” deschide, lângă „Toate Proprietățile”, fila „Proprietăți Selectate”, cu doar proprietățile selectate.
4. „Anulează selecția” vă scoate din modul de selecție, iar harta se mișcă din nou la tragere.

Butonul „Șterge selecția” arată în paranteză câte proprietăți sunt selectate. **El șterge proprietățile din arhivă, nu doar selecția.** Înainte, aplicația întreabă: „Această acțiune va șterge … proprietăți selectate. Acțiunea nu poate fi anulată.” Citiți numărul, apoi alegeți „Șterge” sau „Anulează”. Dacă ștergerea nu reușește, apare „Proprietățile selectate nu au putut fi șterse. Încercați din nou.”

Pentru o singură proprietate, ștergerea de pe ecranul ei este mai sigură: acolo vedeți ce ștergeți (secțiunea [[properties-add-edit]]).

## 8.3 Rigla și unghiurile {#map-ruler}

Rigla și unghiurile doar măsoară: nu schimbă nimic, iar ce măsurați nu se salvează.

### 8.3.1 „Riglă” {#map-ruler-distance}

„Riglă” măsoară distanța în linie dreaptă dintre două puncte.

1. Apăsați „Riglă”.
2. Apăsați pe hartă în primul punct.
3. Apăsați în al doilea punct. Pe hartă apare distanța dintre ele.

Când apăsați aproape de colțul unei proprietăți, capătul riglei se fixează pe colț. Așa, o măsurătoare de la un colț la altul este exactă, nu cât de sigură v-a fost mâna.

### 8.3.2 „Unghiuri” {#map-ruler-angles}

„Unghiuri” arată unghiul unui colț.

1. Apăsați „Unghiuri”.
2. Apăsați un colț al unei proprietăți. Pe hartă apare unghiul lui.

Acolo unde se întâlnesc mai multe proprietăți într-un singur colț, apar unghiurile fiecăreia. Pe ecranul unei proprietăți, „Arată Unghiuri” arată unghiurile tuturor colțurilor ei deodată (secțiunea [[properties-corners-map]]).

## 8.4 Suprafața unei zone {#map-area}

Două butoane calculează suprafața unei zone de pe hartă: „Suprafața unei zone delimitate”, desenat ca un dreptunghi cu un punct în fiecare colț, și „Suprafața unei zone oarecare”, un dreptunghi cu linie punctată. Zona apare ca un poligon violet deschis, cu suprafața scrisă în el: „… m² (… ha)”. Suprafața se calculează la fel ca suprafața unei parcele, din coordonatele Stereo 70.

Cele două butoane se poartă la fel:

- o apăsare pornește unealta, iar butonul rămâne apăsat;
- se folosește doar unul odată: când îl apăsați pe al doilea, primul se eliberează;
- cât timp unul este apăsat, restul hărții nu răspunde, iar „Riglă” și „Grupuri” sunt inactive. Dacă harta vă spune „Eliberați întâi butonul suprafeței.”, apăsați din nou butonul de suprafață;
- apăsat a doua oară, butonul se eliberează, iar poligonul, colțurile lui și suprafața dispar.

Nimic nu se scrie în arhivă: zona este doar o măsurătoare.

### 8.4.1 „Suprafața unei zone delimitate” {#map-area-delimited}

Aici zona este mărginită de colțuri care există deja, ale proprietăților de pe hartă.

1. Apăsați „Suprafața unei zone delimitate”. Apare îndemnul: „Alegeți colțuri de proprietăți, unul după altul; Backspace îl scoate pe ultimul.”
2. Apăsați colțurile unul după altul, în ordinea în care urmează pe marginea zonei. Fiecare colț ales primește un punct, iar poligonul violet trece prin ele.
3. Citiți suprafața din poligon.

Un clic pe hartă departe de orice colț nu schimbă nimic. Tasta Backspace scoate ultimul colț ales. Dacă alegeți colțurile sărind de pe o latură pe alta, laturile se încrucișează și aplicația vă spune: „Laturile se încrucișează — alegeți colțurile în ordine.”

Dacă alegeți toate colțurile unei singure proprietăți, în ordinea lor, suprafața din poligon este chiar suprafața ei calculată. Cu colțurile de pe marginea a două terenuri vecine, aflați suprafața lor împreună.

### 8.4.2 „Suprafața unei zone oarecare” {#map-area-free}

Aici desenați zona liber, oriunde pe hartă, ca la colțurile unei proprietăți (secțiunea [[properties-corners-draw]]).

1. Apăsați „Suprafața unei zone oarecare”. Apare „Gata”.
2. Apăsați pe hartă pentru fiecare colț al zonei. O linie urmează mouse-ul, iar suprafața din poligon se schimbă pe măsură ce îl mișcați, ca și cum mouse-ul ar fi colțul următor.
3. Ca să închideți poligonul, apăsați din nou pe primul colț sau apăsați „Gata”.
4. După închidere, un colț se poate trage cu mouse-ul; poligonul și suprafața îl urmează.

### 8.4.3 Din „Instrumente” {#map-area-tools}

Același calcul îl găsiți în bara laterală, la „Instrumente” → „Calcul suprafață”: deschide harta cu cele două butoane arătate (secțiunea [[map-what-open]]). Instrumentul este descris, împreună cu celelalte, în secțiunea [[tools-area]].

## 8.5 Street View {#map-street-view}

Pe harta proprietăților, Street View se deschide cu omulețul lui Google: trageți-l pe o stradă, iar harta arată imaginea străzii din locul acela.

Google taxează fiecare imagine Street View deschisă, așa că trageți omulețul doar când aveți nevoie de imagine. Pentru o singură proprietate, fișa ei „Street View” arată imaginea de lângă parcelă (secțiunea [[properties-corners-street-view]]).

## 8.6 Exemple și cazuri de utilizare {#map-examples}

### 8.6.1 Aflați suprafața a două terenuri vecine din Bragadiru {#map-example-area}

Vreți să știți cât au împreună două terenuri alăturate, înainte de o ofertă.

1. În „Proprietăți”, apăsați „Hartă completă” și găsiți cele două terenuri (secțiunea [[map-what-open]]).
2. Apăsați „Suprafața unei zone delimitate”.
3. Apăsați, în ordine, colțurile de pe marginea din afară a celor două terenuri, ocolindu-le împreună (secțiunea [[map-area-delimited]]).
4. Citiți suprafața din poligonul violet. Un colț ales greșit îl scoateți cu Backspace.
5. Apăsați din nou butonul: poligonul dispare, iar în arhivă nu s-a scris nimic.

### 8.6.2 Măsurați cât de departe este un teren de drum {#map-example-ruler}

1. Deschideți harta proprietăților și apăsați „SATELIT”, ca să vedeți drumul.
2. Apăsați „Riglă” (secțiunea [[map-ruler-distance]]).
3. Apăsați colțul terenului cel mai apropiat de drum: rigla se fixează pe el.
4. Apăsați pe marginea drumului și citiți distanța.

### 8.6.3 Găsiți o proprietate trecută de două ori {#map-example-duplicate}

Pe hartă, un teren clipește în roz (secțiunea [[map-what-duplicates]]).

1. Faceți dublu-clic pe teren, ca să-l deschideți, și uitați-vă la codul lui și la ce are în „Legături” (secțiunea [[map-what-bubble]]).
2. Întoarceți-vă la hartă cu „Înapoi” (secțiunea [[start-breadcrumb]]) și deschideți-o și pe cealaltă înregistrare a aceluiași teren.
3. Hotărâți care este cea bună și legați de ea ce îi lipsește (capitolul [[links]]).
4. Ștergeți-o pe cealaltă de pe ecranul ei (secțiunea [[properties-add-edit]]).

### 8.6.4 Vedeți doar terenurile unui grup {#map-example-group}

Ați strâns într-un grup terenurile pentru o evaluare (secțiunea [[links-example-group]]) și vreți să le vedeți pe hartă.

1. Deschideți harta proprietăților și apăsați „Grupuri” (secțiunea [[map-what-groups]]).
2. Lăsați bifat doar grupul evaluării.
3. Pe hartă rămân terenurile grupului. Un clic pe unul deschide bula, iar „Deschide” vă duce la ecranul lui.
`;
