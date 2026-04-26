import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { Profile } from "./pages/Profile";
import { OwnerDashboard } from "./pages/owner/OwnerDashboard";
import { ScheduleWalk } from "./pages/owner/ScheduleWalk";
import { OwnerChat } from "./pages/owner/OwnerChat";
import { ReportCard } from "./pages/owner/ReportCard";
import { VetFinder } from "./pages/owner/VetFinder";
import { WalkerDashboard } from "./pages/walker/WalkerDashboard";
import { WalkerChat } from "./pages/walker/WalkerChat";
import { WalkerReportCard } from "./pages/walker/WalkerReportCard";
import { WalkerLiveWalk } from "./pages/walker/WalkerLiveWalk";
import { WalkerEarnings } from "./pages/walker/WalkerEarnings";
import { OwnerLiveWalk } from "./pages/owner/OwnerLiveWalk";
import { LaunchChecklist } from "./pages/LaunchChecklist";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Landing },
      { path: "profile",             Component: Profile         },
      { path: "owner",               Component: OwnerDashboard  },
      { path: "owner/schedule",      Component: ScheduleWalk    },
      { path: "owner/chat",          Component: OwnerChat        },
      { path: "owner/report-card",   Component: ReportCard      },
      { path: "owner/vet-finder",    Component: VetFinder       },
      { path: "owner/live-walk",     Component: OwnerLiveWalk   },
      { path: "walker",              Component: WalkerDashboard },
      { path: "walker/chat",         Component: WalkerChat      },
      { path: "walker/report-card",  Component: WalkerReportCard},
      { path: "walker/live-walk",    Component: WalkerLiveWalk  },
      { path: "walker/earnings",     Component: WalkerEarnings  },
      { path: "launch",              Component: LaunchChecklist },
      { path: "*",                   Component: NotFound        },
    ],
  },
]);