import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(null);

    // Tenta restaurar o usuário do localStorage ao carregar o app
    useEffect(() => {
        const usuarioSalvo = localStorage.getItem('usuario');
        if (usuarioSalvo) {
            setUsuario(JSON.parse(usuarioSalvo));
        }
    }, []);

    const login = (dadosUsuario) => {
        localStorage.setItem('usuario', JSON.stringify(dadosUsuario));
        setUsuario(dadosUsuario);
    };

    const logout = () => {
        localStorage.removeItem('usuario');
        setUsuario(null);
    };

    return (
        <AuthContext.Provider value={{ usuario, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
