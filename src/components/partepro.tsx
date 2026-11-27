"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity as ActivityIcon,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  actionSchema,
  applyAction,
  calculateQuote,
  DomainError,
  money,
  workspaceSchema,
  type Action,
  type Actor,
  type Job,
  type Quote,
  type Selection,
  type ServiceRequest,
  type Workspace,
} from "@/lib/domain";
import { createDemoWorkspace, DEMO_STORAGE_KEY } from "@/lib/demo";
import AccessScreen from "@/components/access-screen";
import QuotePdfDownload from "@/components/quote-pdf-download";

type View = "overview" | "requests" | "quotes" | "calendar" | "reports";
type DialogState =
  | { type: "request-new" | "login" | "reset" | "help" }
  | {
      type:
        | "request-detail"
        | "request-edit"
        | "quote-new"
        | "quote-detail"
        | "schedule"
        | "job-detail"
        | "complete";
      id: string;
    };
type Notice = { text: string; tone: "success" | "error" | "info" };
type RemoteWorkspace = {
  workspace: unknown;
  organizationName?: string;
  role?: Actor["role"];
  technicianId?: string | null;
  user?: { email?: string };
};
const nav = [
  { id: "overview" as View, label: "Resumen", icon: LayoutDashboard },
  { id: "requests" as View, label: "Solicitudes", icon: ClipboardList },
  { id: "quotes" as View, label: "Presupuestos", icon: FileText },
  { id: "calendar" as View, label: "Agenda", icon: CalendarDays },
  { id: "reports" as View, label: "Partes de trabajo", icon: ClipboardCheck },
];
const requestStatuses = {
  new: "Por revisar",
  quoted: "Presupuestada",
  accepted: "En curso",
  completed: "Finalizada",
};
const jobStatuses = {
  pending: "Sin planificar",
  scheduled: "Planificada",
  completed: "Finalizada",
};
const priorityLabels = { low: "Baja", normal: "Normal", urgent: "Urgente" };
const dateLabel = (date: string | Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(
    "es-ES",
    options ?? { day: "numeric", month: "short" },
  ).format(new Date(date));
const timeLabel = (date: string) =>
  dateLabel(date, { hour: "2-digit", minute: "2-digit" });
const localDay = (date: string | Date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const localInput = (date: Date) =>
  `${localDay(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const textFrom = (form: FormData, key: string) => String(form.get(key) ?? "");
const countLabel = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect width="34" height="34" rx="2" fill="#1b3bff" />
        <path
          d="M9 25V9h11a6 6 0 0 1 0 12h-5v4zm6-10h5a1 1 0 0 0 0-2h-5z"
          fill="#ffffff"
        />
      </svg>
      {!compact && (
        <span>
          parte<span className="brand-light">pro</span>
          <span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = {
    ...requestStatuses,
    ...jobStatuses,
    draft: "Pendiente de aceptar",
    accepted: "Aceptado",
  };
  return (
    <span className={`status status-${status}`}>
      <span aria-hidden="true" />
      {labels[status] ?? status}
    </span>
  );
}

function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ClipboardCheck size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function Modal({
  title,
  eyebrow,
  children,
  close,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    node?.showModal();
    return () => {
      node?.close();
      if (previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [title]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Cerrar diálogo"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof value === "object" &&
      value !== null &&
      "error" in value &&
      typeof value.error === "string"
        ? value.error
        : "No se ha podido completar la operación. Inténtalo de nuevo.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  return value as T;
}

export default function PartePro({
  supabaseConfigured,
  calendarConfigured,
}: {
  supabaseConfigured: boolean;
  calendarConfigured: boolean;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [accessScreen, setAccessScreen] = useState<
    "checking" | "login" | "workspace"
  >("checking");
  const [accessMessage, setAccessMessage] = useState("");
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const [sessionCheckAttempt, setSessionCheckAttempt] = useState(0);
  const [view, setView] = useState<View>("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"demo" | "connected">("demo");
  const [actor, setActor] = useState<Actor>({ role: "technician" });
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("Tu organización");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const latest = useRef<Workspace | null>(null);
  const notify = (text: string, tone: Notice["tone"] = "success") =>
    setNotice({ text, tone });
  const installRemote = useCallback((result: RemoteWorkspace) => {
    const parsed = workspaceSchema.parse(result.workspace);
    latest.current = parsed;
    setWorkspace(parsed);
    setMode("connected");
    setActor({
      role: result.role ?? "technician",
      technicianId: result.technicianId,
    });
    setEmail(result.user?.email ?? "Cuenta conectada");
    setOrganizationName(
      typeof result.organizationName === "string" &&
        result.organizationName.trim()
        ? result.organizationName.trim()
        : "Tu organización",
    );
    setAccessScreen("workspace");
    setSessionCheckFailed(false);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setAccessScreen("checking");
    setFormError("");
    setSessionCheckFailed(false);
    setSelectedDay(localDay(new Date()));
    if (!supabaseConfigured) {
      setAccessScreen("login");
      return;
    }
    api<RemoteWorkspace>("/api/workspace")
      .then((result) => {
        if (!cancelled) installRemote(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAccessScreen("login");
        if (
          !(error instanceof Error && "status" in error && error.status === 401)
        ) {
          setSessionCheckFailed(true);
          setFormError(
            "No se ha podido comprobar tu sesión. Puedes volver a intentarlo o iniciar sesión con tu cuenta.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, installRemote, sessionCheckAttempt]);
  useEffect(() => {
    if (!notice || notice.tone === "error") return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const navigate = (next: View) => {
    setView(next);
    setFilter("all");
    setSearch("");
    setMobileOpen(false);
  };
  const open = (next: DialogState) => {
    setFormError("");
    setDialog(next);
  };
  const close = () => {
    if (!busy) {
      setDialog(null);
      setFormError("");
    }
  };
  const exploreDemo = () => {
    if (busy) return;
    let state = createDemoWorkspace();
    try {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (raw && raw.length < 2000000) {
        const parsed = workspaceSchema.safeParse(JSON.parse(raw));
        if (parsed.success) state = parsed.data;
      }
    } catch {
      /* A blocked or stale local demo never prevents explicit exploration. */
    }
    latest.current = state;
    setWorkspace(state);
    setMode("demo");
    setActor({ role: "dispatcher" });
    setEmail("");
    setOrganizationName("Tu organización");
    setFormError("");
    setAccessMessage("");
    setNotice(null);
    setDialog(null);
    navigate("overview");
    setAccessScreen("workspace");
  };
  const commit = async (input: Action, success: string, after?: () => void) => {
    if (busy || !latest.current) return;
    setBusy(true);
    setFormError("");
    try {
      const action = actionSchema.parse(input);
      let state: Workspace;
      if (mode === "connected") {
        const result = await api<{ workspace: unknown }>(
          "/api/workspace",
          action,
        );
        state = workspaceSchema.parse(result.workspace);
      } else {
        state = applyAction(latest.current, action, actor);
        try {
          sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
        } catch {
          notify(
            "Los cambios solo estarán disponibles mientras mantengas esta página abierta.",
            "info",
          );
        }
      }
      latest.current = state;
      setWorkspace(state);
      setDialog(null);
      notify(success);
      after?.();
    } catch (error) {
      setFormError(
        error instanceof DomainError || error instanceof Error
          ? error.message
          : "No se ha podido guardar. Inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !supabaseConfigured) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setFormError("");
    setAccessMessage("");
    try {
      await api("/api/auth", {
        action: "login",
        email: textFrom(form, "email"),
        password: textFrom(form, "password"),
      });
      installRemote(await api<RemoteWorkspace>("/api/workspace"));
      setDialog(null);
      notify("Cuenta conectada. Estás trabajando con tu organización.");
    } catch (error) {
      const rateLimited =
        error instanceof Error && "status" in error && error.status === 429;
      setFormError(
        rateLimited
          ? "Has realizado demasiados intentos. Espera unos minutos antes de volver a intentarlo."
          : "No se ha podido iniciar sesión. Revisa tus datos e inténtalo de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    try {
      await api("/api/auth", { action: "logout" });
      latest.current = null;
      setWorkspace(null);
      setMode("demo");
      setActor({ role: "technician" });
      setEmail("");
      setOrganizationName("Tu organización");
      setDialog(null);
      setNotice(null);
      setFormError("");
      setSessionCheckFailed(false);
      setAccessMessage("Has cerrado la sesión.");
      navigate("overview");
      setAccessScreen("login");
    } catch {
      notify("No se ha podido cerrar la sesión. Vuelve a intentarlo.", "error");
    } finally {
      setBusy(false);
    }
  };
  const exportCalendar = (job: Job) => {
    if (!workspace || !job.startAt) return;
    const request = workspace.requests.find((r) => r.id === job.requestId),
      customer = workspace.customers.find((c) => c.id === request?.customerId);
    const esc = (text: string) =>
      text
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const stamp = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const content = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//PartePro//Agenda//ES",
      "BEGIN:VEVENT",
      `UID:${job.id}@partepro.demo`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(new Date(job.startAt))}`,
      `DTEND:${stamp(new Date(new Date(job.startAt).getTime() + job.durationMinutes * 60000))}`,
      `SUMMARY:${esc(request?.title ?? job.code)}`,
      `LOCATION:${esc(customer?.address ?? "")}`,
      `DESCRIPTION:${esc(`${job.code} · ${customer?.name ?? ""}`)}`,
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/calendar;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${job.code}.ics`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Archivo de calendario descargado. Puedes importarlo en tu agenda.");
  };
  const syncCalendar = async (job: Job) => {
    setBusy(true);
    try {
      await api("/api/calendar", { jobId: job.id });
      notify("Intervención sincronizada con el calendario de la organización.");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se ha podido sincronizar.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (accessScreen === "login") {
    return (
      <AccessScreen
        brand={<Logo />}
        configured={supabaseConfigured}
        busy={busy}
        error={formError}
        message={accessMessage}
        canRetrySession={sessionCheckFailed}
        onSubmit={login}
        onExplore={exploreDemo}
        onRetrySession={() => setSessionCheckAttempt((attempt) => attempt + 1)}
      />
    );
  }
  if (accessScreen === "checking" || !workspace)
    return (
      <div className="app-loading">
        <Logo />
        <div className="loading-bar" />
        <p role="status">Comprobando tu sesión…</p>
      </div>
    );
  const isManager = actor.role !== "technician";
  const getRequest = (id: string) =>
    workspace.requests.find((r) => r.id === id);
  const customerOf = (request?: ServiceRequest) =>
    workspace.customers.find((c) => c.id === request?.customerId);
  const matches = (request?: ServiceRequest, code = "") =>
    !search ||
    `${request?.title} ${request?.code} ${customerOf(request)?.name} ${code}`
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es"));
  const activeJobs = workspace.jobs.filter((j) => j.status !== "completed");
  const newRequests = workspace.requests.filter((r) => r.status === "new");
  const pendingQuotes = workspace.quotes.filter((q) => q.status === "draft");
  const acceptedTotal = workspace.quotes
    .filter((q) => q.status === "accepted")
    .reduce((n, q) => n + q.totalCents, 0);
  const completedJobs = workspace.jobs.filter((j) => j.status === "completed");
  const dayJobs = workspace.jobs
    .filter((j) => j.startAt && localDay(j.startAt) === selectedDay)
    .sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));
  const currentName = nav.find((item) => item.id === view)?.label;
  const descriptions: Record<View, string> = {
    overview: "Una vista clara de tu equipo y de lo que viene hoy.",
    requests: "Cada necesidad del cliente, en el lugar adecuado.",
    quotes: "Del primer diagnóstico a un presupuesto aceptado.",
    calendar: "El trabajo de tu equipo, bien planificado.",
    reports: "Todo lo realizado, con cada detalle registrado.",
  };

  const requestTable = (items: ServiceRequest[]) =>
    items.length ? (
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Solicitud / cliente</th>
              <th>Prioridad</th>
              <th>Estado</th>
              <th>Recibida</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((request) => (
              <tr key={request.id}>
                <td>
                  <button
                    className="table-link"
                    onClick={() =>
                      open({ type: "request-detail", id: request.id })
                    }
                  >
                    {request.title}
                  </button>
                  <span className="subline">
                    {request.code}
                    <span>·</span>
                    {customerOf(request)?.name}
                  </span>
                </td>
                <td>
                  <span className={`priority priority-${request.priority}`}>
                    <span aria-hidden="true" />
                    {priorityLabels[request.priority]}
                  </span>
                </td>
                <td>
                  <Status status={request.status} />
                </td>
                <td className="muted nowrap">{dateLabel(request.createdAt)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Ver ${request.code}`}
                    onClick={() =>
                      open({ type: "request-detail", id: request.id })
                    }
                  >
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="Todo está al día"
        description="No hay solicitudes con estos filtros."
      />
    );
  const jobCard = (job: Job, compact = false) => {
    const request = getRequest(job.requestId),
      customer = customerOf(request),
      tech = workspace.technicians.find((t) => t.id === job.technicianId);
    return (
      <button
        key={job.id}
        className={`job-card ${compact ? "compact" : ""} job-${tech?.color ?? "teal"}`}
        onClick={() => open({ type: "job-detail", id: job.id })}
      >
        <div className="job-time">
          <Clock3 size={14} />
          {job.startAt ? timeLabel(job.startAt) : "Por planificar"}
          {!compact && <span>{job.durationMinutes} min</span>}
        </div>
        <h3>{request?.title}</h3>
        <p>{customer?.name}</p>
        <div className="job-card-bottom">
          <span className={`avatar avatar-${tech?.color ?? "teal"}`}>
            {tech?.initials ?? "—"}
          </span>
          <span>{tech?.name ?? "Sin asignar"}</span>
          {job.status === "completed" && <CheckCircle2 size={16} />}
        </div>
      </button>
    );
  };

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="nav-backdrop"
          aria-label="Cerrar navegación"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}
        aria-label="Navegación principal"
      >
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-monogram">
            {mode === "demo"
              ? "N"
              : Array.from(organizationName)[0]?.toUpperCase()}
          </span>
          <span>
            <strong
              title={mode === "demo" ? "Nexo Mantenimiento" : organizationName}
            >
              {mode === "demo" ? "Nexo Mantenimiento" : organizationName}
            </strong>
            <small>
              {mode === "demo" ? "Espacio de demostración" : "Tu organización"}
            </small>
          </span>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">ESPACIO DE TRABAJO</p>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.id === "requests" && newRequests.length > 0 && (
                <span className="nav-count">{newRequests.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sidebar-note-icon">
              <Wrench size={19} />
            </span>
            <strong>
              Menos gestión.
              <br />
              Más trabajo bien hecho.
            </strong>
            <p>
              Del aviso al último detalle,
              <br />
              todo conectado.
            </p>
            <div className="mini-line" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <button
            className="nav-item help-button"
            onClick={() => open({ type: "help" })}
          >
            <CircleHelp size={19} />
            <span>Cómo funciona</span>
          </button>
          <div className="sidebar-footer">
            <span className="online-dot" />
            PartePro · v1.0<span>ES</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-only"
              aria-label="Abrir menú"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span className="desktop-only">Espacio de trabajo</span>
            <ChevronRight size={14} className="desktop-only" />
            <strong>{currentName}</strong>
          </div>
          <div className="topbar-right">
            <div className="search-field">
              <Search size={17} />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (view === "overview") setView("requests");
                }}
                placeholder="Buscar en tu espacio…"
                aria-label="Buscar en tu espacio"
              />
              <kbd>⌘ K</kbd>
            </div>
            <div className="topbar-divider" />
            <button
              className="account-button"
              aria-label={
                mode === "demo"
                  ? "Invitado · Demo. Conectar mi cuenta"
                  : `${email}. Cerrar sesión`
              }
              onClick={() =>
                mode === "demo" ? open({ type: "login" }) : void logout()
              }
              disabled={busy}
              title={mode === "demo" ? "Conectar mi cuenta" : "Cerrar sesión"}
            >
              <span className="avatar avatar-user">
                {mode === "demo" ? "ID" : email.slice(0, 2).toUpperCase()}
              </span>
              <span className="account-label">
                <strong>{mode === "demo" ? "Invitado · Demo" : email}</strong>
                <small>
                  {mode === "demo" ? "Datos ficticios" : "Cuenta conectada"}
                </small>
              </span>
              {mode === "connected" ? (
                <LogOut size={16} />
              ) : (
                <ChevronDown size={15} />
              )}
            </button>
          </div>
        </header>
        <div
          className={`demo-banner ${mode === "connected" ? "connected-banner" : ""}`}
        >
          <span>
            {mode === "demo" ? (
              <Sparkles size={15} />
            ) : (
              <ShieldCheck size={15} />
            )}
            <strong>
              {mode === "demo" ? "Modo demo" : "Cuenta conectada"}
            </strong>
            <span className="banner-detail">
              {mode === "demo"
                ? "Datos ficticios · cambios guardados solo en esta pestaña"
                : "Datos protegidos de tu organización"}
            </span>
          </span>
          {mode === "demo" ? (
            <button onClick={() => open({ type: "reset" })}>
              Reiniciar demo
            </button>
          ) : (
            <span className="banner-detail">
              {actor.role === "technician" ? "Técnico" : "Coordinación"}
            </span>
          )}
        </div>
        <main id="main-content">
          <div className="page-heading">
            <div>
              {view === "overview" && (
                <p className="eyebrow greeting">TU OPERATIVA, DE UN VISTAZO</p>
              )}
              <h1>
                {view === "overview" ? "Todo bajo control." : currentName}
                {view === "overview" && <span className="heading-dot" />}
              </h1>
              <p>{descriptions[view]}</p>
            </div>
            <div className="heading-actions">
              {view === "overview" && (
                <span className="date-pill">
                  <CalendarDays size={16} />
                  {dateLabel(new Date(), { day: "numeric", month: "long" })}
                </span>
              )}
              {isManager && (
                <button
                  className="button button-primary"
                  onClick={() => open({ type: "request-new" })}
                >
                  <Plus size={18} />
                  Nueva solicitud
                </button>
              )}
            </div>
          </div>
          {view === "overview" && (
            <>
              <div className="metrics-grid">
                <Metric
                  label="Intervenciones abiertas"
                  value={String(activeJobs.length).padStart(2, "0")}
                  note={`${countLabel(activeJobs.filter((j) => j.status === "pending").length, "pendiente", "pendientes")} de planificar`}
                  icon={<Wrench size={18} />}
                  accent="teal"
                />
                <Metric
                  label="Presupuestos pendientes"
                  value={String(pendingQuotes.length).padStart(2, "0")}
                  note={`${money(pendingQuotes.reduce((n, q) => n + q.totalCents, 0))} por confirmar`}
                  icon={<FileText size={18} />}
                  accent="violet"
                />
                <Metric
                  label="Importe aceptado"
                  value={money(acceptedTotal)}
                  note="Total de presupuestos aceptados"
                  icon={<CheckCheck size={18} />}
                  accent="lime"
                />
                <Metric
                  label="Partes finalizados"
                  value={String(completedJobs.length).padStart(2, "0")}
                  note="Trabajo realizado y documentado"
                  icon={<ClipboardCheck size={18} />}
                  accent="amber"
                />
              </div>
              <div className="overview-grid">
                <section className="panel today-panel">
                  <div className="panel-head">
                    <div>
                      <span className="section-icon">
                        <CalendarDays size={18} />
                      </span>
                      <h2>La agenda de hoy</h2>
                      <span className="count-badge">
                        {
                          workspace.jobs.filter(
                            (j) =>
                              j.startAt &&
                              localDay(j.startAt) === localDay(new Date()),
                          ).length
                        }
                      </span>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("calendar")}
                    >
                      Ver agenda <ChevronRight size={15} />
                    </button>
                  </div>
                  <div className="today-body">
                    {workspace.jobs
                      .filter(
                        (j) =>
                          j.startAt &&
                          localDay(j.startAt) === localDay(new Date()),
                      )
                      .sort((a, b) =>
                        (a.startAt ?? "").localeCompare(b.startAt ?? ""),
                      )
                      .map((job) => (
                        <div className="timeline-row" key={job.id}>
                          <div className="timeline-hour">
                            {job.startAt ? timeLabel(job.startAt) : ""}
                            <span>
                              {job.startAt
                                ? timeLabel(
                                    new Date(
                                      new Date(job.startAt).getTime() +
                                        job.durationMinutes * 60000,
                                    ).toISOString(),
                                  )
                                : ""}
                            </span>
                          </div>
                          <div className="timeline-track">
                            <i />
                          </div>
                          {jobCard(job, true)}
                        </div>
                      ))}
                    {!workspace.jobs.some(
                      (j) =>
                        j.startAt &&
                        localDay(j.startAt) === localDay(new Date()),
                    ) && (
                      <Empty
                        title="Un día con espacio"
                        description="Planifica una intervención para empezar."
                      />
                    )}
                    <div className="agenda-footer">
                      <span className="avatar-stack">
                        {workspace.technicians.map((t) => (
                          <span
                            key={t.id}
                            className={`avatar avatar-${t.color}`}
                          >
                            {t.initials}
                          </span>
                        ))}
                      </span>
                      <span>
                        <strong>{workspace.technicians.length} técnicos</strong>{" "}
                        en el equipo
                      </span>
                      <span className="small-separator" />
                      <span>Planificación compartida</span>
                    </div>
                  </div>
                </section>
                <section className="panel attention-panel">
                  <div className="panel-head">
                    <div>
                      <span className="attention-icon">
                        <ActivityIcon size={18} />
                      </span>
                      <h2>Necesita tu atención</h2>
                    </div>
                    <span className="count-badge">
                      {newRequests.length + pendingQuotes.length}
                    </span>
                  </div>
                  <div className="attention-body">
                    {newRequests.slice(0, 2).map((request) => (
                      <button
                        className="attention-item"
                        key={request.id}
                        onClick={() =>
                          open({ type: "request-detail", id: request.id })
                        }
                      >
                        <div className="attention-item-top">
                          <span
                            className={`priority priority-${request.priority}`}
                          >
                            <span />
                            {priorityLabels[request.priority]}
                          </span>
                          <small>{request.code}</small>
                        </div>
                        <h3>{request.title}</h3>
                        <p>{customerOf(request)?.name}</p>
                        <span className="attention-action">
                          Revisar solicitud <ChevronRight size={15} />
                        </span>
                      </button>
                    ))}
                    {pendingQuotes.length > 0 && (
                      <button
                        className="quote-reminder"
                        onClick={() => {
                          navigate("quotes");
                          setFilter("draft");
                        }}
                      >
                        <span className="reminder-icon">
                          <FileText size={19} />
                        </span>
                        <span>
                          <strong>
                            {pendingQuotes.length} presupuesto pendiente
                          </strong>
                          <small>Listo para revisar y aceptar</small>
                        </span>
                        <ChevronRight size={17} />
                      </button>
                    )}
                    {!newRequests.length && !pendingQuotes.length && (
                      <Empty
                        title="Nada pendiente"
                        description="Tu equipo está al día."
                      />
                    )}
                  </div>
                </section>
              </div>
              <div className="bottom-grid">
                <section className="panel recent-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Últimas solicitudes</h2>
                      <span className="count-badge">
                        {workspace.requests.length}
                      </span>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("requests")}
                    >
                      Ver todas <ChevronRight size={15} />
                    </button>
                  </div>
                  {requestTable(workspace.requests.slice(0, 4))}
                </section>
                <section className="panel activity-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Actividad reciente</h2>
                    </div>
                    <ActivityIcon size={17} className="muted" />
                  </div>
                  <div className="activity-list">
                    {workspace.activities.slice(0, 4).map((activity) => (
                      <div key={activity.id} className="activity-item">
                        <span
                          className={`activity-symbol activity-${activity.kind}`}
                        >
                          {activity.kind === "request" ? (
                            <Plus size={14} />
                          ) : activity.kind === "quote" ? (
                            <FileText size={14} />
                          ) : (
                            <Check size={14} />
                          )}
                        </span>
                        <div>
                          <p>{activity.text}</p>
                          <small>
                            {dateLabel(activity.createdAt)} ·{" "}
                            {timeLabel(activity.createdAt)}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "requests" && (
            <section className="panel">
              <div className="list-toolbar">
                <div className="tabs" aria-label="Filtrar solicitudes">
                  {[
                    ["all", "Todas"],
                    ["new", "Por revisar"],
                    ["quoted", "Presupuestadas"],
                    ["accepted", "En curso"],
                    ["completed", "Finalizadas"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={filter === value ? "selected" : ""}
                      aria-pressed={filter === value}
                    >
                      {label}
                      {value === "new" && <span>{newRequests.length}</span>}
                    </button>
                  ))}
                </div>
                <span className="result-count">
                  {
                    workspace.requests.filter(
                      (r) =>
                        (filter === "all" || r.status === filter) && matches(r),
                    ).length
                  }{" "}
                  solicitudes
                </span>
              </div>
              {requestTable(
                workspace.requests.filter(
                  (r) =>
                    (filter === "all" || r.status === filter) && matches(r),
                ),
              )}
            </section>
          )}
          {view === "quotes" && (
            <>
              <div className="summary-strip">
                <span>
                  <i className="summary-swatch violet" />
                  {countLabel(
                    pendingQuotes.length,
                    "pendiente",
                    "pendientes",
                  )}{" "}
                  de aceptar
                </span>
                <strong>
                  {money(pendingQuotes.reduce((n, q) => n + q.totalCents, 0))}
                  <small>importe pendiente</small>
                </strong>
                <span className="strip-divider" />
                <span>
                  <i className="summary-swatch teal" />
                  {
                    workspace.quotes.filter((q) => q.status === "accepted")
                      .length
                  }{" "}
                  aceptados
                </span>
                <strong>
                  {money(acceptedTotal)}
                  <small>importe aceptado</small>
                </strong>
              </div>
              <section className="panel">
                <div className="list-toolbar">
                  <div className="tabs" aria-label="Filtrar presupuestos">
                    {[
                      ["all", "Todos"],
                      ["draft", "Pendientes"],
                      ["accepted", "Aceptados"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={filter === value ? "selected" : ""}
                        aria-pressed={filter === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="result-count">Precios con IVA incluido</span>
                </div>
                <div className="quote-list">
                  {workspace.quotes
                    .filter(
                      (q) =>
                        (filter === "all" || q.status === filter) &&
                        matches(getRequest(q.requestId), q.code),
                    )
                    .map((quote) => {
                      const request = getRequest(quote.requestId);
                      return (
                        <button
                          className="quote-row"
                          key={quote.id}
                          onClick={() =>
                            open({ type: "quote-detail", id: quote.id })
                          }
                        >
                          <span
                            className={`document-icon ${quote.status === "accepted" ? "document-accepted" : ""}`}
                          >
                            <FileText size={23} />
                          </span>
                          <div className="quote-row-title">
                            <span className="eyebrow">{quote.code}</span>
                            <h3>{request?.title}</h3>
                            <p>{customerOf(request)?.name}</p>
                          </div>
                          <Status status={quote.status} />
                          <div className="quote-amount">
                            <strong>{money(quote.totalCents)}</strong>
                            <small>{dateLabel(quote.createdAt)}</small>
                          </div>
                          <ChevronRight size={18} />
                        </button>
                      );
                    })}
                  {!workspace.quotes.some(
                    (q) =>
                      (filter === "all" || q.status === filter) &&
                      matches(getRequest(q.requestId), q.code),
                  ) && (
                    <Empty
                      title="Sin presupuestos aquí"
                      description="Abre una solicitud para preparar su presupuesto."
                    />
                  )}
                </div>
              </section>
            </>
          )}
          {view === "calendar" && (
            <>
              <div className="calendar-toolbar">
                <div className="calendar-nav">
                  <button
                    className="button button-secondary"
                    onClick={() => setSelectedDay(localDay(new Date()))}
                  >
                    Hoy
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Día anterior"
                    onClick={() => {
                      const date = new Date(`${selectedDay}T12:00`);
                      date.setDate(date.getDate() - 1);
                      setSelectedDay(localDay(date));
                    }}
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Día siguiente"
                    onClick={() => {
                      const date = new Date(`${selectedDay}T12:00`);
                      date.setDate(date.getDate() + 1);
                      setSelectedDay(localDay(date));
                    }}
                  >
                    <ChevronRight size={19} />
                  </button>
                  <h2>
                    {selectedDay &&
                      dateLabel(`${selectedDay}T12:00`, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                  </h2>
                </div>
                <label className="date-control">
                  <span className="sr-only">Fecha de agenda</span>
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDay(e.target.value);
                    }}
                  />
                </label>
              </div>
              <div className="calendar-grid">
                {workspace.technicians.map((tech) => (
                  <section className="technician-column" key={tech.id}>
                    <div className="technician-head">
                      <span className={`avatar avatar-${tech.color}`}>
                        {tech.initials}
                      </span>
                      <div>
                        <h3>{tech.name}</h3>
                        <small>
                          {countLabel(
                            dayJobs.filter((j) => j.technicianId === tech.id)
                              .length,
                            "intervención",
                            "intervenciones",
                          )}
                        </small>
                      </div>
                      <span className="technician-badge">
                        <Wrench size={14} />
                      </span>
                    </div>
                    <div className="technician-body">
                      {dayJobs
                        .filter(
                          (j) =>
                            j.technicianId === tech.id &&
                            matches(getRequest(j.requestId), j.code),
                        )
                        .map((job) => jobCard(job))}
                      {!dayJobs.some((j) => j.technicianId === tech.id) && (
                        <div className="available">
                          <CalendarPlus size={24} />
                          <strong>Agenda disponible</strong>
                          <span>Espacio para un nuevo trabajo</span>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              <section className="panel pending-panel">
                <div className="panel-head">
                  <div>
                    <h2>Pendientes de planificar</h2>
                    <span className="count-badge">
                      {
                        workspace.jobs.filter((j) => j.status === "pending")
                          .length
                      }
                    </span>
                  </div>
                  <span className="muted small">
                    Presupuestos aceptados, listos para asignar
                  </span>
                </div>
                {workspace.jobs
                  .filter((j) => j.status === "pending")
                  .map((job) => (
                    <div className="pending-row" key={job.id}>
                      <span className="pending-icon">
                        <Clock3 size={19} />
                      </span>
                      <div>
                        <h3>{getRequest(job.requestId)?.title}</h3>
                        <p>
                          {customerOf(getRequest(job.requestId))?.name} ·{" "}
                          {job.code}
                        </p>
                      </div>
                      {isManager && (
                        <button
                          className="button button-secondary"
                          onClick={() => open({ type: "schedule", id: job.id })}
                        >
                          <CalendarPlus size={16} />
                          Planificar
                        </button>
                      )}
                    </div>
                  ))}
                {!workspace.jobs.some((j) => j.status === "pending") && (
                  <div className="inline-empty">
                    <CheckCircle2 size={18} />
                    Todas las intervenciones están planificadas.
                  </div>
                )}
              </section>
            </>
          )}
          {view === "reports" && (
            <section className="panel">
              <div className="list-toolbar">
                <div className="tabs" aria-label="Filtrar partes">
                  {[
                    ["all", "Todos"],
                    ["pending", "Sin planificar"],
                    ["scheduled", "En agenda"],
                    ["completed", "Finalizados"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilter(value)}
                      className={filter === value ? "selected" : ""}
                      aria-pressed={filter === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="result-count">
                  {workspace.jobs.length} partes
                </span>
              </div>
              <div className="reports-grid">
                {workspace.jobs
                  .filter(
                    (j) =>
                      (filter === "all" || j.status === filter) &&
                      matches(getRequest(j.requestId), j.code),
                  )
                  .map((job) => {
                    const request = getRequest(job.requestId),
                      tech = workspace.technicians.find(
                        (t) => t.id === job.technicianId,
                      );
                    return (
                      <button
                        className="report-card"
                        key={job.id}
                        onClick={() => open({ type: "job-detail", id: job.id })}
                      >
                        <div className="report-top">
                          <span className="eyebrow">{job.code}</span>
                          <Status status={job.status} />
                        </div>
                        <h3>{request?.title}</h3>
                        <p>{customerOf(request)?.name}</p>
                        <div className="report-meta">
                          <span>
                            <CalendarDays size={15} />
                            {job.startAt
                              ? dateLabel(job.startAt)
                              : "Fecha pendiente"}
                          </span>
                          <span>
                            <Clock3 size={15} />
                            {job.durationMinutes} min
                          </span>
                        </div>
                        <div className="report-bottom">
                          <span
                            className={`avatar avatar-${tech?.color ?? "teal"}`}
                          >
                            {tech?.initials ?? "—"}
                          </span>
                          <span>{tech?.name ?? "Sin asignar"}</span>
                          <ChevronRight size={17} />
                        </div>
                      </button>
                    );
                  })}
              </div>
              {!workspace.jobs.some(
                (j) =>
                  (filter === "all" || j.status === filter) &&
                  matches(getRequest(j.requestId), j.code),
              ) && (
                <Empty
                  title="No hay partes con estos filtros"
                  description="Los presupuestos aceptados crean una intervención automáticamente."
                />
              )}
            </section>
          )}
          <footer className="main-footer">
            <span>Diseñado para equipos que hacen que todo funcione.</span>
            <span>
              <ShieldCheck size={13} />
              {mode === "demo"
                ? "Demostración con datos ficticios"
                : "Sesión autenticada"}
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div
          className={`toast toast-${notice.tone}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 size={20} />
          ) : (
            <CircleHelp size={20} />
          )}
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="Cerrar notificación"
            onClick={() => setNotice(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog && (
        <DialogContent
          dialog={dialog}
          workspace={workspace}
          actor={actor}
          busy={busy}
          error={formError}
          close={close}
          open={open}
          commit={commit}
          mode={mode}
          configured={supabaseConfigured}
          calendarConfigured={calendarConfigured}
          login={login}
          exportCalendar={exportCalendar}
          syncCalendar={syncCalendar}
          reset={() => {
            const state = createDemoWorkspace();
            latest.current = state;
            setWorkspace(state);
            try {
              sessionStorage.removeItem(DEMO_STORAGE_KEY);
            } catch {
              /* optional local storage */
            }
            setDialog(null);
            navigate("overview");
            notify("Demo reiniciada. Todo listo para empezar.");
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  icon,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  icon: ReactNode;
  accent: string;
}) {
  return (
    <article className={`metric metric-${accent}`}>
      <div className="metric-label">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-foot">
        <span>{note}</span>
        <span className="metric-decoration" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
    </article>
  );
}

type DialogProps = {
  dialog: DialogState;
  workspace: Workspace;
  actor: Actor;
  busy: boolean;
  error: string;
  close: () => void;
  open: (dialog: DialogState) => void;
  commit: (
    action: Action,
    success: string,
    after?: () => void,
  ) => Promise<void>;
  mode: "demo" | "connected";
  configured: boolean;
  calendarConfigured: boolean;
  login: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  exportCalendar: (job: Job) => void;
  syncCalendar: (job: Job) => Promise<void>;
  reset: () => void;
};

function DialogContent(props: DialogProps) {
  const { dialog, workspace, actor, busy, error, close, open, commit } = props;
  const isManager = actor.role !== "technician";
  const request =
    "id" in dialog
      ? workspace.requests.find((r) => r.id === dialog.id)
      : undefined;
  const quote =
    "id" in dialog
      ? workspace.quotes.find((q) => q.id === dialog.id)
      : undefined;
  const job =
    "id" in dialog ? workspace.jobs.find((j) => j.id === dialog.id) : undefined;
  const errorNode = error && (
    <div className="form-error" role="alert">
      {error}
    </div>
  );
  const cancel = (
    <button
      type="button"
      className="button button-secondary"
      disabled={busy}
      onClick={close}
    >
      Cancelar
    </button>
  );
  const submit = (label: string) => (
    <button type="submit" className="button button-primary" disabled={busy}>
      {busy ? "Guardando…" : label}
    </button>
  );
  if (dialog.type === "request-new" || dialog.type === "request-edit")
    return (
      <Modal
        title={
          dialog.type === "request-new" ? "Nueva solicitud" : "Editar solicitud"
        }
        eyebrow="EL PRIMER PASO PARA RESOLVERLO"
        close={close}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const fields = {
              title: textFrom(form, "title"),
              description: textFrom(form, "description"),
              priority: textFrom(
                form,
                "priority",
              ) as ServiceRequest["priority"],
            };
            void commit(
              dialog.type === "request-new"
                ? {
                    type: "request.create",
                    customerId: textFrom(form, "customerId"),
                    ...fields,
                  }
                : { type: "request.update", requestId: request!.id, ...fields },
              "Solicitud guardada correctamente.",
            );
          }}
        >
          <div className="form-body">
            <label>
              Cliente
              <select
                name="customerId"
                required
                defaultValue={request?.customerId ?? ""}
                disabled={dialog.type === "request-edit"}
              >
                <option value="" disabled>
                  Selecciona un cliente
                </option>
                {workspace.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ¿Qué necesita el cliente?
              <input
                name="title"
                required
                maxLength={120}
                placeholder="Ej. Revisión del equipo de climatización"
                defaultValue={request?.title}
              />
            </label>
            <label>
              Descripción
              <textarea
                name="description"
                required
                maxLength={2000}
                rows={4}
                placeholder="Describe la incidencia, el equipo y los detalles que necesita conocer el técnico."
                defaultValue={request?.description}
              />
            </label>
            <label>
              Prioridad
              <select
                name="priority"
                defaultValue={request?.priority ?? "normal"}
              >
                <option value="low">Baja · puede esperar</option>
                <option value="normal">Normal · próxima disponibilidad</option>
                <option value="urgent">Urgente · requiere atención</option>
              </select>
            </label>
            <p className="form-hint">
              <ShieldCheck size={15} />
              {props.mode === "demo"
                ? "Esta solicitud solo se guardará en tu demo local."
                : "Solo las personas autorizadas de tu organización podrán acceder."}
            </p>
            {errorNode}
          </div>
          <div className="modal-actions">
            {cancel}
            {submit("Guardar solicitud")}
          </div>
        </form>
      </Modal>
    );
  if (dialog.type === "request-detail" && request) {
    const customer = workspace.customers.find(
        (c) => c.id === request.customerId,
      ),
      relatedQuote = workspace.quotes.find((q) => q.requestId === request.id),
      relatedJob = workspace.jobs.find((j) => j.requestId === request.id);
    return (
      <Modal title={request.title} eyebrow={request.code} close={close}>
        <div className="detail-body">
          <div className="detail-tags">
            <Status status={request.status} />
            <span className={`priority priority-${request.priority}`}>
              <span />
              {priorityLabels[request.priority]}
            </span>
          </div>
          <Progress status={request.status} />
          <div className="client-box">
            <span className="client-avatar">
              {customer?.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{customer?.name}</strong>
              <p>
                {customer?.contact} · {customer?.phone}
              </p>
              <small>
                <MapPin size={13} />
                {customer?.address}
              </small>
            </div>
          </div>
          <div className="detail-section">
            <h3>Lo que necesita el cliente</h3>
            <p className="preserve-lines">{request.description}</p>
          </div>
          <div className="detail-meta">
            <span>
              Recibida el{" "}
              {dateLabel(request.createdAt, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span>{request.code}</span>
          </div>
          {errorNode}
        </div>
        <div className="modal-actions">
          {request.status === "new" && isManager && (
            <button
              className="button button-secondary"
              onClick={() => open({ type: "request-edit", id: request.id })}
            >
              Editar solicitud
            </button>
          )}
          {request.status === "new" && isManager && (
            <button
              className="button button-primary"
              onClick={() => open({ type: "quote-new", id: request.id })}
            >
              <FileText size={17} />
              Preparar presupuesto
            </button>
          )}
          {relatedQuote && (
            <button
              className="button button-secondary"
              onClick={() =>
                open({ type: "quote-detail", id: relatedQuote.id })
              }
            >
              Ver presupuesto
            </button>
          )}
          {relatedJob && (
            <button
              className="button button-primary"
              onClick={() => open({ type: "job-detail", id: relatedJob.id })}
            >
              Ver parte de trabajo
            </button>
          )}
        </div>
      </Modal>
    );
  }
  if (dialog.type === "quote-new" && request)
    return (
      <QuoteBuilder
        request={request}
        workspace={workspace}
        close={close}
        commit={commit}
        busy={busy}
        error={error}
      />
    );
  if (dialog.type === "quote-detail" && quote) {
    const req = workspace.requests.find((r) => r.id === quote.requestId),
      customer = workspace.customers.find((c) => c.id === req?.customerId),
      relatedJob = workspace.jobs.find((j) => j.quoteId === quote.id);
    return (
      <Modal title="Presupuesto de servicio" eyebrow={quote.code} close={close}>
        <div className="detail-body">
          <div className="quote-document-head">
            <Logo />
            <Status status={quote.status} />
          </div>
          <div className="quote-client">
            <span className="eyebrow">PREPARADO PARA</span>
            <h3>{customer?.name}</h3>
            <p>{req?.title}</p>
          </div>
          <QuoteLines quote={quote} />
          <p className="form-hint">
            Documento de presupuesto. No constituye una factura.
          </p>
          {errorNode}
        </div>
        <div className="modal-actions">
          <QuotePdfDownload
            workspace={workspace}
            quoteId={quote.id}
            mode={props.mode}
          />
          {relatedJob && (
            <button
              className="button button-secondary"
              onClick={() => open({ type: "job-detail", id: relatedJob.id })}
            >
              Ver intervención
            </button>
          )}
          {quote.status === "draft" && isManager && (
            <button
              className="button button-primary"
              disabled={busy}
              onClick={() =>
                void commit(
                  { type: "quote.accept", quoteId: quote.id },
                  "Presupuesto aceptado. Ya puedes planificar la intervención.",
                )
              }
            >
              <Check size={17} />
              {busy ? "Aceptando…" : "Registrar aceptación"}
            </button>
          )}
        </div>
      </Modal>
    );
  }
  if (dialog.type === "schedule" && job) {
    const defaultDate = new Date(Date.now() + 86400000);
    defaultDate.setHours(9, 0, 0, 0);
    return (
      <Modal title="Planificar intervención" eyebrow={job.code} close={close}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const date = new Date(textFrom(form, "startAt"));
            if (Number.isNaN(date.getTime())) return;
            void commit(
              {
                type: "job.schedule",
                jobId: job.id,
                technicianId: textFrom(form, "technicianId"),
                startAt: date.toISOString(),
                durationMinutes: Number(form.get("durationMinutes")),
              },
              "Intervención planificada. Tu agenda está actualizada.",
            );
          }}
        >
          <div className="form-body">
            <div className="context-box">
              <Wrench size={19} />
              <span>
                {workspace.requests.find((r) => r.id === job.requestId)?.title}
              </span>
            </div>
            <label>
              Técnico responsable
              <select
                name="technicianId"
                required
                defaultValue={job.technicianId ?? ""}
              >
                <option value="" disabled>
                  Selecciona un técnico
                </option>
                {workspace.technicians.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha y hora
              <input
                name="startAt"
                type="datetime-local"
                required
                defaultValue={localInput(
                  job.startAt ? new Date(job.startAt) : defaultDate,
                )}
              />
            </label>
            <label>
              Duración estimada
              <select name="durationMinutes" defaultValue={job.durationMinutes}>
                {[30, 60, 90, 120, 180, 240, 480].map((n) => (
                  <option value={n} key={n}>
                    {n < 60 ? `${n} minutos` : `${n / 60} horas`}
                  </option>
                ))}
              </select>
            </label>
            <p className="form-hint">
              <CalendarDays size={15} />
              Comprobaremos que el técnico no tenga otra visita en ese horario.
            </p>
            {errorNode}
          </div>
          <div className="modal-actions">
            {cancel}
            {submit("Guardar planificación")}
          </div>
        </form>
      </Modal>
    );
  }
  if (dialog.type === "complete" && job)
    return (
      <CompleteForm
        job={job}
        workspace={workspace}
        close={close}
        commit={commit}
        busy={busy}
        error={error}
      />
    );
  if (dialog.type === "job-detail" && job) {
    const req = workspace.requests.find((r) => r.id === job.requestId),
      customer = workspace.customers.find((c) => c.id === req?.customerId),
      tech = workspace.technicians.find((t) => t.id === job.technicianId);
    return (
      <Modal
        title={req?.title ?? "Parte de trabajo"}
        eyebrow={job.code}
        close={close}
      >
        <div className="detail-body">
          <div className="detail-tags">
            <Status status={job.status} />
            {job.completedAt && (
              <span className="muted small">
                Cerrado el {dateLabel(job.completedAt)}
              </span>
            )}
          </div>
          <div className="client-box">
            <MapPin size={21} />
            <div>
              <strong>{customer?.name}</strong>
              <p>{customer?.address}</p>
              <small>
                {customer?.contact} · {customer?.phone}
              </small>
            </div>
          </div>
          <div className="job-detail-grid">
            <div>
              <span className="eyebrow">TÉCNICO</span>
              <strong>{tech?.name ?? "Pendiente de asignar"}</strong>
            </div>
            <div>
              <span className="eyebrow">FECHA Y HORA</span>
              <strong>
                {job.startAt
                  ? `${dateLabel(job.startAt)} · ${timeLabel(job.startAt)}`
                  : "Pendiente de planificar"}
              </strong>
            </div>
            <div>
              <span className="eyebrow">DURACIÓN ESTIMADA</span>
              <strong>{job.durationMinutes} minutos</strong>
            </div>
            <div>
              <span className="eyebrow">SOLICITUD</span>
              <strong>{req?.code}</strong>
            </div>
          </div>
          <div className="detail-section">
            <h3>
              {job.report ? "Trabajo realizado" : "Descripción del trabajo"}
            </h3>
            <p className="preserve-lines">{job.report ?? req?.description}</p>
          </div>
          {job.materials.length > 0 && (
            <div className="detail-section">
              <h3>Materiales utilizados</h3>
              {job.materials.map((m) => (
                <p key={m.catalogId}>
                  {m.quantity} ×{" "}
                  {workspace.catalog.find((c) => c.id === m.catalogId)?.name}
                </p>
              ))}
            </div>
          )}
          {job.startAt && (
            <div className="calendar-export">
              <CalendarDays size={18} />
              <div>
                <strong>Llévalo a tu calendario</strong>
                <small>
                  Exporta un archivo compatible con Google, Apple y Outlook.
                </small>
              </div>
              <button
                className="icon-button"
                title="Descargar calendario"
                aria-label="Descargar calendario"
                onClick={() => props.exportCalendar(job)}
              >
                <Download size={19} />
              </button>
            </div>
          )}
          {props.mode === "connected" &&
            props.calendarConfigured &&
            job.startAt &&
            isManager && (
              <button
                className="button button-secondary full-width"
                disabled={busy}
                onClick={() => void props.syncCalendar(job)}
              >
                Sincronizar con Google Calendar
              </button>
            )}
          {errorNode}
        </div>
        <div className="modal-actions">
          {job.status !== "completed" && isManager && (
            <button
              className="button button-secondary"
              onClick={() => open({ type: "schedule", id: job.id })}
            >
              <CalendarPlus size={16} />
              {job.status === "pending" ? "Planificar" : "Reprogramar"}
            </button>
          )}
          {job.status === "scheduled" &&
            (isManager || actor.technicianId === job.technicianId) && (
              <button
                className="button button-primary"
                onClick={() => open({ type: "complete", id: job.id })}
              >
                <CheckCircle2 size={17} />
                Finalizar parte
              </button>
            )}
          {job.status === "completed" && (
            <span className="completed-label">
              <ShieldCheck size={16} />
              Parte finalizado y registrado
            </span>
          )}
        </div>
      </Modal>
    );
  }
  if (dialog.type === "login")
    return (
      <Modal
        title="Conectar mi cuenta"
        eyebrow="TU ESPACIO DE TRABAJO"
        close={close}
      >
        {props.configured ? (
          <form onSubmit={(e) => void props.login(e)}>
            <div className="form-body">
              <p className="muted">
                Accede con una cuenta que tenga acceso a tu organización.
              </p>
              <label>
                Correo electrónico
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  maxLength={254}
                  placeholder="nombre@empresa.es"
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  minLength={8}
                  maxLength={128}
                />
              </label>
              {errorNode}
            </div>
            <div className="modal-actions">
              {cancel}
              {submit("Iniciar sesión")}
            </div>
          </form>
        ) : (
          <div className="detail-body">
            <div className="setup-message">
              <ShieldCheck size={30} />
              <h3>Estás en el espacio de demostración</h3>
              <p>
                La conexión de cuentas todavía no está disponible en este
                entorno. Puedes probar todo el recorrido con los datos ficticios
                de la demo.
              </p>
              <button className="button button-primary" onClick={close}>
                Seguir explorando
              </button>
            </div>
          </div>
        )}
      </Modal>
    );
  if (dialog.type === "reset")
    return (
      <Modal
        title="¿Empezamos de nuevo?"
        eyebrow="REINICIAR DEMOSTRACIÓN"
        close={close}
      >
        <div className="detail-body">
          <p>
            Se restaurarán los datos de ejemplo y se eliminarán los cambios de
            la demo en esta pestaña. Esta acción no afecta a ninguna
            organización ni a otras pestañas.
          </p>
        </div>
        <div className="modal-actions">
          {cancel}
          <button className="button button-primary" onClick={props.reset}>
            Sí, reiniciar demo
          </button>
        </div>
      </Modal>
    );
  if (dialog.type === "help")
    return (
      <Modal
        title="Del aviso al trabajo terminado"
        eyebrow="BIENVENIDO A PARTEPRO"
        close={close}
      >
        <div className="detail-body">
          <p className="muted">
            Un recorrido completo para equipos de mantenimiento, sin perder el
            hilo.
          </p>
          <ol className="tour-steps">
            <li>
              <span>
                <ClipboardList size={20} />
              </span>
              <div>
                <h3>Registra una solicitud</h3>
                <p>Selecciona un cliente y describe lo que necesita.</p>
              </div>
            </li>
            <li>
              <span>
                <FileText size={20} />
              </span>
              <div>
                <h3>Prepara el presupuesto</h3>
                <p>
                  Añade servicios y materiales del catálogo. Registra la
                  aceptación.
                </p>
              </div>
            </li>
            <li>
              <span>
                <CalendarDays size={20} />
              </span>
              <div>
                <h3>Organiza la intervención</h3>
                <p>Asigna un técnico, una fecha y el tiempo previsto.</p>
              </div>
            </li>
            <li>
              <span>
                <ClipboardCheck size={20} />
              </span>
              <div>
                <h3>Cierra el parte de trabajo</h3>
                <p>
                  Deja constancia del trabajo realizado y los materiales
                  utilizados.
                </p>
              </div>
            </li>
          </ol>
          <div className="info-box">
            En la demo usamos datos ficticios. Tus cambios se guardan en esta
            pestaña y puedes reiniciarlos cuando quieras.
          </div>
        </div>
        <div className="modal-actions">
          <button
            className="button button-primary"
            onClick={() =>
              isManager ? open({ type: "request-new" }) : close()
            }
          >
            {isManager ? "Crear mi primera solicitud" : "Entendido"}
          </button>
        </div>
      </Modal>
    );
  return null;
}

function Progress({ status }: { status: ServiceRequest["status"] }) {
  const current = ["new", "quoted", "accepted", "completed"].indexOf(status);
  return (
    <div className="progress-steps" aria-label="Progreso de la solicitud">
      {["Solicitud", "Presupuesto", "Intervención", "Finalizada"].map(
        (label, index) => (
          <div key={label} className={index <= current ? "reached" : ""}>
            <span>{index < current ? <Check size={12} /> : index + 1}</span>
            <small>{label}</small>
          </div>
        ),
      )}
    </div>
  );
}

function QuoteLines({
  quote,
}: {
  quote: Pick<Quote, "items" | "subtotalCents" | "taxCents" | "totalCents">;
}) {
  return (
    <>
      <div className="quote-lines">
        {quote.items.map((item) => (
          <div key={item.catalogId}>
            <span>
              <strong>{item.name}</strong>
              <small>
                {item.quantity} × {money(item.unitPriceCents)}
              </small>
            </span>
            <strong>{money(item.quantity * item.unitPriceCents)}</strong>
          </div>
        ))}
      </div>
      <div className="quote-totals">
        <div>
          <span>Base imponible</span>
          <span>{money(quote.subtotalCents)}</span>
        </div>
        <div>
          <span>IVA (21 %)</span>
          <span>{money(quote.taxCents)}</span>
        </div>
        <div className="grand-total">
          <strong>Total presupuesto</strong>
          <strong>{money(quote.totalCents)}</strong>
        </div>
      </div>
    </>
  );
}

function QuoteBuilder({
  request,
  workspace,
  close,
  commit,
  busy,
  error,
}: {
  request: ServiceRequest;
  workspace: Workspace;
  close: () => void;
  commit: DialogProps["commit"];
  busy: boolean;
  error: string;
}) {
  const [items, setItems] = useState<Selection[]>([
    { catalogId: workspace.catalog[0]?.id ?? "", quantity: 1 },
  ]);
  let total: ReturnType<typeof calculateQuote> | null = null;
  try {
    total = calculateQuote(workspace.catalog, items);
  } catch {
    /* Incomplete rows are shown until corrected. */
  }
  return (
    <Modal title="Preparar presupuesto" eyebrow={request.code} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void commit(
            { type: "quote.create", requestId: request.id, items },
            "Presupuesto preparado. Puedes revisarlo y registrar la aceptación.",
          );
        }}
      >
        <div className="form-body">
          <div className="context-box">
            <FileText size={19} />
            <span>{request.title}</span>
          </div>
          <div className="field-heading">
            <h3>Servicios y materiales</h3>
            <span>Precios del catálogo</span>
          </div>
          {items.map((item, index) => (
            <div className="line-editor" key={index}>
              <label>
                Concepto {index + 1}
                <select
                  aria-label={`Concepto ${index + 1}`}
                  value={item.catalogId}
                  required
                  onChange={(e) =>
                    setItems(
                      items.map((row, i) =>
                        i === index
                          ? { ...row, catalogId: e.target.value }
                          : row,
                      ),
                    )
                  }
                >
                  <option value="" disabled>
                    Seleccionar concepto
                  </option>
                  {workspace.catalog.map((c) => (
                    <option
                      value={c.id}
                      key={c.id}
                      disabled={items.some(
                        (row, i) => i !== index && row.catalogId === c.id,
                      )}
                    >
                      {c.name} · {money(c.priceCents)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad
                <input
                  aria-label={`Cantidad ${index + 1}`}
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  required
                  value={item.quantity}
                  onChange={(e) =>
                    setItems(
                      items.map((row, i) =>
                        i === index
                          ? { ...row, quantity: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button remove-line"
                disabled={items.length === 1}
                aria-label={`Eliminar concepto ${index + 1}`}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-button add-line"
            disabled={items.length >= Math.min(workspace.catalog.length, 20)}
            onClick={() =>
              setItems([
                ...items,
                {
                  catalogId:
                    workspace.catalog.find(
                      (c) => !items.some((item) => item.catalogId === c.id),
                    )?.id ?? "",
                  quantity: 1,
                },
              ])
            }
          >
            <Plus size={16} />
            Añadir concepto
          </button>
          {total && (
            <div className="quote-totals">
              <div>
                <span>Base imponible</span>
                <span>{money(total.subtotalCents)}</span>
              </div>
              <div>
                <span>IVA (21 %)</span>
                <span>{money(total.taxCents)}</span>
              </div>
              <div className="grand-total">
                <strong>Total presupuesto</strong>
                <strong>{money(total.totalCents)}</strong>
              </div>
            </div>
          )}
          <p className="form-hint">
            Se guardará como pendiente de aceptar. La aceptación se registra en
            un paso separado.
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy || !total}
          >
            {busy ? "Guardando…" : "Guardar presupuesto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CompleteForm({
  job,
  workspace,
  close,
  commit,
  busy,
  error,
}: {
  job: Job;
  workspace: Workspace;
  close: () => void;
  commit: DialogProps["commit"];
  busy: boolean;
  error: string;
}) {
  const [materials, setMaterials] = useState<Selection[]>([]);
  const catalog = workspace.catalog.filter((c) => c.kind === "material");
  return (
    <Modal title="Finalizar parte de trabajo" eyebrow={job.code} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void commit(
            {
              type: "job.complete",
              jobId: job.id,
              report: textFrom(form, "report"),
              materials,
            },
            "Parte finalizado. El trabajo ha quedado registrado.",
          );
        }}
      >
        <div className="form-body">
          <div className="context-box">
            <Wrench size={19} />
            <span>
              {workspace.requests.find((r) => r.id === job.requestId)?.title}
            </span>
          </div>
          <label>
            Trabajo realizado
            <textarea
              name="report"
              required
              maxLength={4000}
              minLength={1}
              rows={5}
              placeholder="Describe las comprobaciones, la reparación y el resultado final."
            />
          </label>
          <div className="field-heading">
            <h3>Materiales utilizados</h3>
            <span>Opcional</span>
          </div>
          {materials.map((item, index) => (
            <div className="line-editor" key={index}>
              <label>
                Material {index + 1}
                <select
                  value={item.catalogId}
                  required
                  onChange={(e) =>
                    setMaterials(
                      materials.map((row, i) =>
                        i === index
                          ? { ...row, catalogId: e.target.value }
                          : row,
                      ),
                    )
                  }
                >
                  {catalog.map((c) => (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={materials.some(
                        (row, i) => i !== index && row.catalogId === c.id,
                      )}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  required
                  value={item.quantity}
                  onChange={(e) =>
                    setMaterials(
                      materials.map((row, i) =>
                        i === index
                          ? { ...row, quantity: Number(e.target.value) }
                          : row,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button remove-line"
                aria-label={`Eliminar material ${index + 1}`}
                onClick={() =>
                  setMaterials(materials.filter((_, i) => i !== index))
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-button add-line"
            disabled={materials.length >= catalog.length}
            onClick={() =>
              setMaterials([
                ...materials,
                {
                  catalogId:
                    catalog.find(
                      (c) => !materials.some((row) => row.catalogId === c.id),
                    )?.id ?? "",
                  quantity: 1,
                },
              ])
            }
          >
            <Plus size={16} />
            Añadir material
          </button>
          <div className="info-box">
            <ShieldCheck size={18} />
            <span>
              Al finalizar, el parte quedará cerrado y la solicitud se marcará
              como completada.
            </span>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={close}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={busy}
          >
            <CheckCircle2 size={17} />
            {busy ? "Finalizando…" : "Confirmar y finalizar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
