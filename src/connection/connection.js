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


export default api