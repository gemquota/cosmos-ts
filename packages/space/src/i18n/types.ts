export interface LocaleMessages {
  cli: {
    project_created: string;
    session_started: string;
    session_resumed: string;
    session_completed: string;
    no_projects: string;
    export_generated: string;
    framework_loaded: string;
    validation_passed: string;
    validation_failed: string;
  };
  engine: {
    answer_submitted: string;
    round_completed: string;
    series_completed: string;
    session_completed: string;
    invalid_answer: string;
    invalid_question: string;
    resume_version_mismatch: string;
    resume_invalid_questions: string;
  };
  intelligence: {
    contradictions_found: string;
    completeness_score: string;
    recommendations: string;
    routing_decision: string;
  };
  export: { staleness_warning: string; export_format: string; export_complete: string };
  errors: {
    project_not_found: string;
    session_not_found: string;
    framework_not_found: string;
    config_invalid: string;
    llm_provider_not_found: string;
    unknown_error: string;
  };
  ui: {
    series: string;
    round: string;
    question: string;
    answer: string;
    choice: string;
    progress: string;
    dashboard: string;
    summary: string;
    export: string;
    reset: string;
    start: string;
    next: string;
    previous: string;
    skip: string;
  };
}
export type LocaleCode = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'pt';
export interface LocaleDefinition {
  code: LocaleCode;
  name: string;
  nativeName: string;
  messages: LocaleMessages;
}
