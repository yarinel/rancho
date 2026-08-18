import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Placeholder — the booking wizard is built in milestone M3. */
export default function BookPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <Card className="max-w-md w-full text-center flex flex-col gap-4 p-8">
        <h1 className="text-2xl font-bold">מה קרה לאופניים?</h1>
        <p className="text-ink-muted">
          ההזמנה אונליין בדרך אלינו. בינתיים — דברו איתנו ונסגור לכם ביקור.
        </p>
        <Button as={Link} href="/" variant="secondary">
          חזרה
        </Button>
      </Card>
    </main>
  );
}
