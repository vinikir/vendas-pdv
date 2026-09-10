import axios from 'axios'

const api = axios.create({

    //baseURL:"http://18.222.164.74/",
    //baseURL:"https://urvu65w6he.execute-api.us-east-2.amazonaws.com/",
    baseURL:"https://vendasbackcentral-388770734965.us-central1.run.app/",
    //baseURL:"http://192.168.0.59:3300/",

    timeout: 30000,
    headers: {
        'Content-Type':'application/json; charset=utf-8',
    }

})

api.interceptors.request.use((config) => {
    try {
        // Não sobrescreve um Authorization já definido explicitamente na chamada
        // (ex: ação autenticada por um funcionário diferente do operador do terminal).
        if (!config.headers.Authorization) {
            const usuarioSalvo = localStorage.getItem('usuario');
            const token = usuarioSalvo ? JSON.parse(usuarioSalvo)?.token : null;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
    } catch (e) {
        // localStorage inacessível ou JSON inválido: segue sem token
    }
    return config;
});

export default api