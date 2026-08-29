import * as service from '../services/invoicesService.js';

export async function index(request, response) {
  response.json(await service.listInvoices());
}

export async function expenses(request, response) {
  response.json(await service.listInvoiceExpenses(request.params.id));
}

export async function store(request, response) {
  response.status(201).json(await service.createInvoice(request.body));
}

export async function pay(request, response) {
  response.json(await service.payAndOpenNext(Number(request.params.id), request.body));
}
