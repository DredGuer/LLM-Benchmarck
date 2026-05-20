/**
 * LLM Benchmarker - Global State Management
 * Centralized state for the application
 */

// Global state object
state = {
  runner: 'ollama',
  model: '',
  selectedPrompts: new Set(['conversation']),
  results: [],
  isRunning: false,
  env: {},
  apiKeys: {},
  customBase: '',
};

// Benchmark state variables
manualHardwareConfig = null;
currentAbortController = null;
currentTestState = {
  model: null,
  promptType: null,
  promptText: null,
  maxTokens: 512,
  tokensReceived: 0,
  isStreaming: false,
  startTime: null,
  logs: [],
};
skipToNextFlag = false;
retryCurrentFlag = false;

// Storage keys
HARDWARE_CONFIG_KEY = 'llm_bench_hardware_config';
HISTORY_KEY = 'llm_bench_history';
API_KEYS_KEY = 'llm_bench_keys';
