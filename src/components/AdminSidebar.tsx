"use client";

import Link from "next/link";
import { memo } from "react";

type AdminRoute =
  | "dashboard"
  | "entradas"
  | "saidas"
  | "contas-a-pagar"
  | "contas-a-receber"
  | "folha-de-pagamento"
  | "colaboradores"
  | "investimentos"
  | "relatorios"
  | "configuracoes";

type MenuItem = {
  id: AdminRoute | "pdv";
  label: string;
  href: string;
  pdv?: boolean;
};

const linkBase =
  "block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white";
const linkAtivo =
  "block rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white";
const linkPdv =
  "block rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700";

const menuItems: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "pdv", label: "Acessar PDV", href: "/pdv", pdv: true },
  { id: "entradas", label: "Entradas", href: "/entradas" },
  { id: "saidas", label: "Saídas", href: "/saidas" },
  { id: "contas-a-pagar", label: "Contas a pagar", href: "/contas-a-pagar" },
  { id: "contas-a-receber", label: "Contas a receber", href: "/contas-a-receber" },
  { id: "folha-de-pagamento", label: "Folha de pagamento", href: "/folha-de-pagamento" },
  { id: "colaboradores", label: "Colaboradores", href: "/colaboradores" },
  { id: "investimentos", label: "Investimentos", href: "/investimentos" },
  { id: "relatorios", label: "Relatórios", href: "/relatorios" },
  { id: "configuracoes", label: "Configurações", href: "/configuracoes" },
];

function AdminSidebarComponent({
  active,
  printHidden = false,
}: {
  active?: AdminRoute;
  printHidden?: boolean;
}) {
  return (
    <aside
      className={`${printHidden ? "no-print " : ""}w-72 shrink-0 bg-slate-950 text-white`}
    >
      <div className="border-b border-white/10 px-6 py-6">
        <img
          src="/logo-01.png"
          alt="Samambaia Restaurante e Pizzaria"
          className="max-h-20 w-auto"
          loading="eager"
          decoding="async"
        />
      </div>

      <nav className="space-y-2 px-4 py-6">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={item.pdv ? linkPdv : item.id === active ? linkAtivo : linkBase}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

const AdminSidebar = memo(AdminSidebarComponent);

export default AdminSidebar;
