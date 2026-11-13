"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/components/cn";
import { AGENT_IDS, CONTRACTS } from "@/lib/config";
import { emptyMandateForm } from "@/lib/mandate";
import { splitTasks } from "@/lib/story";
import type { VaultView } from "@/lib/views";
import { Section } from "../live/ScreenState";
import type { OwnerControls } from "../wallet/useOwnerAction";
import { CreatedTask } from "./CreatedTask";
import { MandateForm } from "./MandateForm";
import { PILL } from "./owner-ui";
import { TaskCard } from "./TaskCard";

// The form's state lives here and in MandateForm, keyed by nothing from the view: a poll refresh
// re-renders it with new tasks and payments but never resets what the owner typed.
export function TasksSection({ view, now, owner }: { view: VaultView; now: number; owner?: OwnerControls }) {
  const creator = view.config.mode === "Lineage" ? owner : undefined;
  const [open, setOpen] = useState(false);
  const openBtn = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const { latest, earlier } = splitTasks(view);
  const task0 = view.tasks.find((t) => t.task.id === 0)?.task ?? null;
  const initial = useMemo(() => emptyMandateForm(AGENT_IDS[view.key], CONTRACTS.registry), [view.key]);

  useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      openBtn.current?.focus();
    }
  }, [open]);
  const close = () => {
    refocus.current = true;
    setOpen(false);
  };

  return (
    <Section
      id="tasks"
      title="Tasks"
      aside={
        creator && !open ? (
          <button ref={openBtn} type="button" disabled={creator.action.busy} onClick={() => setOpen(true)} className={cn(PILL, "text-foreground")}>
            <Plus className="size-3.5" aria-hidden="true" />
            New task
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        {creator && open && (
          <div className="max-w-[48rem]">
            <MandateForm owner={creator} initial={initial} demoAgent={AGENT_IDS.vault} task0={task0} onClose={close} />
          </div>
        )}
        {creator && <CreatedTask action={creator.action} />}
        {latest && (
          <div className="max-w-[40rem]">
            <TaskCard row={latest} now={now} />
          </div>
        )}
        {earlier.length > 0 && (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full py-1 text-small text-muted-foreground outline-none hover-fine:text-foreground focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
              Earlier tasks ({earlier.length})
            </summary>
            <div className="mt-5 grid gap-5 md:grid-cols-2 md:gap-6">
              {earlier.map((t) => (
                <TaskCard key={t.task.id} row={t} now={now} />
              ))}
            </div>
          </details>
        )}
      </div>
    </Section>
  );
}
