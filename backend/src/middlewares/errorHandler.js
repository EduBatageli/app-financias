export function notFound(request, response) {
  response.status(404).json({ message: 'Rota não encontrada.' });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  if (error.code === '23505') {
    return response.status(409).json({ message: 'Este registro já existe ou entra em conflito com outro.' });
  }
  if (error.code === '23503') {
    return response.status(400).json({ message: 'O registro relacionado não existe.' });
  }
  if (['22001', '22003', '22P02', '23514'].includes(error.code)) {
    return response.status(400).json({ message: 'Um dos valores informados é inválido.' });
  }
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  return response.status(status).json({ message: status >= 500 ? 'Não foi possível concluir a operação.' : error.message });
}
