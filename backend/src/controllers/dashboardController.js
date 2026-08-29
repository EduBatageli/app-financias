import { getDashboard } from '../services/dashboardService.js';

export async function index(request, response) {
  response.json(await getDashboard());
}
