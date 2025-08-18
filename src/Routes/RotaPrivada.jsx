import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../Contexts/AuthContext';

const RotaPrivada = ({ children }) => {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RotaPrivada;
