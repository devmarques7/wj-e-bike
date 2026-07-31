import { useEffect, useState } from "react";
import {
  getRecentEPassVisits,
  subscribeRecentEPass,
  type EPassVisit,
} from "@/lib/garage/recentEpass";

/** Reactive access to the session list of recently reviewed E-Pass bikes. */
export function useRecentEPass() {
  const [visits, setVisits] = useState<EPassVisit[]>(() => getRecentEPassVisits());

  useEffect(() => {
    const sync = () => setVisits(getRecentEPassVisits());
    sync();
    return subscribeRecentEPass(sync);
  }, []);

  return { visits, last: visits[0] ?? null };
}
