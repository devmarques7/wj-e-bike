import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { Bike, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BikePickerDialog, { LinkedBike } from "@/components/dashboard/BikePickerDialog";
import bikeFull from "@/assets/bike-full.png";
import bikePanel from "@/assets/bike-panel.png";
import bikeHeadlight from "@/assets/bike-headlight.png";
import bikeWheel from "@/assets/bike-wheel.png";
import bikeChain from "@/assets/bike-chain.png";
import bikeBrakes from "@/assets/bike-brakes.png";

const bikeFeatures = [
  {
    image: bikeFull,
    title: "WJ V8 Prestige",
    feature: "Sua Bike",
    description: "Adquirida em 15 Jan 2024",
    stats: [
      { label: "Km Total", value: "1,247" },
      { label: "Bateria", value: "92%" },
    ],
  },
  {
    image: bikePanel,
    title: "Smart Display",
    feature: "Painel Digital",
    description: "LCD de alta resolução com conectividade",
    stats: [
      { label: "Velocidade Máx", value: "45 km/h" },
      { label: "Autonomia", value: "80 km" },
    ],
  },
  {
    image: bikeHeadlight,
    title: "LED Premium",
    feature: "Faróis Inteligentes",
    description: "Iluminação automática com sensor de luz ambiente",
    stats: [
      { label: "Potência", value: "1200 lm" },
      { label: "Alcance", value: "50m" },
    ],
  },
  {
    image: bikeWheel,
    title: "Kenda Fat Tire",
    feature: "Rodas All-Terrain",
    description: "Pneus 20x4.0 para máxima aderência",
    stats: [
      { label: "Aro", value: "20\"" },
      { label: "Pressão", value: "15 PSI" },
    ],
  },
  {
    image: bikeChain,
    title: "Shimano 7-Speed",
    feature: "Transmissão",
    description: "Sistema de marchas de alta performance",
    stats: [
      { label: "Marchas", value: "7" },
      { label: "Última Manutenção", value: "12 dias" },
    ],
  },
  {
    image: bikeBrakes,
    title: "Disco Hidráulico",
    feature: "Sistema de Freios",
    description: "Freios a disco 180mm com pastilhas cerâmicas",
    stats: [
      { label: "Disco", value: "180mm" },
      { label: "Condição", value: "Ótima" },
    ],
  },
];

// Preload images
const preloadImages = () => {
  bikeFeatures.forEach((feature) => {
    const img = new Image();
    img.src = feature.image;
  });
};

export default function BikeShowcase() {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [registeredBikes, setRegisteredBikes] = useState<LinkedBike[]>([]);
  const [activeBikeIndex, setActiveBikeIndex] = useState(0);
  const [loadingBike, setLoadingBike] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const isRealUser = !!user && !user.isDemo && user.role === "customer";

  // Load registered bike for real authenticated customers
  useEffect(() => {
    let cancelled = false;
    async function loadBike() {
      if (!isRealUser) {
        // Demo users fall back to mock user.bikeId behavior
        setLoadingBike(false);
        return;
      }
      setLoadingBike(true);
      const { data: cp } = await supabase
        .from("customer_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!cp?.id) {
        if (!cancelled) {
          setRegisteredBikes([]);
          setLoadingBike(false);
        }
        return;
      }
      const { data: bikes } = await supabase
        .from("customer_bikes")
        .select("id, model, serial, color")
        .eq("customer_id", cp.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setRegisteredBikes(bikes ?? []);
        setActiveBikeIndex(0);
        setLoadingBike(false);
      }
    }
    loadBike();
    return () => { cancelled = true; };
  }, [isRealUser, user?.id]);

  // A bike is considered present if (a) a real customer has a customer_bikes row,
  // or (b) a demo/mock user has bikeId set on their profile.
  const registeredBike = registeredBikes[activeBikeIndex] ?? null;
  const hasBike = isRealUser ? registeredBikes.length > 0 : !!user?.bikeId;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    dragFree: false,
    skipSnaps: false,
  });

  // Preload all images on mount
  useEffect(() => {
    preloadImages();
    
    // Mark as loaded after a short delay to ensure images are cached
    const timer = setTimeout(() => {
      setImagesLoaded(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Sync embla index with state
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    
    emblaApi.on("select", onSelect);
    onSelect();
    
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Auto-advance carousel every 8 seconds
  useEffect(() => {
    if (!emblaApi || !imagesLoaded) return;

    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 8000);

    return () => clearInterval(interval);
  }, [emblaApi, imagesLoaded]);

  // Navigate to specific slide
  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const currentFeature = bikeFeatures[currentIndex];

  if (!hasBike) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative h-full min-h-[400px] rounded-3xl overflow-hidden border border-border/40 bg-card/30 backdrop-blur-md"
        >
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 pb-0">
            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">My Bike</h2>
              <p className="text-[11px] text-muted-foreground/70 font-light">Your ride at a glance</p>
            </div>
            <div className="p-2 rounded-full bg-background/20 backdrop-blur-sm">
              <Bike className="h-4 w-4 text-wj-green" />
            </div>
          </div>
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8">
            {loadingBike ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPickerOpen(true)}
                  disabled={!isRealUser}
                  className="group relative w-20 h-20 rounded-full bg-wj-green/10 border border-wj-green/40 flex items-center justify-center mb-4 transition-colors hover:bg-wj-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Register a bike"
                >
                  <Plus className="h-8 w-8 text-wj-green" strokeWidth={1.5} />
                  <span className="absolute inset-0 rounded-full ring-0 ring-wj-green/30 group-hover:ring-4 transition-all" />
                </motion.button>
                <p className="text-sm font-medium text-foreground/80">Register your bike</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  {isRealUser
                    ? "Tap the + to pick your WJ bike from our inventory."
                    : "Sign in with a real account to register a bike."}
                </p>
              </>
            )}
          </div>
        </motion.div>

        <BikePickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onRegistered={(bike) => {
            setRegisteredBikes((prev) => {
              const next = [bike, ...prev];
              setActiveBikeIndex(0);
              return next;
            });
          }}
        />
      </>
    );
  }

  const pickerDialog = (
    <BikePickerDialog
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      onRegistered={(bike) => {
        setRegisteredBikes((prev) => {
          const next = [bike, ...prev];
          setActiveBikeIndex(0);
          return next;
        });
      }}
    />
  );

  return (
    <>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative h-full min-h-[400px] rounded-3xl overflow-hidden"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 pb-0">
        <div className="space-y-0.5">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">My Bike</h2>
          <p className="text-[11px] text-muted-foreground/70 font-light">Your ride at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/garage"
            className="px-2.5 py-1 rounded-full text-[11px] bg-background/30 backdrop-blur-sm border border-border/40 text-muted-foreground hover:text-foreground hover:border-wj-green/40 transition-colors"
          >
            Garage
          </Link>
          {isRealUser && registeredBikes.length > 1 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-background/30 backdrop-blur-sm border border-border/40">
              {registeredBikes.map((b, i) => (
                <button
                  key={b.id}
                  onClick={() => setActiveBikeIndex(i)}
                  title={b.model}
                  className={`h-2 w-2 rounded-full transition-all ${
                    i === activeBikeIndex ? "bg-wj-green scale-110" : "bg-muted-foreground/40 hover:bg-muted-foreground/70"
                  }`}
                />
              ))}
            </div>
          )}
          {isRealUser && (
            <button
              onClick={() => setPickerOpen(true)}
              className="p-2 rounded-full bg-background/30 backdrop-blur-sm border border-border/40 hover:bg-wj-green/20 hover:border-wj-green/40 transition-colors"
              aria-label="Register another bike"
              title="Register another bike"
            >
              <Plus className="h-4 w-4 text-wj-green" strokeWidth={2} />
            </button>
          )}
          <div className="p-2 rounded-full bg-background/20 backdrop-blur-sm">
            <Bike className="h-4 w-4 text-wj-green" />
          </div>
        </div>
      </div>
      {/* Carousel Container */}
      <div className="absolute inset-0" ref={emblaRef}>
        <div className="flex h-full">
          {bikeFeatures.map((feature, index) => (
            <div
              key={index}
              className="flex-[0_0_100%] min-w-0 relative h-full"
            >
              <img
                src={feature.image}
                alt={feature.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
              {/* Dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
            </div>
          ))}
        </div>
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-3"
          >
            {/* Feature Label */}
            <span className="inline-block px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-wj-green bg-wj-green/10 rounded">
              {currentFeature.feature}
            </span>

            {/* Title & Description */}
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                {currentFeature.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {currentFeature.description}
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-6 pt-2">
              {currentFeature.stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-lg font-semibold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Bike ID & Progress */}
        <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between pointer-events-auto">
          <div>
            <p className="text-xs text-muted-foreground font-mono">
              {registeredBike?.serial || registeredBike?.model || user?.bikeId || "V8-2024-NL-00156"}
            </p>
          </div>

          {/* Progress Indicators */}
          <div className="flex gap-1.5">
            {bikeFeatures.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? "w-6 bg-wj-green"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
    {pickerDialog}
    </>
  );
}
