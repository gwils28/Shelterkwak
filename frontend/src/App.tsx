import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ApiError } from "./api";
import { useDashboard } from "./hooks";
import { DashboardPage } from "./pages/Dashboard";
import { HistoryPage } from "./pages/History";
import { HouseholdPage } from "./pages/Household";
import { InventoryPage } from "./pages/Inventory";
import { ObjectivesPage } from "./pages/Objectives";
import { OnboardingPage } from "./pages/Onboarding";

const NAV = [
  { to: "/", label: "Colonne" },
  { to: "/objectifs", label: "Objectifs" },
  { to: "/inventaire", label: "Inventaire" },
  { to: "/foyer", label: "Foyer" },
  { to: "/historique", label: "Historique" },
];

export function App() {
  const dashboard = useDashboard();
  const noHousehold = dashboard.error instanceof ApiError && dashboard.error.status === 404;

  if (dashboard.isLoading) return <div className="splash">Chargement…</div>;
  if (dashboard.error && !noHousehold)
    return (
      <div className="splash error">
        Impossible de joindre le serveur : {dashboard.error.message}
        <br />
        Lance le backend avec <code>make dev</code>.
      </div>
    );

  if (noHousehold)
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
          <span className="brand-household">{dashboard.data?.household.name}</span>
        </div>
        <nav>
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
