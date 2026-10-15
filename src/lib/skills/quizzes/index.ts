/**
 * Every written quiz, by skill key.                                                           (Slice #39.43)
 *
 * The files hold the right answers. Read them on the server only — src/lib/skills/quiz-server.ts and the
 * scoring route — never from a client component: a client is handed `PresentedQuiz` (quiz.ts), which has none.
 * One file per skill, Romanian and English side by side; the Basic skills' in #39.43, the rest in #39.44.
 */
import type { QuizFile } from "../quiz";
import documentsChooseDocumentType from "./documents-choose-document-type.json";
import documentsCreateDocument from "./documents-create-document.json";
import documentsReadPages from "./documents-read-pages.json";
import importPrepareFolder from "./import-prepare-folder.json";
import linksAssociateTwoRecords from "./links-associate-two-records.json";
import linksReadRelatedTile from "./links-read-related-tile.json";
import linksReadVersionHistory from "./links-read-version-history.json";
import personsAddJudicialPerson from "./persons-add-judicial-person.json";
import personsAddNaturalPersonByHand from "./persons-add-natural-person-by-hand.json";
import propertiesAddPropertyByHand from "./properties-add-property-by-hand.json";
import propertiesReadTheMap from "./properties-read-the-map.json";
import workspaceFindInAList from "./workspace-find-in-a-list.json";
import workspaceGlobalSearch from "./workspace-global-search.json";
import workspaceLogAnInteraction from "./workspace-log-an-interaction.json";
import workspaceReadARecordScreen from "./workspace-read-a-record-screen.json";
import workspaceReadHelp from "./workspace-read-help.json";
import workspaceSignInAndNavigate from "./workspace-sign-in-and-navigate.json";

export const QUIZZES: Readonly<Record<string, QuizFile>> = {
  "documents-choose-document-type": documentsChooseDocumentType as QuizFile,
  "documents-create-document": documentsCreateDocument as QuizFile,
  "documents-read-pages": documentsReadPages as QuizFile,
  "import-prepare-folder": importPrepareFolder as QuizFile,
  "links-associate-two-records": linksAssociateTwoRecords as QuizFile,
  "links-read-related-tile": linksReadRelatedTile as QuizFile,
  "links-read-version-history": linksReadVersionHistory as QuizFile,
  "persons-add-judicial-person": personsAddJudicialPerson as QuizFile,
  "persons-add-natural-person-by-hand": personsAddNaturalPersonByHand as QuizFile,
  "properties-add-property-by-hand": propertiesAddPropertyByHand as QuizFile,
  "properties-read-the-map": propertiesReadTheMap as QuizFile,
  "workspace-find-in-a-list": workspaceFindInAList as QuizFile,
  "workspace-global-search": workspaceGlobalSearch as QuizFile,
  "workspace-log-an-interaction": workspaceLogAnInteraction as QuizFile,
  "workspace-read-a-record-screen": workspaceReadARecordScreen as QuizFile,
  "workspace-read-help": workspaceReadHelp as QuizFile,
  "workspace-sign-in-and-navigate": workspaceSignInAndNavigate as QuizFile,
};
