"use client";

import { useEffect, useRef, useState } from "react";
import { createdTaskId } from "@/lib/mandate";
import { TxResult } from "../wallet/TxResult";
import { CREATE_TASK_ID, type OwnerAction } from "../wallet/useOwnerAction";
import { PILL } from "./owner-ui";

const COPIED_MS = 2000;

function RunCommand({ command }: { command: string }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onCopy = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(command);
      setCopy("copied");
      timer.current = setTimeout(() => setCopy("idle"), COPIED_MS);
    } catch {
      setCopy("failed");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground">Run the agent on it:</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <code className="inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] px-3 font-mono text-[12.5px] whitespace-nowrap text-foreground select-all">
          {command}
        </code>
        <button type="button" onClick={() => void onCopy()} className={PILL}>
          {copy === "copied" ? "Copied" : "Copy"}
        </button>
        <span aria-live="polite" className="text-small text-muted-foreground">
          {copy === "failed" ? "Select and copy" : copy === "copied" ? <span className="sr-only">Copied to clipboard</span> : null}
        </span>
      </div>
    </div>
  );
}

// After a create_task succeeds: the new id, the tx, and the one command that runs the agent on it.
export function CreatedTask({ action }: { action: OwnerAction }) {
  const { state } = action;
  if (state.kind !== "done" || state.id !== CREATE_TASK_ID || !state.result.ok) return null;
  const n = createdTaskId(state.result);
  return (
    <div data-testid="created-task" className="flex flex-col gap-3 text-small">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-foreground">
          {n === null ? (
            "Task created"
          ) : (
            <>
              Task <span className="num">#{n}</span> created
            </>
          )}
        </p>
        <TxResult state={state} />
      </div>
      {n !== null && <RunCommand command={`npm run demo -- --task ${n}`} />}
    </div>
  );
}
