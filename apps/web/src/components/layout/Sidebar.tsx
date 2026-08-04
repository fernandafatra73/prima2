import { useState, type JSX } from 'react';
import logoLabprima from '@src/image/logo-labprima.png';
import {
  DASHBOARD_NAV_ID,
  isViewAllowedForRole,
  MAIN_NAV_CATEGORIES,
  type AppViewId,
  type NavCategory,
  type NavItem,
  type StaffRole,
} from '../../config/navigation.ts';
import {
  IconClipboard,
  IconCurrency,
  IconDashboard,
  IconDocument,
  IconLogout,
  IconMusic,
  IconSettings,
  IconShield,
  IconStethoscope,
  IconTag,
  IconUsers,
} from '../icons/NavIcons.tsx';
import './layout.css';

interface SidebarProps {
  readonly activeId: AppViewId;
  readonly onNavigate: (id: AppViewId) => void;
  readonly role: StaffRole;
}

const CATEGORY_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  templet: IconDocument,
  pendaftaran: IconClipboard,
  radiologi: IconStethoscope,
  keuangan: IconCurrency,
  'master-sistem': IconShield,
  laboratorium: IconTag,
  'klinik-umum': IconStethoscope,
  farmasi: IconDocument,
  anatomi: IconStethoscope,
};

function ChevronIcon({ className }: { readonly className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar({ activeId, onNavigate, role }: SidebarProps) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => ({
    templet: true,
    pendaftaran: true,
    radiologi: true,
    keuangan: true,
    'master-sistem': true,
    laboratorium: true,
    'klinik-umum': true,
    farmasi: true,
    anatomi: true,
  }));

  function toggleCategory(catId: string) {
    setOpenCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  }

  function renderCategory(cat: NavCategory) {
    const visibleItems = cat.items.filter((item) => isViewAllowedForRole(item.id as AppViewId, role));
    if (visibleItems.length === 0) return null;

    const CatIcon = CATEGORY_ICONS[cat.id] ?? IconClipboard;
    const hasActiveChild = visibleItems.some((item) => item.id === activeId);
    const isExpanded = openCategories[cat.id] ?? hasActiveChild;

    return (
      <li key={cat.id} className="app-sidebar__group">
        <button
          type="button"
          className={`app-sidebar__group-header ${hasActiveChild ? 'app-sidebar__group-header--active' : ''}`}
          onClick={() => toggleCategory(cat.id)}
        >
          <div className="app-sidebar__group-title">
            <CatIcon className="app-sidebar__icon" />
            <span>{cat.label}</span>
          </div>
          <ChevronIcon
            className={`app-sidebar__chevron ${isExpanded ? 'app-sidebar__chevron--expanded' : ''}`}
          />
        </button>

        {isExpanded && (
          <ul className="app-sidebar__child-list">
            {visibleItems.map((item: NavItem) => {
              const isActive = activeId === item.id;
              if (item.isPlaceholder) {
                return (
                  <li key={item.id}>
                    <div className="app-sidebar__child-link app-sidebar__child-link--placeholder">
                      <span>• {item.label}</span>
                    </div>
                  </li>
                );
              }
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`app-sidebar__child-link ${isActive ? 'app-sidebar__child-link--active' : ''}`}
                    onClick={() => onNavigate(item.id as AppViewId)}
                    title={item.label}
                  >
                    <span>• {item.shortLabel ?? item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  }

  const templetCategory = MAIN_NAV_CATEGORIES.find((cat) => cat.id === 'templet');
  const otherCategories = MAIN_NAV_CATEGORIES.filter((cat) => cat.id !== 'templet');

  return (
    <aside className="app-sidebar" aria-label="Navigasi utama">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__logo">
          <img src={logoLabprima} alt="Klinik Prima Husada" className="app-sidebar__logo-img" />
        </div>
        <h1 className="app-sidebar__title">Klinik Prima Husada</h1>
      </div>

      <nav className="app-sidebar__nav">
        <ul className="app-sidebar__list">
          <li>
            <button
              type="button"
              className={`app-sidebar__link${activeId === DASHBOARD_NAV_ID ? ' app-sidebar__link--active' : ''}`}
              onClick={() => onNavigate(DASHBOARD_NAV_ID)}
            >
              <IconDashboard className="app-sidebar__icon" />
              <span className="app-sidebar__label">Dashboard</span>
            </button>
          </li>

          {otherCategories.map((cat: NavCategory) => renderCategory(cat))}

          <li>
            <button
              type="button"
              className={`app-sidebar__link${activeId === 'fatra' ? ' app-sidebar__link--active' : ''}`}
              onClick={() => onNavigate('fatra')}
            >
              <IconUsers className="app-sidebar__icon" />
              <span className="app-sidebar__label">Fatra</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              className={`app-sidebar__link${activeId === 'musik-ph' ? ' app-sidebar__link--active' : ''}`}
              onClick={() => onNavigate('musik-ph')}
            >
              <IconMusic className="app-sidebar__icon" />
              <span className="app-sidebar__label">Musik-PH</span>
            </button>
          </li>

          {templetCategory && renderCategory(templetCategory)}

          <li>
            <button
              type="button"
              className={`app-sidebar__link${activeId === 'transfer' ? ' app-sidebar__link--active' : ''}`}
              onClick={() => onNavigate('transfer')}
            >
              <IconClipboard className="app-sidebar__icon" />
              <span className="app-sidebar__label">Transfer</span>
            </button>
          </li>

          <li>
            <button
              type="button"
              className={`app-sidebar__link${activeId === 'daftar-telpon' ? ' app-sidebar__link--active' : ''}`}
              onClick={() => onNavigate('daftar-telpon')}
            >
              <IconClipboard className="app-sidebar__icon" />
              <span className="app-sidebar__label">Daftar Telpon</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="app-sidebar__footer">
        <ul className="app-sidebar__list">
          <li>
            <button type="button" className="app-sidebar__link">
              <IconSettings className="app-sidebar__icon" />
              <span className="app-sidebar__label">Pengaturan</span>
            </button>
          </li>
          <li>
            <button type="button" className="app-sidebar__link">
              <IconLogout className="app-sidebar__icon" />
              <span className="app-sidebar__label">Log out</span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
