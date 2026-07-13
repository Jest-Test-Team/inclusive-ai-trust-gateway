"use client";

import { useEffect, useState } from "react";
import { useCases, type Locale } from "@iatg/shared";
import { ReportView } from "../../components/ReportView";

export default function ReportPage() {
  const [params, setParams] = useState<{ scenarioId: string; locale: Locale }>({
    scenarioId: useCases[0].id,
    locale: "en",
  });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setParams({
      scenarioId: q.get("scenario") ?? useCases[0].id,
      locale: q.get("locale") === "zh-TW" ? "zh-TW" : "en",
    });
  }, []);

  return <ReportView scenarioId={params.scenarioId} locale={params.locale} />;
}
