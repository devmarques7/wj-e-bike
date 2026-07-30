import { GeminiChat } from "@/components/chat/GeminiChat";

const Chat = () => (
  <main className="min-h-screen bg-background px-4 py-24">
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-display-sm font-light text-foreground mb-2">WJ Assistant</h1>
      <p className="text-muted-foreground mb-8">
        Ask anything about your e-bike, services, accessories or membership plans.
      </p>
      <GeminiChat className="h-[70vh]" />
    </div>
  </main>
);

export default Chat;