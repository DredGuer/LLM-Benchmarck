/**
 * LLM Benchmarker - Memory Monitoring Backend
 * Micro server to monitor Ollama process RAM usage
 * 
 * Usage:
 *   node server.js
 *   or: node server.js --port 3001
 * 
 * Then access: http://localhost:3001/api/memory
 */

const express = require('express');
const { exec } = require('child_process');
const pidusage = require('pidusage');
const cors = require('cors');

const app = express();
const PORT = process.argv.includes('--port') ? 
  parseInt(process.argv[process.argv.indexOf('--port') + 1]) || 3001 : 3001;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Get Ollama PID by searching for the process
 */
function getOllamaPID() {
  return new Promise((resolve) => {
    // Try different commands based on OS
    const commands = [
      'pgrep -f ollama',           // Linux/macOS: grep for ollama process
      'pgrep -x ollama',           // Linux/macOS: exact match
      'ps aux | grep ollama | grep -v grep | awk \'{print $2}\'', // Alternative
    ];

    let tried = 0;
    
    function tryNext() {
      if (tried >= commands.length) {
        resolve(null);
        return;
      }
      
      exec(commands[tried], (error, stdout, stderr) => {
        tried++;
        if (!error && stdout && stdout.trim()) {
          const pid = parseInt(stdout.trim().split('\n')[0]);
          if (!isNaN(pid) && pid > 0) {
            resolve(pid);
            return;
          }
        }
        tryNext();
      });
    }
    
    tryNext();
  });
}

/**
 * Get memory usage for a specific PID
 */
async function getProcessMemory(pid) {
  try {
    const stats = await pidusage(pid);
    return {
      pid: pid,
      memory: stats.memory, // in bytes
      memoryMB: Math.round(stats.memory / 1024 / 1024),
      cpu: stats.cpu,
      timestamp: Date.now()
    };
  } catch (err) {
    return null;
  }
}

/**
 * Get system memory info
 */
function getSystemMemory() {
  const os = require('os');
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  return {
    total: total,
    free: free,
    used: used,
    totalMB: Math.round(total / 1024 / 1024),
    freeMB: Math.round(free / 1024 / 1024),
    usedMB: Math.round(used / 1024 / 1024)
  };
}

/**
 * Check if Ollama is running
 */
async function isOllamaRunning() {
  try {
    const pid = await getOllamaPID();
    return pid !== null;
  } catch (err) {
    return false;
  }
}

// API Endpoints

/**
 * GET /api/memory - Get current Ollama memory usage
 */
app.get('/api/memory', async (req, res) => {
  try {
    const pid = await getOllamaPID();
    
    if (!pid) {
      return res.status(404).json({
        error: 'Ollama process not found. Make sure Ollama is running.',
        system: getSystemMemory()
      });
    }
    
    const mem = await getProcessMemory(pid);
    
    if (!mem) {
      return res.status(404).json({
        error: 'Could not get memory for Ollama process',
        pid: pid,
        system: getSystemMemory()
      });
    }
    
    res.json({
      success: true,
      pid: pid,
      process: {
        memory: mem.memory,
        memoryMB: mem.memoryMB,
        cpu: mem.cpu
      },
      system: getSystemMemory(),
      timestamp: Date.now()
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
      system: getSystemMemory()
    });
  }
});

/**
 * GET /api/ollama/status - Check if Ollama is running
 */
app.get('/api/ollama/status', async (req, res) => {
  try {
    const running = await isOllamaRunning();
    const pid = running ? await getOllamaPID() : null;
    
    res.json({
      running: running,
      pid: pid
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ollama/pid - Get Ollama PID only
 */
app.get('/api/ollama/pid', async (req, res) => {
  try {
    const pid = await getOllamaPID();
    res.json({ pid: pid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET / - Health check
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    endpoints: [
      '/api/memory - Get Ollama memory usage',
      '/api/ollama/status - Check if Ollama is running',
      '/api/ollama/pid - Get Ollama PID'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LLM Benchmarker Memory Monitor`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`💡 Endpoints:`);
  console.log(`   - GET /api/memory`);
  console.log(`   - GET /api/ollama/status`);
  console.log(`   - GET /api/ollama/pid`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
