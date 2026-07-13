"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { Locale } from "@iatg/shared";
import { readLocale, subscribeLocale, writeLocale } from "../lib/locale";

const copy = {
  en: {
    brand: "Inclusive AI Trust Gateway",
    navLabel: "Primary",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    links: [
      { href: "/#overview", label: "Overview", match: "/" },
      { href: "/#scenarios", label: "Scenarios", match: "/" },
      { href: "/#evidence", label: "Trust Evidence", match: "/" },
      { href: "/#open-data", label: "Open Data", match: "/" },
      { href: "/#sdg", label: "SDGs", match: "/" },
      { href: "/#console", label: "Live Console", match: "/" },
      { href: "/live", label: "Live Defense", match: "/live", accent: true },
      { href: "/report", label: "Report", match: "/report" },
    ],
  },
  "zh-TW": {
    brand: "包容式 AI 信任閘道",
    navLabel: "主要導覽",
    menuOpen: "開啟選單",
    menuClose: "關閉選單",
    links: [
      { href: "/#overview", label: "總覽", match: "/" },
      { href: "/#scenarios", label: "服務情境", match: "/" },
      { href: "/#evidence", label: "信任證據", match: "/" },
      { href: "/#open-data", label: "開放資料", match: "/" },
      { href: "/#sdg", label: "SDG 對應", match: "/" },
      { href: "/#console", label: "即時主控台", match: "/" },
      { href: "/live", label: "即時防禦", match: "/live", accent: true },
      { href: "/report", label: "稽核報告", match: "/report" },
    ],
  },
} as const;

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname() || "/";
  const menuId = useId();
  const [locale, setLocale] = useState<Locale>("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const t = copy[locale];

  useEffect(() => {
    setLocale(readLocale());
    return subscribeLocale(setLocale);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const setLang = (next: Locale) => {
    setLocale(next);
    writeLocale(next);
  };

  const isActive = (match: string, href: string) => {
    if (match === "/live" || match === "/report") {
      return pathname === match || pathname.startsWith(`${match}/`);
    }
    // On the homepage, only mark Overview as the current page link.
    return pathname === "/" && href === "/#overview";
  };

  return (
    <header className={`site-header${menuOpen ? " is-open" : ""}`}>
      <Link className="brand" href="/">
        <BrandMark />
        <span className="brand-text">{t.brand}</span>
      </Link>

      <button
        type="button"
        className="nav-menu-toggle"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-label={menuOpen ? t.menuClose : t.menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id={menuId} className="site-nav" aria-label={t.navLabel}>
        {t.links.map((link) => {
          const active = isActive(link.match, link.href);
          const className = [
            "accent" in link && link.accent ? "nav-live" : "",
            active ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={className || undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="lang-toggle" role="group" aria-label="Language">
        <button type="button" className={locale === "en" ? "is-active" : ""} onClick={() => setLang("en")}>
          EN
        </button>
        <button type="button" className={locale === "zh-TW" ? "is-active" : ""} onClick={() => setLang("zh-TW")}>
          繁中
        </button>
      </div>
    </header>
  );
}
