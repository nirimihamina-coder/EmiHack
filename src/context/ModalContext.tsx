import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
type ModalType = 'logout' | null;

interface ModalContextType {
  openModal: (type: ModalType) => void;
  closeModal: () => void;
  activeModal: ModalType;
}

const ModalContext = createContext<ModalContextType | null>(null);

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const openModal = (type: ModalType) => setActiveModal(type);
  const closeModal = () => setActiveModal(null);

  return <ModalContext.Provider value={{ openModal, closeModal, activeModal }}>{children}</ModalContext.Provider>;
};

export const useModal = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
};
