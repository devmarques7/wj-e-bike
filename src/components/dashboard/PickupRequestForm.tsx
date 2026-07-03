import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Zap, Loader2, AlertTriangle, Info, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { format } from "date-fns";
import { useSystemStatus } from "@/hooks/useSystemStatus";

const TRANSPORT_BASE = 25;
const URGENT_SURCHARGE = 45;

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00",
];

type Suggestion = { placeId: string; text: string };

export default function PickupRequestForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { ready } = useGoogleMaps(["places"]);
  const { pushStatus } = useSystemStatus();
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string>("10:00");
  const [urgent, setUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (!ready) return;
    const google = (window as any).google;
    google.maps.importLibrary("places").then((places: any) => {
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !address || address.length < 3 || selectedPlaceId) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const google = (window as any).google;
        const places = await google.maps.importLibrary("places");
        const { suggestions: results } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: address,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: ["nl"],
          });
        const mapped: Suggestion[] = (results ?? [])
          .filter((s: any) => s.placePrediction)
          .slice(0, 5)
          .map((s: any) => ({
            placeId: s.placePrediction.placeId,
            text: s.placePrediction.text?.text ?? "",
          }));
        setSuggestions(mapped);
        setShowSuggestions(true);
      } catch (e) {
        console.error("autocomplete error", e);
      }
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [address, ready, selectedPlaceId]);

  const pickSuggestion = (s: Suggestion) => {
    setAddress(s.text);
    setSelectedPlaceId(s.placeId);
    setShowSuggestions(false);
  };

  const totalFee = TRANSPORT_BASE + (urgent ? URGENT_SURCHARGE : 0);

  const submit = () => {
    if (!address.trim()) {
      toast.error("Please enter your pickup address.");
      return;
    }
    if (!date) {
      toast.error("Please select a pickup date.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Pickup requested", {
        description: `${format(date, "PP")} at ${time} · €${totalFee} transport fee`,
      });
      // Push a live status pill so the user sees pickup progress across the app
      const etaMinutes = urgent ? 45 : 120;
      pushStatus({
        id: "pickup-request",
        icon: Bike,
        label: urgent ? "Rider on the way" : "Pickup scheduled",
        detail: `${format(date, "PP")} at ${time} · ${address}`,
        tone: urgent ? "urgent" : "success",
        href: "/dashboard/urgent-service",
        countdownTo: Date.now() + etaMinutes * 60_000,
        expiresAt: Date.now() + (etaMinutes + 15) * 60_000,
      });
      onSubmitted?.();
    }, 700);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25 }}
      className="overflow-hidden"
    >
      <div className="mt-2 rounded-2xl border border-wj-green/20 bg-background/40 backdrop-blur p-4 space-y-4">
        {/* Address */}
        <div className="space-y-1.5 relative">
          <Label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-wj-green" /> Pickup address
          </Label>
          <Input
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setSelectedPlaceId(null);
            }}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={ready ? "Start typing your street…" : "Loading map service…"}
            disabled={!ready}
            className="h-10 bg-background/60 border-wj-green/20 focus-visible:ring-wj-green/40"
          />
          {!ready && (
            <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-wj-green/20 bg-background/95 backdrop-blur shadow-xl overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.placeId}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-wj-green/10 border-b border-border/10 last:border-b-0"
                >
                  <MapPin className="h-3.5 w-3.5 text-wj-green shrink-0 mt-0.5" />
                  <span className="text-foreground truncate">{s.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-wj-green" /> Pickup date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-10 justify-start text-left font-normal bg-background/60 border-wj-green/20 hover:bg-wj-green/10 text-xs"
                >
                  {date ? format(date, "PP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-wj-green" /> Time slot
            </Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className="h-10 bg-background/60 border-wj-green/20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Urgent */}
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-start gap-2.5">
            <Zap className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">Urgent pickup</p>
              <p className="text-[10px] text-muted-foreground">Priority dispatch within the next 2h</p>
            </div>
          </div>
          <Switch checked={urgent} onCheckedChange={setUrgent} />
        </div>

        {/* Fee info */}
        <div className="rounded-xl bg-wj-green/5 border border-wj-green/15 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-wj-green flex items-center gap-1.5">
            <Info className="h-3 w-3" /> Transport fees
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Base transport</span>
            <span className="text-foreground">€{TRANSPORT_BASE}</span>
          </div>
          {urgent && (
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Urgent surcharge</span>
              <span className="text-red-400">+€{URGENT_SURCHARGE}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-wj-green/10">
            <span className="text-[11px] font-medium text-foreground">Total charged</span>
            <span className="text-sm font-semibold text-wj-green">€{totalFee}</span>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-start gap-1.5 pt-1">
            <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            Transport fees for this pick-up request will be charged to your account.
          </p>
        </div>

        <Button
          onClick={submit}
          disabled={submitting || !address}
          className="w-full h-11 bg-wj-green hover:bg-wj-green/90 text-background text-sm font-medium"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Requesting…</>
          ) : (
            <>Confirm pickup · €{totalFee}</>
          )}
        </Button>
      </div>
    </motion.div>
  );
}