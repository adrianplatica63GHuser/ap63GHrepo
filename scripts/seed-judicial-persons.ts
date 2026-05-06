/**
 * Seed script — creates 20 sample Judicial Persons in the local DB.
 *
 * Run from the repo root (requires Docker DB to be running):
 *   npx tsx --env-file=.env scripts/seed-judicial-persons.ts
 *
 * Note: migration 0004 must be applied first (npm run db:migrate, or paste
 * drizzle/0004_judicial_person.sql into pgAdmin if drizzle-kit skips it).
 */

import { createJudicialPerson } from "../src/lib/judicial-persons/queries";

const SEED_DATA = [
  { name: "SC Constructii Moderne SRL",   judicialType: "SRL" as const, cuiNumber: "RO10000001", tradeRegisterNumber: "J40/1001/2005", nickname: "ConstMod" },
  { name: "SA Investitii Capital SA",      judicialType: "SA"  as const, cuiNumber: "RO10000002", tradeRegisterNumber: "J40/1002/2000", nickname: "InvCap" },
  { name: "PFA Ionescu Gheorghe",          judicialType: "PFA" as const, cuiNumber: "RO10000003", tradeRegisterNumber: null,            nickname: null },
  { name: "SC Agro Vest SRL",             judicialType: "SRL" as const, cuiNumber: "RO10000004", tradeRegisterNumber: "J05/0204/2010", nickname: "AgroVest" },
  { name: "II Popescu & Fii",             judicialType: "II"  as const, cuiNumber: "RO10000005", tradeRegisterNumber: null,            nickname: "PopFii" },
  { name: "SC Terra Imobiliare SRL-D",    judicialType: "SRL_D" as const, cuiNumber: "RO10000006", tradeRegisterNumber: "J40/2060/2018", nickname: "TerraImob" },
  { name: "Asociatia Pro Mediu",          judicialType: "ONG" as const, cuiNumber: "RO10000007", tradeRegisterNumber: null,            nickname: "ProMediu" },
  { name: "SC Tehno Grup SA",             judicialType: "SA"  as const, cuiNumber: "RO10000008", tradeRegisterNumber: "J40/3080/1998", nickname: "TehnoGrup" },
  { name: "IF Dumitru si Asociatii",      judicialType: "IF"  as const, cuiNumber: "RO10000009", tradeRegisterNumber: null,            nickname: null },
  { name: "SC Timber Export SRL",         judicialType: "SRL" as const, cuiNumber: "RO10000010", tradeRegisterNumber: "J41/0410/2012", nickname: "TimberExp" },
  { name: "SC Digital Solutions SRL",     judicialType: "SRL" as const, cuiNumber: "RO10000011", tradeRegisterNumber: "J40/1111/2019", nickname: "DigiSol" },
  { name: "SA Energie Verde SA",          judicialType: "SA"  as const, cuiNumber: "RO10000012", tradeRegisterNumber: "J40/1212/2015", nickname: "EnVerde" },
  { name: "PFA Munteanu Vasile",          judicialType: "PFA" as const, cuiNumber: "RO10000013", tradeRegisterNumber: null,            nickname: null },
  { name: "SC Logistic Trans SRL",        judicialType: "SRL" as const, cuiNumber: "RO10000014", tradeRegisterNumber: "J15/0414/2008", nickname: "LogTrans" },
  { name: "Fundatia Ajutor Social",       judicialType: "ONG" as const, cuiNumber: "RO10000015", tradeRegisterNumber: null,            nickname: "AjutSoc" },
  { name: "SC Panificatie Cluj SRL-D",    judicialType: "SRL_D" as const, cuiNumber: "RO10000016", tradeRegisterNumber: "J12/0616/2020", nickname: "PanifCluj" },
  { name: "SC Metal Construct SRL",       judicialType: "SRL" as const, cuiNumber: "RO10000017", tradeRegisterNumber: "J40/1717/2003", nickname: "MetalConst" },
  { name: "IF Radu Consulting",           judicialType: "IF"  as const, cuiNumber: "RO10000018", tradeRegisterNumber: null,            nickname: "RaduCons" },
  { name: "SC Pharma Dist SA",            judicialType: "SA"  as const, cuiNumber: "RO10000019", tradeRegisterNumber: "J40/1919/2007", nickname: "PharmaDist" },
  { name: "SC Agentie Imobiliara SRL",    judicialType: "SRL" as const, cuiNumber: "RO10000020", tradeRegisterNumber: "J40/2020/2011", nickname: "AgImob" },
];

async function main() {
  console.log("Seeding 20 judicial persons…\n");
  let ok = 0;
  let fail = 0;

  for (const row of SEED_DATA) {
    try {
      const result = await createJudicialPerson({
        name: row.name,
        nickname: row.nickname ?? null,
        judicialType: row.judicialType,
        cuiNumber: row.cuiNumber,
        tradeRegisterNumber: row.tradeRegisterNumber ?? null,
        contactPerson1: null,
        contactPerson2: null,
        notes: null,
        addresses: [],
      });
      console.log(`  OK  ${result.person.code}  ${row.name}`);
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERR ${row.name}: ${msg}`);
      fail++;
    }
  }

  console.log(`\nDone — ${ok} created, ${fail} failed.`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
