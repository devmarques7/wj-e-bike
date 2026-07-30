import { Sparkles, Bike, Bot, Zap, Wrench, Compass, type LucideProps } from "lucide-react";

const MAP = { sparkles: Sparkles, bike: Bike, bot: Bot, zap: Zap, wrench: Wrench, compass: Compass };

export function AssistantIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = MAP[name as keyof typeof MAP] ?? Sparkles;
  return <Icon {...props} />;
}