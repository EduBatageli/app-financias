import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { routes } from './routes/index.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || '*' }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);
