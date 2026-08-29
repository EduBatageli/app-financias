import * as service from '../services/investmentsService.js';

export async function index(request, response) {
  response.json(await service.listInvestments());
}

export async function store(request, response) {
  response.status(201).json(await service.createInvestment(request.body));
}

export async function update(request, response) {
  response.json(await service.updateInvestment(request.params.id, request.body));
}

export async function move(request, response) {
  response.json(await service.moveInvestment(request.params.id, request.body));
}

export async function updateValue(request, response) {
  response.json(await service.updateCurrentValue(request.params.id, request.body));
}
