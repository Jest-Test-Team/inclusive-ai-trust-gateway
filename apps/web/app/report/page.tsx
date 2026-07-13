"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCases, type Locale } from "@iatg/shared";
import { ReportView } from "../../components/ReportView";

function Report() {
  const params = useSearchParams();
  const scenarioId = params.get("scenario") ?? useCases[0].id;
  const locale: Locale = params.get("locale") === "zh-TW" ? "zh-TW" : "en";
  return <ReportView scenarioId={scenarioId} locale={locale} />;
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <Report />
    </Suspense>
  );
}
