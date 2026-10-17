"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Loader2, MessageSquare, Search, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { conversationsApi, timeAgo, type ConversationDetail } from "@/lib/vendor-api";

/**
 * Two-pane inbox shared by the vendor portal and the buyer /messages page.
 * The API decides which side of each thread the caller is on, so the same
 * component works for both. There is no socket yet: the open thread and the
 * list poll every few seconds, which is plenty for quote negotiation.
 */
const POLL_MS = 8_000;

const timeFormat = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" });

export function Inbox({ emptyHint }: { emptyHint: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", "list"],
    queryFn: () => conversationsApi.list("?limit=100"),
    refetchInterval: POLL_MS,
  });

  // Open the newest thread by default once the list arrives.
  useEffect(() => {
    if (!selected && conversations?.[0]) setSelected(conversations[0].id);
  }, [conversations, selected]);

  const { data: conversation } = useQuery({
    queryKey: ["conversations", "detail", selected],
    queryFn: () => conversationsApi.get(selected!),
    enabled: Boolean(selected),
    refetchInterval: POLL_MS,
  });

  // Opening a thread clears its unread count server-side; reflect that in the list.
  useEffect(() => {
    if (conversation) {
      void queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["conversations", "unread"] });
    }
    // Only when the thread id or its message count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, conversation?.messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.id, conversation?.messages.length]);

  const send = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => conversationsApi.send(id, body),
    onSuccess: (message, { id }) => {
      setDraft("");
      queryClient.setQueryData<ConversationDetail>(["conversations", "detail", id], (prev) =>
        prev ? { ...prev, messages: [...prev.messages, message] } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["conversations", "list"] });
    },
    onError: (err: Error) =>
      toast({ title: "Message not sent", description: err.message, variant: "destructive" }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => conversationsApi.archive(id),
    onSuccess: () => {
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast({ title: "Conversation archived", description: "A new reply will bring it back." });
    },
  });

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || !selected || send.isPending) return;
    send.mutate({ id: selected, body });
  }

  const filtered = (conversations ?? []).filter((c) => {
    const q = search.toLowerCase();
    return !q || c.counterpart.name.toLowerCase().includes(q) || c.subject.toLowerCase().includes(q);
  });
  const totalUnread = (conversations ?? []).reduce((s, c) => s + c.unread, 0);

  return (
    <>
      {/* Conversation List */}
      <div className="w-72 border-r border-white/[0.05] flex flex-col bg-[#04091a] shrink-0">
        <div className="p-4 border-b border-white/[0.05]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">Messages</h2>
            {totalUnread > 0 && (
              <span className="text-[9px] font-bold bg-blue-500 text-white rounded-full min-w-5 h-5 px-1 flex items-center justify-center">{totalUnread}</span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 h-8 bg-white/[0.03] border-white/[0.06] text-slate-200 placeholder:text-slate-600 text-[12px]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="text-[12px] text-slate-600 text-center px-6 py-10">
              {search ? "No conversations match." : emptyHint}
            </p>
          )}
          {filtered.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className={`w-full flex items-start gap-3 px-4 py-3.5 border-b border-white/[0.03] text-left transition-all ${selected === c.id ? "bg-blue-500/[0.08]" : "hover:bg-white/[0.03]"}`}>
              <div className="shrink-0">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/[0.08] flex items-center justify-center">
                  <span className="text-sm font-bold text-slate-400">{c.counterpart.name[0]?.toUpperCase()}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[12px] font-semibold truncate ${selected === c.id ? "text-white" : "text-slate-300"}`}>{c.counterpart.name}</span>
                  <span className="text-[9px] text-slate-600 shrink-0 ml-2">{timeAgo(c.lastMessageAt)}</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">{c.subject}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 truncate">
                    {c.lastMessage ? `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.body}` : ""}
                  </span>
                  {c.unread > 0 && (
                    <span className="text-[8px] font-bold bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center shrink-0 ml-2">{c.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!conversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <MessageSquare className="h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-600">{selected ? "Loading…" : "Select a conversation"}</p>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="h-16 flex items-center gap-3 px-6 border-b border-white/[0.05] bg-[#040a15]/90 backdrop-blur">
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-slate-400">{conversation.counterpart.name[0]?.toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">{conversation.counterpart.name}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {conversation.subject}
                  {conversation.counterpart.email && ` · ${conversation.counterpart.email}`}
                </div>
              </div>
              <button
                onClick={() => archive.mutate(conversation.id)}
                disabled={archive.isPending}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.04]"
                title="Archive conversation"
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {conversation.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.fromMe
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-white/[0.05] border border-white/[0.07] text-slate-200 rounded-tl-sm"
                  }`}>
                    {msg.body}
                    <div className={`text-[9px] mt-1 ${msg.fromMe ? "text-blue-200" : "text-slate-600"}`}>
                      {timeFormat.format(new Date(msg.createdAt))}
                      {msg.fromMe && msg.readAt && " · Read"}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={submit} className="px-6 py-4 border-t border-white/[0.05]">
              <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 py-2.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  maxLength={5000}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
                />
                <button type="submit" disabled={!draft.trim() || send.isPending}
                  aria-label="Send"
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${draft.trim() ? "bg-blue-600 hover:bg-blue-500" : "bg-white/[0.04]"}`}>
                  {send.isPending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                    : <Send className={`h-3.5 w-3.5 ${draft.trim() ? "text-white" : "text-slate-600"}`} />}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </>
  );
}
