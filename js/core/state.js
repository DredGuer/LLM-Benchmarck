/**
 * LLM Benchmarker - Global State Management
 * Centralized state for the application
 */

// Global state object
var state = {
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
var manualHardwareConfig = null;
var currentAbortController = null;
var currentTestState = {
  model: null,
  promptType: null,
  promptText: null,
  maxTokens: 512,
  tokensReceived: 0,
  isStreaming: false,
  startTime: null,
  logs: [],
};
var skipToNextFlag = false;
var retryCurrentFlag = false;

// Storage keys
var HARDWARE_CONFIG_KEY = 'llm_bench_hardware_config';
var HISTORY_KEY = 'llm_bench_history';
var API_KEYS_KEY = 'llm_bench_keys';
