import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import WalletMemberCard from "./WalletMemberCard";

interface WalletCardProps {
  /** Bike currently selected in the garage scope — shown on the E-Pass. */
  bike?: { id: string; model: string; serial: string | null } | null;
}

export default function WalletCard({ bike }: WalletCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Card visuals per plan slug — same E-Pass themes used in My Wallet
  const cardData: Record<string, { tier: string; number: string; themeId: string }> = {
    free:  { tier: "FREE",  number: "4532 •••• •••• 0000", themeId: "wj-green" },
    light: { tier: "LIGHT", number: "4532 •••• •••• 8901", themeId: "sand" },
    plus:  { tier: "PLUS",  number: "4532 •••• •••• 2847", themeId: "cobalt" },
    black: { tier: "BLACK", number: "4532 •••• •••• 1562", themeId: "graphite" },
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
  const cardNumber = bike?.serial
    ? `4532 •••• •••• ${bike.serial.replace(/\D/g, "").slice(-4).padStart(4, "0")}`
    : data.number;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      onClick={() => navigate(bike ? `/dashboard/e-pass?bike=${bike.id}` : "/dashboard/e-pass")}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate("/dashboard/e-pass");
        }
      }}
      className="h-full min-h-[180px] rounded-3xl overflow-hidden relative group cursor-pointer transition-transform hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <WalletMemberCard
        themeId={data.themeId}
        label="Member card"
        bikeName={bike?.model ?? "WJ Vision"}
        planName={data.tier}
        cardNumber={cardNumber}
        memberName={user?.name || "Guest"}
        className="h-full"
      />
    </motion.div>
  );
}
