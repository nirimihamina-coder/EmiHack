import React from 'react';
import type { SyncState } from '../hooks/useOfflineSync';

interface Props {
  isOnline: boolean;
  syncState: SyncState;
  pendingCount: number;
  onSync: () => void;
  onRetry: () => void;
}

export const OfflineIndicator: React.FC<Props> = ({ isOnline, syncState, pendingCount, onSync, onRetry }) => {
  if (isOnline && pendingCount === 0 && syncState === 'idle') return null;

  const getBannerStyle = (): React.CSSProperties => {
    if (!isOnline) return { background: '#92400e', color: '#fef3c7' };
    if (syncState === 'syncing') return { background: '#1e40af', color: '#dbeafe' };
    if (syncState === 'success') return { background: '#065f46', color: '#d1fae5' };
    if (syncState === 'error') return { background: '#991b1b', color: '#fee2e2' };
    if (pendingCount > 0) return { background: '#78350f', color: '#fef3c7' };
    return { background: '#374151', color: '#f9fafb' };
  };

  const getMessage = () => {
    if (!isOnline) return `📵 Hors connexion${pendingCount > 0 ? ` — ${pendingCount} action(s) en attente` : ''}`;
    if (syncState === 'syncing') return '🔄 Synchronisation en cours…';
    if (syncState === 'success') return '✅ Synchronisation terminée';
    if (syncState === 'error') return "⚠️ Certaines actions n'ont pas pu être synchronisées";
    if (pendingCount > 0) return `⏳ ${pendingCount} action(s) en attente`;
    return '';
  };

  const bannerStyle: React.CSSProperties = {
    ...getBannerStyle(),
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    gap: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  };

  const buttonStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.2)',
    color: 'inherit',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '6px',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0
  };

  return (
    <div style={bannerStyle} role="status" aria-live="polite">
      <span>{getMessage()}</span>
      <div style={{ display: 'flex', gap: '8px' }}>
        {isOnline && pendingCount > 0 && syncState === 'idle' && (
          <button style={buttonStyle} onClick={onSync}>
            Synchroniser maintenant
          </button>
        )}
        {syncState === 'error' && (
          <button style={buttonStyle} onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  );
};
