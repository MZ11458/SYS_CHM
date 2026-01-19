import type {
  Alert,
  Reminder,
  StatusLevel,
  SystemStatus
} from "../notifications";

interface NotificationsPanelProps {
  alerts: Alert[];
  reminders: Reminder[];
  systemStatus: SystemStatus;
  isOpen: boolean;
  onToggle: () => void;
  onDismissAlert: (id: string) => void;
  onClearAlerts: () => void;
  onRefresh: () => void;
}

const statusLabels: Record<StatusLevel, string> = {
  ok: "Aktywne",
  warning: "Ostrzeżenie",
  down: "Niedostępne"
};

const formatReminderTime = (timestamp: string) =>
  new Date(timestamp).toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short"
  });

const formatAlertTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit"
  });

const formatStatusTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit"
  });

export default function NotificationsPanel({
  alerts,
  reminders,
  systemStatus,
  isOpen,
  onToggle,
  onDismissAlert,
  onClearAlerts,
  onRefresh
}: NotificationsPanelProps) {
  const alertCount = alerts.length;
  const reminderCount = reminders.length;
  const toggleLabel = isOpen ? "Zwiń" : "Rozwiń";

  return (
    <section
      id="notifications-center"
      className={`panel notifications-panel ${isOpen ? "" : "collapsed"}`}
      data-animate
    >
      <div className="section-head">
        <div>
          <p className="eyebrow">Powiadomienia</p>
          <h2>Centrum stanu</h2>
          <p className="muted">Monitoruj synchronizację i najbliższe zdarzenia.</p>
        </div>
        <div className="notifications-actions">
          <div className="notifications-summary">
            <span className="pill status">Alerty: {alertCount}</span>
            <span className="pill status">Przypomnienia: {reminderCount}</span>
          </div>
          <button className="ghost-button" onClick={onRefresh}>
            Odśwież
          </button>
          <button
            className="ghost-button tiny"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls="notifications-body"
          >
            {toggleLabel}
          </button>
        </div>
      </div>

      <div id="notifications-body" className="notifications-body" hidden={!isOpen}>
        <div className="notifications-section">
          <p className="section-label">Status synchronizacji</p>
          <div className="status-list">
            <div className="status-item">
              <span>API i dane lokalne</span>
              <span className={`status-pill ${systemStatus.api}`}>
                {statusLabels[systemStatus.api]}
              </span>
            </div>
            <div className="status-item">
              <span>Synchronizacja globalna</span>
              <span className={`status-pill ${systemStatus.spanner}`}>
                {statusLabels[systemStatus.spanner]}
              </span>
            </div>
          </div>
          <p className="muted small">
            Aktualizacja: {formatStatusTime(systemStatus.updatedAt)}
          </p>
        </div>

        <div className="notifications-section">
          <div className="section-title">
            <p className="section-label">Przypomnienia</p>
          </div>
          {reminders.length === 0 ? (
            <p className="muted">Brak przypomnień.</p>
          ) : (
            <div className="reminder-list">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="reminder-item">
                  <div>
                    <p className="reminder-title">{reminder.title}</p>
                    <p className="reminder-meta">
                      {reminder.location} - {formatReminderTime(reminder.startTime)}
                    </p>
                  </div>
                  <span className="pill status">Nadchodzące</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="notifications-section">
          <div className="section-title">
            <p className="section-label">Alerty</p>
            {alerts.length > 0 ? (
              <button className="ghost-button tiny" onClick={onClearAlerts}>
                Wyczyść
              </button>
            ) : null}
          </div>
          {alerts.length === 0 ? (
            <p className="muted">Brak alertów.</p>
          ) : (
            <div className="alert-list">
              {alerts.map((alert) => (
                <div key={alert.id} className={`alert-item ${alert.tone}`}>
                  <div>
                    <p className="alert-title">{alert.title}</p>
                    <p className="muted small">{alert.message}</p>
                    <span className="alert-time">
                      {formatAlertTime(alert.createdAt)}
                    </span>
                  </div>
                  <button
                    className="ghost-button tiny"
                    onClick={() => onDismissAlert(alert.id)}
                  >
                    Usuń
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
