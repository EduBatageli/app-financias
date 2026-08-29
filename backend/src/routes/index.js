import express, { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as accountsController from '../controllers/accountsController.js';
import * as dashboardController from '../controllers/dashboardController.js';
import * as expensesController from '../controllers/expensesController.js';
import * as goalsController from '../controllers/goalsController.js';
import * as investmentsController from '../controllers/investmentsController.js';
import * as invoicesController from '../controllers/invoicesController.js';
import { checkDatabase } from '../db/index.js';

export const routes = Router();
const pdfBody = express.raw({ type: 'application/pdf', limit: '15mb' });

routes.get('/health', asyncHandler(async (request, response) => {
  await checkDatabase();
  response.json({ status: 'ok', database: 'ok' });
}));
routes.get('/dashboard', asyncHandler(dashboardController.index));

routes.get('/accounts', asyncHandler(accountsController.index));
routes.post('/accounts', asyncHandler(accountsController.store));
routes.patch('/accounts/:id', asyncHandler(accountsController.update));

routes.get('/invoices', asyncHandler(invoicesController.index));
routes.get('/invoices/:id/expenses', asyncHandler(invoicesController.expenses));
routes.post('/invoices', asyncHandler(invoicesController.store));
routes.post('/invoices/:id/pay', asyncHandler(invoicesController.pay));

routes.get('/expenses', asyncHandler(expensesController.index));
routes.post('/expenses/pdf/analyze', pdfBody, asyncHandler(expensesController.analyzePdf));
routes.post('/expenses/pdf', pdfBody, asyncHandler(expensesController.storePdf));
routes.post('/expenses', asyncHandler(expensesController.store));
routes.patch('/expenses/:id', asyncHandler(expensesController.update));
routes.get('/projections', asyncHandler(expensesController.projections));
routes.get('/documents/:id/file', asyncHandler(expensesController.showPdf));

routes.get('/investments', asyncHandler(investmentsController.index));
routes.post('/investments', asyncHandler(investmentsController.store));
routes.patch('/investments/:id', asyncHandler(investmentsController.update));
routes.post('/investments/:id/movements', asyncHandler(investmentsController.move));
routes.patch('/investments/:id/value', asyncHandler(investmentsController.updateValue));

routes.get('/goals', asyncHandler(goalsController.index));
routes.post('/goals', asyncHandler(goalsController.store));
routes.patch('/goals/:id/contribute', asyncHandler(goalsController.contribute));
