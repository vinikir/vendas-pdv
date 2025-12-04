import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUsuarioStore = create(
    persist(
        (set) => ({
            usuario: null,
            setUsuario: ({ id, nome }) => set({ usuario: { id, nome } }),
            limparUsuario: () => set({ usuario: null }),
        }),
        {
            name: 'usuario-store',
        }
    )
);

export default useUsuarioStore;
