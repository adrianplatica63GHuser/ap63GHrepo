/**
 * Every written quiz, by skill key.                                               (Slices #39.43, #39.44)
 *
 * The files hold the right answers. Read them on the server only — src/lib/skills/quiz-server.ts and the
 * scoring route — never from a client component: a client is handed `PresentedQuiz` (quiz.ts), which has none.
 * One file per skill, Romanian and English side by side; the Basic skills' in #39.43, the rest in #39.44.
 */
import type { QuizFile } from "../quiz";
import documentsAddParties from "./documents-add-parties.json";
import documentsAddendumAndCertificate from "./documents-addendum-and-certificate.json";
import documentsChainOfTitle from "./documents-chain-of-title.json";
import documentsChooseDocumentType from "./documents-choose-document-type.json";
import documentsCreateDocument from "./documents-create-document.json";
import documentsFillIdentification from "./documents-fill-identification.json";
import documentsReadPages from "./documents-read-pages.json";
import documentsSaleContract from "./documents-sale-contract.json";
import importBigAndSpecialFolders from "./import-big-and-special-folders.json";
import importCheckTheAiReading from "./import-check-the-ai-reading.json";
import importPrepareFolder from "./import-prepare-folder.json";
import importRunAnImport from "./import-run-an-import.json";
import importTeachANewDocumentType from "./import-teach-a-new-document-type.json";
import linksAssociateTwoRecords from "./links-associate-two-records.json";
import linksAuditTheHistory from "./links-audit-the-history.json";
import linksClassifyAndTag from "./links-classify-and-tag.json";
import linksFollowAChain from "./links-follow-a-chain.json";
import linksGroupsAndStamps from "./links-groups-and-stamps.json";
import linksLinkRecordsBothWays from "./links-link-records-both-ways.json";
import linksReadRelatedTile from "./links-read-related-tile.json";
import linksReadVersionHistory from "./links-read-version-history.json";
import linksReferencesAndParts from "./links-references-and-parts.json";
import linksRestoreAVersion from "./links-restore-a-version.json";
import linksWorkInTwoWindows from "./links-work-in-two-windows.json";
import personsAddJudicialPerson from "./persons-add-judicial-person.json";
import personsAddNaturalPersonByHand from "./persons-add-natural-person-by-hand.json";
import personsIdCardFromTheArchive from "./persons-id-card-from-the-archive.json";
import personsKeepIdentityCurrent from "./persons-keep-identity-current.json";
import personsLinkRelatives from "./persons-link-relatives.json";
import personsPersonFromIdCard from "./persons-person-from-id-card.json";
import personsReadInheritanceTree from "./persons-read-inheritance-tree.json";
import personsReconstructAnInheritance from "./persons-reconstruct-an-inheritance.json";
import propertiesAddPropertyByHand from "./properties-add-property-by-hand.json";
import propertiesDrawCorners from "./properties-draw-corners.json";
import propertiesFromCoordinateFile from "./properties-from-coordinate-file.json";
import propertiesMeasureOnTheMap from "./properties-measure-on-the-map.json";
import propertiesParcelDossier from "./properties-parcel-dossier.json";
import propertiesReadTheMap from "./properties-read-the-map.json";
import propertiesSideRoadCalculation from "./properties-side-road-calculation.json";
import workspaceArrangeTiles from "./workspace-arrange-tiles.json";
import workspaceSortAList from "./workspace-sort-a-list.json";
import workspaceFindInAList from "./workspace-find-in-a-list.json";
import workspaceGlobalSearch from "./workspace-global-search.json";
import workspaceInteractionsLinksAndExport from "./workspace-interactions-links-and-export.json";
import workspaceKeepTheArchiveInOrder from "./workspace-keep-the-archive-in-order.json";
import workspaceLogAnInteraction from "./workspace-log-an-interaction.json";
import workspaceReadARecordScreen from "./workspace-read-a-record-screen.json";
import workspaceReadHelp from "./workspace-read-help.json";
import workspaceReadInteractionHistory from "./workspace-read-interaction-history.json";
import workspaceReferenceData from "./workspace-reference-data.json";
import workspaceSettingsAndUsers from "./workspace-settings-and-users.json";
import workspaceSignInAndNavigate from "./workspace-sign-in-and-navigate.json";
import workspaceWriteHelp from "./workspace-write-help.json";

export const QUIZZES: Readonly<Record<string, QuizFile>> = {
  "documents-add-parties": documentsAddParties as QuizFile,
  "documents-addendum-and-certificate": documentsAddendumAndCertificate as QuizFile,
  "documents-chain-of-title": documentsChainOfTitle as QuizFile,
  "documents-choose-document-type": documentsChooseDocumentType as QuizFile,
  "documents-create-document": documentsCreateDocument as QuizFile,
  "documents-fill-identification": documentsFillIdentification as QuizFile,
  "documents-read-pages": documentsReadPages as QuizFile,
  "documents-sale-contract": documentsSaleContract as QuizFile,
  "import-big-and-special-folders": importBigAndSpecialFolders as QuizFile,
  "import-check-the-ai-reading": importCheckTheAiReading as QuizFile,
  "import-prepare-folder": importPrepareFolder as QuizFile,
  "import-run-an-import": importRunAnImport as QuizFile,
  "import-teach-a-new-document-type": importTeachANewDocumentType as QuizFile,
  "links-associate-two-records": linksAssociateTwoRecords as QuizFile,
  "links-audit-the-history": linksAuditTheHistory as QuizFile,
  "links-classify-and-tag": linksClassifyAndTag as QuizFile,
  "links-follow-a-chain": linksFollowAChain as QuizFile,
  "links-groups-and-stamps": linksGroupsAndStamps as QuizFile,
  "links-link-records-both-ways": linksLinkRecordsBothWays as QuizFile,
  "links-read-related-tile": linksReadRelatedTile as QuizFile,
  "links-read-version-history": linksReadVersionHistory as QuizFile,
  "links-references-and-parts": linksReferencesAndParts as QuizFile,
  "links-restore-a-version": linksRestoreAVersion as QuizFile,
  "links-work-in-two-windows": linksWorkInTwoWindows as QuizFile,
  "persons-add-judicial-person": personsAddJudicialPerson as QuizFile,
  "persons-add-natural-person-by-hand": personsAddNaturalPersonByHand as QuizFile,
  "persons-id-card-from-the-archive": personsIdCardFromTheArchive as QuizFile,
  "persons-keep-identity-current": personsKeepIdentityCurrent as QuizFile,
  "persons-link-relatives": personsLinkRelatives as QuizFile,
  "persons-person-from-id-card": personsPersonFromIdCard as QuizFile,
  "persons-read-inheritance-tree": personsReadInheritanceTree as QuizFile,
  "persons-reconstruct-an-inheritance": personsReconstructAnInheritance as QuizFile,
  "properties-add-property-by-hand": propertiesAddPropertyByHand as QuizFile,
  "properties-draw-corners": propertiesDrawCorners as QuizFile,
  "properties-from-coordinate-file": propertiesFromCoordinateFile as QuizFile,
  "properties-measure-on-the-map": propertiesMeasureOnTheMap as QuizFile,
  "properties-parcel-dossier": propertiesParcelDossier as QuizFile,
  "properties-read-the-map": propertiesReadTheMap as QuizFile,
  "properties-side-road-calculation": propertiesSideRoadCalculation as QuizFile,
  "workspace-arrange-tiles": workspaceArrangeTiles as QuizFile,
  "workspace-sort-a-list": workspaceSortAList as QuizFile,
  "workspace-find-in-a-list": workspaceFindInAList as QuizFile,
  "workspace-global-search": workspaceGlobalSearch as QuizFile,
  "workspace-interactions-links-and-export": workspaceInteractionsLinksAndExport as QuizFile,
  "workspace-keep-the-archive-in-order": workspaceKeepTheArchiveInOrder as QuizFile,
  "workspace-log-an-interaction": workspaceLogAnInteraction as QuizFile,
  "workspace-read-a-record-screen": workspaceReadARecordScreen as QuizFile,
  "workspace-read-help": workspaceReadHelp as QuizFile,
  "workspace-read-interaction-history": workspaceReadInteractionHistory as QuizFile,
  "workspace-reference-data": workspaceReferenceData as QuizFile,
  "workspace-settings-and-users": workspaceSettingsAndUsers as QuizFile,
  "workspace-sign-in-and-navigate": workspaceSignInAndNavigate as QuizFile,
  "workspace-write-help": workspaceWriteHelp as QuizFile,
};
