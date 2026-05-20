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
const { exec, execSync } = require('child_process');
const pidusage = require('pidusage');
const cors = require('cors');
const os = require('os');
const fs = require('fs');

const app = express();
const PORT = process.argv.includes('--port') ? 
  parseInt(process.argv[process.argv.indexOf('--port') + 1]) || 3001 : 3001;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Get Ollama PID by searching for the process
 * Returns the PID with the highest memory usage (the actual model runner)
 */
function getOllamaPID() {
  return new Promise((resolve) => {
    const platform = os.platform();
    
    // Try different commands based on OS
    const commands = [
      'pgrep -f ollama',           // Linux/macOS: grep for ollama process
      'pgrep -x ollama',           // Linux/macOS: exact match
    ];

    let tried = 0;
    
    function tryNext() {
      if (tried >= commands.length) {
        resolve(null);
        return;
      }
      
      exec(commands[tried], { encoding: 'utf-8' }, (error, stdout, stderr) => {
        tried++;
        if (!error && stdout && stdout.trim()) {
          const pids = stdout.trim().split('\n').filter(p => p.trim()).map(p => parseInt(p)).filter(p => !isNaN(p) && p > 0);
          
          if (pids.length === 0) {
            tryNext();
            return;
          }
          
          // Si plusieurs PIDs, trouver celui avec la plus grosse RAM
          if (pids.length > 1 && (platform === 'darwin' || platform === 'linux')) {
            console.log('[DEBUG] Multiple Ollama PIDs found:', pids);
            exec('ps -p ' + pids.join(',') + ' -o pid,rss= --no-headers', { encoding: 'utf-8' }, (err, result) => {
              if (err || !result) {
                console.log('[DEBUG] Could not get RSS for PIDs, using first:', pids[0]);
                resolve(pids[0]);
                return;
              }
              
              const lines = result.trim().split('\n');
              let maxPid = pids[0];
              let maxRss = 0;
              
              for (const line of lines) {
                if (!line.trim()) continue;
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                  const pid = parseInt(parts[0]);
                  const rssKb = parseInt(parts[1]);
                  if (pid && !isNaN(rssKb) && rssKb > maxRss) {
                    maxRss = rssKb;
                    maxPid = pid;
                  }
                }
              }
              
              console.log('[DEBUG] Selected PID with highest RSS (' + (maxRss / 1024).toFixed(0) + ' MB):', maxPid);
              resolve(maxPid);
            });
          } else {
            // Un seul PID ou plateforme non supportée
            resolve(pids[0]);
          }
        } else {
          tryNext();
        }
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

/**
 * Get system memory info (already exists, moved here for reference)
 */
function getSystemMemory() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  
  return {
    total: total,
    free: free,
    used: used,
    totalMB: Math.round(total / 1024 / 1024),
    freeMB: Math.round(free / 1024 / 1024),
    usedMB: Math.round(used / 1024 / 1024),
    totalGB: Math.round(total / 1024 / 1024 / 1024 * 10) / 10,
    freeGB: Math.round(free / 1024 / 1024 / 1024 * 10) / 10
  };
}

/**
 * Get disk usage information
 */
function getDiskUsage() {
  try {
    const stats = fs.statfsSync('/');
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;
    const used = total - (stats.bfree * stats.bsize);
    
    return {
      total: total,
      free: free,
      used: used,
      totalGB: Math.round(total / 1024 / 1024 / 1024 * 10) / 10,
      freeGB: Math.round(free / 1024 / 1024 / 1024 * 10) / 10,
      usedGB: Math.round(used / 1024 / 1024 / 1024 * 10) / 10
    };
  } catch (err) {
    return {
      total: 0,
      free: 0,
      used: 0,
      totalGB: 0,
      freeGB: 0,
      usedGB: 0
    };
  }
}

/**
 * Get GPU information (cross-platform)
 */
function getGPUInfo() {
  try {
    const platform = os.platform();
    
    if (platform === 'darwin') { // macOS
      const result = execSync('system_profiler SPDisplaysDataType | grep -A 10 "Chipset Model"', { encoding: 'utf-8' });
      const gpuMatch = result.match(/Chipset Model:\s*(.+)/);
      const vramMatch = result.match(/VRAM \(Total\):\s*(.+)/);
      
      return {
        model: gpuMatch ? gpuMatch[1].trim() : 'Unknown',
        vram: vramMatch ? vramMatch[1].trim() : 'Unknown',
        vramMB: vramMatch ? parseVRAM(vramMatch[1]) : null
      };
    } 
    else if (platform === 'linux') {
      const result = execSync('lspci -v | grep -i vga -A 10', { encoding: 'utf-8' });
      const gpuMatch = result.match(/VGA\s+compatible\s+controller:\s*(.+)/);
      
      // Try to get VRAM from lshw
      let vram = 'Unknown';
      let vramMB = null;
      try {
        const vramResult = execSync('lshw -C display | grep -i "configuration" -A 5', { encoding: 'utf-8' });
        const vramMatch = vramResult.match(/memory=(\d+)MiB/);
        if (vramMatch) {
          vram = vramMatch[1] + ' MiB';
          vramMB = parseInt(vramMatch[1]);
        }
      } catch (e) {}
      
      return {
        model: gpuMatch ? gpuMatch[1].trim() : 'Unknown',
        vram: vram,
        vramMB: vramMB
      };
    }
    else if (platform === 'win32') {
      const result = execSync('wmic path win32_VideoController get name', { encoding: 'utf-8' });
      const gpuMatch = result.match(/([^\s]+\s+[^\s]+)/);
      
      // Try to get VRAM
      let vram = 'Unknown';
      let vramMB = null;
      try {
        const vramResult = execSync('wmic path win32_VideoController get AdapterRAM', { encoding: 'utf-8' });
        const vramMatch = vramResult.match(/(\d+)/);
        if (vramMatch) {
          vram = vramMatch[1] + ' bytes';
          vramMB = Math.round(parseInt(vramMatch[1]) / 1024 / 1024);
        }
      } catch (e) {}
      
      return {
        model: gpuMatch ? gpuMatch[0].trim() : 'Unknown',
        vram: vram,
        vramMB: vramMB
      };
    }
    
    return {
      model: 'Unknown',
      vram: 'Unknown',
      vramMB: null
    };
  } catch (err) {
    return {
      model: 'Detection failed',
      vram: 'Unknown',
      vramMB: null
    };
  }
}

/**
 * Parse VRAM string to MB
 */
function parseVRAM(vramStr) {
  if (vramStr.includes('MB')) {
    return parseInt(vramStr);
  } else if (vramStr.includes('GB')) {
    return Math.round(parseFloat(vramStr) * 1024);
  } else if (vramStr.includes('TB')) {
    return Math.round(parseFloat(vramStr) * 1024 * 1024);
  }
  return null;
}

/**
 * Get complete system environment information
 */
function getSystemEnvironment() {
  const cpus = os.cpus();
  const gpu = getGPUInfo();
  const mem = getSystemMemory();
  const disk = getDiskUsage();
  
  return {
    os: {
      name: mapOS(os.platform()),
      version: os.release(),
      arch: os.arch(),
      hostname: os.hostname()
    },
    machine: {
      model: getMachineModel(),
      manufacturer: getMachineManufacturer()
    },
    cpu: {
      model: cpus[0] ? cpus[0].model : 'Unknown',
      cores: cpus.length,
      speed: cpus[0] ? cpus[0].speed + ' MHz' : 'Unknown'
    },
    memory: {
      total: mem.total,
      free: mem.free,
      used: mem.used,
      totalGB: mem.totalGB,
      freeGB: mem.freeGB,
      usedGB: mem.usedGB,
      totalStr: mem.totalGB + ' GB',
      freeStr: mem.freeGB + ' GB'
    },
    gpu: {
      model: gpu.model,
      vram: gpu.vram,
      vramMB: gpu.vramMB,
      vramStr: gpu.vramMB ? gpu.vramMB + ' MB' : gpu.vram
    },
    disk: {
      totalGB: disk.totalGB,
      freeGB: disk.freeGB,
      usedGB: disk.usedGB
    }
  };
}

/**
 * Map OS platform to readable name
 */
function mapOS(platform) {
  const map = {
    'win32': 'Windows',
    'darwin': 'macOS',
    'linux': 'Linux',
    'freebsd': 'FreeBSD',
    'openbsd': 'OpenBSD',
    'sunos': 'Solaris'
  };
  return map[platform] || platform;
}

/**
 * Get machine model (cross-platform)
 */
function getMachineModel() {
  try {
    const platform = os.platform();
    
    if (platform === 'darwin') {
      const result = execSync('sysctl -n hw.model', { encoding: 'utf-8' });
      return result.trim() || 'Unknown';
    } else if (platform === 'linux') {
      const result = execSync('cat /sys/class/dmi/id/product_name 2>/dev/null || cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null || echo Unknown', { encoding: 'utf-8' });
      return result.trim() || 'Unknown';
    } else if (platform === 'win32') {
      const result = execSync('wmic computersystem get model', { encoding: 'utf-8' });
      const lines = result.split('\n');
      return lines[1] ? lines[1].trim() : 'Unknown';
    }
    return 'Unknown';
  } catch (err) {
    return 'Unknown';
  }
}

/**
 * Get machine manufacturer (cross-platform)
 */
function getMachineManufacturer() {
  try {
    const platform = os.platform();
    
    if (platform === 'darwin') {
      const result = execSync('sysctl -n hw.manufacturer', { encoding: 'utf-8' });
      return result.trim() || 'Unknown';
    } else if (platform === 'linux') {
      const result = execSync('cat /sys/class/dmi/id/sys_vendor 2>/dev/null || echo Unknown', { encoding: 'utf-8' });
      return result.trim() || 'Unknown';
    } else if (platform === 'win32') {
      const result = execSync('wmic computersystem get manufacturer', { encoding: 'utf-8' });
      const lines = result.split('\n');
      return lines[1] ? lines[1].trim() : 'Unknown';
    }
    return 'Unknown';
  } catch (err) {
    return 'Unknown';
  }
}

// API Endpoints

/**
 * GET /api/memory - Get current Ollama memory usage
 */
app.get('/api/memory', async (req, res) => {
  try {
    console.log('[DEBUG] /api/memory - Fetching Ollama PID...');
    const pid = await getOllamaPID();
    console.log('[DEBUG] /api/memory - Ollama PID:', pid);
    
    if (!pid) {
      console.log('[DEBUG] /api/memory - Ollama not running');
      return res.status(404).json({
        error: 'Ollama process not found. Make sure Ollama is running.',
        system: getSystemMemory()
      });
    }
    
    console.log('[DEBUG] /api/memory - Getting memory for PID:', pid);
    const mem = await getProcessMemory(pid);
    console.log('[DEBUG] /api/memory - Raw memory data:', mem);
    
    if (!mem) {
      console.log('[DEBUG] /api/memory - Could not get memory for PID:', pid);
      return res.status(404).json({
        error: 'Could not get memory for Ollama process',
        pid: pid,
        system: getSystemMemory()
      });
    }
    
    console.log('[DEBUG] /api/memory - Returning memory:', mem.memoryMB, 'MB');
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
    console.log('[DEBUG] /api/memory - Error:', err.message);
    res.status(500).json({
      error: err.message,
      system: getSystemMemory()
    });
  }
});

/**
 * GET /api/environment - Get complete system environment information
 */
app.get('/api/environment', (req, res) => {
  try {
    const env = getSystemEnvironment();
    res.json({
      success: true,
      timestamp: Date.now(),
      ...env
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      fallback: {
        os: { name: 'Unknown', version: 'Unknown' },
        cpu: { model: 'Unknown', cores: 0 },
        memory: { totalStr: 'Unknown' },
        gpu: { model: 'Unknown', vramStr: 'Unknown' }
      }
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
      '/api/environment - Get full system environment info',
      '/api/memory - Get Ollama memory usage',
      '/api/ollama/status - Check if Ollama is running',
      '/api/ollama/pid - Get Ollama PID'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LLM Benchmarker Backend`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`💡 Endpoints:`);
  console.log(`   - GET /api/environment - System info (OS, CPU, RAM, GPU)`);
  console.log(`   - GET /api/memory - Ollama memory usage`);
  console.log(`   - GET /api/ollama/status - Check if Ollama is running`);
  console.log(`   - GET /api/ollama/pid - Get Ollama PID`);
  console.log(`\nPress Ctrl+C to stop\n`);
});
