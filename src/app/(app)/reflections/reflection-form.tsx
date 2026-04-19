"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormError, FormField, FormSuccess, SubmitButton } from "@/components/ui/form-field";
import { type CreateReflectionState, createReflection } from "@/lib/reflections/actions";

const initialState: CreateReflectionState = { status: "idle" };

export function ReflectionForm() {
  const [state, formAction, pending] = useActionState(createReflection, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success" && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

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
            placeholder="Today I noticed that I..."
            className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </FormField>

        <div className="mt-3 flex items-center justify-between">
          <input
            type="date"
            name="reflectedOn"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-700 shadow-sm"
          />
          <SubmitButton pending={pending} className="w-auto">
            Save reflection
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
