/**
 * Manual, ro-RO, chapter 2. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 2 Primii pași {#start}

Capitolul acesta vă arată ce folosiți peste tot în aplicație: conectarea, bara laterală, bara de navigare, listele, fișele unui obiect și ajutorul. Odată știute, orice alt ecran se citește la fel.

## 2.1 Conectarea {#start-sign-in}

Deschideți aplicația în browser și conectați-vă cu adresa de e-mail și parola contului dumneavoastră, apoi apăsați „Conectare”. Se deschide tabloul de bord (secțiunea [[intro-purpose]]).

Jos, în bara laterală, stă contul vostru: pictograma unui om, numele cu care sunteți conectat și o săgeată. Un clic pe el deschide în sus un meniu mic: întâi „Autentificat ca …”, apoi „Ieșire” (Figura [[fig-account-menu]]); cât bara laterală e strânsă, meniul ține și „Limba” și „Aspect” (secțiunea [[start-sidebar]]). Esc sau un clic în afara meniului îl închide. Parola se schimbă din „Setări” (secțiunea [[admin-settings-account]]).

![2.1 Meniul contului, deschis din josul barei laterale](account-menu.png){#fig-account-menu}

Cine nu are încă un cont cere acces din pagina de conectare. Cererea ajunge la administrator, care o aprobă sau o respinge în „Utilizatori & Acces” (secțiunea [[admin-users]]).

## 2.2 Bara laterală {#start-sidebar}

Bara laterală, în stânga, deschide orice ecran al aplicației (Figura [[fig-sidebar]]). Sus ține „GA40”, cele două comutatoare mici „Limba” și „Aspect” și butonul care o strânge; jos, contul (secțiunea [[start-sign-in]]). Este împărțită în secțiuni:

| Secțiunea | Ce cuprinde |
|---|---|
| Tablou de bord | Primul ecran: noutățile și ce cere atenție. |
| Domeniu | Cele patru liste: Persoane Fizice, Persoane Juridice, Proprietăți, Acte. |
| Instrumente | Distilare Tipizate, Calcul drum lateral, Măsurători pe hartă, Grupări de proprietăți, Navigare. |
| Import | Dosare de proprietăți: aducerea în arhivă a unui dosar întreg. |
| Rapoarte | Interacțiuni, Arbori de moștenire, Căutare globală. |
| Administrare | Date de referință, Utilizatori & Acces, Grupuri, Ștampile, Etichete și, ultimul, Setări — pragurile, implicitele și costurile aplicației. |
| Ajutor și învățare | Informații de ajutor și acest manual de utilizare. |

Un clic pe o secțiune îi arată ecranele, iar un clic pe un ecran îl deschide; ecranul deschis rămâne marcat în bară. „Restrânge bara laterală” o strânge la câte o pictogramă pentru fiecare secțiune, ca să lase mai mult loc ecranului, iar „Extinde bara laterală” o readuce.

![2.2 Bara laterală, cu secțiunea „Domeniu” deschisă](sidebar.png){#fig-sidebar}

În capul barei laterale, lângă „GA40”, „Limba” are două cuvinte, RO și EN: limba în care lucrați este plină, în gri-albăstrui închis, cu literele albe, iar un clic pe cealaltă schimbă limba ecranelor. „Aspect” are un soare și o lună — „Zi” și „Noapte”, cum scrie când țineți mouse-ul pe ele: „Noapte” trece toată aplicația pe fundal închis, pe loc, fără să reîncărcați pagina, iar „Zi” o readuce luminoasă (Figura [[fig-dark]]). Alegerea se păstrează în browserul acesta, și după ce îl închideți, și se schimbă la fel din „Setări”, cu căsuța „Noapte (Mod Întunecat)” (secțiunea [[admin-settings-account]]). Setarea de culori a calculatorului nu contează: fără „Noapte”, aplicația este luminoasă. Cât bara laterală e strânsă la pictograme, cele două comutatoare se mută în meniul contului (secțiunea [[start-sign-in]]).

Într-o fereastră îngustă, sub 1024 de pixeli, bara laterală este mereu strânsă, la pictograme. „Extinde bara laterală” o deschide atunci peste pagină, care se întunecă; Esc, un clic pe pagină sau un ecran ales o strâng la loc. Când lărgiți fereastra, bara revine cum ați lăsat-o.

![2.3 Tabloul de bord în „Noapte”](dark.png){#fig-dark}

## 2.3 Bara de navigare și „Înapoi” {#start-breadcrumb}

Deasupra fiecărui ecran, bara de navigare arată unde vă aflați: „Acasă”, apoi secțiunea și ecranul — de exemplu „Acasă › Administrare › Etichete”. Un nume din bară care este link vă duce înapoi la ecranul acela (Figura [[fig-breadcrumb]]).

Primul buton al barei, „Înapoi”, vă întoarce la ecranul de dinainte. Dacă ați schimbat ceva și nu ați salvat, aplicația vă întreabă întâi: „Anulează” vă lasă pe ecran cu ce ați scris, iar „Renunță” pleacă fără să salveze.

Imediat în dreapta lui, „Înainte” face drumul invers. După ce v-ați întors cu „Înapoi” — sau cu butonul Înapoi al browserului —, vă duce din nou la ecranul de pe care ați plecat. Până atunci este gri și nu se poate apăsa, iar un ecran nou deschis îl face din nou gri, ca butonul Înainte al browserului. Și el vă întreabă întâi, dacă aveți modificări nesalvate.

La capătul din dreapta al barei stă „?”, ajutorul ecranului (secțiunea [[start-help]]). Pe ecranul unei persoane, al unei firme, al unei proprietăți sau al unui act, la stânga lui „?” stau versiunile obiectului — „Versiunea anterioară”, „v 2”, „Versiunea următoare” — și „Panouri” (secțiunile [[links-versions]] și [[start-tiles]]); numele obiectului rămâne în capul ecranului.

Bara stă mereu sus: când derulați un ecran lung, fișele trec pe sub ea, iar „Înapoi”, versiunile, „Panouri” și „?” rămân la îndemână. Într-o fereastră îngustă, bara rămâne pe un singur rând: numele din drum se scurtează întâi, cele dinainte până la „…”, apoi ultimul; țineți mouse-ul pe unul ca să-l citiți întreg.

![2.4 Bara de navigare: „Înapoi”, „Înainte”, drumul până la ecran, versiunile, „Panouri” și „?”](breadcrumb.png){#fig-breadcrumb}

## 2.4 „Recente” {#start-recent}

„Recente”, jos în bara laterală, ține ultimele obiecte pe care le-ați deschis. Un clic pe „Recente” deschide sau strânge lista, iar un clic pe un obiect din ea îl redeschide.

## 2.5 Listele și coloanele lor {#start-lists}

Fiecare dintre cele patru liste — Persoane fizice, Persoane juridice, Proprietăți, Acte — arată pe o pagină câte rânduri încap în fereastră, dar niciodată mai puțin de 10, iar butoanele de sub tabel trec de la o pagină la alta. Când schimbați mărimea ferestrei, pagina se potrivește din nou și rămâne la rândurile pe care le aveați sub ochi. Înaintea titlului fiecărei liste stă o pictogramă cu mai multe obiecte de felul ei: un grup de oameni, trei clădiri, o hartă cu trei repere, trei pagini. Caseta de căutare din capul listei spune în ea după ce caută; dacă textul nu încape, țineți mouse-ul pe casetă și îl citiți întreg. O listă se filtrează după coloanele ei: o coloană care se poate filtra are o pâlnie mică în colțul din dreapta jos al numelui (secțiunea [[properties-list-filters]]). Capul tabelului are înălțimea a două rânduri de nume. Numele coloanei stă singur la mijloc, pe orizontală și pe verticală; un nume prea lung pentru coloana lui trece pe al doilea rând. Capul, rândurile și butoanele de pe ele sunt strânse, ca pe pagină să încapă cât mai multe rânduri. Numele coloanelor sunt scurte — „Născut pe”, „Tip Prop.”, „#Document” —; țineți mouse-ul pe un nume și vedeți numele întreg al câmpului, cel de pe formular.

„Câmpuri afișate” alege coloanele listei: bifați ce vreți să vedeți și debifați ce nu vă trebuie (Figura [[fig-list]]). Până alegeți altfel, fiecare listă se deschide pe patru coloane: proprietățile pe tarla, parcelă, tipul proprietății și localitate; persoanele fizice pe CNP, data nașterii, tipul profesional și data ultimei modificări; persoanele juridice pe tip, CUI, localitate și data ultimei modificări; actele pe număr, dată, instituție și data ultimei modificări. Pe toate cele patru liste se poate alege și „Modificat la”, ziua în care obiectul a fost schimbat ultima oară; adăugarea lui contează ca schimbare, așa că este chiar data după care stă lista când se deschide. „Acte” are, pe lângă ea, „Adăugat la”, ziua în care actul a intrat în arhivă. Numele obiectului, pe rândul lui, este un link: un clic pe el, sau oriunde pe rând, deschide obiectul, iar Ctrl + clic sau clicul pe rotiță îl deschid într-o filă nouă. Pe „Acte” linkul este titlul actului. Celelalte trei butoane ale rândului — „Previzualizare”, „Incursiune” și „Legături” — stau estompate și se aprind pe rândul de sub mouse. Butonul din dreapta, deasupra tabelului, creează un obiect nou. Nu are cuvinte: un + și pictograma listei din bara laterală, cu câteva raze, ca nouă; ținut sub mouse, își arată numele întreg — „Adaugă persoană”, „Adaugă persoană juridică”, „Adaugă proprietate”, „Adaugă act”.

Listele nu au bife, nici pe rânduri, nici în capul tabelului: un obiect se deschide din listă și se șterge de pe ecranul lui. Tabelul începe chiar cu prima coloană cu nume; „Nou!” stă în ea, după text, pe rândurile obiectelor adăugate sau schimbate de curând.

![2.5 Lista persoanelor fizice, cu „Câmpuri afișate” deschis](list.png){#fig-list}

Sub bara de sus a listei stă un rând cu etichetele filtrelor puse — dar numai cât timp este pus un filtru; fără niciun filtru, tabelul începe chiar sub bară. „Șterge filtrele”, pe bara de sus, în dreapta butonului de ordine, le scoate pe toate deodată; căutarea și ordinea listei rămân. Cât timp nu este pus niciun filtru, butonul este gri și, ținut sub mouse, spune „Niciun filtru nu este activ.”. Pâlnia unei coloane are două înfățișări: nefolosită, doar pâlnia, subțire; cu un filtru pus pe coloana ei, plină, albastru închis, într-un cerc albastru închis.

**Ordinea listei.** O listă se deschide cu obiectele schimbate cel mai de curând primele; un obiect abia adăugat contează ca schimbat. Butonul de după „Câmpuri afișate” — pe „Acte”, de după ⓘ-ul lui „Câmp specific:” — spune ordinea: „Recente întâi”. Apăsat, întoarce lista, „Vechi întâi”; apăsat din nou, o readuce. Ținut sub mouse, spune după ce este ordonată lista.

Coloanele care se pot ordona au, în colțul din dreapta jos al numelui, la stânga pâlniei, o pictogramă cu două săgeți, una în sus și una în jos: pe „Persoane fizice” „Modificat la”, „Născut pe”, „Vârstă” și „Decedat pe”; pe „Persoane juridice” „Modificat la”; pe „Proprietăți” „Modificat la”, „Tarla”, „Parcelă”, „Supr. Ofic.” și „Supr. Calc.”; pe „Acte” „Modificat la”, „Adăugat la”, „Data”, „Pagini”, „Persoane” și „Proprietăți”. Un clic pe pictogramă ordonează toată lista după coloana aceea — „Adăugat la” de la cel mai nou, celelalte de la cel mai mic număr sau de la cea mai veche dată —, iar un al doilea clic întoarce ordinea. „Modificat la” este chiar ordinea cu care se deschide lista: cât timp lista stă în „Recente întâi”, pictograma lui are tot cele două săgeți, iar un clic pe ea întoarce lista, „Vechi întâi”, ca butonul de pe bară. Cât timp lista este ordonată după o coloană, pictograma ei are o singură săgeată, groasă, albastru închis, într-un cerc albastru închis, în sus sau în jos după sens, iar butonul de pe bară spune, de exemplu, „Ordonat după „Vârstă”” (Figura [[fig-list-sorted]]). Apăsat, butonul readuce ordinea după ultima modificare. Ordinea stă în adresa paginii, ca filtrele: rămâne după ce reîncărcați pagina și după „Înapoi”.

![2.6 Lista persoanelor fizice ordonată după „Vârstă”: săgeata coloanei, groasă, în cerc, și butonul „Ordonat după „Vârstă””](list-sorted.png){#fig-list-sorted}

**Lista încape în fereastră.** Când fereastra nu este destul de înaltă pentru toată pagina de rânduri, pagina nu se mai derulează în sus și în jos: se derulează doar rândurile, în chenarul listei, cu bara lui de derulare. Capul tabelului, cu numele coloanelor și pâlniile, rămâne sus, iar rândul „Se afișează … din …” cu „Pagina x din y” stă chiar sub chenar, la vedere. Numai într-o fereastră foarte scundă, în care n-ar mai încăpea nici capul tabelului și trei rânduri, se derulează iar pagina. Chenarul își păstrează locul barei de derulare și când rândurile încap — o fâșie îngustă la dreapta —, așa că lista nu-și schimbă lățimea când bara apare sau dispare, de pildă când maximizați fereastra. Banda gri cu numele coloanelor merge până la marginea chenarului, și peste fâșia aceea; după ultimul buton al rândurilor, „Legături”, ea lasă doar cât lasă primul buton față de linia din stânga lui. Butonul de adăugare se termină la aceeași margine din dreapta.

**Coloanele ascunse.** Când coloanele alese sunt mai late decât fereastra, lista se derulează și în lateral, cu bara de derulare de la baza chenarului. Cât timp în dreapta sunt coloane care nu se văd, la marginea dreaptă a capului tabelului stau trei semne roșii „>”, unul sub altul; cât timp sunt coloane ascunse în stânga, trei „<” stau la marginea stângă (Figura [[fig-list-fit]]). Semnele pulsează încet — se estompează puțin și revin, cam o dată la două secunde și jumătate —, ca să le observați fără să vă deranjeze; cât țineți mouse-ul pe ele stau pe loc. Țineți mouse-ul pe ele și un balon, sub capul tabelului, spune ce înseamnă: „Mai sunt coloane la dreapta. Derulați spre dreapta ca să le vedeți.” sau „Mai sunt coloane la stânga. Derulați spre stânga ca să le vedeți.”. Un clic pe ele derulează lista într-acolo, cu aproape cât se vede din ea — puțin din ce era la vedere rămâne la vedere —, așa că o pâlnie aflată sub semne iese de sub ele. Se ajunge la ele și din tastatură, cu Tab, iar Enter le apasă. Când toate coloanele încap, nu apare niciunul.

Când deschideți un obiect din listă și vă întoarceți cu „Înapoi”, lista este derulată unde o lăsaserăți, în jos și în lateral.

![2.7 Lista proprietăților într-o fereastră scundă și îngustă: capul tabelului sus, „Pagina x din y” sub chenar și semnele roșii ale coloanelor ascunse la ambele margini](list-fit.png){#fig-list-fit}

**Lățimea coloanelor.** Între coloane stă o linie subțire, de la capul tabelului până la ultimul rând, de culoarea liniilor dintre rânduri. În capul tabelului linia se poate apuca: țineți mouse-ul pe ea și săgeata devine una cu două vârfuri, iar un balon spune „Trageți ca să lățiți sau să îngustați coloana; dublu-clic îi dă înapoi lățimea obișnuită.”. Trasă spre dreapta, linia lățește coloana din stânga ei; trasă spre stânga, o îngustează, chiar cât mutați mouse-ul (Figura [[fig-list-resize]]). Tabelul se lățește sau se îngustează odată cu ea; nicio coloană nu ajunge mai îngustă decât cât să încapă pâlnia și câteva litere. Când trageți, nu se apasă nimic din ce e sub mouse.

Lățimea aleasă se păstrează pentru lista aceea, în browserul acesta, și după ce reîncărcați pagina; o coloană scoasă din „Câmpuri afișate” își regăsește lățimea când o puneți înapoi. Un dublu-clic pe linie îi dă coloanei înapoi lățimea obișnuită. Din tastatură, ajungeți la linie cu Tab; săgețile stânga și dreapta o îngustează sau o lățesc puțin câte puțin, iar Home îi dă înapoi lățimea obișnuită.

Linia și lățimea ei se trag la fel în toate tabelele de felul acesta: ecranele de asociere, „Căutare globală”, „Utilizatori & Acces”, „Grupuri”, „Ștampile”, calculul drumului lateral, listele din „Date de referință” și tabloul de bord. Unde tabelul umple o fișă sau un chenar — „Grupuri”, „Ștampile”, ecranele de asociere —, ce câștigă o coloană pierde coloana cea lată, descrierea sau numele, iar tabelul rămâne cât fișa; coloana cea lată nu are linie proprie de tras.

![2.8 Linia dintre două coloane, trasă în capul tabelului: coloana din stânga ei se lățește](list-resize.png){#fig-list-resize}

**Ordinea coloanelor.** O coloană se mută de numele ei, din capul tabelului: apucați numele cu mouse-ul și trageți-l spre stânga sau spre dreapta. Cât îl țineți, numele vine după mouse, pe jumătate transparent, iar o linie albastră arată unde va ajunge (Figura [[fig-list-drag]]); lăsați-l acolo și coloana, cu rândurile ei, se mută. Se mută orice coloană cu nume, și cele care sunt mereu în listă; butoanele rândurilor rămân la capăt. Lângă marginea chenarului, lista se derulează singură în lateral. Esc oprește mutarea, iar un nume lăsat departe de capul tabelului nu mută nimic. Un clic pe pâlnie deschide tot filtrul, iar linia dintre coloane schimbă tot lățimea.

Ordinea se păstrează pentru lista aceea, în browserul acesta. O coloană bifată mai târziu în „Câmpuri afișate” vine la capăt; una debifată iese din ordine. Cât timp ați mutat ceva, „Câmpuri afișate” are la sfârșit „Ordinea implicită”, care pune coloanele la loc. Din tastatură, ajungeți la numele coloanei cu Tab, iar Alt + ← și Alt + → o mută cu un loc.

![2.9 O coloană trasă de nume: numele ei sub mouse și linia unde va ajunge](list-drag.png){#fig-list-drag}

## 2.6 Ecranul unui obiect: fișele {#start-tiles}

Un obiect deschis își arată datele în fișe — panouri cu câte un nume, scris sus cu majuscule, în albastru închis (Figura [[fig-record]]). Pe o persoană fizică sunt, de exemplu, identitatea ei, „Legături”, „Clasificare”, „Etichete și grupuri” și „Interacțiuni”.

- „Panouri”, în bara de sus, imediat după versiuni și înainte de „?”, deschide sub bară, aliniat la dreapta cu butonul, un panou cu bifele care aleg ce fișe se văd; „Toate” le arată pe toate, iar „Implicit” revine la setul obișnuit. Setul vostru se salvează în „Setări”, la „Implicitele mele”. O bifă lasă panoul deschis; Esc, un clic în afara lui sau încă un clic pe „Panouri” îl închid; cât e deschis, stă pe loc, chiar dacă derulați ecranul. Închis, ecranul trece de la numele obiectului direct la date. Pe un act, un număr albastru pe buton spune câte fișe ascunse țin un câmp marcat de o versiune. În panou, bifele stau pe două rânduri: cele de aceeași culoare împreună, butoanele la capătul rândului al doilea, iar primul rând puțin mai lung decât al doilea.
- „Toate sus”, la stânga lui „Toate”, urcă toate fișele, de sus în jos, fiecare în coloanele ei, până sub fișa de deasupra sau până sus. Apoi, cât timp o coloană de fișe se termină mult mai jos decât alta, fișa ei de jos trece sub coloana cea mai scurtă — dacă încape acolo și dacă așa ecranul se termină mai sus (Figurile [[fig-all-up-before]] și [[fig-all-up-after]]). Fișele alunecă la locul nou, iar așezarea se păstrează ca după o tragere; „Implicit” o anulează.
- În dreapta bifelor, o schiță mică arată fișele de pe ecran: câte un dreptunghi pentru fiecare, în culoarea ei, fără nume, așezat cum stă fișa și înalt cât ea, la aceeași scară pentru toate — o fișă de două ori mai înaltă are un dreptunghi de două ori mai înalt, iar niciun dreptunghi nu e atât de mic încât să nu se vadă. Se schimbă odată cu fișele.
- Un dreptunghi din schiță se trage ca fișa lui: apăsați pe el și mutați-l — mâna arată că se poate apuca. Fișa se mută odată cu el pe ecran, iar conturul ei arată unde ar ajunge; cât timp locul e ocupat, dreptunghiul are margine roșie. Ținut nemișcat peste alt dreptunghi cât spune „Timp de ținere peste altă fișă”, fișa de dedesubt alunecă în jos, pe ecran și în schiță, ca la o tragere pe ecran. Lăsat, fișa rămâne acolo și se păstrează ca după orice tragere; Esc, sau dreptunghiul lăsat în afara schiței, pune totul înapoi. Un simplu clic pe un dreptunghi nu face nimic.
- O fișă se trage de spațiul ei gol într-un loc liber; un dublu-clic pe ea o urcă sub fișa de deasupra.
- Ca să puneți o fișă unde stă alta, trageți-o peste aceea și țineți-o nemișcată: după o secundă — cât spune „Timp de ținere peste altă fișă”, în „Setări” (secțiunea [[admin-settings-thresholds]]) — fișa de dedesubt alunecă în jos, în coloanele ei, la primul loc liber destul de mare, iar conturul arată că locul e liber (Figura [[fig-make-room]]). Lăsați fișa acolo; Esc pune totul înapoi.
- Fișele mov deschis — harta, colțurile, Street View, paginile unui act, interacțiunile unei persoane — pornesc lângă marginea dreaptă, una sub alta, și se trag ca orice altă fișă; locul în care le lăsați se păstrează, iar „Implicit” le pune înapoi în dreapta.
- ID-ul de sistem al obiectului stă în colțul din dreapta-sus al primei fișe.
- O fișă de formular fără nimic în ea stă pe un singur rând: numele ei, „necompletat” (sau starea ei, de pildă „aceeași cu domiciliul”) și „Adaugă” — plusul —, care o deschide, cu cursorul în primul câmp. Prima fișă a unui obiect — identitatea unei persoane sau a unei firme, „Identificare cadastrală”, „Identificarea actului” — nu se strânge niciodată.
- Într-o fișă care are ceva completat, câmpurile goale stau ascunse în spatele unui link — de pildă „Arată 4 câmpuri goale” —, urmat de numele lor, în gri; țineți mouse-ul pe link și le citiți pe toate. Un clic le arată, până plecați de pe obiect. Un grup de câmpuri goale se ascunde cu tot cu titlul lui — de pildă „[Garanții]” pe un contract de vânzare —, iar linkul îl aduce înapoi. Pe un act, ca pe o persoană, fișa își ascunde câmpurile goale imediat după „Salvează”, fără să reîncărcați pagina. Câteva câmpuri se văd mereu, și goale, pentru că lipsa lor spune ceva: la o persoană numele, prenumele și CNP-ul; la o firmă denumirea și CUI-ul; la o proprietate tipul, localitatea, tarlaua și parcela; la un act tipul, titlul, data și numărul.
- Într-o fereastră îngustă, cam sub 1000 de pixeli, fișele stau într-o singură coloană, în ordinea în care sunt așezate, de sus în jos; acolo nu se trage nimic și nu se păstrează nimic. O fișă mai lată decât fereastra se derulează în ea; versiunile și „Panouri” rămân în bara de sus, oricât de lung ar fi numele.
- Bara de butoane, ultimul lucru de pe ecran, ține coșul (ștergeți) și drumul înapoi; pe un obiect nou, salvarea; pe un obiect deschis doar pentru citire, creionul „Modifică”. Un buton cu pictogramă își arată numele când treceți cu mouse-ul peste el. Pe fișele gri, butoanele au doar pictograma — „Editează”, „Asociază persoană”, „Dezasociază” și celelalte —, iar numele lor îl citiți ținând mouse-ul pe ele; manualul le spune pe nume, ca bulele lor.

![2.10 Ecranul unei persoane fizice, cu fișele ei](record.png){#fig-record}

![2.11 O fișă ținută peste alta: cea de dedesubt a alunecat în jos, la primul loc în care încape întreagă](make-room.png){#fig-make-room}

![2.12 Înainte de „Toate sus”: o fișă trasă departe de celelalte](all-up-before.png){#fig-all-up-before}

![2.13 După „Toate sus”: fișele urcate și coloanele echilibrate; în dreapta bifelor, schița fișelor](all-up-after.png){#fig-all-up-after}

### 2.6.1 Citirea unei fișe și „Editează” {#start-read-edit}

Câmpurile unui formular nu au chenar cât stau: numele câmpului e mic, bleumarin, ca titlul fișei, deasupra, iar valoarea, mai groasă, sub el; un câmp gol are dedesubt o linie întreruptă. Chenarul alb apare când treceți cu mouse-ul peste un câmp în care se poate scrie, iar cel albastru când scrieți în el.

Fiecare câmp are lățimea lui și nu se lățește după ce scrieți în el. O valoare mai lungă decât câmpul trece pe rândul următor, iar câmpul se face mai înalt — și la o listă de alegere: o alegere lungă se citește pe două rânduri, iar lista deschisă arată fiecare valoare întreagă. O valoare de listă prea lungă se poate scurta în „Date de referință” (secțiunea [[admin-reference-data]]).

Un obiect salvat se citește: fiecare fișă de formular își arată valorile ca text — data nașterii cu vârsta alături, de pildă 15.06.1985 (41 de ani), o listă aleasă prin cuvintele ei, bifele ca o listă scurtă. „Editează” — creionul —, în fișă, la dreapta rândului de sub titlu, o deschide în formular: fișa capătă un contur albastru, iar sub câmpuri apar „Salvează” — discheta — și „Renunță” — un X (Figura [[fig-tile-edit]]). „Salvează” păstrează doar câmpurile fișei aceleia și face o singură versiune nouă; „Renunță” pune fișa înapoi cum era și nu scrie nimic. „Salvează” se poate apăsa de la prima schimbare, și o alegere dintr-o listă este o schimbare. O fișă deschisă își arată toate câmpurile, și pe cele goale, iar „Adaugă”, pe o fișă goală, o deschide direct în formular.

Se deschide o singură fișă odată. „Editează” pe alta, cât timp prima are modificări nesalvate, vă întreabă întâi: salvați, renunțați sau rămâneți — la fel ca la plecarea de pe ecran (secțiunea [[start-breadcrumb]]). Din tastatură, Tab ajunge la „Editează”, Enter deschide fișa cu cursorul în primul ei câmp, Enter într-o fișă deschisă o salvează, iar Esc este „Renunță”.

Un obiect nou rămâne un singur formular, cu un singur „Salvează”. O versiune veche se citește, fără „Editează”. Fișele cu butoanele lor proprii — „Legături”, „Etichete și grupuri”, „Interacțiuni”, arborele de moștenire, harta, paginile unui act — lucrează ca înainte. „Clasificare” se citește și se deschide cu „Editează” ca o fișă de formular (secțiunea [[links-classify-classification]]).

![2.14 „Identitate” deschisă cu „Editează”: conturul albastru, „Salvează” și „Renunță” sub câmpuri](tile-edit.png){#fig-tile-edit}

## 2.7 Previzualizarea {#start-preview}

Un obiect legat se poate deschide alături, cu „Previzualizare”, fără să plecați de pe ecranul pe care lucrați — de exemplu cumpărătorul, lângă contractul de vânzare. Se deschid cel mult două previzualizări odată, iar o modificare nesalvată pe ecranul principal rămâne neatinsă. Dintr-o listă, previzualizarea unui rând se deschide lângă tabel.

## 2.8 Ajutorul din spatele „?” {#start-help}

Butonul „?” din capătul barei de navigare deschide ajutorul ecranului: la ce folosește ecranul și cum se lucrează pe el (Figura [[fig-help]]). Acolo unde un gest nu se vede — o tragere, un dublu-clic — un bec mic, lângă locul acela, îl explică. Textele de ajutor le scrie administratorul, în „Informații de ajutor” (secțiunea [[admin-help]]).

![2.15 Ajutorul unui ecran, deschis din „?”](help.png){#fig-help}

## 2.9 Exemple și cazuri de utilizare {#start-examples}

### 2.9.1 Găsiți o persoană după o parte din nume {#start-example-find}

1. În bara laterală, deschideți „Domeniu”, apoi „Persoane Fizice”.
2. Scrieți în caseta de căutare o parte din nume.
3. Dacă rămân mai multe persoane cu același nume, adăugați din „Câmpuri afișate” o coloană care le deosebește, de pildă data nașterii.
4. Apăsați numele de pe rândul căutat.

### 2.9.2 Plecați de pe un ecran fără să pierdeți ce ați scris {#start-example-back}

1. Pe ecranul unei persoane, schimbați un câmp, fără să salvați.
2. Apăsați „Înapoi”: aplicația vă întreabă ce faceți cu modificările.
3. „Anulează” vă lasă pe ecran, cu ce ați scris. Salvați, apoi apăsați din nou „Înapoi”.

### 2.9.3 Faceți loc pe ecran {#start-example-room}

1. Strângeți bara laterală cu „Restrânge bara laterală”.
2. Debifați fișele de care nu aveți nevoie acum.
3. Când ați terminat, „Implicit” readuce fișele obișnuite.
`;
