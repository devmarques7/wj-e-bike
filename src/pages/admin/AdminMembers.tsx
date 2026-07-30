import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  Star, 
  Trophy,
  Calendar,
  ThumbsUp,
  Wrench,
  TrendingUp,
  Plus,
  Copy,
  Loader2,
  Mail,
  Link2,
  Check,
  MoreVertical,
  Eye,
  Send,
  XCircle,
  Hourglass,
  Pencil,
  Trash2,
  EyeOff,
  RefreshCw,
  KeyRound,
  ChevronDown,
  UserCheck
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Fragment } from "react";
import AdminDashboardLayout from "@/components/dashboard/AdminDashboardLayout";
import AdminKPICard from "@/components/dashboard/AdminKPICard";
import KPICarousel from "@/components/dashboard/KPICarousel";
import EPassCardRequestsCard from "@/components/dashboard/EPassCardRequestsCard";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import MemberProfileDialog from "@/components/dashboard/MemberProfileDialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type Role = "admin" | "staff" | "customer" | "guest";

interface MemberRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  must_complete_profile: boolean;
  role: Role;
  created_at: string;
  is_active?: boolean;
}

type InviteStatus = "pending" | "completed" | "revoked" | "expired";

interface InviteRow {
  id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  created_at: string;
  expires_at: string;
  user_id: string | null;
}

const getRoleBadge = (role: Role) => {
  const map: Record<Role, string> = {
    admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    staff: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    customer: "bg-wj-green/20 text-wj-green border-wj-green/30",
    guest: "bg-muted text-muted-foreground border-border/50",
  };
  return <Badge className={cn("text-[10px] capitalize", map[role])}>{role}</Badge>;
};

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? src[1] ?? "";
  return (a + b).toUpperCase();
}

function DetailItem({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="text-xs min-w-0 truncate">{children}</div>
    </div>
  );
}

export default function AdminMembers() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "staff" as Role });
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
    setup_link: string | null;
  } | null>(null);
  const [copied, setCopied] = useState<"link" | "creds" | null>(null);
  const [viewMember, setViewMember] = useState<MemberRow | null>(null);
  const [tab, setTab] = useState<"members" | "invites">("members");
  const [editInvite, setEditInvite] = useState<InviteRow | null>(null);
  const [editRole, setEditRole] = useState<Role>("customer");
  const [savingEdit, setSavingEdit] = useState(false);
  const [revokeInvite, setRevokeInvite] = useState<InviteRow | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [linkLoadingId, setLinkLoadingId] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [showCreatedPwd, setShowCreatedPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdResult, setPwdResult] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const loadMembers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, full_name, email, avatar_url, must_complete_profile, created_at, is_active")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load members", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = (profiles ?? []).map((p) => p.user_id);
    let rolesById = new Map<string, Role>();
    if (ids.length) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      (roles ?? []).forEach((r: any) => {
        const prev = rolesById.get(r.user_id);
        const rank = (x: Role) => (x === "admin" ? 3 : x === "staff" ? 2 : x === "customer" ? 1 : 0);
        if (!prev || rank(r.role) > rank(prev)) rolesById.set(r.user_id, r.role);
      });
    }
    const teamRoles = new Set<Role>(["admin", "staff"]);
    setMembers(
      (profiles ?? [])
        .map((p: any) => ({
          ...p,
          role: rolesById.get(p.user_id) ?? "customer",
        }))
        .filter((m: MemberRow) => teamRoles.has(m.role)),
    );

    // Load invitations — scope to team roles only
    const { data: invitesData } = await supabase
      .from("member_invitations")
      .select("id, email, role, status, created_at, expires_at, user_id")
      .order("created_at", { ascending: false });
    setInvites(
      ((invitesData ?? []) as any[])
        .map((i) => ({
          ...i,
          status:
            i.status === "pending" && new Date(i.expires_at).getTime() < Date.now()
              ? "expired"
              : i.status,
        }))
        .filter((i: InviteRow) => teamRoles.has(i.role)),
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.role]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email) return;
    setCreating(true);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      toast({ title: "Session expired", variant: "destructive" });
      setCreating(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke("admin-create-member", {
      body: form,
    });
    if (error || !(data as any)?.success) {
      toast({
        title: "Could not create member",
        description: error?.message || (data as any)?.error || "Unknown error",
        variant: "destructive",
      });
      setCreating(false);
      return;
    }
    setCreatedCreds({
      email: (data as any).email,
      password: (data as any).temp_password,
      setup_link: (data as any).setup_link ?? null,
    });
    setForm({ email: "", full_name: "", role: "staff" });
    await loadMembers();
    setCreating(false);
  };

  const copyTo = async (kind: "link" | "creds") => {
    if (!createdCreds) return;
    const text =
      kind === "link"
        ? createdCreds.setup_link ?? ""
        : `Email: ${createdCreds.email}\nTemporary password: ${createdCreds.password}`;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  };

  const openEditInvite = (inv: InviteRow) => {
    setEditRole(inv.role);
    setEditInvite(inv);
    setEditPassword("");
    setShowEditPwd(false);
    setPwdResult(null);
  };

  const saveInviteRole = async () => {
    if (!editInvite) return;
    setSavingEdit(true);
    const { error } = await supabase
      .from("member_invitations")
      .update({ role: editRole })
      .eq("id", editInvite.id);
    if (!error && editInvite.user_id && editInvite.status === "pending") {
      // Sync user_roles for the invited user
      await supabase.from("user_roles").delete().eq("user_id", editInvite.user_id);
      if (editRole !== "customer") {
        await supabase.from("user_roles").insert({ user_id: editInvite.user_id, role: editRole });
      }
    }
    if (error) {
      toast({ title: "Could not update invite", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invite updated" });
      setEditInvite(null);
      await loadMembers();
    }
    setSavingEdit(false);
  };

  const confirmRevokeInvite = async () => {
    if (!revokeInvite) return;
    setRevoking(true);
    const { data, error } = await supabase.functions.invoke("admin-revoke-member", {
      body: { invitation_id: revokeInvite.id },
    });
    if (error || !(data as any)?.success) {
      toast({
        title: "Could not cancel invite",
        description: error?.message || (data as any)?.error || "Unknown error",
        variant: "destructive",
      });
    } else {
      toast({ title: "Invite cancelled" });
      setRevokeInvite(null);
      await loadMembers();
    }
    setRevoking(false);
  };

  const copyInviteLink = async (inv: InviteRow) => {
    setLinkLoadingId(inv.id);
    const { data, error } = await supabase.functions.invoke("admin-invite-link", {
      body: { invitation_id: inv.id },
    });
    setLinkLoadingId(null);
    const link = (data as any)?.setup_link as string | undefined;
    if (error || !link) {
      toast({
        title: "Could not generate link",
        description: error?.message || (data as any)?.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(inv.id);
      setTimeout(() => setCopiedInviteId((c) => (c === inv.id ? null : c)), 1800);
      toast({ title: "Invite link copied" });
    } catch {
      toast({ title: "Copy failed", description: link, variant: "destructive" });
    }
  };

  const submitPasswordChange = async (mode: "custom" | "regenerate") => {
    if (!editInvite) return;
    if (mode === "custom" && (editPassword.length < 8 || editPassword.length > 72)) {
      toast({ title: "Password must be 8–72 characters", variant: "destructive" });
      return;
    }
    setSavingPwd(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-invite-password", {
      body: {
        invitation_id: editInvite.id,
        ...(mode === "custom" ? { password: editPassword } : {}),
      },
    });
    setSavingPwd(false);
    if (error || !(data as any)?.success) {
      toast({
        title: "Could not update password",
        description: error?.message || (data as any)?.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    setPwdResult((data as any).password as string);
    setEditPassword("");
    toast({ title: "Password updated" });
  };

  if (authLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  const totalMembers = members.length;
  const pending = members.filter((m) => m.must_complete_profile).length;
  const admins = members.filter((m) => m.role === "admin").length;
  const staffCount = members.filter((m) => m.role === "staff").length;

  // Ratings are not yet tracked in the API → every member shows 0.
  // Sort by most recent so admins still see real, recognizable members.
  const topPerformers = [...members]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((member) => ({ member, rating: 0 }));

  const weekMs = 7 * 864e5;
  const newThisWeek = members.filter((m) => Date.now() - new Date(m.created_at).getTime() < weekMs).length;
  const activeCount = members.filter((m) => m.is_active !== false).length;
  const completionRate = totalMembers
    ? Math.round(((totalMembers - pending) / totalMembers) * 100)
    : 0;

  const dynamicKPIs = [
    { label: "Total Members", value: String(totalMembers), change: `+${members.filter(m => Date.now() - new Date(m.created_at).getTime() < 7*864e5).length} this week`, trend: "up" as const, icon: Users },
    { label: "Pending Setup", value: String(pending), change: pending ? "needs action" : "all set", trend: "up" as const, icon: Mail },
    { label: "Staff", value: String(staffCount), change: "+0", trend: "up" as const, icon: Wrench },
    { label: "Admins", value: String(admins), change: "+0", trend: "up" as const, icon: Star },
  ];

  return (
    <AdminDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-xl sm:text-2xl font-light text-foreground">Member Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Pre-register users — they finish setup on first login.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gradient-wj h-10">
            <Plus className="h-4 w-4 mr-2" /> Add member
          </Button>
        </motion.div>

        {/* KPI Cards */}
        <KPICarousel>
          {dynamicKPIs.map((kpi, index) => (
            <AdminKPICard key={kpi.label} {...kpi} index={index} />
          ))}
        </KPICarousel>

        <EPassCardRequestsCard />

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6 items-stretch">
          {/* Tabs Table - 8 columns */}
          <div className="col-span-12 lg:col-span-8 flex">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl overflow-hidden flex-1 flex flex-col w-full"
            >
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex flex-col flex-1 min-h-0">
                <div className="p-4 border-b border-border/30 flex items-center justify-between gap-4 flex-wrap">
                  <TabsList className="bg-muted/40 h-9">
                    <TabsTrigger value="members" className="text-xs gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Team Members
                      <span className="ml-1 text-[10px] text-muted-foreground">({members.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="invites" className="text-xs gap-1.5">
                      <Send className="h-3.5 w-3.5" /> Invites
                      <span className="ml-1 text-[10px] text-muted-foreground">({invites.length})</span>
                    </TabsTrigger>
                  </TabsList>
                  <span className="text-xs text-muted-foreground">
                    {tab === "members" ? `${totalMembers} total` : `${invites.filter(i => i.status === "pending").length} pending`}
                  </span>
                </div>

                <TabsContent value="members" className="flex-1 min-h-0 m-0 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">Member</TableHead>
                        <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Role</TableHead>
                        <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">Rating</TableHead>
                        <TableHead className="text-muted-foreground text-xs w-20 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">Loading…</TableCell></TableRow>
                      ) : members.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-8">No members yet. Click "Add member" to invite the first one.</TableCell></TableRow>
                      ) : members.map((m) => {
                        const isExpanded = expandedMember === m.user_id;
                        const toggle = () => setExpandedMember((curr) => (curr === m.user_id ? null : m.user_id));
                        return (
                        <Fragment key={m.user_id}>
                        <TableRow
                          className="border-border/30 hover:bg-muted/30 cursor-pointer"
                          onClick={toggle}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                {m.avatar_url ? <img src={m.avatar_url} alt="" /> : (
                                  <AvatarFallback className="bg-wj-green/20 text-wj-green text-[10px] font-bold">
                                    {initials(m.full_name, m.email)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex flex-col leading-tight min-w-0">
                                <span className="text-xs font-medium truncate">{m.full_name || "—"}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{m.email || "—"}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{getRoleBadge(m.role)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {m.is_active === false ? (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Deactivated</Badge>
                            ) : m.must_complete_profile ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Pending setup</Badge>
                            ) : (
                              <Badge className="bg-wj-green/20 text-wj-green border-wj-green/30 text-[10px]">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                              <span className="text-foreground font-medium">0.0</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full hover:bg-muted/60 hidden md:inline-flex"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => setViewMember(m)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" /> View profile
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full hover:bg-muted/60"
                                onClick={toggle}
                                aria-label={isExpanded ? "Collapse row" : "Expand row"}
                              >
                                <motion.span
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.25, ease: "easeOut" }}
                                  className="inline-flex"
                                >
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                </motion.span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <TableRow className="border-border/30 hover:bg-transparent bg-muted/10">
                              <TableCell colSpan={5} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: "easeOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                                    <DetailItem label="Role">{getRoleBadge(m.role)}</DetailItem>
                                    <DetailItem label="Status">
                                      {m.is_active === false ? (
                                        <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">Deactivated</Badge>
                                      ) : m.must_complete_profile ? (
                                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Pending setup</Badge>
                                      ) : (
                                        <Badge className="bg-wj-green/20 text-wj-green border-wj-green/30 text-[10px]">Active</Badge>
                                      )}
                                    </DetailItem>
                                    <DetailItem label="Rating">
                                      <span className="inline-flex items-center gap-1 text-foreground">
                                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                                        <span className="font-medium">0.0</span>
                                      </span>
                                    </DetailItem>
                                    <DetailItem label="Joined">
                                      <span className="text-foreground">
                                        {new Date(m.created_at).toLocaleDateString()}
                                      </span>
                                    </DetailItem>
                                    <DetailItem label="Email" className="col-span-2 md:col-span-2">
                                      <span className="text-foreground truncate" title={m.email || ""}>
                                        {m.email || "—"}
                                      </span>
                                    </DetailItem>
                                    <DetailItem label="User ID" className="col-span-2 md:col-span-2">
                                      <span className="font-mono text-[10px] text-muted-foreground truncate" title={m.user_id}>
                                        {m.user_id}
                                      </span>
                                    </DetailItem>
                                  </div>
                                  <div className="px-4 pb-3">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-[11px]"
                                      onClick={() => setViewMember(m)}
                                    >
                                      <Eye className="h-3 w-3 mr-1.5" /> Open full profile
                                    </Button>
                                  </div>
                                </motion.div>
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                        </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="invites" className="flex-1 min-h-0 m-0 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30 hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Role</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Sent</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Expires</TableHead>
                        <TableHead className="text-muted-foreground text-xs w-10 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">Loading…</TableCell></TableRow>
                      ) : invites.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-8">No invites yet.</TableCell></TableRow>
                      ) : invites.map((i) => {
                        const statusMap: Record<InviteStatus, { label: string; cls: string; icon: any }> = {
                          pending: { label: "Awaiting setup", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: Hourglass },
                          completed: { label: "Completed", cls: "bg-wj-green/20 text-wj-green border-wj-green/30", icon: Check },
                          revoked: { label: "Revoked", cls: "bg-muted text-muted-foreground border-border/50", icon: XCircle },
                          expired: { label: "Expired", cls: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
                        };
                        const s = statusMap[i.status];
                        const Icon = s.icon;
                        return (
                          <TableRow key={i.id} className="border-border/30 hover:bg-muted/30">
                            <TableCell className="text-xs font-medium">{i.email}</TableCell>
                            <TableCell>{getRoleBadge(i.role)}</TableCell>
                            <TableCell>
                              <Badge className={cn("text-[10px] gap-1", s.cls)}>
                                <Icon className="h-3 w-3" /> {s.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(i.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(i.expires_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full hover:bg-muted/60"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  {i.status === "pending" && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => copyInviteLink(i)}
                                        disabled={linkLoadingId === i.id}
                                      >
                                        {copiedInviteId === i.id ? (
                                          <Check className="h-3.5 w-3.5 mr-2 text-wj-green" />
                                        ) : linkLoadingId === i.id ? (
                                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                        ) : (
                                          <Link2 className="h-3.5 w-3.5 mr-2" />
                                        )}
                                        {copiedInviteId === i.id ? "Copied" : "Copy invite link"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => openEditInvite(i)}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit role
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => setRevokeInvite(i)}
                                    className={cn(
                                      i.status !== "completed" &&
                                        "text-destructive focus:text-destructive",
                                    )}
                                  >
                                    {i.status === "completed" ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 mr-2 text-wj-green" /> Close invite
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Cancel invite
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>

          {/* Rankings - 4 columns */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {/* Top Performers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-medium text-foreground">Top Performers</h3>
              </div>
              
              <div className="space-y-3">
                {loading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loading && topPerformers.length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-4">
                    No members yet.
                  </p>
                )}
                {!loading && topPerformers.map(({ member, rating }, index) => {
                  const name = member.full_name || member.email || "Unknown";
                  return (
                    <motion.button
                      key={member.user_id}
                      type="button"
                      onClick={() => setViewMember(member)}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.08 }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                        index === 0 ? "bg-amber-400/20 text-amber-400" :
                        index === 1 ? "bg-zinc-400/20 text-zinc-400" :
                        index === 2 ? "bg-orange-400/20 text-orange-400" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {index + 1}
                      </div>
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="bg-wj-green/20 text-wj-green text-[10px] font-bold">
                          {initials(member.full_name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{name}</p>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={cn(
                                "h-2.5 w-2.5",
                                i <= Math.round(rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/40"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-[10px] text-wj-green font-medium shrink-0">
                        {rating.toFixed(1)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-background/60 backdrop-blur-md border border-border/30 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-4 w-4 text-wj-green" />
                <h3 className="text-sm font-medium text-foreground">Weekly Stats</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <ThumbsUp className="h-5 w-5 text-wj-green mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{completionRate}%</p>
                  <p className="text-[10px] text-muted-foreground">Completion</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <Calendar className="h-5 w-5 text-wj-green mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{newThisWeek}</p>
                  <p className="text-[10px] text-muted-foreground">New this week</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <UserCheck className="h-5 w-5 text-wj-green mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{activeCount}</p>
                  <p className="text-[10px] text-muted-foreground">Active</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 text-center">
                  <Mail className="h-5 w-5 text-wj-green mx-auto mb-1" />
                  <p className="text-lg font-bold text-foreground">{pending}</p>
                  <p className="text-[10px] text-muted-foreground">Pending setup</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setCreatedCreds(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="font-light">
              {createdCreds ? "Member ready" : "Add new member"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {createdCreds
                ? "Share the magic link — it auto-signs in and opens the setup screen. Credentials are a fallback."
                : "Pre-register a user. They'll set their final email and password on first login."}
            </DialogDescription>
          </DialogHeader>
          {createdCreds ? (
            <div className="space-y-4">
              {/* Magic link block (primary) */}
              {createdCreds.setup_link ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Setup link</span>
                    <button
                      type="button"
                      onClick={() => copyTo("link")}
                      className="text-[10px] text-wj-green hover:underline inline-flex items-center gap-1"
                    >
                      {copied === "link" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied === "link" ? "Copied" : "Copy link"}
                    </button>
                  </div>
                  <div className="rounded-lg border border-wj-green/30 bg-wj-green/5 p-3 flex items-center gap-2 min-w-0 overflow-hidden">
                    <Link2 className="h-3.5 w-3.5 text-wj-green shrink-0" />
                    <p
                      className="text-[11px] font-mono text-foreground truncate min-w-0 flex-1"
                      title={createdCreds.setup_link}
                    >
                      {createdCreds.setup_link.length > 48
                        ? `${createdCreds.setup_link.slice(0, 48)}…`
                        : createdCreds.setup_link}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Magic link unavailable — share the credentials below instead.
                </p>
              )}

              {/* Credentials fallback */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Fallback credentials</span>
                  <button
                    type="button"
                    onClick={() => copyTo("creds")}
                    className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    {copied === "creds" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied === "creds" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-[11px] space-y-1.5 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">Email</span>
                    <span className="font-mono truncate min-w-0" title={createdCreds.email}>
                      {createdCreds.email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-muted-foreground shrink-0">Password</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={cn(
                          "font-mono truncate min-w-0",
                          !showCreatedPwd && "tracking-widest"
                        )}
                        title={showCreatedPwd ? createdCreds.password : undefined}
                      >
                        {showCreatedPwd ? createdCreds.password : "••••••••••••••"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCreatedPwd((s) => !s)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={showCreatedPwd ? "Hide password" : "Show password"}
                      >
                        {showCreatedPwd ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => { setOpen(false); setCreatedCreds(null); }} className="gradient-wj w-full">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="m-email">Email</Label>
                <Input id="m-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-name">Full name (optional)</Label>
                <Input id="m-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={creating} className="gradient-wj">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create</>}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <MemberProfileDialog
        member={viewMember}
        onClose={() => setViewMember(null)}
        onChanged={async () => {
          await loadMembers();
          setViewMember((curr) =>
            curr ? (members.find((m) => m.user_id === curr.user_id) ?? curr) : curr,
          );
        }}
      />

      {/* Edit invite dialog */}
      <Dialog open={!!editInvite} onOpenChange={(o) => !o && setEditInvite(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-light">Edit invite</DialogTitle>
            <DialogDescription className="text-xs">
              Update the role or reset the temporary password for this pending invite.
            </DialogDescription>
          </DialogHeader>
          {editInvite && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</Label>
                <p className="text-xs font-mono truncate" title={editInvite.email}>{editInvite.email}</p>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Password section */}
              <div className="space-y-2 pt-2 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5" /> Temporary password
                  </Label>
                  {pwdResult && (
                    <span className="text-[10px] text-wj-green inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Saved
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showEditPwd ? "text" : "password"}
                    placeholder={pwdResult ? "" : "Click Regenerate to create a new password"}
                    value={pwdResult ?? ""}
                    readOnly
                    className="pr-16 font-mono text-xs"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowEditPwd((s) => !s)}
                      disabled={!pwdResult}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-40"
                      aria-label={showEditPwd ? "Hide password" : "Show password"}
                    >
                      {showEditPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!pwdResult) return;
                        await navigator.clipboard.writeText(pwdResult);
                        toast({ title: "Password copied" });
                      }}
                      disabled={!pwdResult}
                      className="text-muted-foreground hover:text-wj-green disabled:opacity-40"
                      aria-label="Copy password"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => submitPasswordChange("regenerate")}
                  disabled={savingPwd}
                  className="w-full h-8 text-xs"
                >
                  {savingPwd ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      {pwdResult ? "Regenerate again" : "Regenerate password"}
                    </>
                  )}
                </Button>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditInvite(null)}>Cancel</Button>
                <Button onClick={saveInviteRole} disabled={savingEdit} className="gradient-wj">
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke / Close invite dialog */}
      <Dialog open={!!revokeInvite} onOpenChange={(o) => !o && setRevokeInvite(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-light">
              {revokeInvite?.status === "completed" ? "Close invite?" : "Cancel invite?"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {revokeInvite?.status === "completed"
                ? "Setup is already completed. This will only archive the invitation entry — the member account stays active."
                : "This permanently removes the invitation and the pre-registered user account. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {revokeInvite && (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs font-mono truncate" title={revokeInvite.email}>
              {revokeInvite.email}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeInvite(null)}>
              {revokeInvite?.status === "completed" ? "Cancel" : "Keep"}
            </Button>
            {revokeInvite?.status === "completed" ? (
              <Button
                onClick={confirmRevokeInvite}
                disabled={revoking}
                className="gradient-wj"
              >
                {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Close invite</>}
              </Button>
            ) : (
              <Button
                onClick={confirmRevokeInvite}
                disabled={revoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" /> Cancel invite</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminDashboardLayout>
  );
}
