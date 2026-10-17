/**
 * ANAF's answers, recorded, for the tests — the sandbox and CI cannot reach ANAF.                   (Slice #39.64)
 *
 * `ACTIVE` is ANAF's real answer on 2026-10-17 for CUI 2816464 (DEDEMAN SRL, a public company register entry), cut to
 * the blocks the app reads plus two it does not, so a reader that trips on an extra block is caught. `NOT_FOUND` is
 * its real answer for CUI 1 (HTTP 404). `INACTIVE` is invented — the same shape, a made-up company — because no real
 * inactive company belongs in a test.
 */
export const ACTIVE = {
  found: [
    {
      date_generale: {
        data: "2026-10-17",
        cui: 2816464,
        denumire: "DEDEMAN SRL",
        adresa: "JUD. BACĂU, MUN. BACĂU, STR. ALEXEI TOLSTOI, NR.8",
        telefon: "0234513330",
        fax: "0234581539",
        codPostal: "600093",
        act: "",
        stare_inregistrare: "INREGISTRAT din data 27.01.1993",
        organFiscalCompetent: "Direcţia Generală de Administrare a Marilor Contribuabili",
        forma_de_proprietate: "PROPR.PRIVATA-CAPITAL PRIVAT AUTOHTON",
        forma_organizare: "PERSOANA JURIDICA",
        forma_juridica: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
        data_inregistrare: "1993-01-27",
        statusRO_e_Factura: true,
        nrRegCom: "",
        cod_CAEN: "4752",
        iban: "",
      },
      inregistrare_scop_Tva: { scpTVA: true, perioade_TVA: [] },
      stare_inactiv: { dataInactivare: "", dataReactivare: "", dataPublicare: "", dataRadiere: "", statusInactivi: false },
      inregistrare_SplitTVA: { statusSplitTVA: false, dataInceputSplitTVA: "", dataAnulareSplitTVA: "" },
      adresa_sediu_social: {
        sdenumire_Localitate: "Mun. Bacău",
        sdenumire_Judet: "BACĂU",
        scod_Judet: "4",
        scod_JudetAuto: "BC",
        sdetalii_Adresa: "",
        scod_Postal: "600093",
        sdenumire_Strada: "Str. Alexei Tolstoi",
        snumar_Strada: "8",
        scod_Localitate: "11",
        stara: "",
      },
    },
  ],
  notFound: [],
};

export const NOT_FOUND = { found: [], notFound: [1] };

export const INACTIVE = {
  found: [
    {
      date_generale: {
        cui: 40000001,
        denumire: "EXEMPLU INACTIV SRL",
        adresa: "MUNICIPIUL BUCUREŞTI, SECTOR 3, STR. EXEMPLULUI, NR.1",
        telefon: "",
        codPostal: "",
        nrRegCom: "J40/1/2019",
        forma_juridica: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ - DEBUTANT",
      },
      stare_inactiv: { dataInactivare: "2024-05-03", dataReactivare: "", dataPublicare: "2024-05-03", dataRadiere: "", statusInactivi: true },
      adresa_sediu_social: {
        sdenumire_Localitate: "Sector 3 Mun. Bucureşti",
        sdenumire_Judet: "MUNICIPIUL BUCUREŞTI",
        sdenumire_Strada: "Str. Exemplului",
        snumar_Strada: "1",
        sdetalii_Adresa: "Bl. A, Ap. 2",
        scod_Postal: "030000",
        stara: "",
      },
    },
  ],
  notFound: [],
};
