"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "./actions";

type Message = {
  id: string;
  sender: "member" | "business";
  body: string;
  created_at: string;
};

export default function MessageThread({
  userId,
  initialMessages,
}: {
  userId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [state, formAction, pending] = useActionState(sendMessage, null);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${userId}` },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as Message],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm shadow-neutral-900/5">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500">No messages yet. Say hello!</p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === "member" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                message.sender === "member"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-900"
              }`}
            >
              {message.body}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form ref={formRef} action={formAction} className="flex gap-2 border-t border-neutral-200 p-3">
        <input name="body" placeholder="Write a message..." required className="field-input flex-1" />
        <button type="submit" disabled={pending} className="btn-primary">
          Send
        </button>
      </form>
      {state?.error && <p className="px-3 pb-3 text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
