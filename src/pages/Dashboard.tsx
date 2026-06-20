const DashboardPage = () => {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Utilisateurs', value: '1 284' },
          { label: 'Revenus', value: '48 200 €' },
          { label: 'Sessions', value: '9 341' }
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
            <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;
