import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface UserSearchInputProps {
  value: string;
  onSelect: (userId: string) => void;
  placeholder?: string;
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

export function UserSearchInput({ value, onSelect, placeholder = "Search users..." }: UserSearchInputProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch users matching search query
  const { data: users, isLoading } = useQuery({
    queryKey: ["user-search", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .order("display_name", { ascending: true })
        .limit(20);

      if (searchQuery.trim()) {
        query = query.or(
          `display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UserProfile[];
    },
    enabled: open,
  });

  // Find the selected user for display
  const { data: selectedUser } = useQuery({
    queryKey: ["user-by-id", value],
    queryFn: async () => {
      if (!value) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .eq("user_id", value)
        .maybeSingle();
      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!value,
  });

  const displayValue = selectedUser
    ? selectedUser.display_name || selectedUser.username || selectedUser.user_id.slice(0, 8)
    : value
    ? value.slice(0, 8) + "..."
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {displayValue || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name or username..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {users?.map((user) => (
                    <CommandItem
                      key={user.user_id}
                      value={user.user_id}
                      onSelect={() => {
                        onSelect(user.user_id);
                        setOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === user.user_id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.display_name || "No name"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.username || "No username"} • {user.user_id.slice(0, 8)}...
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
