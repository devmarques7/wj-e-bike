import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useRef, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";
import { MeshGradient } from "@paper-design/shaders-react";

export default function WalletCard() {
  const { user } = useAuth();
  const { theme } = useTheme();

  // Card visuals per plan slug (free is the default fallback for every member)
  const cardData: Record<string, { tier: string; number: string; color: string }> = {
    free:  { tier: "FREE",  number: "4532 •••• •••• 0000", color: "from-emerald-400 to-emerald-600" },
    light: { tier: "LIGHT", number: "4532 •••• •••• 8901", color: "from-zinc-400 to-zinc-600" },
    plus:  { tier: "PLUS",  number: "4532 •••• •••• 2847", color: "from-blue-400 to-blue-600" },
    black: { tier: "BLACK", number: "4532 •••• •••• 1562", color: "from-amber-400 to-amber-600" },
  };

  // For demo users (light/plus/black mocks) use the tier directly.
  // For real users, resolve plan from subscription → plan_versions → plans.slug,
  // and provision a default Free subscription if none exists yet.
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(
    user?.tier ?? null
  );

  useEffect(() => {
    if (!user || user.isDemo) {
      setResolvedSlug(user?.tier ?? null);
      return;
    }
    let cancelled = false;
    (async () => {
      // 1. Look up the user's most recent subscription
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("id, plan_version_id, status, plan_versions:plan_version_id(plan_id, plans:plan_id(slug))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const existing: any = subs?.[0];
      if (existing?.plan_versions?.plans?.slug) {
        if (!cancelled) setResolvedSlug(existing.plan_versions.plans.slug);
        return;
      }

      // 2. No subscription → provision the default Free plan automatically
      const { data: defaultPlan } = await supabase
        .from("plans")
        .select("id, slug, plan_versions:plan_versions(id, status)")
        .eq("is_default", true)
        .eq("is_active", true)
        .maybeSingle();

      const activeVersion = (defaultPlan as any)?.plan_versions?.find(
        (v: any) => v.status === "active"
      );

      if (defaultPlan && activeVersion) {
        await supabase.from("subscriptions").insert({
          user_id: user.id,
          plan_version_id: activeVersion.id,
          status: "active",
          payment_method: "cash",
        });
        if (!cancelled) setResolvedSlug((defaultPlan as any).slug || "free");
      } else if (!cancelled) {
        setResolvedSlug("free");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.isDemo, user?.tier]);

  const slug = (resolvedSlug || "free").toLowerCase();
  const data = cardData[slug] ?? cardData.free;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="h-full rounded-3xl overflow-hidden relative group"
    >
      {/* Video Background */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
        style={{ opacity: 1 }}
      >
        <source src="/videos/wallet-background.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-black/70" />

      {/* Card Content */}
      <div className="relative z-10 h-full p-5 flex flex-col justify-between min-h-[180px]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-medium">Member Card</p>
            <h3 className="text-sm font-semibold text-white tracking-tight">WJ Vision</h3>
          </div>
          <div className={`px-2 py-0.5 rounded-full bg-gradient-to-r ${data.color} text-[9px] font-bold uppercase tracking-wider text-white`}>
            {data.tier}
          </div>
        </div>

        {/* Card Number */}
        <div className="space-y-1">
          <p className="text-white/40 text-[9px] uppercase tracking-widest">Card Number</p>
          <p className="text-white text-sm font-mono tracking-[0.15em]">{data.number}</p>
        </div>

        {/* Footer */}
        <div className="flex items-end">
          <div>
            <p className="text-white/40 text-[9px] uppercase tracking-widest mb-0.5">Member</p>
            <p className="text-white text-xs font-medium truncate max-w-[120px]">{user?.name || "Guest"}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
