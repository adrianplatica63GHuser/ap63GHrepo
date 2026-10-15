/**
 * Manual, ro-RO, chapter 6. (Slice #39.38)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 6 Acte {#documents}

Un act este un înscris din arhivă — un contract, un certificat, o autorizație, un plan — de un anumit tip, cu paginile lui scanate atașate. Capitolul acesta vă arată lista actelor, cum adăugați un act și paginile lui, ce înseamnă tipul actului și formularul lui, cum legați persoanele și proprietățile de act și cum arată trei acte cu un ecran al lor: contractul de vânzare-cumpărare, actul adițional și certificatul de moștenitor.

## 6.1 Lista actelor {#documents-list}

În bara laterală, deschideți „Domeniu”, apoi „Acte”. Lista arată toate actele arhivei, în coloanele „Tip” și „Titlu”. Titlul este „Etichetă scurtă” a actului. Un act abia adăugat apare sus, cu semnul „Nou!”. Listele se folosesc la fel peste tot (secțiunea [[start-lists]]).

Bara de deasupra tabelului are două rânduri:

- pe primul, caseta de căutare („caută după cod, titlu sau nr. document”), „Câmpuri afișate” și, la capăt, „Adaugă act”;
- pe al doilea, „Tip document:”, un semn rotund și „Câmp specific:”, cu un ⓘ lângă el.

**„Tip” arată denumirea scurtă a tipului** — de exemplu „CVC” pentru „Contract de Vânzare”, „Intabulare” pentru „Încheiere de Intabulare”. Țineți mouse-ul pe celulă și bula arată denumirea întreagă. Denumirea scurtă se alege pentru fiecare tip în „Date de referință”, la „Tipuri de Document”, în câmpul „Denumire scurtă” (secțiunea [[admin-reference-data]]). Lăsată goală, lista scurtează singură denumirea, fără începutul „Contract de”, „Act de”, „Încheiere de”, „Certificat de”. Două tipuri nu pot avea aceeași denumire scurtă.

**„Câmpuri afișate”** adaugă cel mult patru coloane: „Nr. document”, „Data”, „Instituție / Notariat”, „Subiect”, „Nr. pagini”, „Persoane”, „Proprietăți”, „Adăugat la”.

**„Tip document:”** deschide o listă de bife, câte una pentru fiecare tip. Butonul spune ce ați ales: „Toate tipurile”, numele tipului când este bifat unul singur, „2 tipuri afișate” când sunt mai multe, „Niciun tip” când nu e bifat niciunul — atunci lista cere „Selectați cel puțin un tip de document”. Tipurile sunt multe, așa că sub „Toate tipurile” stă o casetă de căutare: scrieți o parte din nume, chiar fără diacritice („mostenitor” găsește „Certificat de Moștenitor”), și rămân doar tipurile potrivite. Căutarea doar ascunde rânduri, nu schimbă nicio bifă.

**„Câmp specific:”** filtrează după unul dintre câmpurile proprii ale unui tip — de exemplu „Stare plată” a contractului de vânzare-cumpărare. Merge numai când la „Tip document:” este bifat un singur tip, iar acel tip are formular cu câmpuri cu listă închisă de valori. Semnul dintre cele două spune dacă îl puteți folosi: verde (un cerc cu o bifă) da, roșu (un cerc cu o bară) nu; țineți mouse-ul pe el și vă spune de ce. Alegeți câmpul, apoi una dintre valorile lui — fiecare cu numărul de acte care o au, de pildă „Achitat integral” — și rămân doar actele acelea. „Toate” renunță la filtru.

## 6.2 Un act nou și paginile lui {#documents-add}

Apăsați „Adaugă act”. Se deschide „Act nou”, cu fișa „Identificarea actului”. Alegeți întâi „Tip document” (secțiunea [[documents-type]]), apoi completați câmpurile și apăsați „Salvează”. Actul se deschide pe ecranul lui, cu titlul în capul ecranului și cu starea „Neprocesat”. Fiecare salvare face o versiune nouă a actului (secțiunea [[links-versions]]).

Paginile se văd în fișa „Pagini”, mov, în dreapta formularului — pe un ecran îngust, sub el (Figura [[fig-documents-pages]]). Un act fără pagini arată „Nicio pagină adăugată”.

![6.1 Fișa „Pagini” a unui act](documents-pages.png){#fig-documents-pages}

### 6.2.1 Adăugarea paginilor {#documents-add-pages}

Pe un act salvat, „+ Adaugă pagină” deschide fereastra „Adaugă pagină”: „Număr pagină” (completat deja), „Denumire pagină”, „Note pagină” și „Încarcă”, care alege fișierul de pe calculator. „Salvează” rămâne inactiv până alegeți un fișier. Dacă lăsați „Denumire pagină” goală, pagina primește numele fișierului.

O pagină poate fi o fotografie sau o scanare, un PDF ori un document Word, Excel, OpenOffice sau text. Alt fel de fișier este refuzat chiar acolo, cu explicația „Acest tip de fișier nu poate fi adăugat ca pagină”.

**Paginile se pot alege și înainte de prima salvare.** Pe „Act nou”, „+ Adaugă pagină” alege unul sau mai multe fișiere deodată. Ele așteaptă în „Pagini”, cu miniatura lor, iar ordinea lor o schimbați cu „Mută mai sus” și „Mută mai jos”; „Elimină pagina” scoate una. La „Salvează” se creează actul și apoi se încarcă paginile, în ordinea aceea. Dacă plecați de pe formular cu pagini alese, aplicația vă întreabă întâi, ca la orice modificare nesalvată.

### 6.2.2 Citirea paginilor {#documents-add-read}

Un clic pe rândul unei pagini o arată în fișă. Cu două pagini sau mai multe apare și numărătoarea lor. „Pagini extinse” deschide paginile pe toată fereastra, destul de mari ca să se citească; „✕ Restrânge” le închide.

- Un PDF se arată doar ca pagină, fără coloana de miniaturi a browserului.
- Un fișier care nu se poate arăta în browser (de exemplu un document Word) spune „Acest tip de fișier nu poate fi previzualizat în browser.” și se poate descărca.
- O pagină al cărei fișier lipsește din arhivă arată o imagine discretă, „Fișierul paginii nu este disponibil”, nu o eroare.

### 6.2.3 Rotirea și notițele unei pagini {#documents-add-rotate}

O pagină scanată întoarsă se îndreaptă cu „Rotește la dreapta”: fiecare apăsare o rotește cu un sfert de tură. „Salvează rotirea” păstrează rotirea, iar de atunci pagina se deschide așa, și în „Pagini extinse”. Fișierul însuși nu se schimbă. O rotire nesalvată se pierde când plecați, fără întrebare. Se rotesc doar paginile imagine.

Pe rândul fiecărei pagini sunt „Notițe pagină” (un creion), „Tipărire” și „Șterge”. Creionul deschide notițele paginii: scrieți, schimbați sau goliți „Note pagină” și apăsați „Salvează”; coloana „Note” a rândului arată ce ați salvat.

### 6.2.4 Ștergerea unui act {#documents-add-delete}

„Șterge”, în bara de butoane a actului, întreabă „Ștergeți actul?”. „Da” îl șterge și vă întoarce la „Acte”, „Nu” îl lasă. Ștergerea nu se poate anula. Dacă ștergerea nu reușește, aplicația spune de ce — de exemplu „Actul nu mai există în arhivă — poate a fost șters între timp.” — și lasă actul deschis.

## 6.3 Tipul actului {#documents-type}

„Tip document” spune ce fel de act este, iar tipul hotărăște ce câmpuri are formularul, cum se numesc emitentul, numărul și data și ce roluri pot avea persoanele legate de act. Pe „Act nou”, câmpul pornește gol.

Tipurile care au formular propriu se citesc în listă cu „(are formular)” după nume — de exemplu „Contract de Vânzare (are formular)”. Cum alegeți un astfel de tip, formularul crește cu fișele lui. Un tip fără formular păstrează doar câmpurile generale ale actului. Pentru un utilizator cu rol de superutilizator, sub „Tip document” al unui tip fără formular scrie „Acest tip nu are încă formular; formularul se construiește în Distilare Tipizate.”, iar „Distilare Tipizate” deschide instrumentul cu tipul deja ales (secțiunea [[tools-doc-type-engine]]).

Fișele care se văd se aleg cu bifele din capul ecranului, ca pe orice înregistrare (secțiunea [[start-tiles]]), iar alegerea se ține minte pentru fiecare tip: un contract de vânzare-cumpărare și un plan își păstrează fiecare aranjamentul lui. Dacă schimbați tipul unui act, se schimbă și fișele.

## 6.4 Identificarea actului și formularul {#documents-identification}

Fiecare act începe cu fișa „Identificarea actului”: „Tip document”, apoi emitentul, numărul și data actului. Numele lor depind de tip:

| Tipul | Emitentul | Numărul | Data |
|---|---|---|---|
| Un tip fără denumiri proprii | Emitent | Nr. document | Data |
| Contract de Vânzare | Notariat | Nr. act autentic | Data autentificării |
| Certificat de Moștenitor | Notariat | Nr. certificat de moștenitor | Data eliberării |

Tot aici stau câmpurile generale: „Etichetă scurtă”, titlul actului — cel din coloana „Titlu” a listei —, „Subiect” și „Note extinse”. Căsuțele în care scrieți text cresc singure cât e nevoie.

Câmpurile proprii ale tipului stau în fișe separate. La un tip cu puține câmpuri, ele sunt într-o singură fișă, „Detalii act”. La contractul de vânzare-cumpărare sunt împărțite pe mai multe fișe, fiecare cu panourile ei, numite între paranteze drepte, de exemplu „[Preț]” (secțiunea [[documents-sale]]).

Multe câmpuri ale tipului sunt liste derulante. Alegerea goală se citește „fără valoare”, cu litere cursive: înseamnă că nu s-a ales nimic. Ca să ștergeți o valoare aleasă, alegeți din nou „fără valoare”.

Un act adus în arhivă cu importul are formularul completat de AI, din ce a citit pe pagini, iar „Stare procesare” arată „Importat” sau „Procesat cu AI”. Ce nu are loc în formular rămâne o notă scurtă în „Note extinse”. Importul este descris în capitolul [[import]] (secțiunea [[import-scanning]]).

Clasificarea, etichetele, grupurile și ștampilele actului stau în fișele „Clasificare” și „Etichete și grupuri”; sunt la fel ca pe orice înregistrare (secțiunea [[links-classify]]).

## 6.5 Părțile, rolurile și cota-parte {#documents-parties}

Persoanele, proprietățile și actele legate de un act stau în fișa „Legături” (secțiunea [[links-related]]): întâi persoanele fizice, apoi persoanele juridice, proprietățile și actele, fiecare rând pe o singură linie, cu pictograma felului lui. O persoană se citește „Nume (Rol)”, un act „Etichetă scurtă (Tip)”. Pe rândul unui act, „Relația” arată în ce fel sunt legate cele două acte. Sub rânduri sunt „Asociază persoană”, „Asociază proprietate”, „Asociază act” și „Dezasociază”, care scoate legătura rândului selectat (secțiunea [[links-associate]]). „Înscrisuri citate” deschide panoul înscrisurilor pe care actul le citează (secțiunea [[links-references]]). Pe un contract de vânzare-cumpărare, vânzătorii și cumpărătorii stau, cu rolul și cota lor, în fișa „Părți” (secțiunea [[documents-sale]]).

**Rolul** spune în ce calitate apare persoana în act: „Vânzător”, „Cumpărător”, „Notar”, „Reprezentant legal / Mandatar”. Se alege la „Rol”, pe ecranul „Asociere persoană”, iar rolurile oferite depind de tipul actului.

**Cota-parte** există doar pentru rolurile care dețin o cotă pe acel tip de act — vânzătorul și cumpărătorul, da; notarul sau proiectantul, nu. Un astfel de rând are butonul portocaliu „Cotă”. Țineți mouse-ul pe el ca să vedeți valorile; apăsați-l ca să le schimbați:

- „Cotă-parte” — scrieți de exemplu 50, 50%, 63,64 sau 1/2;
- „Suprafață echivalentă (mp)”;
- „Mod de deținere” — „în nume propriu”, „devălmășie”, „indiviziune” sau „prin mandatar”.

Valorile se salvează când închideți panoul, cu Esc sau cu un clic în afara lui. Un „Cotă” plin portocaliu este încă gol; cu contur portocaliu are valori.

Sub rânduri, aplicația adună cotele pe fiecare rol: „Total Cumpărător: 100%”. Dacă suma nu dă 100%, scrie de exemplu „Cotele pentru „Cumpărător” însumează 50%, nu 100%. Actul se salvează oricum — verificați ce scrie în act.” Arhiva înregistrează ce scrie în act, chiar dacă cotele nu se adună.

Ce rol deține o cotă se hotărăște în „Date de referință”, la „Roluri Persoane”: în rol, la „Act”, bifa „Deține cotă” pentru fiecare tip de act (secțiunea [[admin-reference-data]]). Dacă bifa se scoate mai târziu, cotele salvate rămân, doar de citit.

## 6.6 Contractul de vânzare-cumpărare {#documents-sale}

Contractul de vânzare-cumpărare („Contract de Vânzare”, în listă „CVC”) are cel mai bogat formular din arhivă (Figura [[fig-documents-sale]]). Bifele lui de fișe sunt, în ordine: „Identificarea actului”, „Preț și plată”, „Obiectul vânzării”, „Carte funciară”, „Declarații și garanții”, „Taxe și cheltuieli”, „Părți”, „Legături”, „Clasificare”, „Etichete și grupuri” și „Pagini”. În „Identificarea actului”, pe lângă „Notariat”, „Nr. act autentic” și „Data autentificării”, stau „Calitate exemplar”, „Exemplare emise”, „Temei autentificare” și „Data conținutului”.

![6.2 Un contract de vânzare-cumpărare](documents-sale.png){#fig-documents-sale}

Fișele formularului și panourile lor:

| Fișa | Panourile ei |
|---|---|
| Preț și plată | [Preț], [Plată] |
| Obiectul vânzării | [Descriere], [Scop și predare], [Obiect declarat] |
| Carte funciară | [Dosar cadastral], [Situația în cartea funciară], [Excepția de la cadastru] |
| Declarații și garanții | [Declarațiile vânzătorului], [Garanții], [Declarații legale] |
| Taxe și cheltuieli | [Taxe și onorarii], [Cheltuieli] |

În „[Taxe și onorarii]” stau „Timbru judiciar”, „Onorariu notarial”, „Impozit transfer” și „Taxă timbru și publicitate”.

**Fișa „Părți”** ține vânzătorii și cumpărătorii; nu se vede de la început, așa că bifați-o. Părțile stau pe grupe, sub numele rolului — „Vânzător” întâi, apoi „Cumpărător” —, fiecare rând cu „Cotă” lui (secțiunea [[documents-parties]]). Un contract fără părți spune „Nicio parte asociată încă. Asociați vânzătorii și cumpărătorii cu rolul și cota lor.” „Asociază persoană” adaugă o parte: căutați persoana după „Nume” sau „Cod”, alegeți „Rol”, bifați rândul și apăsați „Asociază selecția”. „Dezasociază” scoate partea selectată. Celelalte persoane ale contractului, de pildă notarul, stau pe „Legături”, iar proprietățile vândute se leagă tot de acolo.

**„Obiectul vânzării”** spune ce se vinde. „Descrierea obiectului” se compune din proprietățile contractului, din părți și din „Scop vânzare” — de exemplu „2 imobile, 7.400 mp în total”. Se completează singură când deschideți un contract cu câmpul gol. După ce legați o proprietate nouă, apăsați „Recompune” ca să fie scrisă din nou, apoi „Salvează”.

## 6.7 Actul adițional și certificatul de moștenitor {#documents-dependent}

### 6.7.1 Actul adițional {#documents-dependent-addendum}

Un act adițional modifică un alt act. Are fișele „Identificarea actului” (cu numele notariale și „Onorariu notarial”), „Actul modificat”, „Ce modifică” și „Părți”.

„Actul modificat” leagă actul adițional de contractul pe care îl modifică. Salvați întâi actul adițional, apoi apăsați „Leagă actul modificat”, căutați la „Caută actul modificat” după etichetă sau număr și apăsați „Leagă” pe actul potrivit. Fișa arată atunci actul legat, tipul lui și „Deschide”; „Dezleagă” desface legătura.

Dacă actul modificat nu este în arhivă, fișa scrie „Actul modificat nu e în arhivă — datele lui, așa cum le dă actul adițional:” și oferă patru câmpuri, întâi „Nr. act părinte”. Când legați actul, câmpurile acestea se ascund, dar nu se golesc; dacă îl dezlegați, reapar cu valorile lor. Un act adițional modifică un singur act: un al doilea este refuzat, cu „Acest act adițional modifică deja „…”. Dezlegați-l întâi.”

„Ce modifică” ține „Motiv completare”, „Efect urmărit”, „Preț neschimbat” și clauzele schimbate.

### 6.7.2 Certificatul de moștenitor {#documents-dependent-inheritance}

În „Identificarea actului” al unui certificat de moștenitor stau „Notariat”, „Nr. certificat de moștenitor” și „Data eliberării”. Defunctul și moștenitorii sunt părțile certificatului, în „Părți”:

1. Apăsați „+ Adaugă parte”. Se deschide „Adaugă parte la certificat”.
2. Căutați persoana după „Nume” sau „Cod” și alegeți-o — aici se alege o singură persoană odată.
3. Alegeți la „Rol” „Defunct” sau „Moștenitor” și apăsați „Adaugă parte”.

„Părți” arată un tabel cu „Nume” și „Rol”; „Elimină” scoate o parte. Pe „Legături”, moștenitorii au „Cotă”, iar defunctul nu. Fiecare persoană vede certificatul printre legăturile ei, cu rolul ei.

## 6.8 Exemple și cazuri de utilizare {#documents-examples}

### 6.8.1 Arhivați un contract de vânzare-cumpărare {#documents-example-sale}

Aveți scanat un contract de vânzare-cumpărare pentru un teren din Bragadiru.

1. „Acte” → „Adaugă act”; la „Tip document” alegeți „Contract de Vânzare (are formular)” (secțiunea [[documents-type]]).
2. Cu „+ Adaugă pagină” alegeți scanările, puneți-le în ordine și completați „Etichetă scurtă”, „Notariat”, „Nr. act autentic” și „Data autentificării” (secțiunile [[documents-add]] și [[documents-identification]]).
3. Apăsați „Salvează”; rotiți și salvați pagina care a fost scanată întoarsă.
4. Bifați „Părți” și asociați vânzătorul și cumpărătorul cu rolul lor, apoi scrieți-le cota (secțiunea [[documents-parties]]).
5. Pe „Legături”, asociați terenul, apoi în „Obiectul vânzării” apăsați „Recompune” și „Salvează” (secțiunea [[documents-sale]]).

### 6.8.2 Înregistrați un certificat de moștenitor {#documents-example-inheritance}

O persoană a murit, iar doi moștenitori au primit un certificat de moștenitor.

1. Adăugați un act de tipul „Certificat de Moștenitor” și salvați-l (secțiunea [[documents-add]]).
2. În „Părți”, adăugați defunctul cu rolul „Defunct”, apoi fiecare moștenitor cu rolul „Moștenitor” (secțiunea [[documents-dependent-inheritance]]).
3. Pe „Legături”, apăsați „Cotă” la fiecare moștenitor și scrieți cota lui (secțiunea [[documents-parties]]).

### 6.8.3 Găsiți contractele achitate integral {#documents-example-filter}

1. Pe „Acte”, deschideți „Tip document:”, debifați „Toate tipurile” și bifați doar „Contract de Vânzare” (secțiunea [[documents-list]]).
2. La „Câmp specific:” alegeți „Stare plată”, apoi „Achitat integral”.
3. Ca să vedeți și data contractelor, bifați „Data” în „Câmpuri afișate”.
`;
