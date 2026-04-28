/**
 * Seed script — natural persons + land properties around Bragadiru.
 *
 * Run via `npm run db:seed`. Each domain object has its own idempotency
 * check: if the table already has rows it skips that section and moves on.
 * To re-seed from scratch, run: TRUNCATE person, property CASCADE;
 */

import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import {
  address,
  naturalPerson,
  person,
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
type UseCategory = "CATEG1" | "CATEG2" | "CATEG3";

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
  useCategory?: UseCategory;
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
    useCategory: "CATEG1", surfaceAreaMp: "512.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "621.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "480.00",
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
    useCategory: "CATEG2", surfaceAreaMp: "8450.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "550.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "710.00",
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
    useCategory: "CATEG2", surfaceAreaMp: "12300.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "495.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "580.00",
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
    useCategory: "CATEG3", surfaceAreaMp: "6200.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "430.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "660.00",
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
    useCategory: "CATEG2", surfaceAreaMp: "9800.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "520.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "475.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "390.00",
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
    useCategory: "CATEG3", surfaceAreaMp: "15400.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "540.00",
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
    useCategory: "CATEG2", surfaceAreaMp: "7600.00",
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
    useCategory: "CATEG1", surfaceAreaMp: "605.00",
    address: { streetLine: "Strada Independentei 3", postalCode: "077030", locality: "Bragadiru", county: "Ilfov", country: "Romania" },
    corners: [
      { lat: 44.41850, lon: 25.97380 },
      { lat: 44.41851, lon: 25.97448 },
      { lat: 44.41796, lon: 25.97447 },
      { lat: 44.41797, lon: 25.97381 },
    ],
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
    console.log(`Seeding ${PERSONS.length} natural persons...`);
    await db.transaction(async (tx) => {
      for (const row of PERSONS) {
        const displayName =
          [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
          "(unnamed)";

        const [{ id }] = await tx
          .insert(person)
          .values({ type: "NATURAL", displayName, notes: row.notes ?? null })
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
        const [{ id }] = await tx
          .insert(property)
          .values({
            type: "LAND",
            nickname: row.nickname ?? null,
            tarlaSola: row.tarlaSola ?? null,
            parcela: row.parcela ?? null,
            cadastralNumber: row.cadastralNumber ?? null,
            carteFunciara: row.carteFunciara ?? null,
            useCategory: row.useCategory ?? null,
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
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
