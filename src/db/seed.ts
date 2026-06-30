/**
 * Seed script — natural persons + land properties around Bragadiru.
 *
 * Run via `npm run db:seed`. Each domain object has its own idempotency
 * check: if the table already has rows it skips that section and moves on.
 * To re-seed from scratch, run: TRUNCATE person, property CASCADE;
 */

import { eq, sql } from "drizzle-orm";
import { db, pool } from "./index";
import {
  address,
  document,
  judicialPerson,
  lookupDocumentType,
  lookupJudicialPersonType,
  naturalPerson,
  person,
  principalObject,
  property,
  propertyAddress,
  propertyCorner,
} from "./schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AddressKind = "HOME" | "POSTAL" | "HEADQUARTERS" | "CORRESPONDENCE";
type Gender = "MALE" | "FEMALE";
type IdDocType = "ID_CARD" | "PASSPORT";

type SeedAddress = {
  kind: AddressKind;
  streetLine?: string;
  postalCode?: string;
  locality?: string;
  county?: string;
  country: string;
  notes?: string;
};

type SeedPersonRow = {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  cnp?: string;
  idDocumentType?: IdDocType;
  idDocumentNumber?: string;
  gender?: Gender;
  dateOfBirth?: string;
  personalPhone1?: string;
  personalPhone2?: string;
  workPhone?: string;
  personalEmail1?: string;
  personalEmail2?: string;
  workEmail?: string;
  notes?: string;
  addresses?: SeedAddress[];
};

type SeedCorner = { lat: number; lon: number };

type SeedPropertyRow = {
  nickname?: string;
  tarlaSola?: string;
  parcela?: string;
  cadastralNumber?: string;
  carteFunciara?: string;
  surfaceAreaMp?: string;
  notes?: string;
  address?: {
    streetLine?: string;
    postalCode?: string;
    locality?: string;
    county?: string;
    country: string;
    notes?: string;
  };
  corners: SeedCorner[];
};

// ---------------------------------------------------------------------------
// Person seed data (unchanged from Slice #1)
// ---------------------------------------------------------------------------

const PERSONS: SeedPersonRow[] = [
  {
    firstName: "Adrian", lastName: "Popescu",
    cnp: "1850203401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX123456",
    gender: "MALE", dateOfBirth: "1985-02-03",
    personalEmail1: "adrian.popescu@example.ro", personalPhone1: "+40712345001",
    workEmail: "a.popescu@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Strada Florilor 12, Bl. A1, Sc. 1, Ap. 5", postalCode: "010101", locality: "Bucuresti", county: "Sector 1", country: "Romania" }],
  },
  {
    firstName: "Maria", lastName: "Ionescu", nickname: "Mara",
    cnp: "2920714125678", idDocumentType: "ID_CARD", idDocumentNumber: "CJ234567",
    gender: "FEMALE", dateOfBirth: "1992-07-14",
    personalEmail1: "maria.ionescu@example.ro", personalPhone1: "+40712345002",
    addresses: [
      { kind: "HOME", streetLine: "Bulevardul Eroilor 45", postalCode: "400089", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "C.P. 234, OP 5", postalCode: "400500", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
    ],
  },
  {
    firstName: "Andrei", lastName: "Stoica",
    cnp: "1781122401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX345678",
    gender: "MALE", dateOfBirth: "1978-11-22",
    personalPhone1: "+40712345003", workPhone: "+40212345003", workEmail: "andrei.stoica@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Calea Victoriei 100, Et. 4, Ap. 12", postalCode: "010091", locality: "Bucuresti", county: "Sector 1", country: "Romania" }],
  },
  {
    firstName: "Elena", lastName: "Marinescu",
    cnp: "2650408355678", idDocumentType: "ID_CARD", idDocumentNumber: "TM456789",
    gender: "FEMALE", dateOfBirth: "1965-04-08",
    personalEmail1: "elena.marinescu@example.ro", personalPhone1: "+40712345004",
    addresses: [{ kind: "HOME", streetLine: "Strada Mihai Viteazu 23", postalCode: "300222", locality: "Timisoara", county: "Timis", country: "Romania" }],
  },
  {
    firstName: "Cristian", lastName: "Popa",
    cnp: "1900125225678", idDocumentType: "ID_CARD", idDocumentNumber: "IS567890",
    gender: "MALE", dateOfBirth: "1990-01-25",
    personalEmail1: "cristian.popa@example.ro", personalEmail2: "cris.popa.alt@example.ro",
    personalPhone1: "+40712345005", workEmail: "c.popa@firma.ro",
    notes: "Prefers contact via email.",
    addresses: [{ kind: "HOME", streetLine: "Strada Lascar Catargi 17", postalCode: "700107", locality: "Iasi", county: "Iasi", country: "Romania" }],
  },
  {
    firstName: "Ioana", lastName: "Constantinescu",
    cnp: "2880930451234", idDocumentType: "ID_CARD", idDocumentNumber: "RX678901",
    gender: "FEMALE", dateOfBirth: "1988-09-30",
    personalEmail1: "ioana.constantinescu@example.ro", personalPhone1: "+40712345006", personalPhone2: "+40712345016",
    addresses: [
      { kind: "HOME", streetLine: "Aleea Castanilor 8", postalCode: "021234", locality: "Bucuresti", county: "Sector 2", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "Str. Dorobanti 200, Ap. 33", postalCode: "010573", locality: "Bucuresti", county: "Sector 1", country: "Romania" },
    ],
  },
  {
    firstName: "Mihai", lastName: "Stan",
    cnp: "1720615081234", idDocumentType: "ID_CARD", idDocumentNumber: "BV789012",
    gender: "MALE", dateOfBirth: "1972-06-15",
    personalPhone1: "+40712345007", workEmail: "mihai.stan@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Strada Republicii 45", postalCode: "500030", locality: "Brasov", county: "Brasov", country: "Romania" }],
  },
  {
    firstName: "Andreea", lastName: "Dumitrescu", nickname: "Deea",
    cnp: "2950312141234", idDocumentType: "PASSPORT", idDocumentNumber: "P00123456",
    gender: "FEMALE", dateOfBirth: "1995-03-12",
    personalEmail1: "andreea.dumitrescu@example.ro", personalPhone1: "+40712345008",
    addresses: [{ kind: "HOME", streetLine: "Bulevardul Mamaia 102", postalCode: "900527", locality: "Constanta", county: "Constanta", country: "Romania" }],
  },
  {
    firstName: "Alexandru", lastName: "Munteanu",
    cnp: "1830819401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX890123",
    gender: "MALE", dateOfBirth: "1983-08-19",
    personalEmail1: "alexandru.munteanu@example.ro", personalPhone1: "+40712345009",
    workPhone: "+40212345009", workEmail: "alex.munteanu@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Splaiul Independentei 290", postalCode: "060031", locality: "Bucuresti", county: "Sector 6", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "OP 60 CP 100", postalCode: "060500", locality: "Bucuresti", county: "Sector 6", country: "Romania" },
    ],
  },
  {
    firstName: "Cristina", lastName: "Radulescu",
    cnp: "2801204291234", idDocumentType: "ID_CARD", idDocumentNumber: "PH901234",
    gender: "FEMALE", dateOfBirth: "1980-12-04",
    personalEmail1: "cristina.radulescu@example.ro", personalPhone1: "+40712345010",
    addresses: [{ kind: "HOME", streetLine: "Strada Plevnei 28", postalCode: "100130", locality: "Ploiesti", county: "Prahova", country: "Romania" }],
  },
  {
    firstName: "Bogdan", lastName: "Georgescu",
    cnp: "1680527171234", idDocumentType: "ID_CARD", idDocumentNumber: "GL012345",
    gender: "MALE", dateOfBirth: "1968-05-27",
    personalPhone1: "+40712345011", workPhone: "+40236345011",
    addresses: [{ kind: "HOME", streetLine: "Strada Domneasca 45", postalCode: "800211", locality: "Galati", county: "Galati", country: "Romania" }],
  },
  {
    firstName: "Monica", lastName: "Florescu",
    cnp: "2911011321234", idDocumentType: "ID_CARD", idDocumentNumber: "SB123456",
    gender: "FEMALE", dateOfBirth: "1991-10-11",
    personalEmail1: "monica.florescu@example.ro", personalPhone1: "+40712345012",
    addresses: [{ kind: "HOME", streetLine: "Strada Mitropoliei 14", postalCode: "550179", locality: "Sibiu", county: "Sibiu", country: "Romania" }],
  },
  {
    firstName: "Daniel", lastName: "Diaconu",
    cnp: "1860218121234", idDocumentType: "ID_CARD", idDocumentNumber: "CJ234568",
    gender: "MALE", dateOfBirth: "1986-02-18",
    personalEmail1: "daniel.diaconu@example.ro", personalEmail2: "ddiaconu@gmail.com",
    personalPhone1: "+40712345013", workEmail: "d.diaconu@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Strada Memorandumului 28", postalCode: "400114", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" }],
  },
  {
    firstName: "Alina", lastName: "Ungureanu",
    cnp: "2930729051234", idDocumentType: "PASSPORT", idDocumentNumber: "P00234567",
    gender: "FEMALE", dateOfBirth: "1993-07-29",
    personalEmail1: "alina.ungureanu@example.ro", personalPhone1: "+40712345014",
    addresses: [
      { kind: "HOME", streetLine: "Strada Republicii 12", postalCode: "410167", locality: "Oradea", county: "Bihor", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "OP Oradea CP 88", postalCode: "410500", locality: "Oradea", county: "Bihor", country: "Romania" },
    ],
  },
  {
    firstName: "George", lastName: "Stoicescu",
    cnp: "1750403401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX345679",
    gender: "MALE", dateOfBirth: "1975-04-03",
    personalEmail1: "george.stoicescu@example.ro", personalPhone1: "+40712345015",
    workPhone: "+40212345015", workEmail: "g.stoicescu@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Bulevardul Unirii 60", postalCode: "030828", locality: "Bucuresti", county: "Sector 3", country: "Romania" }],
  },
  {
    firstName: "Simona", lastName: "Vasilescu",
    cnp: "2821117401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX456789",
    gender: "FEMALE", dateOfBirth: "1982-11-17",
    personalEmail1: "simona.vasilescu@example.ro", personalPhone1: "+40712345016",
    addresses: [{ kind: "HOME", streetLine: "Strada Aviatorilor 8, Ap. 2", postalCode: "011854", locality: "Bucuresti", county: "Sector 1", country: "Romania" }],
  },
  {
    firstName: "Vlad", lastName: "Tudor",
    cnp: "1700908351234", idDocumentType: "PASSPORT", idDocumentNumber: "P00345678",
    gender: "MALE", dateOfBirth: "1970-09-08",
    personalPhone1: "+40712345017", workEmail: "vlad.tudor@firma.ro",
    notes: "Frequent traveller; prefers passport for ID.",
    addresses: [{ kind: "HOME", streetLine: "Strada Eugeniu de Savoya 3", postalCode: "300087", locality: "Timisoara", county: "Timis", country: "Romania" }],
  },
  {
    firstName: "Mihaela", lastName: "Andreescu", nickname: "Mia",
    cnp: "2960622221234", idDocumentType: "ID_CARD", idDocumentNumber: "IS567891",
    gender: "FEMALE", dateOfBirth: "1996-06-22",
    personalEmail1: "mihaela.andreescu@example.ro", personalPhone1: "+40712345018",
    addresses: [{ kind: "HOME", streetLine: "Strada Sararie 56", postalCode: "700451", locality: "Iasi", county: "Iasi", country: "Romania" }],
  },
  {
    firstName: "Lucian", lastName: "Iliescu",
    idDocumentType: "PASSPORT", idDocumentNumber: "P00456789",
    gender: "MALE", dateOfBirth: "1979-12-10",
    personalEmail1: "lucian.iliescu@example.com", personalPhone1: "+40712345019",
    notes: "Foreign-resident citizen; CNP not yet recorded.",
    addresses: [{ kind: "HOME", streetLine: "Strada Castelului 23", postalCode: "500014", locality: "Brasov", county: "Brasov", country: "Romania" }],
  },
  {
    lastName: "Mitrea", nickname: "Diana M.",
    cnp: "2890326141234", idDocumentType: "ID_CARD", idDocumentNumber: "CT678901",
    gender: "FEMALE", dateOfBirth: "1989-03-26",
    personalPhone1: "+40712345020",
    notes: "First name pending confirmation.",
    addresses: [{ kind: "HOME", streetLine: "Bulevardul Tomis 88", postalCode: "900663", locality: "Constanta", county: "Constanta", country: "Romania" }],
  },
  {
    firstName: "Razvan", lastName: "Gheorghe",
    cnp: "1871214401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX456790",
    gender: "MALE", dateOfBirth: "1987-12-14",
    personalPhone1: "+40712345021", workEmail: "razvan.gheorghe@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Strada Libertatii 33", postalCode: "030015", locality: "Bucuresti", county: "Sector 3", country: "Romania" }],
  },
  {
    firstName: "Catalina", lastName: "Petre",
    cnp: "2940508221234", idDocumentType: "ID_CARD", idDocumentNumber: "DJ123456",
    gender: "FEMALE", dateOfBirth: "1994-05-08",
    personalEmail1: "catalina.petre@example.ro", personalPhone1: "+40712345022",
    addresses: [{ kind: "HOME", streetLine: "Strada Unirii 15", postalCode: "200580", locality: "Craiova", county: "Dolj", country: "Romania" }],
  },
  {
    firstName: "Sorin", lastName: "Barbu",
    cnp: "1810331401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX567890",
    gender: "MALE", dateOfBirth: "1981-03-31",
    personalPhone1: "+40712345023", personalPhone2: "+40722345023",
    workEmail: "sorin.barbu@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Calea Grivitei 120, Ap. 7", postalCode: "010705", locality: "Bucuresti", county: "Sector 1", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "CP 1, OP 10", postalCode: "010900", locality: "Bucuresti", county: "Sector 1", country: "Romania" },
    ],
  },
  {
    firstName: "Roxana", lastName: "Niculescu",
    cnp: "2971125051234", idDocumentType: "PASSPORT", idDocumentNumber: "P00567890",
    gender: "FEMALE", dateOfBirth: "1997-11-25",
    personalEmail1: "roxana.niculescu@example.ro", personalPhone1: "+40712345024",
    notes: "Recently relocated; correspondence address TBD.",
    addresses: [{ kind: "HOME", streetLine: "Strada Pacii 7", postalCode: "500003", locality: "Brasov", county: "Brasov", country: "Romania" }],
  },
  {
    firstName: "Florin", lastName: "Costea",
    cnp: "1760209291234", idDocumentType: "ID_CARD", idDocumentNumber: "PH012345",
    gender: "MALE", dateOfBirth: "1976-02-09",
    personalEmail1: "florin.costea@example.ro", personalPhone1: "+40712345025",
    workPhone: "+40244345025", workEmail: "f.costea@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Strada Democratiei 4", postalCode: "100013", locality: "Ploiesti", county: "Prahova", country: "Romania" }],
  },
  {
    firstName: "Diana", lastName: "Rusu",
    cnp: "2900414181234", idDocumentType: "ID_CARD", idDocumentNumber: "BC234567",
    gender: "FEMALE", dateOfBirth: "1990-04-14",
    personalEmail1: "diana.rusu@example.ro", personalPhone1: "+40712345026",
    addresses: [{ kind: "HOME", streetLine: "Strada Stefan cel Mare 55", postalCode: "600001", locality: "Bacau", county: "Bacau", country: "Romania" }],
  },
  {
    firstName: "Valentin", lastName: "Mocanu",
    cnp: "1840717401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX678902",
    gender: "MALE", dateOfBirth: "1984-07-17",
    personalPhone1: "+40712345027", workEmail: "valentin.mocanu@firma.ro",
    addresses: [{ kind: "HOME", streetLine: "Aleea Trandafirilor 2", postalCode: "021345", locality: "Bucuresti", county: "Sector 2", country: "Romania" }],
  },
  {
    firstName: "Laura", lastName: "Tudorache", nickname: "Lau",
    cnp: "2860923401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX789012",
    gender: "FEMALE", dateOfBirth: "1986-09-23",
    personalEmail1: "laura.tudorache@example.ro", personalEmail2: "l.tudorache.alt@gmail.com",
    personalPhone1: "+40712345028",
    addresses: [{ kind: "HOME", streetLine: "Strada Luterana 6", postalCode: "010161", locality: "Bucuresti", county: "Sector 1", country: "Romania" }],
  },
  {
    firstName: "Radu", lastName: "Cristea",
    cnp: "1930601401234", idDocumentType: "ID_CARD", idDocumentNumber: "RX890124",
    gender: "MALE", dateOfBirth: "1993-06-01",
    personalPhone1: "+40712345029", workEmail: "radu.cristea@firma.ro",
    notes: "Works remotely; best reached by email.",
    addresses: [{ kind: "HOME", streetLine: "Strada Academiei 18", postalCode: "010014", locality: "Bucuresti", county: "Sector 1", country: "Romania" }],
  },
  {
    firstName: "Gabriela", lastName: "Oprea",
    cnp: "2830809041234", idDocumentType: "ID_CARD", idDocumentNumber: "AG345678",
    gender: "FEMALE", dateOfBirth: "1983-08-09",
    personalEmail1: "gabriela.oprea@example.ro", personalPhone1: "+40712345030",
    addresses: [{ kind: "HOME", streetLine: "Strada Victoriei 22", postalCode: "110006", locality: "Pitesti", county: "Arges", country: "Romania" }],
  },
];

// ---------------------------------------------------------------------------
// Property seed data — 20 land parcels around Bragadiru, Ilfov
//
// All coordinates are WGS84 decimal degrees (ETRS89).
// Corners are listed in clockwise order as viewed on a standard north-up map.
// Surface areas are approximate (computed from the corner geometry).
// Cadastral numbers follow the Romanian format: county-tarla-parcela.
// ---------------------------------------------------------------------------

const PROPERTIES: SeedPropertyRow[] = [
  {
    nickname: "Lot 1 - Str. Principala",
    tarlaSola: "T12", parcela: "P234/1",
    cadastralNumber: "23-12-234/1", carteFunciara: "CF10234",
    surfaceAreaMp: "512.00",
    notes: "Rectangular residential plot, access from Strada Principala.",
    address: { streetLine: "Strada Principala 14", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41520, lon: 25.96830 },
      { lat: 44.41520, lon: 25.96886 },
      { lat: 44.41474, lon: 25.96885 },
      { lat: 44.41475, lon: 25.96831 },
    ],
  },
  {
    nickname: "Lot 2 - Str. Livezilor",
    tarlaSola: "T12", parcela: "P235",
    cadastralNumber: "23-12-235", carteFunciara: "CF10235",
    surfaceAreaMp: "621.00",
    address: { streetLine: "Strada Livezilor 3", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41380, lon: 25.97120 },
      { lat: 44.41380, lon: 25.97190 },
      { lat: 44.41323, lon: 25.97189 },
      { lat: 44.41324, lon: 25.97121 },
    ],
  },
  {
    nickname: "Lot 3 - Str. Florilor",
    tarlaSola: "T11", parcela: "P198",
    cadastralNumber: "23-11-198", carteFunciara: "CF10198",
    surfaceAreaMp: "480.00",
    address: { streetLine: "Strada Florilor 7", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41600, lon: 25.96680 },
      { lat: 44.41600, lon: 25.96734 },
      { lat: 44.41557, lon: 25.96733 },
      { lat: 44.41558, lon: 25.96681 },
    ],
  },
  {
    nickname: "Teren agricol T14",
    tarlaSola: "T14", parcela: "P301",
    cadastralNumber: "23-14-301",
    surfaceAreaMp: "8450.00",
    notes: "Agricultural parcel, no access road registered.",
    corners: [
      { lat: 44.41250, lon: 25.96850 },
      { lat: 44.41250, lon: 25.97010 },
      { lat: 44.41174, lon: 25.97008 },
      { lat: 44.41175, lon: 25.96852 },
    ],
  },
  {
    nickname: "Lot 5 - Str. Mihai Eminescu",
    tarlaSola: "T12", parcela: "P236",
    cadastralNumber: "23-12-236", carteFunciara: "CF10236",
    surfaceAreaMp: "550.00",
    address: { streetLine: "Strada Mihai Eminescu 8", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41485, lon: 25.97020 },
      { lat: 44.41485, lon: 25.97082 },
      { lat: 44.41435, lon: 25.97081 },
      { lat: 44.41436, lon: 25.97021 },
    ],
  },
  {
    nickname: "Lot 6 - Str. Tineretului",
    tarlaSola: "T13", parcela: "P267",
    cadastralNumber: "23-13-267", carteFunciara: "CF10267",
    surfaceAreaMp: "710.00",
    address: { streetLine: "Strada Tineretului 2", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41620, lon: 25.97200 },
      { lat: 44.41621, lon: 25.97279 },
      { lat: 44.41557, lon: 25.97278 },
      { lat: 44.41556, lon: 25.97201 },
    ],
  },
  {
    nickname: "Teren agricol T10",
    tarlaSola: "T10", parcela: "P182",
    cadastralNumber: "23-10-182",
    surfaceAreaMp: "12300.00",
    notes: "Large agricultural parcel with irregular boundary.",
    corners: [
      { lat: 44.41330, lon: 25.96500 },
      { lat: 44.41332, lon: 25.96640 },
      { lat: 44.41260, lon: 25.96641 },
      { lat: 44.41245, lon: 25.96570 },
      { lat: 44.41258, lon: 25.96499 },
    ],
  },
  {
    nickname: "Lot 8 - Str. Violetelor",
    tarlaSola: "T13", parcela: "P268",
    cadastralNumber: "23-13-268", carteFunciara: "CF10268",
    surfaceAreaMp: "495.00",
    address: { streetLine: "Strada Violetelor 6", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41600, lon: 25.97350 },
      { lat: 44.41600, lon: 25.97405 },
      { lat: 44.41555, lon: 25.97404 },
      { lat: 44.41556, lon: 25.97351 },
    ],
  },
  {
    nickname: "Lot 9 - Str. Merilor",
    tarlaSola: "T13", parcela: "P270",
    cadastralNumber: "23-13-270", carteFunciara: "CF10270",
    surfaceAreaMp: "580.00",
    address: { streetLine: "Strada Merilor 22", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41420, lon: 25.97520 },
      { lat: 44.41421, lon: 25.97585 },
      { lat: 44.41368, lon: 25.97584 },
      { lat: 44.41368, lon: 25.97521 },
    ],
  },
  {
    nickname: "Teren agricol T9",
    tarlaSola: "T9", parcela: "P155",
    cadastralNumber: "23-09-155",
    surfaceAreaMp: "6200.00",
    notes: "Pasture land, partially fenced.",
    corners: [
      { lat: 44.41180, lon: 25.96700 },
      { lat: 44.41180, lon: 25.96812 },
      { lat: 44.41124, lon: 25.96811 },
      { lat: 44.41125, lon: 25.96701 },
    ],
  },
  {
    nickname: "Lot 11 - Str. Campului",
    tarlaSola: "T15", parcela: "P318",
    cadastralNumber: "23-15-318", carteFunciara: "CF10318",
    surfaceAreaMp: "430.00",
    address: { streetLine: "Strada Campului 4", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41750, lon: 25.96800 },
      { lat: 44.41750, lon: 25.96848 },
      { lat: 44.41711, lon: 25.96847 },
      { lat: 44.41712, lon: 25.96801 },
    ],
  },
  {
    nickname: "Lot 12 - Str. Gradinilor",
    tarlaSola: "T13", parcela: "P271",
    cadastralNumber: "23-13-271", carteFunciara: "CF10271",
    surfaceAreaMp: "660.00",
    address: { streetLine: "Strada Gradinilor 15", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41480, lon: 25.97680 },
      { lat: 44.41481, lon: 25.97754 },
      { lat: 44.41421, lon: 25.97753 },
      { lat: 44.41422, lon: 25.97681 },
    ],
  },
  {
    nickname: "Teren agricol T16",
    tarlaSola: "T16", parcela: "P340",
    cadastralNumber: "23-16-340",
    surfaceAreaMp: "9800.00",
    notes: "Arable land, registered crop history.",
    corners: [
      { lat: 44.41650, lon: 25.96450 },
      { lat: 44.41651, lon: 25.96630 },
      { lat: 44.41561, lon: 25.96629 },
      { lat: 44.41562, lon: 25.96451 },
    ],
  },
  {
    nickname: "Lot 14 - Str. Lalelelor",
    tarlaSola: "T12", parcela: "P240",
    cadastralNumber: "23-12-240", carteFunciara: "CF10240",
    surfaceAreaMp: "520.00",
    address: { streetLine: "Strada Lalelelor 9", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41500, lon: 25.96920 },
      { lat: 44.41500, lon: 25.96978 },
      { lat: 44.41453, lon: 25.96977 },
      { lat: 44.41454, lon: 25.96921 },
    ],
  },
  {
    nickname: "Lot 15 - Str. Stejarului",
    tarlaSola: "T11", parcela: "P200",
    cadastralNumber: "23-11-200", carteFunciara: "CF10200",
    surfaceAreaMp: "475.00",
    address: { streetLine: "Strada Stejarului 11", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41300, lon: 25.97300 },
      { lat: 44.41300, lon: 25.97353 },
      { lat: 44.41257, lon: 25.97352 },
      { lat: 44.41258, lon: 25.97301 },
    ],
  },
  {
    nickname: "Lot 16 - Bl. Nord",
    tarlaSola: "T15", parcela: "P320",
    cadastralNumber: "23-15-320", carteFunciara: "CF10320",
    surfaceAreaMp: "390.00",
    address: { streetLine: "Strada Nordului 5", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41800, lon: 25.97200 },
      { lat: 44.41800, lon: 25.97244 },
      { lat: 44.41764, lon: 25.97243 },
      { lat: 44.41765, lon: 25.97201 },
    ],
  },
  {
    nickname: "Teren agricol T8",
    tarlaSola: "T8", parcela: "P130",
    cadastralNumber: "23-08-130",
    surfaceAreaMp: "15400.00",
    notes: "Large pasture bordering the Sabar river.",
    corners: [
      { lat: 44.41120, lon: 25.97050 },
      { lat: 44.41122, lon: 25.97280 },
      { lat: 44.41010, lon: 25.97278 },
      { lat: 44.41011, lon: 25.97052 },
    ],
  },
  {
    nickname: "Lot 18 - Str. Rozelor",
    tarlaSola: "T13", parcela: "P275",
    cadastralNumber: "23-13-275", carteFunciara: "CF10275",
    surfaceAreaMp: "540.00",
    address: { streetLine: "Strada Rozelor 18", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41580, lon: 25.97780 },
      { lat: 44.41580, lon: 25.97841 },
      { lat: 44.41531, lon: 25.97840 },
      { lat: 44.41532, lon: 25.97781 },
    ],
  },
  {
    nickname: "Teren agricol T7 - vest",
    tarlaSola: "T7", parcela: "P112",
    cadastralNumber: "23-07-112",
    surfaceAreaMp: "7600.00",
    notes: "Partially drained agricultural parcel.",
    corners: [
      { lat: 44.41400, lon: 25.96300 },
      { lat: 44.41401, lon: 25.96440 },
      { lat: 44.41332, lon: 25.96439 },
      { lat: 44.41331, lon: 25.96301 },
    ],
  },
  {
    nickname: "Lot 20 - Str. Independentei",
    tarlaSola: "T15", parcela: "P322",
    cadastralNumber: "23-15-322", carteFunciara: "CF10322",
    surfaceAreaMp: "605.00",
    address: { streetLine: "Strada Independentei 3", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41850, lon: 25.97380 },
      { lat: 44.41851, lon: 25.97448 },
      { lat: 44.41796, lon: 25.97447 },
      { lat: 44.41797, lon: 25.97381 },
    ],
  },
  {
    nickname: "Lot 21 - Str. Teilor",
    tarlaSola: "T12", parcela: "P242",
    cadastralNumber: "23-12-242", carteFunciara: "CF10242",
    surfaceAreaMp: "530.00",
    address: { streetLine: "Strada Teilor 1", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41540, lon: 25.97080 },
      { lat: 44.41540, lon: 25.97139 },
      { lat: 44.41492, lon: 25.97138 },
      { lat: 44.41493, lon: 25.97081 },
    ],
  },
  {
    nickname: "Lot 22 - Str. Panselelor",
    tarlaSola: "T13", parcela: "P278",
    cadastralNumber: "23-13-278", carteFunciara: "CF10278",
    surfaceAreaMp: "490.00",
    address: { streetLine: "Strada Panselelor 9", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41560, lon: 25.97900 },
      { lat: 44.41560, lon: 25.97956 },
      { lat: 44.41516, lon: 25.97955 },
      { lat: 44.41517, lon: 25.97901 },
    ],
  },
  {
    nickname: "Teren agricol T6 - est",
    tarlaSola: "T6", parcela: "P98",
    cadastralNumber: "23-06-098",
    surfaceAreaMp: "11200.00",
    notes: "Former orchard parcel, partially cleared.",
    corners: [
      { lat: 44.41050, lon: 25.96600 },
      { lat: 44.41051, lon: 25.96800 },
      { lat: 44.40960, lon: 25.96799 },
      { lat: 44.40961, lon: 25.96601 },
    ],
  },
  {
    nickname: "Lot 24 - Str. Caisilor",
    tarlaSola: "T14", parcela: "P305",
    cadastralNumber: "23-14-305", carteFunciara: "CF10305",
    surfaceAreaMp: "560.00",
    address: { streetLine: "Strada Caisilor 5", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41200, lon: 25.97060 },
      { lat: 44.41200, lon: 25.97123 },
      { lat: 44.41149, lon: 25.97122 },
      { lat: 44.41150, lon: 25.97061 },
    ],
  },
  {
    nickname: "Lot 25 - Str. Prunilor",
    tarlaSola: "T11", parcela: "P203",
    cadastralNumber: "23-11-203", carteFunciara: "CF10203",
    surfaceAreaMp: "445.00",
    address: { streetLine: "Strada Prunilor 3", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41340, lon: 25.97410 },
      { lat: 44.41340, lon: 25.97460 },
      { lat: 44.41300, lon: 25.97459 },
      { lat: 44.41301, lon: 25.97411 },
    ],
  },
  {
    nickname: "Teren agricol T5 - nord",
    tarlaSola: "T5", parcela: "P77",
    cadastralNumber: "23-05-077",
    surfaceAreaMp: "18500.00",
    notes: "Wetland-adjacent parcel, seasonal flooding risk.",
    corners: [
      { lat: 44.40900, lon: 25.97100 },
      { lat: 44.40902, lon: 25.97400 },
      { lat: 44.40780, lon: 25.97398 },
      { lat: 44.40779, lon: 25.97102 },
    ],
  },
  {
    nickname: "Lot 27 - Str. Salcamilor",
    tarlaSola: "T15", parcela: "P325",
    cadastralNumber: "23-15-325", carteFunciara: "CF10325",
    surfaceAreaMp: "415.00",
    address: { streetLine: "Strada Salcamilor 11", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41870, lon: 25.97520 },
      { lat: 44.41870, lon: 25.97567 },
      { lat: 44.41833, lon: 25.97566 },
      { lat: 44.41834, lon: 25.97521 },
    ],
  },
  {
    nickname: "Lot 28 - Str. Brazilor",
    tarlaSola: "T16", parcela: "P343",
    cadastralNumber: "23-16-343", carteFunciara: "CF10343",
    surfaceAreaMp: "575.00",
    address: { streetLine: "Strada Brazilor 7", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41700, lon: 25.96380 },
      { lat: 44.41700, lon: 25.96444 },
      { lat: 44.41648, lon: 25.96443 },
      { lat: 44.41649, lon: 25.96381 },
    ],
  },
  {
    nickname: "Teren agricol T4 - vest",
    tarlaSola: "T4", parcela: "P58",
    cadastralNumber: "23-04-058",
    surfaceAreaMp: "8900.00",
    notes: "Arable land, last cultivated 2022.",
    corners: [
      { lat: 44.41600, lon: 25.96200 },
      { lat: 44.41601, lon: 25.96380 },
      { lat: 44.41520, lon: 25.96379 },
      { lat: 44.41519, lon: 25.96201 },
    ],
  },
  {
    nickname: "Lot 30 - Str. Chiparosilor",
    tarlaSola: "T13", parcela: "P280",
    cadastralNumber: "23-13-280", carteFunciara: "CF10280",
    surfaceAreaMp: "510.00",
    address: { streetLine: "Strada Chiparosilor 4", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41460, lon: 25.97960 },
      { lat: 44.41460, lon: 25.98018 },
      { lat: 44.41414, lon: 25.98017 },
      { lat: 44.41415, lon: 25.97961 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Document seed data — 5–6 records per type (98 rows total), Ilfov area
//
// `typeKey` below is a `lookup_document_type.key` slug, resolved to the
// actual uuid FK at insert time (see the seed loop). These keys must already
// exist in lookup_document_type (seeded by migration_020_rename_to_document.sql).
// ---------------------------------------------------------------------------

type DocumentTypeKey =
  | "ACT_ADJUDECARE" | "ACT_CADASTRU" | "ACT_DONATIE" | "AUTORIZATIE"
  | "AVIZ_INSTITUTIE" | "CERTIFICAT_FISCAL" | "CERTIFICAT_MOSTENITOR"
  | "CERTIFICAT_SARCINI" | "CERTIFICAT_URBANISM" | "CONTRACT_ARENDA"
  | "CONTRACT_INCHIRIERE" | "CONTRACT_PARTAJ" | "CONTRACT_PRESTARI_SERVICII"
  | "CONTRACT_VANZARE" | "EXTRAS_CARTE_FUNCIARA" | "EXTRAS_PUG"
  | "HOTARARE_JUDECATOREASCA" | "TESTAMENT" | "TITLU_PROPRIETATE";

type SeedDocumentRow = {
  typeKey: DocumentTypeKey;
  title?: string;
  nrDocument?: string;
  dateDocument?: string;
  institution?: string;
  emitent?: string;
  bazaLegala?: string;
  uatProprietate?: string;
  uatProprietar?: string;
  suprafata?: string;
  nrDosarSuccesoral?: string;
  dataDecesului?: string;
  ultimulDomiciliu?: string;
  nrCertificatDeces?: string;
  dateStart?: string;
  dateEnd?: string;
  titularText?: string;
  defunctText?: string;
  partiesAText?: string;
  partiesBText?: string;
  notes?: string;
};

const DOCUMENTS: SeedDocumentRow[] = [
  // ── ACT_ADJUDECARE ──────────────────────────────────────────────────────
  { typeKey: "ACT_ADJUDECARE", title: "Adjudecare Teren Snagov",    nrDocument: "1234/2019", dateDocument: "2019-04-12", institution: "Judecătoria Buftea",  notes: "Executare silită dosar 445/2018" },
  { typeKey: "ACT_ADJUDECARE", title: "Adjudecare Lot 3 Balotești", nrDocument: "887/2020",  dateDocument: "2020-09-03", institution: "Tribunalul Ilfov",     notes: "Vânzare la licitație publică" },
  { typeKey: "ACT_ADJUDECARE", title: "Adjudecare Casă Cornetu",    nrDocument: "2201/2021", dateDocument: "2021-02-17", institution: "Judecătoria Buftea" },
  { typeKey: "ACT_ADJUDECARE", title: "Adjudecare Teren Cernica",   nrDocument: "556/2022",  dateDocument: "2022-06-29", institution: "Tribunalul Ilfov",     notes: "Imobil adjudecat în urma executării" },
  { typeKey: "ACT_ADJUDECARE", title: "Adjudecare Parcelă Gruiu",   nrDocument: "310/2023",  dateDocument: "2023-11-08", institution: "Judecătoria Buftea" },
  // ── ACT_CADASTRU ────────────────────────────────────────────────────────
  { typeKey: "ACT_CADASTRU", title: "Cadastru Teren Voluntari",   nrDocument: "CAD-1002/2018", dateDocument: "2018-07-15", institution: "OCPI Ilfov", notes: "Prima intabulare" },
  { typeKey: "ACT_CADASTRU", title: "Cadastru Lot Nord Snagov",   nrDocument: "CAD-2314/2019", dateDocument: "2019-03-22", institution: "OCPI Ilfov" },
  { typeKey: "ACT_CADASTRU", title: "Cadastru Parcelă Brănești",  nrDocument: "CAD-0887/2020", dateDocument: "2020-10-05", institution: "OCPI Ilfov", notes: "Actualizare după dezmembrare" },
  { typeKey: "ACT_CADASTRU", title: "Cadastru Teren Afumați",     nrDocument: "CAD-3001/2021", dateDocument: "2021-05-18", institution: "OCPI Ilfov" },
  { typeKey: "ACT_CADASTRU", title: "Cadastru Lot Tunari",        nrDocument: "CAD-1455/2022", dateDocument: "2022-08-30", institution: "OCPI Ilfov", notes: "Intabulare după retrocedare" },
  // ── ACT_DONATIE ─────────────────────────────────────────────────────────
  { typeKey: "ACT_DONATIE", title: "Donație Teren Voluntari", nrDocument: "101/2017", dateDocument: "2017-06-10", institution: "Notariat Alexandru Dănilă", partiesAText: "Ion Popescu",        partiesBText: "Maria Popescu" },
  { typeKey: "ACT_DONATIE", title: "Donație Casă Snagov",     nrDocument: "215/2019", dateDocument: "2019-01-25", institution: "Notariat Ion Grigorescu",   partiesAText: "Elena Constantin",   partiesBText: "Andrei Constantin",       notes: "Imobil cu construcție" },
  { typeKey: "ACT_DONATIE", title: "Donație Lot Cernica",     nrDocument: "448/2020", dateDocument: "2020-07-14", institution: "Notariat Maria Florescu",   partiesAText: "Gheorghe Popa",      partiesBText: "Laura Popa, Sorin Popa" },
  { typeKey: "ACT_DONATIE", title: "Donație Teren Brănești",  nrDocument: "732/2021", dateDocument: "2021-09-08", institution: "Notariat Alexandru Dănilă", partiesAText: "Vasile Radu",        partiesBText: "Daniela Radu" },
  { typeKey: "ACT_DONATIE", title: "Donație Parcelă Tunari",  nrDocument: "919/2022", dateDocument: "2022-03-30", institution: "Notariat Ion Grigorescu",   partiesAText: "Ana Stanescu",       partiesBText: "Mihai Stanescu",          notes: "Donație intre soți" },
  // ── AUTORIZATIE ─────────────────────────────────────────────────────────
  { typeKey: "AUTORIZATIE", title: "Autorizație Construire Vila Voluntari",  nrDocument: "AC-045/2018", dateDocument: "2018-04-20", institution: "Primăria Voluntari",  notes: "Construcție P+1E, 220 mp" },
  { typeKey: "AUTORIZATIE", title: "Autorizație Demolare Anexă Snagov",     nrDocument: "AD-012/2019", dateDocument: "2019-08-11", institution: "Primăria Snagov",     notes: "Anexă gospodărească 45 mp" },
  { typeKey: "AUTORIZATIE", title: "Autorizație Construire Gard Afumați",   nrDocument: "AC-103/2020", dateDocument: "2020-02-27", institution: "Primăria Afumați",    notes: "Gard pe latura nordică" },
  { typeKey: "AUTORIZATIE", title: "Autorizație Extindere Locuință Gruiu",  nrDocument: "AC-067/2021", dateDocument: "2021-06-15", institution: "Primăria Gruiu",      notes: "Extindere 35 mp la parter" },
  { typeKey: "AUTORIZATIE", title: "Autorizație Construire Magazie Tunari", nrDocument: "AC-089/2023", dateDocument: "2023-03-04", institution: "Primăria Tunari",     notes: "Construcție auxiliară 60 mp" },
  // ── AVIZ_INSTITUTIE ─────────────────────────────────────────────────────
  { typeKey: "AVIZ_INSTITUTIE", title: "Aviz OCPI Ilfov — Dezmembrare",       nrDocument: "AV-234/2019", dateDocument: "2019-05-06", institution: "OCPI Ilfov",                   notes: "Dezmembrare în 3 loturi" },
  { typeKey: "AVIZ_INSTITUTIE", title: "Aviz Primărie — PUZ Voluntari",       nrDocument: "AV-011/2020", dateDocument: "2020-09-14", institution: "Primăria Voluntari",           notes: "Zonă rezidențială extinsă" },
  { typeKey: "AVIZ_INSTITUTIE", title: "Aviz Apele Române — Construcție Mal", nrDocument: "AV-778/2021", dateDocument: "2021-04-22", institution: "Administrația Apele Române",   notes: "Construcție la 50 m de lac" },
  { typeKey: "AVIZ_INSTITUTIE", title: "Aviz Drumuri Naționale — Acces",      nrDocument: "AV-342/2022", dateDocument: "2022-07-18", institution: "CNAIR — Direcția Ilfov",       notes: "Acces rutier de pe DN1" },
  { typeKey: "AVIZ_INSTITUTIE", title: "Aviz Mediu — Extindere Fermă",        nrDocument: "AV-156/2023", dateDocument: "2023-01-30", institution: "ANPM Ilfov",                   notes: "Extindere activitate agricolă" },
  // ── CERTIFICAT_FISCAL ───────────────────────────────────────────────────
  { typeKey: "CERTIFICAT_FISCAL", title: "Certificat Fiscal Ion Popescu",         nrDocument: "CF-1001/2020", dateDocument: "2020-03-10", institution: "ANAF — Administrația Ilfov" },
  { typeKey: "CERTIFICAT_FISCAL", title: "Certificat Fiscal SC Imobil SRL",       nrDocument: "CF-2234/2021", dateDocument: "2021-07-25", institution: "ANAF — Administrația Ilfov", notes: "Lipsa datorii la data emiterii" },
  { typeKey: "CERTIFICAT_FISCAL", title: "Certificat Fiscal Gheorghe Constantin", nrDocument: "CF-0889/2021", dateDocument: "2021-11-04", institution: "ANAF — Administrația Ilfov" },
  { typeKey: "CERTIFICAT_FISCAL", title: "Certificat Fiscal Elena Dinu",          nrDocument: "CF-3301/2022", dateDocument: "2022-05-19", institution: "ANAF — Administrația Ilfov" },
  { typeKey: "CERTIFICAT_FISCAL", title: "Certificat Fiscal PFA Radu Sorin",      nrDocument: "CF-4412/2023", dateDocument: "2023-08-08", institution: "ANAF — Administrația Ilfov", notes: "Valabil 30 zile de la emitere" },
  // ── CERTIFICAT_MOSTENITOR ───────────────────────────────────────────────
  { typeKey: "CERTIFICAT_MOSTENITOR", title: "Succesiune Popescu Vasile",   nrDocument: "55/2018",  dateDocument: "2018-09-12", institution: "Notariat Alexandru Dănilă", nrDosarSuccesoral: "DOS-120/2018", dataDecesului: "2018-01-15", ultimulDomiciliu: "Str. Florilor 4, Voluntari",          nrCertificatDeces: "CD-334/2018", defunctText: "Popescu Vasile",     partiesBText: "Popescu Ion, Popescu Maria" },
  { typeKey: "CERTIFICAT_MOSTENITOR", title: "Succesiune Ionescu Ana",     nrDocument: "88/2019",  dateDocument: "2019-04-30", institution: "Notariat Ion Grigorescu",   nrDosarSuccesoral: "DOS-067/2019", dataDecesului: "2018-11-22", ultimulDomiciliu: "Str. Trandafirilor 12, Snagov",       nrCertificatDeces: "CD-891/2018", defunctText: "Ionescu Ana",        partiesBText: "Ionescu Cristian, Ionescu Laura" },
  { typeKey: "CERTIFICAT_MOSTENITOR", title: "Succesiune Dumitrescu Gh.",  nrDocument: "112/2020", dateDocument: "2020-06-15", institution: "Notariat Maria Florescu",   nrDosarSuccesoral: "DOS-203/2020", dataDecesului: "2020-02-08", ultimulDomiciliu: "Bld. Unirii 5, Buftea",               nrCertificatDeces: "CD-102/2020", defunctText: "Dumitrescu Gheorghe", partiesBText: "Dumitrescu Elena",              notes: "Masa succesorală include teren 2.500 mp" },
  { typeKey: "CERTIFICAT_MOSTENITOR", title: "Succesiune Popa Florina",    nrDocument: "74/2021",  dateDocument: "2021-10-22", institution: "Notariat Alexandru Dănilă", nrDosarSuccesoral: "DOS-311/2021", dataDecesului: "2021-03-17", ultimulDomiciliu: "Str. Luncii 8, Cernica",              nrCertificatDeces: "CD-445/2021", defunctText: "Popa Florina",       partiesBText: "Popa Andrei, Popa Silvia, Popa Mihai" },
  { typeKey: "CERTIFICAT_MOSTENITOR", title: "Succesiune Radu Constantin", nrDocument: "201/2022", dateDocument: "2022-03-08", institution: "Notariat Ion Grigorescu",   nrDosarSuccesoral: "DOS-089/2022", dataDecesului: "2021-12-01", ultimulDomiciliu: "Str. Câmpului 23, Balotești",         nrCertificatDeces: "CD-778/2021", defunctText: "Radu Constantin",   partiesBText: "Radu Vasile, Radu Carmen" },
  { typeKey: "CERTIFICAT_MOSTENITOR", title: "Succesiune Stanescu Tudor",  nrDocument: "330/2023", dateDocument: "2023-07-14", institution: "Notariat Maria Florescu",   nrDosarSuccesoral: "DOS-415/2023", dataDecesului: "2023-01-09", ultimulDomiciliu: "Str. Primăverii 1, Afumați",          nrCertificatDeces: "CD-023/2023", defunctText: "Stanescu Tudor",    partiesBText: "Stanescu Adriana",              notes: "Unicul moștenitor legal" },
  // ── CERTIFICAT_SARCINI ──────────────────────────────────────────────────
  { typeKey: "CERTIFICAT_SARCINI", title: "Certificat Sarcini CF 12345", nrDocument: "CS-445/2019", dateDocument: "2019-06-20", institution: "OCPI Ilfov", notes: "Liber de sarcini la data emiterii" },
  { typeKey: "CERTIFICAT_SARCINI", title: "Certificat Sarcini CF 23890", nrDocument: "CS-778/2020", dateDocument: "2020-11-03", institution: "OCPI Ilfov", notes: "Ipotecă înscrisă în favoarea BCR" },
  { typeKey: "CERTIFICAT_SARCINI", title: "Certificat Sarcini CF 34012", nrDocument: "CS-102/2021", dateDocument: "2021-04-17", institution: "OCPI Ilfov" },
  { typeKey: "CERTIFICAT_SARCINI", title: "Certificat Sarcini CF 41233", nrDocument: "CS-556/2022", dateDocument: "2022-08-29", institution: "OCPI Ilfov", notes: "Liber de sarcini" },
  { typeKey: "CERTIFICAT_SARCINI", title: "Certificat Sarcini CF 50087", nrDocument: "CS-890/2023", dateDocument: "2023-02-14", institution: "OCPI Ilfov", notes: "Sechestru asigurator înscris" },
  // ── CERTIFICAT_URBANISM ─────────────────────────────────────────────────
  { typeKey: "CERTIFICAT_URBANISM", title: "CU Construire Locuință Voluntari",  nrDocument: "CU-112/2018", dateDocument: "2018-05-14", institution: "Primăria Voluntari",  notes: "Zonă rezidențială, POT 40%, CUT 1.2" },
  { typeKey: "CERTIFICAT_URBANISM", title: "CU Dezmembrare Lot Snagov",        nrDocument: "CU-034/2019", dateDocument: "2019-10-22", institution: "Primăria Snagov",     notes: "Dezmembrare în 2 parcele" },
  { typeKey: "CERTIFICAT_URBANISM", title: "CU Extindere Imobil Gruiu",        nrDocument: "CU-209/2020", dateDocument: "2020-03-30", institution: "Primăria Gruiu" },
  { typeKey: "CERTIFICAT_URBANISM", title: "CU Amplasare Panouri Fotovoltaice",nrDocument: "CU-067/2021", dateDocument: "2021-07-08", institution: "Primăria Afumați",    notes: "Instalare 48 panouri pe acoperiș" },
  { typeKey: "CERTIFICAT_URBANISM", title: "CU Schimbare Destinație Spațiu",   nrDocument: "CU-445/2022", dateDocument: "2022-12-19", institution: "Primăria Tunari",     notes: "Din depozit în spațiu comercial" },
  // ── CONTRACT_ARENDA ─────────────────────────────────────────────────────
  { typeKey: "CONTRACT_ARENDA", title: "Arendă Teren Agricol Balotești", nrDocument: "CA-001/2019", dateDocument: "2019-03-01", institution: "Primăria Balotești", dateStart: "2019-03-01", dateEnd: "2024-02-28", partiesAText: "Ion Popescu",                    partiesBText: "SC AgroMax SRL",        notes: "12 ha teren arabil" },
  { typeKey: "CONTRACT_ARENDA", title: "Arendă Câmp Snagov",            nrDocument: "CA-045/2020", dateDocument: "2020-01-15", institution: "Primăria Snagov",    dateStart: "2020-02-01", dateEnd: "2025-01-31", partiesAText: "Maria Ionescu, Vasile Ionescu",  partiesBText: "SC CerealeRom SA",      notes: "8 ha pășune și arabil" },
  { typeKey: "CONTRACT_ARENDA", title: "Arendă Teren Gruiu",            nrDocument: "CA-112/2020", dateDocument: "2020-06-10", institution: "Primăria Gruiu",     dateStart: "2020-07-01", dateEnd: "2023-06-30", partiesAText: "Gheorghe Constantin",            partiesBText: "PFA Marin Dumitru",     notes: "5 ha arabil" },
  { typeKey: "CONTRACT_ARENDA", title: "Arendă Lot Agricol Cernica",    nrDocument: "CA-233/2021", dateDocument: "2021-04-05", institution: "Primăria Cernica",   dateStart: "2021-04-15", dateEnd: "2026-04-14", partiesAText: "Elena Popa",                     partiesBText: "SC FermaVerde SRL",     notes: "15 ha, inclusiv pășune" },
  { typeKey: "CONTRACT_ARENDA", title: "Arendă Teren Brănești",         nrDocument: "CA-089/2022", dateDocument: "2022-09-20", institution: "Primăria Brănești",  dateStart: "2022-10-01", dateEnd: "2027-09-30", partiesAText: "Tudor Mocanu, Ana Mocanu",        partiesBText: "SC AgriLand SRL",       notes: "20 ha teren arabil" },
  // ── CONTRACT_INCHIRIERE ─────────────────────────────────────────────────
  { typeKey: "CONTRACT_INCHIRIERE", title: "Închiriere Apartament Voluntari", nrDocument: "CI-301/2020", dateDocument: "2020-02-10", institution: "Primăria Voluntari", dateStart: "2020-03-01", dateEnd: "2021-02-28", partiesAText: "Ion Popescu",          partiesBText: "Andrei Marinescu",           notes: "3 camere, et. 2, 75 mp" },
  { typeKey: "CONTRACT_INCHIRIERE", title: "Închiriere Spațiu Comercial",    nrDocument: "CI-445/2021", dateDocument: "2021-05-20", institution: "Primăria Buftea",    dateStart: "2021-06-01", dateEnd: "2024-05-31", partiesAText: "SC Imobil Invest SRL", partiesBText: "SC Magazin Profi SRL",       notes: "120 mp parter" },
  { typeKey: "CONTRACT_INCHIRIERE", title: "Închiriere Casă Snagov",         nrDocument: "CI-112/2021", dateDocument: "2021-09-15", institution: "Primăria Snagov",    dateStart: "2021-10-01", dateEnd: "2022-09-30", partiesAText: "Elena Constantin",     partiesBText: "Florina Niculescu",          notes: "Casă P+1, 150 mp" },
  { typeKey: "CONTRACT_INCHIRIERE", title: "Închiriere Depozit Afumați",     nrDocument: "CI-778/2022", dateDocument: "2022-03-01", institution: "Primăria Afumați",   dateStart: "2022-04-01", dateEnd: "2025-03-31", partiesAText: "SC LogiPark SRL",      partiesBText: "SC Distribuție Nord SRL",    notes: "Depozit 500 mp" },
  { typeKey: "CONTRACT_INCHIRIERE", title: "Închiriere Birou Voluntari",     nrDocument: "CI-990/2023", dateDocument: "2023-07-12", institution: "Primăria Voluntari", dateStart: "2023-08-01", dateEnd: "2024-07-31", partiesAText: "Vasile Radu",          partiesBText: "PFA Stoica Cristian",        notes: "Birou 45 mp, et. 1" },
  // ── CONTRACT_PARTAJ ─────────────────────────────────────────────────────
  { typeKey: "CONTRACT_PARTAJ", title: "Partaj Voluntar Succesiune Popescu", nrDocument: "211/2019", dateDocument: "2019-08-20", institution: "Notariat Ion Grigorescu",   notes: "Impartire lot 5.000 mp in 3 parti egale" },
  { typeKey: "CONTRACT_PARTAJ", title: "Partaj Bunuri Comune Ionescu",       nrDocument: "334/2020", dateDocument: "2020-04-14", institution: "Notariat Alexandru Dănilă", notes: "Partaj in urma divortului" },
  { typeKey: "CONTRACT_PARTAJ", title: "Partaj Succesoral Constantin",       nrDocument: "102/2021", dateDocument: "2021-11-09", institution: "Notariat Maria Florescu",   notes: "2 moștenitori, câte 50%" },
  { typeKey: "CONTRACT_PARTAJ", title: "Partaj Teren Agricol Gruiu",         nrDocument: "567/2022", dateDocument: "2022-06-17", institution: "Notariat Ion Grigorescu",   notes: "Lot de 8 ha împărțit în 4 parcele" },
  { typeKey: "CONTRACT_PARTAJ", title: "Partaj Imobil Snagov",               nrDocument: "801/2023", dateDocument: "2023-09-03", institution: "Notariat Alexandru Dănilă" },
  // ── CONTRACT_PRESTARI_SERVICII ──────────────────────────────────────────
  { typeKey: "CONTRACT_PRESTARI_SERVICII", title: "Contract Topografie Teren Voluntari", nrDocument: "CPS-010/2020", dateDocument: "2020-03-25", institution: "SC TopoGeo SRL",       notes: "Ridicare topografică 3 ha" },
  { typeKey: "CONTRACT_PRESTARI_SERVICII", title: "Contract Evaluare Imobil Snagov",    nrDocument: "CPS-078/2021", dateDocument: "2021-07-14", institution: "Evaluator Mihai Dinu",  notes: "Evaluare imobil 450 mp" },
  { typeKey: "CONTRACT_PRESTARI_SERVICII", title: "Contract Consultanță Juridică",      nrDocument: "CPS-145/2021", dateDocument: "2021-12-01", institution: "Avocat Sorin Nistor",   notes: "Asistență juridică tranzacție imobiliară" },
  { typeKey: "CONTRACT_PRESTARI_SERVICII", title: "Contract Mediere Litigiu Funciar",   nrDocument: "CPS-223/2022", dateDocument: "2022-05-19", institution: "Cabinet Mediere Iancu", notes: "Mediere dispută de hotar" },
  { typeKey: "CONTRACT_PRESTARI_SERVICII", title: "Contract Proiect Arhitectură",       nrDocument: "CPS-399/2023", dateDocument: "2023-02-28", institution: "SC ArchDesign SRL",     notes: "Proiect construire P+1, 200 mp" },
  // ── CONTRACT_VANZARE ────────────────────────────────────────────────────
  { typeKey: "CONTRACT_VANZARE", title: "Vânzare Teren Voluntari 2.500 mp",  nrDocument: "1001/2018", dateDocument: "2018-06-14", institution: "Notariat Ion Grigorescu",   partiesAText: "Ion Popescu",                   partiesBText: "Alexandru Dumitrescu",          notes: "Teren intravilan, CF 12345" },
  { typeKey: "CONTRACT_VANZARE", title: "Vânzare Casă Snagov",               nrDocument: "1234/2019", dateDocument: "2019-11-20", institution: "Notariat Maria Florescu",   partiesAText: "Elena Constantin",              partiesBText: "Gheorghe și Ana Popa",          notes: "P+1, 180 mp utili" },
  { typeKey: "CONTRACT_VANZARE", title: "Vânzare Lot Agricol Balotești",     nrDocument: "0778/2020", dateDocument: "2020-04-08", institution: "Notariat Alexandru Dănilă", partiesAText: "Maria Ionescu, Vasile Ionescu", partiesBText: "SC AgroInvest SRL",             notes: "12 ha teren arabil, CF 23890" },
  { typeKey: "CONTRACT_VANZARE", title: "Vânzare Apartament Buftea",         nrDocument: "2201/2021", dateDocument: "2021-09-30", institution: "Notariat Ion Grigorescu",   partiesAText: "Florina Niculescu",             partiesBText: "Andrei Marinescu",              notes: "2 camere, 54 mp, CF 34012" },
  { typeKey: "CONTRACT_VANZARE", title: "Vânzare Teren Intravilan Cernica",  nrDocument: "3301/2022", dateDocument: "2022-03-15", institution: "Notariat Maria Florescu",   partiesAText: "Tudor Mocanu",                  partiesBText: "Carmen Iliescu",                notes: "Lot 1.200 mp" },
  { typeKey: "CONTRACT_VANZARE", title: "Vânzare Imobil Afumați",            nrDocument: "4455/2023", dateDocument: "2023-08-22", institution: "Notariat Alexandru Dănilă", partiesAText: "Sorin Nistor",                  partiesBText: "Cristian Stoica, Laura Stoica", notes: "Casă + teren 850 mp, CF 50087" },
  // ── EXTRAS_CARTE_FUNCIARA ───────────────────────────────────────────────
  { typeKey: "EXTRAS_CARTE_FUNCIARA", title: "Extras CF 12345 — Informare",     nrDocument: "ECF-001/2019", dateDocument: "2019-04-10", institution: "OCPI Ilfov", notes: "Extras pentru informare, valabil 30 zile" },
  { typeKey: "EXTRAS_CARTE_FUNCIARA", title: "Extras CF 23890 — Autentificare", nrDocument: "ECF-112/2020", dateDocument: "2020-07-22", institution: "OCPI Ilfov", notes: "Extras pentru autentificarea contractului" },
  { typeKey: "EXTRAS_CARTE_FUNCIARA", title: "Extras CF 34012 — Informare",     nrDocument: "ECF-334/2021", dateDocument: "2021-02-18", institution: "OCPI Ilfov" },
  { typeKey: "EXTRAS_CARTE_FUNCIARA", title: "Extras CF 41233 — Autentificare", nrDocument: "ECF-556/2022", dateDocument: "2022-10-05", institution: "OCPI Ilfov", notes: "Extras pentru vânzare-cumpărare" },
  { typeKey: "EXTRAS_CARTE_FUNCIARA", title: "Extras CF 50087 — Informare",     nrDocument: "ECF-780/2023", dateDocument: "2023-05-30", institution: "OCPI Ilfov" },
  // ── EXTRAS_PUG ──────────────────────────────────────────────────────────
  { typeKey: "EXTRAS_PUG", title: "Extras PUG Voluntari — Lot Nord",  nrDocument: "PUG-023/2019", dateDocument: "2019-08-07", institution: "Primăria Voluntari",  notes: "Zonă rezidențială cu densitate mică" },
  { typeKey: "EXTRAS_PUG", title: "Extras PUG Snagov — Zonă Turism",  nrDocument: "PUG-011/2020", dateDocument: "2020-03-14", institution: "Primăria Snagov",     notes: "Zonă de agrement și turism" },
  { typeKey: "EXTRAS_PUG", title: "Extras PUG Balotești — Agricol",   nrDocument: "PUG-067/2021", dateDocument: "2021-06-28", institution: "Primăria Balotești",  notes: "Teren extravilan categorie arabil" },
  { typeKey: "EXTRAS_PUG", title: "Extras PUG Gruiu — Rezidențial",   nrDocument: "PUG-134/2022", dateDocument: "2022-09-12", institution: "Primăria Gruiu",      notes: "Zonă rezidențială aprobată HCL 45/2022" },
  { typeKey: "EXTRAS_PUG", title: "Extras PUG Cernica — Industrial",  nrDocument: "PUG-290/2023", dateDocument: "2023-04-19", institution: "Primăria Cernica",    notes: "Zonă industrială și servicii" },
  // ── HOTARARE_JUDECATOREASCA ─────────────────────────────────────────────
  { typeKey: "HOTARARE_JUDECATOREASCA", title: "Hotărâre Retrocedare Teren Voluntari", nrDocument: "1123/2017", dateDocument: "2017-11-08", institution: "Judecătoria Buftea",  notes: "Dosar 334/2017 — retrocedare teren 3.000 mp, rămasă definitivă" },
  { typeKey: "HOTARARE_JUDECATOREASCA", title: "Hotărâre Ieșire Indiviziune Snagov",   nrDocument: "445/2019",  dateDocument: "2019-06-25", institution: "Tribunalul Ilfov",    notes: "Partaj judiciar, 4 coproprietari" },
  { typeKey: "HOTARARE_JUDECATOREASCA", title: "Hotărâre Uzucapiune Cernica",          nrDocument: "2201/2020", dateDocument: "2020-09-17", institution: "Judecătoria Buftea",  notes: "Uzucapiune tabulară, cf. art. 930 NCC" },
  { typeKey: "HOTARARE_JUDECATOREASCA", title: "Hotărâre Grănițuire Balotești",        nrDocument: "889/2021",  dateDocument: "2021-04-12", institution: "Judecătoria Buftea",  notes: "Stabilire linie de hotar, irevocabilă" },
  { typeKey: "HOTARARE_JUDECATOREASCA", title: "Hotărâre Revendicare Imobiliară",      nrDocument: "3340/2022", dateDocument: "2022-12-06", institution: "Tribunalul Ilfov",    notes: "Admisă cererea de revendicare, apel respins" },
  // ── TESTAMENT ───────────────────────────────────────────────────────────
  { typeKey: "TESTAMENT", title: "Testament Popescu Ion",      nrDocument: "55/2016",  dateDocument: "2016-03-14", institution: "Notariat Ion Grigorescu",   defunctText: "Popescu Ion",      notes: "Testament autentic, lăsat un singur moștenitor" },
  { typeKey: "TESTAMENT", title: "Testament Constantin Elena", nrDocument: "112/2018", dateDocument: "2018-09-22", institution: "Notariat Maria Florescu",   defunctText: "Constantin Elena", notes: "Testatorul a desemnat doi legatari particulari" },
  { typeKey: "TESTAMENT", title: "Testament Radu Vasile",      nrDocument: "234/2020", dateDocument: "2020-01-10", institution: "Notariat Alexandru Dănilă", defunctText: "Radu Vasile" },
  { typeKey: "TESTAMENT", title: "Testament Popa Gheorghe",    nrDocument: "501/2021", dateDocument: "2021-07-05", institution: "Notariat Ion Grigorescu",   defunctText: "Popa Gheorghe",    notes: "Include clauză substituție vulgară" },
  { typeKey: "TESTAMENT", title: "Testament Stanescu Maria",   nrDocument: "789/2023", dateDocument: "2023-11-18", institution: "Notariat Maria Florescu",   defunctText: "Stanescu Maria" },
  // ── TITLU_PROPRIETATE ───────────────────────────────────────────────────
  { typeKey: "TITLU_PROPRIETATE", title: "Titlu Teren Arabil Voluntari",  nrDocument: "12345/2001", dateDocument: "2001-06-15", institution: "Comisia Locală Voluntari",   emitent: "Comisia Județeană Ilfov", bazaLegala: "Legea 18/1991",  uatProprietate: "Voluntari",  uatProprietar: "Voluntari",  suprafata: "3.2000", titularText: "Ion Popescu" },
  { typeKey: "TITLU_PROPRIETATE", title: "Titlu Pășune Snagov",           nrDocument: "23890/2003", dateDocument: "2003-09-22", institution: "Comisia Locală Snagov",     emitent: "Comisia Județeană Ilfov", bazaLegala: "Legea 169/1997", uatProprietate: "Snagov",     uatProprietar: "Snagov",     suprafata: "7.5000", titularText: "Maria Ionescu",    defunctText: "Ionescu Vasile",  notes: "Reconstituire după defunct" },
  { typeKey: "TITLU_PROPRIETATE", title: "Titlu Teren Extravilan Gruiu",  nrDocument: "34012/2005", dateDocument: "2005-04-08", institution: "Comisia Locală Gruiu",      emitent: "Comisia Județeană Ilfov", bazaLegala: "HG 834/1991",    uatProprietate: "Gruiu",      uatProprietar: "Gruiu",      suprafata: "1.8500", titularText: "Gheorghe Popa" },
  { typeKey: "TITLU_PROPRIETATE", title: "Titlu Teren Agricol Cernica",   nrDocument: "41233/2007", dateDocument: "2007-11-30", institution: "Comisia Locală Cernica",    emitent: "Comisia Județeană Ilfov", bazaLegala: "Legea 18/1991",  uatProprietate: "Cernica",    uatProprietar: "Cernica",    suprafata: "5.0000", titularText: "Elena Constantin", defunctText: "Dumitrescu Ion",  notes: "Reconstituire pe numele moștenitorului" },
  { typeKey: "TITLU_PROPRIETATE", title: "Titlu Fânețe Balotești",        nrDocument: "50087/2009", dateDocument: "2009-07-14", institution: "Comisia Locală Balotești",  emitent: "Comisia Județeană Ilfov", bazaLegala: "Legea 169/1997", uatProprietate: "Balotești",  uatProprietar: "Balotești",  suprafata: "2.1200", titularText: "Ana Stanescu" },
  { typeKey: "TITLU_PROPRIETATE", title: "Titlu Teren Arabil Brănești",   nrDocument: "62001/2012", dateDocument: "2012-03-19", institution: "Comisia Locală Brănești",   emitent: "Comisia Județeană Ilfov", bazaLegala: "Legea 18/1991",  uatProprietate: "Brănești",   uatProprietar: "Brănești",   suprafata: "4.4000", titularText: "Tudor Mocanu",    notes: "10 parcele comasate" },
];


// ---------------------------------------------------------------------------
// Judicial person seed data — 40 companies using all judicial types
//
// Contact-person distribution (indices into naturalPersons sorted by code):
//   Group A (entries  0–11, 30%) — both contactPerson1Idx + contactPerson2Idx set
//   Group B (entries 12–23, 30%) — contactPerson1Idx only; cp2 left for UI demo
//   Group C (entries 24–39, 40%) — no contacts
//
// Requires migration_018 (drops old text columns, adds FK + flag columns).
// ---------------------------------------------------------------------------

type JudicialAddressInput = {
  streetLine?: string;
  postalCode?: string;
  locality?: string;
  county?: string;
  country: string;
  notes?: string;
};

// Plain label matching lookup_judicial_person_type.name — resolved to an id
// at seed time (Slice #15.07; the old judicial_type enum is gone). "SRL_D"
// is kept as the literal here purely as a recognizable seed-data label; it
// is mapped to the DB name "SRL-D" via JUDICIAL_TYPE_LABEL_TO_NAME below.
type JudicialTypeLabel = "SRL" | "SA" | "SRL_D" | "PFA" | "II" | "IF" | "ONG" | "OTHER";

type SeedJudicialRow = {
  name: string;
  nickname?: string;
  judicialType: JudicialTypeLabel;
  cuiNumber?: string;
  tradeRegisterNumber?: string;
  notes?: string;
  /** 0-based index into natural persons sorted by code. */
  contactPerson1Idx?: number;
  contactPerson2Idx?: number;
  hqAddress?: JudicialAddressInput;
  correspondenceAddress?: JudicialAddressInput;
  correspondenceSameAsHq?: boolean;
};

const JUDICIAL_PERSONS: SeedJudicialRow[] = [
  // ── GROUP A: both contacts linked (entries 0–11, 30%) ────────────────────

  // 0 – SRL
  {
    name: "Imobil Invest SRL", judicialType: "SRL",
    cuiNumber: "14523678", tradeRegisterNumber: "J40/1234/2003",
    contactPerson1Idx: 0, contactPerson2Idx: 1,
    hqAddress: { streetLine: "Calea Dorobanților 190, et. 3", postalCode: "010572", locality: "București", county: "Sector 1", country: "Romania" },
    correspondenceAddress: { streetLine: "P.O. Box 100, OP 7", postalCode: "010700", locality: "București", county: "Sector 1", country: "Romania" },
  },
  // 1 – SRL
  {
    name: "AgroTerra SRL", judicialType: "SRL",
    cuiNumber: "22345901", tradeRegisterNumber: "J23/445/2008",
    contactPerson1Idx: 2, contactPerson2Idx: 3,
    hqAddress: { streetLine: "Strada Principală 5", postalCode: "077060", locality: "Cornetu", county: "Ilfov", country: "Romania" },
  },
  // 2 – SRL
  {
    name: "TechnoSoft SRL", judicialType: "SRL",
    cuiNumber: "31456789", tradeRegisterNumber: "J12/678/2015",
    contactPerson1Idx: 4, contactPerson2Idx: 5,
    hqAddress: { streetLine: "Strada Republicii 45, et. 2", postalCode: "400015", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
  },
  // 3 – SRL
  {
    name: "MedCare SRL", judicialType: "SRL",
    cuiNumber: "18234567", tradeRegisterNumber: "J35/901/2010",
    contactPerson1Idx: 6, contactPerson2Idx: 7,
    hqAddress: { streetLine: "Bulevardul Revoluției 1989 nr. 78", postalCode: "300006", locality: "Timișoara", county: "Timiș", country: "Romania" },
    correspondenceSameAsHq: true,
  },
  // 4 – SRL
  {
    name: "LogiPark SRL", judicialType: "SRL",
    cuiNumber: "25678901", tradeRegisterNumber: "J29/234/2012",
    contactPerson1Idx: 8, contactPerson2Idx: 9,
    hqAddress: { streetLine: "Strada Industriilor 22, Parc Industrial Ploiești", postalCode: "100022", locality: "Ploiești", county: "Prahova", country: "Romania" },
  },
  // 5 – SRL
  {
    name: "ConstPro SRL", nickname: "ConstPro", judicialType: "SRL",
    cuiNumber: "16789012", tradeRegisterNumber: "J08/567/2005",
    contactPerson1Idx: 10, contactPerson2Idx: 11,
    hqAddress: { streetLine: "Strada Lungă 123", postalCode: "500092", locality: "Brașov", county: "Brașov", country: "Romania" },
    correspondenceAddress: { streetLine: "CP 88, OP 5", postalCode: "500500", locality: "Brașov", county: "Brașov", country: "Romania" },
  },
  // 6 – SA
  {
    name: "Banca Comercială SA", judicialType: "SA",
    cuiNumber: "1234567", tradeRegisterNumber: "J40/89/1994",
    contactPerson1Idx: 12, contactPerson2Idx: 13,
    hqAddress: { streetLine: "Bulevardul Unirii 35", postalCode: "030830", locality: "București", county: "Sector 3", country: "Romania" },
  },
  // 7 – SA
  {
    name: "AeroRom SA", judicialType: "SA",
    cuiNumber: "2345678", tradeRegisterNumber: "J40/1023/1991",
    contactPerson1Idx: 14, contactPerson2Idx: 15,
    hqAddress: { streetLine: "Calea Floreasca 246A", postalCode: "014476", locality: "București", county: "Sector 1", country: "Romania" },
    correspondenceSameAsHq: true,
  },
  // 8 – SA
  {
    name: "CerealeRom SA", judicialType: "SA",
    cuiNumber: "3456789", tradeRegisterNumber: "J23/115/1996",
    contactPerson1Idx: 16, contactPerson2Idx: 17,
    hqAddress: { streetLine: "Șoseaua Afumați km 8", postalCode: "077025", locality: "Afumați", county: "Ilfov", country: "Romania" },
  },
  // 9 – SA
  {
    name: "PetroVest SA", judicialType: "SA",
    cuiNumber: "4567890", tradeRegisterNumber: "J29/456/1999",
    contactPerson1Idx: 18, contactPerson2Idx: 19,
    hqAddress: { streetLine: "Strada Independenței 5", postalCode: "100018", locality: "Ploiești", county: "Prahova", country: "Romania" },
    correspondenceAddress: { streetLine: "CP 2, OP 1", postalCode: "100001", locality: "Ploiești", county: "Prahova", country: "Romania" },
  },
  // 10 – SRL
  {
    name: "EcoGreen SRL", judicialType: "SRL",
    cuiNumber: "32567890", tradeRegisterNumber: "J22/789/2016",
    contactPerson1Idx: 20, contactPerson2Idx: 21,
    hqAddress: { streetLine: "Strada Sărărie 56, et. 1", postalCode: "700451", locality: "Iași", county: "Iași", country: "Romania" },
  },
  // 11 – SRL
  {
    name: "Alpha Trading SRL", nickname: "AlphaTrading", judicialType: "SRL",
    cuiNumber: "28901234", tradeRegisterNumber: "J13/345/2011",
    contactPerson1Idx: 22, contactPerson2Idx: 23,
    hqAddress: { streetLine: "Bulevardul Tomis 101", postalCode: "900663", locality: "Constanța", county: "Constanța", country: "Romania" },
  },

  // ── GROUP B: one contact linked, second to be added via UI (entries 12–23, 30%) ─

  // 12 – SRL
  {
    name: "ProServ SRL", judicialType: "SRL",
    cuiNumber: "19012345", tradeRegisterNumber: "J17/890/2007",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 0,
    hqAddress: { streetLine: "Strada Domnească 78", postalCode: "800211", locality: "Galați", county: "Galați", country: "Romania" },
  },
  // 13 – SRL
  {
    name: "RomBuild SRL", judicialType: "SRL",
    cuiNumber: "21234567", tradeRegisterNumber: "J03/123/2009",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 1,
    hqAddress: { streetLine: "Strada Victoriei 22", postalCode: "110006", locality: "Pitești", county: "Argeș", country: "Romania" },
    correspondenceSameAsHq: true,
  },
  // 14 – SRL
  {
    name: "DataSystems SRL", judicialType: "SRL",
    cuiNumber: "29876543", tradeRegisterNumber: "J05/234/2017",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 2,
    hqAddress: { streetLine: "Strada Republicii 15, et. 4", postalCode: "410152", locality: "Oradea", county: "Bihor", country: "Romania" },
  },
  // 15 – SRL
  {
    name: "NordCom SRL", judicialType: "SRL",
    cuiNumber: "27654321", tradeRegisterNumber: "J32/567/2013",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 3,
    hqAddress: { streetLine: "Piața Mare 10, et. 2", postalCode: "550025", locality: "Sibiu", county: "Sibiu", country: "Romania" },
    correspondenceAddress: { streetLine: "CP 45, OP 3", postalCode: "550300", locality: "Sibiu", county: "Sibiu", country: "Romania" },
  },
  // 16 – SA
  {
    name: "ElectroRom SA", judicialType: "SA",
    cuiNumber: "5678901", tradeRegisterNumber: "J16/78/1998",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 4,
    hqAddress: { streetLine: "Calea Unirii 12", postalCode: "200580", locality: "Craiova", county: "Dolj", country: "Romania" },
  },
  // 17 – SA
  {
    name: "TeleNet SA", judicialType: "SA",
    cuiNumber: "6789012", tradeRegisterNumber: "J12/234/2002",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 5,
    hqAddress: { streetLine: "Strada Memorandumului 28, et. 3", postalCode: "400114", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
  },
  // 18 – SRL_D
  {
    name: "StartupHub SRL-D", judicialType: "SRL_D",
    cuiNumber: "38765432", tradeRegisterNumber: "J40/3456/2020",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 6,
    hqAddress: { streetLine: "Strada Covaci 14", postalCode: "030021", locality: "București", county: "Sector 3", country: "Romania" },
  },
  // 19 – SRL_D
  {
    name: "InnoTech SRL-D", judicialType: "SRL_D",
    cuiNumber: "39876543", tradeRegisterNumber: "J12/4567/2021",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 7,
    hqAddress: { streetLine: "Calea Turzii 178, sp. 12", postalCode: "400490", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
  },
  // 20 – SRL_D
  {
    name: "DigitalMark SRL-D", judicialType: "SRL_D",
    cuiNumber: "40987654", tradeRegisterNumber: "J35/5678/2021",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 8,
    hqAddress: { streetLine: "Bulevardul Eroilor de la Tisa 1A", postalCode: "300024", locality: "Timișoara", county: "Timiș", country: "Romania" },
    correspondenceSameAsHq: true,
  },
  // 21 – SRL_D
  {
    name: "EduPlatform SRL-D", judicialType: "SRL_D",
    cuiNumber: "42098765", tradeRegisterNumber: "J22/6789/2022",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 9,
    hqAddress: { streetLine: "Strada Coposu 10", postalCode: "700468", locality: "Iași", county: "Iași", country: "Romania" },
  },
  // 22 – PFA
  {
    name: "PFA Ionescu Dan", judicialType: "PFA",
    cuiNumber: "43209876",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 10,
    hqAddress: { streetLine: "Strada Polonă 40, ap. 5", postalCode: "010494", locality: "București", county: "Sector 1", country: "Romania" },
  },
  // 23 – PFA
  {
    name: "PFA Stoica Radu", judicialType: "PFA",
    cuiNumber: "44320987",
    notes: "Contact person 2 to be added via the Add contact person button.",
    contactPerson1Idx: 11,
    hqAddress: { streetLine: "Strada Iuliu Maniu 23", postalCode: "400100", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
  },

  // ── GROUP C: no contacts (entries 24–39, 40%) ────────────────────────────

  // 24 – PFA
  {
    name: "PFA Marin Dumitru", judicialType: "PFA",
    cuiNumber: "45431098",
    hqAddress: { streetLine: "Strada Moților 7", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
  },
  // 25 – PFA
  {
    name: "PFA Popescu Vasile", judicialType: "PFA",
    cuiNumber: "46542109",
    hqAddress: { streetLine: "Calea Plevnei 34, ap. 2", postalCode: "010233", locality: "București", county: "Sector 1", country: "Romania" },
  },
  // 26 – PFA
  {
    name: "PFA Nistor Sorin", judicialType: "PFA",
    cuiNumber: "47653210",
    hqAddress: { streetLine: "Bulevardul Mamaia 200", postalCode: "900527", locality: "Constanța", county: "Constanța", country: "Romania" },
  },
  // 27 – PFA
  {
    name: "PFA Gheorghe Mihai", judicialType: "PFA",
    cuiNumber: "48764321",
    hqAddress: { streetLine: "Strada Republicii 50", postalCode: "500015", locality: "Brașov", county: "Brașov", country: "Romania" },
  },
  // 28 – II
  {
    name: "II Fermă Agricolă Barbu", judicialType: "II",
    cuiNumber: "49875432", tradeRegisterNumber: "J23/890/2006",
    hqAddress: { streetLine: "Strada Principală 12", postalCode: "077025", locality: "Afumați", county: "Ilfov", country: "Romania" },
  },
  // 29 – II
  {
    name: "II Servicii Auto Lungu", judicialType: "II",
    cuiNumber: "50986543", tradeRegisterNumber: "J29/1234/2010",
    hqAddress: { streetLine: "Strada Mimozei 3", postalCode: "100092", locality: "Ploiești", county: "Prahova", country: "Romania" },
    correspondenceSameAsHq: true,
  },
  // 30 – II
  {
    name: "II Atelier Costea", judicialType: "II",
    cuiNumber: "52097654", tradeRegisterNumber: "J17/567/2004",
    hqAddress: { streetLine: "Strada Brăilei 45", postalCode: "800201", locality: "Galați", county: "Galați", country: "Romania" },
  },
  // 31 – II
  {
    name: "II Comerț General Tudor", judicialType: "II",
    cuiNumber: "53108765", tradeRegisterNumber: "J04/890/2008",
    notes: "Activitate temporar suspendată.",
    hqAddress: { streetLine: "Strada Vasile Alecsandri 20", postalCode: "600011", locality: "Bacău", county: "Bacău", country: "Romania" },
  },
  // 32 – IF
  {
    name: "IF Familia Ionescu", judicialType: "IF",
    cuiNumber: "54219876", tradeRegisterNumber: "J40/2345/2015",
    hqAddress: { streetLine: "Strada Gabroveni 12", postalCode: "030013", locality: "București", county: "Sector 3", country: "Romania" },
  },
  // 33 – IF
  {
    name: "IF Agricultură Moldovan", judicialType: "IF",
    cuiNumber: "55320987", tradeRegisterNumber: "J23/3456/2018",
    hqAddress: { streetLine: "Calea Cernica 8", postalCode: "077040", locality: "Cernica", county: "Ilfov", country: "Romania" },
    correspondenceAddress: { streetLine: "CP 5, OP Cernica", postalCode: "077040", locality: "Cernica", county: "Ilfov", country: "Romania" },
  },
  // 34 – IF
  {
    name: "IF Servicii Casnice Popa", judicialType: "IF",
    cuiNumber: "56431098", tradeRegisterNumber: "J12/4567/2019",
    hqAddress: { streetLine: "Aleea Băișoara 3", postalCode: "400510", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
  },
  // 35 – ONG
  {
    name: "Asociația Proprietarilor de Terenuri Ilfov", nickname: "APTI", judicialType: "ONG",
    cuiNumber: "57542109",
    notes: "Asociație înregistrată la Judecătoria Buftea.",
    hqAddress: { streetLine: "Strada Dunării 1", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
  },
  // 36 – ONG
  {
    name: "Fundația EcoRomânia", nickname: "EcoRo", judicialType: "ONG",
    cuiNumber: "58653210",
    hqAddress: { streetLine: "Intrarea Odoarei 5", postalCode: "020271", locality: "București", county: "Sector 2", country: "Romania" },
    correspondenceSameAsHq: true,
  },
  // 37 – ONG
  {
    name: "Asociația Culturală «Miorița»", judicialType: "ONG",
    cuiNumber: "59764321",
    notes: "Asociație de promovare a culturii tradiționale românești.",
    hqAddress: { streetLine: "Strada Costache Negri 3", postalCode: "700470", locality: "Iași", county: "Iași", country: "Romania" },
  },
  // 38 – OTHER
  {
    name: "Cooperativa Agricolă Bragadiru", nickname: "CAB", judicialType: "OTHER",
    cuiNumber: "60875432",
    notes: "Cooperativă agricolă fondată în 1994.",
    hqAddress: { streetLine: "Strada Izvorului 7", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
  },
  // 39 – OTHER
  {
    name: "Grupul de Interes Economic «Ilfov Nord»", nickname: "GIE Ilfov Nord", judicialType: "OTHER",
    cuiNumber: "61986543", tradeRegisterNumber: "J23/7890/2014",
    hqAddress: { streetLine: "Strada Câmpului 3", postalCode: "077025", locality: "Afumați", county: "Ilfov", country: "Romania" },
    correspondenceAddress: { streetLine: "CP 1, OP Voluntari", postalCode: "077190", locality: "Voluntari", county: "Ilfov", country: "Romania" },
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

async function seed() {
  // ---- Natural persons ----
  const personCount = (
    await db.execute(sql`select count(*)::int as count from person`)
  ).rows[0] as { count: number };

  if (personCount.count > 0) {
    console.log(
      `person already has ${personCount.count} row(s); skipping persons seed.`,
    );
  } else {
    console.log(`Seeding ${PERSONS.length} natural persons (PPERS codes)...`);
    await db.transaction(async (tx) => {
      for (const row of PERSONS) {
        const displayName =
          [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
          "(unnamed)";

        const [poRow] = await tx
          .insert(principalObject)
          .values({
            objectType: "PERSON",
            code: sql`'PPERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
          })
          .returning();

        const [{ id }] = await tx
          .insert(person)
          .values({
            principalObjectId: poRow.id,
            code: poRow.code,
            type: "NATURAL",
            displayName,
            notes: row.notes ?? null,
          })
          .returning({ id: person.id });

        await tx.insert(naturalPerson).values({
          personId: id,
          firstName: row.firstName ?? null,
          lastName: row.lastName ?? null,
          nickname: row.nickname ?? null,
          cnp: row.cnp ?? null,
          idDocumentType: row.idDocumentType ?? null,
          idDocumentNumber: row.idDocumentNumber ?? null,
          gender: row.gender ?? null,
          dateOfBirth: row.dateOfBirth ?? null,
          personalPhone1: row.personalPhone1 ?? null,
          personalPhone2: row.personalPhone2 ?? null,
          workPhone: row.workPhone ?? null,
          personalEmail1: row.personalEmail1 ?? null,
          personalEmail2: row.personalEmail2 ?? null,
          workEmail: row.workEmail ?? null,
        });

        if (row.addresses?.length) {
          for (const a of row.addresses) {
            await tx.insert(address).values({
              personId: id,
              kind: a.kind,
              streetLine: a.streetLine ?? null,
              postalCode: a.postalCode ?? null,
              locality: a.locality ?? null,
              county: a.county ?? null,
              country: a.country,
              notes: a.notes ?? null,
            });
          }
        }
      }
    });
    console.log(`Seeded ${PERSONS.length} natural persons.`);
  }

  // ---- Properties ----
  const propCount = (
    await db.execute(sql`select count(*)::int as count from property`)
  ).rows[0] as { count: number };

  if (propCount.count > 0) {
    console.log(
      `property already has ${propCount.count} row(s); skipping properties seed.`,
    );
  } else {
    console.log(`Seeding ${PROPERTIES.length} properties...`);
    await db.transaction(async (tx) => {
      for (const row of PROPERTIES) {
        const [poPropRow] = await tx
          .insert(principalObject)
          .values({
            objectType: "PROPERTY",
            code: sql`'PROP' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
          })
          .returning();

        const [{ id }] = await tx
          .insert(property)
          .values({
            principalObjectId: poPropRow.id,
            code: poPropRow.code,
            nickname: row.nickname ?? null,
            tarlaSola: row.tarlaSola ?? null,
            parcela: row.parcela ?? null,
            cadastralNumber: row.cadastralNumber ?? null,
            carteFunciara: row.carteFunciara ?? null,
            surfaceAreaMp: row.surfaceAreaMp ?? null,
            notes: row.notes ?? null,
          })
          .returning({ id: property.id });

        if (row.address) {
          await tx.insert(propertyAddress).values({
            propertyId: id,
            streetLine: row.address.streetLine ?? null,
            postalCode: row.address.postalCode ?? null,
            locality: row.address.locality ?? null,
            county: row.address.county ?? null,
            country: row.address.country,
            notes: row.address.notes ?? null,
          });
        }

        for (let i = 0; i < row.corners.length; i++) {
          await tx.insert(propertyCorner).values({
            propertyId: id,
            sequenceNo: i + 1,
            lat: row.corners[i].lat,
            lon: row.corners[i].lon,
          });
        }
      }
    });
    console.log(`Seeded ${PROPERTIES.length} properties.`);
  }

  // ---- Documents ----
  const documentCount = (
    await db.execute(sql`select count(*)::int as count from document`)
  ).rows[0] as { count: number };

  if (documentCount.count > 0) {
    console.log(
      `document already has ${documentCount.count} row(s); skipping document seed.`,
    );
  } else {
    // Resolve every lookup_document_type.key -> id once, up front. These
    // rows are expected to already exist (seeded by
    // migration_020_rename_to_document.sql) — per standing instruction, the
    // seed script must never auto-create new document-type rows itself.
    const typeRows = await db
      .select({ id: lookupDocumentType.id, key: lookupDocumentType.key })
      .from(lookupDocumentType);
    const typeIdByKey = new Map(typeRows.map((r) => [r.key, r.id]));

    const missingKeys = [...new Set(DOCUMENTS.map((r) => r.typeKey))].filter(
      (k) => !typeIdByKey.has(k),
    );
    if (missingKeys.length > 0) {
      throw new Error(
        `Cannot seed documents — lookup_document_type is missing key(s): ${missingKeys.join(", ")}. ` +
          `Apply migration_020_rename_to_document.sql first.`,
      );
    }

    console.log(`Seeding ${DOCUMENTS.length} document records...`);
    await db.transaction(async (tx) => {
      for (const row of DOCUMENTS) {
        const [poDocRow] = await tx
          .insert(principalObject)
          .values({
            objectType: "DOCUMENT",
            code: sql`'DOC' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
          })
          .returning();

        await tx.insert(document).values({
          principalObjectId: poDocRow.id,
          code: poDocRow.code,
          documentTypeId: typeIdByKey.get(row.typeKey)!,
          title: row.title ?? null,
          nrDocument: row.nrDocument ?? null,
          dateDocument: row.dateDocument ?? null,
          institution: row.institution ?? null,
          emitent: row.emitent ?? null,
          bazaLegala: row.bazaLegala ?? null,
          uatProprietate: row.uatProprietate ?? null,
          uatProprietar: row.uatProprietar ?? null,
          suprafata: row.suprafata ?? null,
          nrDosarSuccesoral: row.nrDosarSuccesoral ?? null,
          dataDecesului: row.dataDecesului ?? null,
          ultimulDomiciliu: row.ultimulDomiciliu ?? null,
          nrCertificatDeces: row.nrCertificatDeces ?? null,
          dateStart: row.dateStart ?? null,
          dateEnd: row.dateEnd ?? null,
          titularText: row.titularText ?? null,
          defunctText: row.defunctText ?? null,
          partiesAText: row.partiesAText ?? null,
          partiesBText: row.partiesBText ?? null,
          notes: row.notes ?? null,
        });
      }
    });
    console.log(`Seeded ${DOCUMENTS.length} document records.`);
  }

  // ---- Judicial persons ----
  const judicialCount = (
    await db.execute(sql`select count(*)::int as count from judicial_person`)
  ).rows[0] as { count: number };

  if (judicialCount.count > 0) {
    console.log(
      `judicial_person already has ${judicialCount.count} row(s); skipping judicial persons seed.`,
    );
  } else {
    console.log(`Seeding ${JUDICIAL_PERSONS.length} judicial persons...`);

    // Resolve every lookup_judicial_person_type.name -> id once, up front.
    // These rows are expected to already exist (seeded by
    // migration_022_judicial_person_types.sql) — per standing instruction,
    // the seed script must never auto-create new judicial-person-type rows
    // itself.
    const judicialTypeRows = await db
      .select({ id: lookupJudicialPersonType.id, name: lookupJudicialPersonType.name })
      .from(lookupJudicialPersonType);
    const judicialTypeIdByName = new Map(judicialTypeRows.map((r) => [r.name, r.id]));

    const JUDICIAL_TYPE_LABEL_TO_NAME: Record<JudicialTypeLabel, string> = {
      SRL: "SRL",
      SA: "SA",
      SRL_D: "SRL-D",
      PFA: "PFA",
      II: "II",
      IF: "IF",
      ONG: "ONG",
      OTHER: "Altele",
    };

    const missingTypeNames = [
      ...new Set(JUDICIAL_PERSONS.map((r) => JUDICIAL_TYPE_LABEL_TO_NAME[r.judicialType])),
    ].filter((n) => !judicialTypeIdByName.has(n));
    if (missingTypeNames.length > 0) {
      throw new Error(
        `Cannot seed judicial persons — lookup_judicial_person_type is missing name(s): ${missingTypeNames.join(", ")}. ` +
          `Apply migration_022_judicial_person_types.sql first.`,
      );
    }

    // Fetch natural persons sorted by code so contactPerson1/2Idx resolve
    // deterministically (PPERS00001 = index 0, PPERS00002 = index 1, etc.).
    const naturalPersons = await db
      .select({ id: person.id })
      .from(person)
      .where(eq(person.type, "NATURAL"))
      .orderBy(person.code);

    await db.transaction(async (tx) => {
      for (const row of JUDICIAL_PERSONS) {
        const [poRow] = await tx
          .insert(principalObject)
          .values({
            objectType: "PERSON",
            code: sql`'JPERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0')`,
          })
          .returning();

        const [pRow] = await tx
          .insert(person)
          .values({
            principalObjectId: poRow.id,
            code: poRow.code,
            type: "JUDICIAL",
            displayName: row.name,
            notes: row.notes ?? null,
          })
          .returning();

        await tx.insert(judicialPerson).values({
          personId: pRow.id,
          name: row.name,
          nickname: row.nickname ?? null,
          judicialPersonTypeId:
            judicialTypeIdByName.get(JUDICIAL_TYPE_LABEL_TO_NAME[row.judicialType]) ?? null,
          cuiNumber: row.cuiNumber ?? null,
          tradeRegisterNumber: row.tradeRegisterNumber ?? null,
          contactPerson1Id:
            row.contactPerson1Idx !== undefined
              ? (naturalPersons[row.contactPerson1Idx]?.id ?? null)
              : null,
          contactPerson2Id:
            row.contactPerson2Idx !== undefined
              ? (naturalPersons[row.contactPerson2Idx]?.id ?? null)
              : null,
          correspondenceSameAsHq: row.correspondenceSameAsHq ?? false,
        });

        if (row.hqAddress) {
          await tx.insert(address).values({
            personId: pRow.id,
            kind: "HEADQUARTERS",
            streetLine: row.hqAddress.streetLine ?? null,
            postalCode: row.hqAddress.postalCode ?? null,
            locality: row.hqAddress.locality ?? null,
            county: row.hqAddress.county ?? null,
            country: row.hqAddress.country,
            notes: row.hqAddress.notes ?? null,
          });
        }

        // Only insert correspondence address when the "same as HQ" flag is off.
        if (row.correspondenceAddress && !(row.correspondenceSameAsHq ?? false)) {
          await tx.insert(address).values({
            personId: pRow.id,
            kind: "CORRESPONDENCE",
            streetLine: row.correspondenceAddress.streetLine ?? null,
            postalCode: row.correspondenceAddress.postalCode ?? null,
            locality: row.correspondenceAddress.locality ?? null,
            county: row.correspondenceAddress.county ?? null,
            country: row.correspondenceAddress.country,
            notes: row.correspondenceAddress.notes ?? null,
          });
        }
      }
    });
    console.log(`Seeded ${JUDICIAL_PERSONS.length} judicial persons.`);
  }
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
