import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, Check, ChevronRight,
  CircleAlert, CircleDollarSign, Download, ExternalLink, Eye, EyeOff, FileText, FileUp, Goal as GoalIcon, Home, Landmark, LayoutDashboard, LoaderCircle, LockKeyhole,
  Minus, Pencil, Plus, ReceiptText, RefreshCw, Settings2, ShieldCheck, ShoppingBag, Sparkles, Target,
  TrendingUp, User, Utensils, WalletCards, Wifi, X,
} from 'lucide-react';
import { api, ApiError } from './api';
import type { Account, AppData, DashboardData, Expense, Goal, Investment, Invoice, InvoiceExpense, ModalKind, Tab } from './types';

const emptyDashboard: DashboardData = {
  summary: { accountBalance: 0, investments: 0, goalsSaved: 0, netWorth: 0 },
  currentInvoice: null, recentExpenses: [], monthlySpending: [],
};

const initialData: AppData = {
  dashboard: emptyDashboard, accounts: [], invoices: [], expenses: [],
  projections: [], investments: [], goals: [],
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });
const fullMonthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const fullDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });
const categories: Record<string, typeof ShoppingBag> = {
  Alimentação: ShoppingBag, Restaurante: Utensils, Assinaturas: Wifi, Trabalho: Landmark,
};

function iso(value?: string) { return value?.slice(0, 10) || ''; }
function parseUtc(value: string) { return new Date(`${iso(value)}T12:00:00Z`); }
function toInputDate(date: Date) { return date.toISOString().slice(0, 10); }
function todayInputDate(date = new Date()) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}
function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
}
function currentDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    .format(date)
    .toLocaleUpperCase('pt-BR');
}
function accountMark(name: string) {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] || ''}` : parts[0]?.slice(0, 2) || '—').toUpperCase();
}
function addDays(value: string, days: number) {
  const date = parseUtc(value); date.setUTCDate(date.getUTCDate() + days); return toInputDate(date);
}
function addMonths(value: string, months: number) {
  const date = parseUtc(value); const day = date.getUTCDate(); date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last)); return toInputDate(date);
}

export default function App() {
  const [data, setData] = useState<AppData>(initialData);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [investmentMovementKind, setInvestmentMovementKind] = useState<'contribution' | 'withdrawal'>('contribution');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<NonNullable<Expense['document']> | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToRestore, setInvoiceToRestore] = useState<Invoice | null>(null);
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [dashboard, accounts, invoices, expenses, projections, investments, goals] = await Promise.all([
        api.get<AppData['dashboard']>('/dashboard'), api.get<AppData['accounts']>('/accounts'),
        api.get<AppData['invoices']>('/invoices'), api.get<AppData['expenses']>('/expenses'),
        api.get<AppData['projections']>('/projections'), api.get<AppData['investments']>('/investments'),
        api.get<AppData['goals']>('/goals'),
      ]);
      const nextData = { dashboard, accounts, invoices, expenses, projections, investments, goals };
      setData(nextData);
      setError('');
      return nextData;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível carregar seus dados.';
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // A carga inicial sincroniza o estado local com a API ao montar o aplicativo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData().catch(() => {});
  }, [loadData]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function perform(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError('');
    let saved = false;
    try {
      await action();
      saved = true;
      const refreshedData = await loadData();
      finishAction(refreshedData);
      setToast(message);
    } catch (err) {
      if (saved) {
        finishAction();
        setError('A operação foi salva, mas os dados não puderam ser atualizados. Recarregue a página.');
      } else {
        setError(err instanceof Error ? err.message : 'Algo deu errado.');
      }
    }
    finally { setBusy(false); }
  }

  function finishAction(refreshedData?: AppData) {
    setModal(null); setSelectedGoal(null); setSelectedExpense(null); setSelectedAccount(null); setSelectedInvestment(null); setInvoiceToPay(null);
    if (invoiceToRestore) setSelectedInvoice(refreshedData?.invoices.find((invoice) => invoice.id === invoiceToRestore.id) || invoiceToRestore);
    setInvoiceToRestore(null);
  }

  const modalContent = (() => {
    if (modal === 'expense') return <ExpenseForm accounts={data.accounts} invoices={data.invoices} busy={busy} onSubmit={(body, pdfFile) => perform(
      () => pdfFile ? api.uploadPdf('/expenses/pdf', body, pdfFile) : api.post('/expenses', body),
      pdfFile ? 'PDF guardado e gasto adicionado à fatura.' : 'Gasto adicionado à fatura.',
    )} />;
    if (modal === 'expenseEdit' && selectedExpense) return <ExpenseForm initialExpense={selectedExpense} accounts={data.accounts} invoices={data.invoices} busy={busy} onSubmit={(body) => perform(() => api.patch(`/expenses/${selectedExpense.id}`, body), 'Gasto atualizado com sucesso.')} />;
    if (modal === 'account') return <AccountForm busy={busy} onSubmit={(account, invoice) => perform(
      () => api.post<Account>('/accounts', invoice ? { ...account, invoice } : account),
      'Conta adicionada com sucesso.',
    )} />;
    if (modal === 'accountEdit' && selectedAccount) return <AccountForm initialAccount={selectedAccount} busy={busy} onSubmit={(account) => perform(() => api.patch(`/accounts/${selectedAccount.id}`, account), 'Conta atualizada com sucesso.')} />;
    if (modal === 'invoice') return <InvoiceForm accounts={data.accounts} invoices={data.invoices} busy={busy} onSubmit={(body) => perform(() => api.post('/invoices', body), 'Fatura aberta com sucesso.')} />;
    if (modal === 'pay') return <PayInvoiceForm invoice={invoiceToPay} busy={busy} onSubmit={(body) => perform(() => api.post(`/invoices/${invoiceToPay?.id}/pay`, body), 'Fatura paga e próxima fatura aberta.')} />;
    if (modal === 'investment') return <InvestmentForm busy={busy} onSubmit={(body) => perform(() => api.post('/investments', body), 'Investimento adicionado.')} />;
    if (modal === 'investmentEdit' && selectedInvestment) return <InvestmentForm investment={selectedInvestment} busy={busy} onSubmit={(body) => perform(() => api.patch(`/investments/${selectedInvestment.id}`, body), 'Investimento atualizado.')} />;
    if (modal === 'investmentMovement' && selectedInvestment) return <InvestmentMovementForm investment={selectedInvestment} kind={investmentMovementKind} busy={busy} onSubmit={(body) => perform(() => api.post(`/investments/${selectedInvestment.id}/movements`, body), investmentMovementKind === 'contribution' ? 'Aporte registrado.' : 'Retirada registrada.')} />;
    if (modal === 'investmentValue' && selectedInvestment) return <InvestmentValueForm investment={selectedInvestment} busy={busy} onSubmit={(body) => perform(() => api.patch(`/investments/${selectedInvestment.id}/value`, body), 'Valor atual recalculado.')} />;
    if (modal === 'goal') return <GoalForm busy={busy} onSubmit={(body) => perform(() => api.post('/goals', body), 'Meta criada.')} />;
    if (modal === 'contribution') return <ContributionForm goal={selectedGoal} busy={busy} onSubmit={(body) => perform(() => api.patch(`/goals/${selectedGoal?.id}/contribute`, body), 'Aporte registrado na meta.')} />;
    return null;
  })();

  function openContribution(goal: Goal) { setSelectedGoal(goal); setModal('contribution'); }
  function openExpenseEdit(expense: Expense) { setSelectedExpense(expense); setModal('expenseEdit'); }
  function openInvoiceExpenseEdit(expense: Expense) { setInvoiceToRestore(selectedInvoice); setSelectedInvoice(null); openExpenseEdit(expense); }
  function openAccountEdit(account: Account) { setSelectedAccount(account); setModal('accountEdit'); }
  function openInvestmentEdit(investment: Investment) { setSelectedInvestment(investment); setModal('investmentEdit'); }
  function openInvestmentMovement(investment: Investment, kind: 'contribution' | 'withdrawal') { setSelectedInvestment(investment); setInvestmentMovementKind(kind); setModal('investmentMovement'); }
  function openInvestmentValue(investment: Investment) { setSelectedInvestment(investment); setModal('investmentValue'); }
  function openPay(invoice: Invoice) { setInvoiceToPay(invoice); setSelectedInvoice(null); setModal('pay'); }
  function closeModal() {
    setModal(null); setSelectedExpense(null); setSelectedAccount(null); setSelectedInvestment(null); setInvoiceToPay(null); setError('');
    if (invoiceToRestore) setSelectedInvoice(invoiceToRestore);
    setInvoiceToRestore(null);
  }

  if (loading) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <Sidebar tab={tab} onTab={setTab} />
      <main className="main-content">
        <Topbar onAccounts={() => setTab('accounts')} />
        {tab === 'dashboard' && <DashboardView data={data} onExpense={() => setModal('expense')} onExpenseEdit={openExpenseEdit} onDocument={setSelectedDocument} onPay={openPay} onTab={setTab} />}
        {tab === 'invoices' && <InvoicesView data={data} onExpense={() => setModal('expense')} onInvoiceSelect={setSelectedInvoice} onInvoice={() => setModal('invoice')} onPay={openPay} />}
        {tab === 'investments' && <InvestmentsView data={data} onAdd={() => setModal('investment')} onEdit={openInvestmentEdit} onMovement={openInvestmentMovement} onUpdateValue={openInvestmentValue} />}
        {tab === 'goals' && <GoalsView data={data} onAdd={() => setModal('goal')} onContribution={openContribution} />}
        {tab === 'accounts' && <AccountsView data={data} onAdd={() => setModal('account')} onEdit={openAccountEdit} />}
      </main>
      {error && <div className="global-error" role="alert"><CircleAlert/><span>{error}</span><button onClick={() => setError('')} aria-label="Fechar aviso"><X/></button></div>}
      <MobileNav tab={tab} onTab={setTab} onAdd={() => setModal(tab === 'investments' ? 'investment' : tab === 'goals' ? 'goal' : 'expense')} />
      {modal && <Modal title={modalTitle(modal, investmentMovementKind)} eyebrow={modal.includes('Edit') || modal === 'investmentValue' ? 'AJUSTE DO REGISTRO' : modal === 'investmentMovement' ? 'MOVIMENTAÇÃO' : 'NOVO REGISTRO'} onClose={closeModal}>{modalContent}</Modal>}
      {selectedInvoice && <InvoiceDetails key={selectedInvoice.id} invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onEdit={openInvoiceExpenseEdit} onDocument={setSelectedDocument} onPay={openPay}/>}
      {selectedDocument && <PdfViewer document={selectedDocument} onClose={() => setSelectedDocument(null)} />}
      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
  );
}

function Sidebar({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const items: Array<[Tab, ReactNode, string]> = [
    ['dashboard', <LayoutDashboard />, 'Visão geral'], ['invoices', <ReceiptText />, 'Faturas'],
    ['investments', <TrendingUp />, 'Investimentos'], ['goals', <Target />, 'Metas'],
  ];
  return <aside className="sidebar">
    <button className="brand" onClick={() => onTab('dashboard')} aria-label="Fluxo"><BrandIcon /></button>
    <nav>{items.map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => onTab(id)}>{icon}<span>{label}</span></button>)}</nav>
    <button className="settings" onClick={() => onTab('accounts')} aria-label="Configurar contas"><Settings2 /></button>
  </aside>;
}

function MobileNav({ tab, onTab, onAdd }: { tab: Tab; onTab: (tab: Tab) => void; onAdd: () => void }) {
  const items: Array<[Tab, ReactNode, string]> = [
    ['dashboard', <Home />, 'Início'], ['invoices', <ReceiptText />, 'Faturas'],
    ['investments', <TrendingUp />, 'Investir'], ['goals', <Target />, 'Metas'],
  ];
  return <nav className="mobile-nav">
    {items.slice(0, 2).map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => onTab(id)}>{icon}<span>{label}</span></button>)}
    <button className="mobile-add" onClick={onAdd} aria-label="Adicionar"><Plus /></button>
    {items.slice(2).map(([id, icon, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => onTab(id)}>{icon}<span>{label}</span></button>)}
  </nav>;
}

function Topbar({ onAccounts }: { onAccounts: () => void }) {
  const now = new Date();
  return <header className="topbar">
    <div className="mobile-brand"><BrandIcon /><strong>Fluxo</strong></div>
    <div className="desktop-greeting"><span className="eyebrow">{currentDateLabel(now)}</span><strong>{greeting(now)}</strong></div>
    <div className="top-actions"><button className="accounts-shortcut" onClick={onAccounts}><WalletCards size={17} />Contas</button><button className="avatar" onClick={onAccounts} aria-label="Abrir contas"><User size={18} /></button></div>
  </header>;
}

function DashboardView({ data, onExpense, onExpenseEdit, onDocument, onPay, onTab }: { data: AppData; onExpense: () => void; onExpenseEdit: (expense: Expense) => void; onDocument: (document: NonNullable<Expense['document']>) => void; onPay: (invoice: Invoice) => void; onTab: (tab: Tab) => void }) {
  const invoice = data.dashboard.currentInvoice;
  const usedLimit = invoice ? invoice.outstandingTotal ?? invoice.total : 0;
  const limitAvailable = invoice ? invoice.creditLimit - usedLimit : 0;
  const limitUsage = invoice
    ? invoice.creditLimit > 0 ? Math.min(100, Math.max(0, usedLimit / invoice.creditLimit * 100)) : usedLimit > 0 ? 100 : 0
    : 0;
  const hasNetWorth = data.dashboard.summary.netWorth !== 0;
  return <div className="page dashboard-page">
    <section className="welcome"><span className="eyebrow">SUA VIDA FINANCEIRA</span><h1>{greeting()}</h1><p>Seu dinheiro, com clareza e sem complicação.</p></section>
    <section className="hero-card glass-card">
      <div className="orb one"/><div className="orb two"/>
      <div className="hero-head"><div><span className="card-label">Patrimônio total</span><strong>{money.format(data.dashboard.summary.netWorth)}</strong><small className={hasNetWorth ? '' : 'neutral'}>{hasNetWorth ? <><Check size={14}/>Saldo atualizado</> : <><CircleDollarSign size={14}/>Nenhum valor registrado</>}</small></div><span className={`pro-pill${hasNetWorth ? '' : ' neutral'}`}><Sparkles size={15}/>{hasNetWorth ? 'Tudo em ordem' : 'Sem dados'}</span></div>
      <div className={`hero-chart${hasNetWorth ? '' : ' is-empty'}`} aria-label={hasNetWorth ? 'Resumo visual do patrimônio' : 'Sem histórico de patrimônio'}><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <div className="hero-breakdown"><div><Landmark/><span><small>Em contas</small><strong>{money.format(data.dashboard.summary.accountBalance)}</strong></span></div><div><TrendingUp/><span><small>Investido</small><strong>{money.format(data.dashboard.summary.investments)}</strong></span></div></div>
    </section>

    <div className="section-title"><div><span className="eyebrow">{invoice ? fullMonthName.format(parseUtc(invoice.dueDate)).toUpperCase() : 'FATURA'}</span><h2>Sua fatura</h2></div><button className="round-add" onClick={onExpense} aria-label="Adicionar gasto"><Plus /></button></div>
    {invoice ? <section className="invoice-card glass-card">
      <div className="invoice-main"><div className="invoice-brand"><span className="bank-mark">{accountMark(invoice.accountName)}</span><span><strong>{invoice.accountName}</strong><small>Fatura aberta</small></span></div><span className="open-pill">ABERTA</span></div>
      <div className="invoice-value"><span className="card-label">Fatura atual</span><strong>{money.format(invoice.total)}</strong><small>Vence em {fullDate.format(parseUtc(invoice.dueDate))}</small></div>
      <div className="limit-line"><div><span>Limite disponível</span><strong>{money.format(limitAvailable)}</strong></div><div className="progress"><i style={{ width: `${limitUsage}%` }} /></div></div>
      <div className="invoice-actions"><button className="primary" onClick={onExpense}><Plus size={18}/>Adicionar gasto</button><button className="secondary" onClick={() => onPay(invoice)}>Marcar como paga</button></div>
    </section> : <EmptyCard text="Você ainda não tem uma fatura aberta." action="Criar fatura" onClick={() => onTab('invoices')} />}

    <section className="insight-grid">
      <button className="metric-card glass-card" onClick={() => onTab('investments')}><span className="metric-icon lime"><TrendingUp /></span><span className="card-label">Investimentos</span><strong>{money.format(data.dashboard.summary.investments)}</strong><small className={data.dashboard.summary.investments !== 0 ? 'positive' : ''}>{data.dashboard.summary.investments !== 0 ? <><Check size={13}/>Carteira atualizada</> : <><CircleDollarSign size={13}/>Nenhum investimento</>}</small><ChevronRight className="card-chevron"/></button>
      <button className="metric-card glass-card" onClick={() => onTab('goals')}><span className="metric-icon purple"><GoalIcon /></span><span className="card-label">Guardado em metas</span><strong>{money.format(data.dashboard.summary.goalsSaved)}</strong><small>{data.goals.length > 0 ? 'Progresso atualizado' : 'Nenhuma meta cadastrada'}</small><ChevronRight className="card-chevron"/></button>
    </section>

    <section className="activity-card glass-card"><div className="card-title"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Gastos recentes</h2></div><button onClick={() => onTab('invoices')}>Ver todos</button></div>
      <div className="transactions">{data.dashboard.recentExpenses.map((expense) => <Transaction key={expense.id} expense={expense} onEdit={onExpenseEdit} onDocument={onDocument} />)}</div>
    </section>
  </div>;
}

function Transaction({ expense, onEdit, onDocument }: { expense: Expense; onEdit: (expense: Expense) => void; onDocument: (document: NonNullable<Expense['document']>) => void }) {
  const Icon = categories[expense.category] || CircleDollarSign;
  const installmentLabel = expense.installments > 1 ? expense.remainingInstallments === 0 ? ' • Quitado' : ` • ${expense.currentInstallment}/${expense.installments}` : '';
  return <article className="transaction-row"><button className="transaction" onClick={() => onEdit(expense)} aria-label={`Editar gasto ${expense.description}`}><span className="transaction-icon"><Icon /></span><span className="transaction-info"><strong>{expense.description}</strong><small>{expense.category} • {expense.accountName}{installmentLabel}{expense.document ? ' • PDF guardado' : ''}</small></span><strong className="expense-value">− {money.format(expense.totalAmount)}</strong></button>{expense.document && <DocumentLink pdfDocument={expense.document} onDocument={onDocument}/>}</article>;
}

function InvoicesView({ data, onExpense, onInvoiceSelect, onInvoice, onPay }: { data: AppData; onExpense: () => void; onInvoiceSelect: (invoice: Invoice) => void; onInvoice: () => void; onPay: (invoice: Invoice) => void }) {
  const open = data.invoices.find((invoice) => invoice.status === 'open');
  const maxProjection = Math.max(...data.projections.map((item) => item.total), 1);

  return <div className="page"><PageHeader eyebrow="CONTROLE DO CARTÃO" title="Faturas" text="Cada período reúne somente os gastos lançados naquela fatura." action="Nova fatura" onAction={onInvoice}/>
    {open && <section className="featured-invoice glass-card">
      <button className="featured-invoice-summary" onClick={() => onInvoiceSelect(open)} aria-label={`Ver gastos da fatura de ${invoiceMonth(open)}`}>
        <span className="featured-invoice-head"><span className="bank-mark">{accountMark(open.accountName)}</span><span className="open-pill">FATURA ABERTA</span></span>
        <span className="card-label">{open.accountName} • {fullDate.format(parseUtc(open.startDate))} a {fullDate.format(parseUtc(open.endDate))}</span>
        <strong>{money.format(open.total)}</strong>
        <small>Vencimento {fullDate.format(parseUtc(open.dueDate))} • {expenseCountLabel(open.expenseCount)}</small>
        <span className="invoice-open-call">Ver gastos desta fatura <ChevronRight/></span>
      </button>
      <div className="featured-actions"><button className="primary" onClick={onExpense}><Plus/>Novo gasto</button><button className="secondary" onClick={() => onPay(open)}><Check/>Pagar fatura</button></div>
    </section>}

    <div className="section-title plain"><div><span className="eyebrow">ORGANIZADO POR PERÍODO</span><h2>Suas faturas</h2></div></div>
    <section className="invoice-group-list">{data.invoices.map((invoice) => <button className="invoice-group-card glass-card" key={invoice.id} onClick={() => onInvoiceSelect(invoice)} aria-label={`Ver fatura de ${invoiceMonth(invoice)}`}>
      <span className="invoice-group-date"><small>{parseUtc(invoice.dueDate).getUTCFullYear()}</small><strong>{monthName.format(parseUtc(invoice.dueDate)).replace('.', '')}</strong></span>
      <span className="invoice-group-info"><strong>{invoice.accountName}</strong><small>Vence {fullDate.format(parseUtc(invoice.dueDate))} • {expenseCountLabel(invoice.expenseCount)}</small></span>
      <span className="invoice-group-value"><strong>{money.format(invoice.total)}</strong><small className={`invoice-status ${invoice.status}`}>{invoiceStatusLabel(invoice.status)}</small></span>
      <ChevronRight/>
    </button>)}</section>

    <div className="section-title plain"><div><span className="eyebrow">PREVISIBILIDADE</span><h2>Próximos meses</h2></div></div>
    <section className="projection-card glass-card">{data.projections.map((item, index) => <div className="projection-row" key={item.month}><span className={index === 0 ? 'current' : ''}>{monthName.format(parseUtc(item.month)).replace('.', '')}</span><div><i style={{ width: `${Math.max(8, item.total / maxProjection * 100)}%` }}/></div><strong>{money.format(item.total)}</strong><small>{item.installments} parcelas</small></div>)}</section>
  </div>;
}

function invoiceMonth(invoice: Invoice) {
  const value = fullMonthName.format(parseUtc(invoice.dueDate));
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} de ${parseUtc(invoice.dueDate).getUTCFullYear()}`;
}

function expenseCountLabel(count = 0) { return `${count} ${count === 1 ? 'gasto' : 'gastos'}`; }

function shouldUseNativePdfViewer() {
  return window.matchMedia('(max-width: 767px)').matches || /Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
}

function DocumentLink({ pdfDocument, onDocument }: {
  pdfDocument: NonNullable<Expense['document']>;
  onDocument: (document: NonNullable<Expense['document']>) => void;
}) {
  const pdfUrl = api.fileUrl(`/documents/${pdfDocument.id}/file`);
  return <a
    className="document-link"
    href={pdfUrl}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(event) => {
      if (shouldUseNativePdfViewer()) return;
      event.preventDefault();
      onDocument(pdfDocument);
    }}
    title={pdfDocument.originalName}
    aria-label={`Abrir PDF ${pdfDocument.originalName}`}
  ><Eye/></a>;
}

function invoiceStatusLabel(status: Invoice['status']) {
  return status === 'open' ? 'Aberta' : status === 'paid' ? 'Paga' : status === 'overdue' ? 'Atrasada' : 'Cancelada';
}

function InvoiceDetails({ invoice, onClose, onEdit, onDocument, onPay }: { invoice: Invoice; onClose: () => void; onEdit: (expense: Expense) => void; onDocument: (document: NonNullable<Expense['document']>) => void; onPay: (invoice: Invoice) => void }) {
  const [expenses, setExpenses] = useState<InvoiceExpense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [expenseError, setExpenseError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<InvoiceExpense[]>(`/invoices/${invoice.id}/expenses`)
      .then((items) => { if (active) setExpenses(items); })
      .catch((err) => { if (active) setExpenseError(err instanceof Error ? err.message : 'Não foi possível carregar os gastos.'); })
      .finally(() => { if (active) setLoadingExpenses(false); });
    return () => { active = false; };
  }, [invoice.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.setTimeout(() => { if (!event.defaultPrevented) onClose(); }, 0);
    };
    document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return <div className="invoice-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="invoice-detail-view" role="dialog" aria-modal="true" aria-label={`Fatura de ${invoiceMonth(invoice)}`}>
      <header className="invoice-detail-nav">
        <button onClick={onClose} aria-label="Voltar"><ArrowLeft/><span>Voltar</span></button>
        <div><small>FATURA • {invoice.accountName}</small><h2>{invoiceMonth(invoice)}</h2></div>
        <span className={`invoice-detail-status ${invoice.status}`}>{invoiceStatusLabel(invoice.status)}</span>
      </header>
      <div className="invoice-detail-content">
        <section className="invoice-detail-summary">
          <span className="eyebrow">TOTAL DA FATURA</span>
          <strong>{money.format(invoice.total)}</strong>
          <div className="invoice-detail-meta"><span><small>Período</small><strong>{shortDate.format(parseUtc(invoice.startDate))} — {shortDate.format(parseUtc(invoice.endDate))}</strong></span><span><small>Vencimento</small><strong>{fullDate.format(parseUtc(invoice.dueDate))}</strong></span></div>
          {invoice.status === 'open' && <button className="primary invoice-detail-pay" onClick={() => onPay(invoice)}><Check/>Pagar fatura</button>}
        </section>
        <section className="invoice-expense-panel">
          <header className="invoice-detail-title"><div><span className="eyebrow">GASTOS ATRELADOS</span><h3>{loadingExpenses ? 'Carregando…' : expenseCountLabel(expenses.length)}</h3></div><strong>{money.format(invoice.total)}</strong></header>
          {expenseError && <div className="error-banner"><span>{expenseError}</span></div>}
          {!loadingExpenses && !expenseError && expenses.length === 0 && <div className="invoice-expenses-empty"><ReceiptText/><strong>Nenhum gasto nesta fatura</strong><small>Os lançamentos deste período aparecerão aqui.</small></div>}
          {!loadingExpenses && !expenseError && expenses.length > 0 && <div className="invoice-expense-list">{expenses.map((expense) => {
            const Icon = categories[expense.category] || CircleDollarSign;
            const content = <><span className="transaction-icon"><Icon/></span><span className="transaction-info"><strong>{expense.description}</strong><small>{expense.category} • {shortDate.format(parseUtc(expense.purchaseDate))}{expense.installments > 1 ? ` • ${expense.invoiceInstallment}/${expense.installments}` : ''}</small></span><strong className="invoice-expense-value">− {money.format(expense.invoiceAmount)}</strong></>;
            return <article className="invoice-expense-row" key={`${expense.id}-${expense.invoiceInstallment}`}>
              {invoice.status === 'open' ? <button className="invoice-expense-main" onClick={() => onEdit(expense)} aria-label={`Editar gasto ${expense.description}`}>{content}</button> : <div className="invoice-expense-main">{content}</div>}
              {expense.document && <DocumentLink pdfDocument={expense.document} onDocument={onDocument}/>}
            </article>;
          })}</div>}
        </section>
      </div>
    </section>
  </div>;
}

function PdfViewer({ document: pdfDocument, onClose }: { document: NonNullable<Expense['document']>; onClose: () => void }) {
  const pdfUrl = api.fileUrl(`/documents/${pdfDocument.id}/file`);
  const downloadUrl = api.fileUrl(`/documents/${pdfDocument.id}/file?download=1`);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    const bodyWasLocked = document.body.classList.contains('modal-open');
    if (!bodyWasLocked) document.body.classList.add('modal-open');
    window.addEventListener('keydown', onKey);
    return () => {
      if (!bodyWasLocked) document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return <section className="pdf-viewer" role="dialog" aria-modal="true" aria-label={`PDF ${pdfDocument.originalName}`}>
    <header>
      <button onClick={onClose} aria-label="Voltar"><ArrowLeft/><span>Voltar</span></button>
      <div><small>DOCUMENTO ANEXADO</small><strong>{pdfDocument.originalName}</strong></div>
      <nav aria-label="Ações do PDF">
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer"><ExternalLink/><span>Abrir</span></a>
        <a href={downloadUrl} download={pdfDocument.originalName}><Download/><span>Baixar</span></a>
      </nav>
    </header>
    <iframe src={pdfUrl} title={pdfDocument.originalName}/>
  </section>;
}

function InvestmentsView({ data, onAdd, onEdit, onMovement, onUpdateValue }: {
  data: AppData;
  onAdd: () => void;
  onEdit: (investment: Investment) => void;
  onMovement: (investment: Investment, kind: 'contribution' | 'withdrawal') => void;
  onUpdateValue: (investment: Investment) => void;
}) {
  const invested = data.investments.reduce((sum, item) => sum + item.investedAmount, 0);
  const current = data.investments.reduce((sum, item) => sum + item.currentAmount, 0);
  const result = current - invested;
  const resultPercent = invested > 0 ? result / invested * 100 : 0;
  const chartPercent = Math.min(100, Math.abs(resultPercent));
  const chartStatus = result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral';
  return <div className="page"><PageHeader eyebrow="SEU PATRIMÔNIO" title="Investimentos" text="Veja quanto seu dinheiro já trabalhou por você." action="Adicionar" onAction={onAdd}/>
    <section className="investment-hero glass-card"><div><span className="card-label">Valor atual da carteira</span><strong>{money.format(current)}</strong><small className={chartStatus}>{result >= 0 ? <ArrowUpRight/> : <ArrowDownRight/>} {result >= 0 ? '+' : ''}{money.format(result)} ({resultPercent >= 0 ? '+' : ''}{resultPercent.toFixed(2)}%)</small></div><div className={`donut ${chartStatus}`} style={{ '--value': `${chartPercent * 3.6}deg` } as React.CSSProperties} role="img" aria-label={`Rentabilidade da carteira: ${resultPercent.toFixed(2)}%`}><span><strong>{resultPercent > 0 ? '+' : ''}{resultPercent.toFixed(1).replace('.', ',')}%</strong><small>retorno</small></span></div></section>
    <div className="section-title plain"><div><span className="eyebrow">CARTEIRA</span><h2>Seus ativos</h2></div></div>
    <section className="asset-list">{data.investments.map((item) => {
      const gain = item.currentAmount - item.investedAmount;
      const gainPercent = item.investedAmount > 0 ? gain / item.investedAmount * 100 : 0;
      return <article className="asset-card glass-card" key={item.id}>
        <span className="metric-icon lime"><BarChart3/></span>
        <div className="asset-info"><strong>{item.name}</strong><small>{item.type} • aplicado {money.format(item.investedAmount)}</small></div>
        <span className="asset-values"><strong>{money.format(item.currentAmount)}</strong><small className={gain >= 0 ? 'positive' : 'negative'}>{gain >= 0 ? '+' : ''}{money.format(gain)} • {gainPercent >= 0 ? '+' : ''}{gainPercent.toFixed(2)}%</small></span>
        <div className="asset-actions">
          <button onClick={() => onMovement(item, 'contribution')}><Plus/>Aportar</button>
          <button onClick={() => onMovement(item, 'withdrawal')} disabled={item.currentAmount <= 0}><Minus/>Retirar</button>
          <button onClick={() => onUpdateValue(item)}><RefreshCw/>Atualizar valor</button>
          <button onClick={() => onEdit(item)}><Pencil/>Editar</button>
        </div>
      </article>;
    })}</section>
  </div>;
}

function GoalsView({ data, onAdd, onContribution }: { data: AppData; onAdd: () => void; onContribution: (goal: Goal) => void }) {
  return <div className="page"><PageHeader eyebrow="PLANOS QUE GANHAM FORMA" title="Metas" text="Transforme intenção em progresso visível." action="Nova meta" onAction={onAdd}/>
    <section className="goals-grid">{data.goals.map((goal) => { const progress = Math.min(100, goal.currentAmount / goal.targetAmount * 100); return <article className="goal-card glass-card" key={goal.id}><div className="goal-head"><span className="goal-icon" style={{ background: `${goal.color}22`, color: goal.color }}><Target/></span><span>{Math.round(progress)}%</span></div><h3>{goal.name}</h3><p><strong>{money.format(goal.currentAmount)}</strong> de {money.format(goal.targetAmount)}</p><div className="progress"><i style={{ width: `${progress}%`, background: goal.color }}/></div><div className="goal-footer"><small>{goal.deadline ? `Até ${fullDate.format(parseUtc(goal.deadline))}` : 'Sem prazo definido'}</small><button onClick={() => onContribution(goal)}><Plus/>Aportar</button></div></article>; })}</section>
  </div>;
}

function AccountsView({ data, onAdd, onEdit }: { data: AppData; onAdd: () => void; onEdit: (account: Account) => void }) {
  return <div className="page"><PageHeader eyebrow="SUAS CONEXÕES" title="Contas" text="Cadastre bancos e cartões para organizar cada fatura." action="Adicionar conta" onAction={onAdd}/>
    <section className="account-list">{data.accounts.map((account) => <button className="account-card glass-card" key={account.id} onClick={() => onEdit(account)} aria-label={`Editar conta ${account.name}`}><span className="bank-mark" style={{ background: account.color }}>{accountMark(account.name)}</span><span className="account-info"><strong>{account.name}</strong><small>{account.kind === 'credit' ? 'Cartão de crédito' : 'Conta bancária'}</small></span><span className="account-values"><strong>{money.format(account.balance)}</strong><small>{account.kind === 'credit' ? `Limite ${money.format(account.creditLimit)}` : 'Saldo disponível'}</small></span></button>)}</section>
  </div>;
}

function PageHeader({ eyebrow, title, text, action, onAction }: { eyebrow: string; title: string; text: string; action: string; onAction: () => void }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div><button className="primary compact" onClick={onAction}><Plus/>{action}</button></header>;
}

function EmptyCard({ text, action, onClick }: { text: string; action: string; onClick: () => void }) { return <div className="empty-card glass-card"><ReceiptText/><p>{text}</p><button className="primary" onClick={onClick}>{action}</button></div>; }

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const syncViewport = () => {
      root.style.setProperty('--visual-viewport-height', `${viewport?.height || window.innerHeight}px`);
      root.style.setProperty('--visual-viewport-top', `${viewport?.offsetTop || 0}px`);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.setTimeout(() => { if (!event.defaultPrevented) onClose(); }, 0);
    };
    document.body.classList.add('modal-open');
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      root.style.removeProperty('--visual-viewport-height');
      root.style.removeProperty('--visual-viewport-top');
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-handle"/><header><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button onClick={onClose} aria-label="Fechar"><X/></button></header>{children}</section></div>;
}

type SubmitProps<T> = { busy: boolean; onSubmit: (body: T) => void };
function formData(event: FormEvent<HTMLFormElement>) { event.preventDefault(); return Object.fromEntries(new FormData(event.currentTarget)); }
function FormActions({ busy, label = 'Salvar', busyLabel = 'Salvando…' }: { busy: boolean; label?: string; busyLabel?: string }) { return <button className="primary form-submit" disabled={busy}>{busy ? busyLabel : label}</button>; }

function ExpenseForm({ accounts, invoices, busy, onSubmit, initialExpense }: { busy: boolean; accounts: Account[]; invoices: Invoice[]; initialExpense?: Expense; onSubmit: (body: Record<string, unknown>, pdfFile?: File) => void }) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ description: string | null; totalAmount: number | null; confidence: string; method: 'native' | 'ocr' } | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [description, setDescription] = useState(initialExpense?.description || '');
  const [totalAmount, setTotalAmount] = useState(initialExpense ? String(initialExpense.totalAmount) : '');
  const analysisAttempt = useRef(0);
  const validAccounts = accounts.filter((account) => invoices.some((invoice) => invoice.accountId === account.id && invoice.status === 'open'));

  async function analyzeFile(file: File, password = '') {
    const attempt = ++analysisAttempt.current;
    setOcrBusy(true); setPasswordError('');
    try {
      const result = await api.uploadPdf<{ description: string | null; totalAmount: number | null; confidence: string; method: 'native' | 'ocr' }>('/expenses/pdf/analyze', {}, file, password);
      if (attempt !== analysisAttempt.current) return;
      setOcrResult(result); setPasswordPrompt(false); setPasswordRequired(false); setOcrError('');
      if (result.description) setDescription(result.description);
      if (result.totalAmount) setTotalAmount(result.totalAmount.toFixed(2));
    } catch (err) {
      if (attempt !== analysisAttempt.current) return;
      if (err instanceof ApiError && err.status === 423) {
        setPasswordRequired(true); setPasswordPrompt(true); setPasswordError(password ? err.message : ''); setOcrError('');
      } else if (err instanceof ApiError && (err.status === 400 || err.status === 413)) {
        setPdfFile(null); setPdfError(err.message); setOcrError(''); setPasswordPrompt(false); setPasswordRequired(false);
      } else {
        setOcrError(err instanceof Error ? err.message : 'Não foi possível ler este PDF automaticamente.');
        setPasswordPrompt(false);
      }
    } finally {
      if (attempt === analysisAttempt.current) setOcrBusy(false);
    }
  }

  async function selectPdf(file?: File) {
    analysisAttempt.current += 1;
    setOcrResult(null); setOcrError(''); setPasswordPrompt(false); setPasswordRequired(false); setPasswordError('');
    if (!file) { setPdfFile(null); setPdfError(''); setOcrBusy(false); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfFile(null); setPdfError('Escolha um arquivo no formato PDF.'); setOcrBusy(false); return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setPdfFile(null); setPdfError('O PDF deve ter no máximo 15 MB.'); setOcrBusy(false); return;
    }
    setPdfFile(file); setPdfError('');
    await analyzeFile(file);
  }

  function cancelPassword() {
    analysisAttempt.current += 1;
    setPasswordPrompt(false); setPasswordError(''); setOcrBusy(false);
    setOcrError('Leitura automática cancelada para este PDF protegido.');
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    const values = formData(event);
    if (ocrResult) {
      values.ocrProcessed = 'true';
      values.ocrDescription = ocrResult.description || '';
      values.ocrAmount = ocrResult.totalAmount === null ? '' : String(ocrResult.totalAmount);
    }
    onSubmit(values, pdfFile || undefined);
  }

  const fileStatus = ocrBusy
    ? 'Lendo texto e procurando o valor…'
    : ocrResult
      ? `${ocrResult.method === 'native' ? 'Texto do PDF' : 'OCR local'} concluído • confira os campos`
      : pdfFile
        ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB • preenchimento manual disponível`
        : 'Toque para escolher • máximo de 15 MB';

  return <><form className="form-grid" onSubmit={submit}><label className="span-2">Descrição<input name="description" placeholder="Ex.: Conta de energia" value={description} onChange={(event) => setDescription(event.target.value)} required/></label><label>Valor total<input name="totalAmount" type="number" step="0.01" min="0.01" placeholder="0,00" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} required/></label><label>Parcelas<select name="installments" defaultValue={initialExpense?.installments || 1}>{Array.from({ length: 24 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}x</option>)}</select></label><label>Categoria<select name="category" defaultValue={initialExpense?.category || 'Alimentação'}><option>Alimentação</option><option>Restaurante</option><option>Assinaturas</option><option>Transporte</option><option>Casa</option><option>Lazer</option><option>Trabalho</option><option>Outros</option></select></label><label>Conta<select name="accountId" defaultValue={initialExpense?.accountId} required>{validAccounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label className="span-2">Data da compra<input name="purchaseDate" type="date" defaultValue={initialExpense ? iso(initialExpense.purchaseDate) : todayInputDate()} required/></label>{!initialExpense && <><label className={`pdf-upload span-2${pdfFile ? ' has-file' : ''}${ocrBusy ? ' is-reading' : ''}`}><input type="file" accept="application/pdf,.pdf" onChange={(event) => selectPdf(event.target.files?.[0])}/><FileUp/><span><strong>{pdfFile ? pdfFile.name : 'Anexar conta em PDF'}</strong><small>{fileStatus}</small></span></label>{pdfError && <p className="form-error span-2">{pdfError}</p>}{ocrError && <div className="ocr-warning span-2"><Sparkles/><span>{ocrError} Você ainda pode preencher e salvar manualmente.</span>{passwordRequired && <button type="button" onClick={() => setPasswordPrompt(true)}>Informar senha</button>}</div>}{ocrResult && <p className="ocr-hint success span-2"><Check/>Dados encontrados localmente, sem enviar o PDF a serviços externos. Confira descrição e valor antes de adicionar.</p>}{!pdfFile && <p className="ocr-hint span-2"><Sparkles/>Ao escolher um PDF, tentaremos preencher descrição e valor automaticamente usando leitura local.</p>}</>}{validAccounts.length === 0 ? <p className="form-hint span-2">Crie uma fatura aberta antes de lançar o primeiro gasto.</p> : <p className="form-hint span-2">O valor será lançado na fatura aberta da conta selecionada.</p>}<div className="span-2"><FormActions busy={busy || ocrBusy || validAccounts.length === 0 || Boolean(pdfError)} busyLabel={pdfError ? 'Escolha outro PDF' : ocrBusy ? 'Lendo PDF…' : 'Salvando…'} label={initialExpense ? 'Salvar alterações' : pdfFile ? 'Guardar PDF e adicionar' : 'Adicionar à fatura'}/></div></form>{passwordPrompt && pdfFile && <PdfPasswordModal fileName={pdfFile.name} fileSize={pdfFile.size} busy={ocrBusy} error={passwordError} onCancel={cancelPassword} onSubmit={(password) => analyzeFile(pdfFile, password)}/>}</>;
}

function PdfPasswordModal({ fileName, fileSize, busy, error, onCancel, onSubmit }: { fileName: string; fileSize: number; busy: boolean; error: string; onCancel: () => void; onSubmit: (password: string) => void }) {
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [editedSinceError, setEditedSinceError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorVisible = Boolean(error) && !editedSinceError;

  useEffect(() => {
    if (error) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [error]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onCancel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const formattedSize = fileSize >= 1024 * 1024
    ? `${(fileSize / 1024 / 1024).toFixed(2)} MB`
    : `${Math.max(1, Math.round(fileSize / 1024))} KB`;

  return <div className="pdf-password-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
    <section className="pdf-password-modal" role="dialog" aria-modal="true" aria-labelledby="pdf-password-title" aria-describedby="pdf-password-description">
      <header>
        <span className="pdf-password-lock"><LockKeyhole/></span>
        <div><small>DOCUMENTO PROTEGIDO</small><h3 id="pdf-password-title">Desbloquear PDF</h3></div>
        <button type="button" onClick={onCancel} disabled={busy} aria-label="Fechar"><X/></button>
      </header>
      <p id="pdf-password-description">Digite a senha fornecida pelo emissor para abrir e ler os dados deste documento.</p>
      <div className="pdf-password-file">
        <span><FileText/></span>
        <div><strong title={fileName}>{fileName}</strong><small>{formattedSize} • PDF protegido</small></div>
        <b>PDF</b>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); setEditedSinceError(false); onSubmit(password); }}>
        <label htmlFor="pdf-password-input">Senha do PDF</label>
        <div className={`pdf-password-field${errorVisible ? ' has-error' : ''}`}>
          <input
            ref={inputRef}
            id="pdf-password-input"
            type={passwordVisible ? 'text' : 'password'}
            value={password}
            onChange={(event) => { setPassword(event.target.value); setEditedSinceError(true); }}
            placeholder="Digite a senha"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errorVisible}
            aria-describedby={errorVisible ? 'pdf-password-error pdf-password-privacy' : 'pdf-password-privacy'}
            disabled={busy}
            autoFocus
            required
          />
          <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} disabled={busy} aria-label={passwordVisible ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={passwordVisible}>
            {passwordVisible ? <EyeOff/> : <Eye/>}
          </button>
        </div>
        {errorVisible && <p id="pdf-password-error" className="password-error" role="alert"><CircleAlert/><span>{error}</span></p>}
        <p id="pdf-password-privacy" className="password-privacy"><ShieldCheck/><span><strong>Sua senha permanece privada.</strong> Ela será usada somente nesta leitura e nunca será armazenada.</span></p>
        <div className="pdf-password-actions">
          <button className="secondary" type="button" onClick={onCancel} disabled={busy}>Continuar sem leitura</button>
          <button className="primary" disabled={busy || !password}>{busy ? <><LoaderCircle className="spin"/>Verificando…</> : <><LockKeyhole/>Abrir e ler PDF</>}</button>
        </div>
      </form>
    </section>
  </div>;
}

function AccountForm({ busy, onSubmit, initialAccount }: { busy: boolean; onSubmit: (account: Record<string, unknown>, invoice: Record<string, unknown> | null) => void; initialAccount?: Account }) {
  const today = new Date(); const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)); const end = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 0)); const due = new Date(Date.UTC(today.getFullYear(), today.getMonth() + 1, 10));
  return <form className="form-grid" onSubmit={(event) => { const values = formData(event); const account = { name: values.name, kind: values.kind, balance: values.balance, creditLimit: values.creditLimit, color: values.color }; const invoice = !initialAccount && values.createInvoice ? { startDate: values.startDate, endDate: values.endDate, dueDate: values.dueDate } : null; onSubmit(account, invoice); }}><label className="span-2">Nome da conta<input name="name" placeholder="Ex.: C6 Bank" defaultValue={initialAccount?.name} required/></label><label>Tipo<select name="kind" defaultValue={initialAccount?.kind || 'credit'}><option value="credit">Cartão de crédito</option><option value="bank">Conta bancária</option></select></label><label>Cor<input name="color" type="color" defaultValue={initialAccount?.color || '#b7ff34'}/></label><label>Saldo atual<input name="balance" type="number" step="0.01" defaultValue={initialAccount?.balance || 0}/></label><label>Limite do cartão<input name="creditLimit" type="number" step="0.01" min="0" defaultValue={initialAccount?.creditLimit || 0}/></label>{!initialAccount && <><label className="check-row span-2"><input name="createInvoice" type="checkbox" defaultChecked/>Criar a primeira fatura agora</label><label>Início<input name="startDate" type="date" defaultValue={toInputDate(start)} required/></label><label>Fim<input name="endDate" type="date" defaultValue={toInputDate(end)} required/></label><label className="span-2">Vencimento<input name="dueDate" type="date" defaultValue={toInputDate(due)} required/></label></>}<div className="span-2"><FormActions busy={busy} label={initialAccount ? 'Salvar alterações' : 'Adicionar conta'}/></div></form>;
}

function InvoiceForm({ accounts, invoices, busy, onSubmit }: SubmitProps<Record<string, unknown>> & { accounts: Account[]; invoices: Invoice[] }) {
  const available = accounts.filter((account) => !invoices.some((invoice) => invoice.accountId === account.id && invoice.status === 'open'));
  const now = new Date(); const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)); const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return <form className="form-grid" onSubmit={(event) => onSubmit(formData(event))}><label className="span-2">Conta<select name="accountId" required>{available.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label><label>Início<input name="startDate" type="date" defaultValue={toInputDate(start)} required/></label><label>Fim<input name="endDate" type="date" defaultValue={toInputDate(end)} required/></label><label className="span-2">Vencimento<input name="dueDate" type="date" defaultValue={toInputDate(new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 10)))} required/></label>{available.length === 0 && <p className="form-hint span-2">Todas as contas já possuem uma fatura aberta.</p>}<div className="span-2"><FormActions busy={busy || available.length === 0} label="Abrir fatura"/></div></form>;
}

function PayInvoiceForm({ invoice, busy, onSubmit }: SubmitProps<Record<string, unknown>> & { invoice: Invoice | null }) {
  if (!invoice) return <p>Não há fatura aberta.</p>;
  const start = addDays(iso(invoice.endDate), 1); const end = addMonths(iso(invoice.endDate), 1); const due = addMonths(iso(invoice.dueDate), 1);
  return <form className="form-grid" onSubmit={(event) => onSubmit(formData(event))}><div className="payment-summary span-2"><span><Check/></span><div><small>Fatura que será paga</small><strong>{money.format(invoice.total)}</strong><small>{invoice.accountName}</small></div></div><p className="form-hint span-2">Ao confirmar, a próxima fatura será aberta e receberá automaticamente as parcelas previstas para o período.</p><label>Próximo início<input name="startDate" type="date" defaultValue={start} min={start} required/></label><label>Próximo fim<input name="endDate" type="date" defaultValue={end} required/></label><label className="span-2">Próximo vencimento<input name="dueDate" type="date" defaultValue={due} required/></label><div className="span-2"><FormActions busy={busy} label="Pagar e abrir próxima"/></div></form>;
}

function InvestmentForm({ busy, onSubmit, investment }: SubmitProps<Record<string, unknown>> & { investment?: Investment }) {
  return <form className="form-grid" onSubmit={(event) => onSubmit(formData(event))}>
    <label className="span-2">Nome<input name="name" placeholder="Ex.: Tesouro Selic" defaultValue={investment?.name} required autoFocus/></label>
    <label className="span-2">Tipo<select name="type" defaultValue={investment?.type || 'Renda fixa'}><option>Renda fixa</option><option>Renda variável</option><option>Fundo</option><option>Criptoativo</option><option>Previdência</option><option>Outro</option></select></label>
    {!investment && <><label>Valor aplicado<input name="investedAmount" type="number" step="0.01" min="0" placeholder="0,00" required/></label><label>Valor atual<input name="currentAmount" type="number" step="0.01" min="0" placeholder="0,00" required/></label></>}
    {investment && <p className="form-hint span-2">Para manter a rentabilidade correta, altere os valores pelos botões Aportar, Retirar ou Atualizar valor.</p>}
    <div className="span-2"><FormActions busy={busy} label={investment ? 'Salvar alterações' : 'Adicionar investimento'}/></div>
  </form>;
}

function InvestmentMovementForm({ investment, kind, busy, onSubmit }: SubmitProps<Record<string, unknown>> & { investment: Investment; kind: 'contribution' | 'withdrawal' }) {
  const isWithdrawal = kind === 'withdrawal';
  return <form className="form-grid" onSubmit={(event) => onSubmit(formData(event))}>
    <div className="payment-summary span-2"><span>{isWithdrawal ? <Minus/> : <Plus/>}</span><div><small>{isWithdrawal ? 'Retirada de' : 'Aporte em'}</small><strong>{investment.name}</strong><small>Valor atual: {money.format(investment.currentAmount)}</small></div></div>
    <input name="kind" type="hidden" value={kind}/>
    <label className="span-2">{isWithdrawal ? 'Valor da retirada' : 'Valor do aporte'}<input name="amount" type="number" step="0.01" min="0.01" max={isWithdrawal ? investment.currentAmount : undefined} placeholder="0,00" required autoFocus/></label>
    <p className="form-hint span-2">{isWithdrawal ? 'A retirada reduz o valor atual e o custo aplicado proporcionalmente, mantendo correta a rentabilidade do saldo restante.' : 'O aporte aumenta o valor aplicado e o valor atual pelo mesmo montante.'}</p>
    <div className="span-2"><FormActions busy={busy} label={isWithdrawal ? 'Registrar retirada' : 'Registrar aporte'}/></div>
  </form>;
}

function InvestmentValueForm({ investment, busy, onSubmit }: SubmitProps<Record<string, unknown>> & { investment: Investment }) {
  const [value, setValue] = useState(String(investment.currentAmount));
  const currentAmount = Number(value);
  const gain = Number.isFinite(currentAmount) ? currentAmount - investment.investedAmount : 0;
  const percentage = investment.investedAmount > 0 ? gain / investment.investedAmount * 100 : 0;
  return <form className="form-grid" onSubmit={(event) => onSubmit(formData(event))}>
    <div className="payment-summary span-2"><span><RefreshCw/></span><div><small>Novo valor de mercado</small><strong>{investment.name}</strong><small>Aplicado: {money.format(investment.investedAmount)}</small></div></div>
    <label className="span-2">Valor atual<input name="currentAmount" type="number" step="0.01" min="0" value={value} onChange={(event) => setValue(event.target.value)} required autoFocus/></label>
    <p className={`valuation-preview span-2 ${gain >= 0 ? 'positive' : 'negative'}`}><span>Rentabilidade calculada</span><strong>{gain >= 0 ? '+' : ''}{money.format(gain)} ({percentage >= 0 ? '+' : ''}{percentage.toFixed(2)}%)</strong></p>
    <p className="form-hint span-2">Informe o saldo atualizado do ativo. A rentabilidade é calculada automaticamente sobre o capital aplicado.</p>
    <div className="span-2"><FormActions busy={busy} label="Atualizar valor"/></div>
  </form>;
}

function GoalForm({ busy, onSubmit }: SubmitProps<Record<string, unknown>>) { return <form className="form-grid" onSubmit={(event) => onSubmit(formData(event))}><label className="span-2">Nome da meta<input name="name" placeholder="Ex.: Viagem para o Japão" required autoFocus/></label><label>Valor objetivo<input name="targetAmount" type="number" step="0.01" min="0.01" required/></label><label>Já guardado<input name="currentAmount" type="number" step="0.01" min="0" defaultValue="0"/></label><label>Prazo<input name="deadline" type="date"/></label><label>Cor<input name="color" type="color" defaultValue="#b7ff34"/></label><div className="span-2"><FormActions busy={busy} label="Criar meta"/></div></form>; }

function ContributionForm({ goal, busy, onSubmit }: SubmitProps<Record<string, unknown>> & { goal: Goal | null }) { return <form className="form-grid" onSubmit={(event) => onSubmit(formData(event))}><div className="payment-summary span-2"><span><Target/></span><div><small>Você está mais perto de</small><strong>{goal?.name}</strong><small>Faltam {money.format(Math.max(0, (goal?.targetAmount || 0) - (goal?.currentAmount || 0)))}</small></div></div><label className="span-2">Valor do aporte<input name="amount" type="number" step="0.01" min="0.01" placeholder="0,00" required/></label><div className="span-2"><FormActions busy={busy} label="Registrar aporte"/></div></form>; }

function modalTitle(modal: ModalKind, movementKind: 'contribution' | 'withdrawal') { return ({ expense: 'Adicionar gasto', expenseEdit: 'Editar gasto', account: 'Adicionar conta', accountEdit: 'Editar conta', invoice: 'Abrir fatura', pay: 'Pagar fatura', investment: 'Adicionar investimento', investmentEdit: 'Editar investimento', investmentMovement: movementKind === 'contribution' ? 'Fazer aporte' : 'Fazer retirada', investmentValue: 'Atualizar valor atual', goal: 'Criar meta', contribution: 'Aportar na meta' } as Record<string, string>)[modal || ''] || ''; }

function BrandIcon() { return <img className="brand-icon" src="/favicon.svg" alt="" aria-hidden="true" />; }

function LoadingScreen() { return <div className="loading-screen"><div className="loading-mark"><BrandIcon /></div><strong>Organizando suas finanças…</strong></div>; }
