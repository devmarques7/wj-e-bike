import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { MeshGradient } from "@paper-design/shaders-react";
import { ACCESS_CODE, grantEarlyAccess } from "@/lib/earlyAccess";

export default function ComingSoon() {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();
  const { toast } = useToast();

  const submit = (value: string) => {
    setIsLoading(true);
    setTimeout(() => {
      if (value === ACCESS_CODE) {
        grantEarlyAccess();
        window.location.replace("/");
      } else {
        setIsLoading(false);
        setCode("");
        toast({
          title: "Invalid code",
          description: "This access code is not valid.",
          variant: "destructive",
        });
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Code */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
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

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <h1 className="text-display-sm font-light text-foreground mb-2">
              Coming soon
            </h1>
            <p className="text-muted-foreground">
              We are putting the final touches on the experience. Enter your
              access code to preview it.
            </p>
          </motion.div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(code);
            }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Access code</p>
              <InputOTP
                maxLength={4}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 4) submit(v);
                }}
                disabled={isLoading}
              >
                <InputOTPGroup className="gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-14 w-14 rounded-xl border-border/50 bg-muted/50 text-xl"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              disabled={isLoading || code.length !== 4}
              className="w-full h-12 gradient-wj text-primary-foreground font-medium"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Unlock access
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground">
            Access is limited to invited riders during the private preview.
          </p>
        </motion.div>
      </div>

      {/* Right Panel - Visual */}
      <div className="hidden lg:flex flex-1 relative bg-slate-100 dark:bg-black p-6">
        <div className="relative w-full h-full rounded-3xl overflow-hidden">
          <MeshGradient
            colors={
              theme === "dark"
                ? ["#0a0a0a", "#0d2818", "#058c42", "#10b981", "#022c1a"]
                : ["#f5f7f5", "#dff5e8", "#058c42", "#86efac", "#ecfdf5"]
            }
            speed={0.25}
            distortion={1}
            swirl={0.8}
            className="absolute inset-0 w-full h-full"
            style={{ opacity: theme === "dark" ? 0.85 : 0.7 }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-wj-forest/60 via-secondary/40 to-wj-deep/70" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-wj-green/30 blur-3xl" />
            <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full bg-wj-green/20 blur-2xl" />
          </div>
          <div className="relative z-10 flex items-center justify-center w-full h-full p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-center"
            >
              <h2 className="text-display-xl font-light text-white/90 mb-4">
                Something new
                <br />
                <span className="text-wj-green">is coming</span>
              </h2>
              <p className="text-white/60 max-w-md mx-auto">
                The next generation of e-bike ownership is almost ready.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}