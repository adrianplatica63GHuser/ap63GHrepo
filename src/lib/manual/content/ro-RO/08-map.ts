/**
 * Manual, ro-RO, chapter 8. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 8 Harta proprietăților {#map}

Harta proprietăților arată, pe un singur ecran, toate terenurile din arhivă care au colțuri. Pe ea vedeți unde stau proprietățile una față de alta, deschideți una cu un dublu-clic, măsurați o distanță sau un unghi, aflați suprafața unei zone și găsiți proprietățile trecute de două ori. Pe harta aceasta nu se desenează și nu se mută colțuri: forma unei parcele se schimbă pe ecranul ei, în fișa „Hartă” (secțiunea [[properties-corners]]).

Câteva gesturi ale hărții nu se văd pe nicio etichetă: dublu-clicul, apăsarea unui colț. Becul mic de lângă locul lor le explică pe scurt (secțiunea [[start-help]]); capitolul acesta le explică pe larg.

## 8.1 Ce arată harta {#map-what}

Ecranul se numește „Toate Proprietățile”. Harta se deschide potrivită astfel încât să încapă toate proprietățile pe care le desenează. Fiecare proprietate cu colțuri apare ca o formă albastră, cu laturile unite în ordinea colțurilor ei, iar colțurile ei sunt puncte mici de aceeași culoare. Când micșorați harta și o formă devine prea mică pentru a se citi, în locul ei apare o picătură (secțiunea [[map-what-drops]]). O proprietate fără colțuri nu are contur, deci nu apare pe hartă; colțurile i se pot adăuga oricând, în „Puncte de contur” (secțiunea [[properties-corners-table]]).

Sus, pe hartă, stau butoanele ei. „HARTĂ” și „SATELIT” aleg harta străzilor sau imaginea din satelit, ca pe fișa „Hartă” a unei proprietăți. Celelalte butoane sunt uneltele hărții, în trei grupuri despărțite de un spațiu de două ori mai mare decât cel dintre butoane:

- cele care măsoară: „Unghiuri” și „Riglă” — un unghi și o distanță, dreaptă sau în zigzag (secțiunea [[map-ruler]]); „Suprafața unei zone delimitate” și „Suprafața unei zone oarecare” — suprafața unei zone (secțiunea [[map-area]]);
- cele care grupează proprietățile: „Tarlale” — conturul fiecărei tarlale (secțiunea [[map-what-tarlale]]); „Grupuri” — alege ce proprietăți se văd (secțiunea [[map-what-groups]]); „Selectează” — alege proprietăți, ca să le puneți într-un grup (secțiunea [[map-select]]);
- „Setări hartă” — distanța la care picăturile se unesc (secțiunea [[map-what-drops]]).

### 8.1.1 Deschiderea hărții {#map-what-open}

Harta se deschide din două locuri:

- din lista „Proprietăți”, cu butonul „Hartă completă”, din dreapta, de lângă „Nouă” (secțiunea [[properties-list]]). Bara de navigare arată atunci „Acasă › Proprietăți › Hartă completă”, iar un clic pe „Proprietăți” vă întoarce la listă. În bara laterală rămâne aprins „Proprietăți”;
- din bara laterală, „Instrumente” → „Măsurători pe hartă” sau „Grupări de proprietăți”. Fiecare deschide o casetă cu butoanele despre care e vorba, desenate ca pe hartă, și ce face fiecare. „OK” deschide aceeași hartă, cu butoanele acelea pulsând împreună, de trei ori, într-un inel violet, ca să le găsiți ușor: „Unghiuri”, „Riglă” și cele două butoane de suprafață, respectiv „Tarlale”, „Grupuri” și „Selectează”. Niciunul nu se apasă singur: alegeți-l pe cel de care aveți nevoie (secțiunea [[tools-area]]).

Al treilea ghid din „Instrumente”, „Navigare”, arată butonul „Navighează” și spune unde îl găsiți: pe ecranul proprietății și în bula unei proprietăți de pe hartă (secțiunea [[map-what-bubble]]). „OK” doar închide caseta.

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

### 8.1.5 Picăturile și picăturile cu număr {#map-what-drops}

Cât timp o proprietate este destul de mare pe ecran, harta îi desenează forma. Când micșorați harta și latura cea mai lungă a formei ajunge sub 24 de pixeli, în locul ei apare o **picătură** albastră, cu vârful în mijlocul proprietății. Fiecare proprietate se schimbă după mărimea ei: un câmp mare rămâne formă mult timp după ce un lot mic de lângă el a devenit picătură. Picătura are aceeași mărime oricât ați micșora harta.

Picăturile ajunse prea aproape una de alta se unesc într-o **picătură cu număr**, mai mare, cu numărul proprietăților pe care le acoperă scris cu alb. Când se unesc și picături cu număr, numerele lor se adună. Când măriți harta, totul se desface în ordine inversă: picăturile cu număr se despart, iar picăturile redevin forme.

- Un clic pe o picătură deschide aceeași bulă ca un clic pe forma proprietății, cu „Deschide” și „Navighează” (secțiunea [[map-what-bubble]]).
- Un clic pe o picătură cu număr mărește harta cât să încapă proprietățile ei. Dacă harta nu se mai poate mări, se deschide bula cu lista lor.

Culorile spun ce spun și la forme: roșu, o proprietate selectată (secțiunea [[map-select]]); roz intermitent, o proprietate duplicată (secțiunea [[map-what-duplicates]]). Două proprietăți duplicate au aceleași colțuri, așa că, de departe, ajung mereu în aceeași picătură cu număr, care clipește în roz. O picătură cu număr este roșie dacă are în ea o proprietate selectată.

„Setări hartă”, din bara hărții, alege distanța sub care picăturile se unesc: „Picăturile se unesc sub” între 20 și 80 de pixeli, implicit 40. O distanță mai mică arată mai multe picături, una mai mare mai puține. Alegerea se păstrează în browserul în care ați făcut-o; alt calculator sau alt browser pornește de la 40.

### 8.1.6 Stratul „Tarlale” {#map-what-tarlale}

„Tarlale” desenează conturul fiecărei tarlale: o linie verde-cenușie întreruptă, fără umplere, ca să nu se confunde cu o proprietate. Stratul este oprit când se deschide harta; butonul apăsat îl pornește, apăsat din nou îl oprește.

Conturul unei tarlale sunt colțurile ei, dacă au fost introduse pe pagina tarlalei (secțiunea [[properties-tarla]]). Altfel este forma din jurul tuturor proprietăților tarlalei care au colțuri — cea mai mică formă fără adâncituri care le cuprinde pe toate. Crește pe măsură ce arhiva crește și nu este o limită oficială: nicio sursă publică nu dă limitele tarlalelor. O tarla fără colțuri și fără proprietăți cu colțuri nu are contur.

Codul tarlalei apare pe contur când apropiați harta la câțiva kilometri. Un clic pe contur sau pe cod deschide pagina tarlalei.

## 8.2 Selecția {#map-select}

Selecția alege mai multe proprietăți, una câte una, ca să le puneți într-un grup. Nu șterge nimic: o proprietate se șterge doar de pe ecranul ei (secțiunea [[properties-add-edit]]).

1. Apăsați „Selectează”. Jos apare o bară cu numărul proprietăților selectate, „Afișează selecția”, „Adaugă la grup…” și „Anulează”. Harta se mișcă și se mărește ca de obicei.
2. Faceți clic pe fiecare proprietate pe care o vreți — pe forma ei sau pe picătura ei. Ea devine roșie. Un al doilea clic o scoate din selecție.
3. „Afișează selecția” deschide, lângă „Toate Proprietățile”, fila „Proprietăți Selectate”, cu doar proprietățile selectate.
4. „Adaugă la grup…” arată grupurile de proprietăți. Alegeți unul și apăsați „Adaugă”. Un mesaj scurt spune câte proprietăți au intrat în grup și codul lui. O proprietate care era deja în grup rămâne cum era.
5. Pentru un grup nou, apăsați „Grup nou…”: se deschide „Grupuri”, cu formularul de grup nou deschis. Salvați grupul, apoi apăsați „Înapoi la hartă” sau butonul Înapoi al browserului. Harta vă așteaptă cu aceeași selecție, iar grupul nou este ales în listă.
6. „Anulează” (sau „Anulează selecția”, din bara hărții) golește selecția și iese din modul de selecție.

Selecția se păstrează în fila browserului până o adăugați la un grup sau o anulați. Un cont fără acces complet vede „Adaugă la grup…” inactiv.

## 8.3 Rigla și unghiurile {#map-ruler}

Rigla și unghiurile doar măsoară: nu schimbă nimic, iar ce măsurați nu se salvează.

### 8.3.1 „Riglă” {#map-ruler-distance}

„Riglă” măsoară un drum în linie frântă — un zigzag — din punct în punct: câte un punct la fiecare clic, cu lungimea fiecărei laturi și totalul.

1. Apăsați „Riglă”.
2. Apăsați pe hartă în primul punct, apoi, pe rând, în fiecare punct al drumului. Cât mutați mouse-ul, lângă el se vede latura care se trage și totalul de până acum, de exemplu „+ 120.40 m · total 340.15 m”.
3. Apăsați încă o dată ultimul punct ca să terminați. Fiecare latură își arată lungimea din total, de exemplu „120.40 m din 340.15 m”.
4. Apăsați din nou „Riglă” ca să ștergeți măsurătoarea.

Pentru distanța dintre două puncte, apăsați primul punct, apoi de două ori al doilea. Cât timp rigla este apăsată, un dublu-clic pe hartă nu o mai mărește.

Când apăsați aproape de colțul unei proprietăți, punctul riglei se fixează pe colț. Așa, o măsurătoare de la un colț la altul este exactă, nu cât de sigură v-a fost mâna.

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

Butoanele de măsurat le arată și bara laterală, la „Instrumente” → „Măsurători pe hartă”: după „OK”, harta se deschide cu ele pulsând (secțiunea [[map-what-open]]). Instrumentul este descris, împreună cu celelalte, în secțiunea [[tools-area]].

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
4. Apăsați pe marginea drumului, apoi încă o dată în același punct, ca să terminați, și citiți distanța.

### 8.6.3 Găsiți o proprietate trecută de două ori {#map-example-duplicate}

Pe hartă, un teren clipește în roz (secțiunea [[map-what-duplicates]]).

1. Faceți dublu-clic pe teren, ca să-l deschideți, și uitați-vă la codul lui și la ce are în „Legături” (secțiunea [[map-what-bubble]]).
2. Întoarceți-vă la hartă cu „Înapoi” (secțiunea [[start-breadcrumb]]) și deschideți-l și pe celălalt obiect al aceluiași teren.
3. Hotărâți care este cel bun și legați de el ce îi lipsește (capitolul [[links]]).
4. Ștergeți-l pe celălalt de pe ecranul lui (secțiunea [[properties-add-edit]]).

### 8.6.4 Vedeți doar terenurile unui grup {#map-example-group}

Ați strâns într-un grup terenurile pentru o evaluare (secțiunea [[links-example-group]]) și vreți să le vedeți pe hartă.

1. Deschideți harta proprietăților și apăsați „Grupuri” (secțiunea [[map-what-groups]]).
2. Lăsați bifat doar grupul evaluării.
3. Pe hartă rămân terenurile grupului. Un clic pe unul deschide bula, iar „Deschide” vă duce la ecranul lui.
`;
