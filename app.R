# ============================================================
# Clinical Delivery Command Center v4
# Fortrea LATAM Hackathon 2026
# ============================================================

library(shiny)
library(bslib)
library(dplyr)
library(plotly)
library(DT)
library(readxl)
library(lubridate)
library(RSQLite)
library(randomForest)
library(stringr)
library(tidyr)
library(httr2)
library(jsonlite)

# ============================================================
# HELPER FUNCTIONS
# ============================================================

normalize_ta <- function(ta) {
  t <- tolower(trimws(ifelse(is.na(ta), "", ta)))
  dplyr::case_when(
    grepl("oncol|tumor|cancer|lymphoma|myeloma|nsclc|colorectal|breast|solid|bladder|hepatocell", t) ~ "Oncology",
    grepl("cardio|cardiac|coronary|dyslipid|heart fail|hfpef|afib|vte|atrial", t) ~ "Cardiovascular",
    grepl("respir|pulmon|asthma|copd|ipf|fibrosis", t) ~ "Respiratory",
    grepl("neurol|neuro|alzheimer|parkinson|neurofibromatosis|muscular", t) ~ "Neurology",
    grepl("immunol|imid|lupus|crohn|colitis|rheumat|arthritis", t) ~ "Immunology",
    grepl("rare|hes|hypereosinophilic|congenital|sma", t) ~ "Rare Disease",
    grepl("hepat|nash|liver|nonalcoholic|steatohepatitis", t) ~ "Hepatology",
    grepl("nephrol|renal|kidney|apol", t) ~ "Nephrology",
    grepl("endocrin|diabet|obesity|insulin", t) ~ "Endocrinology",
    grepl("dermatol|skin|atopic|psoriasis", t) ~ "Dermatology",
    grepl("hematol|hsct", t) ~ "Hematology",
    grepl("musculo|osteo|rheumatol", t) ~ "Musculoskeletal",
    grepl("gastro", t) ~ "Gastroenterology",
    TRUE ~ "Other"
  )
}

risk_badge_html <- function(tier) {
  col <- switch(tier,
    "Critical" = "#dc3545",
    "High"     = "#fd7e14",
    "Elevated" = "#ffc107",
    "Moderate" = "#6f9fd8",
    "Low"      = "#2ea55e",
    "#888888"
  )
  em <- switch(tier,
    "Critical" = "\U0001F534",
    "High"     = "\U0001F534",
    "Elevated" = "\U0001F7E0",
    "Moderate" = "\U0001F7E1",
    "Low"      = "\U0001F7E2",
    "\U26AA"
  )
  sprintf(
    '<span style="background:%s;color:#fff;padding:2px 8px;border-radius:12px;font-size:0.82em;font-weight:600;white-space:nowrap;">%s %s</span>',
    col, em, tier
  )
}

progress_bar_html <- function(pct, color = "#2ea55e") {
  pct_safe <- min(max(round(pct, 1), 0), 100)
  sprintf(
    '<div style="background:#2a3040;border-radius:6px;height:18px;width:100%%;">
       <div style="background:%s;width:%.1f%%;height:18px;border-radius:6px;transition:width 0.4s;"></div>
     </div>
     <small style="color:#aab;">%.1f%%</small>',
    color, pct_safe, pct_safe
  )
}

severity_badge_html <- function(sev) {
  col <- ifelse(sev == "Error", "#dc3545", "#fd7e14")
  sprintf(
    '<span style="background:%s;color:#fff;padding:2px 7px;border-radius:10px;font-size:0.80em;font-weight:600;">%s</span>',
    col, sev
  )
}

# ============================================================
# DATABASE SETUP
# ============================================================

init_db <- function() {
  con <- dbConnect(SQLite(), "data/data_entry.db")
  dbExecute(con, "CREATE TABLE IF NOT EXISTS study_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    study TEXT, timestamp TEXT,
    ms_sap TEXT, ms_sap_actual TEXT,
    ms_prog_start TEXT, ms_prog_actual TEXT,
    ms_tfl TEXT, ms_tfl_actual TEXT,
    ms_dbl TEXT, ms_dbl_actual TEXT,
    del_sdtm TEXT, del_adam TEXT, del_tfl TEXT, del_define TEXT,
    issue_date TEXT, issue_cat TEXT, issue_sev TEXT, issue_desc TEXT,
    comments TEXT
  )")
  dbDisconnect(con)
}

init_db()

# ============================================================
# DATA LOADING — done once at startup
# ============================================================

message("[CMD Center] Loading raw data...")

raw <- read_excel("data/raw_data_demo_anonymized.xlsx")

# Rename columns to short names
names(raw) <- c(
  "client", "portfolio", "study", "fpi", "dbl",
  "deliverable", "dataset", "data_type", "prod_prog",
  "prod_status", "prod_date", "qc_reviewer", "qc_status",
  "qc_date", "days_qc", "qc_delay", "ta"
)

# Normalize TA
raw$ta_norm <- normalize_ta(raw$ta)

# Deliverable key
raw$del_key <- paste(raw$deliverable, raw$dataset)

# Parse dates once on the raw data for dbl/fpi per study
dbl_lookup <- raw %>%
  select(study, dbl) %>%
  distinct() %>%
  mutate(dbl_date = suppressWarnings(as.Date(dbl, format = "%d %b %Y"))) %>%
  filter(!is.na(dbl_date)) %>%
  group_by(study) %>%
  slice(1) %>%
  ungroup() %>%
  select(study, dbl_date)

fpi_lookup <- raw %>%
  select(study, fpi) %>%
  distinct() %>%
  mutate(fpi_date = suppressWarnings(as.Date(fpi, format = "%d %b %Y"))) %>%
  filter(!is.na(fpi_date)) %>%
  group_by(study) %>%
  slice(1) %>%
  ungroup() %>%
  select(study, fpi_date)

# Step 1: deliverable-level aggregation
del_level <- raw %>%
  group_by(client, portfolio, study, del_key) %>%
  summarise(
    prod_done  = any(prod_status == "Ready for QC", na.rm = TRUE),
    qc_done    = any(qc_status   == "Passed QC",    na.rm = TRUE),
    qc_failed  = any(qc_status   == "Failed QC",    na.rm = TRUE),
    sig_delay  = any(qc_delay    == "Significant delay", na.rm = TRUE),
    slight_del = any(qc_delay    == "Slight delay",  na.rm = TRUE),
    .groups = "drop"
  )

# TA lookup (most common per study)
ta_lookup <- raw %>%
  group_by(study) %>%
  count(ta_norm, sort = TRUE) %>%
  slice(1) %>%
  ungroup() %>%
  select(study, ta_norm)

# Step 2: study-level aggregation
study_data_base <- del_level %>%
  group_by(client, portfolio, study) %>%
  summarise(
    total_del    = n(),
    prod_complete = sum(prod_done,  na.rm = TRUE),
    qc_passed    = sum(qc_done,     na.rm = TRUE),
    failed_qc    = sum(qc_failed,   na.rm = TRUE),
    sig_delays   = sum(sig_delay,   na.rm = TRUE),
    slight_delays= sum(slight_del,  na.rm = TRUE),
    .groups = "drop"
  ) %>%
  left_join(dbl_lookup, by = "study") %>%
  left_join(fpi_lookup, by = "study") %>%
  left_join(ta_lookup,  by = "study") %>%
  rename(ta = ta_norm) %>%
  mutate(
    prod_pct      = round(100 * prod_complete / pmax(total_del, 1), 1),
    qc_pct        = round(100 * qc_passed     / pmax(total_del, 1), 1),
    weeks_to_dbl  = ifelse(
      !is.na(dbl_date),
      as.numeric(difftime(dbl_date, Sys.Date(), units = "weeks")),
      NA_real_
    ),
    delayed   = !is.na(weeks_to_dbl) & weeks_to_dbl < 0,
    at_risk   = !is.na(weeks_to_dbl) & weeks_to_dbl >= 0 & weeks_to_dbl <= 8
  )

# Rule-based risk score
study_data_base <- study_data_base %>%
  mutate(
    risk_score = dplyr::case_when(
      sig_delays > 10 | failed_qc > 5  ~ 0.85,
      sig_delays > 5  | failed_qc > 2  ~ 0.70,
      sig_delays > 2  | failed_qc > 0  ~ 0.50,
      slight_delays > 3                ~ 0.35,
      TRUE                             ~ 0.15
    ),
    risk_tier = dplyr::case_when(
      risk_score >= 0.80 ~ "Critical",
      risk_score >= 0.65 ~ "High",
      risk_score >= 0.45 ~ "Elevated",
      risk_score >= 0.30 ~ "Moderate",
      TRUE               ~ "Low"
    )
  )

# FSP/FSO simulation
set.seed(42)
fsp_idx <- sample(seq_len(nrow(study_data_base)), floor(nrow(study_data_base) * 0.25))
study_data_base$fso_fsp <- "FSO"
study_data_base$fso_fsp[fsp_idx] <- "FSP"

# ============================================================
# AI RISK MODEL (randomForest)
# ============================================================

message("[CMD Center] Training AI risk model...")

sp_hist <- read.csv("data/sp_delivery_history.csv", stringsAsFactors = FALSE)
sp_hist$on_time_delivery <- factor(sp_hist$on_time_delivery)

rf_features <- c("num_datasets", "num_tfls", "num_amendments", "complexity_score", "team_size")
rf_model <- tryCatch(
  randomForest(
    x = sp_hist[, rf_features],
    y = sp_hist$on_time_delivery,
    ntree = 200,
    importance = TRUE
  ),
  error = function(e) {
    message("RF model failed: ", e$message)
    NULL
  }
)

# Score current studies
score_with_rf <- function(sdata, model) {
  if (is.null(model)) {
    sdata$ai_risk_score <- sdata$risk_score
    return(sdata)
  }
  max_sig <- max(sdata$sig_delays, na.rm = TRUE)
  max_sig <- ifelse(max_sig == 0, 1, max_sig)
  max_fqc <- max(sdata$failed_qc, na.rm = TRUE)
  max_fqc <- ifelse(max_fqc == 0, 1, max_fqc)

  pred_df <- data.frame(
    num_datasets    = sdata$total_del,
    num_tfls        = round(sdata$total_del * 0.6),
    num_amendments  = sdata$sig_delays + sdata$failed_qc,
    complexity_score= pmin(sdata$total_del / 10, 10),
    team_size       = 3
  )
  probs <- predict(model, pred_df, type = "prob")
  # ai_risk_score = probability of delay = 1 - P(on_time=1)
  col1 <- which(colnames(probs) == "1")
  if (length(col1) == 1) {
    sdata$ai_risk_score <- round(1 - probs[, col1], 3)
  } else {
    sdata$ai_risk_score <- sdata$risk_score
  }
  sdata
}

study_data_base <- score_with_rf(study_data_base, rf_model)

# Top 3 risk factors per study
compute_risk_factors <- function(sdata) {
  max_sig   <- max(sdata$sig_delays,   na.rm = TRUE); if (max_sig == 0) max_sig <- 1
  max_fqc   <- max(sdata$failed_qc,    na.rm = TRUE); if (max_fqc == 0) max_fqc <- 1
  max_slt   <- max(sdata$slight_delays,na.rm = TRUE); if (max_slt == 0) max_slt <- 1

  factors_list <- vector("list", nrow(sdata))
  for (i in seq_len(nrow(sdata))) {
    s <- sdata[i, ]
    cands <- list()
    if (!is.na(s$sig_delays)    && s$sig_delays > 5)
      cands[["QC Significant Delays"]] <- s$sig_delays / max_sig
    if (!is.na(s$failed_qc)     && s$failed_qc > 2)
      cands[["QC Failures"]] <- s$failed_qc / max_fqc
    if (!is.na(s$prod_pct)      && s$prod_pct < 50)
      cands[["Low Production Completion"]] <- 1 - s$prod_pct / 100
    if (!is.na(s$weeks_to_dbl)  && s$weeks_to_dbl < 8 && s$weeks_to_dbl >= 0)
      cands[["Tight DBL Timeline"]] <- 1 - max(s$weeks_to_dbl, 0) / 8
    if (!is.na(s$slight_delays) && s$slight_delays > 3)
      cands[["Slight Delays Accumulating"]] <- s$slight_delays / 10
    amend_val <- (s$sig_delays + s$failed_qc) / max(s$total_del, 1)
    cands[["Amendment Burden"]] <- amend_val

    cands_vec <- unlist(cands)
    cands_vec <- sort(cands_vec, decreasing = TRUE)
    top3 <- head(cands_vec, 3)
    factors_list[[i]] <- top3
  }
  factors_list
}

study_data_base$risk_factors <- compute_risk_factors(study_data_base)

# ============================================================
# P21 FINDINGS
# ============================================================

p21_data <- read.csv("data/p21_findings.csv", stringsAsFactors = FALSE)

# ============================================================
# NL QUERY FUNCTION
# ============================================================

nlq_filter <- function(query, studies) {
  q <- tolower(trimws(query))
  if (nchar(q) == 0) return(studies)

  filtered <- studies

  # Risk tier
  if      (grepl("high.risk|critical|high risk", q)) filtered <- filter(filtered, risk_tier %in% c("Critical", "High"))
  else if (grepl("elevated|moderate", q))            filtered <- filter(filtered, risk_tier %in% c("Elevated", "Moderate"))
  else if (grepl("low.risk|low risk", q))            filtered <- filter(filtered, risk_tier == "Low")

  # Client match
  for (cl in unique(studies$client)) {
    if (grepl(tolower(cl), q, fixed = TRUE)) {
      filtered <- filter(filtered, client == !!cl)
      break
    }
  }
  if (grepl("az|astrazeneca|astra zeneca", q)) filtered <- filter(filtered, grepl("astra", tolower(client)))
  if (grepl("abbvie", q))                       filtered <- filter(filtered, grepl("abbvie", tolower(client)))

  # QC threshold
  if (grepl("qc.below|qc under|qc less", q)) {
    pct <- suppressWarnings(as.numeric(regmatches(q, regexpr("[0-9]+", q))))
    if (length(pct) > 0 && !is.na(pct)) filtered <- filter(filtered, qc_pct < pct)
  }

  # Timeline
  if (grepl("4 week|four week", q))   filtered <- filter(filtered, !is.na(weeks_to_dbl) & weeks_to_dbl >= 0 & weeks_to_dbl <= 4)
  if (grepl("delayed|overdue|behind", q)) filtered <- filter(filtered, delayed == TRUE)
  if (grepl("at.risk|at risk", q))    filtered <- filter(filtered, at_risk == TRUE)

  # TA
  if (grepl("oncol", q))  filtered <- filter(filtered, ta == "Oncology")
  if (grepl("cardio", q)) filtered <- filter(filtered, ta == "Cardiovascular")
  if (grepl("neurol", q)) filtered <- filter(filtered, ta == "Neurology")
  if (grepl("respir", q)) filtered <- filter(filtered, ta == "Respiratory")

  # FSP/FSO
  if (grepl("\\bfsp\\b", q)) filtered <- filter(filtered, fso_fsp == "FSP")
  if (grepl("\\bfso\\b", q)) filtered <- filter(filtered, fso_fsp == "FSO")

  filtered
}

# ============================================================
# LLM BACKEND — Anthropic → Ollama → pattern-match fallback
# Detected once at startup; used by nlq_explain()
# ============================================================

.llm_backend <- local({
  if (nchar(Sys.getenv("ANTHROPIC_API_KEY")) > 0) {
    message("[CMD Center] LLM: Anthropic Claude (haiku)")
    "anthropic"
  } else {
    # probe Ollama
    ok <- tryCatch({
      resp <- request("http://localhost:11434/api/tags") |>
        req_timeout(2) |> req_perform()
      resp_status(resp) == 200
    }, error = function(e) FALSE)
    if (ok) { message("[CMD Center] LLM: Ollama (llama3)"); "ollama" }
    else     { message("[CMD Center] LLM: pattern-match fallback"); "fallback" }
  }
})

# Returns a human-readable summary string; never throws — always falls back.
nlq_explain <- function(query, n_results, result_studies) {
  if (.llm_backend == "fallback" || n_results == 0) return(NULL)

  study_snippet <- if (n_results <= 6)
    paste(result_studies, collapse = ", ")
  else
    paste(c(head(result_studies, 6), sprintf("…+%d more", n_results - 6)), collapse = ", ")

  context <- sprintf(
    "Portfolio has %d studies total. Query returned %d studies: %s.",
    n_results, n_results, study_snippet
  )
  prompt <- sprintf(
    paste0("You are a clinical trial portfolio assistant for Fortrea Biometrics.\n",
           "Context: %s\nUser asked: \"%s\"\n",
           "Reply in 1 concise sentence describing what was found. Be specific."),
    context, query
  )

  tryCatch({
    if (.llm_backend == "anthropic") {
      resp <- request("https://api.anthropic.com/v1/messages") |>
        req_headers(
          "x-api-key"         = Sys.getenv("ANTHROPIC_API_KEY"),
          "anthropic-version" = "2023-06-01",
          "content-type"      = "application/json"
        ) |>
        req_body_json(list(
          model      = "claude-haiku-4-5-20251001",
          max_tokens = 150,
          messages   = list(list(role = "user", content = prompt))
        )) |>
        req_timeout(8) |>
        req_perform()
      fromJSON(resp_body_string(resp))$content[[1]]$text

    } else {  # ollama
      resp <- request("http://localhost:11434/api/generate") |>
        req_body_json(list(
          model  = "llama3",
          prompt = prompt,
          stream = FALSE
        )) |>
        req_timeout(15) |>
        req_perform()
      fromJSON(resp_body_string(resp))$response
    }
  }, error = function(e) NULL)  # silent fallback on any network error
}

# ============================================================
# SNAPSHOT DATA FOR COMPLETION OVER TIME CHART
# ============================================================

snapshot_dates <- as.Date(c("2025-12-01","2026-01-15","2026-02-15","2026-03-15",
                             "2026-04-15","2026-05-15","2026-06-15","2026-06-28"))
snapshot_prod  <- c(61.2, 64.8, 68.1, 70.9, 73.2, 75.4, 77.1, 78.6)
snapshot_qc    <- c(54.7, 58.3, 62.0, 65.1, 67.8, 70.2, 72.4, 73.9)

# ============================================================
# THEME
# ============================================================

cc_theme <- bs_theme(
  version    = 5,
  bg         = "#0d1117",
  fg         = "#e8eaf0",
  primary    = "#2ea55e",
  secondary  = "#1a5c38",
  success    = "#2ea55e",
  info       = "#3a7bd5",
  warning    = "#ffc107",
  danger     = "#dc3545",
  base_font  = font_google("Inter"),
  heading_font = font_google("Inter"),
  navbar_bg  = "#1a5c38"
) |>
  bs_add_rules("
    .navbar-brand { font-weight: 700; letter-spacing: 0.5px; }
    .card { background: #161b22 !important; border: 1px solid #30363d !important; }
    .card-header { border-bottom: 1px solid #30363d !important; }
    .value-box-showcase .bi { font-size: 2rem; }
    .drilldown-card { border: 1px solid #2ea55e !important; }
    .ai-card { border: 1px solid #3a7bd5 !important; background: #0d1b2a !important; }
    .ai-card .card-header { background: #1a2d4a !important; color: #7eb8f5 !important; border-bottom: 1px solid #3a7bd5 !important; }
    .nlq-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .nlq-chips .btn { font-size: 0.78em; padding: 3px 10px; border-radius: 16px; background: #1a5c38; border-color: #2ea55e; color: #e8eaf0; }
    .nlq-chips .btn:hover { background: #2ea55e; }
    .nlq-result-box { background: #0d2a1a; border: 1px solid #2ea55e; border-radius: 8px; padding: 10px 14px; margin-top: 8px; }
    .sidebar { background: #161b22 !important; border-right: 1px solid #30363d !important; }
    table.dataTable thead th { background: #161b22 !important; color: #e8eaf0 !important; border-bottom: 1px solid #2ea55e !important; }
    table.dataTable tbody tr { background: #161b22 !important; color: #e8eaf0 !important; }
    table.dataTable tbody tr:hover { background: #1a2430 !important; }
    .dataTables_wrapper { color: #e8eaf0 !important; }
    .dataTables_filter input, .dataTables_length select { background: #0d1117 !important; color: #e8eaf0 !important; border: 1px solid #30363d !important; }
    .page-item .page-link { background: #161b22 !important; border-color: #30363d !important; color: #e8eaf0 !important; }
    .page-item.active .page-link { background: #2ea55e !important; border-color: #2ea55e !important; }
    .form-control, .form-select { background: #0d1117 !important; color: #e8eaf0 !important; border: 1px solid #30363d !important; }
    .form-control:focus, .form-select:focus { border-color: #2ea55e !important; box-shadow: 0 0 0 0.2rem rgba(46,165,94,0.25) !important; }
    .risk-factor-bar-bg { background: #2a3040; border-radius: 4px; height: 14px; }
    .risk-factor-bar { background: #3a7bd5; height: 14px; border-radius: 4px; }
    hr { border-color: #30363d !important; }
    label { color: #aab8c2 !important; }
    .shiny-notification { background: #1a2d1a; border: 1px solid #2ea55e; color: #e8eaf0; }
  ")

# ============================================================
# UI
# ============================================================

del_status_choices <- c("Not Started", "In Progress", "Ready for QC", "Passed QC", "Delivered")

ui <- page_navbar(
  theme = cc_theme,
  title = tags$span(
    tags$img(src = NULL, height = "0px"),
    tags$span("\U26A1 Clinical Delivery Command Center",
              style = "font-weight:700; color:#2ea55e; font-size:1.1em;"),
    tags$span(" | Fortrea LATAM", style = "color:#7a9a7a; font-size:0.85em; margin-left:6px;")
  ),
  fillable = FALSE,

  # ---- TAB 1: Results ----
  nav_panel(
    title = tags$span(icon("chart-line"), " Results"),
    layout_sidebar(
      fillable = FALSE,

      # ---- Sidebar ----
      sidebar = sidebar(
        width = 230,
        bg = "#161b22",
        tags$h6(style = "color:#2ea55e; font-weight:700; margin-bottom:10px;",
                icon("filter"), " Filters"),
        radioButtons("biz_line", "Business Line",
                     choices = c("All", "FSO", "FSP"), inline = TRUE),
        selectInput("client_filter", "Client",
                    choices = c("All clients",
                                sort(unique(study_data_base$client)))),
        checkboxInput("only_started", "Only started studies", value = FALSE),
        hr(),
        selectInput("chart_through", "Chart through date",
                    choices   = format(snapshot_dates, "%b %d, %Y"),
                    selected  = format(tail(snapshot_dates, 1), "%b %d, %Y")),
        hr(),
        tags$small(style = "color:#556;",
                   paste0("Data snapshot: ", format(Sys.Date(), "%d %b %Y")))
      ),

      # ---- Main content ----
      # NL Query card
      card(
        full_screen = FALSE,
        card_header(icon("comments"), " Ask the Portfolio"),
        layout_columns(
          col_widths = c(10, 2),
          textInput("nlq_input", NULL,
                    placeholder = "e.g. Which AstraZeneca studies need attention?",
                    width = "100%"),
          actionButton("nlq_submit", "Ask", class = "btn-success", style = "margin-top:0;")
        ),
        div(class = "nlq-chips",
            actionButton("chip_highrisk", "High-risk studies"),
            actionButton("chip_delayed",  "Delayed studies"),
            actionButton("chip_qcbelow",  "QC below 70%"),
            actionButton("chip_dbl4w",    "Within 4 weeks of DBL")
        ),
        uiOutput("nlq_result")
      ),

      # KPI value boxes
      layout_columns(
        col_widths = c(2, 2, 2, 3, 3),
        value_box(
          title    = "Total Studies",
          value    = textOutput("kpi_total"),
          showcase = icon("hospital"),
          theme    = "secondary"
        ),
        value_box(
          title    = "Delayed",
          value    = textOutput("kpi_delayed"),
          showcase = icon("exclamation-triangle"),
          theme    = "danger"
        ),
        value_box(
          title    = "At-Risk",
          value    = textOutput("kpi_atrisk"),
          showcase = icon("clock"),
          theme    = "warning"
        ),
        value_box(
          title    = "Avg Prod Done %",
          value    = textOutput("kpi_prod"),
          showcase = icon("check-circle"),
          theme    = "success"
        ),
        value_box(
          title    = "Avg QC Done %",
          value    = textOutput("kpi_qc"),
          showcase = icon("shield"),
          theme    = "info"
        )
      ),

      # Completion Over Time chart
      card(
        full_screen = TRUE,
        card_header(icon("chart-area"), " Portfolio Completion Over Time"),
        plotlyOutput("completion_chart", height = "280px")
      ),

      # Study table
      card(
        full_screen = TRUE,
        card_header(icon("table"), " Study Portfolio"),
        DTOutput("study_table")
      ),

      # Drill-down panel
      uiOutput("drilldown_panel")
    )
  ),

  # ---- TAB 2: Data Inconsistencies ----
  nav_panel(
    title = tags$span(icon("bug"), " Data Inconsistencies"),
    layout_columns(
      col_widths = c(4, 4, 4),
      value_box(
        title    = "Total P21 Issues",
        value    = nrow(p21_data),
        showcase = icon("exclamation-circle"),
        theme    = "danger"
      ),
      value_box(
        title    = "Studies Affected",
        value    = length(unique(p21_data$study_id)),
        showcase = icon("flask"),
        theme    = "warning"
      ),
      value_box(
        title    = "Issue Categories",
        value    = length(unique(p21_data$ai_category)),
        showcase = icon("tags"),
        theme    = "info"
      )
    ),
    layout_columns(
      col_widths = c(5, 7),
      card(
        card_header(icon("chart-pie"), " Issues by Category"),
        plotlyOutput("p21_donut", height = "300px")
      ),
      card(
        card_header(icon("bar-chart"), " Issues per Study"),
        plotlyOutput("p21_bar", height = "300px")
      )
    ),
    card(
      card_header(
        layout_columns(
          col_widths = c(3, 3, 4, 2),
          selectInput("p21_sev_filter",  "Severity",
                      choices = c("All", unique(p21_data$severity))),
          selectInput("p21_cat_filter",  "Category",
                      choices = c("All", unique(p21_data$ai_category))),
          textInput("p21_search", "Search message", placeholder = "Filter by keyword..."),
          div(style = "margin-top:20px;",
              downloadButton("p21_export", "Export CSV", class = "btn-sm btn-outline-success"))
        )
      ),
      DTOutput("p21_table")
    )
  ),

  # ---- TAB 3: Study Updates ----
  nav_panel(
    title = tags$span(icon("edit"), " Study Updates"),
    layout_columns(
      col_widths = c(5, 7),

      # Left: Form
      card(
        card_header(icon("clipboard"), " Enter Study Update"),
        selectInput("entry_study", "Study",
                    choices = sort(unique(study_data_base$study))),
        tags$h5(style = "color:#2ea55e; margin-top:8px;", "Milestone Dates"),
        layout_columns(
          col_widths = c(6, 6),
          dateInput("ms_sap",        "SAP Finalization Planned"),
          dateInput("ms_sap_actual", "SAP Actual")
        ),
        layout_columns(
          col_widths = c(6, 6),
          dateInput("ms_prog_start",  "Programming Start Planned"),
          dateInput("ms_prog_actual", "Programming Start Actual")
        ),
        layout_columns(
          col_widths = c(6, 6),
          dateInput("ms_tfl",        "TFL Delivery Planned"),
          dateInput("ms_tfl_actual", "TFL Actual")
        ),
        layout_columns(
          col_widths = c(6, 6),
          dateInput("ms_dbl",        "DBL Planned"),
          dateInput("ms_dbl_actual", "DBL Actual")
        ),
        hr(),
        tags$h5(style = "color:#2ea55e;", "Deliverable Status"),
        selectInput("del_sdtm",   "SDTM Complete",      choices = del_status_choices),
        selectInput("del_adam",   "ADaM Complete",      choices = del_status_choices),
        selectInput("del_tfl",    "TFLs Complete",      choices = del_status_choices),
        selectInput("del_define", "Define.xml Complete",choices = del_status_choices),
        hr(),
        tags$h5(style = "color:#2ea55e;", "Issue Log"),
        layout_columns(
          col_widths = c(4, 4, 4),
          dateInput("issue_date", "Date", value = Sys.Date()),
          selectInput("issue_cat", "Category",
                      choices = c("Technical","Process","Client","Resource","Other")),
          selectInput("issue_sev", "Severity",
                      choices = c("Low","Medium","High"))
        ),
        textAreaInput("issue_desc", "Description", rows = 2,
                      placeholder = "Describe the issue..."),
        hr(),
        textAreaInput("study_comments", "Study Comments", rows = 3,
                      placeholder = "General notes for this study..."),
        actionButton("save_entry", "  Save Update",
                     class = "btn-success btn-lg w-100",
                     icon  = icon("save"))
      ),

      # Right: History
      card(
        card_header(icon("history"), " Recent Updates"),
        DTOutput("entry_history")
      )
    )
  )
)

# ============================================================
# SERVER
# ============================================================

server <- function(input, output, session) {

  # Reactive study data (can be modified by data entry)
  study_data_rv <- reactiveVal(study_data_base)

  # Selected study from table click
  selected_study <- reactiveVal(NULL)

  # ---- NL Query chips ----
  observeEvent(input$chip_highrisk, {
    updateTextInput(session, "nlq_input", value = "high-risk studies")
  })
  observeEvent(input$chip_delayed, {
    updateTextInput(session, "nlq_input", value = "delayed studies")
  })
  observeEvent(input$chip_qcbelow, {
    updateTextInput(session, "nlq_input", value = "QC below 70%")
  })
  observeEvent(input$chip_dbl4w, {
    updateTextInput(session, "nlq_input", value = "within 4 weeks of DBL")
  })

  # NL query text (also triggers on chip clicks because they update text + submit)
  nlq_text <- reactiveVal("")
  observeEvent(input$nlq_submit, {
    nlq_text(input$nlq_input)
  })
  observeEvent(list(input$chip_highrisk, input$chip_delayed,
                    input$chip_qcbelow,  input$chip_dbl4w), {
    nlq_text(input$nlq_input)
  }, ignoreInit = TRUE)

  # NL result display
  output$nlq_result <- renderUI({
    q <- nlq_text()
    if (nchar(trimws(q)) == 0) return(NULL)
    sdata <- study_data_rv()
    res   <- nlq_filter(q, sdata)
    n     <- nrow(res)

    backend_badge <- switch(.llm_backend,
      anthropic = tags$span(style = "font-size:0.7em;color:#60a5fa;margin-left:8px;",
                            "⚡ Claude"),
      ollama    = tags$span(style = "font-size:0.7em;color:#a78bfa;margin-left:8px;",
                            "🦙 Ollama"),
      tags$span(style = "font-size:0.7em;color:#6b7280;margin-left:8px;",
                "pattern match")
    )

    if (n == 0) {
      div(class = "nlq-result-box",
          tags$b(style = "color:#ffc107;", icon("search"), " No studies matched your query."),
          backend_badge)
    } else {
      # LLM explanation (NULL when fallback or error)
      ai_text <- nlq_explain(q, n, res$study)

      study_list <- if (n <= 8) paste(res$study, collapse = ", ") else
        paste(c(head(res$study, 8), paste0("... +", n - 8, " more")), collapse = ", ")

      div(class = "nlq-result-box",
          tags$b(style = "color:#2ea55e;",
                 icon("check-circle"),
                 sprintf(" %d %s matched", n, ifelse(n == 1, "study", "studies"))),
          backend_badge,
          if (!is.null(ai_text))
            tags$p(style = "margin:6px 0 4px;color:#c9d1e0;font-style:italic;",
                   icon("robot"), " ", ai_text),
          tags$span(style = "color:#8892a4;font-size:0.85em;", study_list)
      )
    }
  })

  # ---- Filtered data ----
  filtered_data <- reactive({
    sdata <- study_data_rv()

    # Business line filter
    if (input$biz_line != "All") {
      sdata <- filter(sdata, fso_fsp == input$biz_line)
    }
    # Client filter
    if (input$client_filter != "All clients") {
      sdata <- filter(sdata, client == input$client_filter)
    }
    # Only started
    if (input$only_started) {
      sdata <- filter(sdata, prod_complete > 0 | qc_passed > 0)
    }
    # NL query
    q <- nlq_text()
    if (nchar(trimws(q)) > 0) {
      sdata <- nlq_filter(q, sdata)
    }
    sdata
  })

  # ---- KPIs ----
  output$kpi_total   <- renderText({ nrow(filtered_data()) })
  output$kpi_delayed <- renderText({ sum(filtered_data()$delayed,  na.rm = TRUE) })
  output$kpi_atrisk  <- renderText({ sum(filtered_data()$at_risk,  na.rm = TRUE) })
  output$kpi_prod    <- renderText({ paste0(round(mean(filtered_data()$prod_pct, na.rm = TRUE), 1), "%") })
  output$kpi_qc      <- renderText({ paste0(round(mean(filtered_data()$qc_pct,  na.rm = TRUE), 1), "%") })

  # ---- Completion Over Time chart ----
  output$completion_chart <- renderPlotly({
    sel_label <- input$chart_through
    sel_date  <- as.Date(sel_label, format = "%b %d, %Y")
    if (is.na(sel_date)) sel_date <- tail(snapshot_dates, 1)
    keep      <- snapshot_dates <= sel_date
    s_dates   <- snapshot_dates[keep]
    s_prod    <- snapshot_prod[keep]
    s_qc      <- snapshot_qc[keep]

    plot_ly() %>%
      add_trace(x = s_dates, y = s_prod, type = "scatter", mode = "lines+markers",
                name = "Production", line = list(color = "#2ea55e", width = 2.5),
                marker = list(color = "#2ea55e", size = 7)) %>%
      add_trace(x = s_dates, y = s_qc,  type = "scatter", mode = "lines+markers",
                name = "QC Passed",   line = list(color = "#3a7bd5", width = 2.5),
                marker = list(color = "#3a7bd5", size = 7)) %>%
      layout(
        title       = list(text = "Portfolio Completion Over Time",
                           font = list(color = "#e8eaf0", size = 14)),
        paper_bgcolor = "#161b22",
        plot_bgcolor  = "#161b22",
        font          = list(color = "#e8eaf0"),
        xaxis         = list(gridcolor = "#30363d", title = ""),
        yaxis         = list(gridcolor = "#30363d", title = "Completion %",
                             range = c(40, 90)),
        legend        = list(x = 0.02, y = 0.98, bgcolor = "rgba(0,0,0,0)"),
        margin        = list(l = 50, r = 20, t = 40, b = 40),
        hovermode     = "x unified"
      )
  })

  # ---- Study table ----
  table_data <- reactive({
    sdata <- filtered_data()
    data.frame(
      Risk        = sapply(sdata$risk_tier, risk_badge_html),
      Study       = sdata$study,
      Client      = sdata$client,
      TA          = ifelse(is.na(sdata$ta), "Unknown", sdata$ta),
      `Prod%`     = sdata$prod_pct,
      `QC%`       = sdata$qc_pct,
      DBL         = ifelse(is.na(sdata$dbl_date), "—", format(sdata$dbl_date, "%d %b %Y")),
      `Wks to DBL`= ifelse(is.na(sdata$weeks_to_dbl), "—",
                           round(sdata$weeks_to_dbl, 1)),
      Deliverables= sdata$total_del,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  })

  output$study_table <- renderDT({
    datatable(
      table_data(),
      escape      = FALSE,
      selection   = "single",
      rownames    = FALSE,
      filter      = "top",
      options     = list(
        pageLength  = 15,
        scrollX     = TRUE,
        dom         = "ftip",
        columnDefs  = list(
          list(className = "dt-center", targets = c(0, 4, 5, 7, 8)),
          list(orderable = FALSE, targets = 0)
        )
      ),
      class = "display compact cell-border"
    ) %>%
      formatStyle(
        "Prod%",
        background = styleInterval(c(50, 75, 90),
                     c("#3d1515","#3d2a0a","#1a3d1a","#0d2a0d")),
        color = "#e8eaf0"
      ) %>%
      formatStyle(
        "QC%",
        background = styleInterval(c(50, 75, 90),
                     c("#3d1515","#3d2a0a","#1a3d1a","#0d2a0d")),
        color = "#e8eaf0"
      )
  })

  # ---- Row selection → selected_study ----
  observeEvent(input$study_table_rows_selected, {
    idx <- input$study_table_rows_selected
    if (length(idx) > 0) {
      td  <- table_data()
      selected_study(td$Study[idx])
    } else {
      selected_study(NULL)
    }
  })

  # ---- Drill-down panel ----
  output$drilldown_panel <- renderUI({
    sname <- selected_study()
    if (is.null(sname)) return(NULL)
    sdata <- study_data_rv()
    s     <- sdata[sdata$study == sname, ]
    if (nrow(s) == 0) return(NULL)
    s <- s[1, ]

    # Progress bars
    prod_bar <- HTML(progress_bar_html(s$prod_pct, "#2ea55e"))
    qc_bar   <- HTML(progress_bar_html(s$qc_pct,  "#3a7bd5"))

    # Risk tier badge
    risk_html <- HTML(risk_badge_html(s$risk_tier))

    # Weeks to DBL
    wk_text <- if (is.na(s$weeks_to_dbl)) "N/A" else
      paste0(round(s$weeks_to_dbl, 1), " wks", if (s$delayed) " (DELAYED)" else "")

    # AI risk factors
    factors   <- s$risk_factors[[1]]
    factor_ui <- if (length(factors) == 0) {
      tags$p(style = "color:#556;", "No significant risk factors detected.")
    } else {
      tagList(lapply(seq_along(factors), function(i) {
        nm  <- names(factors)[i]
        val <- min(max(factors[[i]], 0), 1)
        div(
          style = "margin-bottom:8px;",
          tags$small(style = "color:#aab;", nm),
          div(class = "risk-factor-bar-bg",
              div(class = "risk-factor-bar",
                  style = sprintf("width:%.0f%%;", val * 100)))
        )
      }))
    }

    ai_score_pct <- round(s$ai_risk_score * 100, 1)
    ai_color     <- if (ai_score_pct >= 70) "#dc3545" else
                    if (ai_score_pct >= 50) "#fd7e14" else
                    if (ai_score_pct >= 35) "#ffc107" else "#2ea55e"

    card(
      class = "drilldown-card",
      style = "margin-top: 12px;",
      card_header(
        class = "bg-success text-white",
        icon("microscope"),
        tags$b(sprintf(" Study Drill-Down: %s", sname))
      ),
      layout_columns(
        col_widths = c(4, 4, 4),
        # Left: Completion
        card(
          card_header(icon("tasks"), " Completion & Risk"),
          tags$p(style = "color:#aab; margin-bottom:3px; font-size:0.85em;",
                 "Production Completion"),
          prod_bar,
          tags$br(),
          tags$p(style = "color:#aab; margin-bottom:3px; font-size:0.85em;",
                 "QC Pass Rate"),
          qc_bar,
          tags$br(),
          div(style = "display:flex; align-items:center; gap:8px;",
              tags$span(style = "color:#aab; font-size:0.85em;", "Rule-Based Risk: "),
              risk_html),
          tags$p(style = "color:#aab; font-size:0.8em; margin-top:6px;",
                 sprintf("Score: %.2f", s$risk_score))
        ),
        # Middle: Metrics
        card(
          card_header(icon("info-circle"), " Key Metrics"),
          tags$table(
            class = "table table-sm",
            style = "color:#e8eaf0; font-size:0.85em;",
            tags$tbody(
              tags$tr(tags$td(style = "color:#aab;", "Client"),
                      tags$td(tags$b(s$client))),
              tags$tr(tags$td(style = "color:#aab;", "Portfolio"),
                      tags$td(s$portfolio)),
              tags$tr(tags$td(style = "color:#aab;", "Therapeutic Area"),
                      tags$td(ifelse(is.na(s$ta), "Unknown", s$ta))),
              tags$tr(tags$td(style = "color:#aab;", "Business Line"),
                      tags$td(s$fso_fsp)),
              tags$tr(tags$td(style = "color:#aab;", "Total Deliverables"),
                      tags$td(s$total_del)),
              tags$tr(tags$td(style = "color:#aab;", "Prod-QC Gap"),
                      tags$td(paste0(round(s$prod_pct - s$qc_pct, 1), " pp"))),
              tags$tr(tags$td(style = "color:#aab;", "Sig. QC Delays"),
                      tags$td(s$sig_delays)),
              tags$tr(tags$td(style = "color:#aab;", "Failed QC"),
                      tags$td(s$failed_qc)),
              tags$tr(tags$td(style = "color:#aab;", "Weeks to DBL"),
                      tags$td(wk_text)),
              tags$tr(tags$td(style = "color:#aab;", "DBL Date"),
                      tags$td(ifelse(is.na(s$dbl_date), "—",
                                     format(s$dbl_date, "%d %b %Y"))))
            )
          )
        ),
        # Right: AI Risk Model
        card(
          class = "ai-card",
          card_header(HTML("\U0001F916 AI Risk Model")),
          div(style = "text-align:center; margin: 8px 0 14px;",
              tags$p(style = "color:#aab; font-size:0.82em; margin-bottom:2px;",
                     "Probability of Delay"),
              tags$div(
                style = sprintf(
                  "font-size:2.2em; font-weight:700; color:%s;", ai_color),
                paste0(ai_score_pct, "%")
              )
          ),
          tags$p(style = "color:#7eb8f5; font-size:0.82em; font-weight:600;",
                 "Top Contributing Factors:"),
          factor_ui
        )
      )
    )
  })

  # ---- P21 Findings ----
  p21_filtered <- reactive({
    df <- p21_data
    if (input$p21_sev_filter != "All")
      df <- df[df$severity == input$p21_sev_filter, ]
    if (input$p21_cat_filter != "All")
      df <- df[df$ai_category == input$p21_cat_filter, ]
    kw <- trimws(input$p21_search)
    if (nchar(kw) > 0)
      df <- df[grepl(kw, df$message, ignore.case = TRUE) |
               grepl(kw, df$ai_root_cause, ignore.case = TRUE), ]
    df
  })

  output$p21_donut <- renderPlotly({
    df <- p21_data %>%
      count(ai_category, name = "n") %>%
      arrange(desc(n))
    plot_ly(df,
            labels = ~ai_category, values = ~n,
            type   = "pie", hole = 0.6,
            marker = list(colors = c("#2ea55e","#3a7bd5","#ffc107",
                                     "#dc3545","#6f42c1","#fd7e14","#20c997")),
            textinfo = "label+percent",
            hoverinfo = "label+value") %>%
      layout(
        paper_bgcolor = "#161b22",
        plot_bgcolor  = "#161b22",
        font          = list(color = "#e8eaf0"),
        showlegend    = FALSE,
        margin        = list(l = 10, r = 10, t = 10, b = 10)
      )
  })

  output$p21_bar <- renderPlotly({
    df <- p21_data %>%
      count(study_id, name = "n") %>%
      arrange(n)
    plot_ly(df, x = ~n, y = ~study_id, type = "bar", orientation = "h",
            marker = list(color = "#3a7bd5")) %>%
      layout(
        paper_bgcolor = "#161b22",
        plot_bgcolor  = "#161b22",
        font          = list(color = "#e8eaf0"),
        xaxis  = list(gridcolor = "#30363d", title = "# Issues"),
        yaxis  = list(gridcolor = "#30363d", title = "", automargin = TRUE),
        margin = list(l = 80, r = 20, t = 10, b = 40),
        bargap = 0.3
      )
  })

  output$p21_table <- renderDT({
    df <- p21_filtered()
    disp <- data.frame(
      Study            = df$study_id,
      `Rule ID`        = df$rule_id,
      Severity         = sapply(df$severity, severity_badge_html),
      `CDISC Standard` = df$cdisc_standard,
      Dataset          = df$dataset,
      Message          = df$message,
      `AI Category`    = df$ai_category,
      `AI Root Cause`  = df$ai_root_cause,
      `AI Suggested Fix` = df$ai_suggested_fix,
      `Avg Resolution (hrs)` = df$avg_resolution_hrs,
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
    datatable(
      disp,
      escape    = FALSE,
      rownames  = FALSE,
      selection = "none",
      options   = list(
        pageLength = 10,
        scrollX    = TRUE,
        dom        = "tip"
      ),
      class = "display compact cell-border"
    )
  })

  output$p21_export <- downloadHandler(
    filename = function() paste0("p21_findings_", Sys.Date(), ".csv"),
    content  = function(file) write.csv(p21_filtered(), file, row.names = FALSE)
  )

  # ---- Study Updates ----
  save_trigger <- reactiveVal(0)

  observeEvent(input$save_entry, {
    req(input$entry_study)
    con <- dbConnect(SQLite(), "data/data_entry.db")
    dbExecute(con,
      "INSERT INTO study_updates
         (study, timestamp,
          ms_sap, ms_sap_actual,
          ms_prog_start, ms_prog_actual,
          ms_tfl, ms_tfl_actual,
          ms_dbl, ms_dbl_actual,
          del_sdtm, del_adam, del_tfl, del_define,
          issue_date, issue_cat, issue_sev, issue_desc,
          comments)
       VALUES
         (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      list(
        input$entry_study,
        format(Sys.time(), "%Y-%m-%d %H:%M:%S"),
        as.character(input$ms_sap),
        as.character(input$ms_sap_actual),
        as.character(input$ms_prog_start),
        as.character(input$ms_prog_actual),
        as.character(input$ms_tfl),
        as.character(input$ms_tfl_actual),
        as.character(input$ms_dbl),
        as.character(input$ms_dbl_actual),
        input$del_sdtm,
        input$del_adam,
        input$del_tfl,
        input$del_define,
        as.character(input$issue_date),
        input$issue_cat,
        input$issue_sev,
        input$issue_desc,
        input$study_comments
      )
    )
    dbDisconnect(con)

    # Update risk score if TFL actual > TFL planned
    tfl_planned <- as.Date(input$ms_tfl)
    tfl_actual  <- as.Date(input$ms_tfl_actual)
    sdata <- study_data_rv()
    if (!is.na(tfl_planned) && !is.na(tfl_actual) && tfl_actual > tfl_planned) {
      idx <- which(sdata$study == input$entry_study)
      if (length(idx) > 0) {
        sdata$risk_score[idx] <- pmin(sdata$risk_score[idx] + 0.20, 0.95)
        sdata$risk_tier[idx]  <- dplyr::case_when(
          sdata$risk_score[idx] >= 0.80 ~ "Critical",
          sdata$risk_score[idx] >= 0.65 ~ "High",
          sdata$risk_score[idx] >= 0.45 ~ "Elevated",
          sdata$risk_score[idx] >= 0.30 ~ "Moderate",
          TRUE                          ~ "Low"
        )
        study_data_rv(sdata)
      }
    }

    showNotification("Update saved! Risk score recalculated.", type = "message")
    save_trigger(save_trigger() + 1)
  })

  output$entry_history <- renderDT({
    save_trigger()  # depend on saves
    con  <- dbConnect(SQLite(), "data/data_entry.db")
    hist <- tryCatch(
      dbGetQuery(con, "SELECT study, timestamp, del_sdtm, del_adam, del_tfl, ms_tfl, ms_tfl_actual, issue_sev, comments
                       FROM study_updates ORDER BY id DESC LIMIT 50"),
      error = function(e) data.frame()
    )
    dbDisconnect(con)
    datatable(
      hist,
      rownames  = FALSE,
      selection = "none",
      options   = list(pageLength = 10, scrollX = TRUE, dom = "tip"),
      class     = "display compact cell-border"
    )
  })
}

# ============================================================
# RUN
# ============================================================

shinyApp(ui = ui, server = server)
