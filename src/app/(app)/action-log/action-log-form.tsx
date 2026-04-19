"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  FormError,
  FormField,
  FormSuccess,
  SubmitButton,
  TextInput,
} from "@/components/ui/form-field";
import { type CreateActionLogState, createActionLog } from "@/lib/goals/actions";

const initialState: CreateActionLogState = { status: "idle" };

export function ActionLogForm({
  goals,
  preselectedGoalId,
}: {
  goals: { id: string; title: string }[];
  preselectedGoalId?: string;
}) {
  const [state, formAction, pending] = useActionState(createActionLog, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form after a successful submit.
  useEffect(() => {
    if (state.status === "success" && formRef.current) {
      formRef.current.reset();
    }
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);
  const preselectedGoal = preselectedGoalId ? goals.find((g) => g.id === preselectedGoalId) : null;

  return (
    <form ref={formRef} action={formAction} className="mt-3 space-y-3">
      {state.status === "error" && <FormError message={state.message} />}
      {state.status === "success" && <FormSuccess message={state.message} />}

      {preselectedGoal && (
        <div className="rounded-md border border-brand-blue/30 bg-brand-blue/5 px-3 py-2 text-xs">
          <p className="text-brand-blue">
            <span className="font-semibold">Logging against:</span> {preselectedGoal.title}
          </p>
          <p className="mt-0.5 text-neutral-600">
            Change this below if it belongs to a different goal.
          </p>
        </div>
      )}

      <FormField
        label="What did you do?"
        error={state.status === "error" ? state.fieldErrors?.description : undefined}
      >
        <textarea
          name="description"
          required
          rows={3}
          placeholder="Had the hard conversation with Priya about missed deadlines."
          className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
      </FormField>

      <FormField label="Tied to which goal?">
        <select
          name="goalId"
          defaultValue={preselectedGoalId ?? ""}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 ${
            preselectedGoal ? "border-brand-blue/40" : "border-neutral-300"
          }`}
        >
          <option value="">— none / general —</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Impact area">
          <select
            name="impactArea"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="">—</option>
            <option value="self">Self</option>
            <option value="others">Others</option>
            <option value="org">Org</option>
            <option value="all">All three</option>
          </select>
        </FormField>
        <FormField label="When?">
          <TextInput type="date" name="occurredOn" defaultValue={today} />
        </FormField>
      </div>

      <FormField
        label="Reflection (optional)"
        hint="What surprised you, what was hard, what you'd do differently."
      >
        <textarea
          name="reflection"
          rows={3}
          placeholder="It felt awkward for the first minute, then we actually got somewhere."
          className="w-full resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
      </FormField>

      <SubmitButton pending={pending}>Log it</SubmitButton>
    </form>
  );
}
