import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Plus, Trash2, Star, Loader2, Building2 } from "lucide-react";
import AdminDashboardLayout from "@/components/dashboard/AdminDashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type PickupPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  notes: string | null;
};

const emptyForm = {
  name: "",
  address: "",
  latitude: 0,
  longitude: 0,
  phone: "",
  is_headquarters: false,
  is_active: true,
  notes: "",
};

export default function AdminPickupPlaces() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { ready, hasKey } = useGoogleMaps(["places"]);
  const [places, setPlaces] = useState<PickupPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pickup_places")
      .select("*")
      .order("is_headquarters", { ascending: false })
      .order("name");
    setPlaces((data as PickupPlace[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Google Places Autocomplete on the address input
  useEffect(() => {
    if (!ready || !addressInputRef.current) return;
    const google = (window as any).google;
    const ac = new google.maps.places.Autocomplete(addressInputRef.current, {
      fields: ["formatted_address", "geometry", "name"],
    });
    const listener = ac.addListener("place_changed", () => {
      const p = ac.getPlace();
      if (!p.geometry?.location) return;
      setForm((f) => ({
        ...f,
        address: p.formatted_address ?? f.address,
        latitude: p.geometry.location.lat(),
        longitude: p.geometry.location.lng(),
        name: f.name || p.name || "",
      }));
    });
    return () => listener?.remove?.();
  }, [ready]);

  // Overview map
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const google = (window as any).google;
    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: { lat: 52.3702, lng: 4.8952 },
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#0b1418" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#6b7d80" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#050d0f" }] },
        ],
      });
    }
    const map = mapInstance.current;
    (map as any)._markers?.forEach((m: any) => m.setMap(null));
    (map as any)._markers = places.map((p) =>
      new google.maps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        map,
        title: p.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: p.is_headquarters ? "#058c42" : "#0aa851",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 8,
        },
      })
    );
  }, [ready, places]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (p: PickupPlace) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      phone: p.phone ?? "",
      is_headquarters: p.is_headquarters,
      is_active: p.is_active,
      notes: p.notes ?? "",
    });
  };

  const save = async () => {
    if (!form.name || !form.address || !form.latitude || !form.longitude) {
      toast.error("Please pick an address from the suggestions.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude,
      phone: form.phone || null,
      is_headquarters: form.is_headquarters,
      is_active: form.is_active,
      notes: form.notes || null,
    };
    const { error } = editingId
      ? await supabase.from("pickup_places").update(payload).eq("id", editingId)
      : await supabase.from("pickup_places").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Place updated" : "Place added");
    resetForm();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this pickup place?")) return;
    const { error } = await supabase.from("pickup_places").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  return (
    <AdminDashboardLayout>
      <div className="p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-wj-green/15 border border-wj-green/30 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-wj-green" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                Pick-It-Up Places
              </h1>
              <p className="text-xs text-muted-foreground">
                Manage workshops and drop-off locations for urgent service
              </p>
            </div>
          </div>

          {!hasKey && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300">
              Set <code>VITE_GOOGLE_MAPS_API_KEY</code> to enable the map & address autocomplete.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Map overview */}
            <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-border/20 bg-muted/5">
              <div ref={mapRef} className="w-full h-[380px]" />
            </div>

            {/* Add / edit form */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-wj-green/20 bg-wj-green/5 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">
                  {editingId ? "Edit place" : "Add new place"}
                </h2>
                {editingId && (
                  <button onClick={resetForm} className="text-xs text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Workshop name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Address (search)</Label>
                <Input
                  ref={addressInputRef}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Start typing an address…"
                />
                {form.latitude !== 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+31…"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" /> Headquarters
                </Label>
                <Switch
                  checked={form.is_headquarters}
                  onCheckedChange={(v) => setForm({ ...form, is_headquarters: v })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Active</Label>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>

              <Button onClick={save} disabled={saving} className="w-full gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingId ? "Save changes" : "Add place"}
              </Button>
            </motion.div>
          </div>

          {/* List */}
          <div className="space-y-2">
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Registered places ({places.length})
            </h2>
            {loading ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-wj-green" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {places.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-border/20 bg-muted/5 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-wj-green/10 flex items-center justify-center shrink-0">
                      {p.is_headquarters ? (
                        <Star className="h-4 w-4 text-wj-green" />
                      ) : (
                        <MapPin className="h-4 w-4 text-wj-green" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        {p.is_headquarters && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-wj-green/40 text-wj-green">
                            HQ
                          </span>
                        )}
                        {!p.is_active && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-muted-foreground/30 text-muted-foreground">
                            inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                      {p.phone && <p className="text-[11px] text-wj-green">{p.phone}</p>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(p)}
                        className="text-[10px] uppercase tracking-wider text-wj-green px-2 py-1 rounded hover:bg-wj-green/10"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="text-red-400 px-2 py-1 rounded hover:bg-red-500/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminDashboardLayout>
  );
}