# LLM Benchmarker - Backend de Monitoring Mémoire

Documentation de **LLM Benchmarker v0.06**. [Retour au guide de démarrage](README.md).

Ce backend optionnel échantillonne la somme des mémoires résidentes (RSS) des processus Ollama détectés et de leurs descendants, y compris les runners MLX/Python. Chaque PID est compté une fois. Les pages partagées peuvent néanmoins être comptées plusieurs fois. Cette mesure n'est ni la VRAM ni le pic d'allocation MLX des logs ; le pic est le maximum des échantillons recueillis.

## 🚀 Installation

### Pré-requis
- Node.js v14+ (recommandé: v18+)
- npm ou yarn
- Ollama installé et en cours d'exécution

### Étapes

1. **Installer les dépendances** :
```bash
# Depuis la racine du dépôt LLM-Benchmarck
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
curl http://localhost:3001/api/ping
curl http://localhost:3001/api/memory
curl http://localhost:3001/api/ollama/status
```

## 📡 Endpoints API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/` | Health check |
| GET | `/api/ping` | **Nouveau!** Vérification rapide que le backend est vivant (réponse instantanée) |
| GET | `/api/memory` | Récupère la mémoire actuelle d'Ollama |
| GET | `/api/environment` | **Nouveau!** Récupère toutes les infos système (OS, CPU, RAM, **GPU**) |
| GET | `/api/ollama/status` | Vérifie si Ollama est en cours d'exécution |
| GET | `/api/ollama/pid` | Récupère le PID du processus Ollama |

### Réponse de `/api/ping`
```json
{
  "status": "ok",
  "timestamp": 1717986918400
}
```

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

1. **Détection de l'arbre Ollama** : utilise `ps` sur macOS/Linux ou `Get-CimInstance Win32_Process` sur Windows, puis suit récursivement les liens parent/enfant, même si le nom du runner ne contient pas Ollama.
2. **Surveillance de la mémoire** : utilise `pidusage` pour chaque PID et additionne les valeurs en octets. Un échantillon incomplet est refusé pour éviter de publier seulement la mémoire du parent.
3. **Requêtes périodiques** : Le frontend interroge le backend toutes les 500ms pendant un test
4. **Calcul des statistiques** : Pic et moyenne de consommation RAM

## 💡 Support multi-OS

Le backend lit PID, PPID et nom de l'exécutable avec `ps -axo pid=,ppid=,comm=` (macOS/Linux) ou PowerShell/CIM (Windows). L'API conserve `process.memory` et `process.memoryMB` pour le frontend ; `process.source`, `process.unit`, `process.pids` et `process.processes` précisent la provenance et le détail de la mesure. La valeur historique `memoryMB` est calculée en MiB (1024² octets).

`/api/ps` d'Ollama expose les modèles chargés et leurs tailles, pas le pic d'allocation MLX des logs. Ces valeurs ne sont pas utilisées comme substitut à la RSS mesurée.

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
Par défaut, le backend écoute sur **`localhost:3001`**.

```bash
# Dans le fichier server.js
const PORT = 4000; // ou via la ligne de commande

# Ou en ligne de commande
node server.js --port 4000
```

> **⚠️ Important** : Si vous changez le port du backend, vous devez aussi mettre à jour la configuration dans `js/core/memory.js` et `js/core/environment.js` pour que le frontend puisse le trouver.

### Changer l'URL du backend dans le frontend
Modifiez `js/core/memory.js` ou `js/core/environment.js` :
```javascript
// Dans memory.js
window.MEMORY_MONITOR_CONFIG = {
  backendUrl: 'http://localhost:4000', // Changez le port ici
  pollInterval: 500,
  timeout: 2000
};

// Dans environment.js
window.BACKEND_ENV_CONFIG = {
  url: 'http://localhost:4000', // Changez le port ici
  timeout: 2000
};
```

## 🔄 Alternative sans backend

Si vous ne voulez pas utiliser le backend, vous pouvez :

1. **Utiliser Chrome avec le flag** `--enable-precision-memory-info`
   - Mesure le tas JavaScript du navigateur, pas la RAM d'Ollama ni la VRAM ; cette mesure n'est pas un substitut au monitoring du modèle
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


## Mémoire du modèle chargé (Ollama/MLX)

`GET /api/ollama/models` relaie `/api/ps` depuis Ollama sur `127.0.0.1:11434`, avec un délai maximal de 2 secondes. Le frontend sélectionne uniquement le modèle exact du test. Sa taille déclarée en octets est conservée séparément et affichée en GiB, sans être additionnée à la RSS. `size_vram` est conservé dans l'export détaillé ; sur mémoire unifiée, il ne faut pas l'ajouter à `size`.

Le résultat conserve la dernière observation valide pendant le test. Une valeur absente reste inconnue. Cette taille déclarée ne constitue pas un pic d'allocation MLX ni une mesure de la mémoire du Moniteur d'activité. Les pics/moyennes RSS et le tas JS du navigateur portent des libellés distincts. Les anciens résultats n'ayant pas de source sont indiqués comme source inconnue.
