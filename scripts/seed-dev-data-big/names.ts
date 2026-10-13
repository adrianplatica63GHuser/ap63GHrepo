/**
 * Invented Romanian names, places, streets and occupations for the big dev seed.   (Slice #39.20)
 *
 * PURE DATA. Common first names and surnames, combined at random — no name is copied from the archive
 * (C:\dev\.claude\rules\capture-and-personal-data.md). Places carry the CNP county code a person born
 * there gets, so a CNP's county agrees with the place of birth.
 */

/** First names by the decade they were common in, oldest first. */
export const FIRST_NAMES: Record<"MALE" | "FEMALE", readonly { from: number; names: readonly string[] }[]> = {
  MALE: [
    { from: 1900, names: ["Gheorghe", "Ion", "Vasile", "Constantin", "Nicolae", "Dumitru", "Marin", "Stan", "Ilie", "Petre", "Florea", "Tudor", "Niculae", "Stoica", "Radu"] },
    { from: 1930, names: ["Gheorghe", "Ion", "Constantin", "Nicolae", "Dumitru", "Vasile", "Mihai", "Alexandru", "Marin", "Aurel", "Victor", "Florea", "Petre", "Grigore", "Ștefan"] },
    { from: 1955, names: ["Mihai", "Florin", "Cristian", "Daniel", "Gabriel", "Marian", "Ion", "Nicolae", "Adrian", "Dorin", "Viorel", "Sorin", "Costel", "Valentin", "Liviu"] },
    { from: 1975, names: ["Andrei", "Alexandru", "Bogdan", "Răzvan", "Cătălin", "Ionuț", "Mihai", "Cristian", "Florin", "Marius", "Vlad", "Radu", "Ovidiu", "Lucian", "George"] },
    { from: 2000, names: ["Andrei", "David", "Luca", "Matei", "Ștefan", "Alexandru", "Darius", "Rareș", "Tudor", "Sebastian", "Mihai", "Eric", "Vlad", "Teodor", "Gabriel"] },
  ],
  FEMALE: [
    { from: 1900, names: ["Maria", "Ana", "Elena", "Ioana", "Florica", "Gherghina", "Paraschiva", "Marioara", "Floarea", "Stanca", "Ileana", "Smaranda", "Zoița", "Rada", "Tudora"] },
    { from: 1930, names: ["Maria", "Elena", "Ana", "Ioana", "Constanța", "Aurelia", "Victoria", "Floarea", "Ecaterina", "Georgeta", "Silvia", "Lucreția", "Viorica", "Marioara", "Niculina"] },
    { from: 1955, names: ["Mariana", "Daniela", "Gabriela", "Elena", "Mihaela", "Cristina", "Rodica", "Carmen", "Luminița", "Doina", "Camelia", "Adriana", "Monica", "Simona", "Liliana"] },
    { from: 1975, names: ["Andreea", "Alina", "Ioana", "Elena", "Raluca", "Roxana", "Mihaela", "Cristina", "Diana", "Oana", "Bianca", "Alexandra", "Irina", "Laura", "Ramona"] },
    { from: 2000, names: ["Maria", "Ioana", "Sofia", "Elena", "Ana", "Daria", "Eva", "Alesia", "Antonia", "Bianca", "Ilinca", "Natalia", "Carla", "Erika", "Teodora"] },
  ],
};

export function firstNamesFor(sex: "MALE" | "FEMALE", birthYear: number): readonly string[] {
  const eras = FIRST_NAMES[sex];
  let names = eras[0].names;
  for (const e of eras) if (birthYear >= e.from) names = e.names;
  return names;
}

export const SURNAMES: readonly string[] = [
  "Popescu", "Ionescu", "Dumitrescu", "Stan", "Stoica", "Gheorghe", "Matei", "Ciobanu", "Constantin", "Dinu",
  "Marin", "Radu", "Tudor", "Dobre", "Barbu", "Nistor", "Florea", "Ene", "Dragomir", "Toma",
  "Neagu", "Preda", "Vasile", "Mihai", "Lazăr", "Badea", "Oprea", "Sandu", "Voicu", "Cristea",
  "Moldovan", "Iordache", "Anghel", "Pană", "Niculae", "Manole", "Răducanu", "Stănescu", "Costache", "Ilie",
  "Nedelcu", "Paraschiv", "Rotaru", "Sima", "Zamfir", "Bălan", "Chiriac", "Grigore", "Tănase", "Vlad",
  "Mocanu", "Ungureanu", "Enache", "Petrescu", "Diaconu", "Militaru", "Cojocaru", "Năstase", "Bucur", "Udrea",
];

/** A place of birth: the label written on the person, and the CNP county code it gives. */
export type Place = { label: string; county: string };

/** Villages and towns around Bragadiru — where most of the older generations were born. */
export const PLACES_NEAR: readonly Place[] = [
  { label: "Bragadiru, jud. Ilfov", county: "23" },
  { label: "Bragadiru, jud. Ilfov", county: "23" },
  { label: "Bragadiru, jud. Ilfov", county: "23" },
  { label: "Cornetu, jud. Ilfov", county: "23" },
  { label: "Măgurele, jud. Ilfov", county: "23" },
  { label: "Clinceni, jud. Ilfov", county: "23" },
  { label: "Domnești, jud. Ilfov", county: "23" },
  { label: "Jilava, jud. Ilfov", county: "23" },
  { label: "Văleni, com. Cornetu, jud. Ilfov", county: "23" },
];

/** București, by sector — sector N has CNP county code 40 + N. */
export const PLACES_BUCURESTI: readonly Place[] = [1, 2, 3, 4, 5, 5, 6, 6].map((n) => ({
  label: `București, sector ${n}`,
  county: String(40 + n),
}));

/** Further away — people who moved to Bragadiru, or married into its families. */
export const PLACES_FAR: readonly Place[] = [
  { label: "Alexandria, jud. Teleorman", county: "34" },
  { label: "Videle, jud. Teleorman", county: "34" },
  { label: "Roșiorii de Vede, jud. Teleorman", county: "34" },
  { label: "Ploiești, jud. Prahova", county: "29" },
  { label: "Pitești, jud. Argeș", county: "03" },
  { label: "Târgoviște, jud. Dâmbovița", county: "15" },
  { label: "Craiova, jud. Dolj", county: "16" },
  { label: "Slatina, jud. Olt", county: "28" },
  { label: "Buzău, jud. Buzău", county: "10" },
  { label: "Constanța, jud. Constanța", county: "13" },
  { label: "Iași, jud. Iași", county: "22" },
  { label: "Cluj-Napoca, jud. Cluj", county: "12" },
  { label: "Brașov, jud. Brașov", county: "08" },
  { label: "Urziceni, jud. Ialomița", county: "21" },
];

/** Where people live: locality, county, postal code, and streets of that locality. */
export type Locality = { locality: string; county: string; postalCode: string; streets: readonly string[] };

export const LOCALITIES: readonly Locality[] = [
  {
    locality: "Bragadiru", county: "Ilfov", postalCode: "077025",
    streets: ["Str. Independenței", "Str. Haiducului", "Str. Leordeni", "Str. Gării", "Str. Mihai Eminescu", "Str. Viilor", "Str. Livezii", "Str. Fermei", "Str. Gheorghe Șincai", "Str. Primăverii", "Str. Teilor", "Str. Salcâmilor", "Str. Unirii", "Str. Libertății", "Str. Trandafirilor", "Str. Ciprian Porumbescu", "Str. Aleea Florilor", "Prelungirea Ghencea", "Șos. Alexandriei", "Str. Cornetu"],
  },
  { locality: "Cornetu", county: "Ilfov", postalCode: "077065", streets: ["Str. Principală", "Str. Școlii", "Str. Bisericii", "Str. Morii", "Str. Pădurii"] },
  { locality: "Măgurele", county: "Ilfov", postalCode: "077125", streets: ["Str. Atomiștilor", "Str. Fizicienilor", "Str. Livezii", "Str. Sabarului"] },
  { locality: "Clinceni", county: "Ilfov", postalCode: "077060", streets: ["Str. Mihai Viteazu", "Str. Argeșului", "Str. Lacului", "Str. Florilor"] },
  { locality: "Domnești", county: "Ilfov", postalCode: "077090", streets: ["Str. Codrului", "Str. Teilor", "Str. Ciorogârla"] },
  { locality: "Jilava", county: "Ilfov", postalCode: "077120", streets: ["Str. Giurgiului", "Str. Sabarului", "Str. Morii"] },
  { locality: "București", county: "București", postalCode: "051755", streets: ["Șos. Alexandriei", "Str. Antiaeriană", "Bd. Ghencea", "Calea Rahovei", "Str. Sebastian"] },
];

/** Weights for where a household lives: mostly Bragadiru, then the villages around it. */
export const LOCALITY_WEIGHTS: readonly (readonly [number, number])[] = [
  [0, 60], [1, 9], [2, 8], [3, 7], [4, 5], [5, 5], [6, 6],
];

/** What a grown person did for a living, by era and sex — the notes say something true-sounding about them. */
export const OCCUPATIONS: Record<"old" | "mid" | "young", Record<"MALE" | "FEMALE", readonly string[]>> = {
  old: {
    MALE: ["agricultor în Bragadiru", "fierar în satul natal", "lucrător la CAP Bragadiru", "învățător la școala din sat", "morar la moara de pe Sabar", "cărăuș cu căruța la târgul din București", "zidar în echipele de construcții din Ilfov", "paznic la ferma de stat Bragadiru", "preot în parohia din sat", "tâmplar cu atelier propriu"],
    FEMALE: ["casnică, a crescut copiii și a lucrat pământul", "croitoreasă în sat", "lucrătoare la CAP Bragadiru", "învățătoare la școala din sat", "țesătoare, cunoscută pentru covoarele ei", "vânzătoare la cooperativa din sat", "moașă în comună", "lucrătoare la grădina de legume a fermei"],
  },
  mid: {
    MALE: ["mecanic auto la IRTA Bragadiru", "inginer agronom", "șofer de autobuz la ITB", "strungar la uzina din Militari", "profesor de matematică", "electrician", "medic de familie în Bragadiru", "contabil la o fabrică din București", "maistru constructor", "polițist local", "notar public", "expert cadastral autorizat", "avocat în Baroul Ilfov"],
    FEMALE: ["asistentă medicală", "profesoară de limba română", "economistă la o bancă", "contabilă", "educatoare la grădinița din Bragadiru", "funcționară la Primăria Bragadiru", "farmacistă", "vânzătoare", "tehniciană într-un laborator din Măgurele", "medic stomatolog", "notar public", "avocată în Baroul Ilfov", "secretară la școala generală"],
  },
  young: {
    MALE: ["programator la o firmă din București", "antreprenor în construcții", "inginer în Măgurele", "agent imobiliar în Bragadiru", "electrician pe cont propriu", "curier", "bucătar", "consultant IT", "fizician la institutul din Măgurele", "agent de vânzări"],
    FEMALE: ["designer grafic", "medic rezident", "farmacistă", "contabilă pe cont propriu", "manager de proiect", "profesoară de engleză", "arhitectă", "psiholog", "agent imobiliar", "cercetătoare la institutul din Măgurele"],
  },
};

/** What a person between 19 and 25 is studying — „Studentă la Drept". */
export const STUDIES: Record<"MALE" | "FEMALE", readonly string[]> = {
  MALE: ["Student la Politehnică", "Student la Facultatea de Fizică din Măgurele", "Student la ASE", "Student la Agronomie"],
  FEMALE: ["Studentă la Drept", "Studentă la Medicină", "Studentă la Litere", "Studentă la Arhitectură"],
};

/** One more thing worth saying about a person, so the notes are not only a job title. */
export const TRAITS: readonly string[] = [
  "Cunoaște bine istoria terenurilor familiei.",
  "Păstrează actele vechi ale familiei într-un dosar.",
  "Ține legătura cu toate rudele din Bragadiru.",
  "Este persoana de contact a familiei pentru acte.",
  "A participat la ieșirile în teren pentru măsurători.",
  "Preferă să fie sunat după-amiaza.",
  "Vine des la biroul notarial pentru declarații.",
  "Are o grădină mare în spatele casei.",
  "Răspunde repede la e-mailuri.",
];
