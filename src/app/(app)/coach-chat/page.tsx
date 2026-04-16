import { CoachChat } from "@/components/chat/coach-chat";

export default function CoachChatPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Talk through anything — a situation at work, something you're noticing, a half-formed goal. The
          coach knows your active goals and recent actions.
        </p>
      </div>
      <CoachChat
        mode="general"
        emptyHint={
          <div className="space-y-2">
            <p>A few ways to start:</p>
            <ul className="mx-auto inline-block text-left text-neutral-600">
              <li>• "I want to set a goal for leading my team better."</li>
              <li>• "Something happened at work today I want to think through."</li>
              <li>• "How should I use my 1:1s more effectively?"</li>
            </ul>
          </div>
        }
      />
    </div>
  );
}
