import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import Login from '../screens/Login/Login';
import PDV from '../screens/pdv/pdv';
import { AuthProvider } from '../Contexts/AuthContext';

import RotaPrivada from './RotaPrivada';

const Rotas = () => {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route index element={<Login />} />
                    <Route path="/" element={<Login />} />
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/pdv"
                        element={
                            <RotaPrivada>
                                <PDV />
                            </RotaPrivada>
                        }
                    />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
};


export default Rotas;
