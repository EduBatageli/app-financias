import * as service from '../services/accountsService.js';

export async function index(request, response) {
  response.json(await service.listAccounts());
}

export async function store(request, response) {
  response.status(201).json(await service.createAccount(request.body));
}

export async function update(request, response) {
  response.json(await service.updateAccount(request.params.id, request.body));
}
