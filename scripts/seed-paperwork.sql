-- Seed data for the `paperwork` table — Slice #4
-- 5–6 records per type, all labels in Romanian.
-- Run with:
--   Get-Content scripts\seed-paperwork.sql | docker exec -i ga40prj-postgres psql -U postgres -d ga40db

-- ── ACT_ADJUDECARE ───────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('ACT_ADJUDECARE', 'Adjudecare Teren Snagov',    '1234/2019', '2019-04-12', 'Judecătoria Buftea',   'Executare silită dosar 445/2018'),
  ('ACT_ADJUDECARE', 'Adjudecare Lot 3 Balotești', '887/2020',  '2020-09-03', 'Tribunalul Ilfov',     'Vânzare la licitație publică'),
  ('ACT_ADJUDECARE', 'Adjudecare Casă Cornetu',    '2201/2021', '2021-02-17', 'Judecătoria Buftea',   NULL),
  ('ACT_ADJUDECARE', 'Adjudecare Teren Cernica',   '556/2022',  '2022-06-29', 'Tribunalul Ilfov',     'Imobil adjudecat în urma executării'),
  ('ACT_ADJUDECARE', 'Adjudecare Parcelă Gruiu',   '310/2023',  '2023-11-08', 'Judecătoria Buftea',   NULL);

-- ── ACT_CADASTRU ─────────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('ACT_CADASTRU', 'Cadastru Teren Voluntari',    'CAD-1002/2018', '2018-07-15', 'OCPI Ilfov',     'Prima intabulare'),
  ('ACT_CADASTRU', 'Cadastru Lot Nord Snagov',    'CAD-2314/2019', '2019-03-22', 'OCPI Ilfov',     NULL),
  ('ACT_CADASTRU', 'Cadastru Parcelă Brănești',   'CAD-0887/2020', '2020-10-05', 'OCPI Ilfov',     'Actualizare după dezmembrare'),
  ('ACT_CADASTRU', 'Cadastru Teren Afumați',      'CAD-3001/2021', '2021-05-18', 'OCPI Ilfov',     NULL),
  ('ACT_CADASTRU', 'Cadastru Lot Tunari',         'CAD-1455/2022', '2022-08-30', 'OCPI Ilfov',     'Intabulare după retrocedare');

-- ── ACT_DONATIE ──────────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, parties_a_text, parties_b_text, notes) VALUES
  ('ACT_DONATIE', 'Donație Teren Voluntari',  '101/2017', '2017-06-10', 'Notariat Alexandru Dănilă', 'Ion Popescu',          'Maria Popescu',             NULL),
  ('ACT_DONATIE', 'Donație Casă Snagov',      '215/2019', '2019-01-25', 'Notariat Ion Grigorescu',   'Elena Constantin',     'Andrei Constantin',         'Imobil cu construcție'),
  ('ACT_DONATIE', 'Donație Lot Cernica',      '448/2020', '2020-07-14', 'Notariat Maria Florescu',   'Gheorghe Popa',        'Laura Popa, Sorin Popa',    NULL),
  ('ACT_DONATIE', 'Donație Teren Brănești',   '732/2021', '2021-09-08', 'Notariat Alexandru Dănilă', 'Vasile Radu',          'Daniela Radu',              NULL),
  ('ACT_DONATIE', 'Donație Parcelă Tunari',   '919/2022', '2022-03-30', 'Notariat Ion Grigorescu',   'Ana Stanescu',         'Mihai Stanescu',            'Donație intre soți');

-- ── AUTORIZATIE ──────────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('AUTORIZATIE', 'Autorizație Construire Vila Voluntari',  'AC-045/2018', '2018-04-20', 'Primăria Voluntari',  'Construcție P+1E, 220 mp'),
  ('AUTORIZATIE', 'Autorizație Demolare Anexă Snagov',     'AD-012/2019', '2019-08-11', 'Primăria Snagov',     'Anexă gospodărească 45 mp'),
  ('AUTORIZATIE', 'Autorizație Construire Gard Afumați',   'AC-103/2020', '2020-02-27', 'Primăria Afumați',    'Gard pe latura nordică'),
  ('AUTORIZATIE', 'Autorizație Extindere Locuință Gruiu',  'AC-067/2021', '2021-06-15', 'Primăria Gruiu',      'Extindere 35 mp la parter'),
  ('AUTORIZATIE', 'Autorizație Construire Magazie Tunari', 'AC-089/2023', '2023-03-04', 'Primăria Tunari',     'Construcție auxiliară 60 mp');

-- ── AVIZ_INSTITUTIE ──────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('AVIZ_INSTITUTIE', 'Aviz OCPI Ilfov — Dezmembrare',         'AV-234/2019', '2019-05-06', 'OCPI Ilfov',                   'Dezmembrare în 3 loturi'),
  ('AVIZ_INSTITUTIE', 'Aviz Primărie — PUZ Voluntari',         'AV-011/2020', '2020-09-14', 'Primăria Voluntari',           'Zonă rezidențială extinsă'),
  ('AVIZ_INSTITUTIE', 'Aviz Apele Române — Construcție Mal',   'AV-778/2021', '2021-04-22', 'Administrația Apele Române',   'Construcție la 50 m de lac'),
  ('AVIZ_INSTITUTIE', 'Aviz Drumuri Naționale — Acces',        'AV-342/2022', '2022-07-18', 'CNAIR — Direcția Ilfov',       'Acces rutier de pe DN1'),
  ('AVIZ_INSTITUTIE', 'Aviz Mediu — Extindere Fermă',          'AV-156/2023', '2023-01-30', 'ANPM Ilfov',                   'Extindere activitate agricolă');

-- ── CERTIFICAT_FISCAL ────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Ion Popescu',         'CF-1001/2020', '2020-03-10', 'ANAF — Administrația Ilfov', NULL),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal SC Imobil SRL',       'CF-2234/2021', '2021-07-25', 'ANAF — Administrația Ilfov', 'Lipsa datorii la data emiterii'),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Gheorghe Constantin', 'CF-0889/2021', '2021-11-04', 'ANAF — Administrația Ilfov', NULL),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Elena Dinu',          'CF-3301/2022', '2022-05-19', 'ANAF — Administrația Ilfov', NULL),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal PFA Radu Sorin',      'CF-4412/2023', '2023-08-08', 'ANAF — Administrația Ilfov', 'Valabil 30 zile de la emitere');

-- ── CERTIFICAT_MOSTENITOR ────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution,
  nr_dosar_succesoral, data_decesului, ultimul_domiciliu, nr_certificat_deces,
  defunct_text, parties_b_text, notes) VALUES
  ('CERTIFICAT_MOSTENITOR', 'Succesiune Popescu Vasile', '55/2018', '2018-09-12', 'Notariat Alexandru Dănilă',
    'DOS-120/2018', '2018-01-15', 'Str. Florilor 4, Voluntari', 'CD-334/2018',
    'Popescu Vasile', 'Popescu Ion, Popescu Maria', NULL),
  ('CERTIFICAT_MOSTENITOR', 'Succesiune Ionescu Ana',   '88/2019', '2019-04-30', 'Notariat Ion Grigorescu',
    'DOS-067/2019', '2018-11-22', 'Str. Trandafirilor 12, Snagov', 'CD-891/2018',
    'Ionescu Ana', 'Ionescu Cristian, Ionescu Laura', NULL),
  ('CERTIFICAT_MOSTENITOR', 'Succesiune Dumitrescu Gh.','112/2020', '2020-06-15', 'Notariat Maria Florescu',
    'DOS-203/2020', '2020-02-08', 'Bld. Unirii 5, Buftea', 'CD-102/2020',
    'Dumitrescu Gheorghe', 'Dumitrescu Elena', 'Masa succesorală include teren 2.500 mp'),
  ('CERTIFICAT_MOSTENITOR', 'Succesiune Popa Florina',  '74/2021', '2021-10-22', 'Notariat Alexandru Dănilă',
    'DOS-311/2021', '2021-03-17', 'Str. Luncii 8, Cernica', 'CD-445/2021',
    'Popa Florina', 'Popa Andrei, Popa Silvia, Popa Mihai', NULL),
  ('CERTIFICAT_MOSTENITOR', 'Succesiune Radu Constantin','201/2022', '2022-03-08', 'Notariat Ion Grigorescu',
    'DOS-089/2022', '2021-12-01', 'Str. Câmpului 23, Balotești', 'CD-778/2021',
    'Radu Constantin', 'Radu Vasile, Radu Carmen', NULL),
  ('CERTIFICAT_MOSTENITOR', 'Succesiune Stanescu Tudor', '330/2023', '2023-07-14', 'Notariat Maria Florescu',
    'DOS-415/2023', '2023-01-09', 'Str. Primăverii 1, Afumați', 'CD-023/2023',
    'Stanescu Tudor', 'Stanescu Adriana', 'Unicul moștenitor legal');

-- ── CERTIFICAT_SARCINI ───────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('CERTIFICAT_SARCINI', 'Certificat Sarcini CF 12345', 'CS-445/2019', '2019-06-20', 'OCPI Ilfov', 'Liber de sarcini la data emiterii'),
  ('CERTIFICAT_SARCINI', 'Certificat Sarcini CF 23890', 'CS-778/2020', '2020-11-03', 'OCPI Ilfov', 'Ipotecă înscrisă în favoarea BCR'),
  ('CERTIFICAT_SARCINI', 'Certificat Sarcini CF 34012', 'CS-102/2021', '2021-04-17', 'OCPI Ilfov', NULL),
  ('CERTIFICAT_SARCINI', 'Certificat Sarcini CF 41233', 'CS-556/2022', '2022-08-29', 'OCPI Ilfov', 'Liber de sarcini'),
  ('CERTIFICAT_SARCINI', 'Certificat Sarcini CF 50087', 'CS-890/2023', '2023-02-14', 'OCPI Ilfov', 'Sechestru asigurator înscris');

-- ── CERTIFICAT_URBANISM ──────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('CERTIFICAT_URBANISM', 'CU Construire Locuință Voluntari',  'CU-112/2018', '2018-05-14', 'Primăria Voluntari',  'Zonă rezidențială, POT 40%, CUT 1.2'),
  ('CERTIFICAT_URBANISM', 'CU Dezmembrare Lot Snagov',        'CU-034/2019', '2019-10-22', 'Primăria Snagov',     'Dezmembrare în 2 parcele'),
  ('CERTIFICAT_URBANISM', 'CU Extindere Imobil Gruiu',        'CU-209/2020', '2020-03-30', 'Primăria Gruiu',      NULL),
  ('CERTIFICAT_URBANISM', 'CU Amplasare Panouri Fotovoltaice','CU-067/2021', '2021-07-08', 'Primăria Afumați',    'Instalare 48 panouri pe acoperiș'),
  ('CERTIFICAT_URBANISM', 'CU Schimbare Destinație Spațiu',   'CU-445/2022', '2022-12-19', 'Primăria Tunari',     'Din depozit în spațiu comercial');

-- ── CONTRACT_ARENDA ──────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution,
  date_start, date_end, parties_a_text, parties_b_text, notes) VALUES
  ('CONTRACT_ARENDA', 'Arendă Teren Agricol Balotești', 'CA-001/2019', '2019-03-01', 'Primăria Balotești',
    '2019-03-01', '2024-02-28', 'Ion Popescu', 'SC AgroMax SRL', '12 ha teren arabil'),
  ('CONTRACT_ARENDA', 'Arendă Câmp Snagov',            'CA-045/2020', '2020-01-15', 'Primăria Snagov',
    '2020-02-01', '2025-01-31', 'Maria Ionescu, Vasile Ionescu', 'SC CerealeRom SA', '8 ha pășune și arabil'),
  ('CONTRACT_ARENDA', 'Arendă Teren Gruiu',            'CA-112/2020', '2020-06-10', 'Primăria Gruiu',
    '2020-07-01', '2023-06-30', 'Gheorghe Constantin', 'PFA Marin Dumitru', '5 ha arabil'),
  ('CONTRACT_ARENDA', 'Arendă Lot Agricol Cernica',    'CA-233/2021', '2021-04-05', 'Primăria Cernica',
    '2021-04-15', '2026-04-14', 'Elena Popa', 'SC FermaVerde SRL', '15 ha, inclusiv pășune'),
  ('CONTRACT_ARENDA', 'Arendă Teren Brănești',         'CA-089/2022', '2022-09-20', 'Primăria Brănești',
    '2022-10-01', '2027-09-30', 'Tudor Mocanu, Ana Mocanu', 'SC AgriLand SRL', '20 ha teren arabil');

-- ── CONTRACT_INCHIRIERE ──────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution,
  date_start, date_end, parties_a_text, parties_b_text, notes) VALUES
  ('CONTRACT_INCHIRIERE', 'Închiriere Apartament Voluntari', 'CI-301/2020', '2020-02-10', 'Primăria Voluntari',
    '2020-03-01', '2021-02-28', 'Ion Popescu', 'Andrei Marinescu', '3 camere, et. 2, 75 mp'),
  ('CONTRACT_INCHIRIERE', 'Închiriere Spațiu Comercial',    'CI-445/2021', '2021-05-20', 'Primăria Buftea',
    '2021-06-01', '2024-05-31', 'SC Imobil Invest SRL', 'SC Magazin Profi SRL', '120 mp parter'),
  ('CONTRACT_INCHIRIERE', 'Închiriere Casă Snagov',         'CI-112/2021', '2021-09-15', 'Primăria Snagov',
    '2021-10-01', '2022-09-30', 'Elena Constantin', 'Florina Niculescu', 'Casă P+1, 150 mp'),
  ('CONTRACT_INCHIRIERE', 'Închiriere Depozit Afumați',     'CI-778/2022', '2022-03-01', 'Primăria Afumați',
    '2022-04-01', '2025-03-31', 'SC LogiPark SRL', 'SC Distribuție Nord SRL', 'Depozit 500 mp'),
  ('CONTRACT_INCHIRIERE', 'Închiriere Birou Voluntari',     'CI-990/2023', '2023-07-12', 'Primăria Voluntari',
    '2023-08-01', '2024-07-31', 'Vasile Radu', 'PFA Stoica Cristian', 'Birou 45 mp, et. 1');

-- ── CONTRACT_PARTAJ ──────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('CONTRACT_PARTAJ', 'Partaj Voluntar Succesiune Popescu', '211/2019', '2019-08-20', 'Notariat Ion Grigorescu',   'Impartire lot 5.000 mp in 3 parti egale'),
  ('CONTRACT_PARTAJ', 'Partaj Bunuri Comune Ionescu',       '334/2020', '2020-04-14', 'Notariat Alexandru Dănilă', 'Partaj in urma divortului'),
  ('CONTRACT_PARTAJ', 'Partaj Succesoral Constantin',       '102/2021', '2021-11-09', 'Notariat Maria Florescu',   '2 moștenitori, câte 50%'),
  ('CONTRACT_PARTAJ', 'Partaj Teren Agricol Gruiu',         '567/2022', '2022-06-17', 'Notariat Ion Grigorescu',   'Lot de 8 ha împărțit în 4 parcele'),
  ('CONTRACT_PARTAJ', 'Partaj Imobil Snagov',               '801/2023', '2023-09-03', 'Notariat Alexandru Dănilă', NULL);

-- ── CONTRACT_PRESTARI_SERVICII ───────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Topografie Teren Voluntari', 'CPS-010/2020', '2020-03-25', 'SC TopoGeo SRL',        'Ridicare topografică 3 ha'),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Evaluare Imobil Snagov',    'CPS-078/2021', '2021-07-14', 'Evaluator Mihai Dinu',   'Evaluare imobil 450 mp'),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Consultanță Juridică',      'CPS-145/2021', '2021-12-01', 'Avocat Sorin Nistor',    'Asistență juridică tranzacție imobiliară'),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Mediere Litigiu Funciar',   'CPS-223/2022', '2022-05-19', 'Cabinet Mediere Iancu',  'Mediere dispută de hotar'),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Proiect Arhitectură',       'CPS-399/2023', '2023-02-28', 'SC ArchDesign SRL',      'Proiect construire P+1, 200 mp');

-- ── CONTRACT_VANZARE ─────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution,
  parties_a_text, parties_b_text, notes) VALUES
  ('CONTRACT_VANZARE', 'Vânzare Teren Voluntari 2.500 mp',  '1001/2018', '2018-06-14', 'Notariat Ion Grigorescu',   'Ion Popescu',                    'Alexandru Dumitrescu',           'Teren intravilan, CF 12345'),
  ('CONTRACT_VANZARE', 'Vânzare Casă Snagov',               '1234/2019', '2019-11-20', 'Notariat Maria Florescu',   'Elena Constantin',               'Gheorghe și Ana Popa',           'P+1, 180 mp utili'),
  ('CONTRACT_VANZARE', 'Vânzare Lot Agricol Balotești',     '0778/2020', '2020-04-08', 'Notariat Alexandru Dănilă', 'Maria Ionescu, Vasile Ionescu',  'SC AgroInvest SRL',              '12 ha teren arabil, CF 23890'),
  ('CONTRACT_VANZARE', 'Vânzare Apartament Buftea',         '2201/2021', '2021-09-30', 'Notariat Ion Grigorescu',   'Florina Niculescu',              'Andrei Marinescu',               '2 camere, 54 mp, CF 34012'),
  ('CONTRACT_VANZARE', 'Vânzare Teren Intravilan Cernica',  '3301/2022', '2022-03-15', 'Notariat Maria Florescu',   'Tudor Mocanu',                   'Carmen Iliescu',                 'Lot 1.200 mp'),
  ('CONTRACT_VANZARE', 'Vânzare Imobil Afumați',            '4455/2023', '2023-08-22', 'Notariat Alexandru Dănilă', 'Sorin Nistor',                   'Cristian Stoica, Laura Stoica',  'Casă + teren 850 mp, CF 50087');

-- ── EXTRAS_CARTE_FUNCIARA ────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF 12345 — Informare',     'ECF-001/2019', '2019-04-10', 'OCPI Ilfov', 'Extras pentru informare, valabil 30 zile'),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF 23890 — Autentificare', 'ECF-112/2020', '2020-07-22', 'OCPI Ilfov', 'Extras pentru autentificarea contractului'),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF 34012 — Informare',     'ECF-334/2021', '2021-02-18', 'OCPI Ilfov', NULL),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF 41233 — Autentificare', 'ECF-556/2022', '2022-10-05', 'OCPI Ilfov', 'Extras pentru vânzare-cumpărare'),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF 50087 — Informare',     'ECF-780/2023', '2023-05-30', 'OCPI Ilfov', NULL);

-- ── EXTRAS_PUG ───────────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('EXTRAS_PUG', 'Extras PUG Voluntari — Lot Nord',    'PUG-023/2019', '2019-08-07', 'Primăria Voluntari', 'Zonă rezidențială cu densitate mică'),
  ('EXTRAS_PUG', 'Extras PUG Snagov — Zonă Turism',   'PUG-011/2020', '2020-03-14', 'Primăria Snagov',    'Zonă de agrement și turism'),
  ('EXTRAS_PUG', 'Extras PUG Balotești — Agricol',    'PUG-067/2021', '2021-06-28', 'Primăria Balotești', 'Teren extravilan categorie arabil'),
  ('EXTRAS_PUG', 'Extras PUG Gruiu — Rezidențial',    'PUG-134/2022', '2022-09-12', 'Primăria Gruiu',     'Zonă rezidențială aprobată HCL 45/2022'),
  ('EXTRAS_PUG', 'Extras PUG Cernica — Industrial',   'PUG-290/2023', '2023-04-19', 'Primăria Cernica',   'Zonă industrială și servicii');

-- ── HOTARARE_JUDECATOREASCA ──────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes) VALUES
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Retrocedare Teren Voluntari', '1123/2017', '2017-11-08', 'Judecătoria Buftea',   'Dosar 334/2017 — retrocedare teren 3.000 mp, rămasă definitivă'),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Ieșire Indiviziune Snagov',   '445/2019',  '2019-06-25', 'Tribunalul Ilfov',     'Partaj judiciar, 4 coproprietari'),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Uzucapiune Cernica',          '2201/2020', '2020-09-17', 'Judecătoria Buftea',   'Uzucapiune tabulară, cf. art. 930 NCC'),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Grănițuire Balotești',        '889/2021',  '2021-04-12', 'Judecătoria Buftea',   'Stabilire linie de hotar, irevocabilă'),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Revendicare Imobiliară',      '3340/2022', '2022-12-06', 'Tribunalul Ilfov',     'Admisă cererea de revendicare, apel respins');

-- ── TESTAMENT ────────────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution,
  defunct_text, notes) VALUES
  ('TESTAMENT', 'Testament Popescu Ion',       '55/2016',  '2016-03-14', 'Notariat Ion Grigorescu',   'Popescu Ion',        'Testament autentic, lăsat un singur moștenitor'),
  ('TESTAMENT', 'Testament Constantin Elena',  '112/2018', '2018-09-22', 'Notariat Maria Florescu',   'Constantin Elena',   'Testatorul a desemnat doi legatari particulari'),
  ('TESTAMENT', 'Testament Radu Vasile',       '234/2020', '2020-01-10', 'Notariat Alexandru Dănilă', 'Radu Vasile',        NULL),
  ('TESTAMENT', 'Testament Popa Gheorghe',     '501/2021', '2021-07-05', 'Notariat Ion Grigorescu',   'Popa Gheorghe',      'Include clauză substituție vulgară'),
  ('TESTAMENT', 'Testament Stanescu Maria',    '789/2023', '2023-11-18', 'Notariat Maria Florescu',   'Stanescu Maria',     NULL);

-- ── TITLU_PROPRIETATE ────────────────────────────────────────────────────────
INSERT INTO paperwork (type, title, nr_document, date_document, institution,
  emitent, baza_legala, uat_proprietate, uat_proprietar, suprafata,
  titular_text, defunct_text, notes) VALUES
  ('TITLU_PROPRIETATE', 'Titlu Teren Arabil Voluntari',  '12345/2001', '2001-06-15', 'Comisia Locală Voluntari',
    'Comisia Județeană Ilfov',    'Legea 18/1991',    'Voluntari',   'Voluntari',   3.2000, 'Ion Popescu',      NULL,                NULL),
  ('TITLU_PROPRIETATE', 'Titlu Pășune Snagov',           '23890/2003', '2003-09-22', 'Comisia Locală Snagov',
    'Comisia Județeană Ilfov',    'Legea 169/1997',   'Snagov',      'Snagov',      7.5000, 'Maria Ionescu',    'Ionescu Vasile',    'Reconstituire după defunct'),
  ('TITLU_PROPRIETATE', 'Titlu Teren Extravilan Gruiu',  '34012/2005', '2005-04-08', 'Comisia Locală Gruiu',
    'Comisia Județeană Ilfov',    'HG 834/1991',      'Gruiu',       'Gruiu',       1.8500, 'Gheorghe Popa',    NULL,                NULL),
  ('TITLU_PROPRIETATE', 'Titlu Teren Agricol Cernica',   '41233/2007', '2007-11-30', 'Comisia Locală Cernica',
    'Comisia Județeană Ilfov',    'Legea 18/1991',    'Cernica',     'Cernica',     5.0000, 'Elena Constantin', 'Dumitrescu Ion',    'Reconstituire pe numele moștenitorului'),
  ('TITLU_PROPRIETATE', 'Titlu Fânețe Balotești',        '50087/2009', '2009-07-14', 'Comisia Locală Balotești',
    'Comisia Județeană Ilfov',    'Legea 169/1997',   'Balotești',   'Balotești',   2.1200, 'Ana Stanescu',     NULL,                NULL),
  ('TITLU_PROPRIETATE', 'Titlu Teren Arabil Brănești',   '62001/2012', '2012-03-19', 'Comisia Locală Brănești',
    'Comisia Județeană Ilfov',    'Legea 18/1991',    'Brănești',    'Brănești',    4.4000, 'Tudor Mocanu',     NULL,                '10 parcele comasate');
