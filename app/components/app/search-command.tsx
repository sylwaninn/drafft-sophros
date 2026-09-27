import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { SearchIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import { Kbd, KbdGroup } from "~/components/ui/kbd";
import type { UserRow } from "~/lib/types";
import { HoldBadge, PersonAvatar } from "./bits";
import { navGroups, useVisibleNav } from "./nav";

/** ⌘K: jump to a queue or find an account. */
export function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const fetcher = useFetcher<{ accounts: UserRow[] }>();
  const navigate = useNavigate();
  const nav = useVisibleNav();

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => fetcher.load(`/search?q=${encodeURIComponent(q.trim())}`), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const go = (to: string) => {
    setOpen(false);
    setQ("");
    navigate(to, { viewTransition: true });
  };
  const accounts = q.trim().length >= 2 ? (fetcher.data?.accounts ?? []) : [];

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full justify-start text-muted-foreground sm:w-64">
        <SearchIcon data-icon="inline-start" />
        Find an account
        <KbdGroup className="ml-auto">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Find an account or open a queue">
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Name, email, phone or account id" />
          <CommandList>
            <CommandEmpty>{fetcher.state === "loading" ? "Searching" : "No account matches."}</CommandEmpty>
            {accounts.length > 0 && (
              <CommandGroup heading="Accounts">
                {accounts.map((a) => (
                  <CommandItem key={a.id} value={a.id} onSelect={() => go(`/accounts/${a.id}`)}>
                    <PersonAvatar person={a} className="size-6" />
                    <span className="font-medium">{a.name || "No name yet"}</span>
                    <span className="truncate text-muted-foreground">{a.email}</span>
                    <HoldBadge hold={a.moderation} className="ml-auto" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!q.trim() &&
              navGroups.map((group, i) => {
                const items = nav.filter((n) => n.group === group);
                if (!items.length) return null;
                return (
                  <div key={group}>
                    {i > 0 && <CommandSeparator />}
                    <CommandGroup heading={group}>
                      {items.map((item) => (
                        <CommandItem key={item.to} value={item.to} onSelect={() => go(item.to)}>
                          <item.icon />
                          {item.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                );
              })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
