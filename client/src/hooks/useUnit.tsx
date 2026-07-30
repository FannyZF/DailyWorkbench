import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface UnitContextType {
  unitName: string;
  appTitle: string;
  appShortTitle: string;
  loading: boolean;
  refresh: () => void;
}

const UnitContext = createContext<UnitContextType>({
  unitName: '',
  appTitle: '工作台',
  appShortTitle: '工作台',
  loading: true,
  refresh: () => {},
});

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unitName, setUnitName] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    setLoading(true);
    api.get('/settings').then(({ data }) => {
      setUnitName(data.unitName || '');
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const appTitle = unitName ? `${unitName}工作台` : '工作台';
  const appShortTitle = unitName || '工作台';

  return (
    <UnitContext.Provider value={{ unitName, appTitle, appShortTitle, loading, refresh }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
