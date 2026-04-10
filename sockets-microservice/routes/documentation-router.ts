import { Router } from 'express';
import path from 'path';

export const documentationRouter = Router();

documentationRouter.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});
