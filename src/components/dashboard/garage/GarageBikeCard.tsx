import { motion } from "framer-motion";
import { Battery, Gauge, MapPin, Zap, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { MeshGradient } from "@paper-design/shaders-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { GarageBike } from "@/hooks/garage/useGarageBike";
import type { HealthMetric } from "@/hooks/garage/useGarageBike";
import bikeAsset from "@/assets/garage-bike-black.png.asset.json";

interface Props {
  bike: GarageBike | null;
  overall: number;
  metrics?: HealthMetric[];
}

/** Identity card of the registered bike: model, serial, key telemetry, E-Pass link. */
export default function GarageBikeCard({ bike, overall, metrics = [] }: Props) {
  const { theme } = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative h-full min-h-[360px] rounded-3xl overflow-hidden border border-border/30 bg-background/60 backdrop-blur-md"
    >
      {/* Layer 1: Mesh gradient background (system standard) */}
      <MeshGradient
        colors={theme === "dark"
          ? ["#0a0a0a", "#0d2818", "#058c42", "#10b981", "#022c1a"]
          : ["#f5f7f5", "#dff5e8", "#058c42", "#86efac", "#ecfdf5"]}
        speed={0.25}
        distortion={1}
        swirl={0.8}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: theme === "dark" ? 0.85 : 0.7 }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />

      {/* Layer 2: Bike image on the left */}
      <div className="absolute bottom-0 left-0 w-full h-[75%] pointer-events-none">
        <motion.img
          src={bikeAsset.url}
          alt={bike?.model ? `${bike.model} e-bike` : "WJ e-bike"}
          loading="lazy"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 0.9, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full h-full object-contain object-left-bottom drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
        />
        {/* Bottom edge fade — only a few pixels up to the wheel */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background via-background/40 to-transparent pointer-events-none" />
        {/* Left edge fade — only a few pixels in from the lateral side */}
        <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-background via-background/40 to-transparent pointer-events-none" />
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
