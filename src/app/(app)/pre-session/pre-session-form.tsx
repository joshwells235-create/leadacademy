"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPreSessionNote, type PreSessionState } from "@/lib/coach/actions";
import { FormField, TextInput, SubmitButton, FormError, FormSuccess } from "@/components/ui/form-field";

const init: PreSessionState = { status: "idle" };

export function PreSessionForm() {
  const [state, action, pending] = useActionState(createPreSessionNote, init);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") ref.current?.reset(); }, [state]);

  return (
    <form ref={ref} action={action} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
      {state.status === "error" && <FormError message={state.message} />}
      {state.status === "success" && <FormSuccess message={state.message} />}

      <FormField label="What do you want to talk about?" error={state.status === "error" ? state.fieldErrors?.wantToDiscuss : undefined}>
        <textarea name="wantToDiscuss" required rows={4} placeholder="The biggest thing on my mind right now is..." className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
      </FormField>

      <FormField label="What's been hard? (optional)">
        <textarea name="whatsBeenHard" rows={3} placeholder="I've been struggling with..." className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
      </FormField>

      <FormField label="What's going well? (optional)">
        <textarea name="whatsGoingWell" rows={3} placeholder="Something I'm proud of..." className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900" />
      </FormField>

      <div className="flex items-center justify-between">
        <FormField label="Session date (optional)">
          <TextInput type="date" name="sessionDate" />
        </FormField>
        <SubmitButton pending={pending} className="w-auto">Save prep notes</SubmitButton>
      </div>
    </form>
  );
}
