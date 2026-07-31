import { useSelectedBike } from "@/contexts/SelectedBikeContext";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, MapPin, Truck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const timeSlots = [
  "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"
];

const defaultServiceTypes = [
  { id: "spring-clean", name: "Spring Deep Clean", duration: "2-3 hours", price: "€49" },
  { id: "safety-audit", name: "Safety Audit", duration: "1-2 hours", price: "€29" },
  { id: "battery-check", name: "Battery Diagnostic", duration: "1 hour", price: "€19" },
  { id: "full-service", name: "Full Service", duration: "4-5 hours", price: "€89" },
];

type ServiceBookingProps = {
  preselectedServiceId?: string;
  extraServiceTypes?: { id: string; name: string; duration: string; price: string }[];
  lockServiceType?: boolean;
};

export default function ServiceBooking({
  preselectedServiceId,
  extraServiceTypes = [],
  lockServiceType = false,
}: ServiceBookingProps = {}) {
  const { user } = useAuth();
  const serviceTypes = [...extraServiceTypes, ...defaultServiceTypes];
  const [selectedService, setSelectedService] = useState<string | null>(preselectedServiceId ?? null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<"dropoff" | "valet">("dropoff");
  const [isBooked, setIsBooked] = useState(false);

  const isBlackTier = user?.tier === "black";

  const { bike: scopedBike } = useSelectedBike();

  const handleBook = () => {
    setIsBooked(true);
    setTimeout(() => setIsBooked(false), 3000);
  };

  // Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.getDate(),
      full: date.toISOString().split("T")[0],
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-card rounded-2xl border border-border/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-wj-green/10 flex items-center justify-center">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-wj-green" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-medium text-foreground">Book Service</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {scopedBike ? `${scopedBike.model}${scopedBike.serial ? ` · ${scopedBike.serial}` : ""}` : "Workshop Concierge"}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Service Type */}
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
            Service Type
          </p>
          <div className="grid grid-cols-2 gap-2">
            {serviceTypes.map((service) => (
              <button
                key={service.id}
                onClick={() => setSelectedService(service.id)}
                className={cn(
                  "p-2.5 sm:p-3 rounded-lg border text-left transition-all",
                  selectedService === service.id
                    ? "border-wj-green bg-wj-green/10"
                    : "border-border/50 hover:border-border"
                )}
              >
                <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-1">{service.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{service.duration}</span>
                  <span className="text-[10px] sm:text-xs font-medium text-wj-green">{service.price}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Selection */}
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
            Select Date
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {dates.map((d) => (
              <button
                key={d.full}
                onClick={() => setSelectedDate(d.full)}
                className={cn(
                  "flex-shrink-0 w-12 sm:w-14 py-2.5 sm:py-3 rounded-lg border text-center transition-all",
                  selectedDate === d.full
                    ? "border-wj-green bg-wj-green/10"
                    : "border-border/50 hover:border-border"
                )}
              >
                <p className="text-[10px] sm:text-xs text-muted-foreground">{d.day}</p>
                <p className="text-base sm:text-lg font-light text-foreground">{d.date}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Time Slots */}
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
            Available Slots
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {timeSlots.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={cn(
                  "px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-xs sm:text-sm transition-all",
                  selectedTime === time
                    ? "border-wj-green bg-wj-green/10 text-wj-green"
                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                )}
              >
                {time}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Type - Only for Black tier */}
        {isBlackTier && (
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3">
              Delivery Method
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                onClick={() => setDeliveryType("dropoff")}
                className={cn(
                  "p-3 sm:p-4 rounded-lg border flex items-center gap-2 sm:gap-3 transition-all",
                  deliveryType === "dropoff"
                    ? "border-wj-green bg-wj-green/10"
                    : "border-border/50"
                )}
              >
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground">Drop-off</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Bring to store</p>
                </div>
              </button>
              <button
                onClick={() => setDeliveryType("valet")}
                className={cn(
                  "p-3 sm:p-4 rounded-lg border flex items-center gap-2 sm:gap-3 transition-all",
                  deliveryType === "valet"
                    ? "border-wj-green bg-wj-green/10"
                    : "border-border/50"
                )}
              >
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-wj-green flex-shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-foreground">Valet Pick-up</p>
                  <p className="text-[10px] sm:text-xs text-wj-green">VIP Service</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Book Button */}
        <AnimatePresence mode="wait">
          {isBooked ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl bg-wj-green text-white"
            >
              <Check className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-sm sm:text-base">Booking Confirmed!</span>
            </motion.div>
          ) : (
            <motion.div key="button">
              <Button
                onClick={handleBook}
                disabled={!selectedService || !selectedDate || !selectedTime}
                className="w-full gradient-wj h-10 sm:h-12 text-sm sm:text-base"
              >
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2" />
                Confirm Booking
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
