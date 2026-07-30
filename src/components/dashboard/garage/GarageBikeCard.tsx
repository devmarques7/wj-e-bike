import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Battery, Gauge, MapPin, Zap, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { GarageBike } from "@/hooks/garage/useGarageBike";
import type { HealthMetric } from "@/hooks/garage/useGarageBike";
import bikeFull from "@/assets/bike-full.png";
import bikePanel from "@/assets/bike-panel.png";
import bikeHeadlight from "@/assets/bike-headlight.png";
import bikeWheel from "@/assets/bike-wheel.png";
import bikeChain from "@/assets/bike-chain.png";
import bikeBrakes from "@/assets/bike-brakes.png";

/** Component gallery shared with the dashboard showcase. */
const gallery = [
  { image: bikeFull, label: "Full bike" },
  { image: bikePanel, label: "Smart display" },
  { image: bikeHeadlight, label: "LED headlight" },
  { image: bikeWheel, label: "Fat tyres" },
  { image: bikeChain, label: "Drivetrain" },
  { image: bikeBrakes, label: "Hydraulic brakes" },
];

interface Props {
  bike: GarageBike | null;
  overall: number;
  metrics?: HealthMetric[];
}

/** Identity card of the registered bike: model, serial, key telemetry, E-Pass link. */
export default function GarageBikeCard({ bike, overall, metrics = [] }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % gallery.length), 8000);
    return () => clearInterval(id);
  }, []);

  const current = gallery[index];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative h-full min-h-[360px] rounded-3xl overflow-hidden border border-border/30 bg-background/60 backdrop-blur-md"
    >
      {/* Layer 1: Video Background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/videos/service-countdown-bg.mp4" type="video/mp4" />
      </video>

      {/* Layer 2: Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent pointer-events-none" />

      {/* Layer 3: Bike / component gallery on the left */}
      <div className="absolute bottom-0 left-0 w-full h-[75%] pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.img
            key={index}
            src={index === 0 ? bike?.image_url || gallery[0].image : current.image}
            alt={
              index === 0
                ? bike?.model
                  ? `${bike.model} e-bike`
                  : "WJ e-bike"
                : `${current.label} detail`
            }
            loading="lazy"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 0.9, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full h-full object-contain object-left-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
          />
        </AnimatePresence>
      </div>

      {/* Layer 4: Content */}
      <div className="relative z-10 h-full p-5 lg:p-6 flex flex-col justify-between">
        {/* Header - aligned right */}
        <div className="flex flex-col items-end text-right">
          <div>
            <h2 className="text-xl lg:text-2xl font-light text-foreground">
              {bike?.model ?? "No bike registered"}
            </h2>
            <p className="text-xs text-muted-foreground/70 tabular-nums mt-0.5">
              {bike?.serial ?? "—"}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            <Pill icon={<MapPin className="h-3 w-3" />} label={`${bike?.km ?? 0} km`} />
            <Pill
              icon={<Gauge className="h-3 w-3" />}
              label={`${bike?.services_completed ?? 0} services`}
            />
            <Pill icon={<Zap className="h-3 w-3" />} label={`${overall}% health`} />
          </div>
          {bike?.color && (
            <span className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {bike.color} · Registered bike
            </span>
          )}
        </div>

        {/* Right side metrics panel */}
        <div className="flex justify-end mt-4">
          <div className="w-full sm:w-7/12 lg:w-5/12 flex flex-col gap-3">
            <div className="rounded-2xl border border-border/20 bg-background/40 backdrop-blur-sm p-4 flex-1">
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
              className="group rounded-2xl border border-border/20 bg-background/40 backdrop-blur-sm hover:bg-wj-green/10 hover:border-wj-green/40 transition-colors p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm text-foreground">E-Pass</p>
                <p className="text-[11px] text-muted-foreground">Digital identity & cards</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-wj-green transition-colors" />
            </Link>
          </div>
        </div>

        {/* Gallery indicators */}
        <div className="absolute bottom-4 left-5 lg:left-6 flex items-center gap-2 pointer-events-auto">
          <div className="flex gap-1.5">
            {gallery.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setIndex(i)}
                aria-label={g.label}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === index ? "w-6 bg-wj-green" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {current.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/40 backdrop-blur-sm px-2.5 py-1 text-[11px] text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}
