import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface StudentOption {
  student_id: string;
  name: string;
}

interface Props {
  options: StudentOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Numeric-aware sort: NW0001 < NW0002 < NW0010 (matches Excel).
 */
function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const StudentSearchSelect = ({
  options,
  value,
  onChange,
  disabled,
  placeholder = "Search your NIAT ID...",
}: Props) => {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...options].sort((a, b) => naturalSort(a.student_id, b.student_id)),
    [options]
  );

  const selectedLabel = sorted.find((o) => o.student_id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between bg-secondary/50 border-border/60 text-base h-11"
        >
          {selectedLabel ? (
            <span className="font-mono uppercase tracking-wide truncate">
              {selectedLabel.student_id}
              {selectedLabel.name && (
                <span className="text-muted-foreground font-sans ml-2 normal-case">— {selectedLabel.name}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground flex items-center gap-2">
              <Search className="w-4 h-4" /> {placeholder}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
        <Command
          filter={(itemValue, search) => {
            // itemValue is the CommandItem's `value` prop — combine id + name lower-cased.
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Type your NIAT ID or name..." />
          <CommandList>
            <CommandEmpty>No matching students in this section.</CommandEmpty>
            <CommandGroup>
              {sorted.map((opt) => {
                const searchKey = `${opt.student_id} ${opt.name}`.toLowerCase();
                return (
                  <CommandItem
                    key={opt.student_id}
                    value={searchKey}
                    onSelect={() => {
                      onChange(opt.student_id);
                      setOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === opt.student_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-mono font-medium">{opt.student_id}</span>
                    {opt.name && (
                      <span className="ml-2 text-muted-foreground text-xs truncate">{opt.name}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default StudentSearchSelect;
