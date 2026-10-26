import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PenLine, Search, LayoutDashboard, Shield, LogOut, Settings, User, Menu } from "lucide-react";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "./avatar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, profile, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 md:hidden" aria-label="Navigation menu"><Menu /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem asChild><Link to="/">Home</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/topics">Topics</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/search" search={{ q: "" }}><Search />Explore stories</Link></DropdownMenuItem>
            {user && <><DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/dashboard"><PenLine />Your stories</Link></DropdownMenuItem></>}
          </DropdownMenuContent>
        </DropdownMenu>
        <Logo />
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <Link to="/topics" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Topics
          </Link>
          <Link to="/search" search={{ q: "" }} className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Explore
          </Link>
        </nav>
        <form
          className="ml-auto hidden w-64 min-w-0 items-center gap-2 rounded-md border bg-card px-3 py-2 lg:flex"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/search", search: { q } });
          }}
          role="search"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stories"
            aria-label="Search stories"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </form>
        <Button asChild variant="ghost" size="icon" className="ml-auto h-9 w-9 shrink-0 lg:hidden"><Link to="/search" search={{ q: "" }} aria-label="Search"><Search className="h-5 w-5" /></Link></Button>
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        ) : user ? (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/dashboard">
                <PenLine /> Write
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                <Avatar name={profile?.display_name ?? "?"} src={profile?.avatar_url} size={34} />
              </Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="font-medium">{profile?.display_name}</div>
                  <div className="text-xs text-muted-foreground">@{profile?.username}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile && (
                  <DropdownMenuItem asChild>
                    <Link to="/u/$username" params={{ username: profile.username }}>
                      <User /> Profile
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <LayoutDashboard /> Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings /> Settings
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <Shield /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/auth" search={{ mode: "signup" }}>
                Start writing
              </Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
