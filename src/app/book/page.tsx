import { BookingWizard } from "@/components/booking/wizard";

export const dynamic = "force-dynamic";

export default function BookPage() {
  return (
    <main className="flex-1">
      <BookingWizard />
    </main>
  );
}
