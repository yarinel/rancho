import { redirect } from "next/navigation";
import { getSlotsForToken } from "@/server/actions/schedule";
import { SlotPicker } from "@/components/booking/slot-picker";

export const dynamic = "force-dynamic";

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/book");
  const slots = await getSlotsForToken(token);
  if (!slots) redirect("/book");

  return (
    <main className="flex-1 mx-auto w-full max-w-md px-4 py-6">
      <SlotPicker requestToken={token} display={slots.display} all={slots.all} />
    </main>
  );
}
