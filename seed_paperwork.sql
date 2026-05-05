-- seed_paperwork.sql
-- Seeds 5 sample records for each of the 19 paperwork types (95 rows total).
--
-- HOW TO USE:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- The `code` column is auto-generated from the paperwork_code_seq sequence.
-- All dates are ISO 8601 strings (YYYY-MM-DD).
-- Type-specific columns are NULL for types that don't use them.

-- ---------------------------------------------------------------------------
-- ACT_ADJUDECARE
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('ACT_ADJUDECARE', 'Adjudecare Teren Popescu Str. Lunca Cetățuii', '2145/2019', '2019-06-12', 'Tribunalul Iași', 'Dosar execuțional nr. 1234/2019'),
  ('ACT_ADJUDECARE', 'Adjudecare Apartament Bd. Copou nr. 14', '3301/2020', '2020-09-15', 'Judecătoria Iași', 'Imobil adjudecat în cadrul executării silite'),
  ('ACT_ADJUDECARE', 'Adjudecare Teren Agricol Tg. Frumos', '876/2021', '2021-03-22', 'Tribunalul Iași', NULL),
  ('ACT_ADJUDECARE', 'Adjudecare Hală Industrială Zona de Est', '4412/2018', '2018-11-05', 'Tribunalul București', 'Executare silită dosar 5678/2018'),
  ('ACT_ADJUDECARE', 'Adjudecare Teren Intravilan Pașcani', '667/2022', '2022-07-30', 'Judecătoria Pașcani', NULL);

-- ---------------------------------------------------------------------------
-- ACT_CADASTRU
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('ACT_CADASTRU', 'Act Cadastral Parcelă 42 Hlincea', '12345/2020', '2020-04-18', 'OCPI Iași', NULL),
  ('ACT_CADASTRU', 'Act Cadastral Teren Extravilan Parcela 15 Tarla 8', '23456/2021', '2021-08-09', 'OCPI Iași', 'Suprafată 3200 mp'),
  ('ACT_CADASTRU', 'Act Cadastral Construcție Str. Trandafirilor 7', '7890/2019', '2019-02-14', 'OCPI Suceava', NULL),
  ('ACT_CADASTRU', 'Act Cadastral Grădină Hlincea', '34512/2022', '2022-10-03', 'OCPI Iași', 'Suprafata 2450 mp'),
  ('ACT_CADASTRU', 'Act Cadastral Teren Forestier Bacău', '5621/2023', '2023-05-20', 'OCPI Bacău', NULL);

-- ---------------------------------------------------------------------------
-- ACT_DONATIE
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, parties_a_text, parties_b_text, notes)
VALUES
  ('ACT_DONATIE', 'Donație Teren Popescu → Ionescu', '1234/2018', '2018-05-10', 'BNP Andreescu Mihai', 'Popescu Ion', 'Ionescu Mihai', NULL),
  ('ACT_DONATIE', 'Donație Apartament Bd. Copou', '2345/2019', '2019-11-22', 'BNP Constantin Marin', 'Grigorescu Elena', 'Grigorescu Dan', NULL),
  ('ACT_DONATIE', 'Donație Teren Agricol Miroslava', '456/2021', '2021-06-15', 'BNP Popovici Simona', 'Dănilă Gheorghe', 'Dănilă Cosmin', NULL),
  ('ACT_DONATIE', 'Donație Casă de Locuit Str. Florilor 3', '3401/2020', '2020-03-08', 'BNP Tudose Adrian', 'Manolescu Vasile', 'Manolescu Ana; Manolescu Radu', 'Donatori — 2 copii minori'),
  ('ACT_DONATIE', 'Donație Garaj Str. Lalelelor 11', '789/2022', '2022-09-14', 'BNP Manolescu Radu', 'Popa Maria', 'Popa Victor', NULL);

-- ---------------------------------------------------------------------------
-- AUTORIZATIE
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('AUTORIZATIE', 'Autorizație de Construire Corp C1 Bd. Socola', 'AC 45/2020', '2020-07-01', 'Primăria Iași', 'P+1+M, suprafată construită 180 mp'),
  ('AUTORIZATIE', 'Autorizație de Demolare Str. Tei 22', 'AD 12/2021', '2021-04-15', 'Primăria Iași', 'Clădire P+1'),
  ('AUTORIZATIE', 'Autorizație de Construire Gard Miroslava', 'AC 103/2019', '2019-09-22', 'Primăria Miroslava', NULL),
  ('AUTORIZATIE', 'Autorizație de Construire Casă Pașcani', 'AC 78/2022', '2022-03-10', 'Primăria Pașcani', 'P+1+M, suprafată 245 mp'),
  ('AUTORIZATIE', 'Autorizație Funcționare Spațiu Comercial Bd. Tudor Vladimirescu', 'AF 34/2023', '2023-01-20', 'Primăria Iași', NULL);

-- ---------------------------------------------------------------------------
-- AVIZ_INSTITUTIE
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('AVIZ_INSTITUTIE', 'Aviz Agenția de Mediu Iași', 'AV 567/2021', '2021-05-18', 'Agenția de Mediu Iași', NULL),
  ('AVIZ_INSTITUTIE', 'Aviz Direcția de Sănătate Publică', 'AV 234/2020', '2020-08-03', 'DSP Iași', 'Favorabil cu condiții'),
  ('AVIZ_INSTITUTIE', 'Aviz ISC Inspectorat Construcții', 'AV 89/2022', '2022-06-12', 'ISC Iași', NULL),
  ('AVIZ_INSTITUTIE', 'Aviz Apele Române Zona de Protecție', 'AV 345/2019', '2019-10-25', 'Administrația Bazinală de Apă Prut-Bârlad', 'Construit în zona de protecție'),
  ('AVIZ_INSTITUTIE', 'Aviz Romgaz Conductă Gaze Naturale', 'AV 112/2023', '2023-04-07', 'Romgaz SA', NULL);

-- ---------------------------------------------------------------------------
-- CERTIFICAT_FISCAL
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Teren Miroslava', 'CF 1234/2021', '2021-03-15', 'Primăria Miroslava', NULL),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Apartament Iași Bd. Copou', 'CF 5678/2022', '2022-07-22', 'Primăria Iași — Serviciu Fiscal', NULL),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Casă Pașcani Str. Florilor', 'CF 890/2020', '2020-11-30', 'Primăria Pașcani', 'Fără datorii la data eliberării'),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Teren Agricol Hârlău', 'CF 234/2023', '2023-02-14', 'Primăria Hârlău', NULL),
  ('CERTIFICAT_FISCAL', 'Certificat Fiscal Spațiu Comercial Bd. Tudor', 'CF 4567/2019', '2019-08-06', 'Primăria Iași — Serviciu Fiscal', NULL);

-- ---------------------------------------------------------------------------
-- CERTIFICAT_MOSTENITOR
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (
  type, title, nr_document, date_document, institution,
  nr_dosar_succesoral, data_decesului, ultimul_domiciliu, nr_certificat_deces,
  defunct_text, parties_b_text, notes
)
VALUES
  ('CERTIFICAT_MOSTENITOR', 'CM Succesiune Ionescu Vasile', '234/2019', '2019-04-20', 'BNP Andreescu Mihai',
   '1234/2018', '2018-11-05', 'Iași, Str. Armoniei nr. 4', '12345/2018',
   'Ionescu Vasile', 'Ionescu Mihai; Ionescu Dana', NULL),
  ('CERTIFICAT_MOSTENITOR', 'CM Succesiune Grigorescu Maria', '567/2020', '2020-09-10', 'BNP Marin Constantin',
   '567/2019', '2019-06-22', 'Iași, Bd. Copou nr. 12', '7890/2019',
   'Grigorescu Maria', 'Grigorescu Dan; Grigorescu Elena', NULL),
  ('CERTIFICAT_MOSTENITOR', 'CM Succesiune Popa Gheorghe', '89/2021', '2021-12-03', 'BNP Popovici Simona',
   '89/2020', '2020-09-15', 'Pașcani, Str. Gării nr. 8', '3456/2020',
   'Popa Gheorghe', 'Popa Victor', NULL),
  ('CERTIFICAT_MOSTENITOR', 'CM Succesiune Dănilă Ion', '345/2022', '2022-05-18', 'BNP Tudose Adrian',
   '234/2021', '2021-03-08', 'Miroslava, Str. Principală nr. 22', '6789/2021',
   'Dănilă Ion', 'Dănilă Cosmin; Dănilă Ana', 'Doi moștenitori'),
  ('CERTIFICAT_MOSTENITOR', 'CM Succesiune Manole Elena', '678/2018', '2018-07-27', 'BNP Manolescu Radu',
   '456/2017', '2017-12-14', 'Iași, Str. Lăpușneanu nr. 3', '9012/2017',
   'Manole Elena', 'Manole Radu', NULL);

-- ---------------------------------------------------------------------------
-- CERTIFICAT_SARCINI
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('CERTIFICAT_SARCINI', 'Certificat de Sarcini Bd. Copou 12', 'CS 456/2021', '2021-02-08', 'OCPI Iași', 'Fără sarcini'),
  ('CERTIFICAT_SARCINI', 'Certificat de Sarcini Str. Gării 5 Pașcani', 'CS 789/2022', '2022-08-15', 'OCPI Iași', 'Ipotecă rangul I în favoarea BCR'),
  ('CERTIFICAT_SARCINI', 'Certificat de Sarcini Teren Miroslava', 'CS 123/2020', '2020-04-30', 'OCPI Iași', NULL),
  ('CERTIFICAT_SARCINI', 'Certificat de Sarcini Teren Agricol Bacău', 'CS 234/2019', '2019-11-22', 'OCPI Bacău', 'Fără sarcini'),
  ('CERTIFICAT_SARCINI', 'Certificat de Sarcini Hală Industrială', 'CS 567/2023', '2023-03-05', 'OCPI Iași', NULL);

-- ---------------------------------------------------------------------------
-- CERTIFICAT_URBANISM
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('CERTIFICAT_URBANISM', 'Certificat Urbanism Str. Armoniei 8 Iași', 'CU 345/2020', '2020-06-18', 'Primăria Iași', 'Zonă rezidențială R2'),
  ('CERTIFICAT_URBANISM', 'Certificat Urbanism Construire Casă Miroslava', 'CU 678/2021', '2021-09-25', 'Primăria Miroslava', 'Zonă rezidențială R1'),
  ('CERTIFICAT_URBANISM', 'Certificat Urbanism Extindere Locuință Iași', 'CU 234/2019', '2019-05-12', 'Primăria Iași', NULL),
  ('CERTIFICAT_URBANISM', 'Certificat Urbanism Teren Industrial Pașcani', 'CU 890/2022', '2022-11-08', 'Primăria Pașcani', 'Zonă industrială'),
  ('CERTIFICAT_URBANISM', 'Certificat Urbanism Mansardare Bd. Copou', 'CU 112/2023', '2023-07-14', 'Primăria Iași', NULL);

-- ---------------------------------------------------------------------------
-- CONTRACT_ARENDA
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, date_start, date_end, parties_a_text, parties_b_text, notes)
VALUES
  ('CONTRACT_ARENDA', 'Arendă Teren Agricol 5 ha Miroslava', '1/2020', '2020-03-01', NULL, '2020-03-01', '2025-02-28', 'Popescu Ion', 'SC Agro Invest SRL', NULL),
  ('CONTRACT_ARENDA', 'Arendă Teren Agricol 12 ha Hârlău', '5/2019', '2019-04-10', NULL, '2019-04-10', '2024-04-09', 'Grigorescu Vasile; Grigorescu Maria', 'SC Cerealcom SA', NULL),
  ('CONTRACT_ARENDA', 'Arendă Teren Agricol 3 ha Tg. Frumos', '2/2021', '2021-05-15', NULL, '2021-05-15', '2026-05-14', 'Ionescu Dan', 'SC Ferma Nordică SRL', 'Arendă pe 5 ani'),
  ('CONTRACT_ARENDA', 'Arendă Pășune Comună Hlincea', '8/2022', '2022-01-20', NULL, '2022-01-20', '2027-01-19', 'Dănilă Gheorghe', 'SC Bovine SRL', NULL),
  ('CONTRACT_ARENDA', 'Arendă Teren Agricol 8 ha Pașcani', '3/2023', '2023-02-01', NULL, '2023-02-01', '2028-01-31', 'Manole Elena (moștenitori)', 'SC Agro Nord SRL', NULL);

-- ---------------------------------------------------------------------------
-- CONTRACT_INCHIRIERE
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, date_start, date_end, parties_a_text, parties_b_text, notes)
VALUES
  ('CONTRACT_INCHIRIERE', 'Închiriere Apartament Bd. Copou 12', '14/2021', '2021-09-01', NULL, '2021-09-01', '2022-08-31', 'Ionescu Mihai', 'Popa Victor', NULL),
  ('CONTRACT_INCHIRIERE', 'Închiriere Spațiu Comercial Piața Unirii', '7/2020', '2020-01-15', NULL, '2020-02-01', '2023-01-31', 'SC Imob Invest SRL', 'SC Magazin Popular SRL', 'Suprafată 85 mp'),
  ('CONTRACT_INCHIRIERE', 'Închiriere Locuință Str. Trandafirilor 7', '22/2022', '2022-06-01', NULL, '2022-06-01', '2023-05-31', 'Grigorescu Dan', 'Manolescu Radu', NULL),
  ('CONTRACT_INCHIRIERE', 'Închiriere Garaj Str. Lalelelor 11', '3/2019', '2019-03-10', NULL, '2019-04-01', '2020-03-31', 'Dănilă Cosmin', 'Popescu Ion', NULL),
  ('CONTRACT_INCHIRIERE', 'Închiriere Birou Etaj 2 Bd. Tudor Vladimirescu', '11/2023', '2023-01-10', NULL, '2023-02-01', '2025-01-31', 'SC Clădire Nouă SRL', 'SC IT Solutions SRL', 'Contract pe 2 ani');

-- ---------------------------------------------------------------------------
-- CONTRACT_PARTAJ
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, parties_a_text, parties_b_text, notes)
VALUES
  ('CONTRACT_PARTAJ', 'Partaj Succesoral Imobil Str. Armoniei', '345/2019', '2019-07-15', 'BNP Andreescu Mihai', 'Ionescu Mihai; Ionescu Dana', NULL, 'Partaj voluntar'),
  ('CONTRACT_PARTAJ', 'Partaj Bun Comun Teren Miroslava', '678/2020', '2020-11-22', 'BNP Marin Constantin', 'Grigorescu Dan; Grigorescu Elena', NULL, 'Partaj în urma divorțului'),
  ('CONTRACT_PARTAJ', 'Partaj Succesoral Casă Pașcani', '123/2021', '2021-04-08', 'BNP Popovici Simona', 'Popa Victor; Popa Ana; Popa Marian', NULL, 'Trei moștenitori'),
  ('CONTRACT_PARTAJ', 'Partaj Teren Agricol Hârlău', '456/2022', '2022-09-30', 'BNP Tudose Adrian', 'Dănilă Cosmin; Dănilă Ioana', NULL, NULL),
  ('CONTRACT_PARTAJ', 'Partaj Apartament Bd. Independenței', '789/2023', '2023-03-14', 'BNP Manolescu Radu', 'Manole Radu; Manole Cristina', NULL, NULL);

-- ---------------------------------------------------------------------------
-- CONTRACT_PRESTARI_SERVICII
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, parties_a_text, parties_b_text, notes)
VALUES
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Prestări Servicii Topografie 2021', '1/2021', '2021-03-01', NULL, 'SC TopoGeo SRL', 'Ionescu Mihai', NULL),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Proiectare Arhitecturală', '5/2020', '2020-07-10', NULL, 'SC Arhitect Studio SRL', 'SC Imob Invest SRL', 'Proiect tehnic P+1'),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Servicii Juridice Consultanță', '12/2022', '2022-05-20', NULL, 'Cabinet Avocatură Popescu', 'Grigorescu Dan', NULL),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Evaluare Imobiliară', '3/2019', '2019-09-05', NULL, 'SC Evalimob SRL', 'BCR SA', 'Evaluare pentru garanție bancară'),
  ('CONTRACT_PRESTARI_SERVICII', 'Contract Administrare Imobil Bd. Copou', '8/2023', '2023-06-01', NULL, 'SC Admin Imobiliare SRL', 'Dănilă Cosmin', NULL);

-- ---------------------------------------------------------------------------
-- CONTRACT_VANZARE
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, parties_a_text, parties_b_text, notes)
VALUES
  ('CONTRACT_VANZARE', 'Vânzare Teren Intravilan Miroslava', '1234/2021', '2021-06-25', 'BNP Andreescu Mihai', 'Popescu Ion', 'Ionescu Mihai', NULL),
  ('CONTRACT_VANZARE', 'Vânzare Apartament 3 Camere Bd. Copou', '2345/2020', '2020-10-12', 'BNP Marin Constantin', 'Grigorescu Vasile; Grigorescu Maria', 'Popa Victor', 'Preț: 85.000 EUR'),
  ('CONTRACT_VANZARE', 'Vânzare Teren Agricol 10 ha Hârlău', '567/2022', '2022-03-18', 'BNP Popovici Simona', 'Dănilă Gheorghe', 'SC Agro Invest SRL', NULL),
  ('CONTRACT_VANZARE', 'Vânzare Casă P+1 Str. Florilor 3', '890/2019', '2019-08-30', 'BNP Tudose Adrian', 'Manolescu Vasile', 'Manolescu Ana', 'Preț: 120.000 EUR'),
  ('CONTRACT_VANZARE', 'Vânzare Spațiu Comercial Pașcani', '3456/2023', '2023-04-05', 'BNP Manolescu Radu', 'SC Comercial Nord SRL', 'Ionescu Dan', NULL);

-- ---------------------------------------------------------------------------
-- EXTRAS_CARTE_FUNCIARA
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF nr. 12345 Iași Bd. Copou 12', '12345', '2021-07-14', 'OCPI Iași', NULL),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF nr. 23456 Miroslava Parcela 15', '23456', '2022-02-28', 'OCPI Iași', 'Extras pentru informare'),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF nr. 5678 Pașcani Str. Gării', '5678', '2020-11-10', 'OCPI Iași', NULL),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF nr. 34567 Hârlău Teren Agricol', '34567', '2019-05-20', 'OCPI Iași', 'Extras autentificare'),
  ('EXTRAS_CARTE_FUNCIARA', 'Extras CF nr. 78901 Iași Zona Industrială', '78901', '2023-08-22', 'OCPI Iași', NULL);

-- ---------------------------------------------------------------------------
-- EXTRAS_PUG
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('EXTRAS_PUG', 'Extras PUG Municipiul Iași Zona Copou', 'PUG-IS-2018/456', '2021-04-12', 'Primăria Iași — Urbanism', 'Zonă rezidențială R2'),
  ('EXTRAS_PUG', 'Extras PUG Comună Miroslava', 'PUG-MIR-2020/89', '2022-09-05', 'Primăria Miroslava', 'Zonă agricolă cu posibilitate de construire'),
  ('EXTRAS_PUG', 'Extras PUG Municipiul Pașcani Zona Industrială', 'PUG-PAS-2019/234', '2020-07-18', 'Primăria Pașcani', 'Zonă industrială — permis construire industrie ușoară'),
  ('EXTRAS_PUG', 'Extras PUG Oraș Hârlău', 'PUG-HAR-2017/67', '2019-03-25', 'Primăria Hârlău', NULL),
  ('EXTRAS_PUG', 'Extras PUG Comună Tg. Frumos Teren Nord', 'PUG-TGF-2021/112', '2023-01-30', 'Primăria Tg. Frumos', NULL);

-- ---------------------------------------------------------------------------
-- HOTARARE_JUDECATOREASCA
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, notes)
VALUES
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Tribunal Partaj Imobil Str. Armoniei', '1234/2019', '2019-10-15', 'Tribunalul Iași', 'Definitivă și irevocabilă'),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Divorț și Partaj Bd. Independenței', '5678/2020', '2020-06-22', 'Judecătoria Iași', 'Rămasă definitivă'),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Succesiune Contestată Popa', '890/2021', '2021-11-08', 'Tribunalul Iași', NULL),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Rectificare CF Miroslava', '234/2022', '2022-04-30', 'Judecătoria Iași', 'Dispune rectificarea în CF'),
  ('HOTARARE_JUDECATOREASCA', 'Hotărâre Uzucapiune Teren Hârlău', '4567/2023', '2023-07-19', 'Judecătoria Hârlău', 'Posesie > 30 ani');

-- ---------------------------------------------------------------------------
-- TESTAMENT
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (type, title, nr_document, date_document, institution, defunct_text, parties_b_text, notes)
VALUES
  ('TESTAMENT', 'Testament Autentic Ionescu Vasile', '1/2015', '2015-03-20', 'BNP Andreescu Mihai', 'Ionescu Vasile', 'Ionescu Mihai', 'Lăsă întreaga avere fiului'),
  ('TESTAMENT', 'Testament Olograf Grigorescu Maria', NULL, '2018-06-10', NULL, 'Grigorescu Maria', 'Grigorescu Dan; Grigorescu Elena', 'Înregistrat la notar după deces'),
  ('TESTAMENT', 'Testament Autentic Popa Ion', '3/2016', '2016-09-05', 'BNP Marin Constantin', 'Popa Ion', 'Popa Victor', NULL),
  ('TESTAMENT', 'Testament Autentic Dănilă Gheorghe', '7/2019', '2019-12-14', 'BNP Popovici Simona', 'Dănilă Gheorghe', 'Dănilă Cosmin; Dănilă Ioana', NULL),
  ('TESTAMENT', 'Testament Autentic Manolescu Elena', '2/2021', '2021-08-28', 'BNP Tudose Adrian', 'Manolescu Elena', 'Manolescu Radu', 'Testament revocat ulterior — a se verifica');

-- ---------------------------------------------------------------------------
-- TITLU_PROPRIETATE
-- ---------------------------------------------------------------------------
INSERT INTO paperwork (
  type, title, nr_document, date_document, institution,
  emitent, baza_legala, uat_proprietate, uat_proprietar, suprafata,
  titular_text, notes
)
VALUES
  ('TITLU_PROPRIETATE', 'Titlu Proprietate Teren Agricol Miroslava 5 ha', '123456/1997', '1997-08-15', 'Comisia Județeană Iași',
   'Comisia Județeană pentru Stabilirea Dreptului de Proprietate Iași', 'Legea nr. 18/1991', 'Miroslava', 'Iași', 50000,
   'Popescu Ion', NULL),
  ('TITLU_PROPRIETATE', 'Titlu Proprietate Teren Intravilan Hlincea', '78901/2000', '2000-04-22', 'Comisia Județeană Iași',
   'Comisia Județeană pentru Stabilirea Dreptului de Proprietate Iași', 'Legea nr. 18/1991', 'Ciurea', 'Iași', 2500,
   'Grigorescu Vasile; Grigorescu Maria', NULL),
  ('TITLU_PROPRIETATE', 'Titlu Proprietate Pășune Tg. Frumos', '34567/1996', '1996-06-10', 'Comisia Județeană Iași',
   'Comisia Județeană pentru Stabilirea Dreptului de Proprietate Iași', 'Legea nr. 18/1991', 'Tg. Frumos', 'Iași', 32000,
   'Dănilă Gheorghe', NULL),
  ('TITLU_PROPRIETATE', 'Titlu Proprietate Teren Extravilan Hârlău', '23456/1995', '1995-11-30', 'Comisia Județeană Iași',
   'Comisia Județeană pentru Stabilirea Dreptului de Proprietate Iași', 'Legea nr. 18/1991', 'Hârlău', 'Iași', 48000,
   'Manolescu Vasile', 'Reconstituit conform legii fondului funciar'),
  ('TITLU_PROPRIETATE', 'Titlu Proprietate Grădină Pașcani', '56789/1999', '1999-07-18', 'Comisia Județeană Iași',
   'Comisia Județeană pentru Stabilirea Dreptului de Proprietate Iași', 'Legea nr. 169/1997', 'Pașcani', 'Iași', 3200,
   'Ionescu Dan', NULL);
