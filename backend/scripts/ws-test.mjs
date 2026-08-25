import { io } from 'socket.io-client';
const orderNo=process.argv[2]??'SD-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-0001';
const socket=io('http://localhost:4000/tracking',{transports:['websocket']});
for(const e of ['order:statusChanged','order:progress','order:ready'])socket.on(e,p=>console.log(e,p));
socket.on('connect',()=>{console.log('connected',orderNo);socket.emit('track:order',{orderNo},r=>console.log('tracked',r));let n=0;const t=setInterval(async()=>{if(n++>=4){clearInterval(t);socket.close();return}await fetch('http://localhost:4000/api/admin/orders/'+orderNo+'/advance',{method:'POST'})},2000)});
