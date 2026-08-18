import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* Poster moment — brand energy lives here, not in the forms */}
      <section className="surface-poster bg-bg text-ink flex flex-col items-center justify-center gap-6 px-6 py-14 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, exact rendering */}
        <img
          src="/logo-480.png"
          alt="רנצ'ו — תיקוני אופניים עד הבית. אנחנו מתקנים, אתם רוכבים."
          width={240}
          height={240}
          className="w-52 sm:w-60 h-auto"
        />
        <h1 className="font-display text-6xl sm:text-7xl leading-none max-w-2xl">
          פנצ&apos;ר? תיקון? טיפול?
          <br />
          שב בכייף, אנחנו בדרך
        </h1>
        <p className="text-ink-muted text-lg max-w-md">
          מתקנים אצלכם בבית, מסבירים לפני שמתקנים, ובודקים בטיחות בכל ביקור.
        </p>
        <Button as={Link} href="/book" className="text-xl px-10 min-h-14">
          מה קרה לאופניים?
        </Button>
      </section>

      {/* Functional strip — plain and readable */}
      <section className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-ink-muted">
          <li>שירות מהיר ואמין</li>
          <li>עבודה מקצועית בסטנדרט גבוה</li>
          <li>שקיפות מלאה ומחירים הוגנים</li>
        </ul>
      </section>
    </main>
  );
}
