import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Loader2, ArrowLeft, User, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { MeshGradient } from "@paper-design/shaders-react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneInput } from "@/components/PhoneInput";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [rememberMe, setRememberMe] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneValid, setPhoneValid] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  
  const { login, user, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Once AuthContext has a hydrated real (non-demo) user after a login,
  // redirect to the correct dashboard for their role.
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.mustCompleteProfile) {
      navigate("/complete-profile", { replace: true });
    } else if (user.role === "admin") {
      navigate("/dashboard/admin", { replace: true });
    } else if (user.role === "staff") {
      navigate("/dashboard/staff", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password, rememberMe);

    if (result.success) {
      toast({
        title: "Welcome back",
        description: "Redirecting to your dashboard...",
      });
      // Don't navigate yet — wait for AuthContext to hydrate `user`
      // (profile + roles). A useEffect below handles role-based redirect.
    } else {
      const code = result.code;
      let description = "Invalid email or password. Please try again.";
      if (code === "email_not_confirmed") {
        description =
          "Please confirm your email before signing in. Check your inbox.";
      } else if (code === "invalid_credentials") {
        description = "Invalid email or password. Please try again.";
        // Check if this email has a pending invite — if so, the user
        // must use the temporary password from the invitation, not a
        // password they made up.
        try {
          const { data } = await supabase.functions.invoke(
            "check-invite-status",
            { body: { email: email.trim().toLowerCase() } },
          );
          if ((data as any)?.pending) {
            description =
              "This email has a pending invite. Use the temporary password sent by your administrator. If you lost it, ask them to regenerate it.";
          }
        } catch {
          // ignore — keep generic message
        }
      } else if (result.message) {
        description = result.message;
      }
      toast({
        title: "Authentication failed",
        description,
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!phone || !phoneValid) {
      toast({ title: "Phone required", description: "Add a valid phone number.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    if (!phoneVerified) {
      toast({
        title: "Phone not verified",
        description: "Please verify your phone via WhatsApp before creating the account.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, phone },
      },
    });

    if (error) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Persist phone + verified flag onto the freshly-created profile
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (uid) {
        await supabase
          .from("profiles")
          .update({ phone, phone_verified: true })
          .eq("user_id", uid);
      }
      toast({
        title: "Account created!",
        description: "Check your email to confirm your account.",
      });
      setMode("login");
      setPassword("");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <span className="text-2xl font-bold tracking-wider">
              <span className="text-foreground">WJ</span>
              <span className="text-wj-green"> VISION</span>
            </span>
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h1 className="text-display-sm font-light text-foreground mb-2">
              {mode === "register" ? "Create account" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground">
              {mode === "register" ? "Join WJ Vision and start your journey" : "Sign in to access your dashboard"}
            </p>
          </motion.div>

          {/* Mode Toggle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex gap-2 mb-8"
          >
            {mode === "register" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("login")}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Button>
            ) : null}
          </motion.div>

          <AnimatePresence mode="wait">
            {mode === "register" ? (
              <motion.form
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleRegister}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required className="h-12 bg-muted/50 border-border/50 focus:border-wj-green pl-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-12 bg-muted/50 border-border/50 focus:border-wj-green pl-11" />
                  </div>
                </div>
                <PhoneInput
                  required
                  label="Phone number (WhatsApp)"
                  defaultCountry="NL"
                  onChange={(e164, isValid) => {
                    setPhone(e164);
                    setPhoneValid(isValid);
                    setPhoneVerified(false);
                  }}
                  onVerified={() => setPhoneVerified(true)}
                />
                <div className="space-y-2">
                  <Label htmlFor="reg-password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="reg-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required minLength={6} className="h-12 bg-muted/50 border-border/50 focus:border-wj-green pl-11 pr-12" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
                </div>
                <Button type="submit" disabled={isLoading} className="w-full h-12 gradient-wj text-primary-foreground font-medium">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create Account<ArrowRight className="h-4 w-4 ml-2" /></>)}
                </Button>
                <p className="text-xs text-center text-muted-foreground">By creating an account, you agree to our Terms of Service and Privacy Policy.</p>
              </motion.form>
            ) : (
              <motion.form
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleLogin}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-12 bg-muted/50 border-border/50 focus:border-wj-green" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="h-12 bg-muted/50 border-border/50 focus:border-wj-green pr-12" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(c) => setRememberMe(!!c)}
                    />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                      Remember me for 30 days
                    </Label>
                  </div>
                  <button type="button" className="text-sm text-muted-foreground hover:text-wj-green transition-colors">
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" disabled={isLoading} className="w-full h-12 gradient-wj text-primary-foreground font-medium">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Sign In<ArrowRight className="h-4 w-4 ml-2" /></>)}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Footer */}
          {mode !== "register" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 text-center text-sm text-muted-foreground"
            >
              New to WJ Vision?{" "}
              <button onClick={() => setMode("register")} className="text-wj-green hover:underline">
                Create an account
              </button>
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex flex-1 relative bg-slate-100 dark:bg-black p-6">
        {/* Inner container with ShiftTracker-style mesh gradient background */}
        <div className="relative w-full h-full rounded-3xl overflow-hidden">
          {/* Animated Mesh Gradient Background (same as ShiftTracker card) */}
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

          {/* Overlay gradient for legibility */}
          <div className="absolute inset-0 bg-gradient-to-br from-wj-forest/60 via-secondary/40 to-wj-deep/70" />

          {/* Decorative blurs */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-wj-green/30 blur-3xl" />
            <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full bg-wj-green/20 blur-2xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex items-center justify-center w-full h-full p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-center"
            >
              <h2 className="text-display-xl font-light text-white/90 mb-4">
                Your E-Bike
                <br />
                <span className="text-wj-green">Journey</span>
              </h2>
              <p className="text-white/60 max-w-md mx-auto">
                Track maintenance, book services, and unlock exclusive member benefits
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
