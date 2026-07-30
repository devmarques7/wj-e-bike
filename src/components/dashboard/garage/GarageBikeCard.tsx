import { motion } from "framer-motion";
import { Battery, Gauge, MapPin, Zap, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { GarageBike } from "@/hooks/garage/useGarageBike";
import type { HealthMetric } from "@/hooks/garage/useGarageBike";
import bikeFull from "@/assets/bike-full.png";

interface Props {
  bike: GarageBike | null;
  overall: number;
  metrics?: HealthMetric[];
}

/** Identity card of the registered bike: model, serial, key telemetry, E-Pass link. */
export default function GarageBikeCard({ bike, overall, metrics = [] }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl border border-border/30 bg-background/60 backdrop-blur-md p-5 lg:p-6 h-full"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-light text-foreground">
            {bike?.model ?? "No bike registered"}
          </h2>
          <p className="text-xs text-muted-foreground/70 tabular-nums mt-0.5">
            {bike?.serial ?? "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill icon={<MapPin className="h-3 w-3" />} label={`${bike?.km ?? 0} km`} />
          <Pill
            icon={<Gauge className="h-3 w-3" />}
            label={`${bike?.services_completed ?? 0} services`}
          />
          <Pill icon={<Zap className="h-3 w-3" />} label={`${overall}% health`} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-12 gap-4">
        <div className="col-span-12 sm:col-span-7 relative rounded-2xl bg-muted/30 border border-border/20 p-4 min-h-[200px] overflow-hidden flex items-center justify-center">
          <img
            src={bike?.image_url || bikeFull}
            alt={bike?.model ? `${bike.model} e-bike` : "WJ e-bike"}
            loading="lazy"
            className="w-full max-h-[220px] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
          />
          <span className="absolute left-4 top-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {bike?.color ? `${bike.color} · ` : ""}Registered bike
          </span>
        </div>

        <div className="col-span-12 sm:col-span-5 flex flex-col gap-3">
          <div className="rounded-2xl border border-border/20 bg-muted/20 p-4 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Battery className="h-3.5 w-3.5 text-wj-green" />
              Overall condition
            </div>
            <p className="mt-2 text-3xl font-light text-foreground tabular-nums">
              {overall}
              <span className="text-base text-muted-foreground">%</span>
            </p>
            <div className="mt-3 flex gap-[3px]">
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-6 flex-1 rounded-full ${
                    i < Math.round(overall / 5) ? "bg-wj-green" : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          </div>

          <Link
            to="/dashboard/e-pass"
            className="group rounded-2xl border border-border/20 bg-muted/20 hover:bg-wj-green/10 hover:border-wj-green/40 transition-colors p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-foreground">E-Pass</p>
              <p className="text-[11px] text-muted-foreground">Digital identity & cards</p>
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-wj-green transition-colors" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}