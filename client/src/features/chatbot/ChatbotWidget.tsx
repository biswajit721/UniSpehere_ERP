import { MessageCircle, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../../services/api";

interface Msg {
  role: "user" | "bot";
  text: string;
}

export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "bot", text: "Hi! Ask me about your attendance, fees, exams, or how to use UniSphere ERP." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setSending(true);
    try {
      const { data } = await api.post("/chatbot/ask", { message: text });
      setMessages((m) => [...m, { role: "bot", text: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setSending(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="chat-launcher fixed right-5 z-40 rounded-full bg-primary p-4 text-white shadow-lg hover:bg-primary-dark bottom-[calc(1.25rem+var(--sticky-bar,0px))] transition-[bottom]"
        aria-label="Open assistant"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed right-5 z-[45] w-[min(22rem,calc(100vw-2.5rem))] card shadow-pop flex flex-col max-h-[70dvh] bottom-[calc(1.25rem+var(--sticky-bar,0px))]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border dark:border-border-dark">
        <span className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">UniSphere Assistant</span>
        <button onClick={() => setOpen(false)} aria-label="Close assistant">
          <X className="h-4 w-4 text-text-secondary" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
              m.role === "user"
                ? "ml-auto bg-primary text-white"
                : "bg-surface dark:bg-surface-dark text-text-primary dark:text-text-dark-primary"
            }`}
          >
            {m.text}
          </div>
        ))}
        {sending && <p className="text-xs text-text-secondary">Thinking...</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 p-3 border-t border-border dark:border-border-dark">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask something..."
          className="input-field flex-1"
        />
        <button onClick={send} disabled={sending} className="btn-primary px-3" aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
