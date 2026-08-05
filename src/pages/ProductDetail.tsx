import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, Shield, Truck, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { bikeProducts, BikeProduct } from "@/data/products";
import useEmblaCarousel from "embla-carousel-react";

// Import bike images from BikeShowcase
import bikeFull from "@/assets/bike-full.png";
import bikePanel from "@/assets/bike-panel.png";
import bikeHeadlight from "@/assets/bike-headlight.png";
import bikeWheel from "@/assets/bike-wheel.png";
import bikeChain from "@/assets/bike-chain.png";
import bikeBrakes from "@/assets/bike-brakes.png";
import bikeV8Side from "@/assets/bike-v8-side.png";
import bikeV8Front from "@/assets/bike-v8-front.png";

// Product part descriptions for scroll reveal with images
const productParts = [
  {
    id: "full",
    image: bikeFull,
    title: "WJ V8 Prestige",
    subtitle: "Design Completo",
    description: "Acabamento premium em cada detalhe. Estrutura em alumínio aeroespacial 6061-T6.",
  },
  {
    id: "panel",
    image: bikePanel,
    title: "Smart Display",
    subtitle: "Painel Digital LCD",
    description: "GPS integrado, métricas em tempo real e conectividade Bluetooth 5.0.",
  },
  {
    id: "headlight",
    image: bikeHeadlight,
    title: "LED Premium 1200lm",
    subtitle: "Iluminação Inteligente",
    description: "Faróis automáticos com sensor de luz ambiente. Alcance de 50 metros.",
  },
  {
    id: "wheel",
    image: bikeWheel,
    title: "Kenda Fat Tire 20x4.0",
    subtitle: "Rodas All-Terrain",
    description: "Pneus para máxima aderência em qualquer superfície. Pressão ideal: 15 PSI.",
  },
  {
    id: "chain",
    image: bikeChain,
    title: "Shimano 7-Speed",
    subtitle: "Transmissão Premium",
    description: "Sistema de marchas de alta performance com troca suave e precisa.",
  },
  {
    id: "brakes",
    image: bikeBrakes,
    title: "Disco Hidráulico 180mm",
    subtitle: "Sistema de Freios",
    description: "Freios a disco com pastilhas cerâmicas para frenagem potente e silenciosa.",
  },
];

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<BikeProduct | null>(null);
  const [selectedColor, setSelectedColor] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedEPass, setSelectedEPass] = useState<"basic" | "silver" | "black">("basic");
  const [isScrolled, setIsScrolled] = useState(false);
  const [activePart, setActivePart] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Transform for sticky bike image and video
  const bikeScale = useTransform(scrollYProgress, [0, 0.12], [0.95, 1]);
  const bikeOpacity = useTransform(scrollYProgress, [0.04, 0.12], [0, 1]);
  const videoOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  useEffect(() => {
    const foundProduct = bikeProducts.find((p) => p.id === id);
    setProduct(foundProduct || null);
  }, [id]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      
      // Update active part based on scroll position - slower transitions
      const scrollRange = document.body.scrollHeight - window.innerHeight;
      const rawPercent = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      const scrollPercent = Number.isFinite(rawPercent) ? rawPercent : 0;
      // Reduced multiplier for slower image transitions (more scroll distance per image)
      const partIndex = Math.max(
        0,
        Math.min(
          Math.floor(scrollPercent * productParts.length * 1.2),
          productParts.length - 1
        )
      );
      setActivePart(partIndex);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
  }, []);

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const ePassPrices = {
    basic: 0,
    silver: 14.99,
    black: 24.99,
  };

  const totalPrice = product.price * quantity;

  return (
    <div className="min-h-screen bg-background" ref={containerRef}>
      <Navigation isScrolled={isScrolled} />

      {/* Back Button */}
      <div className="fixed top-24 left-4 md:left-8 z-30">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Link to="/gallery">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Gallery
          </Link>
        </Button>
      </div>

      <main className="pt-0">
        {/* Hero Section with Video Background */}
        <section className="relative min-h-[420vh]">
          {/* Sticky Container */}
          <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
            {/* Static Background base */}
            <div className="absolute inset-0 z-0 bg-background" />

            {/* Video Background - Visible on load, fades out on scroll */}
            <motion.div 
              className="absolute inset-0 z-[5]"
              style={{ opacity: videoOpacity }}
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              >
                <source src="/videos/product-detail-bg.mp4" type="video/mp4" />
              </video>
              {/* Gradient Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/10" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-transparent" />
            </motion.div>

            {/* Bike Images - Fade in on scroll (behind video initially) */}
            <motion.div
              style={{ scale: bikeScale, opacity: bikeOpacity }}
              className="absolute inset-0 z-[2]"
            >
              <AnimatePresence mode="sync">
                <motion.div
                  key={activePart}
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0.7 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="absolute inset-0"
                >
                  <img
                    src={productParts[activePart].image}
                    alt={productParts[activePart].title}
                    className="w-full h-full object-cover"
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
                </motion.div>
              </AnimatePresence>

              {/* Progress Indicators */}
              <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20">
                {productParts.map((_, index) => (
                  <motion.div
                    key={index}
                    className={`w-1 rounded-full transition-all duration-500 ${
                      index === activePart
                        ? "h-10 bg-wj-green"
                        : "h-2 bg-foreground/20"
                    }`}
                  />
                ))}
              </div>
            </motion.div>

            {/* Product Info Overlay */}
            <div className="absolute bottom-24 left-0 right-0 px-8 z-20">
              <div className="container-wj">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-center md:text-left"
                >
                  <p className="text-wj-green text-sm font-medium tracking-widest uppercase mb-3">
                    {product.category}
                  </p>
                  <h1 className="text-display-sm md:text-display-lg font-bold text-foreground mb-3">
                    {product.name}
                  </h1>
                  <p className="text-xl text-muted-foreground">
                    {product.tagline}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Scroll Down Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Scroll para explorar
              </span>
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="h-5 w-5 text-wj-green" />
              </motion.div>
            </motion.div>
          </div>

          {/* Scroll Content - Part Details with more spacing */}
          <div className="relative z-10 pointer-events-none pt-[30vh]">
            {productParts.map((part, index) => (
              <div
                key={part.id}
                className="min-h-[85vh] flex items-center px-8 py-16"
              >
                <motion.div
                  initial={{ opacity: 0, x: index % 2 === 0 ? -60 : 60 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-30%" }}
                  transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                  className={`max-w-md ${
                    index % 2 === 0 ? "mr-auto" : "ml-auto text-right"
                  }`}
                >
                  <div className="glass rounded-2xl p-8 pointer-events-auto backdrop-blur-xl border border-white/5">
                    {/* Feature Tag */}
                    <span className="inline-block px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-wj-green bg-wj-green/10 rounded-full mb-4">
                      {part.subtitle}
                    </span>
                    <h3 className="text-2xl font-bold text-foreground mb-3">
                      {part.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {part.description}
                    </p>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </section>

        {/* Configuration Section */}
        <section className="section-padding bg-card">
          <div className="container-wj">
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Left - Options */}
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-8">
                  Configure Your {product.name}
                </h2>

                {/* Color Selection */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Color: {product.colors[selectedColor].name}
                  </label>
                  <div className="flex gap-3">
                    {product.colors.map((color, index) => (
                      <button
                        key={color.name}
                        onClick={() => setSelectedColor(index)}
                        className={`w-12 h-12 rounded-full border-2 transition-all duration-200 ${
                          selectedColor === index
                            ? "border-wj-green scale-110 ring-2 ring-wj-green/30"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* E-Pass Selection */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-foreground mb-3">
                    E-Pass Membership
                  </label>
                  <div className="space-y-3">
                    {(["basic", "silver", "black"] as const).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setSelectedEPass(tier)}
                        className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                          selectedEPass === tier
                            ? "border-wj-green bg-wj-green/5"
                            : "border-border hover:border-wj-green/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-foreground capitalize">
                              {tier === "basic" ? "Basic (Included)" : `E-Pass ${tier}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {tier === "basic" && "2-year warranty • E-ID included"}
                              {tier === "silver" && "5-year warranty • Priority service"}
                              {tier === "black" && "Lifetime warranty • VIP treatment"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {tier === "basic" ? "Free" : `+€${ePassPrices[tier]}/mo`}
                            </span>
                            {selectedEPass === tier && (
                              <Check className="h-5 w-5 text-wj-green" />
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Quantity
                  </label>
                  <div className="inline-flex items-center border border-border rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-3 hover:bg-secondary transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="p-3 hover:bg-secondary transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right - Summary */}
              <div>
                <div className="sticky top-28 glass rounded-2xl p-8">
                  <h3 className="text-lg font-bold text-foreground mb-6">
                    Order Summary
                  </h3>

                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {product.name} × {quantity}
                      </span>
                      <span className="text-foreground">
                        {formatPrice(totalPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        E-Pass {selectedEPass}
                      </span>
                      <span className="text-foreground">
                        {selectedEPass === "basic"
                          ? "Included"
                          : `+€${ePassPrices[selectedEPass]}/mo`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="text-wj-green">Free</span>
                    </div>
                    <div className="border-t border-border pt-4">
                      <div className="flex justify-between">
                        <span className="text-lg font-bold text-foreground">
                          Total
                        </span>
                        <span className="text-lg font-bold text-foreground">
                          {formatPrice(totalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    asChild
                    size="lg"
                    className="w-full gradient-wj text-white hover:opacity-90 mb-4"
                  >
                    <Link to="/checkout">
                      <ShoppingBag className="h-5 w-5 mr-2" />
                      Proceed to Checkout
                    </Link>
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mb-6">
                    Reserved for you for the next 15 minutes
                  </p>

                  {/* Trust Badges */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <Truck className="h-5 w-5 mx-auto text-wj-green mb-1" />
                      <p className="text-xs text-muted-foreground">
                        Free Shipping
                      </p>
                    </div>
                    <div>
                      <Shield className="h-5 w-5 mx-auto text-wj-green mb-1" />
                      <p className="text-xs text-muted-foreground">
                        2yr Warranty
                      </p>
                    </div>
                    <div>
                      <Zap className="h-5 w-5 mx-auto text-wj-green mb-1" />
                      <p className="text-xs text-muted-foreground">
                        Fast Delivery
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Specs Section */}
        <section className="section-padding bg-background">
          <div className="container-wj">
            <h2 className="text-2xl font-bold text-foreground mb-8 text-center">
              Technical Specifications
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {Object.entries(product.specs).map(([key, value]) => (
                <div
                  key={key}
                  className="text-center p-6 rounded-xl bg-card border border-border"
                >
                  <p className="text-2xl font-bold text-foreground mb-1">
                    {value}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {key}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Floating Purchase Bar - Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div className="glass border-t border-border p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{product.name}</p>
              <p className="text-lg font-bold text-foreground">
                {formatPrice(totalPrice)}
              </p>
            </div>
            <Button asChild className="gradient-wj text-white">
              <Link to="/checkout">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Checkout
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProductDetail;
