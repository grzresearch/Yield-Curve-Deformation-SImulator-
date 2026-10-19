/**
 * UI strings. Every key carries both languages side by side, so a missing
 * translation is a type error rather than a blank label.
 */
export type Lang = 'de' | 'en';

const dict = {
  // Shell
  appName: { de: 'Yield Curve Simulator', en: 'Yield Curve Simulator' },
  appTagline: { de: 'Zinskurven · Fed-Erwartungen · Risiko', en: 'Yield curves · Fed expectations · Risk' },
  navOverview: { de: 'Markt', en: 'Market' },
  navCurve: { de: 'Kurvenanalyse', en: 'Curve analytics' },
  navFedwatch: { de: 'FedWatch', en: 'FedWatch' },
  navPolicy: { de: 'Fed-Szenario', en: 'Fed scenario' },
  navShocks: { de: 'Kurvenschocks', en: 'Curve shocks' },
  navBond: { de: 'Anleihe', en: 'Bond' },
  navPortfolio: { de: 'Portfolio', en: 'Portfolio' },
  navStress: { de: 'Stresstest', en: 'Stress test' },
  navData: { de: 'Daten & API', en: 'Data & API' },
  groupMarket: { de: 'Markt', en: 'Market' },
  groupSimulate: { de: 'Simulation', en: 'Simulation' },
  groupRisk: { de: 'Risiko', en: 'Risk' },
  themeToggle: { de: 'Farbschema wechseln', en: 'Toggle colour scheme' },
  langToggle: { de: 'Sprache', en: 'Language' },
  shareLink: { de: 'Link teilen', en: 'Share link' },
  linkCopied: { de: 'Link mit allen Einstellungen kopiert', en: 'Link with all settings copied' },
  loading: { de: 'Marktdaten werden geladen …', en: 'Loading market data …' },
  loadError: { de: 'Marktdaten konnten nicht geladen werden', en: 'Market data could not be loaded' },
  dataAsOf: { de: 'Stand', en: 'As of' },
  dataLive: { de: 'Live-Daten', en: 'Live data' },
  dataStale: { de: 'Teilweise veraltet', en: 'Partly stale' },
  footerNote: {
    de: 'Alle Berechnungen laufen lokal im Browser. Keine Anlageberatung.',
    en: 'All calculations run locally in your browser. Not investment advice.'
  },

  // Global curve controls
  curveSource: { de: 'Kurve', en: 'Curve' },
  sourceUst: { de: 'US-Treasury', en: 'US Treasury' },
  sourceEcb: { de: 'Euroraum AAA (EZB)', en: 'Euro area AAA (ECB)' },
  sourceSample: { de: 'Beispiel (README)', en: 'Example (README)' },
  sourceCustom: { de: 'Eigene Kurve', en: 'Custom curve' },
  curveDate: { de: 'Stichtag', en: 'Date' },
  latest: { de: 'Aktuell', en: 'Latest' },
  basis: { de: 'Basis', en: 'Basis' },
  basisZero: { de: 'Zero (gebootstrappt)', en: 'Zero (bootstrapped)' },
  basisPar: { de: 'Par roh', en: 'Raw par' },
  basisHint: {
    de: 'Treasury veröffentlicht Par-Renditen. Für Bewertung und Risiko wird daraus eine Zero-Kurve gebootstrappt, die alle Par-Anleihen exakt zu 100 bewertet.',
    en: 'Treasury publishes par yields. Pricing and risk use a zero curve bootstrapped from them that reprices every par bond at exactly 100.'
  },
  interpolation: { de: 'Interpolation', en: 'Interpolation' },
  interpCubic: { de: 'Kubischer Spline', en: 'Cubic spline' },
  interpPchip: { de: 'PCHIP', en: 'PCHIP' },
  interpLinear: { de: 'Linear', en: 'Linear' },

  // Common terms
  tenor: { de: 'Laufzeit', en: 'Tenor' },
  years: { de: 'Jahre', en: 'years' },
  yieldPct: { de: 'Rendite (%)', en: 'Yield (%)' },
  ratePct: { de: 'Zins (%)', en: 'Rate (%)' },
  changeBps: { de: 'Änderung (Bp)', en: 'Change (bp)' },
  bpsUnit: { de: 'Bp', en: 'bp' },
  date: { de: 'Datum', en: 'Date' },
  value: { de: 'Wert', en: 'Value' },
  price: { de: 'Kurs', en: 'Price' },
  base: { de: 'Basis', en: 'Base' },
  shocked: { de: 'Geschockt', en: 'Shocked' },
  scenario: { de: 'Szenario', en: 'Scenario' },
  market: { de: 'Markt', en: 'Market' },
  total: { de: 'Gesamt', en: 'Total' },
  showTable: { de: 'Tabelle', en: 'Table' },
  showChart: { de: 'Grafik', en: 'Chart' },
  exportCsv: { de: 'CSV für Excel', en: 'CSV for Excel' },
  copyTable: { de: 'Kopieren (Excel)', en: 'Copy (Excel)' },
  copied: { de: 'Kopiert', en: 'Copied' },
  reset: { de: 'Zurücksetzen', en: 'Reset' },
  add: { de: 'Hinzufügen', en: 'Add' },
  remove: { de: 'Entfernen', en: 'Remove' },
  zeroRate: { de: 'Zero-Zins', en: 'Zero rate' },
  parYield: { de: 'Par-Rendite', en: 'Par yield' },
  forwardRate: { de: 'Forward (instantan)', en: 'Forward (instantaneous)' },
  discountFactor: { de: 'Diskontfaktor', en: 'Discount factor' },
  quoted: { de: 'Quotiert', en: 'Quoted' },
  slope2s10s: { de: '2s10s-Spread', en: '2s10s spread' },
  slope3m10y: { de: '3M10J-Spread', en: '3m10y spread' },
  curvature: { de: 'Krümmung 2s5s10s', en: 'Curvature 2s5s10s' },
  vsPeriod: { de: 'ggü.', en: 'vs' },

  // Overview
  ovTitle: { de: 'Marktüberblick', en: 'Market overview' },
  ovSubtitle: {
    de: 'Aktuelle Zinsstruktur, Leitzins und Markterwartungen für die Fed',
    en: 'Current term structure, policy rate and market expectations for the Fed'
  },
  kpi10y: { de: '10J-Rendite', en: '10Y yield' },
  kpi2y: { de: '2J-Rendite', en: '2Y yield' },
  kpiEffr: { de: 'Fed Funds (EFFR)', en: 'Fed funds (EFFR)' },
  kpiTarget: { de: 'Zielband', en: 'Target range' },
  kpiNextFomc: { de: 'Nächste FOMC-Sitzung', en: 'Next FOMC meeting' },
  inDays: { de: 'in {n} Tagen', en: 'in {n} days' },
  today: { de: 'heute', en: 'today' },
  dayDelta: { de: 'ggü. Vortag', en: 'vs prior day' },
  curveCompare: { de: 'Zinskurve im Zeitvergleich', en: 'Yield curve over time' },
  curveCompareSub: { de: 'Quotierte Renditen nach Laufzeit', en: 'Quoted yields by tenor' },
  changeByTenor: { de: 'Veränderung je Laufzeit', en: 'Change by tenor' },
  ago1w: { de: 'vor 1 Woche', en: '1 week ago' },
  ago1m: { de: 'vor 1 Monat', en: '1 month ago' },
  ago3m: { de: 'vor 3 Monaten', en: '3 months ago' },
  ago1y: { de: 'vor 1 Jahr', en: '1 year ago' },
  ratesHistory: { de: 'Leitzins und Treasury-Renditen', en: 'Policy rate and Treasury yields' },
  spreadHistory: { de: 'Verlauf 2s10s-Spread', en: '2s10s spread history' },
  usVsEuro: { de: 'USA vs. Euroraum', en: 'US vs euro area' },
  usVsEuroSub: { de: 'Zero-Kurven im Vergleich', en: 'Zero curves compared' },
  nextMeetingOdds: { de: 'Markterwartung nächste Fed-Sitzung', en: 'Market odds for the next Fed meeting' },
  openFedwatch: { de: 'Zu FedWatch', en: 'Open FedWatch' },

  // Curve analytics
  cvTitle: { de: 'Kurvenanalyse', en: 'Curve analytics' },
  cvSubtitle: {
    de: 'Zero-, Par- und Forward-Kurve, Diskontfaktoren und Rechner',
    en: 'Zero, par and forward curves, discount factors and calculators'
  },
  curvesChart: { de: 'Zero-, Par- und Forward-Kurve', en: 'Zero, par and forward curves' },
  dfChart: { de: 'Diskontfaktoren', en: 'Discount factors' },
  interpCompare: { de: 'Einfluss der Interpolation', en: 'Effect of interpolation' },
  interpCompareSub: {
    de: 'Zero-Kurve unter allen drei Verfahren auf denselben Stützstellen',
    en: 'The zero curve under all three methods on the same nodes'
  },
  calculator: { de: 'Rechner', en: 'Calculator' },
  calcRateAt: { de: 'Zero-Zins bei', en: 'Zero rate at' },
  calcForward: { de: 'Forward-Zins von … bis', en: 'Forward rate from … to' },
  calcPar: { de: 'Par-Rendite für Laufzeit', en: 'Par yield for maturity' },
  calcDf: { de: 'Diskontfaktor bei', en: 'Discount factor at' },
  nodesTable: { de: 'Stützstellen', en: 'Curve nodes' },
  customCurveHint: {
    de: 'Werte direkt bearbeiten oder aus Excel einfügen (Laufzeit in Jahren, Zins in %).',
    en: 'Edit values directly or paste from Excel (tenor in years, rate in %).'
  },
  pasteFromExcel: { de: 'Aus Excel einfügen', en: 'Paste from Excel' },
  pasteHint: {
    de: 'Spalten aus Excel kopieren und hier einfügen. Erkannt werden Tab, Semikolon oder Komma als Trenner sowie Dezimalkomma.',
    en: 'Copy columns in Excel and paste here. Tab, semicolon or comma separators and decimal commas are recognised.'
  },
  apply: { de: 'Übernehmen', en: 'Apply' },
  cancel: { de: 'Abbrechen', en: 'Cancel' },
  forwardNote: {
    de: 'Instantane Forwards reagieren empfindlich auf die Interpolation – besonders am langen Ende bei inverser 20s30s-Struktur.',
    en: 'Instantaneous forwards are sensitive to interpolation, especially at the long end when 20s30s is inverted.'
  },

  // FedWatch
  fwTitle: { de: 'FedWatch – Zinserwartungen für die FOMC-Sitzungen', en: 'FedWatch – rate expectations for FOMC meetings' },
  fwSubtitle: {
    de: 'Wahrscheinlichkeiten nach CME-FedWatch-Methodik aus 30-Day-Fed-Funds-Futures (CBOT)',
    en: 'Probabilities using the CME FedWatch methodology on 30-Day Fed Funds futures (CBOT)'
  },
  fwMeeting: { de: 'Sitzung', en: 'Meeting' },
  fwTargetProbs: { de: 'Wahrscheinlichkeit je Zielband', en: 'Probability by target range' },
  fwTargetProbsSub: { de: 'nach der Sitzung vom {d}', en: 'after the meeting on {d}' },
  fwMatrix: { de: 'Wahrscheinlichkeiten aller Sitzungen', en: 'Probabilities for all meetings' },
  fwMatrixSub: {
    de: 'Zielband nach der jeweiligen Sitzung (Basispunkte-Bänder)',
    en: 'Target range after each meeting (basis-point ranges)'
  },
  fwPath: { de: 'Eingepreister Leitzinspfad', en: 'Priced policy-rate path' },
  fwPathSub: { de: 'Erwarteter EFFR nach jeder Sitzung', en: 'Expected EFFR after each meeting' },
  fwFutures: { de: 'Fed-Funds-Futures', en: 'Fed funds futures' },
  fwContract: { de: 'Kontrakt', en: 'Contract' },
  fwMonth: { de: 'Liefermonat', en: 'Delivery month' },
  fwImplied: { de: 'Impliziter Satz', en: 'Implied rate' },
  fwSettle: { de: 'Kursdatum', en: 'Price date' },
  fwExpected: { de: 'Erwartete Änderung', en: 'Expected change' },
  fwMostLikely: { de: 'Wahrscheinlichstes Zielband', en: 'Most likely range' },
  fwHold: { de: 'Unverändert', en: 'Hold' },
  fwHike: { de: 'Erhöhung', en: 'Hike' },
  fwCut: { de: 'Senkung', en: 'Cut' },
  fwCurrent: { de: 'aktuell', en: 'current' },
  fwExpectedRate: { de: 'Erwarteter EFFR', en: 'Expected EFFR' },
  fwTargetBand: { de: 'Aktuelles Zielband', en: 'Current target range' },
  fwMethod: { de: 'Methodik', en: 'Methodology' },
  fwMethodText: {
    de: 'Ein ZQ-Kontrakt notiert 100 minus dem Durchschnitt des effektiven Fed-Funds-Satzes im Liefermonat. In einem Sitzungsmonat teilt sich dieser Durchschnitt in den Satz vor und nach der Entscheidung. Ist der Folgemonat sitzungsfrei, legt dessen Kontrakt den Satz nach der Sitzung direkt fest; sonst wird er aus dem Sitzungsmonat gelöst und Sitzung für Sitzung verkettet. Die erwartete Änderung wird auf die beiden nächstgelegenen 25-Bp-Schritte verteilt und über alle Sitzungen zu einem Wahrscheinlichkeitsbaum verknüpft – genau wie im CME FedWatch Tool.',
    en: 'A ZQ contract trades at 100 minus the average effective fed funds rate over its delivery month. In a meeting month that average splits into the rate before and after the decision. If the following month has no meeting, its contract pins the post-meeting rate directly; otherwise it is solved from the meeting month itself and chained meeting by meeting. The expected change is split between the two nearest 25 bp steps and compounded across meetings into a probability tree – exactly as in the CME FedWatch Tool.'
  },
  fwDisclaimer: {
    de: 'Nachgebaut aus öffentlich verfügbaren, verzögerten Futures-Kursen. Kleine Abweichungen zur CME-Seite sind durch Zeitpunkt und Kursquelle möglich. CME untersagt das automatisierte Auslesen ihrer Website – deshalb wird die veröffentlichte Methodik hier selbst berechnet.',
    en: 'Rebuilt from publicly available, delayed futures prices. Small differences to the CME page can arise from timing and price source. CME prohibits automated scraping of its website, so the published methodology is computed here instead.'
  },
  fwNoData: { de: 'Keine Futures-Daten verfügbar.', en: 'No futures data available.' },

  // Policy simulator
  psTitle: { de: 'Fed-Szenario-Simulator', en: 'Fed scenario simulator' },
  psSubtitle: {
    de: 'Was passiert mit Kurve, Anleihe und Portfolio, wenn die Fed anders handelt als eingepreist?',
    en: 'What happens to the curve, the bond and the portfolio if the Fed acts differently than priced?'
  },
  psPresets: { de: 'Szenario', en: 'Scenario' },
  presetMarket: { de: 'Wie eingepreist', en: 'As priced' },
  presetHold: { de: 'Fed pausiert', en: 'Fed on hold' },
  presetMode: { de: 'Wahrscheinlichster Pfad', en: 'Most likely path' },
  presetCut: { de: '−25 Bp je Sitzung', en: '−25 bp each meeting' },
  presetHike: { de: '+25 Bp je Sitzung', en: '+25 bp each meeting' },
  presetEmergency: { de: 'Notfallsenkung −50', en: 'Emergency cut −50' },
  presetCustom: { de: 'Eigener Pfad', en: 'Custom path' },
  psMeetings: { de: 'Entscheidungen je Sitzung', en: 'Decision per meeting' },
  psMarketMove: { de: 'Markt', en: 'Market' },
  psYourMove: { de: 'Szenario', en: 'Scenario' },
  psHalfLife: { de: 'Persistenz der Überraschung (Halbwertszeit)', en: 'Persistence of the surprise (half-life)' },
  psHalfLifeHint: {
    de: 'Wie lange wirkt die Abweichung nach der letzten Sitzung nach? Kurz = nur das kurze Ende reagiert, lang = auch lange Laufzeiten.',
    en: 'How long does the deviation last after the final meeting? Short = only the front end reacts, long = the long end moves too.'
  },
  permanent: { de: 'dauerhaft', en: 'permanent' },
  psTermPremium: { de: 'Schock Laufzeitprämie (bei 10J)', en: 'Term premium shock (at 10Y)' },
  psTermPremiumHint: {
    de: 'Zusätzliche Bewegung des langen Endes, z. B. durch Inflations- oder Haushaltssorgen. Lädt wie der Nelson-Siegel-Level-minus-Slope-Faktor.',
    en: 'Extra long-end move, e.g. from inflation or fiscal concerns. Loads like the Nelson-Siegel level-minus-slope factor.'
  },
  psPathChart: { de: 'Leitzinspfad: Markt vs. Szenario', en: 'Policy path: market vs scenario' },
  psCurveChart: { de: 'Zinskurve vorher / nachher', en: 'Yield curve before / after' },
  psShiftChart: { de: 'Kurvenverschiebung je Laufzeit', en: 'Curve shift by tenor' },
  psImpact: { de: 'Auswirkung', en: 'Impact' },
  psBondImpact: { de: 'Ihre Anleihe', en: 'Your bond' },
  psPortfolioImpact: { de: 'Ihr Portfolio', en: 'Your portfolio' },
  psSurprise2y: { de: 'Δ 2J-Zins', en: 'Δ 2Y rate' },
  psSurprise10y: { de: 'Δ 10J-Zins', en: 'Δ 10Y rate' },
  psModel: { de: 'Modell', en: 'Model' },
  psModelText: {
    de: 'Erwartungshypothese: Ein Zero-Zins ist der durchschnittlich erwartete Tagesgeldsatz über seine Laufzeit plus Laufzeitprämie. Da der Markt den FedWatch-Pfad bereits einpreist, bewegt nur die Überraschung δ(s) = Szenario − Markt die Kurve: Δz(τ) = (1/τ)·∫₀^τ δ(s) ds. Nach der letzten Sitzung klingt δ mit der gewählten Halbwertszeit ab.',
    en: 'Expectations hypothesis: a zero rate is the average expected overnight rate over its life plus a term premium. Since the market already prices the FedWatch path, only the surprise δ(s) = scenario − market moves the curve: Δz(τ) = (1/τ)·∫₀^τ δ(s) ds. After the final meeting δ decays with the chosen half-life.'
  },
  psEcbNote: {
    de: 'Hinweis: Die Fed-Szenarien wirken auf die gewählte Kurve. Für die EUR-Kurve ist das ein Spillover-Gedankenexperiment.',
    en: 'Note: Fed scenarios act on the selected curve. For the EUR curve this is a spillover thought experiment.'
  },
  switchToUst: { de: 'Zur US-Kurve wechseln', en: 'Switch to US curve' },
  marketPath: { de: 'Markt (FedWatch)', en: 'Market (FedWatch)' },
  scenarioPath: { de: 'Ihr Szenario', en: 'Your scenario' },

  // Shocks
  shTitle: { de: 'Kurvenschocks', en: 'Curve shocks' },
  shSubtitle: {
    de: 'Alle Deformationen des Toolkits – live auf die gewählte Kurve angewendet',
    en: 'Every deformation in the toolkit – applied live to the selected curve'
  },
  shType: { de: 'Deformation', en: 'Deformation' },
  shParams: { de: 'Parameter', en: 'Parameters' },
  shCurves: { de: 'Basis- und geschockte Kurve', en: 'Base and shocked curve' },
  shShifts: { de: 'Verschiebung je Stützstelle', en: 'Shift per node' },
  shInterpretation: { de: 'Einordnung', en: 'Interpretation' },
  slopeChange: { de: 'Δ 2s10s', en: 'Δ 2s10s' },
  curvatureChange: { de: 'Δ Krümmung', en: 'Δ curvature' },
  bondPnl: { de: 'Anleihe Δ Kurs', en: 'Bond Δ price' },
  portfolioPnl: { de: 'Portfolio GuV', en: 'Portfolio P&L' },
  useInStress: { de: 'In Stresstest übernehmen', en: 'Add to stress test' },
  addedToStress: { de: 'Zum Stresstest hinzugefügt', en: 'Added to stress test' },

  // Deformation names
  d_parallel_shift: { de: 'Parallelverschiebung', en: 'Parallel shift' },
  d_steepening: { de: 'Versteilerung', en: 'Steepening' },
  d_flattening: { de: 'Verflachung', en: 'Flattening' },
  d_twist: { de: 'Twist', en: 'Twist' },
  d_butterfly: { de: 'Butterfly', en: 'Butterfly' },
  d_positive_butterfly: { de: 'Positiver Butterfly', en: 'Positive butterfly' },
  d_negative_butterfly: { de: 'Negativer Butterfly', en: 'Negative butterfly' },
  d_bear_steepener: { de: 'Bear Steepener', en: 'Bear steepener' },
  d_bull_steepener: { de: 'Bull Steepener', en: 'Bull steepener' },
  d_bear_flattener: { de: 'Bear Flattener', en: 'Bear flattener' },
  d_bull_flattener: { de: 'Bull Flattener', en: 'Bull flattener' },
  d_custom: { de: 'Eigene Verschiebung', en: 'Custom shift' },
  d_pca: { de: 'PCA (Level/Slope/Krümmung)', en: 'PCA (level/slope/curvature)' },
  d_policy: { de: 'Fed-Szenario', en: 'Fed scenario' },

  // Deformation parameters
  p_shift_bps: { de: 'Verschiebung', en: 'Shift' },
  p_magnitude_bps: { de: 'Stärke', en: 'Magnitude' },
  p_pivot_tenor: { de: 'Drehpunkt', en: 'Pivot' },
  p_short_tenor: { de: 'Kurzes Ende', en: 'Short tenor' },
  p_mid_tenor: { de: 'Bauch', en: 'Belly' },
  p_long_tenor: { de: 'Langes Ende', en: 'Long tenor' },
  p_short_shift_bps: { de: 'Kurzes Ende', en: 'Short end' },
  p_long_shift_bps: { de: 'Langes Ende', en: 'Long end' },
  p_wings_shift_bps: { de: 'Flügel', en: 'Wings' },
  p_body_shift_bps: { de: 'Bauch', en: 'Body' },
  p_long_end_shift_bps: { de: 'Langes Ende', en: 'Long end' },
  p_short_end_shift_bps: { de: 'Kurzes Ende', en: 'Short end' },
  p_level_shift: { de: 'Level', en: 'Level' },
  p_slope_shift: { de: 'Slope', en: 'Slope' },
  p_curvature_shift: { de: 'Krümmung', en: 'Curvature' },

  // Deformation interpretations (from the README)
  i_parallel_shift: {
    de: 'Alle Laufzeiten bewegen sich gleich stark – das klassische Duration-Szenario, etwa bei einem breiten Zinsschock durch die Notenbank. Steigende Zinsen senken die Anleihekurse, fallende heben sie.',
    en: 'Every tenor moves by the same amount – the classic duration scenario, e.g. a broad central-bank rate shock. Rising rates lower bond prices, falling rates lift them.'
  },
  i_steepening: {
    de: 'Kurze Zinsen fallen, lange steigen: Der Spread weitet sich. Typisch für eine beginnende Erholung. Kurzläufer profitieren, Langläufer leiden; Banken mit Fristentransformation profitieren.',
    en: 'Short rates fall, long rates rise: the spread widens. Typical of an early recovery. Short bonds benefit, long bonds suffer; banks running maturity transformation gain.'
  },
  i_flattening: {
    de: 'Kurze Zinsen steigen, lange fallen: Der Spread verengt sich. Oft Signal einer bevorstehenden Abschwächung, typisch für Zinserhöhungszyklen. Langläufer schneiden relativ besser ab.',
    en: 'Short rates rise, long rates fall: the spread narrows. Often signals a slowdown, typical of hiking cycles. Long bonds outperform relatively.'
  },
  i_twist: {
    de: 'Kurzes und langes Ende bewegen sich unabhängig um einen Drehpunkt. Realistisch bei gemischten Notenbanksignalen oder veränderten Inflationserwartungen.',
    en: 'The short and long ends move independently around a pivot. Realistic under mixed central-bank signals or shifting inflation expectations.'
  },
  i_butterfly: {
    de: 'Flügel und Bauch bewegen sich gegenläufig. Positiver Butterfly (Flügel ↑, Bauch ↓): mittlere Laufzeiten profitieren relativ; negativer Butterfly: kurze und lange Laufzeiten profitieren.',
    en: 'Wings and belly move in opposite directions. Positive butterfly (wings ↑, belly ↓): intermediate maturities benefit relatively; negative butterfly: short and long maturities benefit.'
  },
  i_bear_steepener: {
    de: 'Das lange Ende steigt, das kurze bleibt stabil: steigende Inflationserwartungen oder Überhitzung – Langläufer werden verkauft.',
    en: 'The long end rises while the short end stays put: rising inflation expectations or overheating – long bonds are sold.'
  },
  i_bull_steepener: {
    de: 'Das kurze Ende fällt, das lange bleibt stabil: Die Notenbank senkt wegen Rezessionssorgen, die langfristigen Erwartungen bleiben verankert.',
    en: 'The short end falls while the long end stays put: the central bank cuts on recession worries, long-run expectations stay anchored.'
  },
  i_bear_flattener: {
    de: 'Das kurze Ende steigt, das lange bleibt stabil: Die Notenbank erhöht aggressiv, um Inflation zu bekämpfen.',
    en: 'The short end rises while the long end stays put: the central bank hikes aggressively to fight inflation.'
  },
  i_bull_flattener: {
    de: 'Das lange Ende fällt, das kurze bleibt stabil: Rezessionserwartung und Flucht in langlaufende Staatsanleihen.',
    en: 'The long end falls while the short end stays put: recession expectations and a flight to quality into long government bonds.'
  },
  i_pca: {
    de: 'Zerlegung in die drei klassischen Hauptkomponenten: Level (Parallelbewegung), Slope (Drehung) und Krümmung (Bauch gegen Flügel). Sie erklären typischerweise über 95 % der Kurvenbewegungen.',
    en: 'Decomposition into the three classic principal components: level (parallel), slope (tilt) and curvature (belly versus wings). Together they typically explain over 95 % of curve moves.'
  },
  i_custom: {
    de: 'Frei definierte Verschiebung je Stützstelle – zwischen den Punkten wird linear interpoliert.',
    en: 'A freely defined shift per node – linear interpolation in between.'
  },

  // Bond
  bdTitle: { de: 'Anleihe – Bewertung und Risiko', en: 'Bond – valuation and risk' },
  bdSubtitle: {
    de: 'Kurs, Duration, Konvexität, Key Rate Durations und Value at Risk auf der gewählten Kurve',
    en: 'Price, duration, convexity, key rate durations and value at risk on the selected curve'
  },
  faceValue: { de: 'Nominal', en: 'Face value' },
  coupon: { de: 'Kupon', en: 'Coupon' },
  maturity: { de: 'Laufzeit', en: 'Maturity' },
  frequency: { de: 'Zahlungen p. a.', en: 'Payments p.a.' },
  setParCoupon: { de: 'Par-Kupon setzen', en: 'Set par coupon' },
  ytm: { de: 'Rendite (YTM)', en: 'Yield (YTM)' },
  currentYield: { de: 'Laufende Rendite', en: 'Current yield' },
  macaulay: { de: 'Macaulay-Duration', en: 'Macaulay duration' },
  modified: { de: 'Modifizierte Duration', en: 'Modified duration' },
  effective: { de: 'Effektive Duration', en: 'Effective duration' },
  dv01: { de: 'DV01', en: 'DV01' },
  convexity: { de: 'Konvexität', en: 'Convexity' },
  effConvexity: { de: 'Effektive Konvexität', en: 'Effective convexity' },
  perBp: { de: 'je Bp', en: 'per bp' },
  priceYield: { de: 'Kursreaktion auf Parallelverschiebung', en: 'Price response to parallel shifts' },
  priceYieldSub: {
    de: 'Exakte Neubewertung vs. Duration- und Duration+Konvexitäts-Näherung',
    en: 'Exact repricing vs duration and duration + convexity approximations'
  },
  exact: { de: 'Exakt', en: 'Exact' },
  durationOnly: { de: 'Nur Duration', en: 'Duration only' },
  durationConvexity: { de: 'Duration + Konvexität', en: 'Duration + convexity' },
  priceChangePct: { de: 'Kursänderung (%)', en: 'Price change (%)' },
  shiftBps: { de: 'Parallelverschiebung (Bp)', en: 'Parallel shift (bp)' },
  cashFlows: { de: 'Zahlungsströme', en: 'Cash flows' },
  cashFlowsSub: { de: 'Nominal und Barwert je Zahlungstermin', en: 'Nominal and present value per payment date' },
  nominal: { de: 'Nominal', en: 'Nominal' },
  presentValue: { de: 'Barwert', en: 'Present value' },
  time: { de: 'Zeitpunkt (Jahre)', en: 'Time (years)' },
  krdTitle: { de: 'Key Rate Durations', en: 'Key rate durations' },
  krdSub: {
    de: 'Sensitivität gegenüber Zinsänderungen an einzelnen Laufzeitpunkten',
    en: 'Sensitivity to rate changes at individual points of the curve'
  },
  keyRate: { de: 'Key Rate', en: 'Key rate' },
  partial: { de: 'Partiell (je Stützstelle)', en: 'Partial (per node)' },
  duration: { de: 'Duration', en: 'Duration' },
  varTitle: { de: 'Value at Risk und Expected Shortfall', en: 'Value at risk and expected shortfall' },
  varSub: {
    de: 'Parametrisch auf Basis der modifizierten Duration',
    en: 'Parametric, based on modified duration'
  },
  volatility: { de: 'Zinsvolatilität p. a.', en: 'Rate volatility p.a.' },
  realisedVol: { de: 'realisiert, 1 Jahr', en: 'realised, 1 year' },
  confidence: { de: 'Konfidenz', en: 'Confidence' },
  horizon: { de: 'Haltedauer', en: 'Holding period' },
  days: { de: 'Tage', en: 'days' },
  var: { de: 'VaR', en: 'VaR' },
  es: { de: 'Expected Shortfall', en: 'Expected shortfall' },
  ofPrice: { de: 'vom Kurs', en: 'of price' },
  estimates: { de: 'Schätzung vs. exakt', en: 'Estimate vs exact' },
  estimate: { de: 'Schätzung', en: 'Estimate' },
  error: { de: 'Fehler', en: 'Error' },

  // Portfolio
  pfTitle: { de: 'Portfolio-Risiko', en: 'Portfolio risk' },
  pfSubtitle: {
    de: 'Positionen erfassen oder aus Excel einfügen – Kennzahlen, Durationsbeiträge und Szenario-GuV',
    en: 'Enter positions or paste them from Excel – metrics, duration contributions and scenario P&L'
  },
  positions: { de: 'Positionen', en: 'Positions' },
  label: { de: 'Bezeichnung', en: 'Label' },
  quantity: { de: 'Stück', en: 'Quantity' },
  marketValue: { de: 'Marktwert', en: 'Market value' },
  weight: { de: 'Gewicht', en: 'Weight' },
  wam: { de: 'Ø Restlaufzeit', en: 'Wtd. avg. maturity' },
  totalFace: { de: 'Nominal gesamt', en: 'Total face' },
  contribution: { de: 'Durationsbeitrag', en: 'Duration contribution' },
  contributionSub: { de: 'Beitrag je Position zur modifizierten Duration', en: 'Each position’s share of modified duration' },
  portfolioKrd: { de: 'Portfolio Key Rate Durations', en: 'Portfolio key rate durations' },
  scenarioPnl: { de: 'Szenario-GuV', en: 'Scenario P&L' },
  scenarioPnlSub: { de: 'Szenarien aus dem Stresstest', en: 'Scenarios from the stress test' },
  addPosition: { de: 'Position hinzufügen', en: 'Add position' },
  example: { de: 'Beispielportfolio', en: 'Example portfolio' },
  portfolioPasteHint: {
    de: 'Spaltenreihenfolge: Bezeichnung (optional), Nominal, Kupon %, Laufzeit (Jahre), Zahlungen p. a., Stück.',
    en: 'Column order: label (optional), face value, coupon %, maturity (years), payments p.a., quantity.'
  },
  emptyPortfolio: { de: 'Noch keine Positionen.', en: 'No positions yet.' },

  // Stress test
  stTitle: { de: 'Stresstest', en: 'Stress test' },
  stSubtitle: {
    de: 'Szenario-Matrix für Anleihe und Portfolio – frei erweiterbar, exportierbar nach Excel',
    en: 'Scenario matrix for the bond and the portfolio – extensible and exportable to Excel'
  },
  stScenarios: { de: 'Szenarien', en: 'Scenarios' },
  stMatrix: { de: 'Ergebnis-Matrix', en: 'Result matrix' },
  stChart: { de: 'Portfolio-GuV je Szenario', en: 'Portfolio P&L by scenario' },
  stAdd: { de: 'Szenario hinzufügen', en: 'Add scenario' },
  stIncludeFed: { de: 'inkl. aktuellem Fed-Szenario', en: 'incl. current Fed scenario' },
  bondPct: { de: 'Anleihe Δ %', en: 'Bond Δ %' },
  pnl: { de: 'GuV', en: 'P&L' },
  pnlPct: { de: 'GuV %', en: 'P&L %' },
  d2y: { de: 'Δ 2J', en: 'Δ 2Y' },
  d10y: { de: 'Δ 10J', en: 'Δ 10Y' },

  // Data page
  dtTitle: { de: 'Daten, Methodik & Excel-Anbindung', en: 'Data, methodology & Excel integration' },
  dtSubtitle: {
    de: 'Quellen, Aktualität, Downloads und Power-Query-Anbindung für Excel',
    en: 'Sources, freshness, downloads and Power Query integration for Excel'
  },
  dtSources: { de: 'Datenquellen', en: 'Data sources' },
  dtProvider: { de: 'Anbieter', en: 'Provider' },
  dtStatus: { de: 'Status', en: 'Status' },
  dtFetched: { de: 'Abgerufen', en: 'Fetched' },
  statusOk: { de: 'Aktuell', en: 'Current' },
  statusStale: { de: 'Veraltet', en: 'Stale' },
  statusError: { de: 'Fehler', en: 'Error' },
  dtRefresh: {
    de: 'Ein GitHub-Actions-Workflow lädt die Daten an Handelstagen stündlich neu und veröffentlicht die Seite. Fällt eine Quelle aus, bleibt der letzte gültige Stand erhalten und wird als veraltet markiert.',
    en: 'A GitHub Actions workflow refreshes the data hourly on trading days and republishes the site. If a source fails, its last good value is kept and flagged as stale.'
  },
  dtDownloads: { de: 'Downloads (CSV, UTF-8)', en: 'Downloads (CSV, UTF-8)' },
  dtPowerQuery: { de: 'Live in Excel laden (Power Query)', en: 'Load live into Excel (Power Query)' },
  dtPowerQueryHint: {
    de: 'Excel → Daten → Daten abrufen → Aus anderen Quellen → Leere Abfrage → Erweiterter Editor, Skript einfügen. Mit „Alle aktualisieren“ holt Excel jederzeit den neuesten Stand. Das Gebietsschema en-US sorgt dafür, dass Dezimalpunkte in deutschem Excel korrekt gelesen werden.',
    en: 'Excel → Data → Get Data → From Other Sources → Blank Query → Advanced Editor, paste the script. “Refresh All” fetches the latest data at any time. The en-US culture makes sure decimal points parse correctly in any Excel locale.'
  },
  dtFeed: { de: 'Datensatz', en: 'Dataset' },
  copyScript: { de: 'Skript kopieren', en: 'Copy script' },
  dtPython: { de: 'Dasselbe in Python', en: 'The same in Python' },
  dtPythonHint: {
    de: 'Die Website ist eine verifizierte TypeScript-Portierung des Python-Toolkits: CI vergleicht bei jeder Änderung über 7.000 Referenzwerte aus Python (Toleranz 10⁻⁹, numerische Ableitungen wie Key Rate Durations 10⁻⁷).',
    en: 'The site is a verified TypeScript port of the Python toolkit: on every change CI compares over 7,000 reference values from Python (tolerance 10⁻⁹, numerical derivatives such as key rate durations 10⁻⁷).'
  },
  dtPrivacy: { de: 'Datenschutz', en: 'Privacy' },
  dtPrivacyText: {
    de: 'Keine Cookies, kein Tracking, keine externen Schriftarten oder CDNs. Eingaben (Portfolio, Szenarien) bleiben im lokalen Speicher Ihres Browsers.',
    en: 'No cookies, no tracking, no external fonts or CDNs. Your inputs (portfolio, scenarios) stay in your browser’s local storage.'
  },
  dtFeedTreasury: { de: 'Treasury Par-Renditen (Historie)', en: 'Treasury par yields (history)' },
  dtFeedZero: { de: 'Treasury Zero-Kurve (aktuell)', en: 'Treasury zero curve (latest)' },
  dtFeedEcb: { de: 'EZB AAA Spot-Zinsen (Historie)', en: 'ECB AAA spot rates (history)' },
  dtFeedFedwatch: { de: 'FedWatch-Wahrscheinlichkeiten', en: 'FedWatch probabilities' },
  dtFeedJson: { de: 'Kompletter Datensatz (JSON)', en: 'Complete dataset (JSON)' }
} satisfies Record<string, Record<Lang, string>>;

export type MessageKey = keyof typeof dict;

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = dict[key][lang];
  if (vars) for (const [name, value] of Object.entries(vars)) text = text.replace(`{${name}}`, String(value));
  return text;
}

export const hasKey = (key: string): key is MessageKey => key in dict;
