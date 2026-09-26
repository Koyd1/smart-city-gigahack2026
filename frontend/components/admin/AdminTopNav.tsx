"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, SVGProps } from "react";

import { useAppTranslation } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type AdminHref =
  | "/chat"
  | "/admin/knowledge"
  | "/admin/feedback"
  | "/admin/prompts"
  | "/admin/faq"
  | "/admin/health";

type NavItem = {
  href: AdminHref;
  labelKey: string;
  Icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
  isActive: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/chat",
    labelKey: "admin.nav.backToChat",
    Icon: BackIcon,
    isActive: (pathname) => pathname === "/chat" || pathname.startsWith("/chat/"),
  },
  {
    href: "/admin/knowledge",
    labelKey: "admin.nav.knowledge",
    Icon: KnowledgeIcon,
    isActive: (pathname) =>
      pathname === "/admin" ||
      pathname === "/admin/knowledge" ||
      pathname.startsWith("/admin/knowledge/"),
  },
  {
    href: "/admin/feedback",
    labelKey: "admin.nav.feedback",
    Icon: MessageIcon,
    isActive: (pathname) =>
      pathname === "/admin/feedback" || pathname.startsWith("/admin/feedback/"),
  },
  {
    href: "/admin/prompts",
    labelKey: "admin.nav.prompts",
    Icon: FileIcon,
    isActive: (pathname) =>
      pathname === "/admin/prompts" || pathname.startsWith("/admin/prompts/"),
  },
  {
    href: "/admin/faq",
    labelKey: "admin.nav.faq",
    Icon: HelpIcon,
    isActive: (pathname) => pathname === "/admin/faq" || pathname.startsWith("/admin/faq/"),
  },
  {
    href: "/admin/health",
    labelKey: "admin.nav.health",
    Icon: ActivityIcon,
    isActive: (pathname) =>
      pathname === "/admin/health" || pathname.startsWith("/admin/health/"),
  },
];

export default function AdminTopNav() {
  const { t } = useAppTranslation();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      {navItems.map((item) => {
        const active = item.isActive(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[1.05rem] font-semibold no-underline transition-colors hover:no-underline",
              active
                ? "text-orange-600"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              <item.Icon className="block h-full w-full" />
            </span>
            {t(item.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}

function BackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="12" height="18" viewBox="0 0 23 38" fill="none" {...props}>
      <path
        d="M10.5417 26.9166L5.75 18.9999L10.5417 11.0833M17.25 26.9166L12.4583 18.9999L17.25 11.0833"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KnowledgeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" {...props}>
      <path
        d="M10.9997 10.8333C5.85947 10.8333 1.83301 8.69204 1.83301 5.95825C1.83301 3.22446 5.85947 1.08325 10.9997 1.08325C16.1399 1.08325 20.1663 3.22446 20.1663 5.95825C20.1663 8.69204 16.1399 10.8333 10.9997 10.8333ZM10.9997 2.16659C7.09742 2.16659 2.74967 3.72388 2.74967 5.95825C2.74967 8.19263 7.09742 9.74992 10.9997 9.74992C14.9019 9.74992 19.2497 8.19263 19.2497 5.95825C19.2497 3.72388 14.9019 2.16659 10.9997 2.16659Z"
        fill="currentColor"
      />
      <path
        d="M10.9997 15.1667C5.85947 15.1667 1.83301 13.0255 1.83301 10.2917V5.95841C1.83301 5.81476 1.8813 5.67698 1.96725 5.5754C2.0532 5.47382 2.16978 5.41675 2.29134 5.41675C2.4129 5.41675 2.52948 5.47382 2.61543 5.5754C2.70139 5.67698 2.74967 5.81476 2.74967 5.95841V10.2917C2.74967 12.5261 7.09742 14.0834 10.9997 14.0834C14.9019 14.0834 19.2497 12.5261 19.2497 10.2917V5.95841C19.2497 5.81476 19.298 5.67698 19.3839 5.5754C19.4699 5.47382 19.5865 5.41675 19.708 5.41675C19.8296 5.41675 19.9461 5.47382 20.0321 5.5754C20.1181 5.67698 20.1663 5.81476 20.1663 5.95841V10.2917C20.1663 13.0255 16.1399 15.1667 10.9997 15.1667Z"
        fill="currentColor"
      />
      <path
        d="M10.9997 20.0417C5.85947 20.0417 1.83301 17.9005 1.83301 15.1667V10.2917C1.83301 10.148 1.8813 10.0102 1.96725 9.90865C2.0532 9.80707 2.16978 9.75 2.29134 9.75C2.4129 9.75 2.52948 9.80707 2.61543 9.90865C2.70139 10.0102 2.74967 10.148 2.74967 10.2917V15.1667C2.74967 17.401 7.09742 18.9583 10.9997 18.9583C14.9019 18.9583 19.2497 17.401 19.2497 15.1667V10.2917C19.2497 10.148 19.298 10.0102 19.3839 9.90865C19.4699 9.80707 19.5865 9.75 19.708 9.75C19.8296 9.75 19.9461 9.80707 20.0321 9.90865C20.1181 10.0102 20.1663 10.148 20.1663 10.2917V15.1667C20.1663 17.9005 16.1399 20.0417 10.9997 20.0417Z"
        fill="currentColor"
      />
      <path
        d="M10.9997 24.9167C5.85947 24.9167 1.83301 22.7755 1.83301 20.0417V15.1667C1.83301 15.023 1.8813 14.8852 1.96725 14.7837C2.0532 14.6821 2.16978 14.625 2.29134 14.625C2.4129 14.625 2.52948 14.6821 2.61543 14.7837C2.70139 14.8852 2.74967 15.023 2.74967 15.1667V20.0417C2.74967 22.276 7.09742 23.8333 10.9997 23.8333C14.9019 23.8333 19.2497 22.276 19.2497 20.0417V15.1667C19.2497 15.023 19.298 14.8852 19.3839 14.7837C19.4699 14.6821 19.5865 14.625 19.708 14.625C19.8296 14.625 19.9461 14.6821 20.0321 14.7837C20.1181 14.8852 20.1663 15.023 20.1663 15.1667V20.0417C20.1663 22.7755 16.1399 24.9167 10.9997 24.9167Z"
        fill="currentColor"
      />
    </svg>
  );
}

function MessageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="16" viewBox="0 0 26 24" fill="none" {...props}>
      <path
        d="M4.33301 3.00024H21.666C22.62 3.00025 23.333 3.71332 23.333 4.50024V16.5002C23.333 17.2872 22.62 18.0002 21.666 18.0002H6.30371L6.16016 18.1331L2.66602 21.3577L2.67676 4.50024C2.67676 3.71019 3.38242 3.00024 4.33301 3.00024ZM3.83301 18.8118L4.67188 18.0374L5.2998 17.4573L5.7959 17.0002H22.166V4.00024H3.83301V18.8118Z"
        fill="currentColor"
        stroke="currentColor"
      />
    </svg>
  );
}

function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="18" height="18" viewBox="0 0 26 26" fill="none" {...props}>
      <path
        d="M6.2085 24.375H19.7917C20.6145 24.375 21.2834 23.7057 21.2834 22.8833V9.23316C21.264 9.01995 21.2037 8.81089 21.0461 8.65463L14.2549 1.86304C14.099 1.70499 13.8908 1.64813 13.6789 1.625H6.2085C5.38568 1.625 4.7168 2.29428 4.7168 3.1167V22.8833C4.7168 23.7057 5.38568 24.375 6.2085 24.375ZM6.3418 3.25H12.868V9.2291C12.868 9.6778 13.2314 10.0416 13.6805 10.0416H19.6584V22.75H6.3418V3.25ZM14.493 8.4166V4.39932L18.5103 8.4166H14.493Z"
        fill="currentColor"
      />
      <path
        d="M16.5615 12.0696H9.43945C8.99036 12.0696 8.62695 12.4334 8.62695 12.8821C8.62695 13.3308 8.99036 13.6946 9.43945 13.6946H16.5615C17.0106 13.6946 17.374 13.3308 17.374 12.8821C17.374 12.4334 17.0106 12.0696 16.5615 12.0696ZM9.43945 9.646H10.4924C10.9415 9.646 11.3049 9.2822 11.3049 8.8335C11.3049 8.3848 10.9415 8.021 10.4924 8.021H9.43945C8.99036 8.021 8.62695 8.3848 8.62695 8.8335C8.62695 9.2822 8.99036 9.646 9.43945 9.646ZM16.5615 15.6302H9.43945C8.99036 15.6302 8.62695 15.994 8.62695 16.4427C8.62695 16.8914 8.99036 17.2552 9.43945 17.2552H16.5615C17.0106 17.2552 17.374 16.8914 17.374 16.4427C17.374 15.994 17.0106 15.6302 16.5615 15.6302ZM16.5615 19.1901H9.43945C8.99036 19.1901 8.62695 19.5539 8.62695 20.0026C8.62695 20.4513 8.99036 20.8151 9.43945 20.8151H16.5615C17.0106 20.8151 17.374 20.4513 17.374 20.0026C17.374 19.5539 17.0106 19.1901 16.5615 19.1901Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ActivityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" {...props}>
      <path
        d="M22 12h-4l-3 7-6-14-3 7H2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" {...props}>
      <path d="M9.1 9a3 3 0 1 1 5.8 1c-.4 1.1-1.4 1.6-2.1 2.1-.8.5-1.3 1-1.3 1.9" />
      <path d="M12 17h.01" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
