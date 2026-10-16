/**
 * Manual, ro-RO, chapter 13 — 13.1 written in #39.39, 13.2 in #39.40, 13.3 in #39.42, 13.4 in #39.43, 13.5 in #39.45. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 13 Ajutor și învățare {#learning}

Capitolul acesta descrie ce vă ajută să învățați aplicația: manualul, ajutorul „?”, harta competențelor, chestionarele și „Întreabă”, care răspunde din manual la o întrebare.

## 13.1 Manualul de utilizare {#learning-manual}

Manualul se deschide din bara laterală, „Ajutor și învățare” → „Manual de utilizare”. În stânga stă „Cuprins”, cu toate capitolele și secțiunile lor; în dreapta, un singur capitol. Apăsați un titlu din cuprins ca să mergeți la el.

- Numerele din text care trimit la altă secțiune, la alt capitol sau la o figură sunt legături: apăsați-le și manualul se deschide acolo.
- La sfârșitul fiecărui capitol, „Capitolul anterior” și „Capitolul următor” vă duc mai departe fără să vă întoarceți la cuprins.
- Adresa din browser numește secțiunea deschisă. O puteți păstra ca semn de carte sau trimite cuiva: deschisă, duce direct la aceeași secțiune, chiar dacă între timp manualul a primit capitole noi și numerele s-au schimbat.
- O adresă care numește o secțiune care nu mai există deschide primul capitol și vă spune asta.

„Descarcă (Word)” face din manual un document Word, în limba în care folosiți aplicația: titlul, cuprinsul, fiecare capitol pe pagina lui și toate figurile. Este același text cu cel de pe ecran, așa că documentul descărcat azi spune ce spune și ecranul azi.

Alături, „Descarcă în engleză (Word)” dă manualul în engleză, de pildă pentru cineva care nu citește românește. Există două manuale, câte unul pentru fiecare limbă: fiecare este scris în întregime în limba lui, iar figurile lui sunt fotografiate în aplicația folosită în acea limbă.

Figurile sunt fotografiate din aplicație, pe obiecte inventate. Unde pe ecran ar fi apărut date ale unor persoane reale, ele sunt estompate.

## 13.2 Ajutorul „?” și textele lui {#learning-help}

Fiecare ecran are, în bara de sus, un „?”. Apăsat, arată un „Context” — de ce există ecranul — și un „Cum se folosește” — ce se face pe el (secțiunea [[start-help]]). Sub ele stă „Vezi în manual”, cu numărul și titlul secțiunii din acest manual care descrie ecranul pe larg; apăsați-l și manualul se deschide acolo. „?” este forma scurtă a manualului, iar manualul este forma lungă a lui „?”.

Textele din spatele lui „?” se scriu în „Ajutor și învățare” → „Informații de ajutor” (secțiunea [[admin-help]]): alegeți ecranul din listă, scrieți în casete, urmăriți „Previzualizare” și apăsați „Salvează”.

### 13.2.1 Textele propuse {#learning-help-proposals}

Când manualul se schimbă, textul unui ecran poate rămâne în urmă: trimite la o secțiune care nu mai există sau numește o filă care și-a schimbat numele. Atunci, lângă ecranul acela din listă apare „Propunere”: un text propus, scris din acest manual. Deasupra listei, un rând spune câte ecrane au o propunere. Când nu așteaptă nicio propunere, nici rândul acesta nu apare.

Deschideți ecranul: textul de acum și propunerea stau unul lângă altul, câmp cu câmp, în română și în engleză.

- „Acceptă” salvează propunerea ca text al ecranului; „?” o arată de îndată.
- „Editează” pune propunerea în casetele de dedesubt, ca s-o schimbați. Nu se salvează nimic până nu apăsați „Salvează”.
- „Nu acum” o lasă deoparte; o regăsiți data viitoare când deschideți ecranul „Informații de ajutor”.

Ca să le acceptați pe toate deodată, apăsați butonul „Acceptă toate” de deasupra listei, care arată și câte sunt. O confirmare, „Acceptați toate propunerile?”, numește ecranele: „Acceptă toate” le salvează pe rând, iar „Anulează” nu schimbă nimic. La sfârșit, un rând spune câte texte s-au salvat.

Textul dumneavoastră nu este schimbat niciodată fără să alegeți. O propunere este legată de textul pe care l-a găsit: dacă scrieți altceva peste el, propunerea dispare singură, pentru că nu mai răspunde textului pe care îl aveți. Nici „Acceptă toate” nu scrie peste un text schimbat între timp: ecranul acela este sărit.

## 13.3 Harta competențelor {#learning-skills}

„Ajutor și învățare” → „Harta competențelor” arată ce se învață în lucrul cu arhiva, ca o hartă (Figura [[fig-learning-skills-map]]). Fiecare casetă este o competență, cu numărul, numele și traseul ei. Casetele stau pe patru coloane, de la stânga la dreapta: „De bază”, „Intermediar”, „Avansat” și „Expert”. O săgeată duce de la o competență la una care se sprijină pe ea.

![13.1 „Harta competențelor”, cu cele patru stări](skills-map.png){#fig-learning-skills-map}

### 13.3.1 Culorile și stările {#learning-skills-states}

Culoarea unei casete este a nivelului ei și nu se schimbă niciodată: bleu deschis cu text bleumarin pentru „De bază”, albastru pentru „Intermediar”, albastru închis pentru „Avansat”, bleumarin cu chenar și text auriu pentru „Expert”. Peste culoare, caseta arată unde sunteți:

| Starea | Cum arată | Ce înseamnă |
|---|---|---|
| „Deschisă” | colorată, fără bifă | toate competențele dinainte sunt stăpânite; chestionarul ei este disponibil |
| „Stăpânită” | colorată, cu bifa verde | chestionarul ei a fost trecut |
| „Închisă” | gri, fără bifă, cu chenarul punctat | îi lipsește cel puțin o competență dinainte |
| „Depășită” | gri, cu bifa verde, cu chenarul verde și gros | stăpânită, iar o competență care se sprijină pe ea este stăpânită și ea |

O competență fără nimic înainte — toate cele de bază — este deschisă de la început. Când trec un chestionar, competența devine stăpânită, iar cele de dinaintea ei devin depășite: le-ați depășit, dar contează în continuare ca stăpânite pentru celelalte competențe care se sprijină pe ele.

### 13.3.2 Pe hartă {#learning-skills-use}

- Apăsați o casetă deschisă ca să dați chestionarul ei (secțiunea [[learning-quizzes]]).
- O casetă închisă, apăsată, arată ce competențe îi lipsesc ca să se deschidă, fiecare cu starea ei. O casetă stăpânită sau depășită spune de când e stăpânită.
- Când țineți mouse-ul pe o casetă, săgețile ei ies în față, iar celelalte se estompează.
- Deasupra hărții stau traseele, de la „Persoane” la „Spațiul de lucru” (secțiunea [[learning-skills-paths]]). „Toate traseele” arată toată harta.
- „Potrivește” încape harta în lățimea ferestrei, iar „100%” o arată în mărime naturală. „Listă” arată aceleași competențe ca listă, pe niveluri; „Diagramă” aduce harta înapoi.

### 13.3.3 Traseele și cele două vizualizări {#learning-skills-paths}

Un traseu este tot ce vă trebuie ca să ajungeți la competențele lui de expert: competențele lui de expert, toate competențele pe care se sprijină ele, din orice traseu, și celelalte competențe ale traseului. Traseul „Proprietăți” cuprinde deci și competențe de „Spațiul de lucru”, de „Persoane” sau de „Legături”, fiindcă fără ele nu se ajunge la expertul proprietăților. Fiecare casetă își păstrează numele traseului ei.

- Alegeți un traseu, iar competențele lui rămân în față; celelalte se estompează, la locul lor, ca harta să nu sară de la un traseu la altul. Sub trasee scrie câte competențe are traseul.
- O săgeată e albastru închis doar când ambele capete sunt în traseu. Celelalte sunt gri deschis, cu vârful la fel de gri. Când țineți mouse-ul pe o casetă, săgețile ei ies în față, și vârfurile lor, chiar dacă nu sunt în traseu.
- Un traseu e stăpânit când toate competențele lui avansate și de expert sunt stăpânite sau depășite; atunci are bifa verde. O competență stăpânită pe un traseu este stăpânită pe toate traseele care au nevoie de ea.

Harta se vede în două feluri, cu butoanele de lângă trasee:

| Butonul | Ce arată |
|---|---|
| „Progresul meu” | unde sunteți: fiecare casetă în starea ei — deschisă, stăpânită, închisă sau depășită (secțiunea [[learning-skills-states]]). Așa se deschide pagina |
| „Prezentare” | harta așa cum e gândită: fiecare casetă în culoarea nivelului ei, deschisă, fără gri și fără bife (Figura [[fig-learning-skills-path]]). O casetă apăsată arată ce cuprinde competența și unde o găsiți în manual |

Alegerea ține și pentru „Toate traseele” și pentru „Listă”: în „Prezentare”, lista nu are coloana „Starea”.

![13.2 Traseul „Proprietăți”, în „Prezentare”](skills-map-path.png){#fig-learning-skills-path}

## 13.4 Chestionarele {#learning-quizzes}

Fiecare competență a hărții are un chestionar; îl deschideți apăsând caseta ei, cât timp este deschisă (secțiunea [[learning-skills]]). Progresul ține de cont: fiecare își vede chestionarele lui, pe orice calculator se conectează; pe o instalare fără conturi, progresul ține de instalare.

### 13.4.1 Cum se dă un chestionar {#learning-quizzes-take}

Pagina arată câteva întrebări, fiecare cu trei sau patru răspunsuri, dintre care unul singur este bun. Alegeți câte un răspuns la fiecare întrebare; „Trimite” se poate apăsa abia când ați răspuns la toate, iar sub el se vede câte ați făcut. Apăsat, „Trimite” trimite răspunsurile o singură dată.

- Întrebările și răspunsurile apar de fiecare dată în altă ordine.
- O competență are cel puțin două variante ale chestionarului; o încercare nouă vă dă altă variantă decât ultima.
- Nimic nu se înregistrează până la „Trimite”. Dacă plecați de pe pagină cu răspunsuri alese, aplicația întreabă întâi: „Renunță” pleacă fără să înregistreze nimic, deci plecarea nu vă costă nicio așteptare.

### 13.4.2 Rezultatul {#learning-quizzes-result}

Treceți cu cel puțin 80 % răspunsuri bune — de exemplu 5 din 6 sau 8 din 10.

| Rezultatul | Ce vedeți | Ce se schimbă pe hartă |
|---|---|---|
| Trecut | câte răspunsuri bune ați avut și, la fiecare întrebare, răspunsul bun cu explicația lui și secțiunea din manual de unde vine | competența devine stăpânită, iar cele de dinaintea ei devin depășite; competențele care se sprijineau doar pe acestea se deschid |
| Picat | câte răspunsuri bune ați avut, câte trebuiau, secțiunile din manual de recitit și data și ora de la care se poate relua | nimic; competența rămâne deschisă |

După un chestionar picat, răspunsurile bune nu se arată: le-ați lua cu dumneavoastră la încercarea următoare. Recitiți secțiunile propuse.

Un chestionar picat se poate relua după trei zile, socotite de la încercarea picată. Data și ora sunt spuse în ora Toronto, pe pagina rezultatului și pe pagina competenței.

## 13.5 Întreabă {#learning-ask}

„Întreabă” răspunde din acest manual la o întrebare scrisă cu cuvintele dumneavoastră. Îl deschideți din bara laterală, „Ajutor și învățare” → „Întreabă”; aceeași căsuță stă și în capul „Manual de utilizare”.

### 13.5.1 Cum se găsește răspunsul {#learning-ask-search}

Scrieți întrebarea — de exemplu „cum adaug o persoană?” — și apăsați Enter sau „Întreabă”. Întrebarea merge la Claude împreună cu cuprinsul manualului: fiecare secțiune, cu numărul, titlul ei și un rând care spune la ce răspunde. Claude alege după ce înseamnă întrebarea, nu după cuvintele pe care le are în comun cu manualul, cel mult cinci secțiuni care răspund la ea, apoi scrie din textul lor un răspuns de cel mult trei propoziții.

Pagina arată unul din două lucruri, niciodată ceva între ele:

- **un răspuns**, care numește secțiunile pe care se sprijină, de exemplu „§3.2” — apăsați numărul ca să citiți secțiunea —, iar sub el, aceleași secțiuni, cu numărul și titlul, fiecare o legătură în manual;
- **„Manualul nu răspunde la această întrebare.”**, cu „Deschide cuprinsul manualului”, când nicio secțiune nu răspunde. Atunci nu apare nicio listă: o listă de secțiuni care doar seamănă cu întrebarea nu vă ajută.

Răspunsul este scris de AI: verificați în secțiunea numită înainte să vă bazați pe el.

### 13.5.2 Ce trimite și ce costă {#learning-ask-ai}

- Claude primește doar întrebarea, cuprinsul manualului și textul secțiunilor alese — nimic din obiectele arhivei și nici întrebările de dinainte.
- Fiecare întrebare este plătită: o citire ca să aleagă secțiunile și, când găsește, încă una ca să scrie răspunsul. De obicei costă împreună sub un cent. „Setări” → „Costuri” → „AI” le numără cu celelalte citiri plătite (secțiunea [[admin-settings-costs]]).
- Diacriticele, ordinea cuvintelor și felul în care e formulată întrebarea nu contează: contează ce întrebați.
`;
