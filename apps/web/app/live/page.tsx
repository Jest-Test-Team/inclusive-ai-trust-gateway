import Link from "next/link";
import { BattleConsole } from "../../components/BattleConsole";

export const metadata = {
  title: "ADM Battle Console — Inclusive AI Trust Gateway",
  description: "Live red-team vs. blue-team battles running against the ADM-protected gateway.",
};

export default function LivePage() {
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          Inclusive AI Trust Gateway
        </Link>
        <nav className="site-nav" aria-label="Sections">
          <Link href="/">← Back to dashboard</Link>
        </nav>
      </header>
      <section className="section">
        <BattleConsole />
      </section>
    </>
  );
}
