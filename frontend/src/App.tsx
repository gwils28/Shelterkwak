import { useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { IconHousehold, IconJourney, IconMonument, IconObjectives, IconStock } from "./components/NavIcons";
import { SyncBadge } from "./components/SyncBadge";
import { CrisisPage } from "./pages/Crisis";
import { DashboardPage } from "./pages/Dashboard";
import { HistoryPage } from "./pages/History";
import { HouseholdPage } from "./pages/Household";
import { InventoryPage } from "./pages/Inventory";
import { ObjectivesPage } from "./pages/Objectives";
import { OnboardingPage } from "./pages/Onboarding";
import { useFoyer } from "./store/hooks";

// Cinq onglets : barre en bas sur téléphone, rail à gauche sur grand écran. La Crise reste hors des
// onglets, en bouton toujours visible. Les adresses ne changent pas (favoris et liens existants).
const NAV = [
  { to: "/", label: "Monument", Icon: IconMonument },
  { to: "/objectifs", label: "Objectifs", Icon: IconObjectives },
  { to: "/inventaire", label: "Réserves", Icon: IconStock },
  { to: "/historique", label: "Parcours", Icon: IconJourney },
  { to: "/foyer", label: "Foyer", Icon: IconHousehold },
];

/** Changer d'onglet ramène en haut de page, comme dans une app native. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const foyer = useFoyer();

  if (!foyer.dashboard)
    return (
      <Routes>
        <Route path="/bienvenue" element={<OnboardingPage />} />
        <Route path="*" element={<Navigate to="/bienvenue" replace />} />
      </Routes>
    );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            ▥
          </span>
          <span className="brand-name">Shelterkwak</span>
          <span className="brand-household">{foyer.dashboard.household.name}</span>
        </div>
        <SyncBadge sync={foyer.sync} />
        <NavLink to="/crise" className="crisis-button" aria-label="Crise : fiches réflexes et contacts">
          <span aria-hidden>🚨</span>
          <span>Crise</span>
        </NavLink>
      </header>
      <nav className="tabbar" aria-label="Navigation principale">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === "/"}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <ScrollToTop />
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/objectifs" element={<ObjectivesPage />} />
          <Route path="/inventaire" element={<InventoryPage />} />
          <Route path="/foyer" element={<HouseholdPage />} />
          <Route path="/historique" element={<HistoryPage />} />
          <Route path="/crise" element={<CrisisPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
