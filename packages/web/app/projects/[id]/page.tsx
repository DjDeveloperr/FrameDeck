import { notFound } from "next/navigation";
import { normalizeProjectBoards } from "@/lib/board-order";
import { EditorProvider } from "@/components/editor/EditorContext";
import { EditorShell } from "@/components/editor/EditorShell";
import { findProject, readScreen } from "@/lib/projects";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function ProjectPage({ params }: Params) {
  const { id } = await params;
  const project = findProject(id);
  if (!project) notFound();

  const boards = await normalizeProjectBoards(project);
  const firstBoard = boards[0];

  // Preload sources for every screen referenced by the first board so the
  // canvas paints immediately. Other boards lazy-load on switch.
  const preload = new Set<string>();
  if (firstBoard) for (const s of firstBoard.screens) preload.add(s.name);
  const initialScreens: { name: string; source: string }[] = [];
  for (const name of preload) {
    const source = await readScreen(id, name);
    if (source != null) initialScreens.push({ name, source });
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <EditorProvider
        projectId={id}
        initialBoards={boards}
        initialScreens={initialScreens}
        initialActiveBoardId={firstBoard?.id ?? null}
      >
        <EditorShell projectName={project.manifest.name} />
      </EditorProvider>
    </main>
  );
}
