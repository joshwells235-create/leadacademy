"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormError, FormField, FormSuccess, SubmitButton } from "@/components/ui/form-field";
import { type CreateReflectionState, createReflection } from "@/lib/reflections/actions";

const initialState: CreateReflectionState = { status: "idle" };

/**
 * Collapsible reflection form. On journals with existing entries, collapses
 * to a "Write a new reflection" button by default so history is immediately
 * visible without scrolling past the form. When there's no history yet, the
 * form is expanded as a natural prompt to start writing.
 */
export function ReflectionForm({ expandedByDefault = false }: { expandedByDefault?: boolean }) {
  const [state, formAction, pending] = useActionState(createReflection, initialState);
  const [expanded, setExpanded] = useState(expandedByDefault);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success" && formRef.current) {
      formRef.current.reset();
      if (!expandedByDefault) setExpanded(false);
    }
  }, [state, expandedByDefault]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-blue/40 bg-white px-4 py-3 text-sm font-medium text-brand-blue transition hover:border-brand-blue hover:bg-brand-blue/5"
      >
        <span aria-hidden>+</span>
        Write a new reflection
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction}>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        {state.status === "error" && <FormError message={state.message} />}
        {state.status === "success" && <FormSuccess message={state.message} />}

        <FormField
          label="What's on your mind?"
          hint="What happened today? What did you notice about yourself as a leader? No structure needed — just write."
          error={state.status === "error" ? state.fieldErrors?.content : undefined}
        >
          <textarea
            name="content"
            required
            rows={5}
            // biome-ignore lint/a11y/noAutofocus: user explicitly expanded the form to write
            autoFocus
            placeholder="Today I noticed that I..."
            className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </FormField>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <input
            type="date"
            name="reflectedOn"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700 shadow-sm"
          />
          <div className="flex items-center gap-2">
            {!expandedByDefault && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-xs text-neutral-600 hover:text-brand-navy disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            <SubmitButton pending={pending} className="w-auto">
              Save reflection
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
