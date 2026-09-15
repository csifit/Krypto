"use client";

import ThemeToggle from "@/components/ThemeToggle";

export type SecondarySection = "wallets" | "beneficiaries" | "history" | "developer" | null;

export default function DashboardSidebar({
  open,
  activeSection,
  email,
  onClose,
  onSelect,
  onLogout,
  isSuperAdmin = false,
}: {
  open: boolean;
  activeSection: SecondarySection;
  email?: string;
  onClose(): void;
  onSelect(section: SecondarySection): void;
  onLogout(): void;
  isSuperAdmin?: boolean;
}) {
  function select(section: SecondarySection) {
    onSelect(section);
    onClose();
  }

  return (
    <>
      {open ? <button className="sidebarBackdrop" aria-label="Close menu" onClick={onClose} /> : null}
      <aside className={`dashboardSidebar${open ? " dashboardSidebarOpen" : ""}`}>
        <div>
          <div className="sidebarBrand">
            <strong>Krypto121</strong>
            <span>Business</span>
          </div>

          <nav className="sidebarNav" aria-label="Account navigation">
            <button
              className={!activeSection ? "sidebarNavItem sidebarNavItemActive" : "sidebarNavItem"}
              onClick={() => select(null)}
            >
              Overview
            </button>
            <button
              className={activeSection === "wallets" ? "sidebarNavItem sidebarNavItemActive" : "sidebarNavItem"}
              onClick={() => select("wallets")}
            >
              My wallets
            </button>
            <button
              className={activeSection === "beneficiaries" ? "sidebarNavItem sidebarNavItemActive" : "sidebarNavItem"}
              onClick={() => select("beneficiaries")}
            >
              Beneficiaries
            </button>
            <button
              className={activeSection === "history" ? "sidebarNavItem sidebarNavItemActive" : "sidebarNavItem"}
              onClick={() => select("history")}
            >
              Payment history
            </button>
            <button
              className={activeSection === "developer" ? "sidebarNavItem sidebarNavItemActive" : "sidebarNavItem"}
              onClick={() => select("developer")}
            >
              Developer tools
            </button>
            {isSuperAdmin ? (
              <a className="sidebarNavItem sidebarNavLink" href="/admin">
                Administration
              </a>
            ) : null}
          </nav>
        </div>

        <div className="sidebarFooter">
          <ThemeToggle />
          <div className="sidebarAccount">
            <span>{email ?? "Signed in"}</span>
            <small>Test environment</small>
          </div>
          <button className="sidebarSignOut" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
