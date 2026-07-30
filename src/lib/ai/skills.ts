import {
  Bike,
  Wrench,
  Tag,
  Package,
  CalendarClock,
  Heart,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AssistantSkillId =
  | "my_bike"
  | "service_catalog"
  | "pricing"
  | "products"
  | "bike_catalog"
  | "appointments"
  | "favorites"
  | "actions";

export interface AssistantSkill {
  id: AssistantSkillId;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tools (edge function) this skill unlocks */
  tools: string[];
  samplePrompts: string[];
  defaultEnabled: boolean;
}

export const ASSISTANT_SKILLS: AssistantSkill[] = [
  {
    id: "my_bike",
    name: "My Bike",
    description:
      "Reads your registered bikes: model, serial, mileage, service history and next revision date.",
    icon: Bike,
    tools: ["get_my_bikes"],
    samplePrompts: ["How is my bike doing?", "When is my next revision?"],
    defaultEnabled: true,
  },
  {
    id: "service_catalog",
    name: "Service Catalog",
    description:
      "Knows every service type, duration, coverage per membership level and emergency options.",
    icon: Wrench,
    tools: ["get_service_catalog"],
    samplePrompts: ["Which services are covered by my plan?"],
    defaultEnabled: true,
  },
  {
    id: "pricing",
    name: "Plans & Pricing",
    description:
      "Membership tiers, active plan versions, prices, intervals and included benefits.",
    icon: Tag,
    tools: ["get_plans"],
    samplePrompts: ["Compare the membership plans"],
    defaultEnabled: true,
  },
  {
    id: "products",
    name: "Accessories & Parts",
    description:
      "Searches the accessory and parts catalog with live prices, categories and availability.",
    icon: Package,
    tools: ["search_products"],
    samplePrompts: ["Show me lights under €100"],
    defaultEnabled: true,
  },
  {
    id: "bike_catalog",
    name: "Bike Catalog",
    description:
      "Compares other WJ bikes, their specifications and prices to help you upgrade.",
    icon: Sparkles,
    tools: ["search_bikes"],
    samplePrompts: ["Which bike should I upgrade to?"],
    defaultEnabled: true,
  },
  {
    id: "appointments",
    name: "Appointments",
    description:
      "Your upcoming and past appointments, statuses, mechanics and extra charges.",
    icon: CalendarClock,
    tools: ["get_my_appointments"],
    samplePrompts: ["Do I have anything scheduled?"],
    defaultEnabled: true,
  },
  {
    id: "favorites",
    name: "Favorites",
    description:
      "Featured and subscription-exclusive products picked for your profile.",
    icon: Heart,
    tools: ["get_favorites"],
    samplePrompts: ["Any recommendations for me?"],
    defaultEnabled: false,
  },
  {
    id: "actions",
    name: "Actions (CRUD)",
    description:
      "Lets the assistant act: check free slots, book, reschedule or cancel appointments, register a bike and request an E-Pass card — always after your confirmation.",
    icon: Zap,
    tools: [
      "list_service_slots",
      "create_appointment",
      "reschedule_appointment",
      "cancel_appointment",
      "register_bike",
      "request_epass_card",
    ],
    samplePrompts: ["Book a maintenance for next Tuesday morning"],
    defaultEnabled: true,
  },
];

export interface AssistantConfig {
  name: string;
  icon: string;
  tone: "concise" | "friendly" | "technical";
  maxResponseSeconds: number;
  thinkingMs: number;
  enabledSkills: AssistantSkillId[];
}

export const ASSISTANT_ICONS = [
  "sparkles",
  "bike",
  "bot",
  "zap",
  "wrench",
  "compass",
] as const;

export const DEFAULT_ASSISTANT_CONFIG: AssistantConfig = {
  name: "E-IA",
  icon: "sparkles",
  tone: "concise",
  maxResponseSeconds: 30,
  thinkingMs: 600,
  enabledSkills: ASSISTANT_SKILLS.filter((s) => s.defaultEnabled).map((s) => s.id),
};

export const ASSISTANT_CONFIG_STORAGE_KEY = "wj.assistant.config.v1";