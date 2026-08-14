import { useCallback, useEffect, useState } from "react";
import { ExperienceErrorBoundary } from "./ExperienceErrorBoundary";
import {
  DRAW_EXPERIENCES,
  isKnownExperienceHash,
  parseExperienceHash,
  toExperienceHash,
  type DrawExperienceType,
} from "./experience";
import {
  loadSelectedExperience,
  saveSelectedExperience,
} from "./experienceStorage";
import { LotteryApp } from "./features/lottery";
import { WheelApp } from "./features/wheel";
import "./shell.css";

type NavigationState = {
  rouletteView?: "selector" | DrawExperienceType;
};

function prepareInitialHistory(
  activeExperience: DrawExperienceType | null,
): DrawExperienceType | null {
  if (!isKnownExperienceHash(window.location.hash)) {
    window.history.replaceState(
      { rouletteView: "selector" } satisfies NavigationState,
      "",
      toExperienceHash(null),
    );
    return null;
  }

  const navigationState = window.history.state as NavigationState | null;

  if (navigationState?.rouletteView) {
    return activeExperience;
  }

  if (activeExperience) {
    window.history.replaceState(
      { rouletteView: "selector" } satisfies NavigationState,
      "",
      toExperienceHash(null),
    );
    window.history.pushState(
      { rouletteView: activeExperience } satisfies NavigationState,
      "",
      toExperienceHash(activeExperience),
    );
    return activeExperience;
  }

  window.history.replaceState(
    { rouletteView: "selector" } satisfies NavigationState,
    "",
    toExperienceHash(null),
  );
  return null;
}

/** 기능 내부 상태에 관여하지 않고 선택·주소·마운트만 조정하는 웹 셸이다. */
function App() {
  const storedSelection = useState(() => loadSelectedExperience())[0];
  const [activeExperience, setActiveExperience] =
    useState<DrawExperienceType | null>(() =>
      parseExperienceHash(window.location.hash),
    );
  const [lastSelection, setLastSelection] =
    useState<DrawExperienceType | null>(storedSelection.value);
  const [storageWarning, setStorageWarning] = useState<string | null>(
    storedSelection.warning,
  );
  const pageTitle = activeExperience
    ? DRAW_EXPERIENCES.find(({ type }) => type === activeExperience)?.label
    : "추첨기 선택";

  useEffect(() => {
    document.title = pageTitle ?? "추첨기 선택";
  }, [pageTitle]);

  useEffect(() => {
    setActiveExperience((current) => prepareInitialHistory(current));

    const syncRoute = () => {
      if (!isKnownExperienceHash(window.location.hash)) {
        window.history.replaceState(
          { rouletteView: "selector" } satisfies NavigationState,
          "",
          toExperienceHash(null),
        );
        setActiveExperience(null);
        return;
      }

      setActiveExperience(parseExperienceHash(window.location.hash));
    };

    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);

    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);

  const navigate = useCallback((type: DrawExperienceType | null) => {
    const view = type ?? "selector";
    window.history.pushState(
      { rouletteView: view } satisfies NavigationState,
      "",
      toExperienceHash(type),
    );
    setActiveExperience(type);
  }, []);

  const selectExperience = useCallback(
    (type: DrawExperienceType) => {
      const saveResult = saveSelectedExperience(type);
      setLastSelection(type);
      setStorageWarning(saveResult.warning);
      navigate(type);
    },
    [navigate],
  );

  if (!activeExperience) {
    return (
      <main
        className="experience-selector"
        aria-labelledby="experience-selector-title"
      >
        <p className="experience-selector__eyebrow">PICK YOUR DRAW</p>
        <h1 id="experience-selector-title">어떤 추첨기를 사용할까요?</h1>
        <p className="experience-selector__lead">
          한 번씩 뽑는 로또와 같은 후보가 다시 나올 수 있는 돌림판 중
          원하는 방식을 선택하세요.
        </p>
        <div className="experience-selector__cards">
          {DRAW_EXPERIENCES.map((experience) => {
            const isLastSelection = experience.type === lastSelection;

            return (
              <button
                key={experience.type}
                type="button"
                className={`experience-card${
                  isLastSelection ? " experience-card--last" : ""
                }`}
                aria-label={`${experience.label} 선택`}
                onClick={() => selectExperience(experience.type)}
              >
                {isLastSelection ? (
                  <span className="experience-card__last">마지막 선택</span>
                ) : null}
                <strong>{experience.label}</strong>
                <p>{experience.description}</p>
              </button>
            );
          })}
        </div>
        {storageWarning ? (
          <p className="experience-selector__warning" role="status">
            {storageWarning}
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <div className="experience-view">
      <nav className="experience-view__navigation" aria-label="추첨기 이동">
        <button
          className="experience-view__back"
          type="button"
          onClick={() => navigate(null)}
        >
          ← 다른 추첨기 선택
        </button>
      </nav>
      <ExperienceErrorBoundary onReturnToSelector={() => navigate(null)}>
        {activeExperience === "lottery" ? <LotteryApp /> : <WheelApp />}
      </ExperienceErrorBoundary>
    </div>
  );
}

export default App;
