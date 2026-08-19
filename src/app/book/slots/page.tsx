import { redirect } from "next/navigation";
import {
  getSlotsForJobToken,
  getSlotsForToken,
} from "@/server/actions/schedule";
import { SlotPicker } from "@/components/booking/slot-picker";

export const dynamic = "force-dynamic";

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; job?: string }>;
}) {
  const { token, job } = await searchParams;

  if (job) {
    // self-service reschedule of an existing SCHEDULED visit
    const slots = await getSlotsForJobToken(job);
    if (!slots) redirect(`/s/${job}`);
    return (
      <main className="flex-1 mx-auto w-full max-w-md px-4 py-6">
        <SlotPicker
          requestToken={job}
          display={slots.display}
          all={slots.all}
          mode="reschedule"
        />
      </main>
    );
  }

  if (!token) redirect("/book");
  const slots = await getSlotsForToken(token);
  if (!slots) redirect("/book");

  return (
    <main className="flex-1 mx-auto w-full max-w-md px-4 py-6">
      <SlotPicker requestToken={token} display={slots.display} all={slots.all} />
    </main>
  );
}
