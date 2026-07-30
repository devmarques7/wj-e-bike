import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CardStatus = "pending" | "approved" | "rejected";

export interface EPassCard {
  id: string;
  bikeId: string | null;
  serial: string;
  model: string;
  cardNumber: string;
  tier: string;
  status: CardStatus;
  purchaseDate: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface OwnedBike {
  id: string;
  model: string;
  serial: string | null;
  purchased_at: string | null;
}

/** Deterministic 16-digit card number derived from the unique bike serial. */
export function cardNumberFromSerial(serial: string): string {
  const clean = (serial || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const body = String(hash).padStart(10, "0").slice(0, 10);
  const tail = clean.replace(/\D/g, "").padStart(2, "0").slice(-2);
  return `4532${body}${tail}`.padEnd(16, "0").slice(0, 16);
}

export function formatCardNumber(n: string): string {
  return (n.match(/.{1,4}/g) || [n]).join(" ");
}

export function useEPassCards() {
  const { user } = useAuth();
  const [cards, setCards] = useState<EPassCard[]>([]);
  const [bikes, setBikes] = useState<OwnedBike[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // Bikes owned by this user (through their customer profile)
    let ownedBikes: OwnedBike[] = [];
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.id) {
      const { data: bikeRows } = await supabase
        .from("customer_bikes")
        .select("id, model, serial, purchased_at")
        .eq("customer_id", profile.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      ownedBikes = (bikeRows ?? []) as OwnedBike[];
    }
    setBikes(ownedBikes);

    const { data: reqs } = await supabase
      .from("epass_card_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    setCards(
      (reqs ?? []).map((r: any) => ({
        id: r.id,
        bikeId: r.bike_id,
        serial: r.bike_serial ?? "",
        model: r.bike_model ?? "WJ V8",
        cardNumber: r.card_number,
        tier: r.tier,
        status: r.status as CardStatus,
        purchaseDate:
          ownedBikes.find((b) => b.id === r.bike_id)?.purchased_at ?? null,
        reviewNotes: r.review_notes,
        createdAt: r.created_at,
      })),
    );
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: refresh when the admin approves/rejects
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`epass_card_requests:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "epass_card_requests",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchAll(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchAll]);

  const requestCard = useCallback(
    async (bike?: OwnedBike) => {
      if (!user?.id) return { error: "Not authenticated" };
      const serial =
        bike?.serial || user.bikeId || `WJ-${user.id.slice(0, 8).toUpperCase()}`;
      const cardNumber = cardNumberFromSerial(serial);
      setSubmitting(true);
      const { error } = await supabase.from("epass_card_requests").insert({
        user_id: user.id,
        bike_id: bike?.id ?? null,
        bike_serial: serial,
        bike_model: bike?.model || user.bikeName || "WJ V8",
        card_number: cardNumber,
        tier: user.tier || "light",
      });
      setSubmitting(false);
      if (error) return { error: error.message };
      await fetchAll();
      return { cardNumber };
    },
    [user, fetchAll],
  );

  const availableBikes = bikes.filter(
    (b) => !cards.some((c) => c.bikeId === b.id && c.status !== "rejected"),
  );

  return { cards, bikes, availableBikes, loading, submitting, requestCard, refresh: fetchAll };
}
