import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { statSync } from "node:fs";
import { join } from "node:path";
import { loadBoardsFromFs, registryProjectsRoot } from "@framedeck/core/fs";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "FrameDeck Projects",
  description: "Create and open local FrameDeck screenshot projects.",
};

export default function Home() {
  const projects = listProjects();
  const activeProjectId = process.env.FRAMEDECK_ACTIVE_PROJECT_ID;
  if (activeProjectId && projects.some((p) => p.manifest.id === activeProjectId)) {
    redirect(`/projects/${activeProjectId}`);
  }

  return (
    <main className="flex min-h-screen w-screen flex-col bg-ink-975">
      <header className="flex select-none items-center justify-between border-b border-ink-800 bg-ink-950 px-10 py-5">
        <div className="flex items-center gap-2.5">
          <div className="size-5 rounded-[5px] bg-ink-100" />
          <h1 className="text-[14px] font-semibold tracking-tight text-ink-50">FrameDeck</h1>
        </div>
        <div className="font-mono text-[11px] text-ink-500">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </div>
      </header>

      <div className="scrollbar-thin mx-auto w-full max-w-[1100px] flex-1 overflow-y-auto p-8">
        <CreateProjectForm libraryRoot={registryProjectsRoot()} />

        {projects.length === 0 ? (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-ink-800 p-12 text-center">
            <p className="text-ink-300">No projects yet.</p>
          </div>
        ) : (
          // auto-fill (not auto-fit) so a row with 1–2 cards doesn't stretch
          // them across the page; cards keep a compact 280–320px width and
          // empty grid tracks just stay blank on the right.
          <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 320px))" }}>
            {projects.map((p) => {
              // Surface up to 4 first screens as thumbnails. Use the on-demand
              // render endpoint so files don't need pre-generation.
              const manifest = loadBoardsFromFs(p.root, p.screens.map((s) => s.name));
              const board = manifest.boards[0];
              const previewNames = (board?.screens ?? [])
                .map((s) => s.name)
                .slice(0, 4);
              return (
                <li key={p.manifest.id}>
                  <Link
                    href={`/projects/${p.manifest.id}` as never}
                    className="group block overflow-hidden rounded-2xl border border-ink-800/70 bg-ink-900 transition hover:border-ink-700 hover:bg-ink-875"
                  >
                    <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-ink-50">
                          {p.manifest.name}
                        </h3>
                        {p.manifest.description && (
                          <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-400">
                            {p.manifest.description}
                          </p>
                        )}
                        <p className="mt-2 truncate font-mono text-[10.5px] text-ink-600" title={p.root}>
                          {p.root}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-ink-925 px-2 py-0.5 font-mono text-[10px] tabular-nums text-ink-400 ring-1 ring-ink-800">
                        {p.screens.length}
                      </span>
                    </div>

                    {previewNames.length > 0 && (
                      <div className="grid grid-cols-3 gap-1.5 px-4 pb-4">
                        {previewNames.slice(0, 3).map((name) => (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            key={name}
                            src={`/api/projects/${p.manifest.id}/render/${encodeURIComponent(name)}.png?v=${screenPreviewVersion(p.root, name)}`}
                            alt={name}
                            draggable={false}
                            className="block w-full rounded-md bg-ink-1000 object-cover object-top ring-1 ring-ink-800"
                            style={{
                              aspectRatio: "3 / 4",
                              userSelect: "none",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function screenPreviewVersion(projectRoot: string, name: string): number {
  try {
    return Math.trunc(statSync(join(projectRoot, "screens", `${name}.screen`)).mtimeMs);
  } catch {
    return Date.now();
  }
}
