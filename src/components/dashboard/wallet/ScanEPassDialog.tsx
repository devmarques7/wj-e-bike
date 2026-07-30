import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import StyledEPassQR from "@/components/dashboard/StyledEPassQR";
import EPassScanner from "@/components/dashboard/wallet/EPassScanner";

interface ScanEPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bikeId: string;
  bikeName: string;
  memberName: string;
  planName: string;
}

/** Full-size scannable E-Pass QR used at the workshop counter. */
export default function ScanEPassDialog({
  open,
  onOpenChange,
  bikeId,
  bikeName,
  memberName,
  planName,
}: ScanEPassDialogProps) {
  const [tab, setTab] = useState("my-pass");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-light">Scan E-Pass</DialogTitle>
          <DialogDescription>
            Show your code at the WJ workshop — or scan another rider's E-Pass to open their bike.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-full">
            <TabsTrigger value="my-pass" className="rounded-full">My pass</TabsTrigger>
            <TabsTrigger value="scan" className="rounded-full">Scan a pass</TabsTrigger>
          </TabsList>

          <TabsContent value="my-pass" className="space-y-4 pt-4">
            <div className="rounded-3xl bg-foreground/[0.06] border border-border/50 p-6 flex items-center justify-center">
              <StyledEPassQR
                data={`https://wjbikes.nl/epass/${bikeId}`}
                size={220}
                overrides={{ backgroundColor: "transparent" }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <Info label="Member" value={memberName} />
              <Info label="Plan" value={planName} />
              <Info label="Bike" value={bikeName} />
            </div>
          </TabsContent>

          <TabsContent value="scan" className="pt-4">
            <EPassScanner active={open && tab === "scan"} onNavigate={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 px-2 py-2 min-w-0">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground truncate">{value}</p>
    </div>
  );
}