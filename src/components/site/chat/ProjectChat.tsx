"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  Camera,
  Check,
  ChevronLeft,
  ClipboardList,
  MessagesSquare,
  Mic,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Reply,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/store/auth";
import { api, ApiError, resolveAssetUrl, type MessageOut } from "@/lib/api";
import { toast } from "sonner";
import { useMessageSocket } from "@/hooks/useMessageSocket";

// ─── Messaging helpers ────────────────────────────────────────────────────
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EMOJI_PALETTE = [
  "😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰",
  "😘", "😎", "🤔", "😐", "😢", "😭", "😡", "😱", "🥳", "😴",
  "👍", "👎", "👏", "🙏", "💪", "🤝", "👋", "✌️", "🤞", "❤️",
  "🔥", "🎉", "✅", "⚠️", "💯", "⭐", "🏗️", "🔨", "🏠", "💰",
];

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp)$/i.test(url);
}

function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

// ─── Emoji picker popover, used for both composing and reacting ────────────
function EmojiPopover({ onPick, onClose, emojis = EMOJI_PALETTE, align = "left" }: {
  onPick: (emoji: string) => void;
  onClose: () => void;
  emojis?: string[];
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute bottom-full mb-2 ${align === "left" ? "left-0" : "right-0"} z-20 w-64 rounded-xl border bg-background shadow-lg p-2 grid grid-cols-8 gap-1`}
    >
      {emojis.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => {
            onPick(e);
            onClose();
          }}
          className="h-7 w-7 flex items-center justify-center text-lg rounded hover:bg-muted/60"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

// ─── Voice note player bubble ────────────────────────────────────────────
function VoicePlayer({ url, duration, mine }: { url: string; duration?: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [total, setTotal] = useState(duration || 0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onLoadedMetadata={(e) => {
          const d = (e.target as HTMLAudioElement).duration;
          if (isFinite(d) && d > 0) setTotal(d);
        }}
        onTimeUpdate={(e) => {
          const audio = e.target as HTMLAudioElement;
          if (audio.duration) setProgress(audio.currentTime / audio.duration);
        }}
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          mine ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className={`h-1.5 rounded-full overflow-hidden ${mine ? "bg-primary-foreground/25" : "bg-foreground/15"}`}>
          <div
            className={`h-full rounded-full ${mine ? "bg-primary-foreground" : "bg-primary"}`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      </div>
      <span className={`text-[10px] tabular-nums shrink-0 ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {formatDuration(total)}
      </span>
    </div>
  );
}

// ─── Quoted reply preview, shown inside a bubble or the composer ──────────
function ReplyQuote({ reply, onClick }: { reply: { sender_name?: string | null; body: string; message_type: string; is_deleted?: boolean }; onClick?: () => void }) {
  const label = reply.is_deleted
    ? "This message was deleted"
    : reply.message_type === "voice"
    ? "🎤 Voice note"
    : reply.message_type === "image"
    ? "📷 Photo"
    : reply.body || "Message";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="block w-full text-left border-l-2 border-primary/60 bg-black/5 dark:bg-white/10 rounded-md px-2 py-1 mb-1"
    >
      <p className="text-[11px] font-medium text-primary/90">{reply.sender_name || "Message"}</p>
      <p className="text-xs opacity-80 truncate">{label}</p>
    </button>
  );
}

/**
 * The full-featured project conversation: replies, emoji reactions,
 * edit/delete, image and file attachments, voice notes, typing indicators,
 * date separators, and read receipts. Single shared implementation used by
 * both the Messages app (thread list + this) and the project workspace, so
 * the two surfaces can never drift apart again.
 */
export function ProjectChat({
  projectId,
  otherUserId,
  otherUserName,
  onClose,
  subtitle,
  onActivity,
  className = "",
  projectHref,
  messagesHref,
  onBack,
}: {
  projectId: string;
  otherUserId: string;
  otherUserName: string;
  onClose?: () => void;
  subtitle?: string | null;
  /** When set (Messages app), renders a back button in the header so a
      mobile user can return to the conversation list. */
  onBack?: () => void;
  /** Called when the thread's read/unread state changes (e.g. new message),
      so a surrounding thread list can refresh its unread counts. */
  onActivity?: () => void;
  className?: string;
  /** When set (Messages app), the project title in the header links back to
      the project workspace so a conversation keeps its project context. */
  projectHref?: string;
  /** When set (project workspace), a header action jumps into the full
      Messages app, deep-linking to this same thread. */
  messagesHref?: string;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageOut[]>([]);
  const [body, setBody] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageOut | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [showComposerEmoji, setShowComposerEmoji] = useState(false);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // When true, the composer posts a tagged "Project Update" instead of a
  // plain chat message — same input box, no separate popup.
  const [composingUpdate, setComposingUpdate] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const loadMessages = () => {
    api.projectMessages(projectId, otherUserId).then(setMessages).catch(() => {});
  };

  useEffect(() => {
    loadMessages();
    api.markThreadRead(projectId, otherUserId).then(onActivity).catch(() => {});
    // Long-interval fallback in case the WebSocket connection can't be established.
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, otherUserId]);

  const { sendTyping } = useMessageSocket(projectId, (e) => {
    if (!("id" in e)) {
      // Typing indicator ping from the other participant.
      if (e.user_id !== otherUserId) return;
      setOtherTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
      return;
    }
    const m = e;
    if (m.sender_id !== otherUserId && m.recipient_id !== otherUserId) return;
    setMessages((prev) => (prev.some((existing) => existing.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m]));
    if (m.sender_id === otherUserId) {
      setOtherTyping(false);
      api.markThreadRead(projectId, otherUserId).then(onActivity).catch(() => {});
    }
  });

  // Auto-scroll only when already near the bottom, so reading history isn't
  // yanked down by incoming messages; a floating button covers the rest.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 160);
  };

  const scrollToLatest = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    setReplyTo(null);
    setOtherTyping(false);
    setShowScrollBtn(false);
  }, [projectId, otherUserId]);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const send = async () => {
    if (!body.trim()) return;
    const text = body;
    const replyId = replyTo?.id;
    setBody("");
    setReplyTo(null);
    try {
      await api.sendProjectMessage(projectId, {
        recipient_id: otherUserId,
        body: text,
        reply_to_id: replyId,
      });
      loadMessages();
      onActivity?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send message");
      setBody(text);
    }
  };

  const postUpdate = async () => {
    if (!body.trim()) return;
    const text = body;
    setBody("");
    setComposingUpdate(false);
    try {
      await api.postProjectUpdate(projectId, text.trim());
      loadMessages();
      onActivity?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not post update");
      setBody(text);
      setComposingUpdate(true);
    }
  };

  const sendAttachment = async (file: File) => {
    setAttaching(true);
    try {
      const uploaded = await api.uploadFile(file);
      await api.sendProjectMessage(projectId, {
        recipient_id: otherUserId,
        body: "",
        attachment_url: uploaded.url,
        message_type: isImageUrl(uploaded.url) ? "image" : "file",
      });
      loadMessages();
      onActivity?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send attachment");
    } finally {
      setAttaching(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sendVoiceNote = async (blob: Blob, seconds: number) => {
    setAttaching(true);
    try {
      const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
      const uploaded = await api.uploadFile(file);
      await api.sendProjectMessage(projectId, {
        recipient_id: otherUserId,
        body: "",
        attachment_url: uploaded.url,
        message_type: "voice",
        duration_seconds: Math.round(seconds),
      });
      loadMessages();
      onActivity?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not send voice note");
    } finally {
      setAttaching(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Couldn't access your microphone. Check your browser permissions.");
    }
  };

  const stopRecording = (send_: boolean) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    const seconds = recordSeconds;
    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (send_ && recordedChunksRef.current.length > 0) {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (seconds >= 1) sendVoiceNote(blob, seconds);
      }
    };
    recorder.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
  };

  const react = async (messageId: string, emoji: string) => {
    setReactingTo(null);
    try {
      const updated = await api.reactToMessage(messageId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not react to message");
    }
  };

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-primary/10");
    setTimeout(() => el.classList.remove("bg-primary/10"), 1200);
  };

  const startEditing = (m: MessageOut) => {
    setEditingId(m.id);
    setEditText(m.body);
    setOpenMenuFor(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    const id = editingId;
    try {
      const updated = await api.editMessage(id, editText.trim());
      setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
      cancelEditing();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not edit message");
    }
  };

  const deleteMessage = async (messageId: string) => {
    setOpenMenuFor(null);
    try {
      const updated = await api.deleteMessage(messageId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete message");
    }
  };

  // Group messages with a date separator whenever the calendar day changes.
  const rows: Array<{ type: "date"; label: string } | { type: "message"; message: MessageOut }> = [];
  let lastDay = "";
  for (const m of messages) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) {
      rows.push({ type: "date", label: formatDayLabel(m.created_at) });
      lastDay = day;
    }
    rows.push({ type: "message", message: m });
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border bg-background ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/30 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 -ml-1 text-muted-foreground hover:text-foreground md:hidden"
            aria-label="Back to conversations"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
          {otherUserName.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{otherUserName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {otherTyping ? (
              <span className="text-primary">typing…</span>
            ) : projectHref && subtitle ? (
              <Link href={projectHref} className="hover:underline hover:text-foreground" title="Open this project">
                {subtitle}
              </Link>
            ) : (
              subtitle || " "
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {messagesHref && (
            <Link
              href={messagesHref}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              title="Continue this conversation in the Messages app"
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open in Messages</span>
            </Link>
          )}
          {onClose && (
            <button onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
      <div ref={scrollRef} onScroll={onMessagesScroll} className="absolute inset-0 overflow-y-auto p-3 space-y-1 bg-muted/10">
        {rows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No messages yet, say hello.</p>
        )}
        {rows.map((row, i) => {
          if (row.type === "date") {
            return (
              <div key={`date-${i}`} className="flex justify-center py-2">
                <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-3 py-1">{row.label}</span>
              </div>
            );
          }
          const m = row.message;
          const mine = m.sender_id === user?.id;
          const menuOpen = openMenuFor === m.id;
          const editing = editingId === m.id;

          // System log entries (milestone funded/approved/released, change
          // orders, etc.) — a running record of what happened, not a chat
          // bubble from either party. No reply/react/edit affordances.
          if (m.message_type === "system") {
            return (
              <div key={m.id} className="flex justify-center py-1">
                <span className="text-[11px] text-muted-foreground bg-muted/70 rounded-full px-3 py-1 text-center max-w-[85%]">
                  {m.body}
                </span>
              </div>
            );
          }

          if (m.is_deleted) {
            return (
              <div
                key={m.id}
                ref={(el) => {
                  messageRefs.current[m.id] = el;
                }}
                className={`flex ${mine ? "justify-end" : "justify-start"} transition-colors rounded-lg`}
              >
                <div className="max-w-[75%] rounded-lg px-3 py-1.5 text-sm italic text-muted-foreground border border-dashed bg-background/60">
                  {mine ? "You deleted this message" : "This message was deleted"}
                </div>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              ref={(el) => {
                messageRefs.current[m.id] = el;
              }}
              className={`group relative flex items-end gap-1 ${mine ? "justify-end" : "justify-start"} transition-colors rounded-lg`}
            >
              <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                {editing ? (
                  <div className={`rounded-lg px-3 py-2 text-sm space-y-2 ${mine ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === "Escape") cancelEditing();
                      }}
                      rows={2}
                      autoFocus
                      className={`w-full resize-none rounded-md px-2 py-1 text-sm outline-none ${
                        mine ? "bg-primary-foreground/10 placeholder:text-primary-foreground/60" : "bg-muted"
                      }`}
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={cancelEditing} className="text-xs underline opacity-80 hover:opacity-100">
                        Cancel
                      </button>
                      <button type="button" onClick={saveEdit} className="text-xs font-medium underline">
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`rounded-lg px-3 py-1.5 text-sm space-y-1 ${mine ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                    {m.reply_to && (
                      <ReplyQuote reply={m.reply_to} onClick={() => scrollToMessage(m.reply_to!.id)} />
                    )}
                    {m.message_type === "update" && (
                      <p className={`text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1 ${mine ? "text-primary-foreground/80" : "text-primary"}`}>
                        <ClipboardList className="h-3 w-3" /> Project Update
                      </p>
                    )}
                    {m.message_type === "voice" && m.attachment_url && (
                      <VoicePlayer url={resolveAssetUrl(m.attachment_url) || m.attachment_url} duration={m.duration_seconds} mine={mine} />
                    )}
                    {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                    {m.message_type !== "voice" && m.attachment_url && (
                      isImageUrl(m.attachment_url) ? (
                        <a href={resolveAssetUrl(m.attachment_url)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={resolveAssetUrl(m.attachment_url)} alt="Attachment" className="rounded-md max-h-48 max-w-full object-cover" />
                        </a>
                      ) : (
                        <a
                          href={resolveAssetUrl(m.attachment_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className={`flex items-center gap-1 text-xs underline ${mine ? "text-primary-foreground" : "text-primary"}`}
                        >
                          View attachment
                        </a>
                      )
                    )}
                    <p className={`text-[10px] text-right flex items-center justify-end gap-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {m.edited_at && <span className="italic">Edited</span>}
                      {mine && m.is_read && (
                        <span className="inline-flex items-center gap-0.5 font-medium">
                          <Check className="h-2.5 w-2.5" /> Read
                        </span>
                      )}
                      {formatClockTime(m.created_at)}
                    </p>
                  </div>
                )}

                {m.reactions.length > 0 && (
                  <div className={`flex gap-1 mt-0.5 ${mine ? "flex-row-reverse" : ""}`}>
                    {m.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => react(m.id, r.emoji)}
                        title={r.user_names.join(", ")}
                        className={`text-[11px] rounded-full border px-1.5 py-0.5 bg-background ${r.mine ? "border-primary" : ""}`}
                      >
                        {r.emoji} {r.count > 1 ? r.count : ""}
                      </button>
                    ))}
                  </div>
                )}

                {menuOpen && !editing && (
                  <div className={`relative mt-1 flex items-center gap-1 flex-wrap ${mine ? "self-end justify-end" : "self-start"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(m);
                        setOpenMenuFor(null);
                      }}
                      className="h-7 px-2 rounded-full border bg-background text-xs flex items-center gap-1 hover:bg-muted/60"
                    >
                      <Reply className="h-3 w-3" /> Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setReactingTo(reactingTo === m.id ? null : m.id)}
                      className="h-7 px-2 rounded-full border bg-background text-xs flex items-center gap-1 hover:bg-muted/60"
                    >
                      <Smile className="h-3 w-3" /> React
                    </button>
                    {mine && m.message_type === "text" && (
                      <button
                        type="button"
                        onClick={() => startEditing(m)}
                        className="h-7 px-2 rounded-full border bg-background text-xs flex items-center gap-1 hover:bg-muted/60"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                    {mine && (
                      <button
                        type="button"
                        onClick={() => deleteMessage(m.id)}
                        className="h-7 px-2 rounded-full border bg-background text-xs flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    )}
                    {reactingTo === m.id && (
                      <div className="absolute top-full mt-1 left-0 z-20 flex gap-1 rounded-full border bg-background shadow-lg p-1">
                        {QUICK_REACTIONS.map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => react(m.id, e)}
                            className="h-7 w-7 flex items-center justify-center text-base rounded-full hover:bg-muted/60"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!editing && (
                <button
                  type="button"
                  onClick={() => setOpenMenuFor(menuOpen ? null : m.id)}
                  className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-opacity ${
                    menuOpen ? "opacity-100 bg-muted/60" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  }`}
                  aria-label="Message actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div className="h-1" />
      </div>
      {showScrollBtn && (
        <button
          type="button"
          onClick={scrollToLatest}
          className="absolute bottom-3 right-3 z-10 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:opacity-90"
          aria-label="Scroll to latest messages"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
      </div>

      {/* Reply-to bar */}
      {replyTo && (
        <div className="flex items-center gap-2 px-3 pt-2 border-t bg-muted/30">
          <div className="flex-1">
            <ReplyQuote reply={replyTo} />
          </div>
          <button type="button" onClick={() => setReplyTo(null)} className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Composer */}
      {composingUpdate && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t bg-primary/5 text-xs">
          <ClipboardList className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-primary font-medium">Posting a Project Update</span>
          <span className="text-muted-foreground hidden sm:inline">— visible in this thread, emailed if they're offline</span>
          <button type="button" onClick={() => setComposingUpdate(false)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 p-2 border-t relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) sendAttachment(file);
          }}
        />

        {recording ? (
          <div className="flex-1 flex items-center gap-2 bg-red-50 dark:bg-red-950/30 rounded-md px-3 h-9">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-600 tabular-nums">{formatDuration(recordSeconds)}</span>
            <span className="text-xs text-muted-foreground">Recording voice note…</span>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => stopRecording(false)} className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/60" title="Cancel">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => stopRecording(true)} className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center" title="Send">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={attaching}
              className="shrink-0 h-9 w-9 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50"
              title="Attach a file"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setComposingUpdate((s) => !s)}
              className={`shrink-0 h-9 w-9 rounded-md border flex items-center justify-center hover:bg-muted/50 ${
                composingUpdate ? "text-primary border-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Post a project update"
            >
              <ClipboardList className="h-4 w-4" />
            </button>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowComposerEmoji((s) => !s)}
                className="h-9 w-9 rounded-md border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50"
                title="Emoji"
              >
                <Smile className="h-4 w-4" />
              </button>
              {showComposerEmoji && (
                <EmojiPopover onPick={(e) => setBody((b) => b + e)} onClose={() => setShowComposerEmoji(false)} />
              )}
            </div>
            <Input
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                if (!composingUpdate) sendTyping();
              }}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (composingUpdate ? postUpdate() : send())}
              placeholder={composingUpdate ? "Write a project update..." : "Type a message..."}
              className="h-9"
            />
            {composingUpdate ? (
              <Button size="sm" onClick={postUpdate} disabled={!body.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            ) : body.trim() ? (
              <Button size="sm" onClick={send} disabled={!body.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={attaching}
                className="shrink-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                title="Record a voice note"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
