"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

const subscribeToDate = (callback: () => void) => {
  const interval = window.setInterval(callback, 60_000);
  return () => window.clearInterval(interval);
};
const serverDate = () => "";
const browserDate = () =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
function useDateLabel() {
  return useSyncExternalStore(subscribeToDate, browserDate, serverDate);
}

export function AppNavigation() {
  const pathname = usePathname();
  const date = useDateLabel();
  const links = [
    ["Dashboard", "/"],
    ["Growing Trials", "/growing-trials"],
    ["Plants", "/plants"],
    ["Containers", "/containers"],
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="mobile-header">
        <Link href="/" className="wordmark">
          gardenerd.
        </Link>
        <span>{date}</span>
      </header>
      <aside className="garden-sidebar">
        <Link href="/" className="brand">
          <span className="wordmark">gardenerd.</span>
          <span className="brand-tagline">A little more growth</span>
        </Link>
        <nav className="garden-nav" aria-label="Primary navigation">
          {links.map(([label, href], index) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "nav-link is-active" : "nav-link"}
              aria-current={pathname === href ? "page" : undefined}
            >
              <span className="nav-number">0{index + 1}</span>
              <span className="nav-label">
                {label === "Growing Trials" ? (
                  <>
                    <span className="desktop-label">Growing </span>Trials
                  </>
                ) : (
                  label
                )}
              </span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="eyebrow">Grow. Notice. Learn.</span>
            <p>
              Every observation
              <br />
              is a little more understanding.
            </p>
          </div>
          <span className="eyebrow sidebar-footer">
            Your garden, at your pace
          </span>
        </div>
      </aside>
    </>
  );
}

export function PageBreadcrumb({ label }: { label: string }) {
  const date = useDateLabel();
  return (
    <div className="page-breadcrumb">
      <span>
        Your garden <span className="breadcrumb-slash">/</span> {label}
      </span>
      <time>{date}</time>
    </div>
  );
}
