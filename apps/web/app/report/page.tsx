"use client";

import { useEffect, useState } from "react";
import { useCases, type Locale } from "@iatg/shared";
import { ReportView } from "../../components/ReportView";
import { readLocale, subscribeLocale } from "../../lib/locale";

export default function ReportPage() {
  const [params, setParams] = useState<{ scenarioId: string; locale: Locale }>({
    scenarioId: useCases[0].id,
    locale: "en",
  });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fromQuery = q.get("locale");
    const locale: Locale =
      fromQuery === "zh-TW" || fromQuery === "en" ? fromQuery : readLocale();
    setParams({
      scenarioId: q.get("scenario") ?? useCases[0].id,
      locale,
    });
    return subscribeLocale((next) => {
      setParams((prev) => ({ ...prev, locale: next }));
    });
  }, []);

  return <ReportView scenarioId={params.scenarioId} locale={params.locale} />;
}
