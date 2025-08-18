import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Search, MapPin, Check } from 'lucide-react';
import { Station } from '@/hooks/useStations';

interface SearchStationInputProps {
  stations: Station[];
  onStationSelect: (station: Station) => void;
  placeholder?: string;
  selectedStation?: Station;
}

const SearchStationInput: React.FC<SearchStationInputProps> = ({
  stations,
  onStationSelect,
  placeholder = "Search for a station...",
  selectedStation
}) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const filteredStations = useMemo(() => {
    if (!searchValue) return [];
    return stations
      .filter(station => 
        station.name.toLowerCase().includes(searchValue.toLowerCase())
      )
      .slice(0, 8); // Limit results for performance
  }, [stations, searchValue]);

  const handleStationSelect = (station: Station) => {
    onStationSelect(station);
    setOpen(false);
    setSearchValue("");
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              {selectedStation ? (
                <span>{selectedStation.name}</span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Type to search stations..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No stations found.</CommandEmpty>
              <CommandGroup>
                {filteredStations.map((station) => (
                  <CommandItem
                    key={station.id}
                    value={station.name}
                    onSelect={() => handleStationSelect(station)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{station.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Zone {station.zone} • {station.lines.map(l => l.name).join(', ')}
                        </div>
                      </div>
                    </div>
                    {selectedStation?.id === station.id && (
                      <Check className="h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SearchStationInput;