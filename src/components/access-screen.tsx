"use client";

import type { FormEvent, ReactNode } from "react";
import {
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  ShieldCheck,
  Wrench,
} from "lucide-react";

type AccessScreenProps = {
  brand: ReactNode;
  configured: boolean;
  busy: boolean;
  error: string;
  message: string;
  canRetrySession: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onExplore: () => void;
  onRetrySession: () => void;
};

export default function AccessScreen({
  brand,
  configured,
  busy,
  error,
  message,
  canRetrySession,
  onSubmit,
  onExplore,
  onRetrySession,
}: AccessScreenProps) {
  return (
    <div className="access-page">
      <header className="access-header">
        {brand}
        <span>GESTIÓN DE MANTENIMIENTO</span>
      </header>

      <main className="access-main" id="main-content">
        <section className="access-story" aria-labelledby="access-story-title">
          <p className="eyebrow">DEL AVISO AL ÚLTIMO DETALLE</p>
          <h2 id="access-story-title">
            El trabajo,
            <br />
            bien organizado<span>.</span>
          </h2>
          <p className="access-intro">
            Tu equipo, tus clientes y cada intervención.
            <br />
            Todo en un mismo espacio de trabajo.
          </p>
          <div className="access-flow" aria-label="Recorrido de trabajo">
            <div>
              <ClipboardList size={20} />
              <span>Solicitudes</span>
            </div>
            <div>
              <FileText size={20} />
              <span>Presupuestos</span>
            </div>
            <div>
              <CalendarDays size={20} />
              <span>Agenda</span>
            </div>
            <div>
              <ClipboardCheck size={20} />
              <span>Partes de trabajo</span>
            </div>
          </div>
          <div className="access-promise">
            <Wrench size={20} />
            <p>
              Menos gestión.
              <br />
              <strong>Más trabajo bien hecho.</strong>
            </p>
          </div>
        </section>

        <section className="access-card" aria-labelledby="access-title">
          <span className="access-symbol" aria-hidden="true">
            <ShieldCheck size={23} />
          </span>
          <p className="eyebrow">TU ESPACIO DE TRABAJO</p>
          <h1 id="access-title">Iniciar sesión</h1>
          <p className="access-description">
            Accede con tu cuenta para trabajar con los datos de tu organización.
          </p>

          <form
            className="access-form"
            onSubmit={(event) => void onSubmit(event)}
            aria-busy={busy}
          >
            <label htmlFor="access-email">Correo electrónico</label>
            <input
              id="access-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              placeholder="nombre@empresa.es"
              disabled={busy || !configured}
            />
            <label htmlFor="access-password">Contraseña</label>
            <input
              id="access-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              maxLength={128}
              disabled={busy || !configured}
            />
            {!configured && (
              <p className="access-unavailable">
                El acceso a cuentas no está disponible en este entorno. Puedes
                conocer la aplicación con la demo.
              </p>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            {message && !error && (
              <p className="access-message" role="status">
                {message}
              </p>
            )}
            <button
              className="button button-primary access-submit"
              type="submit"
              disabled={busy || !configured}
            >
              {busy ? "Iniciando sesión…" : "Iniciar sesión"}
            </button>
          </form>
          {canRetrySession && (
            <button
              type="button"
              className="text-button access-retry"
              onClick={onRetrySession}
              disabled={busy}
            >
              Volver a comprobar sesión
            </button>
          )}

          <div className="access-divider">
            <span>¿Quieres conocer PartePro?</span>
          </div>
          <button
            type="button"
            className="button button-secondary access-explore"
            onClick={onExplore}
            disabled={busy}
          >
            Explorar demo
          </button>
          <p className="access-demo-note">
            Datos ficticios. No necesitas una cuenta.
          </p>
        </section>
      </main>

      <footer className="access-footer">
        <span>PartePro · Tu trabajo, en orden.</span>
        <span>
          <ShieldCheck size={14} />
          Acceso reservado a tu organización
        </span>
      </footer>
    </div>
  );
}
