"use client";

import React from "react";
import {
  Users,
  UserPlus,
  Shield,
  Wallet,
  Bell,
  Lock,
  ArrowRight,
} from "lucide-react";

const PLANNED_FEATURES = [
  {
    icon: UserPlus,
    title: "Invite Members",
    desc: "Invite family members or a partner to share your financial workspace.",
  },
  {
    icon: Wallet,
    title: "Shared Budgets",
    desc: "Set joint monthly limits and track spending together in real time.",
  },
  {
    icon: Shield,
    title: "Role Permissions",
    desc: "Assign roles — Owner, Editor, or Viewer — to control what each member can do.",
  },
  {
    icon: Bell,
    title: "Shared Notifications",
    desc: "Get alerts when a shared budget is running low or a limit is exceeded.",
  },
  {
    icon: Lock,
    title: "Private Transactions",
    desc: "Mark specific transactions as private so only you can see them.",
  },
];

export default function UsersPage() {
  return (
    <div className="p-4 md:p-8 w-full max-w-3xl mx-auto flex flex-col items-center gap-8">
      {/* Hero */}
      <div className="w-full flex flex-col items-center text-center gap-4 pt-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-red-900/30">
            <Users className="w-10 h-10 text-white" />
          </div>
          <span className="absolute -top-2 -right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-white shadow">
            Soon
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Family & Team Mode
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1.5 max-w-sm">
            Manage finances together. Invite household members, set shared
            budgets and track everyone&apos;s spending in one place.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          🚧 &nbsp;In development — coming in a future release
        </span>
      </div>

      {/* Planned features */}
      <div className="w-full space-y-3">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
          Planned features
        </p>
        {PLANNED_FEATURES.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm opacity-80"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {title}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                {desc}
              </p>
            </div>
            <div className="ml-auto shrink-0 mt-0.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                Planned
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-linear-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border border-red-100 dark:border-red-900/30">
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Want this feature sooner?
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Let us know via Help &amp; Support — your feedback shapes our
            roadmap.
          </p>
        </div>
        <a
          href="/dashboard/help"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
        >
          Give feedback
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
