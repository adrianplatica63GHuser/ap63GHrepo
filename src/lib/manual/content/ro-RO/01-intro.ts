/**
 * Manual, ro-RO, chapter 1. (Slice #39.37)
 * The source format is src/lib/manual/format.ts. Edited here, read by the screen and by the Word download alike.
 */
export const CHAPTER = `
# 1 Introducere {#intro}

Acest manual vă arată cum lucrați cu arhiva: ce ține ea, cum găsiți și adăugați un obiect și cum se leagă obiectele între ele. Este scris pentru cine folosește arhiva în fiecare zi și numește ecranele și butoanele așa cum le numește aplicația însăși.

## 1.1 Pentru ce este arhiva {#intro-purpose}

Arhiva păstrează într-un singur loc persoanele cu care lucrează afacerea, proprietățile lor și actele care le privesc — contracte, certificate, autorizații, cărți de identitate — împreună cu paginile scanate ale fiecărui act. Din orice obiect ajungeți la tot ce este legat de el: de la o parcelă la proprietarii ei și la actele prin care a trecut de la un proprietar la altul.

Primul ecran după conectare este **Tabloul de bord** (Figura [[fig-dashboard]]): ce s-a adăugat în ultimele șapte zile, obiectele ale căror metadate nu au mai fost actualizate de mult, actele care expiră în curând și ce s-a lucrat recent.

Fiecare număr din „Adăugate în ultimele 7 zile” stă sub semnul felului său — un om pentru persoane, o clădire pentru firme, o hartă pentru proprietăți, o pagină pentru acte —, aceleași semne ca în bara laterală, pe ecranele obiectelor și în „Legături”. În „Acte cu valabilitate limitată”, fiecare rând începe cu starea actului: roșie când a expirat, portocalie cât timp e în fereastra de avertizare, neutră după ea; urmează titlul și, dedesubt, mai mic, tipul și data expirării. Un rând deschide actul.

![1.1 Tabloul de bord, primul ecran după conectare](dashboard.png){#fig-dashboard}

## 1.2 Cele trei obiecte principale {#intro-objects}

Totul în arhivă pornește de la trei feluri de obiecte:

- **Persoane** — persoanele fizice, adică oamenii, și persoanele juridice: firme, asociații, instituții.
- **Proprietăți** — terenuri și construcții, cu forma lor pe hartă atunci când colțurile sunt cunoscute.
- **Acte** — orice document: un contract, un certificat, o autorizație, o carte de identitate, cu paginile lui.

Între ele există legături. O persoană este parte într-un act, cu un rol — „Vânzător”, „Cumpărător”, „Moștenitor”. O proprietate este obiectul unui act. O persoană deține o proprietate, cu o cotă-parte. Legăturile se citesc din ambele capete: de pe act vedeți proprietatea, iar de pe proprietate vedeți actul. Capitolul [[links]] le arată pe toate.

Fiecare obiect are un cod de sistem care spune ce fel de obiect este: **PPERS** pentru o persoană fizică, **JPERS** pentru o persoană juridică, **PROP** pentru o proprietate și **DOC** pentru un act.

## 1.3 Ce este o versiune {#intro-versions}

De fiecare dată când salvați un obiect, arhiva păstrează o versiune nouă a lui și o lasă neatinsă pe cea dinainte. Vă puteți întoarce oricând la o versiune mai veche, o puteți citi și, dacă e nevoie, o puteți face din nou curentă. Nimic din ce s-a salvat nu se pierde; secțiunea [[links-versions]] arată cum.

## 1.4 Cum se citește acest manual {#intro-how-to-read}

Capitolul [[start]] vă duce prin ce este comun tuturor ecranelor: conectarea, bara laterală, listele, fișele unui obiect și ajutorul. Capitolele [[persons]]–[[admin]] iau pe rând fiecare parte a aplicației, în ordinea din bara laterală, iar capitolul [[learning]] arată cum vă verificați și vă dezvoltați cunoștințele.

Capitolele, secțiunile și figurile sunt numerotate, așa că o trimitere ca „secțiunea 2.5” sau „Figura 2.3” se găsește după număr, în cuprins. Fiecare capitol se încheie cu exemple și cazuri de utilizare: sarcini obișnuite, pas cu pas.

Numele butoanelor, ale câmpurilor și ale ecranelor sunt scrise între ghilimele, așa cum apar în aplicație: „Adaugă nou”, „Câmpuri afișate”, „Legături”.

## 1.5 Exemple {#intro-examples}

- **Tot ce ține de o parcelă.** Deschideți proprietatea și citiți fișa „Legături”: acolo sunt proprietarii, actele și parcelele legate de ea.
- **Ce s-a schimbat la o persoană.** Pe ecranul persoanei, mergeți înapoi printre versiuni: fiecare salvare este una dintre ele.
- **Ce s-a lucrat azi.** Pe tabloul de bord, „Activitate recentă” arată ultimele obiecte atinse.
`;
