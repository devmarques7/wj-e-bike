import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Navigate, Link } from "react-router-dom";
import { Plus, Users, Euro, ArrowRight, Upload } from "lucide-react";
import AdminDashboardLayout from "@/components/dashboard/AdminDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlans, type PlanWithActiveVersion } from "@/hooks/plans/usePlansData";
import PlanFormModal from "@/components/dashboard/plans/PlanFormModal";

export default function AdminPlansManage() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { plans, refetch, loading } = usePlans();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanWithActiveVersion | null>(null);
  const [initialTab, setInitialTab] = useState<"single" | "bulk">("single");

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  return (
    <AdminDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-light text-foreground">{t("plans.manage.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("plans.manage.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setInitialTab("bulk");
                setOpen(true);
              }}
              className="gap-2"
            >
              <Upload className="h-4 w-4" /> {t("plans.manage.import", { defaultValue: "Import JSON / CSV" })}
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setInitialTab("single");
                setOpen(true);
              }}
              className="bg-wj-green hover:bg-wj-green/90 gap-2"
            >
              <Plus className="h-4 w-4" /> {t("plans.manage.new_plan")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">{t("plans.manage.loading")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: p.color_hex ?? "#666" }} />
                    <h3 className="font-medium">{p.name}</h3>
                  </div>
                  {p.is_active ? <Badge className="bg-wj-green/20 text-wj-green">{t("plans.manage.active")}</Badge> : <Badge variant="outline">{t("plans.manage.archived")}</Badge>}
                </div>
                {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-light">€{Number(p.activeVersion?.price ?? 0).toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground">/ {p.activeVersion?.interval ? String(t(`plans.intervals.${p.activeVersion.interval}`, { defaultValue: p.activeVersion.interval })) : "—"}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {t("plans.manage.subs", { n: p.activeSubs })}</span>
                  <span className="flex items-center gap-1"><Euro className="h-3 w-3" /> v{p.activeVersion?.version_number ?? 0}</span>
                </div>
                <div className="flex gap-2 mt-auto pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(p); setOpen(true); }}>{t("plans.manage.edit")}</Button>
                  <Link to={`/dashboard/admin/plans/${p.id}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full gap-1">{t("plans.manage.view")} <ArrowRight className="h-3 w-3" /></Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <PlanFormModal
          open={open}
          onOpenChange={setOpen}
          plan={editing}
          onSaved={refetch}
          initialTab={editing ? "single" : initialTab}
        />
      </div>
    </AdminDashboardLayout>
  );
}