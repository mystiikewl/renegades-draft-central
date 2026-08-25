import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";
import { calculateFantasyScore } from "@/utils/fantasyScore";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo, useCallback } from "react";

export interface SearchableSelectOption {
   value: string;
   label: string;
   searchText?: string;
   player?: Tables<'players'>; // For enhanced player stats preview
 }

export interface EnhancedSearchableSelectOption extends SearchableSelectOption {
   player: Tables<'players'>;
 }

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}

export const SearchableSelect = React.forwardRef<
  HTMLButtonElement,
  SearchableSelectProps
>(({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  disabled = false,
  className,
  emptyText = "No options found.",
  ...props
}, ref) => {
  const [open, setOpen] = React.useState(false);

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          {...props}
        >
          {value ? selectedOption?.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" sideOffset={4}>
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search..."
              className="border-0 px-0 shadow-none"
            />
          </div>
          <CommandList className="h-[200px] overflow-y-auto">
            <CommandEmpty className="py-6 text-center text-sm">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchText || option.label}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center px-2 py-1.5"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

SearchableSelect.displayName = "SearchableSelect";

// Enhanced SearchableSelect with player stats preview
interface EnhancedSearchableSelectProps {
  options: EnhancedSearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyText?: string;
}

export const EnhancedSearchableSelect = React.forwardRef<
  HTMLButtonElement,
  EnhancedSearchableSelectProps
>(({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  disabled = false,
  className,
  emptyText = "No options found.",
  ...props
}, ref) => {
  const [open, setOpen] = React.useState(false);
  const isMobile = useIsMobile();

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          {...props}
        >
          {value ? selectedOption?.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0",
          isMobile
            ? "w-[95vw] max-w-[95vw]"
            : "w-[500px] min-w-[400px]"
        )}
        sideOffset={4}
      >
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder="Search players..."
              className="border-0 px-0 shadow-none"
            />
          </div>
          <CommandList className={cn(
            "overflow-y-auto",
            isMobile
              ? "h-[250px] touch-pan-y"
              : "h-[300px]"
          )}>
            <CommandEmpty className="py-6 text-center text-sm">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const player = option.player;
                const fantasyScore = calculateFantasyScore(player);

                return (
                  <CommandItem
                    key={option.value}
                    value={option.searchText || option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-border/50 last:border-b-0",
                      isMobile
                        ? "min-h-[48px] active:bg-accent/70 hover:bg-accent/50"
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />

                    <div className="flex-1 min-w-0">
                      {/* Player name and basic info */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium truncate">{player.name}</div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {player.position}
                          </Badge>
                          {player.rank && (
                            <div className="text-xs text-muted-foreground">
                              #{player.rank}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team and fantasy score */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-muted-foreground">{player.nba_team}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                            {fantasyScore.toFixed(1)}
                          </div>
                          {player.is_rookie && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              R
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Stats preview - responsive grid */}
                      <div className={cn(
                        "grid gap-2 text-xs",
                        isMobile
                          ? "grid-cols-3"
                          : "grid-cols-5"
                      )}>
                        <div className="text-center">
                          <div className="font-medium">{player.points?.toFixed(1) || '0.0'}</div>
                          <div className="text-muted-foreground">PPG</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{player.total_rebounds?.toFixed(1) || '0.0'}</div>
                          <div className="text-muted-foreground">RPG</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{player.assists?.toFixed(1) || '0.0'}</div>
                          <div className="text-muted-foreground">APG</div>
                        </div>
                        {!isMobile && (
                          <>
                            <div className="text-center">
                              <div className="font-medium">{player.field_goal_percentage?.toFixed(1) || '0.0'}</div>
                              <div className="text-muted-foreground">FG%</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium">{player.minutes_per_game?.toFixed(1) || '0.0'}</div>
                              <div className="text-muted-foreground">MPG</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});

EnhancedSearchableSelect.displayName = "EnhancedSearchableSelect";