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

Figurile sunt fotografiate din aplicație, pe înregistrări inventate. Unde pe ecran ar fi apărut date ale unor persoane reale, ele sunt estompate.

## 13.2 Ajutorul „?” și textele lui {#learning-help}

Fiecare ecran are, în bara de sus, un „?”. Apăsat, arată un „Context” — de ce există ecranul — și un „Cum se folosește” — ce se face pe el (secțiunea [[start-help]]). Sub ele stă „Vezi în manual”, cu numărul și titlul secțiunii din acest manual care descrie ecranul pe larg; apăsați-l și manualul se deschide acolo. „?” este forma scurtă a manualului, iar manualul este forma lungă a lui „?”.

Textele din spatele lui „?” se scriu în „Ajutor și învățare” → „Informații de ajutor” (secțiunea [[admin-help]]): alegeți ecranul din listă, scrieți în casete, urmăriți „Previzualizare” și apăsați „Salvează”.

### 13.2.1 Textele propuse {#learning-help-proposals}

Lângă unele ecrane din listă stă „Propunere”: pentru ele există un text propus, scris din acest manual, de obicei pentru că textul de acum trimite la un capitol care nu mai există sau numește o filă care și-a schimbat numele. Deasupra listei, un rând spune câte ecrane au o propunere.

Deschideți ecranul: textul de acum și propunerea stau unul lângă altul, câmp cu câmp, în română și în engleză.

- „Acceptă” salvează propunerea ca text al ecranului; „?” o arată de îndată.
- „Editează” pune propunerea în casetele de dedesubt, ca s-o schimbați. Nu se salvează nimic până nu apăsați „Salvează”.
- „Nu acum” o lasă deoparte; o regăsiți data viitoare când deschideți ecranul „Informații de ajutor”.

Textul dumneavoastră nu este schimbat niciodată fără să alegeți. O propunere este legată de textul pe care l-a găsit: dacă scrieți altceva peste el, propunerea dispare singură, pentru că nu mai răspunde textului pe care îl aveți.

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
- Deasupra hărții stau traseele, de la „Persoane” la „Spațiul de lucru”. Alegeți unul ca să rămână în față doar competențele lui; „Toate traseele” le aduce înapoi. Un traseu e stăpânit când toate competențele lui avansate și de expert sunt stăpânite sau depășite; atunci are bifa verde.
- „Potrivește” încape harta în lățimea ferestrei, iar „100%” o arată în mărime naturală. „Listă” arată aceleași competențe ca listă, pe niveluri; „Diagramă” aduce harta înapoi.

## 13.4 Chestionarele {#learning-quizzes}

Fiecare competență a hărții are un chestionar; îl deschideți apăsând caseta ei, cât timp este deschisă (secțiunea [[learning-skills]]).

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

### 13.5.1 Căutarea {#learning-ask-search}

Scrieți întrebarea — de exemplu „cum adaug o persoană?” — și apăsați Enter sau „Caută”. Apar pe loc cel mult cinci secțiuni ale manualului care răspund, cea mai potrivită întâi. Fiecare arată numărul și titlul ei, capitolul ei și propozițiile care se potrivesc cu întrebarea, cu cuvintele găsite marcate. Apăsați titlul ca să citiți secțiunea în manual.

- Căutarea nu trimite nimic în afara aplicației și nu costă nimic.
- Diacriticele nu contează: „adaug”, „adăug” și „adaugă” găsesc aceleași secțiuni.
- Ajunge începutul unui cuvânt: „adaug” găsește și „adăugarea”.
- Cuvintele mici, ca „cum”, „unde” sau „o”, nu se caută.

Dacă nicio secțiune nu se potrivește, aplicația spune „Manualul nu pare să răspundă la întrebarea aceasta.” Încercați alte cuvinte sau căutați în „Cuprins” (secțiunea [[learning-manual]]).

### 13.5.2 „Răspuns AI” {#learning-ask-ai}

Sub secțiunile găsite stă „Răspuns AI”. Numai dacă îl apăsați, aplicația trimite întrebarea și aceste secțiuni la Claude, care scrie din ele un răspuns de cel mult trei propoziții. Răspunsul numește secțiunile pe care se sprijină, de exemplu „§3.2”; apăsați numărul ca să citiți secțiunea.

- Claude primește doar întrebarea și textul secțiunilor găsite — nimic din înregistrările arhivei și nici întrebările de dinainte.
- Dacă secțiunile nu răspund la întrebare, aplicația spune că manualul nu spune, în loc să ghicească.
- Un răspuns AI este o citire plătită, sub un cent. „Setări” → „Costuri” → „AI” o numără cu celelalte citiri plătite (secțiunea [[admin-settings-costs]]).
- Răspunsul este scris de AI: verificați în secțiunea numită înainte să vă bazați pe el.
`;
