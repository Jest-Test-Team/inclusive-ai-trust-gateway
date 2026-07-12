import { assessUseCase, formatScore, safetySignals, useCases } from "@iatg/shared";
import type { PublicServiceUseCase, TrustAssessment } from "@iatg/shared";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

const appRoot = app;

let selectedUseCase = useCases[0];

function renderUseCaseOptions(active: PublicServiceUseCase): string {
  return useCases
    .map(
      (useCase) => `
        <button class="service-tab ${useCase.id === active.id ? "is-active" : ""}" data-use-case="${useCase.id}">
          <span>${useCase.domain}</span>
          ${useCase.name}
        </button>
      `,
    )
    .join("");
}

function renderMetric(label: string, value: string, tone: string): string {
  return `
    <article class="metric metric-${tone}">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function renderList(items: string[]): string {
  return items.map((item) => `<li>${item}</li>`).join("");
}

function renderPersonas(useCase: PublicServiceUseCase): string {
  return useCase.personas
    .map(
      (persona) => `
        <article class="persona-card">
          <div>
            <h3>${persona.label}</h3>
            <p>${persona.ageGroup} - ${persona.region}</p>
          </div>
          <dl>
            <dt>Needs</dt>
            <dd>${persona.needs.join(", ")}</dd>
            <dt>Barriers</dt>
            <dd>${persona.barriers.join(", ")}</dd>
          </dl>
        </article>
      `,
    )
    .join("");
}

function renderSafetySignals(): string {
  return safetySignals
    .map(
      (signal) => `
        <article class="signal-row">
          <span class="status-dot status-${signal.status}" aria-label="${signal.status}"></span>
          <div>
            <strong>${signal.control}</strong>
            <p>${signal.description}</p>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAssessment(useCase: PublicServiceUseCase, assessment: TrustAssessment): string {
  return `
    <section class="assessment-band">
      <div class="assessment-copy">
        <p class="eyebrow">2026 Presidential Hackathon - International Track</p>
        <h1>Inclusive AI Trust Gateway</h1>
        <p>
          A public-service AI evaluation and protection platform that audits fairness,
          explains risk, and protects AI agents from misuse so governments can deploy
          AI services safely and inclusively.
        </p>
      </div>
      <div class="metrics-grid">
        ${renderMetric("Inclusion score", formatScore(assessment.inclusionScore), "green")}
        ${renderMetric("Fairness risk", assessment.fairnessRisk, "amber")}
        ${renderMetric("Open data", formatScore(assessment.openDataReadiness), "blue")}
        ${renderMetric("Agent safety", formatScore(assessment.agentSafetyReadiness), "red")}
      </div>
    </section>

    <section class="workspace">
      <aside class="service-panel">
        <h2>Service Scenarios</h2>
        <div class="service-tabs">
          ${renderUseCaseOptions(useCase)}
        </div>
      </aside>

      <section class="detail-panel">
        <div class="detail-header">
          <div>
            <p class="eyebrow">${useCase.domain}</p>
            <h2>${useCase.name}</h2>
          </div>
          <div class="sdg-row">
            ${useCase.sdgs.map((sdg) => `<span>${sdg}</span>`).join("")}
          </div>
        </div>
        <p class="summary">${useCase.summary}</p>

        <div class="two-column">
          <article>
            <h3>Target Users</h3>
            <ul>${renderList(useCase.targetUsers)}</ul>
          </article>
          <article>
            <h3>Safeguards</h3>
            <ul>${renderList(useCase.safeguards)}</ul>
          </article>
        </div>

        <div class="personas">
          ${renderPersonas(useCase)}
        </div>
      </section>
    </section>

    <section class="evidence-grid">
      <article>
        <h2>Ethic-Latex / ERH Role</h2>
        <p>
          Converts service outcomes into comparable samples, scores fairness and
          ethical-error growth, and surfaces where AI decisions may structurally
          exclude vulnerable groups.
        </p>
        <ul>${renderList(assessment.strengths)}</ul>
      </article>
      <article>
        <h2>ADM Safety Role</h2>
        <div class="signal-list">${renderSafetySignals()}</div>
      </article>
      <article>
        <h2>Next Build Steps</h2>
        <ul>${renderList(assessment.nextSteps)}</ul>
      </article>
      <article>
        <h2>Known Gaps</h2>
        <ul>${renderList(assessment.gaps)}</ul>
      </article>
    </section>
  `;
}

function render(): void {
  const assessment = assessUseCase(selectedUseCase, safetySignals);
  appRoot.innerHTML = renderAssessment(selectedUseCase, assessment);

  appRoot
    .querySelectorAll<HTMLButtonElement>("[data-use-case]")
    .forEach((button: HTMLButtonElement) => {
      button.addEventListener("click", () => {
        const next = useCases.find((useCase) => useCase.id === button.dataset.useCase);
        if (next) {
          selectedUseCase = next;
          render();
        }
      });
    });
}

render();
