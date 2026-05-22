# LLM Benchmarker - Backend de Monitoring Mémoire

Ce backend optionnel permet de surveiller précisément la consommation RAM du processus **Ollama** pendant les benchmarks.

## 🚀 Installation

### Pré-requis
- Node.js v14+ (recommandé: v18+)
- npm ou yarn
- Ollama installé et en cours d'exécution

### Étapes

1. **Installer les dépendances** :
```bash
cd /chemin/vers/LLM-Benchmarck
npm install
```

2. **Démarrer le backend** :
```bash
# Par défaut sur le port 3001
node server.js

# Ou sur un port personnalisé
node server.js --port 4000
```

3. **Vérifier que ça fonctionne** :
```bash
# Dans un autre terminal
curl http://localhost:3001/
curl http://localhost:3001/api/memory
curl http://localhost:3001/api/ollama/status
```

## 📡 Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/memory` | Récupère la mémoire actuelle d'Ollama |
| GET | `/api/environment` | **Nouveau!** Récupère toutes les infos système (OS, CPU, RAM, **GPU**) |
| GET | `/api/ollama/status` | Vérifie si Ollama est en cours d'exécution |
| GET | `/api/ollama/pid` | Récupère le PID du processus Ollama |

### Réponse de `/api/memory`
```json
{
  "success": true,
  "pid": 12345,
  "process": {
    "memory": 1342177280,
    "memoryMB": 1280,
    "cpu": 15.2
  },
  "system": {
    "total": 17179869184,
    "free": 4294967296,
    "used": 12884901888,
    "totalMB": 16384,
    "freeMB": 4096,
    "usedMB": 12288
  },
  "timestamp": 1700000000000
}
```

### Réponse de `/api/environment` (Nouveau!)
```json
{
  "success": true,
  "timestamp": 1700000000000,
  "os": {
    "name": "Linux",
    "version": "5.15.0-101-generic",
    "arch": "x64",
    "hostname": "my-pc"
  },
  "machine": {
    "model": "Dell XPS 15",
    "manufacturer": "Dell Inc."
  },
  "cpu": {
    "model": "Intel Core i7-12700H",
    "cores": 14,
    "speed": "2700 MHz"
  },
  "memory": {
    "total": 17179869184,
    "free": 4294967296,
    "used": 12884901888,
    "totalGB": 16,
    "freeGB": 4,
    "totalStr": "16 GB",
    "freeStr": "4 GB"
  },
  "gpu": {
    "model": "NVIDIA GeForce RTX 3070",
    "type": "dedicated",
    "vram": "8192 MB",
    "vramMB": 8192,
    "vramStr": "8192 MB",
    "all": [
      {
        "model": "NVIDIA GeForce RTX 3070",
        "type": "dedicated",
        "vram": "8192 MB",
        "vramMB": 8192,
        "busId": "0000:01:00.0"
      },
      {
        "model": "Intel Corporation Alder Lake-P Integrated Graphics",
        "type": "integrated",
        "vram": "Unknown",
        "vramMB": null,
        "busId": "0000:00:02.0"
      }
    ]
  },
  "disk": {
    "totalGB": 500,
    "freeGB": 200,
    "usedGB": 300
  }
}
```

> **💡 Priorité GPU** : Le champ `gpu` contient le GPU **principal sélectionné** (priorité NVIDIA > AMD > Intel) et `gpu.all` liste **tous les GPUs détectés**.

## 🎯 Comment ça marche

1. **Détection du PID Ollama** : Le backend cherche le processus `ollama` en utilisant plusieurs commandes système
2. **Surveillance de la mémoire** : Utilise le package `pidusage` pour récupérer la consommation mémoire du processus
3. **Requêtes périodiques** : Le frontend interroge le backend toutes les 500ms pendant un test
4. **Calcul des statistiques** : Pic et moyenne de consommation RAM

## 💡 Support multi-OS

Le backend tente plusieurs commandes pour trouver le PID d'Ollama :
- `pgrep -f ollama` (Linux/macOS)
- `pgrep -x ollama` (Linux/macOS)
- `ps aux | grep ollama | grep -v grep | awk '{print $2}'` (fallback)

## 🎮 Détection GPU avancée (Nouveau!)

Le backend détecte **tous les GPUs** disponibles sur votre système et applique une **priorité intelligente** :

### Priorité de sélection
| Niveau | Constructeur | Commande de détection |
|--------|--------------|----------------------|
| ⭐⭐⭐ | **NVIDIA** | `lspci` (Linux) / `wmic` (Windows) |
| ⭐⭐ | **AMD/Radeon** | `lspci` (Linux) / `wmic` (Windows) |
| ⭐ | **Intel** | `lspci` (Linux) / `wmic` (Windows) |

### Méthodes de récupération VRAM

#### Linux
| Constructeur | Méthode | Commande |
|--------------|---------|----------|
| **NVIDIA** | Primary | `nvidia-smi --query-gpu=memory.total --format=csv,noheader` |
| **NVIDIA** | Fallback | `nvidia-settings -q [gpu:0]/GPUMemoryTotal` |
| **AMD** | Primary | `/sys/class/drm/card*/device/mem_info_vram_total` |
| **Tous** | Fallback | `lshw -C display` |

#### Windows
| Constructeur | Méthode | Commande |
|--------------|---------|----------|
| **Tous** | Primary | `wmic path win32_VideoController get name,AdapterRAM /format:csv` |

### Exemple de détection multi-GPU (Linux)
Si vous avez à la fois un iGPU Intel et un dGPU NVIDIA :
```bash
$ lspci | grep VGA
00:02.0 VGA compatible controller: Intel Corporation Alder Lake-P Integrated Graphics
01:00.0 VGA compatible controller: NVIDIA Corporation GA104 [GeForce RTX 3070]
```

Le backend **sélectionnera automatiquement la RTX 3070** comme GPU principal grâce à la priorité NVIDIA > Intel.

> **⚠️ Note** : Pour que la VRAM AMD soit détectée sur Linux, le module `amdgpu` doit être chargé et les fichiers `/sys/class/drm/card*/device/mem_info_vram_total` doivent être accessibles.

## ⚙️ Configuration

### Changer le port
```bash
# Dans le fichier server.js
const PORT = 4000; // ou via la ligne de commande

# Ou en ligne de commande
node server.js --port 4000
```

### Changer l'URL du backend dans le frontend
Modifiez `js/core/memory.js` :
```javascript
window.MEMORY_MONITOR_CONFIG = {
  backendUrl: 'http://localhost:4000', //Changez le port ici
  pollInterval: 500,
  timeout: 2000
};
```

## 🔄 Alternative sans backend

Si vous ne voulez pas utiliser le backend, vous pouvez :

1. **Utiliser Chrome avec le flag** `--enable-precision-memory-info`
   - Mesure la mémoire JS du navigateur (moins précis)
   - Pas besoin de lancer le backend

2. **Manuellement via outils système**
   - macOS: `Activity Monitor` → cherchez `ollama`
   - Linux: `htop` → filtrez par `ollama`
   - Windows: `Task Manager` → onglet `Details`

## 📦 Dépendances

- **express** : Serveur HTTP
- **cors** : Middleware CORS pour les requêtes cross-origin
- **pidusage** : Récupère la consommation CPU/mémoire d'un processus

## 🐛 Dépannage

### Le backend ne détecte pas Ollama
```bash
# Vérifiez qu'Ollama est bien en cours d'exécution
ps aux | grep ollama

# Ou sur Windows
Get-Process | Where-Object { $_.ProcessName -like "*ollama*" }
```

### Erreur "Cannot find module"
```bash
npm install
```

### Port déjà utilisé
```bash
# Trouvez quel processus utilise le port
lsof -i :3001

# Tuez le processus
kill -9 <PID>

# Ou changez de port
node server.js --port 3002
```

### CORS errors
Le backend utilise déjà le middleware CORS. Si vous avez toujours des problèmes :
- Vérifiez que le frontend et le backend sont sur le même domaine ou `localhost`
- Assurez-vous qu'aucun autre serveur ne bloque les requêtes

## 📄 Licence

Apache 2.0 - Voir le fichier LICENSE pour plus de détails.
