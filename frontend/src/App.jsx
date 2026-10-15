import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Baby,
  Battery,
  BookOpenText,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Database,
  Droplets,
  Eye,
  FileClock,
  GlassWater,
  HeartPulse,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Brain,
  RotateCw,
  Scale,
  Scissors,
  Sparkles,
  Search,
  ShieldCheck,
  Stethoscope,
  Thermometer,
  UserRound,
  X,
  Wind,
} from 'lucide-react'
import './App.css'

const diagnosisLabels = {
  GDM: 'เบาหวานขณะตั้งครรภ์',
  Anemia: 'ภาวะโลหิตจาง',
  'Thyroid Disorder': 'ความผิดปกติของต่อมไทรอยด์',
}

const fieldLabels = {
  id: 'ลำดับ',
  fatigue: 'อ่อนเพลีย',
  dizziness: 'เวียนศีรษะ',
  palpitations: 'ใจสั่น',
  shortness_of_breath: 'หายใจลำบาก',
  weight_change: 'น้ำหนักเปลี่ยน',
  swelling_edema: 'อาการบวม',
  poor_concentration: 'สมาธิลดลง',
  pale_skin_conjunctiva: 'ซีด',
  hair_loss: 'ผมร่วง',
  cold_intolerance: 'ทนหนาวได้น้อย',
  excessive_thirst: 'กระหายน้ำมาก',
  frequent_urination: 'ปัสสาวะบ่อย',
  blurred_vision: 'ตามัว',
  disease: 'กลุ่มภาวะ',
}

const symptomIcons = {
  fatigue: Battery,
  dizziness: RotateCw,
  palpitations: HeartPulse,
  shortness_of_breath: Wind,
  weight_change: Scale,
  swelling_edema: Droplets,
  poor_concentration: Brain,
  pale_skin_conjunctiva: UserRound,
  hair_loss: Scissors,
  cold_intolerance: Thermometer,
  excessive_thirst: GlassWater,
  frequent_urination: Sparkles,
  blurred_vision: Eye,
}

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'screening', label: 'คัดกรองภาวะผิดปกติ', icon: ClipboardCheck },
  { id: 'history', label: 'ประวัติการคัดกรอง', icon: FileClock },
  { id: 'about', label: 'เกี่ยวกับระบบ', icon: Info },
]

const symptomGroups = [
  {
    title: 'อาการทั่วไปและการเปลี่ยนแปลงของร่างกาย',
    ids: [
      'fatigue', 'dizziness', 'palpitations', 'shortness_of_breath', 'weight_change',
      'swelling_edema', 'poor_concentration', 'pale_skin_conjunctiva', 'hair_loss', 'cold_intolerance',
    ],
  },
  {
    title: 'อาการที่เกี่ยวข้องกับระดับน้ำตาล',
    ids: ['excessive_thirst', 'frequent_urination', 'blurred_vision'],
  },
]

async function requestJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดข้อมูลได้')
  return data
}

function formatDiagnosis(code) {
  return diagnosisLabels[code] ?? code ?? 'ไม่ระบุ'
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) < 0) return 'ไม่มีข้อมูล'
  const normalized = Number(value)
  return `${(normalized > 1 ? normalized : normalized * 100).toFixed(2)}%`
}

function formatCf(value) {
  return value == null || !Number.isFinite(Number(value)) ? 'ไม่มีข้อมูล' : Number(value).toFixed(2)
}

function formatDate(value) {
  if (!value) return 'ไม่มีข้อมูลวันที่'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'ไม่มีข้อมูลวันที่'
    : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function Pagination({ page, pageSize, total, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <span>แสดง {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} จาก {total} รายการ</span>
      <div className="pagination-actions">
        <button aria-label="หน้าก่อนหน้า" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">
          <ChevronLeft size={17} />
        </button>
        <span>{page} / {pageCount}</span>
        <button aria-label="หน้าถัดไป" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} type="button">
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  )
}

function EmptyState({ title, detail }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Database size={21} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function Metric({ label, value, suffix, icon: Icon }) {
  return (
    <div className="metric-tile">
      <span className="metric-heading">{Icon && <Icon aria-hidden="true" size={15} />}<span>{label}</span></span>
      <strong>{value}{suffix}</strong>
    </div>
  )
}

function App() {
  const [page, setPage] = useState('dashboard')
  const [databaseStatus, setDatabaseStatus] = useState('checking')
  const [overview, setOverview] = useState(null)
  const [overviewError, setOverviewError] = useState('')
  const [dashboardFrom, setDashboardFrom] = useState('')
  const [dashboardTo, setDashboardTo] = useState('')
  const [refreshToken, setRefreshToken] = useState(0)
  const [symptoms, setSymptoms] = useState([])
  const [symptomsLoading, setSymptomsLoading] = useState(true)
  const [selectedSymptoms, setSelectedSymptoms] = useState({})
  const [patient, setPatient] = useState({ name: '', age: '', gestationalWeeks: '' })
  const [screeningResult, setScreeningResult] = useState(null)
  const [screeningError, setScreeningError] = useState('')
  const [screeningLoading, setScreeningLoading] = useState(false)
  const [historyState, setHistoryState] = useState({ items: [], total: 0, pageSize: 10 })
  const [historySearchDraft, setHistorySearchDraft] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyDetail, setHistoryDetail] = useState(null)
  const [selectedMother, setSelectedMother] = useState(null)
  const [motherHistoryState, setMotherHistoryState] = useState({ items: [], total: 0, page: 1, pageSize: 10 })
  const [motherHistoryPage, setMotherHistoryPage] = useState(1)
  const [motherHistoryLoading, setMotherHistoryLoading] = useState(false)
  const [motherHistoryError, setMotherHistoryError] = useState('')
  const [loadingPage, setLoadingPage] = useState(true)
  const [pageError, setPageError] = useState('')

  useEffect(() => {
    let active = true
    const query = new URLSearchParams({ from: dashboardFrom, to: dashboardTo })
    Promise.all([requestJson('/api/health'), requestJson(`/api/overview?${query}`)])
      .then(([health, stats]) => {
        if (!active) return
        setDatabaseStatus(health.database)
        setOverview(stats)
        setOverviewError('')
      })
      .catch((error) => {
        if (!active) return
        setDatabaseStatus('unavailable')
        setOverviewError(error.message)
      })
    return () => { active = false }
  }, [refreshToken, dashboardFrom, dashboardTo])

  useEffect(() => {
    let active = true
    requestJson('/api/symptoms')
      .then((data) => { if (active) setSymptoms(data.symptoms) })
      .catch((error) => { if (active) setScreeningError(error.message) })
      .finally(() => { if (active) setSymptomsLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (page !== 'history') return undefined
    let active = true
    const query = new URLSearchParams({ page: String(historyPage), pageSize: '10', q: historySearch })
    requestJson(`/api/history?${query}`)
      .then((data) => { if (active) { setHistoryState(data); setPageError('') } })
      .catch((error) => { if (active) setPageError(error.message) })
      .finally(() => { if (active) setLoadingPage(false) })
    return () => { active = false }
  }, [page, historyPage, historySearch, refreshToken])

  useEffect(() => {
    if (!historyDetail?.id) return undefined
    let active = true
    requestJson(`/api/history/${historyDetail.id}`)
      .then((data) => { if (active) setHistoryDetail(data.item) })
      .catch((error) => { if (active) setPageError(error.message) })
    return () => { active = false }
  }, [historyDetail?.id])

  useEffect(() => {
    if (!selectedMother?.id) return undefined
    let active = true
    const query = new URLSearchParams({ page: String(motherHistoryPage), pageSize: '10' })
    requestJson(`/api/history/mother/${selectedMother.id}?${query}`)
      .then((data) => { if (active) { setMotherHistoryState(data); setMotherHistoryError('') } })
      .catch((error) => { if (active) setMotherHistoryError(error.message) })
      .finally(() => { if (active) setMotherHistoryLoading(false) })
    return () => { active = false }
  }, [selectedMother?.id, motherHistoryPage, refreshToken])

  function navigate(nextPage) {
    setPage(nextPage)
    if (nextPage === 'history') setLoadingPage(true)
    setPageError('')
    if (nextPage !== 'history') setHistoryDetail(null)
  }

  function updatePatient(field, value) {
    setPatient((current) => ({ ...current, [field]: value }))
  }

  function resetScreening() {
    setPatient({ name: '', age: '', gestationalWeeks: '' })
    setSelectedSymptoms({})
    setScreeningResult(null)
    setScreeningError('')
    setPage('screening')
  }

  async function submitScreening(event) {
    event.preventDefault()
    setScreeningLoading(true)
    setScreeningError('')
    try {
      const data = await requestJson('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: patient.name,
          age: Number(patient.age),
          gestationalWeeks: Number(patient.gestationalWeeks),
          symptoms: Object.fromEntries(symptoms.map(({ id }) => [id, Boolean(selectedSymptoms[id])])),
        }),
      })
      setScreeningResult(data)
      setRefreshToken((current) => current + 1)
      setPage('result')
    } catch (error) {
      setScreeningError(error.message)
    } finally {
      setScreeningLoading(false)
    }
  }

  function applyHistorySearch(event) {
    event.preventDefault()
    const nextSearch = historySearchDraft.trim()
    if (historyPage !== 1 || historySearch !== nextSearch) setLoadingPage(true)
    setHistoryPage(1)
    setHistorySearch(nextSearch)
  }

  const activeNav = page === 'result' ? 'screening' : page
  const pageTitle = navigation.find(({ id }) => id === activeNav)?.label ?? 'ผลการคัดกรอง'
  const selectedCount = Object.values(selectedSymptoms).filter(Boolean).length
  const selectAll = () => setSelectedSymptoms(Object.fromEntries(symptoms.map(({ id }) => [id, true])))
  const clearScreeningInputs = () => {
    setPatient({ name: '', age: '', gestationalWeeks: '' })
    setSelectedSymptoms({})
    setScreeningError('')
  }

  return (
    <div className="portal-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#dashboard" onClick={(event) => { event.preventDefault(); navigate('dashboard') }}>
          <span className="brand-mark"><Baby size={22} strokeWidth={1.8} /><HeartPulse className="brand-pulse" size={12} /></span>
          <span><strong>MOMMY</strong><small>MATERNAL HEALTH SYSTEM</small></span>
        </a>
        <div className="sidebar-label">เมนูหลัก</div>
        <nav className="main-navigation" aria-label="เมนูหลัก">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button className={`nav-link${activeNav === id ? ' is-active' : ''}`} key={id} onClick={() => navigate(id)} type="button">
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {activeNav === id && <span className="active-marker" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className={`connection-indicator ${databaseStatus === 'ready' ? 'is-ready' : databaseStatus === 'checking' ? 'is-checking' : ''}`} />
          <span>{databaseStatus === 'ready' ? 'เชื่อมต่อฐานข้อมูลแล้ว' : databaseStatus === 'checking' ? 'กำลังตรวจสอบฐานข้อมูล' : 'ฐานข้อมูลไม่พร้อม'}</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>ระบบผู้เชี่ยวชาญทางการแพทย์</span><ArrowRight size={13} /><strong>{pageTitle}</strong></div>
          <div className={`database-badge ${databaseStatus === 'ready' ? 'is-ready' : 'is-offline'}`}>
            <span />{databaseStatus === 'ready' ? 'MySQL พร้อมใช้งาน' : databaseStatus === 'checking' ? 'กำลังเชื่อมต่อ' : 'ไม่พบการเชื่อมต่อ'}
          </div>
        </header>

        {page === 'dashboard' && (
          <DashboardView
            overview={overview}
            error={overviewError}
            from={dashboardFrom}
            to={dashboardTo}
            onFromChange={setDashboardFrom}
            onToChange={setDashboardTo}
            onStart={() => { setScreeningResult(null); setPage('screening') }}
            databaseStatus={databaseStatus}
          />
        )}

        {page === 'screening' && (
          <ScreeningView
            patient={patient}
            symptoms={symptoms}
            symptomsLoading={symptomsLoading}
            groups={symptomGroups}
            selectedSymptoms={selectedSymptoms}
            selectedCount={selectedCount}
            loading={screeningLoading}
            error={screeningError}
            onPatientChange={updatePatient}
            onToggle={(id) => setSelectedSymptoms((current) => ({ ...current, [id]: !current[id] }))}
            onSelectAll={selectAll}
            onClear={clearScreeningInputs}
            onSubmit={submitScreening}
            onBack={() => navigate('dashboard')}
          />
        )}

        {page === 'result' && screeningResult && (
          <ResultView result={screeningResult} onEdit={() => setPage('screening')} onReset={resetScreening} />
        )}

        {page === 'history' && (
          <HistoryView
            state={historyState}
            searchDraft={historySearchDraft}
            onSearchDraft={setHistorySearchDraft}
            onSearch={applyHistorySearch}
            onPage={(nextPage) => { setLoadingPage(true); setHistoryPage(nextPage) }}
            loading={loadingPage}
            error={pageError}
            detail={historyDetail}
            onSelect={setHistoryDetail}
            onCloseDetail={() => setHistoryDetail(null)}
            selectedMother={selectedMother}
            motherHistory={motherHistoryState}
            motherHistoryLoading={motherHistoryLoading}
            motherHistoryError={motherHistoryError}
            onSelectMother={(mother) => { setSelectedMother(mother); setMotherHistoryPage(1); setMotherHistoryLoading(true); setHistoryDetail(null) }}
            onCloseMother={() => setSelectedMother(null)}
            onMotherPage={(nextPage) => { setMotherHistoryLoading(true); setMotherHistoryPage(nextPage) }}
          />
        )}

        {page === 'about' && <AboutView databaseStatus={databaseStatus} />}
        <footer className="app-footer"><ShieldCheck size={15} /> ผลลัพธ์เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์</footer>
      </main>
    </div>
  )
}

function PageIntro({ eyebrow, title, description, action }) {
  return (
    <div className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function DashboardView({ overview, error, from, to, onFromChange, onToChange, onStart, databaseStatus }) {
  const hasPeriodSummary = Number.isFinite(overview?.periodPredictionCount) && Array.isArray(overview?.predictionGroups)
  return (
    <div className="view dashboard-view">
      <PageIntro eyebrow="MATERNAL HEALTH · OVERVIEW" title="ภาพรวมระบบ" description="ข้อมูลจากฐานข้อมูลโครงงาน ณ ปัจจุบัน" />
      <section className="welcome-banner">
        <div className="welcome-content">
          <span className="welcome-kicker"><HeartPulse size={15} /> Pregnancy screening workspace</span>
          <h2>คัดกรองอย่างเป็นระบบ<br /><span>ด้วยข้อมูลและกฎที่ตรวจสอบได้</span></h2>
          <p>เลือกอายุครรภ์และอาการ ระบบจะเทียบกับกฎในฐานความรู้และบันทึกผลลงฐานข้อมูล</p>
          <button className="primary-button" onClick={onStart} type="button">เริ่มคัดกรอง <ArrowRight size={17} /></button>
        </div>
        <div className="welcome-art" aria-hidden="true"><span className="art-ring ring-one" /><span className="art-ring ring-two" /><span className="art-heart"><HeartPulse size={51} strokeWidth={1.25} /></span><span className="art-dot dot-one" /><span className="art-dot dot-two" /></div>
      </section>

      {error && <div className="inline-error" role="alert">{error}</div>}
      <div className="section-title-row"><div><p className="eyebrow">LIVE DATABASE</p><h2>ข้อมูลในระบบ</h2></div><span className={`source-label ${databaseStatus === 'ready' ? 'is-live' : ''}`}><span />{databaseStatus === 'ready' ? 'ข้อมูลจริงจาก MySQL' : 'ยังเชื่อมต่อไม่ได้'}</span></div>
      <section className="stats-grid" aria-label="สถิติระบบ">
        <article className="stat-card"><span className="stat-icon icon-pink"><Database size={20} /></span><div><span>ข้อมูลใน Dataset</span><strong>{overview ? overview.datasetCount.toLocaleString('th-TH') : '—'}</strong><small>รายการข้อมูล</small></div></article>
        <article className="stat-card"><span className="stat-icon icon-lilac"><BookOpenText size={20} /></span><div><span>กฎในฐานความรู้</span><strong>{overview ? overview.ruleCount.toLocaleString('th-TH') : '—'}</strong><small>กฎจาก expert_rules</small></div></article>
        <article className="stat-card"><span className="stat-icon icon-mint"><ClipboardCheck size={20} /></span><div><span>รายการคัดกรอง</span><strong>{overview ? overview.predictionCount.toLocaleString('th-TH') : '—'}</strong><small>{overview?.predictionCount === 0 ? 'ยังไม่มีประวัติ' : 'รายการใน predictions'}</small></div></article>
      </section>
      <section className="dashboard-panel period-summary">
        <div className="panel-heading"><div><p className="eyebrow">SCREENING OVERVIEW</p><h2>สรุปผลการคัดกรองตามช่วงวันที่</h2></div><Activity size={19} /></div>
        <div className="period-filters">
          <label>ตั้งแต่วันที่<input aria-label="วันที่เริ่มต้น" max={to || undefined} onChange={(event) => onFromChange(event.target.value)} type="date" value={from} /></label>
          <label>ถึงวันที่<input aria-label="วันที่สิ้นสุด" min={from || undefined} onChange={(event) => onToChange(event.target.value)} type="date" value={to} /></label>
          {(from || to) && <button className="quiet-button" onClick={() => { onFromChange(''); onToChange('') }} type="button">ล้างวันที่</button>}
        </div>
        {hasPeriodSummary ? <>
          <div className="period-total"><strong>{overview.periodPredictionCount.toLocaleString('th-TH')}</strong><span>รายการในช่วงที่เลือก{!from && !to ? ' (ทั้งหมด)' : ''}</span></div>
          {overview.predictionGroups.length ? <div className="period-groups">{overview.predictionGroups.map((group) => {
          const count = Number(group.count)
          const percentage = overview.periodPredictionCount ? (count / overview.periodPredictionCount) * 100 : 0
          return <div className="period-group" key={group.code}><div><span>{group.label}</span><strong>{count.toLocaleString('th-TH')} รายการ · {percentage.toFixed(1)}%</strong></div><span className="period-track"><span style={{ width: `${percentage}%` }} /></span></div>
          })}</div> : <p className="period-empty">ไม่มีรายการคัดกรองในช่วงวันที่นี้</p>}
        </> : <div className="inline-error" role="alert">ข้อมูลสรุปยังไม่พร้อม กรุณารีสตาร์ท Backend เพื่อโหลดข้อมูลสถิติรุ่นล่าสุด</div>}
      </section>
      <section className="dashboard-lower">
        <article className="dashboard-panel group-panel"><div className="panel-heading"><div><p className="eyebrow">DATASET CLASSES</p><h2>กลุ่มข้อมูลที่มีอยู่</h2></div><Activity size={19} /></div>
          {overview?.datasetGroups?.length ? <div className="group-list">{overview.datasetGroups.map((group) => <div className="group-row" key={group.code}><span className={`group-dot ${group.code === 'GDM' ? 'dot-rose' : group.code === 'Anemia' ? 'dot-violet' : 'dot-blue'}`} /><span>{group.label}</span><strong>{group.count.toLocaleString('th-TH')}</strong></div>)}</div> : <EmptyState title="ไม่มีข้อมูล Dataset" detail="ระบบจะแสดงกลุ่มเมื่อฐานข้อมูลมีรายการ" />}
        </article>
        <article className="dashboard-panel guide-panel"><div className="panel-heading"><div><p className="eyebrow">QUICK GUIDE</p><h2>เริ่มต้นใช้งาน</h2></div><CalendarDays size={19} /></div>
          <ol className="guide-list"><li><span>01</span><p><strong>กรอกข้อมูลเบื้องต้น</strong><small>ชื่อ อายุ และอายุครรภ์เป็นสัปดาห์</small></p></li><li><span>02</span><p><strong>เลือกอาการที่พบ</strong><small>เลือกตามข้อมูลจริงของผู้รับการคัดกรอง</small></p></li><li><span>03</span><p><strong>ตรวจผลการจับคู่กฎ</strong><small>ระบบแสดงกฎที่ตรงและแหล่งข้อมูล</small></p></li></ol>
        </article>
      </section>
      <p className="data-note"><Info size={15} /> ระบบอ่านจำนวนข้อมูลจาก MySQL โดยตรง หากฐานข้อมูลยังไม่มีรายการ ระบบจะแสดงสถานะว่างโดยไม่สร้างข้อมูลตัวอย่าง</p>
    </div>
  )
}

function ScreeningView({ patient, symptoms, symptomsLoading, groups, selectedSymptoms, selectedCount, loading, error, onPatientChange, onToggle, onSelectAll, onClear, onSubmit, onBack }) {
  return (
    <div className="view screening-view">
      <PageIntro eyebrow="SCREENING WORKFLOW" title="คัดกรองภาวะผิดปกติ" description="ข้อมูลนี้ใช้จับคู่กับกฎในฐานข้อมูล ไม่ใช่การวินิจฉัยโรค" action={<span className="step-pill">ขั้นตอน 1 จาก 2</span>} />
      <form className="screening-form" onSubmit={onSubmit}>
        <section className="form-panel">
          <div className="form-panel-heading"><span className="section-number">01</span><div><h2>ข้อมูลเบื้องต้น</h2><p>กรอกข้อมูลที่จำเป็นสำหรับบันทึกและตรวจช่วงอายุครรภ์ของกฎ</p></div></div>
          <div className="basic-fields">
            <label className="input-field"><span>ชื่อผู้รับการคัดกรอง</span><input autoComplete="off" maxLength="100" onChange={(event) => onPatientChange('name', event.target.value)} placeholder="กรอกชื่อ" required value={patient.name} /></label>
            <label className="input-field"><span>อายุ</span><div className="input-with-unit"><input inputMode="numeric" max="100" min="10" onChange={(event) => onPatientChange('age', event.target.value)} placeholder="เช่น 28" required type="number" value={patient.age} /><span>ปี</span></div></label>
            <label className="input-field"><span>อายุครรภ์</span><div className="input-with-unit"><input inputMode="numeric" max="42" min="1" onChange={(event) => onPatientChange('gestationalWeeks', event.target.value)} placeholder="เช่น 24" required type="number" value={patient.gestationalWeeks} /><span>สัปดาห์</span></div></label>
          </div>
          <p className="field-help"><Info size={14} /> รองรับอายุครรภ์ 1–42 สัปดาห์ โดยกฎแต่ละข้อจะตรวจช่วง min/max จากฐานความรู้</p>
        </section>

        <section className="form-panel symptoms-panel">
          <div className="form-panel-heading"><span className="section-number">02</span><div><h2>เลือกอาการ</h2><p>รายการอาการอ้างอิงคอลัมน์จริงจากตาราง Dataset</p></div><span className="selection-count">เลือก {selectedCount} / {symptoms.length}</span></div>
          {symptomsLoading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> กำลังโหลดอาการจากฐานข้อมูล</div> : symptoms.length === 0 ? <EmptyState title="ไม่พบรายการอาการ" detail="ตรวจสอบคอลัมน์ในตาราง dataset" /> : (
            <>
              <div className="selection-tools"><span><Check size={14} /> เลือกได้หลายอาการ</span><div><button onClick={onSelectAll} type="button">เลือกทั้งหมด</button><button onClick={onClear} type="button">ล้างรายการ</button></div></div>
              {groups.map((group) => {
                const groupSymptoms = group.ids.map((id) => symptoms.find((item) => item.id === id)).filter(Boolean)
                if (!groupSymptoms.length) return null
                return <fieldset className="symptom-group" key={group.title}><legend>{group.title}</legend><div className="symptom-grid">{groupSymptoms.map((symptom) => {
                  const SymptomIcon = symptomIcons[symptom.id] ?? Activity
                  return <label className={`symptom-choice${selectedSymptoms[symptom.id] ? ' is-selected' : ''}`} key={symptom.id}><input checked={Boolean(selectedSymptoms[symptom.id])} onChange={() => onToggle(symptom.id)} type="checkbox" /><span className="custom-check"><Check size={13} /></span><span className="symptom-icon-badge" title={symptom.id}><SymptomIcon aria-hidden="true" size={15} strokeWidth={1.8} /></span><span className="symptom-label"><strong>{symptom.label}</strong><small>{symptom.english}</small></span></label>
                })}</div></fieldset>
              })}
              <p className="field-help symptoms-source"><Database size={14} /> พบอาการ {symptoms.length} รายการจาก Dataset ใน MySQL</p>
            </>
          )}
        </section>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <div className="screening-actions"><button className="quiet-button" onClick={onBack} type="button"><ArrowLeft size={16} /> กลับ Dashboard</button><button className="primary-button" disabled={loading || symptomsLoading || !symptoms.length} type="submit">{loading ? 'กำลังประมวลผล...' : 'ประมวลผลการคัดกรอง'}<ArrowRight size={17} /></button></div>
      </form>
    </div>
  )
}

function ResultView({ result, onEdit, onReset }) {
  const grouped = result.matches.reduce((groups, rule) => {
    const existing = groups.find((group) => group.diagnosis === rule.diagnosis)
    if (existing) existing.rules.push(rule)
    else groups.push({ diagnosis: rule.diagnosis, rules: [rule] })
    return groups
  }, [])
  const inputSymptoms = result.inference?.inputSymptoms ?? []
  const gestationalWeeks = result.inference?.gestationalWeeks
  const detectedDiagnoses = (result.diagnoses ?? []).map(formatDiagnosis)
  const hasDetectedDiagnoses = !result.noMatch && detectedDiagnoses.length > 0
  return (
    <div className="view result-view">
      <PageIntro eyebrow="SCREENING RESULT" title="ผลการคัดกรอง" description="แสดงผลจากการจับคู่ข้อมูลกับกฎที่มีอยู่ในฐานข้อมูล" action={<span className="saved-status"><Check size={14} /> บันทึกแล้ว · {result.predictionIds?.length ?? 0} รายการ</span>} />
      <section className={`result-summary${result.noMatch ? ' is-no-match' : ''}`}>
        <div className="result-summary-main">
          <div className="result-summary-icon"><Stethoscope size={25} /></div>
          <div className="result-summary-copy">
            <span className="eyebrow">INFERENCE SUMMARY</span>
            <h2>{result.noMatch ? 'ไม่พบกฎที่ตรงกับข้อมูลที่ป้อน' : `พบ ${detectedDiagnoses.length} กลุ่มภาวะตามกฎ`}</h2>
            <p>{result.matchedRuleCount} กฎตรง · เลือกอาการ {inputSymptoms.length} รายการ{Number.isFinite(Number(gestationalWeeks)) ? ` · อายุครรภ์ ${gestationalWeeks} สัปดาห์` : ''}</p>
          </div>
        </div>
        <div className={`result-diagnosis-highlight${hasDetectedDiagnoses ? '' : ' is-empty'}`}>
          <span className="result-diagnosis-kicker"><ShieldCheck size={15} /> ผลคัดกรองที่พบ</span>
          {hasDetectedDiagnoses ? (
            <div className="result-diagnosis-list">
              {detectedDiagnoses.map((diagnosis) => <strong key={diagnosis}>{diagnosis}</strong>)}
            </div>
          ) : <strong className="result-diagnosis-empty">ยังไม่พบภาวะที่ตรงกับกฎ</strong>}
          <span className="result-diagnosis-count"><HeartPulse size={14} /> {hasDetectedDiagnoses ? `พบ ${detectedDiagnoses.length} กลุ่มภาวะ` : 'ไม่มีผลลัพธ์ที่ตรงกัน'}</span>
        </div>
      </section>
      <section className="inference-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">HOW IT MATCHED</p><h2>ขั้นตอนการอนุมาน</h2></div>
          <Activity className="inference-heading-icon" size={20} />
        </div>
        <div className="inference-flow">
          <div className="inference-step">
            <span className="inference-icon"><ClipboardCheck size={17} /></span>
            <span className="inference-step-copy"><small>INPUT · อาการที่เลือก</small><strong>{inputSymptoms.length ? inputSymptoms.map(({ label }) => label).join(' · ') : 'ไม่ได้เลือกอาการ'}</strong></span>
          </div>
          <ArrowRight className="flow-arrow" size={18} />
          <div className="inference-step">
            <span className="inference-icon pregnancy-icon"><CalendarDays size={17} /></span>
            <span className="inference-step-copy"><small>อายุครรภ์</small><strong>{Number.isFinite(Number(gestationalWeeks)) ? `${gestationalWeeks} สัปดาห์` : 'ไม่มีข้อมูล'}</strong></span>
          </div>
          <ArrowRight className="flow-arrow" size={18} />
          <div className="inference-step">
            <span className="inference-icon rule-icon"><Activity size={17} /></span>
            <span className="inference-step-copy"><small>RULE · กฎที่ตรง</small><strong>{result.inference?.matchedRuleCodes?.length ? result.inference.matchedRuleCodes.join(', ') : 'ไม่พบกฎตรง'}</strong></span>
          </div>
        </div>
        <p className="inference-method">{result.inference?.method ?? 'ระบบตรวจสอบเงื่อนไขอาการและช่วงอายุครรภ์เพื่อจับคู่กฎที่เกี่ยวข้อง'}</p>
      </section>
      {result.noMatch ? (
        <div className="result-empty-wrap">
          <EmptyState title="ยังไม่พบกฎที่ตรงกับข้อมูลนี้" detail="ผลนี้ไม่ได้หมายความว่าปกติ หากมีอาการรุนแรงหรือกังวลเกี่ยวกับสุขภาพ ควรปรึกษาบุคลากรทางการแพทย์" />
        </div>
      ) : grouped.map((group) => (
        <section className="diagnosis-panel" key={group.diagnosis}>
          <div className="diagnosis-heading">
            <div><p className="eyebrow">RULE RESULTS</p><h2>ผลลัพธ์ตามกฎ</h2><p className="diagnosis-subtitle">กลุ่มภาวะตามข้อมูลในกฎ: {formatDiagnosis(group.diagnosis)}</p></div>
            <span className="rule-count">{group.rules.length} กฎ</span>
          </div>
          {group.rules.map((rule) => (
            <article className="matched-rule" key={rule.ruleCode}>
              <div className="matched-rule-heading"><strong>{rule.ruleCode}</strong><span><CalendarDays size={14} /> อายุครรภ์ {rule.minWeeks}–{rule.maxWeeks} สัปดาห์</span></div>
              <div className="rule-conditions">
                <p className="condition-line"><span>IF</span><strong>{rule.symptomLabels.join(' + ')}</strong></p>
                <p className="condition-line then-condition"><span>THEN</span><strong>{formatDiagnosis(rule.diagnosis)}</strong></p>
              </div>
              <dl className="result-metrics">
                <Metric icon={Activity} label="Support" value={formatPercent(rule.support)} />
                <Metric icon={HeartPulse} label="Confidence" value={formatPercent(rule.confidence)} />
                <Metric icon={ShieldCheck} label="CF" value={formatCf(rule.cf)} />
              </dl>
            </article>
          ))}
        </section>
      ))}
      <section className="caution-panel"><ShieldCheck size={19} /><p>ผลลัพธ์นี้เป็นเพียงการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์ หากมีอาการรุนแรงหรือกังวลเกี่ยวกับสุขภาพ ควรปรึกษาบุคลากรทางการแพทย์</p></section>
      <div className="screening-actions result-actions"><button className="quiet-button" onClick={onEdit} type="button"><ArrowLeft size={16} /> กลับไปแก้ไขข้อมูล</button><button className="primary-button" onClick={onReset} type="button">เริ่มคัดกรองใหม่ <ArrowRight size={17} /></button></div>
    </div>
  )
}

function HistoryView({ state, searchDraft, onSearchDraft, onSearch, onPage, loading, error, detail, onSelect, onCloseDetail, selectedMother, motherHistory, motherHistoryLoading, motherHistoryError, onSelectMother, onCloseMother, onMotherPage }) {
  return (
    <div className="view history-view">
      <PageIntro eyebrow="SCREENING RECORDS" title="ประวัติการคัดกรอง" description="รายการที่บันทึกไว้ในตาราง predictions เรียงจากล่าสุด" />
      <form className="filter-bar history-filter" onSubmit={onSearch}><label className="search-control"><Search size={17} /><input onChange={(event) => onSearchDraft(event.target.value)} placeholder="ค้นหาชื่อคุณแม่ กลุ่มภาวะ หรือรหัสกฎ" value={searchDraft} /></label><button className="filter-button" type="submit">ค้นหา</button></form>
      {selectedMother && <section className="history-detail mother-history"><div className="panel-heading"><div><p className="eyebrow">MOTHER SCREENING TIMELINE</p><h2>ประวัติของ {selectedMother.name}</h2></div><button className="icon-button" aria-label="ปิดประวัติคุณแม่" onClick={onCloseMother} type="button"><X size={17} /></button></div>
        {motherHistoryError && <div className="inline-error" role="alert">{motherHistoryError}</div>}
        {motherHistoryLoading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> กำลังโหลดประวัติคุณแม่</div> : motherHistory.items.length ? <><div className="table-scroll"><table className="history-table"><thead><tr><th>วันที่และเวลา</th><th>กลุ่มภาวะ</th><th>Rule</th><th>อายุครรภ์</th><th></th></tr></thead><tbody>{motherHistory.items.map((item) => <tr key={item.id}><td>{formatDate(item.created_at)}</td><td>{formatDiagnosis(item.disease)}</td><td>{item.rule_code ?? '—'}</td><td>{item.gestational_weeks ? `${item.gestational_weeks} สัปดาห์` : '—'}</td><td><button className="details-button" onClick={() => onSelect(item)} type="button">ดูรายละเอียด <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div><Pagination page={motherHistory.page} pageSize={motherHistory.pageSize} total={motherHistory.total} onPageChange={onMotherPage} /></> : <EmptyState title="ยังไม่มีประวัติของคุณแม่" detail="ไม่พบรายการคัดกรองสำหรับคุณแม่ท่านนี้" />}
      </section>}
      {error && <div className="inline-error" role="alert">{error}</div>}
      {loading ? <div className="loading-state"><LoaderCircle className="spin" size={20} /> กำลังโหลดประวัติ</div> : state.items.length ? <><div className="table-scroll"><table className="history-table"><thead><tr><th>วันที่และเวลา</th><th>ชื่อคุณแม่</th><th>กลุ่มภาวะตามบันทึก</th><th>Rule</th><th>อายุครรภ์</th><th></th></tr></thead><tbody>{state.items.map((item) => <tr key={item.id}><td>{formatDate(item.created_at)}</td><td>{item.mother_id && item.mother_name ? <button className="mother-name-button" onClick={() => onSelectMother({ id: item.mother_id, name: item.mother_name })} type="button">{item.mother_name}</button> : '—'}</td><td>{formatDiagnosis(item.disease)}</td><td>{item.rule_code ?? '—'}</td><td>{item.gestational_weeks ? `${item.gestational_weeks} สัปดาห์` : '—'}</td><td><button className="details-button" onClick={() => onSelect(item)} type="button">ดูรายละเอียด <ArrowRight size={14} /></button></td></tr>)}</tbody></table></div><Pagination page={state.page} pageSize={state.pageSize} total={state.total} onPageChange={onPage} /></> : <EmptyState title="ยังไม่มีรายการคัดกรอง" detail="เมื่อบันทึกผลจากหน้าคัดกรอง รายการจะแสดงที่นี่" />}
      {detail && <HistoryDetail item={detail} onClose={onCloseDetail} />}
    </div>
  )
}

function HistoryDetail({ item, onClose }) {
  const selected = Array.isArray(item.selectedSymptoms) ? item.selectedSymptoms : []
  return <section className="history-detail"><div className="panel-heading"><div><p className="eyebrow">RECORD #{item.id}</p><h2>รายละเอียดรายการ</h2></div><button className="icon-button" aria-label="ปิดรายละเอียด" onClick={onClose} type="button"><X size={17} /></button></div><dl className="detail-grid"><div><dt>ชื่อคุณแม่</dt><dd>{item.mother_name ?? 'ไม่มีข้อมูล'}</dd></div><div><dt>วันที่บันทึก</dt><dd>{formatDate(item.created_at)}</dd></div><div><dt>กลุ่มภาวะ</dt><dd>{formatDiagnosis(item.disease)}</dd></div><div><dt>กฎ</dt><dd>{item.rule_code ?? 'ไม่พบกฎตรง'}</dd></div><div><dt>อายุครรภ์</dt><dd>{item.gestational_weeks ? `${item.gestational_weeks} สัปดาห์` : 'ไม่มีข้อมูล'}</dd></div><div><dt>Support</dt><dd>{item.support == null ? 'ไม่มีข้อมูล' : formatPercent(item.support)}</dd></div><div><dt>Confidence</dt><dd>{item.confidence == null ? 'ไม่มีข้อมูล' : formatPercent(item.confidence)}</dd></div><div><dt>CF</dt><dd>{formatCf(item.cf)}</dd></div></dl><div className="detail-symptoms"><strong>อาการที่บันทึก</strong><p>{selected.length ? selected.map((id) => fieldLabels[id] ?? id).join(' · ') : 'ไม่มีข้อมูลอาการในประวัติเดิม'}</p></div></section>
}

function AboutView({ databaseStatus }) {
  return (
    <div className="view about-view">
      <PageIntro eyebrow="SYSTEM INFORMATION" title="เกี่ยวกับระบบ" description="ข้อมูลประกอบการสาธิตโครงงานรายวิชาระบบผู้เชี่ยวชาญทางการแพทย์" />
      <section className="about-hero"><span className="about-emblem"><Baby size={28} /><HeartPulse size={15} /></span><p className="eyebrow">MEDICAL EXPERT SYSTEM</p><h2>ระบบผู้เชี่ยวชาญทางการแพทย์<br />สำหรับคัดกรองภาวะผิดปกติระหว่างตั้งครรภ์</h2><p>ระบบเปรียบเทียบอายุครรภ์และอาการที่ผู้ใช้เลือกกับกฎ IF–THEN ที่อ่านจากฐานข้อมูลเดิม</p></section>
      <section className="about-grid"><article><h3>เทคโนโลยี</h3><p>Frontend: React, HTML, CSS และ JavaScript</p><p>Backend: Node.js และ Express REST API</p><p>Database: MySQL · จัดการได้ด้วย phpMyAdmin</p></article><article><h3>ตารางที่เชื่อมต่อ</h3><p><code>dataset</code> · ข้อมูลอาการและผลลัพธ์</p><p><code>expert_rules</code> · กฎและค่าสถิติ</p><p><code>mothers</code> · ข้อมูลผู้รับการคัดกรอง</p><p><code>predictions</code> · ประวัติผลการคัดกรอง</p></article></section>
      <section className="caution-panel"><ShieldCheck size={18} /><p>ต้นแบบนี้มีไว้เพื่อการศึกษา กฎและค่าสถิติต้องผ่านการตรวจสอบจากผู้เชี่ยวชาญก่อนนำไปใช้ทางคลินิก ข้อมูลสถานะฐานข้อมูล: <strong>{databaseStatus === 'ready' ? 'เชื่อมต่อแล้ว' : 'ยังไม่พร้อม'}</strong></p></section>
    </div>
  )
}

export default App
