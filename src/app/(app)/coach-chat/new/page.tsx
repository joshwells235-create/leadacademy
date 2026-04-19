import { redirect } from "next/navigation";

export default function NewCoachChat() {
  redirect("/coach-chat?new=1");
}
