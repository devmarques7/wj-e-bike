import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import RoleDashboardLayout from "@/components/dashboard/RoleDashboardLayout";
import ProductCard from "@/components/ProductCard";
import BikeAdvisorCard from "@/components/dashboard/catalog/BikeAdvisorCard";
import { bikeProducts, categories, BikeProduct } from "@/data/products";
import { useAuth } from "@/contexts/AuthContext";

export default function BikeCatalog() {
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [recommended, setRecommended] = useState<BikeProduct | null>(null);

  const filtered = useMemo(
    () =>
      bikeProducts.filter(
        (p) =>
          (selectedCategory === "all" || p.category === selectedCategory) &&
          p.id !== recommended?.id,
      ),
    [selectedCategory, recommended],
  );

  const grouped = useMemo(() => {
    return categories
      .filter((c) => c.id !== "all")
      .map((c) => ({ ...c, items: filtered.filter((p) => p.category === c.id) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return (
    <RoleDashboardLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <BikeAdvisorCard
          onRecommend={(bike, ride) => {
            setRecommended(bike);
            setSelectedCategory(ride ?? "all");
          }}
        />

        {recommended && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-wj-green/30 bg-wj-green/5 p-5 lg:p-6"
          >
            <p className="text-xs uppercase tracking-widest text-wj-green mb-4">
              Recommended for you
            </p>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <ProductCard product={recommended} index={0} />
              </div>
              <div className="lg:col-span-2 flex flex-col justify-center gap-3">
                <h2 className="text-2xl font-semibold text-foreground">{recommended.name}</h2>
                <p className="text-muted-foreground">{recommended.tagline}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  {Object.entries(recommended.specs).map(([key, value]) => (
                    <div key={key} className="rounded-2xl bg-background/50 border border-border/40 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {key}
                      </p>
                      <p className="text-sm text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {recommended.features.map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === c.id
                  ? "gradient-wj text-white"
                  : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {grouped.map((group) => (
          <section key={group.id} className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{group.name}</h3>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {group.items.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          </section>
        ))}

        {grouped.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            No bikes found in this category.
          </p>
        )}
      </div>
    </RoleDashboardLayout>
  );
}