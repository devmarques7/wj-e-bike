import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { pt, enGB } from "date-fns/locale";
import { Link } from "react-router-dom";
import type { AdminAlertRow } from "@/hooks/admin/useAdminOverviewData";

interface Props { rows: AdminAlertRow[]; loading?: boolean }

export default function AdminAlerts({ rows, loading }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "pt" ? pt : enGB;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="h-full"
    >
      <Card className="h-full bg-background/60 backdrop-blur-md border-border/30 rounded-2xl overflow-hidden flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Bell className="h-5 w-5 text-wj-green" />
            {t("admin_overview.alerts.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 min-h-0 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {loading ? t("admin_overview.alerts.loading") : t("admin_overview.alerts.empty")}
            </p>
          ) : rows.slice(0, 5).map((alert) => {
            const inner = (
              <div className={cn(
                "p-3 rounded-xl border",
                alert.severity === "error"
                  ? "bg-destructive/10 border-destructive/20"
                  : alert.severity === "warning"
                  ? "bg-amber-500/10 border-amber-500/20"
                  : alert.severity === "success"
                  ? "bg-wj-green/10 border-wj-green/20"
                  : "bg-wj-green/10 border-wj-green/20"
              )}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    alert.severity === "error" ? "text-destructive"
                      : alert.severity === "warning" ? "text-amber-500"
                      : "text-wj-green"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{alert.title}</p>
                    {alert.message && (
                      <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale })}
                    </p>
                  </div>
                </div>
              </div>
            );
            return alert.link ? (
              <Link key={alert.id} to={alert.link} className="block">{inner}</Link>
            ) : <div key={alert.id}>{inner}</div>;
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}
