import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react'
import './App.css'

async function apiRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload
}

const categories = [
  { name: 'Hardware & devices', icon: '▦', color: 'blue' },
  { name: 'Software & apps', icon: '◈', color: 'purple' },
  { name: 'Network & access', icon: '⌁', color: 'orange' },
  { name: 'Accounts & security', icon: '◇', color: 'green' },
]

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All articles')
  const [articles, setArticles] = useState([])
  const [tickets, setTickets] = useState([])
  const [supportTickets, setSupportTickets] = useState([])
  const [showTicket, setShowTicket] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)
  const searchInputRef = useRef(null)

  useEffect(() => {
    apiRequest('/api/auth/me')
      .then(({ user }) => { setCurrentUser(user); setActiveNav(user.role === 'agent' ? 'Support dashboard' : 'Overview'); setIsAuthenticated(true) })
      .catch(() => setIsAuthenticated(false))
  }, [])

  useEffect(() => {
    if (isAuthenticated !== true || !currentUser) return
    let active = true
    const loadData = async () => {
      const [articleData, ticketData] = await Promise.all([apiRequest('/api/articles'), apiRequest('/api/tickets')])
      if (!active) return
      setArticles(articleData.articles)
      setTickets(ticketData.tickets)
      if (currentUser.role === 'agent') {
        const { tickets: agentRecords } = await apiRequest('/api/agent/tickets')
        if (active) setSupportTickets(agentRecords)
      }
    }
    loadData().catch((error) => showToast(error.message || 'Could not load FixDesk data.'))

    const refreshInterval = window.setInterval(() => {
      apiRequest('/api/articles').then(({ articles: latestArticles }) => { if (active) setArticles(latestArticles) }).catch(() => {})
      apiRequest('/api/tickets').then(({ tickets: latestTickets }) => { if (active) setTickets(latestTickets) }).catch(() => {})
      if (currentUser.role === 'agent') {
        apiRequest('/api/agent/tickets').then(({ tickets: latestTickets }) => { if (active) setSupportTickets(latestTickets) }).catch(() => {})
      }
    }, 12000)

    return () => { active = false; window.clearInterval(refreshInterval) }
  }, [isAuthenticated, currentUser])

  useEffect(() => {
    function focusSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  function showToast(message, action = null) {
    setToast({ message, action })
    window.setTimeout(() => setToast(null), 3200)
  }

  function openTicket(ticketId, ticketOverride = null) {
    const ticket = ticketOverride || tickets.find((item) => item.id === ticketId) || supportTickets.find((item) => item.id === ticketId)
    if (!ticket) {
      showToast(`Ticket ${ticketId} could not be found`)
      return
    }
    setSelectedTicket(ticket)
    setSelectedArticle(null)
    setShowNotifications(false)
    setActiveNav(currentUser?.role === 'agent' ? 'Support dashboard' : 'My tickets')
  }

  function openArticle(articleTitle) {
    const article = articles.find((item) => item.title === articleTitle)
    if (!article) {
      showToast('This knowledge article could not be found')
      return
    }
    setSelectedArticle(article)
    setSelectedTicket(null)
    setShowNotifications(false)
    setActiveNav('Knowledge base')
  }

  function navigateTo(label) {
    setActiveNav(label)
    setMobileNav(false)
    setShowNotifications(false)
  }

  function submitKnowledgeSearch(event) {
    event.preventDefault()
    setCategory('All articles')
    navigateTo('Knowledge base')
  }

  async function completeLogin(event, expectedRole = 'employee') {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const result = await apiRequest('/api/auth/login', { method: 'POST', body: { email: data.get('email'), password: data.get('password') } })
    if (expectedRole === 'agent' && result.user.role !== 'agent') {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      throw new Error('This account does not have support agent access.')
    }
    setCurrentUser(result.user)
    setActiveNav(result.user.role === 'agent' ? 'Support dashboard' : 'Overview')
    setIsAuthenticated(true)
    return { success: true }
  }

  async function createAccount(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') || '')
    const confirmation = String(data.get('confirmPassword') || '')
    if (password !== confirmation) return { error: 'The passwords do not match.' }
    const result = await apiRequest('/api/auth/register', { method: 'POST', body: { name: data.get('name'), email: data.get('email'), password } })
    setCurrentUser(result.user)
    setIsAuthenticated(true)
    return { success: true }
  }

  async function createTicket(event) {
    event.preventDefault()
    if (currentUser?.role === 'agent') return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const title = String(form.get('title') || '').trim()
    const description = String(form.get('description') || '').trim()
    if (!title || !description) {
      showToast('Add a title and description before submitting.')
      return
    }
    try {
      const { ticket: newTicket } = await apiRequest('/api/tickets', { method: 'POST', body: {
        title,
        description,
        category: form.get('category'),
        priority: form.get('priority'),
      } })
      setTickets((current) => [newTicket, ...current])
      setShowTicket(false)
      showToast('Ticket created. Our team will be in touch shortly.', {
        label: 'View ticket',
        onClick: () => openTicket(newTicket.id, newTicket),
      })
      formElement.reset()
    } catch (error) {
      showToast(error.message || 'Ticket could not be created.')
    }
  }

  async function createArticle(event) {
    event.preventDefault()
    if (currentUser?.role !== 'agent') return false
    const data = new FormData(event.currentTarget)
    try {
      const { article } = await apiRequest('/api/articles', { method: 'POST', body: {
        title: data.get('title'),
        category: data.get('category'),
        answer: data.get('answer'),
      } })
      setArticles((current) => [article, ...current.filter((item) => item.title !== article.title)])
      showToast('Knowledge Base article published for all users.')
      return true
    } catch (error) {
      showToast(error.message || 'Knowledge Base article could not be published.')
      return false
    }
  }

  async function updateTicketStatus(ticketId, status, resolutionNote = '') {
    try {
      const { ticket } = await apiRequest(`/api/agent/tickets/${encodeURIComponent(ticketId)}`, { method: 'PATCH', body: { status, resolutionNote } })
      setSupportTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, ...ticket } : item))
      setTickets((current) => current.map((item) => item.id === ticket.id ? { ...item, ...ticket } : item))
      setSelectedTicket((current) => current?.id === ticket.id ? { ...current, ...ticket } : current)
      showToast(status === 'Resolved' ? 'Ticket marked as solved. The requester will see the update.' : `Ticket status changed to ${status}.`)
    } catch (error) {
      showToast(error.message || 'Ticket status could not be updated.')
    }
  }

  if (!isAuthenticated) return <LoginPage onLogin={completeLogin} onCreateAccount={createAccount} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><LifeBuoy size={20} strokeWidth={2.5} /></div>
          <span>Fix<span>Desk</span></span>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <button className="workspace-switcher" onClick={() => navigateTo('Settings')}>
          <div className="workspace-avatar">F</div>
          <div><strong>FixDesk Support</strong><small>{currentUser.role === 'agent' ? 'Support team workspace' : 'Employee workspace'}</small></div>
          <ChevronDown size={15} />
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {currentUser.role === 'agent' ? <>
            <p className="nav-label">Support team</p>
            <button className={activeNav === 'Support dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('Support dashboard')}><ShieldCheck size={18} /> Ticket queue</button>
            <button className={activeNav === 'Team dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('Team dashboard')}><Users size={18} /> Team dashboard</button>
            <button className={activeNav === 'Knowledge base' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('Knowledge base')}><BookOpen size={18} /> Knowledge base</button>
          </> : <>
            <p className="nav-label">Workspace</p>
            {[
              ['Overview', LayoutDashboard],
              ['My tickets', Ticket],
              ['Knowledge base', BookOpen],
              ['Messages', MessageSquare],
            ].map(([label, Icon]) => (
              <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo(label)}>
                <Icon size={18} /> {label}
              </button>
            ))}
            <p className="nav-label nav-label-spaced">Manage</p>
            {[
              ['Reports', FileText],
            ].map(([label, Icon]) => (
              <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo(label)}>
                <Icon size={18} /> {label}
              </button>
            ))}
          </>}
        </nav>
        <div className="sidebar-bottom">
          {currentUser.role !== 'agent' && <div className="help-card">
            <div className="help-icon"><Headphones size={17} /></div>
            <strong>Need a hand?</strong>
            <p>Our support team is here to help.</p>
            <button onClick={() => setShowTicket(true)}>Contact support <ArrowRight size={14} /></button>
          </div>}
          <button className={activeNav === 'Settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('Settings')}><Settings size={18} /> Settings</button>
          <div className="user-mini">
            <div className="avatar">{currentUser.name.slice(0, 1).toUpperCase()}</div>
            <div><strong>{currentUser.name}</strong><small>{currentUser.role === 'agent' ? 'Support agent' : 'Employee'}</small></div>
            <button className="user-menu-button" onClick={() => navigateTo('Settings')} aria-label="Open profile settings"><MoreDots /></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button notification-button" onClick={() => setShowNotifications((value) => !value)} aria-label="Notifications"><Bell size={19} /><i /></button>
            <div className="topbar-divider" />
            <button className="profile-chip" onClick={() => navigateTo('Settings')}><div className="avatar small">{currentUser.name.slice(0, 1).toUpperCase()}</div><span>{currentUser.name}</span><ChevronDown size={15} /></button>
          </div>
          {showNotifications && <div className="notifications-popover"><div className="popover-heading"><strong>{currentUser.role === 'agent' ? 'Recent queue tickets' : 'Recent tickets'}</strong><span>{currentUser.role === 'agent' ? supportTickets.length : tickets.length} total</span></div>{(currentUser.role === 'agent' ? supportTickets : tickets).length ? (currentUser.role === 'agent' ? supportTickets : tickets).slice(0, 3).map((ticket) => <Notification key={ticket.id} text={`${ticket.id}: ${ticket.title}`} time={ticket.updated} onClick={() => openTicket(ticket.id)} />) : <p className="notification-empty">{currentUser.role === 'agent' ? 'No employee tickets are waiting.' : 'No tickets yet. Create a support request and its updates will appear here.'}</p>}</div>}
        </header>

        {activeNav === 'Overview' ? <div className="page-content">
          <section className="welcome-row">
            <div><p className="eyebrow">YOUR EMPLOYEE SUPPORT SPACE</p><h1>Good morning, {currentUser.name} <span>✦</span></h1><p className="subheading">Find guidance for common IT issues, or contact the support team.</p></div>
            <button className="primary-button" onClick={() => setShowTicket(true)}><Plus size={18} /> Create a ticket</button>
          </section>

          <section className="hero-panel">
            <div className="hero-copy"><div className="hero-kicker"><Sparkles size={15} /> SELF-SERVICE SUPPORT</div><h2>Find your answer,<br /><em>fix it faster.</em></h2><p>Search troubleshooting guides first. If the steps don’t resolve your issue, raise a ticket for the support team.</p>
              <form className="search-box" onSubmit={submitKnowledgeSearch}><Search size={19} /><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Wi-Fi, VPN, software, passwords…" aria-label="Search knowledge base" /><kbd>⌘ K</kbd></form><div className="hero-suggestions"><span>Popular:</span><button type="button" onClick={() => setQuery('Wi-Fi connection')}>Wi-Fi connection</button><button type="button" onClick={() => setQuery('VPN dropping')}>VPN dropping</button><button type="button" onClick={() => setQuery('Reset password')}>Reset password</button></div>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="art-glow" /><div className="art-circle circle-one" /><div className="art-circle circle-two" /><div className="art-window"><div className="window-top"><i /><i /><i /></div><div className="window-line long" /><div className="window-line" /><div className="window-line short" /><div className="window-check"><CheckCircle2 size={16} /> Issue resolved</div></div><div className="art-badge"><ShieldCheck size={18} /><span><b>98%</b><small>self-service success</small></span></div></div>
          </section>

          <section className="stats-grid">
            <Stat icon={Ticket} label="Total tickets" value={tickets.length} detail="Your support requests" tone="blue" />
            <Stat icon={Clock3} label="Open tickets" value={tickets.filter((ticket) => ticket.status !== 'Resolved').length} detail="1 needs your reply" tone="orange" />
            <Stat icon={CheckCircle2} label="Resolved tickets" value={tickets.filter((ticket) => ticket.status === 'Resolved').length} detail="92% resolution rate" tone="green" />
            <Stat icon={MessageSquare} label="Messages" value={tickets.length} detail="Updates on your requests" tone="purple" />
          </section>

        </div> : <Destination page={activeNav} articles={articles} tickets={tickets} supportTickets={supportTickets} query={query} setQuery={setQuery} category={category} setCategory={setCategory} user={currentUser} onTicket={openTicket} onArticle={openArticle} onCreate={() => setShowTicket(true)} onCreateArticle={createArticle} onUpdateTicket={updateTicketStatus} onNavigate={navigateTo} onSignOut={async () => { try { await apiRequest('/api/auth/logout', { method: 'POST' }) } finally { setIsAuthenticated(false); setCurrentUser(null); setSupportTickets([]) } }} />}
        {activeNav !== 'Overview' && <footer><span>© 2026 FixDesk</span><span>Support hours: Mon–Fri, 8:00–18:00</span><button onClick={() => navigateTo('Settings')}>Privacy &amp; settings</button><button onClick={() => showToast('All systems operational')}><span className="status-dot" /> All systems operational</button></footer>}
      </main>
      {showTicket && currentUser.role !== 'agent' && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowTicket(false) }}><div className="modal"><div className="modal-header"><div><p className="eyebrow">Support request</p><h2>Tell us what&apos;s going on</h2></div><button className="icon-button" onClick={() => setShowTicket(false)} aria-label="Close"><X size={19} /></button></div><p className="modal-intro">Share a few details and our team will get back to you as soon as possible.</p><form onSubmit={createTicket}><label>What do you need help with?<input name="title" required placeholder="e.g. I can't connect to Wi-Fi" /></label><div className="form-row"><label>Category<select name="category" defaultValue="Network"><option>Network</option><option>Hardware</option><option>Software</option><option>Access</option></select></label><label>Priority<select name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option></select></label></div><label>Describe the issue<textarea name="description" required placeholder="Include any details that might help us solve this faster..." rows="4" /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowTicket(false)}>Cancel</button><button type="submit" className="primary-button"><Send size={16} /> Submit ticket</button></div></form></div></div>}
      {selectedTicket && <RecordModal title={selectedTicket.title} eyebrow={`Ticket ${selectedTicket.id}`} onClose={() => setSelectedTicket(null)}><div className="record-meta"><span className={`status-badge ${selectedTicket.status.toLowerCase().replace(' ', '-')}`}>{selectedTicket.status}</span><span className={`priority ${selectedTicket.priority.toLowerCase()}`}><i /> {selectedTicket.priority} priority</span></div>{selectedTicket.requester && <p className="record-copy">Requested by {selectedTicket.requester.name}{selectedTicket.requester.email ? ` · ${selectedTicket.requester.email}` : ''}.</p>}<p className="record-copy">{selectedTicket.description || `This ticket is categorized under ${selectedTicket.category}.`}</p>{selectedTicket.status === 'Resolved' && selectedTicket.resolutionNote && <section className="resolution-note"><strong>Resolution from FixDesk support</strong><p>{selectedTicket.resolutionNote}</p></section>}<p className="record-copy">Last updated {selectedTicket.updated.toLowerCase()}.</p><button className="primary-button" onClick={() => setSelectedTicket(null)}>Close ticket view</button></RecordModal>}
      {selectedArticle && <RecordModal title={selectedArticle.title} eyebrow={selectedArticle.category} onClose={() => setSelectedArticle(null)}><p className="record-copy">Follow these suggested steps, then choose whether the issue is resolved or you still need support.</p><ol className="troubleshooting-steps">{selectedArticle.steps.map((step, index) => <li key={step}><strong>{step}</strong><p>{selectedArticle.details[index]}</p></li>)}</ol><div className="record-actions">{currentUser.role === 'employee' && <button className="secondary-button" onClick={() => { setSelectedArticle(null); showToast('Great — no ticket is needed.') }}>Issue resolved</button>}{currentUser.role === 'employee' ? <button className="primary-button" onClick={() => { setSelectedArticle(null); setShowTicket(true) }}>Still need help <ArrowRight size={15} /></button> : <button className="primary-button" onClick={() => { setSelectedArticle(null); navigateTo('Support dashboard') }}>Return to ticket queue <ArrowRight size={15} /></button>}</div></RecordModal>}
      {toast && <div className="toast"><CheckCircle2 size={18} /><span>{toast.message}</span>{toast.action && <button onClick={toast.action.onClick}>{toast.action.label}</button>}</div>}
    </div>
  )
}

function normalizeSearch(value) {
  return value.toLowerCase().replace(/\bwi[\s-]*fi\b/g, 'wifi').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function LoginPage({ onLogin, onCreateAccount }) {
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    setMessage('')
    setBusy(true)
    try {
      const result = mode === 'register' ? await onCreateAccount(event) : await onLogin(event, mode === 'agent-login' ? 'agent' : 'employee')
      if (result?.error) setMessage(result.error)
    } catch (error) {
      event.preventDefault()
      setMessage(error.message || 'Could not connect to the FixDesk server.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="login-page">
    <section className="login-panel">
      <a className="login-brand" href="#login" aria-label="FixDesk home"><span className="brand-mark"><LifeBuoy size={20} strokeWidth={2.5} /></span><span>Fix<span>Desk</span></span></a>
      <div className="login-content">
        <p className="eyebrow">{mode === 'agent-login' ? 'SUPPORT TEAM PORTAL' : 'EMPLOYEE SUPPORT PORTAL'}</p>
        <h1>{mode === 'register' ? 'Create your account' : mode === 'agent-login' ? 'Support agent sign in' : 'Welcome back'}</h1>
        <p className="login-subtitle">{mode === 'register' ? 'Join FixDesk to find answers and manage your support requests.' : mode === 'agent-login' ? 'Sign in to review and resolve employee support tickets.' : 'Sign in to find answers, track requests, and get support.'}</p>
        <form key={mode} className="login-form" autoComplete="off" onSubmit={submit}>
          {mode === 'register' && <><label htmlFor="login-name">Full name</label><div className="login-input"><Users size={17} /><input id="login-name" name="name" autoComplete="name" placeholder="Your name" minLength="2" required /></div></>}
          <label htmlFor="login-email">Work email</label>
          <div className="login-input"><Mail size={17} /><input id="login-email" name="email" type="email" autoComplete="off" placeholder="you@company.com" required /></div>
          <label htmlFor="login-password">Password</label>
          <div className="login-input"><LockKeyhole size={17} /><input id="login-password" name="password" type="password" autoComplete="off" placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'} minLength="8" required /></div>
          {mode === 'register' && <><label htmlFor="login-confirm-password">Confirm password</label><div className="login-input"><LockKeyhole size={17} /><input id="login-confirm-password" name="confirmPassword" type="password" autoComplete="off" placeholder="Enter your password again" minLength="8" required /></div></>}
          {mode !== 'register' && <button className="login-forgot" type="button" onClick={() => setMessage('Password reset is not available yet. Contact your administrator.')}>Forgot password?</button>}
          {message && <p className="login-error" role="alert">{message}</p>}
          <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'agent-login' ? 'Sign in to support' : 'Sign in'} <ArrowRight size={16} /></button>
        </form>
        <p className="login-switch">{mode === 'register' ? 'Already have an account?' : mode === 'agent-login' ? 'Employee account?' : 'New to FixDesk?'} <button type="button" onClick={() => { setMessage(''); setMode(mode === 'register' ? 'login' : mode === 'agent-login' ? 'login' : 'register') }}>{mode === 'register' ? 'Sign in' : mode === 'agent-login' ? 'Employee sign in' : 'Create an account'}</button></p>
        {mode !== 'register' && <p className="login-switch login-role-switch">{mode === 'agent-login' ? 'Not a support agent?' : 'Support team member?'} <button type="button" onClick={() => { setMessage(''); setMode(mode === 'agent-login' ? 'login' : 'agent-login') }}>{mode === 'agent-login' ? 'Employee sign in' : 'Support agent sign in'}</button></p>}
        <p className="login-note">Accounts, tickets, and support articles are served by the FixDesk backend and MongoDB database.</p>
      </div>
      <footer className="login-footer"><span>© 2026 FixDesk</span><span>Secure IT support, all in one place.</span></footer>
    </section>
    <aside className="login-visual" aria-label="FixDesk self-service support">
      <div className="login-orbit orbit-a" /><div className="login-orbit orbit-b" />
      <div className="login-visual-copy"><span className="hero-kicker"><Sparkles size={15} /> SELF-SERVICE SUPPORT</span><h2>Find your answer.<br /><em>Fix it faster.</em></h2><p>Search practical guides for everyday IT issues, then raise a ticket if you still need help.</p></div>
      <div className="login-preview"><div className="preview-check"><CheckCircle2 size={18} /><span>Issue resolved</span></div><div className="preview-line wide" /><div className="preview-line" /><div className="preview-line short" /></div>
      <div className="login-tip"><ShieldCheck size={18} /><span><strong>Help when you need it</strong><small>Knowledge base · Tickets · Support</small></span></div>
    </aside>
  </main>
}

function MoreDots() { return <span className="more-dots"><i /><i /><i /></span> }
function Destination({ page, articles, tickets, supportTickets, query, setQuery, category, setCategory, user, onTicket, onArticle, onCreate, onCreateArticle, onUpdateTicket, onNavigate, onSignOut }) {
  const [saved, setSaved] = useState(false)
  const [showArticleForm, setShowArticleForm] = useState(false)
  const resolvedSupportCount = supportTickets.filter((ticket) => ticket.status === 'Resolved').length
  const resolutionRate = supportTickets.length ? Math.round((resolvedSupportCount / supportTickets.length) * 100) : 0
  const categoryNames = { Hardware: 'Hardware & devices', Network: 'Network & access', Software: 'Software & apps', Access: 'Accounts & security' }
  const categoryBreakdown = ['Hardware', 'Software', 'Network', 'Access'].map((name) => ({ label: categoryNames[name], count: supportTickets.filter((ticket) => ticket.category === name).length }))
  const priorityBreakdown = ['High', 'Medium', 'Low'].map((name) => ({ label: name, count: supportTickets.filter((ticket) => ticket.priority === name).length }))
  const highPriorityCount = supportTickets.filter((ticket) => ticket.priority === 'High' && ticket.status !== 'Resolved').length
  const busiestCategory = categoryBreakdown.reduce((busiest, item) => item.count > busiest.count ? item : busiest, { label: 'No tickets yet', count: 0 })
  const filteredKnowledgeArticles = useMemo(() => articles.filter((article) => {
    const searchableWords = normalizeSearch(`${article.title} ${article.category} ${(article.steps || []).join(' ')} ${(article.details || []).join(' ')}`).split(' ')
    const queryWords = normalizeSearch(query).split(' ').filter(Boolean)
    const matchesQuery = !queryWords.length || queryWords.some((word) => searchableWords.includes(word))
    const matchesCategory = category === 'All articles' || article.category === category
    return matchesQuery && matchesCategory
  }), [articles, category, query])
  const heading = {
    'My tickets': ['Your support requests', 'Track progress, review updates, and get back to your open requests.'],
    'Support dashboard': ['Support ticket queue', 'Review employee requests, update their status, and mark solved issues as resolved.'],
    'Knowledge base': ['Knowledge, made simple', 'Browse practical guides written to get you back on track.'],
    Messages: ['Messages', 'See the latest status and resolution notes for your support tickets.'],
    'Team dashboard': ['Team dashboard', 'Live workload and resolution progress across employee tickets.'],
    Reports: ['Support at a glance', 'A clear view of ticket trends and resolution progress.'],
    Settings: ['Your workspace settings', 'Manage your profile and support preferences.'],
  }[page] || ['Welcome to FixDesk', 'Find support and useful resources for your workspace.']

  return <div className="page-content destination-page">
    <section className="destination-hero"><div><p className="eyebrow">{page}</p><h1>{heading[0]}</h1><p className="subheading">{heading[1]}</p></div>
      {page === 'My tickets' && <button className="primary-button" onClick={onCreate}><Plus size={17} /> Create a ticket</button>}
      {page === 'Knowledge base' && user.role === 'agent' && <button className="primary-button" onClick={() => setShowArticleForm((visible) => !visible)}><Plus size={17} /> {showArticleForm ? 'Close article form' : 'Add an article'}</button>}
      {page === 'Knowledge base' && user.role !== 'agent' && <button className="secondary-button" onClick={() => onNavigate('Overview')}>Back to overview <ArrowRight size={15} /></button>}
    </section>
    {page === 'My tickets' && <section className="content-card destination-card"><div className="section-heading"><div><p className="eyebrow">Your activity</p><h3>{tickets.length} requests</h3></div><span className="soft-tag">Saved to your account</span></div>{tickets.length ? <div className="ticket-list">{tickets.map((ticket) => <div className="requester-ticket" key={ticket.id}><TicketRow ticket={ticket} onOpen={() => onTicket(ticket.id)} />{ticket.status === 'Resolved' && ticket.resolutionNote && <section className="resolution-note requester-resolution"><strong>Resolution from FixDesk support</strong><p>{ticket.resolutionNote}</p></section>}</div>)}</div> : <div className="empty-state"><Ticket size={24} /><strong>No support requests yet</strong><p>Requests you create will be saved here.</p><button className="primary-button" onClick={onCreate}><Plus size={16} /> Create a ticket</button></div>}</section>}
    {page === 'Support dashboard' && user.role === 'agent' && <>
      <section className="stats-grid"><Stat icon={Ticket} label="All requests" value={supportTickets.length} detail="Across all employees" tone="blue"/><Stat icon={Clock3} label="Open" value={supportTickets.filter((ticket) => ticket.status === 'Open').length} detail="Waiting to be picked up" tone="orange"/><Stat icon={Settings} label="In progress" value={supportTickets.filter((ticket) => ticket.status === 'In progress').length} detail="Being worked on" tone="purple"/><Stat icon={CheckCircle2} label="Resolved" value={supportTickets.filter((ticket) => ticket.status === 'Resolved').length} detail="Visible in requester accounts" tone="green"/></section>
      <section className="content-card destination-card"><div className="section-heading"><div><p className="eyebrow">All employees</p><h3>{supportTickets.length} tickets</h3></div><span className="soft-tag">Live queue</span></div>{supportTickets.length ? <div className="agent-ticket-list">{supportTickets.map((ticket) => <AgentTicket key={ticket.id} ticket={ticket} onOpen={() => onTicket(ticket.id)} onUpdateTicket={onUpdateTicket}/>)}</div> : <div className="empty-state"><Ticket size={24}/><strong>No tickets in the queue</strong><p>Employee support requests will appear here when submitted.</p></div>}</section>
    </>}
    {page === 'Knowledge base' && <section className="content-card destination-card">{showArticleForm && user.role === 'agent' && <form className="article-editor" onSubmit={async (event) => { const form = event.currentTarget; const created = await onCreateArticle(event); if (created) { form.reset(); setShowArticleForm(false) } }}><div><p className="eyebrow">Publish for all users</p><h3>Add a Knowledge Base answer</h3></div><label>Frequently asked question<input name="title" minLength="5" maxLength="160" required placeholder="e.g. How do I reconnect to the company VPN?" /></label><label>Category<select name="category" defaultValue="Network & access">{categories.map((item) => <option key={item.name}>{item.name}</option>)}</select></label><label>Answer and troubleshooting guidance<textarea name="answer" minLength="20" maxLength="5000" required rows="6" placeholder="Write clear steps or instructions that will help employees solve this issue..." /></label><div className="article-editor-actions"><small>20–5000 characters. This article becomes visible to every signed-in user.</small><button className="primary-button" type="submit"><BookOpen size={16}/> Publish article</button></div></form>}<div className="knowledge-toolbar"><div className="knowledge-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guides by keyword" aria-label="Search knowledge base" /></div><span className="soft-tag">{filteredKnowledgeArticles.length} guides</span></div><div className="category-row destination-category-row"><button className={`category-pill ${category === 'All articles' ? 'selected' : ''}`} onClick={() => setCategory('All articles')}><span>✦</span><b>All articles</b><small>{articles.length}</small></button>{categories.map((item) => <button key={item.name} className={`category-pill ${item.color} ${category === item.name ? 'selected' : ''}`} onClick={() => setCategory(category === item.name ? 'All articles' : item.name)}><span>{item.icon}</span><b>{item.name}</b><small>{articles.filter((article) => article.category === item.name).length}</small></button>)}</div><div className="destination-article-grid">{filteredKnowledgeArticles.length ? filteredKnowledgeArticles.map((article) => <button className="guide-card" key={article.title} onClick={() => onArticle(article.title)}><span className="guide-icon"><BookOpen size={19} /></span><span className="guide-category">{article.category}</span><strong>{article.title}</strong><small>{article.steps.length} steps <ArrowRight size={14} /></small></button>) : <div className="empty-state"><Search size={24} /><strong>No guides found</strong><p>Try another search term.</p></div>}</div></section>}
    {page === 'Messages' && <section className="content-card destination-card"><div className="section-heading"><div><p className="eyebrow">Your tickets</p><h3>{tickets.length} request{tickets.length === 1 ? '' : 's'}</h3></div><span className="soft-tag">Updates refresh automatically</span></div>{tickets.length ? <div className="ticket-update-list">{tickets.map((ticket) => <TicketUpdate key={ticket.id} ticket={ticket} onOpen={() => onTicket(ticket.id)}/>)}</div> : <div className="empty-state"><MessageSquare size={24}/><strong>No messages yet</strong><p>When you submit a support ticket, its status and resolution will appear here.</p><button className="primary-button" onClick={onCreate}><Plus size={16}/> Create a ticket</button></div>}</section>}
    {page === 'Team dashboard' && user.role === 'agent' && <><section className="stats-grid"><Stat icon={Ticket} label="Total requests" value={supportTickets.length} detail="Across the support queue" tone="blue"/><Stat icon={Clock3} label="Unresolved high priority" value={highPriorityCount} detail="Needs timely attention" tone="orange"/><Stat icon={CheckCircle2} label="Resolution rate" value={`${resolutionRate}%`} detail={`${resolvedSupportCount} resolved requests`} tone="green"/><Stat icon={Users} label="Busiest category" value={busiestCategory.count ? busiestCategory.label : '—'} detail={`${busiestCategory.count} requests`} tone="purple"/></section><section className="team-insights-grid"><div className="content-card destination-card"><div className="section-heading"><div><p className="eyebrow">Request trends</p><h3>Tickets by category</h3></div><span className="soft-tag">{supportTickets.length} total</span></div><div className="team-breakdown-list">{categoryBreakdown.map((item) => <BreakdownRow key={item.label} item={item} total={supportTickets.length}/>)}</div></div><div className="content-card destination-card"><div className="section-heading"><div><p className="eyebrow">Workload mix</p><h3>Tickets by priority</h3></div></div><div className="team-breakdown-list">{priorityBreakdown.map((item) => <BreakdownRow key={item.label} item={item} total={supportTickets.length}/>)}</div><button className="secondary-button team-queue-link" onClick={() => onNavigate('Support dashboard')}>Go to ticket queue <ArrowRight size={14}/></button></div></section></>}
    {page === 'Reports' && <><section className="stats-grid"><Stat icon={Ticket} label="Requests this month" value="128" detail="↑ 12% from last month" tone="blue"/><Stat icon={Clock3} label="Avg. response time" value="24m" detail="↓ 8 min this month" tone="orange"/><Stat icon={CheckCircle2} label="Resolved" value="94%" detail="Above 90% goal" tone="green"/><Stat icon={Sparkles} label="Helpful guides" value="4.6/5" detail="From employee feedback" tone="purple"/></section><section className="content-card destination-card"><p className="eyebrow">Resolution snapshot</p><h3>Requests are getting resolved faster</h3><div className="report-bars"><span style={{height:'46%'}}/><span style={{height:'62%'}}/><span style={{height:'53%'}}/><span style={{height:'78%'}}/><span style={{height:'68%'}}/><span style={{height:'92%'}}/><span style={{height:'84%'}}/></div><div className="bar-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></section></>}
    {page === 'Settings' && <section className="content-card destination-card settings-card"><div className="section-heading"><div><p className="eyebrow">Profile</p><h3>{user.name}</h3><small>{user.email}</small></div><div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div></div><p className="subheading">{user.role === 'agent' ? 'Support agent' : 'Employee'} · FixDesk Support</p><div className="settings-row"><div><strong>Email notifications</strong><small>Updates about ticket replies and changes</small></div><button className={`toggle ${saved ? 'on' : ''}`} onClick={() => setSaved(!saved)} aria-label="Toggle email notifications"><i /></button></div><div className="settings-row"><div><strong>Workspace</strong><small>FixDesk Support · {user.role === 'agent' ? 'Support team' : 'Employee'} workspace</small></div><span className="soft-tag">Active</span></div><div className="settings-actions"><button className="secondary-button" onClick={() => onNavigate(user.role === 'agent' ? 'Support dashboard' : 'Overview')}>{user.role === 'agent' ? 'Return to ticket queue' : 'Return to overview'} <ArrowRight size={15}/></button><button className="text-button" onClick={onSignOut}>Sign out</button></div></section>}
  </div>
}
function Notification({ text, time, onClick }) { return <button className="notification-item" onClick={onClick}><div className="notification-icon"><Bell size={14} /></div><div><p>{text}</p><small>{time}</small></div><ArrowRight size={14} /></button> }
function Stat({ icon: Icon, label, value, detail, tone }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-info"><span>{label}</span><strong>{value}</strong><small className={tone === 'green' ? 'positive' : ''}>{detail}</small></div></div> }
function BreakdownRow({ item, total }) { const percent = total ? Math.round((item.count / total) * 100) : 0; return <div className="team-breakdown-row"><div><strong>{item.label}</strong><span>{item.count} tickets · {percent}%</span></div><div className="team-breakdown-track"><i style={{ width: `${percent}%` }}/></div></div> }
function TicketRow({ ticket, onOpen }) { return <button className="ticket-row" onClick={onOpen}><div className="ticket-main"><span className="ticket-id">{ticket.id}</span><strong>{ticket.title}</strong><small>{ticket.category} <i /> {ticket.updated}</small></div><div className="ticket-meta"><span className={`status-badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span><span className={`priority ${ticket.priority.toLowerCase()}`}><i /> {ticket.priority}</span></div></button> }
function TicketUpdate({ ticket, onOpen }) {
  const updateText = ticket.status === 'Resolved'
    ? 'Support marked this request as resolved.'
    : ticket.status === 'In progress'
      ? 'A support agent is working on this request.'
      : 'This request is waiting for a support agent.'
  return <article className="ticket-update"><div className="ticket-update-heading"><div><small>{ticket.id} · {ticket.category} · Updated {ticket.updated}</small><h4>{ticket.title}</h4></div><span className={`status-badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span></div><p>{updateText}</p>{ticket.status === 'Resolved' && ticket.resolutionNote && <section className="resolution-note"><strong>Resolution from FixDesk support</strong><p>{ticket.resolutionNote}</p></section>}<button className="text-button" onClick={onOpen}>View ticket <ArrowRight size={14}/></button></article>
}
function AgentTicket({ ticket, onOpen, onUpdateTicket }) {
  const [resolutionNote, setResolutionNote] = useState('')
  const [saving, setSaving] = useState(false)
  async function resolve(event) {
    event.preventDefault()
    if (resolutionNote.trim().length < 10) return
    setSaving(true)
    await onUpdateTicket(ticket.id, 'Resolved', resolutionNote.trim())
    setSaving(false)
    setResolutionNote('')
  }
  return <article className="agent-ticket"><TicketRow ticket={ticket} onOpen={onOpen}/><div className="agent-ticket-actions"><span>Submitted by <strong>{ticket.requester?.name || 'Unknown employee'}</strong>{ticket.requester?.email ? ` · ${ticket.requester.email}` : ''}</span><div>{ticket.status === 'Open' && <button className="secondary-button" onClick={() => onUpdateTicket(ticket.id, 'In progress')}>Start work</button>}{ticket.status === 'Resolved' && <button className="secondary-button" onClick={() => onUpdateTicket(ticket.id, 'In progress')}>Reopen</button>}</div></div>{ticket.status === 'In progress' && <form className="agent-resolution-form" onSubmit={resolve}><label htmlFor={`resolution-${ticket.id}`}>Resolution note <span>Visible to the requester</span></label><textarea id={`resolution-${ticket.id}`} value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} minLength={10} maxLength={2000} required placeholder="Explain what you checked or changed to solve the issue..."/><div><small>{resolutionNote.trim().length}/2000 characters · at least 10 required</small><button className="primary-button" type="submit" disabled={saving || resolutionNote.trim().length < 10}><CheckCircle2 size={15}/>{saving ? 'Saving…' : 'Mark solved'}</button></div></form>}</article>
}
function RecordModal({ title, eyebrow, onClose, children }) { return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal record-modal"><div className="modal-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close record"><X size={19} /></button></div>{children}</div></div> }

export default App
