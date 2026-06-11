import { MobileSessionsDrawer, SessionList } from "@/components/session-list";
import { HomeMain } from "@/components/home-main";

export default function Home() {
  return (
    <>
      <SessionList />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Small screens: the session rail collapses behind a drawer. */}
        <div className="md:hidden px-3 py-2 border-b border-border/60 flex items-center shrink-0">
          <MobileSessionsDrawer />
        </div>
        <HomeMain />
      </div>
    </>
  );
}
