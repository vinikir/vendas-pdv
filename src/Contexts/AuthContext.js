import React, { createContext, useContext, useEffect, useState } from 'react';
import useUsuarioStore from '../store/useUsuarioStore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuarioContext] = useState(null);
    const setUsuarioStore = useUsuarioStore((state) => state.setUsuario);
    const limparUsuarioStore = useUsuarioStore((state) => state.limparUsuario);

    const mapearUsuarioParaStore = (dadosUsuario) => ({
        id: dadosUsuario?.id ?? dadosUsuario?.id_usuario ?? dadosUsuario?.userId ?? dadosUsuario?.idUser ?? null,
        nome: dadosUsuario?.nome ?? dadosUsuario?.nome_usuario ?? dadosUsuario?.login ?? "",
    });

    // Tenta restaurar o usuário do localStorage ao carregar o app
    useEffect(() => {
        const usuarioSalvo = localStorage.getItem('usuario');
        if (usuarioSalvo) {
            const dadosUsuario = JSON.parse(usuarioSalvo);
            setUsuarioContext(dadosUsuario);
            setUsuarioStore(mapearUsuarioParaStore(dadosUsuario));
        }
    }, [setUsuarioStore]);

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
