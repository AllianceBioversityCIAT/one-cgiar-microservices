import Server from './classes/server';
import router from './routes/router';
import express from 'express';
import cors from 'cors';
import { documentationRouter } from './routes/documentation-router';
import path from 'path';

const server = Server.instance;
const { app } = server;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));
app.use(express.static(path.join(__dirname, 'public')));

server.start(() => {
  console.log(`Server running on port http://localhost:${server.port}`);
});
app.get('/', (req, res) => {
  res.redirect('/documentation');
});

app.use('/documentation', documentationRouter);

app.use('/socket', router);
