# Fluxo

MVP mobile-first para controle de contas, faturas, gastos parcelados, investimentos e metas. A interface segue o visual escuro e translúcido das referências, com adaptação completa para celular e desktop.

## Executar

Pré-requisito: Docker Desktop em execução.

Copie as configurações locais e, para qualquer ambiente compartilhado, troque a senha do PostgreSQL:

```bash
cp .env.example .env
```

```bash
docker compose up --build -d
```

- Aplicação: http://localhost:3000
- API: http://localhost:3333/api
- Saúde da API: http://localhost:3333/api/health

## Instalar como PWA

O frontend inclui manifesto, service worker, cache do app shell e ícones para Android e iOS. Em navegadores compatíveis, use **Instalar aplicativo**; no Safari do iPhone/iPad, use **Compartilhar → Adicionar à Tela de Início**.

Em produção, publique o frontend por HTTPS. A API é acessada por `/api` no mesmo domínio e encaminhada pelo Nginx ao backend, para que o aplicativo instalado também funcione fora do computador de desenvolvimento.

> **Segurança:** este MVP ainda não possui autenticação. Não o exponha diretamente à internet com dados reais sem adicionar controle de acesso na aplicação ou na infraestrutura.

Para encerrar:

```bash
docker compose down
```

Os dados ficam preservados no volume `postgres_data`. Os PDFs anexados ficam em `backend/storage/pdfs`, pasta local mapeada no container do backend em `/app/storage/pdfs`. O banco inicia sem registros de demonstração. `docker compose down -v` remove o banco, mas preserva os PDFs; apague-os manualmente somente quando quiser remover também os documentos.

## Validar antes de publicar

```bash
cd backend && npm test
cd ../frontend && npm run lint && npm run build
cd .. && docker compose config --quiet && docker compose build
```

## Estrutura

```text
frontend/                  React + Vite + Nginx
backend/
├── src/
│   ├── app.js
│   ├── routes/
│   ├── middlewares/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   └── db/                PostgreSQL, schema e inicialização
└── storage/pdfs/          PDFs anexados (persistência local)
docker-compose.yml         Frontend + backend + PostgreSQL
```

## Regras já implementadas

- Uma conta pode ter somente uma fatura aberta por vez.
- Um gasto entra na fatura aberta da conta escolhida.
- Compras parceladas geram todas as parcelas futuras com divisão exata dos centavos.
- A tela de faturas soma as parcelas previstas por mês.
- Ao marcar uma fatura como paga, o app exige o período da próxima fatura.
- As parcelas futuras do novo período são vinculadas automaticamente à nova fatura.
- Metas aceitam aportes e limitam o progresso ao valor objetivo.
- Investimentos podem ser editados, receber aportes e retiradas e ter o valor de mercado atualizado manualmente; a rentabilidade é recalculada automaticamente.
- Ao adicionar um gasto, é possível anexar um PDF de até 15 MB. O arquivo é guardado e associado ao gasto e à fatura aberta da conta selecionada.
- Ao selecionar o PDF, o backend tenta primeiro extrair o texto nativo com Poppler. Se o documento for escaneado, usa Tesseract local em português.
- Se o PDF estiver protegido, o app solicita a senha em um modal. A senha é usada somente durante a leitura, não é armazenada, e o usuário ainda pode guardar o arquivo sem executar o OCR.
- Descrição e valor encontrados são preenchidos no formulário para conferência antes do lançamento. Nenhum documento é enviado a serviços externos.
- O OCR processa no máximo três páginas a 200 DPI, usa um núcleo e aceita somente um processamento simultâneo para preservar máquinas pequenas.
