import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModal } from '../../context/ModalContext';

export const LogoutModal = () => {
  const { closeModal } = useModal();
  const navigate = useNavigate();

  const confirmLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Se déconnecter ?</h3>
          <p className="text-sm text-gray-500 mb-6">Êtes-vous sûr de vouloir vous déconnecter ?</p>
          <div className="flex gap-4 w-full">
            <button
              onClick={closeModal}
              className="flex-1 py-3 text-sm font-medium cursor-pointer border border-gray-300 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={confirmLogout}
              className="flex-1 py-3 text-sm font-medium cursor-pointer text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
            >
              Oui, se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
