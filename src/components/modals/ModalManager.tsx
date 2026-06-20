import { useModal } from '../../context/ModalContext';
import { LogoutModal } from './LogoutModal';

export const ModalManager = () => {
  const { activeModal } = useModal();

  if (!activeModal) return null;

  return (
    <>
      {activeModal === 'logout' && <LogoutModal />}
      {/* Ajoute ici les futurs modals */}
    </>
  );
};
