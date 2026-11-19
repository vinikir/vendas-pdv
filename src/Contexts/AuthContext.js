import React, { createContext, useContext, useEffect, useState } from 'react';
import useUsuarioStore from '../store/useUsuarioStore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    // Lê o localStorage já no primeiro render: se esperar o useEffect, a RotaPrivada
    // vê usuario=null no refresh e manda de volta pro login.
    const [usuario, setUsuarioContext] = useState(() => {
        try {
            const usuarioSalvo = localStorage.getItem('usuario');
            return usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
        } catch {
            return null;
        }
    });
    const setUsuarioStore = useUsuarioStore((state) => state.setUsuario);
    const limparUsuarioStore = useUsuarioStore((state) => state.limparUsuario);

    const mapearUsuarioParaStore = (dadosUsuario) => ({
        id: dadosUsuario?.id ?? dadosUsuario?.id_usuario ?? dadosUsuario?.userId ?? dadosUsuario?.idUser ?? null,
        nome: dadosUsuario?.nome ?? dadosUsuario?.nome_usuario ?? dadosUsuario?.login ?? "",
    });

    // Mantém o store em sincronia com o usuário restaurado do localStorage
    useEffect(() => {
        if (usuario) setUsuarioStore(mapearUsuarioParaStore(usuario));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = (dadosUsuario) => {
        localStorage.setItem('usuario', JSON.stringify(dadosUsuario));
        setUsuarioStore(mapearUsuarioParaStore(dadosUsuario));
        setUsuarioContext(dadosUsuario);
    };

    const logout = () => {
        localStorage.removeItem('usuario');
        limparUsuarioStore();
        setUsuarioContext(null);
    };

    return (
        <AuthContext.Provider value={{ usuario, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
