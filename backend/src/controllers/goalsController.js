import * as service from '../services/goalsService.js';

export async function index(request, response) {
  response.json(await service.listGoals());
}

export async function store(request, response) {
  response.status(201).json(await service.createGoal(request.body));
}

export async function contribute(request, response) {
  response.json(await service.addContribution(Number(request.params.id), request.body));
}
