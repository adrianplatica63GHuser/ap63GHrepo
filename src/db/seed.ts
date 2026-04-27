/**
 * Seed script — 20 plausible Romanian natural persons with addresses.
 *
 * Run via `npm run db:seed`. Idempotent: if the `person` table already has
 * any rows, it skips and exits cleanly (so re-running doesn't duplicate).
 * To re-seed from scratch, manually `TRUNCATE person CASCADE;` first.
 *
 * The data is plausible but not real — names are drawn from common
 * Romanian first/last names; CNPs follow the structural format (sex+century,
 * YYMMDD, county code, serial) but the checksum is not real.
 */

import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import { address, naturalPerson, person } from "./schema";

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

type SeedRow = {
  firstName?: string;
  lastName?: string;
  nickname?: string;
  cnp?: string;
  idDocumentType?: IdDocType;
  idDocumentNumber?: string;
  gender?: Gender;
  dateOfBirth?: string; // YYYY-MM-DD
  personalPhone1?: string;
  personalPhone2?: string;
  workPhone?: string;
  personalEmail1?: string;
  personalEmail2?: string;
  workEmail?: string;
  notes?: string;
  addresses?: SeedAddress[];
};

const SEED: SeedRow[] = [
  {
    firstName: "Adrian",
    lastName: "Popescu",
    cnp: "1850203401234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "RX123456",
    gender: "MALE",
    dateOfBirth: "1985-02-03",
    personalEmail1: "adrian.popescu@example.ro",
    personalPhone1: "+40712345001",
    workEmail: "a.popescu@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Strada Florilor 12, Bl. A1, Sc. 1, Ap. 5", postalCode: "010101", locality: "București", county: "Sector 1", country: "Romania" },
    ],
  },
  {
    firstName: "Maria",
    lastName: "Ionescu",
    nickname: "Mara",
    cnp: "2920714125678",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "CJ234567",
    gender: "FEMALE",
    dateOfBirth: "1992-07-14",
    personalEmail1: "maria.ionescu@example.ro",
    personalPhone1: "+40712345002",
    addresses: [
      { kind: "HOME", streetLine: "Bulevardul Eroilor 45", postalCode: "400089", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "C.P. 234, OP 5", postalCode: "400500", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
    ],
  },
  {
    firstName: "Andrei",
    lastName: "Stoica",
    cnp: "1781122401234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "RX345678",
    gender: "MALE",
    dateOfBirth: "1978-11-22",
    personalPhone1: "+40712345003",
    workPhone: "+40212345003",
    workEmail: "andrei.stoica@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Calea Victoriei 100, Et. 4, Ap. 12", postalCode: "010091", locality: "București", county: "Sector 1", country: "Romania" },
    ],
  },
  {
    firstName: "Elena",
    lastName: "Marinescu",
    cnp: "2650408355678",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "TM456789",
    gender: "FEMALE",
    dateOfBirth: "1965-04-08",
    personalEmail1: "elena.marinescu@example.ro",
    personalPhone1: "+40712345004",
    addresses: [
      { kind: "HOME", streetLine: "Strada Mihai Viteazu 23", postalCode: "300222", locality: "Timișoara", county: "Timiș", country: "Romania" },
    ],
  },
  {
    firstName: "Cristian",
    lastName: "Popa",
    cnp: "1900125225678",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "IS567890",
    gender: "MALE",
    dateOfBirth: "1990-01-25",
    personalEmail1: "cristian.popa@example.ro",
    personalEmail2: "cris.popa.alt@example.ro",
    personalPhone1: "+40712345005",
    workEmail: "c.popa@firma.ro",
    notes: "Prefers contact via email.",
    addresses: [
      { kind: "HOME", streetLine: "Strada Lascăr Catargi 17", postalCode: "700107", locality: "Iași", county: "Iași", country: "Romania" },
    ],
  },
  {
    firstName: "Ioana",
    lastName: "Constantinescu",
    cnp: "2880930451234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "RX678901",
    gender: "FEMALE",
    dateOfBirth: "1988-09-30",
    personalEmail1: "ioana.constantinescu@example.ro",
    personalPhone1: "+40712345006",
    personalPhone2: "+40712345016",
    addresses: [
      { kind: "HOME", streetLine: "Aleea Castanilor 8", postalCode: "021234", locality: "București", county: "Sector 2", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "Str. Dorobanți 200, Ap. 33", postalCode: "010573", locality: "București", county: "Sector 1", country: "Romania" },
    ],
  },
  {
    firstName: "Mihai",
    lastName: "Stan",
    cnp: "1720615081234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "BV789012",
    gender: "MALE",
    dateOfBirth: "1972-06-15",
    personalPhone1: "+40712345007",
    workEmail: "mihai.stan@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Strada Republicii 45", postalCode: "500030", locality: "Brașov", county: "Brașov", country: "Romania" },
    ],
  },
  {
    firstName: "Andreea",
    lastName: "Dumitrescu",
    nickname: "Deea",
    cnp: "2950312141234",
    idDocumentType: "PASSPORT",
    idDocumentNumber: "P00123456",
    gender: "FEMALE",
    dateOfBirth: "1995-03-12",
    personalEmail1: "andreea.dumitrescu@example.ro",
    personalPhone1: "+40712345008",
    addresses: [
      { kind: "HOME", streetLine: "Bulevardul Mamaia 102", postalCode: "900527", locality: "Constanța", county: "Constanța", country: "Romania" },
    ],
  },
  {
    firstName: "Alexandru",
    lastName: "Munteanu",
    cnp: "1830819401234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "RX890123",
    gender: "MALE",
    dateOfBirth: "1983-08-19",
    personalEmail1: "alexandru.munteanu@example.ro",
    personalPhone1: "+40712345009",
    workPhone: "+40212345009",
    workEmail: "alex.munteanu@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Splaiul Independenței 290", postalCode: "060031", locality: "București", county: "Sector 6", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "OP 60 CP 100", postalCode: "060500", locality: "București", county: "Sector 6", country: "Romania" },
    ],
  },
  {
    firstName: "Cristina",
    lastName: "Rădulescu",
    cnp: "2801204291234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "PH901234",
    gender: "FEMALE",
    dateOfBirth: "1980-12-04",
    personalEmail1: "cristina.radulescu@example.ro",
    personalPhone1: "+40712345010",
    addresses: [
      { kind: "HOME", streetLine: "Strada Plevnei 28", postalCode: "100130", locality: "Ploiești", county: "Prahova", country: "Romania" },
    ],
  },
  {
    firstName: "Bogdan",
    lastName: "Georgescu",
    cnp: "1680527171234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "GL012345",
    gender: "MALE",
    dateOfBirth: "1968-05-27",
    personalPhone1: "+40712345011",
    workPhone: "+40236345011",
    addresses: [
      { kind: "HOME", streetLine: "Strada Domnească 45", postalCode: "800211", locality: "Galați", county: "Galați", country: "Romania" },
    ],
  },
  {
    firstName: "Monica",
    lastName: "Florescu",
    cnp: "2911011321234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "SB123456",
    gender: "FEMALE",
    dateOfBirth: "1991-10-11",
    personalEmail1: "monica.florescu@example.ro",
    personalPhone1: "+40712345012",
    addresses: [
      { kind: "HOME", streetLine: "Strada Mitropoliei 14", postalCode: "550179", locality: "Sibiu", county: "Sibiu", country: "Romania" },
    ],
  },
  {
    firstName: "Daniel",
    lastName: "Diaconu",
    cnp: "1860218121234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "CJ234567",
    gender: "MALE",
    dateOfBirth: "1986-02-18",
    personalEmail1: "daniel.diaconu@example.ro",
    personalEmail2: "ddiaconu@gmail.com",
    personalPhone1: "+40712345013",
    workEmail: "d.diaconu@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Strada Memorandumului 28", postalCode: "400114", locality: "Cluj-Napoca", county: "Cluj", country: "Romania" },
    ],
  },
  {
    firstName: "Alina",
    lastName: "Ungureanu",
    cnp: "2930729051234",
    idDocumentType: "PASSPORT",
    idDocumentNumber: "P00234567",
    gender: "FEMALE",
    dateOfBirth: "1993-07-29",
    personalEmail1: "alina.ungureanu@example.ro",
    personalPhone1: "+40712345014",
    addresses: [
      { kind: "HOME", streetLine: "Strada Republicii 12", postalCode: "410167", locality: "Oradea", county: "Bihor", country: "Romania" },
      { kind: "CORRESPONDENCE", streetLine: "OP Oradea CP 88", postalCode: "410500", locality: "Oradea", county: "Bihor", country: "Romania" },
    ],
  },
  {
    firstName: "George",
    lastName: "Stoicescu",
    cnp: "1750403401234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "RX345678",
    gender: "MALE",
    dateOfBirth: "1975-04-03",
    personalEmail1: "george.stoicescu@example.ro",
    personalPhone1: "+40712345015",
    workPhone: "+40212345015",
    workEmail: "g.stoicescu@firma.ro",
    addresses: [
      { kind: "HOME", streetLine: "Bulevardul Unirii 60", postalCode: "030828", locality: "București", county: "Sector 3", country: "Romania" },
    ],
  },
  {
    firstName: "Simona",
    lastName: "Vasilescu",
    cnp: "2821117401234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "RX456789",
    gender: "FEMALE",
    dateOfBirth: "1982-11-17",
    personalEmail1: "simona.vasilescu@example.ro",
    personalPhone1: "+40712345016",
    addresses: [
      { kind: "HOME", streetLine: "Strada Aviatorilor 8, Ap. 2", postalCode: "011854", locality: "București", county: "Sector 1", country: "Romania" },
    ],
  },
  {
    firstName: "Vlad",
    lastName: "Tudor",
    cnp: "1700908351234",
    idDocumentType: "PASSPORT",
    idDocumentNumber: "P00345678",
    gender: "MALE",
    dateOfBirth: "1970-09-08",
    personalPhone1: "+40712345017",
    workEmail: "vlad.tudor@firma.ro",
    notes: "Frequent traveller; prefers passport for ID.",
    addresses: [
      { kind: "HOME", streetLine: "Strada Eugeniu de Savoya 3", postalCode: "300087", locality: "Timișoara", county: "Timiș", country: "Romania" },
    ],
  },
  {
    firstName: "Mihaela",
    lastName: "Andreescu",
    nickname: "Mia",
    cnp: "2960622221234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "IS567890",
    gender: "FEMALE",
    dateOfBirth: "1996-06-22",
    personalEmail1: "mihaela.andreescu@example.ro",
    personalPhone1: "+40712345018",
    addresses: [
      { kind: "HOME", streetLine: "Strada Sărărie 56", postalCode: "700451", locality: "Iași", county: "Iași", country: "Romania" },
    ],
  },
  {
    // No CNP — foreign national scenario.
    firstName: "Lucian",
    lastName: "Iliescu",
    idDocumentType: "PASSPORT",
    idDocumentNumber: "P00456789",
    gender: "MALE",
    dateOfBirth: "1979-12-10",
    personalEmail1: "lucian.iliescu@example.com",
    personalPhone1: "+40712345019",
    notes: "Foreign-resident citizen; CNP not yet recorded.",
    addresses: [
      { kind: "HOME", streetLine: "Strada Castelului 23", postalCode: "500014", locality: "Brașov", county: "Brașov", country: "Romania" },
    ],
  },
  {
    // Surname only — partial onboarding case.
    lastName: "Mitrea",
    nickname: "Diana M.",
    cnp: "2890326141234",
    idDocumentType: "ID_CARD",
    idDocumentNumber: "CT678901",
    gender: "FEMALE",
    dateOfBirth: "1989-03-26",
    personalPhone1: "+40712345020",
    notes: "First name pending confirmation.",
    addresses: [
      { kind: "HOME", streetLine: "Bulevardul Tomis 88", postalCode: "900663", locality: "Constanța", county: "Constanța", country: "Romania" },
    ],
  },
];

async function seed() {
  // Idempotency check — skip if person already has rows.
  const result = await db.execute(
    sql`select count(*)::int as count from person`,
  );
  // pg's row format: array of plain objects.
  const count = (result.rows[0] as { count: number }).count;
  if (count > 0) {
    console.log(
      `person already has ${count} row(s); skipping seed. ` +
        "To re-seed from scratch, run: TRUNCATE person CASCADE;",
    );
    return;
  }

  console.log(`Seeding ${SEED.length} natural persons...`);

  await db.transaction(async (tx) => {
    for (const row of SEED) {
      const displayName =
        [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
        // Should never happen in this seed (every row has at least one name)
        // but be defensive: fall back to the auto-generated `code`.
        "(unnamed)";

      const [{ id }] = await tx
        .insert(person)
        .values({
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

  console.log(`Seeded ${SEED.length} natural persons.`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
