import { BattleConsole } from "../../components/BattleConsole";

export const metadata = {
  title: "ADM Battle Console — Inclusive AI Trust Gateway",
  description: "Live red-team vs. blue-team battles running against the ADM-protected gateway.",
};

export default function LivePage() {
  return (
    <section className="section">
      <BattleConsole />
    </section>
  );
}
