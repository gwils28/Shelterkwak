import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { SyncBadge } from "./components/SyncBadge";
import { CrisisPage } from "./pages/Crisis";
import { DashboardPage } from "./pages/Dashboard";
import { HistoryPage } from "./pages/History";
import { HouseholdPage } from "./pages/Household";
import { InventoryPage } from "./pages/Inventory";
import { ObjectivesPage } from "./pages/Objectives";
import { OnboardingPage } from "./pages/Onboarding";
import { useFoyer } from "./store/hooks";

const NAV = [
  { to: "/", label: "Colonne" },
  { to: "/objectifs", label: "Objectifs" },
  { to: "/inventaire", label: "Inventaire" },
  { to: "/foyer", label: "Foyer" },
  { to: "/historique", label: "Historique" },
];

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
          Shelterkwak
          <span className="brand-household">{foyer.dashboard.household.name}</span>
        </div>
        <SyncBadge sync={foyer.sync} />
        <nav>
          <NavLink to="/crise" className="crisis-link">
            🚨 Crise
          </NavLink>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
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
