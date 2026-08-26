import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  ListChecks,
  Shield,
  Sparkles,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';

type HubPath =
  | '/pool'
  | '/rankings'
  | '/rosters'
  | '/trades'
  | '/profile'
  | '/team-builder'
  | '/admin'
  | '/admin/trades';

type HubAction = {
  to: HubPath;
  icon: LucideIcon;
  title: string;
  detail: string;
};

const leagueActions: HubAction[] = [
  {
    to: '/rosters',
    icon: ListChecks,
    title: 'Rosters',
    detail: 'Scan every roster in the league and see how each player was acquired.',
  },
  {
    to: '/trades',
    icon: ArrowRightLeft,
    title: 'Trade Center',
    detail: 'Build offers, respond to proposals and review the league trade ledger.',
  },
  {
    to: '/rankings',
    icon: BarChart3,
    title: 'Rankings',
    detail: 'Category-weighted rankings and fantasy value comparisons across the player pool.',
  },
  {
    to: '/team-builder',
    icon: Sparkles,
    title: 'Team Builder',
    detail: 'Experiment with roster construction outside the live league roster.',
  },
];

export function LeagueHubPage() {
  return <HubPage eyebrow="League" title="League activity" actions={leagueActions} />;
}

export function MorePage() {
  const { profile } = useAuth();
  const actions: HubAction[] = [
    {
      to: '/profile',
      icon: UserCircle,
      title: 'Profile',
      detail: 'Account details and sign out.',
    },
    {
      to: '/team-builder',
      icon: Sparkles,
      title: 'Team Builder',
      detail: 'Experiment with roster construction outside the live league roster.',
    },
  ];

  if (profile?.is_admin) {
    actions.push(
      {
        to: '/admin/trades',
        icon: ArrowRightLeft,
        title: 'Trade overrides',
        detail: 'Apply, audit and correct member trades before the draft is complete.',
      },
      {
        to: '/admin',
        icon: Shield,
        title: 'Admin',
        detail: 'Season, draft order and commissioner controls.',
      },
    );
  }

  return <HubPage eyebrow="More" title="Tools & settings" actions={actions} />;
}

function HubPage({ eyebrow, title, actions }: { eyebrow: string; title: string; actions: HubAction[] }) {
  return (
    <PageShell size="medium">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        titleClassName="text-2xl font-black sm:text-3xl"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map(({ to, icon: Icon, title: actionTitle, detail }) => (
          <Link
            key={to}
            to={to}
            className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-card p-4 transition-all hover:bg-muted/40 active:scale-[0.99]"
          >
            <div>
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-4 font-bold">{actionTitle}</h2>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{detail}</p>
            </div>
            <ArrowRight className="mt-4 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
