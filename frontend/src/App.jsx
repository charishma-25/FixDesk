import { useMemo, useState } from 'react'
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

const categories = [
  { name: 'Hardware & devices', count: 24, icon: '▦', color: 'blue' },
  { name: 'Software & apps', count: 31, icon: '◈', color: 'purple' },
  { name: 'Network & access', count: 18, icon: '⌁', color: 'orange' },
  { name: 'Accounts & security', count: 12, icon: '◇', color: 'green' },
]

const articles = [
  { title: 'How to connect to the campus Wi-Fi', category: 'Network & access', time: '4 min read', views: '2.4k', icon: '⌁' },
  { title: 'Reset your password securely', category: 'Accounts & security', time: '3 min read', views: '1.8k', icon: '◇' },
  { title: 'Fixing a slow or unresponsive laptop', category: 'Hardware & devices', time: '6 min read', views: '1.2k', icon: '▦' },
  { title: 'Install approved software on your device', category: 'Software & apps', time: '5 min read', views: '980', icon: '◈' },
]

const initialTickets = [
  { id: 'FD-1048', title: 'Unable to access the design lab printer', category: 'Hardware', status: 'In progress', priority: 'Medium', updated: 'Today, 10:42 AM' },
  { id: 'FD-1031', title: 'VPN connection drops after a few minutes', category: 'Network', status: 'Open', priority: 'High', updated: 'Yesterday' },
  { id: 'FD-0994', title: 'Request access to analytics workspace', category: 'Access', status: 'Resolved', priority: 'Low', updated: 'Oct 18, 2024' },
]

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All articles')
  const [tickets, setTickets] = useState(initialTickets)
  const [showTicket, setShowTicket] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [mobileNav, setMobileNav] = useState(false)

  const filteredArticles = useMemo(() => articles.filter((article) => {
    const matchesQuery = article.title.toLowerCase().includes(query.toLowerCase()) ||
      article.category.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === 'All articles' || article.category === category
    return matchesQuery && matchesCategory
  }), [category, query])

  function showToast(message, action = null) {
    setToast({ message, action })
    window.setTimeout(() => setToast(null), 3200)
  }

  function openTicket(ticketId, ticketOverride = null) {
    const ticket = ticketOverride || tickets.find((item) => item.id === ticketId)
    if (!ticket) {
      showToast(`Ticket ${ticketId} could not be found`)
      return
    }
    setSelectedTicket(ticket)
    setSelectedArticle(null)
    setShowNotifications(false)
    setActiveNav('My tickets')
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

  function createTicket(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newTicket = {
      id: `FD-${1050 + tickets.length}`,
      title: form.get('title'),
      category: form.get('category'),
      status: 'Open',
      priority: form.get('priority'),
      updated: 'Just now',
    }
    setTickets((current) => [newTicket, ...current])
    setShowTicket(false)
    showToast('Ticket created. Our team will be in touch shortly.', {
      label: 'View ticket',
      onClick: () => openTicket(newTicket.id, newTicket),
    })
    event.currentTarget.reset()
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><LifeBuoy size={20} strokeWidth={2.5} /></div>
          <span>Fix<span>Desk</span></span>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <button className="workspace-switcher" onClick={() => navigateTo('Settings')}>
          <div className="workspace-avatar">N</div>
          <div><strong>Northstar University</strong><small>Student workspace</small></div>
          <ChevronDown size={15} />
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {[
            ['Overview', LayoutDashboard],
            ['My tickets', Ticket],
            ['Knowledge base', BookOpen],
            ['Messages', MessageSquare],
          ].map(([label, Icon]) => (
            <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo(label)}>
              <Icon size={18} /> {label}
              {label === 'Messages' && <b className="nav-count">3</b>}
            </button>
          ))}
          <p className="nav-label nav-label-spaced">Manage</p>
          {[
            ['Team dashboard', Users],
            ['Reports', FileText],
          ].map(([label, Icon]) => (
            <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo(label)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Headphones size={17} /></div>
            <strong>Need a hand?</strong>
            <p>Our support team is here to help.</p>
            <button onClick={() => setShowTicket(true)}>Contact support <ArrowRight size={14} /></button>
          </div>
          <button className={activeNav === 'Settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('Settings')}><Settings size={18} /> Settings</button>
          <div className="user-mini">
            <div className="avatar">AM</div>
            <div><strong>Alex Morgan</strong><small>Student</small></div>
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
            <button className="profile-chip" onClick={() => navigateTo('Settings')}><div className="avatar small">AM</div><span>Alex Morgan</span><ChevronDown size={15} /></button>
          </div>
          {showNotifications && <div className="notifications-popover"><div className="popover-heading"><strong>Notifications</strong><span>3 new</span></div><Notification text="Your ticket FD-1048 was assigned to Maya Chen." time="12 min ago" onClick={() => openTicket('FD-1048')} /><Notification text="A new guide was added to Network & access." time="Yesterday" onClick={() => openArticle('How to connect to the campus Wi-Fi')} /><Notification text="Ticket FD-0994 was marked as resolved." time="Oct 18" onClick={() => openTicket('FD-0994')} /></div>}
        </header>

        {activeNav === 'Overview' ? <div className="page-content">
          <section className="welcome-row">
            <div><p className="eyebrow">YOUR NORTHSTAR SUPPORT SPACE</p><h1>Good morning, Alex <span>✦</span></h1><p className="subheading">Let&apos;s get your tech working smoothly.</p></div>
            <button className="primary-button" onClick={() => setShowTicket(true)}><Plus size={18} /> Create a ticket</button>
          </section>

          <section className="hero-panel">
            <div className="hero-copy"><div className="hero-kicker"><Sparkles size={15} /> SELF-SERVICE SUPPORT</div><h2>Find your answer,<br /><em>fix it faster.</em></h2><p>Search our knowledge base for step-by-step guides, quick fixes, and helpful answers from the support team.</p>
              <div className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What can we help you solve?" aria-label="Search knowledge base" /><kbd>⌘ K</kbd></div><div className="hero-suggestions"><span>Popular:</span><button onClick={() => setQuery('Wi-Fi')}>Wi-Fi connection</button><button onClick={() => setQuery('password')}>Reset password</button><button onClick={() => setQuery('laptop')}>Slow laptop</button></div>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="art-glow" /><div className="art-circle circle-one" /><div className="art-circle circle-two" /><div className="art-window"><div className="window-top"><i /><i /><i /></div><div className="window-line long" /><div className="window-line" /><div className="window-line short" /><div className="window-check"><CheckCircle2 size={16} /> Issue resolved</div></div><div className="art-badge"><ShieldCheck size={18} /><span><b>98%</b><small>self-service success</small></span></div></div>
          </section>

          <section className="stats-grid">
            <Stat icon={Ticket} label="Total tickets" value={tickets.length} detail="+2 this month" tone="blue" />
            <Stat icon={Clock3} label="Open tickets" value={tickets.filter((ticket) => ticket.status !== 'Resolved').length} detail="1 needs your reply" tone="orange" />
            <Stat icon={CheckCircle2} label="Resolved tickets" value={tickets.filter((ticket) => ticket.status === 'Resolved').length} detail="92% resolution rate" tone="green" />
            <Stat icon={MessageSquare} label="Unread messages" value="3" detail="From support team" tone="purple" />
          </section>

          <div className="content-grid">
            <section className="content-card knowledge-card">
              <div className="section-heading"><div><p className="eyebrow">Knowledge base</p><h3>Explore troubleshooting guides</h3></div><button className="text-button" onClick={() => navigateTo('Knowledge base')}>View all <ArrowRight size={15} /></button></div>
              <div className="category-row">{categories.map((item) => <button key={item.name} className={`category-pill ${item.color} ${category === item.name ? 'selected' : ''}`} onClick={() => setCategory(category === item.name ? 'All articles' : item.name)}><span>{item.icon}</span><b>{item.name}</b><small>{item.count}</small></button>)}</div>
              <div className="article-list">{filteredArticles.length ? filteredArticles.map((article) => <Article key={article.title} article={article} onOpen={() => openArticle(article.title)} />) : <div className="empty-state"><Search size={24} /><strong>No guides found</strong><p>Try a different search term or category.</p></div>}</div>
            </section>
            <section className="content-card tickets-card">
              <div className="section-heading"><div><p className="eyebrow">Your activity</p><h3>Recent tickets</h3></div><button className="text-button" onClick={() => navigateTo('My tickets')}>View all <ArrowRight size={15} /></button></div>
              <div className="ticket-list">{tickets.slice(0, 4).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={() => openTicket(ticket.id)} />)}</div>
              <button className="secondary-button full-width" onClick={() => setShowTicket(true)}><Plus size={16} /> Create another ticket</button>
            </section>
          </div>
        </div> : <Destination page={activeNav} tickets={tickets} onTicket={openTicket} onArticle={openArticle} onCreate={() => setShowTicket(true)} onNavigate={navigateTo} />}
        <footer><span>© 2026 FixDesk</span><span>Support hours: Mon–Fri, 8:00–18:00</span><button onClick={() => navigateTo('Settings')}>Privacy &amp; settings</button><button onClick={() => showToast('All systems operational')}><span className="status-dot" /> All systems operational</button></footer>
      </main>
      {showTicket && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowTicket(false) }}><div className="modal"><div className="modal-header"><div><p className="eyebrow">Support request</p><h2>Tell us what&apos;s going on</h2></div><button className="icon-button" onClick={() => setShowTicket(false)} aria-label="Close"><X size={19} /></button></div><p className="modal-intro">Share a few details and our team will get back to you as soon as possible.</p><form onSubmit={createTicket}><label>What do you need help with?<input name="title" required placeholder="e.g. I can't connect to Wi-Fi" /></label><div className="form-row"><label>Category<select name="category" defaultValue="Network"><option>Network</option><option>Hardware</option><option>Software</option><option>Access</option></select></label><label>Priority<select name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option></select></label></div><label>Describe the issue<textarea name="description" required placeholder="Include any details that might help us solve this faster..." rows="4" /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowTicket(false)}>Cancel</button><button type="submit" className="primary-button"><Send size={16} /> Submit ticket</button></div></form></div></div>}
      {selectedTicket && <RecordModal title={selectedTicket.title} eyebrow={`Ticket ${selectedTicket.id}`} onClose={() => setSelectedTicket(null)}><div className="record-meta"><span className={`status-badge ${selectedTicket.status.toLowerCase().replace(' ', '-')}`}>{selectedTicket.status}</span><span className={`priority ${selectedTicket.priority.toLowerCase()}`}><i /> {selectedTicket.priority} priority</span></div><p className="record-copy">This ticket is categorized under {selectedTicket.category}. It was last updated {selectedTicket.updated.toLowerCase()}.</p><button className="primary-button" onClick={() => setSelectedTicket(null)}>Close ticket view</button></RecordModal>}
      {selectedArticle && <RecordModal title={selectedArticle.title} eyebrow={selectedArticle.category} onClose={() => setSelectedArticle(null)}><p className="record-copy">This troubleshooting guide takes approximately {selectedArticle.time.toLowerCase()}. Follow the recommended steps and contact support if the issue continues.</p><button className="primary-button" onClick={() => setSelectedArticle(null)}>Close article</button></RecordModal>}
      {toast && <div className="toast"><CheckCircle2 size={18} /><span>{toast.message}</span>{toast.action && <button onClick={toast.action.onClick}>{toast.action.label}</button>}</div>}
    </div>
  )
}

function MoreDots() { return <span className="more-dots"><i /><i /><i /></span> }
function Destination({ page, tickets, onTicket, onArticle, onCreate, onNavigate }) {
  const [saved, setSaved] = useState(false)
  const heading = {
    'My tickets': ['Your support requests', 'Track progress, review updates, and get back to your open requests.'],
    'Knowledge base': ['Knowledge, made simple', 'Browse practical guides written to get you back on track.'],
    Messages: ['Messages from support', 'Your recent conversations with the FixDesk team.'],
    'Team dashboard': ['Support team dashboard', 'A live snapshot of the team activity in your workspace.'],
    Reports: ['Support at a glance', 'A clear view of ticket trends and resolution progress.'],
    Settings: ['Your workspace settings', 'Manage your profile and support preferences.'],
  }[page] || ['Welcome to FixDesk', 'Find support and useful resources for your workspace.']

  return <div className="page-content destination-page">
    <section className="destination-hero"><div><p className="eyebrow">{page}</p><h1>{heading[0]}</h1><p className="subheading">{heading[1]}</p></div>
      {page === 'My tickets' && <button className="primary-button" onClick={onCreate}><Plus size={17} /> Create a ticket</button>}
      {page === 'Knowledge base' && <button className="secondary-button" onClick={() => onNavigate('Overview')}>Back to overview <ArrowRight size={15} /></button>}
    </section>
    {page === 'My tickets' && <section className="content-card destination-card"><div className="section-heading"><div><p className="eyebrow">Your activity</p><h3>{tickets.length} requests</h3></div><span className="soft-tag">Updated just now</span></div><div className="ticket-list">{tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={() => onTicket(ticket.id)} />)}</div></section>}
    {page === 'Knowledge base' && <section className="content-card destination-card"><div className="destination-article-grid">{articles.map((article) => <button className="guide-card" key={article.title} onClick={() => onArticle(article.title)}><span className="guide-icon"><BookOpen size={19} /></span><span className="guide-category">{article.category}</span><strong>{article.title}</strong><small>{article.time} <ArrowRight size={14} /></small></button>)}</div></section>}
    {page === 'Messages' && <section className="content-card destination-card"><div className="section-heading"><div><p className="eyebrow">Recent conversation</p><h3>Help from Maya Chen</h3></div><span className="online-tag"><i /> Support is online</span></div><div className="message-thread"><div className="message-bubble support"><small>Maya Chen · 12 min ago</small><p>Hi Alex! I’ve picked up your printer request. Could you let me know whether the printer shows an error code?</p></div><div className="message-bubble user"><small>You · Yesterday</small><p>The VPN connection is dropping every few minutes.</p></div></div><button className="primary-button" onClick={onCreate}><MessageSquare size={16} /> Start a support conversation</button></section>}
    {page === 'Team dashboard' && <><section className="stats-grid"><Stat icon={Users} label="Available agents" value="8" detail="Across 2 support teams" tone="blue"/><Stat icon={Clock3} label="Waiting for reply" value="6" detail="Average wait: 18 min" tone="orange"/><Stat icon={CheckCircle2} label="Resolved today" value="24" detail="On track this week" tone="green"/><Stat icon={MessageSquare} label="Conversations" value="12" detail="3 active now" tone="purple"/></section><section className="content-card destination-card"><p className="eyebrow">Recently updated</p><h3>Tickets your team is working on</h3><div className="ticket-list">{tickets.slice(0, 3).map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={() => onTicket(ticket.id)} />)}</div></section></>}
    {page === 'Reports' && <><section className="stats-grid"><Stat icon={Ticket} label="Requests this month" value="128" detail="↑ 12% from last month" tone="blue"/><Stat icon={Clock3} label="Avg. response time" value="24m" detail="↓ 8 min this month" tone="orange"/><Stat icon={CheckCircle2} label="Resolved" value="94%" detail="Above 90% goal" tone="green"/><Stat icon={Sparkles} label="Helpful guides" value="4.6/5" detail="From student feedback" tone="purple"/></section><section className="content-card destination-card"><p className="eyebrow">Resolution snapshot</p><h3>Requests are getting resolved faster</h3><div className="report-bars"><span style={{height:'46%'}}/><span style={{height:'62%'}}/><span style={{height:'53%'}}/><span style={{height:'78%'}}/><span style={{height:'68%'}}/><span style={{height:'92%'}}/><span style={{height:'84%'}}/></div><div className="bar-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></section></>}
    {page === 'Settings' && <section className="content-card destination-card settings-card"><div className="section-heading"><div><p className="eyebrow">Profile</p><h3>Alex Morgan</h3></div><div className="avatar">AM</div></div><p className="subheading">Student · Northstar University</p><div className="settings-row"><div><strong>Email notifications</strong><small>Updates about ticket replies and changes</small></div><button className={`toggle ${saved ? 'on' : ''}`} onClick={() => setSaved(!saved)} aria-label="Toggle email notifications"><i /></button></div><div className="settings-row"><div><strong>Workspace</strong><small>Northstar University · Student workspace</small></div><span className="soft-tag">Active</span></div><button className="secondary-button" onClick={() => onNavigate('Overview')}>Return to overview <ArrowRight size={15}/></button></section>}
  </div>
}
function Notification({ text, time, onClick }) { return <button className="notification-item" onClick={onClick}><div className="notification-icon"><Bell size={14} /></div><div><p>{text}</p><small>{time}</small></div><ArrowRight size={14} /></button> }
function Stat({ icon: Icon, label, value, detail, tone }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-info"><span>{label}</span><strong>{value}</strong><small className={tone === 'green' ? 'positive' : ''}>{detail}</small></div></div> }
function Article({ article, onOpen }) { return <button className="article-row" onClick={onOpen}><div className="article-icon">{article.icon}</div><div className="article-info"><strong>{article.title}</strong><span>{article.category}<i /> {article.time}</span></div><div className="article-views"><span>{article.views}</span><small>views</small></div><ArrowRight className="row-arrow" size={16} /></button> }
function TicketRow({ ticket, onOpen }) { return <button className="ticket-row" onClick={onOpen}><div className="ticket-main"><span className="ticket-id">{ticket.id}</span><strong>{ticket.title}</strong><small>{ticket.category} <i /> {ticket.updated}</small></div><div className="ticket-meta"><span className={`status-badge ${ticket.status.toLowerCase().replace(' ', '-')}`}>{ticket.status}</span><span className={`priority ${ticket.priority.toLowerCase()}`}><i /> {ticket.priority}</span></div></button> }
function RecordModal({ title, eyebrow, onClose, children }) { return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className="modal record-modal"><div className="modal-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close record"><X size={19} /></button></div>{children}</div></div> }

export default App
