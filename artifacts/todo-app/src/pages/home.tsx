import { useState, useRef, FormEvent } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Plus, Circle, CheckCircle2, ListTodo, Search, X, Flag, Trash2 } from "lucide-react";
import {
  useListTodos,
  useCreateTodo,
  useUpdateTodo,
  useDeleteTodo,
  useGetTodoStats,
  getListTodosQueryKey,
  getGetTodoStatsQueryKey,
} from "@workspace/api-client-react";
import type { ListTodosStatus, Todo } from "@workspace/api-client-react";

const SWIPE_DELETE_THRESHOLD = -90;
const SWIPE_FLAG_THRESHOLD = 90;

function SwipeTodoRow({
  todo,
  onToggle,
  onDelete,
  onFlag,
  onNavigate,
}: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onFlag: () => void;
  onNavigate: () => void;
}) {
  const x = useMotionValue(0);
  const isDragging = useRef(false);

  const deleteOpacity = useTransform(x, [-120, SWIPE_DELETE_THRESHOLD, 0], [1, 1, 0]);
  const flagOpacity = useTransform(x, [0, SWIPE_FLAG_THRESHOLD, 120], [0, 1, 1]);
  const deleteScale = useTransform(x, [-120, SWIPE_DELETE_THRESHOLD], [1.1, 0.9]);
  const flagScale = useTransform(x, [SWIPE_FLAG_THRESHOLD, 120], [0.9, 1.1]);

  const isFlagged = todo.priority === "High";

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete backing (swipe left) */}
      <div className="absolute inset-0 bg-destructive rounded-xl flex items-center justify-end pr-5">
        <motion.div style={{ opacity: deleteOpacity, scale: deleteScale }}>
          <Trash2 className="h-6 w-6 text-white" />
        </motion.div>
      </div>

      {/* Flag backing (swipe right) */}
      <div className="absolute inset-0 bg-amber-500 rounded-xl flex items-center pl-5">
        <motion.div style={{ opacity: flagOpacity, scale: flagScale }}>
          <Flag
            className="h-6 w-6 text-white"
            fill={isFlagged ? "white" : "none"}
          />
        </motion.div>
      </div>

      {/* Card */}
      <motion.div
        style={{ x }}
        drag="x"
        dragElastic={0.15}
        dragConstraints={{ left: 0, right: 0 }}
        onDragStart={() => { isDragging.current = true; }}
        onDragEnd={(_, info) => {
          isDragging.current = false;
          if (info.offset.x < SWIPE_DELETE_THRESHOLD) {
            animate(x, -400, { duration: 0.25 });
            setTimeout(onDelete, 200);
          } else if (info.offset.x > SWIPE_FLAG_THRESHOLD) {
            animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
            onFlag();
          } else {
            animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
          }
        }}
        className={`relative z-10 group flex items-center gap-4 p-4 bg-card border rounded-xl shadow-sm cursor-grab active:cursor-grabbing transition-colors ${
          todo.completed ? "border-border/40" : "border-border"
        }`}
        data-testid={`todo-item-${todo.id}`}
      >
        {/* Toggle button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full transition-transform active:scale-90"
          data-testid={`button-toggle-${todo.id}`}
        >
          {todo.completed ? (
            <CheckCircle2 className="h-6 w-6 text-primary" />
          ) : (
            <Circle className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
          )}
        </button>

        {/* Title row — tappable to navigate */}
        <button
          type="button"
          onClick={() => { if (!isDragging.current) onNavigate(); }}
          className="flex-grow min-w-0 flex items-center gap-2 text-left"
        >
          <span
            className={`flex-grow truncate text-lg transition-all ${
              todo.completed ? "text-muted-foreground line-through" : "text-foreground"
            }`}
            data-testid={`text-title-${todo.id}`}
          >
            {todo.title}
          </span>
          {isFlagged && !todo.completed && (
            <Flag className="flex-shrink-0 h-3.5 w-3.5 text-red-500" fill="currentColor" />
          )}
          {todo.priority && todo.priority !== "High" && !todo.completed && (
            <span
              className={`flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                todo.priority === "Medium"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {todo.priority}
            </span>
          )}
        </button>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const [filter, setFilter] = useState<ListTodosStatus>("all");
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: todos, isLoading: isTodosLoading } = useListTodos(
    { status: filter },
    { query: { enabled: true, queryKey: getListTodosQueryKey({ status: filter }) } },
  );

  const { data: stats, isLoading: isStatsLoading } = useGetTodoStats({
    query: { enabled: true, queryKey: getGetTodoStatsQueryKey() },
  });

  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListTodosQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTodoStatsQueryKey() });
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim() || createTodo.isPending) return;
    createTodo.mutate(
      { data: { title: newTodoTitle.trim() } },
      {
        onSuccess: () => {
          setNewTodoTitle("");
          invalidateQueries();
        },
      },
    );
  };

  const handleToggle = (id: string, completed: boolean) => {
    updateTodo.mutate({ id, data: { completed: !completed } }, { onSuccess: invalidateQueries });
  };

  const handleDelete = (id: string) => {
    deleteTodo.mutate({ id }, { onSuccess: invalidateQueries });
  };

  const handleFlag = (todo: Todo) => {
    const next = todo.priority === "High" ? null : "High";
    updateTodo.mutate(
      { id: todo.id, data: { priority: next as "High" | null } },
      { onSuccess: invalidateQueries },
    );
  };

  const filteredTodos = (todos ?? []).filter((t) =>
    searchQuery.trim()
      ? t.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      : true,
  );

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 md:px-8 flex justify-center">
      <div className="w-full max-w-2xl space-y-8">

        {/* Header & Stats */}
        <header className="space-y-6">
          <h1 className="text-4xl sm:text-5xl font-serif text-primary" data-testid="heading-main">
            Taskboard
          </h1>

          <div className="grid grid-cols-3 gap-4 border-b border-border/60 pb-8">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-3xl font-serif" data-testid="stat-total">
                {isStatsLoading ? "-" : (stats?.total ?? 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active</p>
              <p className="text-3xl font-serif" data-testid="stat-active">
                {isStatsLoading ? "-" : (stats?.active ?? 0)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Done</p>
              <p className="text-3xl font-serif text-primary" data-testid="stat-completed">
                {isStatsLoading ? "-" : (stats?.completed ?? 0)}
              </p>
            </div>
          </div>
        </header>

        {/* Add task input */}
        <form onSubmit={handleCreate} className="flex gap-2" data-testid="form-create">
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="Write a new task..."
            className="flex-grow pl-4 pr-4 py-4 bg-card border border-border rounded-xl text-lg shadow-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
            data-testid="input-new-todo"
            disabled={createTodo.isPending}
          />
          <button
            type="submit"
            disabled={!newTodoTitle.trim() || createTodo.isPending}
            className="flex-shrink-0 flex items-center justify-center w-14 h-[60px] bg-primary text-primary-foreground rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="button-add-todo"
          >
            <Plus className="h-6 w-6" />
          </button>
        </form>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-10 pr-10 py-2.5 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
            data-testid="input-search"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2" data-testid="filters-group">
          {(["all", "active", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Swipe hint */}
        {filteredTodos.length > 0 && (
          <p className="text-xs text-muted-foreground/60 text-center -mt-4">
            ← swipe left to delete · swipe right to flag →
          </p>
        )}

        {/* List */}
        <div className="space-y-3 relative min-h-[200px]">
          {isTodosLoading ? (
            <div className="space-y-3 animate-pulse" data-testid="loading-state">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-card border border-border/50 rounded-xl" />
              ))}
            </div>
          ) : filteredTodos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 flex flex-col items-center justify-center text-center space-y-4"
              data-testid="empty-state"
            >
              <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground">
                <ListTodo className="h-8 w-8" />
              </div>
              <p className="text-muted-foreground font-medium text-lg">
                {searchQuery
                  ? `No tasks matching "${searchQuery}".`
                  : filter === "all"
                    ? "Your workspace is clear."
                    : `No ${filter} tasks.`}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredTodos.map((todo) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  key={todo.id}
                >
                  <SwipeTodoRow
                    todo={todo}
                    onToggle={() => handleToggle(todo.id, todo.completed)}
                    onDelete={() => handleDelete(todo.id)}
                    onFlag={() => handleFlag(todo)}
                    onNavigate={() => navigate(`/todos/${todo.id}`)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

      </div>
    </div>
  );
}
