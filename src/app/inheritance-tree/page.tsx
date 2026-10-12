import { Suspense } from "react";
import { InheritanceTreeScreen } from "./_components/inheritance-tree-screen";

/**
 * /inheritance-tree — „Rapoarte → Arbori de moștenire", the whole tree (A).          (Slice #39.11)
 *
 * The brief is „The Inheritance Tree.docx" (01.Slice.Inputs\Slices.39.01-39.13): every natural person with a family
 * tie, as a graph, the whole page, view only. B (one person's tree, a tile) and C (the action panel) are #39.12, which
 * also reads `?focus=<id>` here — so the screen renders under a Suspense boundary.
 */
export default function InheritanceTreePage() {
  return (
    <Suspense>
      <InheritanceTreeScreen />
    </Suspense>
  );
}
