/**
 * Manual, ro-RO, chapter 11. (Slice #39.39)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 11 Rapoarte {#reports}

Secțiunea „Rapoarte” din bara laterală strânge trei ecrane care privesc arhiva de sus, peste toate obiectele: „Interacțiuni”, jurnalul contactelor cu clienții; „Arbori de moștenire”, familiile din arhivă desenate într-un singur loc; și „Căutare globală”, care găsește persoane, proprietăți și acte dintr-un singur ecran. Deschideți „Rapoarte” în bara laterală (secțiunea [[start-sidebar]]) și apăsați ecranul dorit.

## 11.1 Interacțiuni {#reports-interactions}

O interacțiune este un contact cu un client: un telefon, un e-mail, un mesaj pe WhatsApp, un SMS, o întâlnire sau o scrisoare trimisă prin poștă. Ecranul „Interacțiuni”, cu subtitlul „Jurnalul contactelor cu clienții”, arată toate aceste contacte la un loc, pentru toți clienții. El este doar istoricul: aici căutați și citiți. O interacțiune nouă se înregistrează pe ecranul persoanei, în fișa ei „Interacțiuni” (secțiunea [[persons-interactions]]); drumul până acolo pornește chiar din acest ecran, de pe numele persoanei.

### 11.1.1 Istoricul și filtrele {#reports-interactions-history}

Când deschideți ecranul, sub titlu scrie „Toți clienții”, perioada este „Ultimele 90 de zile”, iar ordinea este „Cele mai noi întâi”. Fiecare rând este o interacțiune, cu coloanele „Data”, „Canal”, „Sens”, „Persoană”, „Subiect”, „Acte” și „Stare”. Deasupra listei vedeți câte interacțiuni sunt în vizualizare și câte dintre ele „Așteaptă răspuns”.

Bara de unelte de deasupra listei o restrânge:

- „Caută persoană sau subiect…” — scrieți o parte din numele persoanei sau din subiect.
- „Perioada” — „Azi”, „Ultimele 7 zile”, „Ultimele 30 de zile”, „Ultimele 90 de zile”, „Anul acesta” sau „Personalizat”, cu „De la” și „Până la”. O interacțiune din afara perioadei alese nu apare.
- Canalele — câte un buton pentru „E-mail”, „WhatsApp”, „SMS”, „Telefon”, „Întâlnire” și „Poștă”. Apăsat, butonul se umple și lista arată doar canalul acela; apăsat din nou, filtrul dispare.
- „Sens” — „Toate”, „Primite” (contactele venite de la client) sau „Trimise” (cele plecate de la dumneavoastră).
- „Caută persoană…” — alegeți o persoană, iar lista arată doar interacțiunile ei; bara de sub titlu o numește. „Arată toți clienții” vă întoarce la toată lista.
- „Cele mai noi întâi” — apăsat, devine „Cele mai vechi întâi” și întoarce ordinea. Ordinea aleasă rămâne și după ce reîncărcați pagina.

Și antetul unei coloane are filtrul lui: în „Canal”, „Filtrează după „Canal”” deschide o listă cu canalele, de bifat; în „Acte” alegeți „Cu acte legate” sau „Fără acte legate”. Filtrul din antet și butoanele din bara de unelte sunt același filtru: ce bifați într-un loc se vede și în celălalt. Descrierea unei interacțiuni nu se folosește la filtrare — căutați după subiect.

„Așteaptă răspuns: …” numără interacțiunile primite care sunt încă pe starea „Așteaptă răspuns”, adică clienții care v-au scris sau v-au sunat și încă nu au primit răspuns. Apăsat, lasă în listă doar aceste interacțiuni și alege „Primite”.

Imediat ce un filtru este pus, apare „Șterge filtrele”. Apăsat, pune totul la loc: ultimele 90 de zile, toate canalele, „Toate”, căsuța de căutare goală și „Cele mai noi întâi”.

Un clic pe un rând îl selectează și arată descrierea interacțiunii sub subiect. În listă nu se poate scrie nimic. Dacă o interacțiune are acte legate, în coloana „Acte” apare o agrafă cu numărul lor; apăsată, agrafa le înșiră, iar un clic pe un act îl deschide din arhivă. Numele persoanei dintr-un rând este o legătură: deschide ecranul persoanei, cu formularul deja deschis pe o interacțiune nouă.

### 11.1.2 Înregistrarea unei interacțiuni {#reports-interactions-log}

Pe ecranul persoanei, sub istoricul din fișa „Interacțiuni”, apăsați butonul „Înregistrează o interacțiune”. Formularul nu are căsuță pentru persoană: interacțiunea este a persoanei de pe ecran. Formularul are cinci secțiuni, fiecare cu un titlu urmat de o săgeată; un clic pe titlu deschide secțiunea, al doilea o închide. Când formularul se deschide, doar „Introducere manuală” este deschisă.

- „Conturi conectate” — Gmail și WhatsApp Business, fiecare „Neconectat”. Butoanele „Conectează” nu fac încă nimic: o interacțiune se înregistrează de mână, fără niciun cont conectat, iar „Nimic nu se trimite fără confirmare.”.
- „Introducere manuală” — „Canal”, „Sens”, „Stare”, „Data și ora” (implicit acum), „Subiect” și „Descriere”. Subiectul este ce apare în istoric și ce se folosește la filtrare, deci păstrați-l scurt. Descrierea ține restul; întrebarea scrisă în ea se schimbă după canal — la „Telefon”, de exemplu, „Ce s-a convenit?”.
- „Asocieri” — actele, etichetele și proprietatea legate de interacțiune (secțiunea [[reports-interactions-links]]).
- „Memento” — bifați „Setează un memento” și alegeți „Data mementoului”. Data se păstrează și se vede în istoric; aplicația nu trimite notificări.
- „Notă internă” — o notă „Vizibilă doar echipei”.

O secțiune închisă care are ceva în ea spune asta după titlu, de exemplu „Asocieri · 1 etichetă”. Una care are o greșeală spune greșeala, de exemplu „Memento · Alege data mementoului.”.

Starea poate fi „Înregistrată”, „Așteaptă răspuns”, „Trimisă”, „Încheiată” sau „Programată”. O dată din viitor se poate alege doar cu starea „Programată”: altfel apare „Datele viitoare sunt pentru ce e programat. …”.

„Salvează” nu răspunde până când formularul nu este complet. Fără subiect, apare „Adaugă un subiect scurt. Acesta apare în istoric.”. Dacă greșeala este într-o secțiune închisă, salvarea o deschide și duce cursorul la câmpul de corectat.

- „Salvează” — apare „Interacțiune înregistrată”, iar interacțiunea apare prima în istoricul persoanei.
- „Salvează și adaugă” — salvează și lasă formularul gata pentru următoarea, cu același canal și același sens, subiectul gol.
- „Renunță” — dacă ați scris ceva, întâi întreabă „Renunți la interacțiunea nesalvată?”: „Renunță la ea” golește formularul, „Continuă” vă lasă să scrieți mai departe.
- Ctrl+S face același lucru ca „Salvează”.

„Restrânge” strânge formularul la loc, în butonul lui.

### 11.1.3 Acte legate, etichete și o proprietate {#reports-interactions-links}

În secțiunea „Asocieri” legați interacțiunea de ce există deja în arhivă.

- „Acte legate” — apăsați „Adaugă legătură” și găsiți actul în „Caută un act”, după titlu sau cod. Actul nu se copiază și nici nu se încarcă din nou: interacțiunea doar trimite la el. Un act deja legat nu mai este oferit a doua oară. „×” de lângă un act scoate legătura.
- „Etichete” — apăsați „Adaugă etichetă”, scrieți eticheta și apăsați Enter. O etichetă folosită la o interacțiune vă este sugerată la următoarele.
- „Proprietate legată” — găsiți proprietatea în „Caută o proprietate”, după poreclă sau cod. Este opțională și nu apare în istoric. „×” o scoate.

După salvare, rândul interacțiunii arată agrafa și numărul de acte legate.

### 11.1.4 Modificarea și ștergerea {#reports-interactions-edit}

Un clic pe o interacțiune din istoricul persoanei o încarcă în formular: modul trece din „Interacțiune nouă” în „Editează selecția”, iar formularul arată cine a creat-o și cine a modificat-o ultima dată, și când. Schimbați ce trebuie și apăsați „Salvează modificările”; apare „Modificări salvate”, iar istoricul arată noua valoare.

Nimic din ce ați scris nu se pierde fără întrebare. Dacă alegeți alt rând cu modificări nesalvate, formularul întreabă „Renunți la modificările nesalvate?”. Dacă plecați de pe ecran, aplicația întreabă „Modificări nesalvate”, iar „Anulează” vă lasă pe loc, cu ce ați scris.

Dacă altcineva a salvat aceeași interacțiune înaintea dumneavoastră, salvarea nu trece peste el: apare „Această interacțiune a fost modificată de altcineva. O reîncarci sau o suprascrii?”. „Reîncarcă” aduce varianta lui; „Suprascrie” păstrează ce ați scris dumneavoastră.

Ca să ștergeți o interacțiune, apăsați „Șterge interacțiunea”. Întrebarea „Ștergi interacțiunea?” numește persoana și data și spune „Actele legate rămân în arhivă; persoana și proprietatea nu se schimbă.”. „Șterge” o șterge definitiv: apare „Interacțiune ștearsă”, rândul dispare, iar formularul revine la „Interacțiune nouă”.

### 11.1.5 „Exportă” {#reports-interactions-export}

„Exportă”, în bara de unelte a ecranului „Interacțiuni”, descarcă rândurile pe care le arată filtrele, în ordinea din listă, într-un fișier care se deschide direct în Excel, pe coloane, cu diacriticele la locul lor. Numele fișierului începe cu „interactiuni-”, urmat de data zilei.

Coloanele fișierului sunt „Data și ora”, „Canal”, „Sens”, „Persoană”, „Subiect”, „Descriere”, „Acte legate”, „Stare”, „Memento” și „Etichete”. Descrierea intră întreagă, într-o singură celulă, chiar dacă are mai multe rânduri. Nota internă nu intră în fișier. Așa că puneți întâi filtrele — o persoană, un canal, o perioadă — și apoi exportați: fișierul conține exact ce vedeți.

### 11.1.6 Pe ecranul persoanei și în „Incursiune” {#reports-interactions-person}

Fișa „Interacțiuni” de pe ecranul unei persoane arată aceeași listă, doar pentru persoana aceea, cu formularul sub ea (secțiunea [[persons-interactions]]). „Deschide în „Interacțiuni”” duce la ecranul acesta, deja restrâns la persoană.

Din lista persoanelor, „Incursiune” arată fișa „Interacțiuni” doar cu istoricul, fără formular. Un clic pe o interacțiune de acolo deschide ecranul persoanei, cu interacțiunea încărcată în formular.

## 11.2 Arbori de moștenire {#reports-inheritance}

„Arbori de moștenire” desenează, pe toată pagina, fiecare persoană fizică ce are o legătură de familie — o legătură cu un rol marcat „Rudenie” în „Roluri Persoane” (secțiunea [[admin-reference-data]]). Ecranul este doar pentru citit: rudele se leagă din fișa „Arbore de moștenire” a persoanei (secțiunea [[persons-relatives-tree]]) sau din „Legături” (secțiunea [[persons-relatives-link]]). Dacă nu există încă nicio legătură de familie, ecranul vă spune unde să alegeți „Rudenie”.

În arbore nu apar CNP-ul, actul de identitate sau adresa: fiecare persoană este arătată doar prin nume, poreclă, gen, data nașterii și, dacă e cazul, decesul.

### 11.2.1 Desenul, nivelurile și căutarea {#reports-inheritance-levels}

Generațiile se citesc de sus în jos: bunicii pe un rând, părinții sub ei, copiii mai jos. Soțul și soția stau unul lângă altul, iar copilul sub părinții lui. Fiecare familie are banda ei, separată de celelalte; deasupra arborelui scrie câte persoane și câte familii sunt desenate.

Arborele are trei niveluri, iar bara lui vă spune pe care sunteți: „Nivelul … din 3 — rotița mărește, tragerea mută”.

- Nivelul 1 — un punct și prenumele, ca să vedeți o familie mare dintr-o privire.
- Nivelul 2 — numele și anul nașterii, de exemplu „n. 1982”.
- Nivelul 3 — numele, data nașterii și genul, de exemplu „n. 15.01.1982 · femeie”, și legăturile de familie.

Rotiți rotița mouse-ului peste arbore ca să treceți de la un nivel la altul, și trageți cu mouse-ul ca să-l mutați pe pagină.

Ca să ajungeți la o persoană, scrieți-i numele în „Caută o persoană…” și apăsați „Caută”: arborele se centrează pe ea, la nivelul cel mai apropiat, iar cartea ei se deschide alături. Dacă numele nu este în arbore, apare „Nicio persoană cu acest nume în arbore.”.

Când țineți mouse-ul pe o persoană, o carte mică îi arată numele, data nașterii și câte legături de familie are. Un clic pe ea deschide cartea din lateral, cu „Deschide” și „Închide”. Orice nume deschide ecranul persoanei, cu panoul rudelor din fișa „Arbore de moștenire” deja deschis — de acolo adăugați sau scoateți o rudă.

O persoană marcată „Decedat” are „†” după nume și anii vieții sub el, de exemplu „1955–2010”.

Din fișa „Arbore de moștenire” a unei persoane, „Deschide arborele întreg” deschide ecranul acesta centrat pe ea.

### 11.2.2 Actele din arbore și „Acte comune” {#reports-inheritance-documents}

De la nivelul din mijloc, fiecare persoană care apare pe acte poartă o insignă cu numărul lor, de exemplu „Un act”. Un clic pe insignă deschide „Actele pe care apare …”, cu fiecare act: tipul, numărul și data, de exemplu „nr. 123/2001 · din 02.05.2001”. Un clic pe un act îl deschide.

„Acte comune”, oprit la început, pune pe linia dintre două rude câte acte au amândouă în comun. Un clic pe număr deschide „Acte comune: … și …”, cu lista acelor acte. Așa vedeți repede, de exemplu, contractul pe care apar și tatăl și fiica.

### 11.2.3 Familia în timp: „Anul” {#reports-inheritance-year}

„Anul” pornește de la „azi”. Mutați-l într-un an din trecut și arborele arată familia așa cum era atunci: cine s-a născut după anul ales apare estompat, iar cine murise până atunci poartă „†”. O persoană care a murit mai târziu nu este marcată ca decedată în anul ales.

## 11.3 Căutare globală {#reports-search}

„Căutare globală” caută dintr-un singur loc în toate cele trei feluri de obiecte: persoane (fizice și juridice), proprietăți și acte (Figura [[fig-reports-search]]). Este locul în care căutați când nu știți în ce listă se află ce căutați, sau când vreți să vedeți împreună tot ce poartă un nume, o etichetă ori o ștampilă.

![11.1 „Căutare globală”, cu rezultatele unei căutări](reports-search.png){#fig-reports-search}

### 11.3.1 Filtrele {#reports-search-filters}

Completați unul sau mai multe filtre, apoi apăsați „Caută”. Toate filtrele puse se aplică împreună (ȘI): un rezultat trebuie să le îndeplinească pe toate. De exemplu, „Tip entitate: Proprietate” împreună cu „Etichetă: prioritar” găsesc doar proprietățile cu eticheta „prioritar” — nu și persoanele cu această etichetă, nici proprietățile fără ea. Explicația de sub titlul ecranului dă același exemplu.

Casetele filtrelor sunt înguste, câte mai multe pe un rând. Fiecare arată în ea un exemplu scurt, de pildă „Popescu”; țineți mouse-ul pe casetă și îl citiți întreg, de pildă „ex. Popescu sau PPERS00012”.

- „Căutare nume / cod” — o parte din nume sau din cod, de exemplu „Popescu”.
- „Tip entitate” — „Orice”, „Persoană”, „Proprietate” sau „Document”. „Subtip persoană” alege între „Persoană fizică” și „Persoană juridică”.
- „Importanță”, „Relevanță” și „Proveniență” — valorile din fișa „Clasificare” a obiectului (secțiunea [[links-classify-classification]]). „Proveniență” spune cum a intrat obiectul în arhivă, de exemplu „Manual (Adaugă nou)” pentru unul scris de mână.
- „Cod grup”, „Cod ștampilă” și „Etichetă” — grupurile, ștampilele și etichetele din fișa „Etichete și grupuri” (secțiunile [[links-classify-groups]], [[links-classify-stamps]] și [[links-classify-tags]]).
- „Are metadate”, cu „Metadate actualizate de la” și „Metadate actualizate până la”.

„Resetează” golește toate filtrele și ascunde rezultatele.

### 11.3.2 Rezultatele {#reports-search-results}

Deasupra tabelului scrie câte rezultate s-au găsit, de exemplu „3 rezultate”. Coloanele sunt „Tip”, „Nume”, „Grupuri”, „Ștampile”, „Importanță”, „Relevanță”, „Proveniență”, „Actualizat de” și „Metadate actualizate”. „Tip” spune „Persoană”, „Proprietate” sau „Document”. O proprietate este numită după tarla și parcelă, cu porecla între paranteze.

Se arată cel mult 50 de rezultate pentru fiecare fel de obiect, câte 15 pe pagină. Când sunt mai multe, ecranul vă spune și vă cere să restrângeți căutarea — adăugați un filtru.

Dacă nu se potrivește nimic, apare „Nicio entitate nu corespunde filtrelor selectate.”.

## 11.4 Exemple și cazuri de utilizare {#reports-examples}

### 11.4.1 Răspundeți clienților care așteaptă {#reports-example-reply}

Dimineața vreți să vedeți cine v-a scris sau v-a sunat și încă așteaptă un răspuns.

1. Deschideți „Rapoarte” → „Interacțiuni” (secțiunea [[reports-interactions-history]]).
2. Apăsați „Așteaptă răspuns: …”. Rămân doar contactele primite la care nu ați răspuns.
3. Apăsați numele persoanei dintr-un rând. Se deschide ecranul ei, cu formularul gata.
4. După ce ați sunat-o, alegeți „Telefon” și „Trimisă”, scrieți subiectul și apăsați „Salvează” (secțiunea [[reports-interactions-log]]).
5. În istoricul ei, apăsați interacțiunea care aștepta, alegeți la „Stare” „Încheiată” și apăsați „Salvează modificările” (secțiunea [[reports-interactions-edit]]).

### 11.4.2 Trimiteți convorbirile cu un client într-un fișier Excel {#reports-example-export}

O persoană vă cere lista tuturor telefoanelor din ultima lună despre un teren din Bragadiru.

1. Pe ecranul „Interacțiuni”, la „Caută persoană…”, alegeți persoana (secțiunea [[reports-interactions-history]]).
2. La „Perioada”, alegeți „Ultimele 30 de zile”, apoi apăsați butonul „Telefon”.
3. Verificați rândurile din listă: exact acestea intră în fișier.
4. Apăsați „Exportă” și deschideți fișierul în Excel (secțiunea [[reports-interactions-export]]). Notele interne nu sunt în el.

### 11.4.3 Găsiți actele comune ale unui tată și ale fiicei lui {#reports-example-family}

Pregătiți o succesiune și vreți să vedeți pe ce acte apar împreună tatăl decedat și fiica lui.

1. Deschideți „Rapoarte” → „Arbori de moștenire” și căutați tatăl în „Caută o persoană…” (secțiunea [[reports-inheritance-levels]]).
2. Porniți „Acte comune” și apăsați numărul de pe linia dintre tată și fiică (secțiunea [[reports-inheritance-documents]]).
3. Apăsați un act din listă, de exemplu un contract de vânzare-cumpărare, ca să-l deschideți.
4. Mutați „Anul” în anul contractului, ca să vedeți cine era în viață atunci (secțiunea [[reports-inheritance-year]]).

### 11.4.4 Strângeți tot ce poartă o etichetă {#reports-example-tag}

Ați etichetat „prioritar” câteva persoane, terenuri și acte și vreți să le vedeți pe toate la un loc.

1. Deschideți „Rapoarte” → „Căutare globală” (secțiunea [[reports-search-filters]]).
2. Scrieți „prioritar” la „Etichetă” și lăsați „Tip entitate” pe „Orice”.
3. Apăsați „Caută”. Persoanele, proprietățile și actele apar în același tabel (secțiunea [[reports-search-results]]).
4. Ca să vedeți doar terenurile, alegeți „Proprietate” la „Tip entitate” și apăsați din nou „Caută”.
`;
