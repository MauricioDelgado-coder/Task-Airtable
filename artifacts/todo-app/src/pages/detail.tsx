import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetTodo,
  useUpdateTodo,
  useDeleteTodo,
  getGetTodoQueryKey,
  getListTodosQueryKey,
  getGetTodoStatsQueryKey,
} from "@workspace/api-client-react";
import type { Todo } from "@workspace/api-client-react";
import {
  ArrowLeft,
  Flag,
  Calendar,
  Tag,
  FileText,
  Radio,
  Trash2,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";

interface Props {
  id: string;
}

const PRIORITY_OPTIONS = ["High", "Medium", "Low"] as const;
const SOURCE_OPTIONS = ["Manual", "Outlook", "Teams", "iMessage", "Other"] as const;

type Priority = (typeof PRIORITY_OPTIONS)[number] | null;

function PriorityBadge({ priority }: { priority: Priority }) {
  if (!priority) return null;
  const colors: Record<string, string> = {
    High: "bg-red-100 text-red-700 border-red-200",
    Medium: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${colors[priority]}`}>
      {priority}
    </span>
  );
}

export default function Detail({ id }: Props) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: todo, isLoading, isError } = useGetTodo(id, {
    query: { queryKey: getGetTodoQueryKey(id) },
  });

  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const [form, setForm] = useState<Partial<Todo>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (todo) {
      setForm({
        title: todo.title,
        completed: todo.completed,
        priority: todo.priority,
        dueDate: todo.dueDate,
        source: todo.source,
        notes: todo.notes,
        tags: todo.tags,
      });
      setIsDirty(false);
    }
  }, [todo]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev: Partial<Todo>) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetTodoQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListTodosQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTodoStatsQueryKey() });
  };

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await updateTodo.mutateAsync({
        id,
        data: {
          title: form.title,
          completed: form.completed,
          priority: form.priority as "High" | "Medium" | "Low" | null | undefined,
          dueDate: form.dueDate,
          source: form.source,
          notes: form.notes,
          tags: form.tags,
        },
      });
      invalidateAll();
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!confirm("Delete this task?")) return;
    deleteTodo.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTodosQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTodoStatsQueryKey() });
          navigate("/");
        },
      },
    );
  };

  const handleToggleComplete = () => {
    const next = !form.completed;
    set("completed", next);
    updateTodo.mutate(
      { id, data: { completed: next } },
      { onSuccess: invalidateAll },
    );
  };

  const handleFlagToggle = () => {
    const isHigh = form.priority === "High";
    const next = isHigh ? null : "High";
    set("priority", next as Priority);
    updateTodo.mutate(
      { id, data: { priority: next as "High" | "Medium" | "Low" | null } },
      { onSuccess: invalidateAll },
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !todo) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Task not found.</p>
        <button onClick={() => navigate("/")} className="text-primary hover:underline text-sm">
          ← Back to list
        </button>
      </div>
    );
  }

  const isFlagged = form.priority === "High";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-primary hover:opacity-70 transition-opacity font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFlagToggle}
            className={`p-2 rounded-lg transition-colors ${
              isFlagged
                ? "text-red-500 bg-red-50 hover:bg-red-100"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
            title={isFlagged ? "Unflag" : "Flag as high priority"}
          >
            <Flag className="h-5 w-5" fill={isFlagged ? "currentColor" : "none"} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteTodo.isPending}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        {/* Title + complete toggle */}
        <div className="flex items-start gap-3">
          <button
            onClick={handleToggleComplete}
            className="mt-1 flex-shrink-0 focus:outline-none transition-transform active:scale-90"
          >
            {form.completed ? (
              <CheckCircle2 className="h-6 w-6 text-primary" />
            ) : (
              <Circle className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
            )}
          </button>
          <textarea
            value={form.title ?? ""}
            onChange={(e) => set("title", e.target.value)}
            onBlur={handleSave}
            rows={1}
            className={`flex-grow resize-none text-2xl font-serif bg-transparent border-none outline-none leading-tight placeholder:text-muted-foreground/50 focus:ring-0 transition-colors ${
              form.completed ? "line-through text-muted-foreground" : "text-foreground"
            }`}
            placeholder="Task title"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
        </div>

        {/* Status + Priority row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</span>
            <button
              onClick={handleToggleComplete}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                form.completed
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {form.completed ? "Done" : "Open"}
            </button>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</span>
            <div className="flex gap-1">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    set("priority", form.priority === p ? null : (p as Priority));
                    setIsDirty(true);
                  }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    form.priority === p
                      ? p === "High"
                        ? "bg-red-100 text-red-700 border-red-300"
                        : p === "Medium"
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-border/60" />

        {/* Fields */}
        <div className="space-y-5">
          {/* Due Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Due Date
            </label>
            <input
              type="date"
              value={
                form.dueDate
                  ? (() => {
                      const [m, d, y] = (form.dueDate as string).split("/");
                      return `${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`;
                    })()
                  : ""
              }
              onChange={(e) => {
                if (!e.target.value) {
                  set("dueDate", null);
                  return;
                }
                const [y, m, d] = e.target.value.split("-");
                set("dueDate", `${m}/${d}/${y}`);
              }}
              onBlur={handleSave}
              className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            />
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Radio className="h-4 w-4" />
              Source
            </label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    set("source", form.source === s ? null : s);
                  }}
                  onMouseUp={() => setTimeout(handleSave, 50)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    form.source === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Tag className="h-4 w-4" />
              Tags
              <span className="text-xs font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={form.tags ?? ""}
              onChange={(e) => set("tags", e.target.value || null)}
              onBlur={handleSave}
              placeholder="work, urgent, follow-up"
              className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-muted-foreground/50"
            />
            {form.tags && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {form.tags
                  .split(",")
                  .map((t: string) => t.trim())
                  .filter(Boolean)
                  .map((tag: string) => (
                    <span
                      key={tag}
                      className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full border border-border"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileText className="h-4 w-4" />
              Notes
            </label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value || null)}
              onBlur={handleSave}
              rows={5}
              placeholder="Add context, links, or details…"
              className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Attachment Summary (read-only) */}
          {todo.attachmentSummary && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Attachment Summary
                <span className="ml-1.5 text-xs font-normal opacity-60">(AI-generated)</span>
              </label>
              <div className="px-3 py-2.5 bg-secondary/40 border border-border rounded-lg text-sm text-muted-foreground leading-relaxed">
                {todo.attachmentSummary}
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-border/60" />

        {/* Metadata */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Record ID: <span className="font-mono">{todo.id}</span></p>
          <p>Created: {new Date(todo.createdAt).toLocaleString()}</p>
        </div>

        {/* Save footer */}
        {isDirty && (
          <div className="sticky bottom-4 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm shadow-lg hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
