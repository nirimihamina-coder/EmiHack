import React from 'react';
import type { SyncQueueItem } from '../interface/Sync';
import type { SyncState } from '../hooks/useOfflineSync';

interface Props {
  items: SyncQueueItem[];
  syncState: SyncState;
  isOnline: boolean;
  onSync: () => void;
  onRetry: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: '➕ Création',
  UPDATE: '✏️  Modification',
  DELETE: '🗑️  Suppression'
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#92400e', bg: '#fef3c7' },
  syncing: { label: 'En cours…', color: '#1e40af', bg: '#dbeafe' },
  error: { label: 'Erreur', color: '#991b1b', bg: '#fee2e2' }
};

export const SyncQueuePage: React.FC<Props> = ({ items, syncState, isOnline, onSync, onRetry }) => {
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const errorCount = items.filter((i) => i.status === 'error').length;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>File de synchronisation</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
            {items.length === 0 ? 'Aucune action en attente' : `${pendingCount} en attente · ${errorCount} en erreur`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {errorCount > 0 && (
            <button
              onClick={onRetry}
              style={{
                background: '#fff',
                color: '#991b1b',
                border: '1px solid #f87171',
                borderRadius: '8px',
                padding: '8px 18px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Réessayer les erreurs
            </button>
          )}
          <button
            onClick={onSync}
            disabled={!isOnline || pendingCount === 0}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              cursor: !isOnline || pendingCount === 0 ? 'not-allowed' : 'pointer',
              opacity: !isOnline || pendingCount === 0 ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            {syncState === 'syncing' ? '⏳ Sync…' : '🔄 Synchroniser'}
          </button>
        </div>
      </div>

      {syncState === 'success' && (
        <div
          style={{
            background: '#d1fae5',
            color: '#065f46',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontWeight: 500
          }}
        >
          ✅ Toutes les actions ont été synchronisées !
        </div>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✨</div>
          <p>Tout est synchronisé</p>
        </div>
      )}

      {items.map((item) => {
        const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;
        const payload = item.payload as Record<string, unknown>;

        return (
          <div
            key={item.id}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '12px',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>
                  {ACTION_LABELS[item.action] ?? item.action}
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.resource}</span>
              </div>
              {typeof payload?.title === 'string' && (
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: '13px',
                    color: '#374151',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {String(payload.title)}
                </p>
              )}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  {new Date(item.createdAt).toLocaleString('fr-FR')}
                </span>
                {item.retries > 0 && (
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>{item.retries} tentative(s)</span>
                )}
              </div>
              {item.errorMessage && (
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: '12px',
                    color: '#991b1b',
                    background: '#fee2e2',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {item.errorMessage}
                </p>
              )}
            </div>
            <span
              style={{
                background: statusCfg.bg,
                color: statusCfg.color,
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0
              }}
            >
              {statusCfg.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
