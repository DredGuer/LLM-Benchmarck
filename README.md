# LLM Benchmarker Local 🚀

> **Version 0.03** - Benchmark de modèles LLM locaux et externes directement depuis le navigateur
>
> **Nouveautés** : Support Gemini ✨ | Monitoring RAM Ollama 💾 | Backend optionnel

> **✅ Toutes les fonctionnalités validées** - Sélection des prompts, benchmark, export, historique, monitoring RAM

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Status: Alpha](https://img.shields.io/badge/Status-Alpha-orange.svg)]
[![Browser: Chrome/Firefox/Safari](https://img.shields.io/badge/Browser-Chrome%20%7C%20Firefox%20%7C%20Safari-blue.svg)]

---

## 📖 Sommaire

- [🎯 Fonctionnalités](#-fonctionnalités)
- [📦 Prérequis](#-prérequis)
- [🚀 Installation et Utilisation](#-installation-et-utilisation)
- [💾 Monitoring RAM (Nouveau!)](#-monitoring-ram-nouveau)
- [🏗️ Architecture](#-architecture)
- [🔧 Configuration](#-configuration)
- [📊 Fonctionnement](#-fonctionnement)
- [📝 Export des résultats](#-export-des-résultats)
- [💾 Stockage](#-stockage)
- [📜 Licence](#-licence)
- [🤝 Contribuer](#-contribuer)
- [⚠️ Limitations connues](#️-limitations-connues)

---

## 🎯 Fonctionnalités

### Runners locaux supportés

| Runner | Endpoint | Protocole | Monitoring RAM |
|--------|----------|-----------|----------------|
| 🦙 **Ollama** | `http://localhost:11434` | OpenAI-compatible | ✅ **Oui** (via backend) |
| 🏠 **LM Studio** | `http://localhost:1234` | OpenAI-compatible | ❌ Non |
| 🦔 **llama.cpp** | `http://localhost:8080` | OpenAI-compatible | ❌ Non |

### APIs externes

| Fournisseur | Endpoint | Nécessite clé API | Monitoring RAM |
|-------------|----------|------------------|----------------|
| 🤖 **OpenAI** | `https://api.openai.com` | ✅ Oui | ❌ Non |
| 🌊 **Mistral AI** | `https://api.mistral.ai` | ✅ Oui | ❌ Non |
| 🔮 **Anthropic Claude** | `https://api.anthropic.com` | ✅ Oui | ❌ Non |
| 💎 **Google Gemini** | `https://generativelanguage.googleapis.com` | ✅ Oui | ❌ Non |
| ⚙️ **Personnalisé** | Configurable | ❌ Non | ❌ Non |

### Types de prompts

- 💬 **Conversation** - Dialogue libre et réponses générales
- 🏛️ **Datation / Factuel** - Questions de culture générale datées
- 🔢 **Mathématiques** - Résolution de problèmes mathématiques
- 💻 **Code** - Génération ou analyse de code
- 🧠 **Logique** - Résolution de problèmes logiques et raisonnement
- 🎨 **Créatif** - Rédaction créative et brainstorming
- ✏️ **Personnalisé** - Votre propre question ou instruction

### Métriques collectées

| Métrique | Description | Disponible |
|----------|-------------|-----------|
| Tokens générés | Nombre total de tokens produits | ✅ Tous |
| Tokens/seconde | Vitesse de génération | ✅ Tous |
| TTFT (Time To First Token) | Temps avant le premier token | ✅ Ollama (streaming) |
| Temps total | Durée complète de la réponse | ✅ Tous |
| Température | Paramètre de créativité utilisé | ✅ Tous |
| **RAM pic** | Consommation mémoire maximale | ✅ Ollama (avec backend) |
| **RAM moyenne** | Consommation mémoire moyenne | ✅ Ollama (avec backend) |

### Fonctionnalités de debugging

- **Streaming en temps réel** : Visualisation de la réponse token par token pour Ollama
- **Logs de débogage** : Suivi détaillé de chaque test avec horodatage
- **Compteur de tokens** : Suivi en direct du nombre de tokens reçus
- **Barre de progression** : Visualisation du % de tokens reçus vs max
- **Arrêt/Interrompre** : Contrôle manuel pendant le benchmark
- **Monitoring RAM** : Surveillance en temps réel de la consommation mémoire

---

## 💾 Monitoring RAM (Nouveau!)

> **Fonctionne uniquement avec Ollama** (runners locaux) et nécessite le backend Node.js

### 🎯 Deux méthodes de monitoring

#### Méthode 1 : Backend Node.js (Recommandé - Précis)

Le backend surveille directement le **processus Ollama** pour obtenir la consommation RAM réelle.

**Installation** :
```bash
cd LLM-Benchmarck
npm install
node server.js
```

Le backend se lance sur `http://localhost:3001` et est **auto-détecté** par le frontend.

**Endpoints API** :
- `GET /api/memory` - Mémoire du processus Ollama
- `GET /api/ollama/status` - Ollama est-il en cours d'exécution ?
- `GET /api/ollama/pid` - PID du processus Ollama

**Pour changer de port** :
```bash
node server.js --port 4000
```

Voir [BACKEND_README.md](BACKEND_README.md) pour la documentation complète.

#### Méthode 2 : API Navigateur (Chrome uniquement)

Utilise `performance.memory` pour mesurer la mémoire du navigateur.

**Requirement** : Lancer Chrome avec le flag `--enable-precision-memory-info`

```bash
# macOS
open -a "Google Chrome" --args --enable-precision-memory-info

# Windows
chrome.exe --enable-precision-memory-info

# Linux
google-chrome --enable-precision-memory-info
```

⚠️ **Limitation** : Mesure la mémoire du **navigateur**, pas du processus Ollama (moins précis).

#### Méthode 3 : Manuelle

Si aucune méthode n'est disponible, vous pouvez surveiller manuellement :
- **macOS** : Activity Monitor → cherchez `ollama`
- **Linux** : `htop` → filtrez par `ollama`
- **Windows** : Task Manager → onglet Details

### 📊 Affichage des métriques RAM

Lorsqu'actif, la RAM est affichée :
- **Dans les cartes de résultats** : Badge 💾 avec RAM pic + métrique RAM moyenne
- **Dans l'export Markdown** : Colonnes "RAM pic" et "RAM moy" dans le tableau

Exemple :
```
┌─────────────────────────────────────────────┐
│ 🦙 qwen3.6:27b │ Ollama │ 💬 Conversation │ 💾 2456 MB │
├─────────────────────────────────────────────┤
│ ... │ RAM pic: 2456 MB │ RAM moyenne: 1892 MB │
└─────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

### Structure des fichiers

```
LLM-Benchmarck/
├── llm-benchmarker.html          # Page HTML principale
├── css/
│   └── styles.css                # Tous les styles CSS
├── js/
│   ├── config/
│   │   ├── runners.json           # Configuration des runners
│   │   └── prompts.json           # Configuration des prompts
│   ├── core/
│   │   ├── state.js              # État global de l'application
│   │   ├── storage.js            # Utilitaires localStorage
│   │   ├── environment.js        # Détection matérielle
│   │   ├── runners.js            # Gestion des runners
│   │   ├── prompts.js            # Gestion des prompts
│   │   ├── streaming.js          # Streaming et output live
│   │   ├── benchmark.js          # Moteur de benchmarking
│   │   ├── apiKeys.js            # Gestion des clés API
│   │   ├── connectivity.js       # Tests de connectivité
│   │   ├── history.js            # Gestion de l'historique
│   │   └── memory.js             # Monitoring RAM ✨ NOUVEAU
│   ├── ui/
│   │   ├── toast.js              # Notifications toast
│   │   ├── modals.js             # Gestion des modales
│   │   ├── tabs.js               # Gestion des onglets
│   │   └── results.js            # Affichage et export des résultats
│   ├── utils/
│   │   └── helpers.js            # Fonctions utilitaires
│   └── main.js                   # Initialisation
├── server.js                     # Backend de monitoring RAM ✨ NOUVEAU
├── package.json                  # Dépendances Node.js ✨ NOUVEAU
├── BACKEND_README.md             # Documentation backend ✨ NOUVEAU
├── README.md                     # Ce fichier
└── LICENSE                       # Licence Apache 2.0
```

### Approche modulaire

Le code est organisé en modules thématiques partageant un espace de noms global :

- **Core** : Logique métier (benchmark, streaming, configuration, memory)
- **UI** : Composants d'interface (toasts, modales, onglets, résultats)
- **Utils** : Fonctions utilitaires réutilisables
- **Config** : Données de configuration statiques

Tous les modules sont chargés de manière séquentielle dans le HTML, garantissant que les dépendances sont disponibles au bon moment.

---

## 📦 Prérequis

### Pour les runners locaux

- **Ollama** : Installé et lancé avec `ollama serve`
  ```bash
  # Installation (macOS/Linux)
  curl -fsSL https://ollama.com/install.sh | sh
  
  # Lancer le serveur
  ollama serve
  
  # Vérifier l'installation
  ollama list
  ```

- **LM Studio** : Application lancée (port 1234 par défaut)
- **llama.cpp** : Serveur lancé avec `--server` (port 8080 par défaut)

### Pour les APIs externes

- Compte et clé API pour chaque fournisseur (OpenAI, Mistral, Claude, **Gemini**)
- Connexion internet

### Pour le monitoring RAM (optionnel)

- **Node.js v14+** (recommandé: v18+)
- **npm** ou **yarn**

---

## 🚀 Installation et Utilisation

### 1️⃣ Téléchargement

Clônez ce dépôt ou téléchargez les fichiers nécessaires :

```bash
# Clone du dépôt complet
git clone <url-du-depot>
cd llm-benchmarker

# Ou téléchargez l'archive complète
wget https://github.com/<user>/<repo>/archive/refs/heads/main.zip
unzip main.zip
```

**⚠️ Important** : Tous les fichiers sont nécessaires (HTML, CSS, JS, JSON). Ne téléchargez pas seulement `llm-benchmarker.html` seul.

### 2️⃣ Installation du backend RAM (optionnel mais recommandé)

```bash
cd /Applications/MAMP/htdocs/platforme-bench-LLM
npm install
node server.js
```

Le backend se lance sur `http://localhost:3001`. Le frontend le détecte automatiquement.

### 3️⃣ Lancer un serveur web local

⚠️ **Important** : Pour contourner les restrictions CORS du navigateur, vous **devez** servir le fichier via un serveur web local.

#### Avec Python 3 (recommandé)

```bash
cd /Applications/MAMP/htdocs/platforme-bench-LLM
python3 -m http.server 8000
# Ouvrez : http://localhost:8000/llm-benchmarker.html
```

#### Avec PHP

```bash
cd /Applications/MAMP/htdocs/platforme-bench-LLM
php -S localhost:8000
# Ouvrez : http://localhost:8000/llm-benchmarker.html
```

#### Avec MAMP

Placez le fichier dans `/Applications/MAMP/htdocs/` et accédez à :
```
http://localhost:8888/llm-benchmarker.html
```

#### Avec Node.js (npx)

```bash
cd /Applications/MAMP/htdocs/platforme-bench-LLM
npx serve
# Ouvrez : http://localhost:3000/llm-benchmarker.html
```

### 4️⃣ Utilisation

1. **Sélectionnez un runner** (Ollama, LM Studio, **Gemini**, etc.)
2. **Choisissez un modèle** (la liste se remplit automatiquement pour les runners locaux)
3. **Sélectionnez un ou plusieurs types de prompts** à tester (cliquez pour cocher/décocher)
   - 💬 Conversation, 🏛️ Datation/Factuel, 🔢 Mathématiques, 💻 Code, 🧠 Logique, 🎨 Créatif, ✏️ Personnalisé
4. **Configurez les options** (température, tokens max, répétitions)
5. **Cliquez sur "⚡ Lancer le benchmark"**
6. **Suivez le streaming** en temps réel dans l'onglet "Thinking en direct"
7. **Consultez les résultats** dans l'onglet 📊 Résultats (avec **RAM pic et RAM moyenne** pour Ollama)
8. **Exportez en Markdown** avec le bouton 📄 Exporter .md

---

## 🔧 Configuration

### Configuration des clés API

1. Cliquez sur le bouton **"🔑 Clés API"** dans la barre d'outils
2. Saisissez vos clés API pour chaque fournisseur (**Gemini** inclus)
3. Sauvegardez

Les clés sont stockées localement dans votre navigateur (`localStorage`) et **ne sont jamais transmises à des tiers**.

**Nouveau : Clé API Gemini**
- Format : `AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Obtenez-la sur : https://aistudio.google.com/app/apikey

### Runner personnalisé

Pour utiliser un runner personnalisé :

1. Sélectionnez **⚙️ Personnalisé**
2. Entrez l'URL de base de votre API (ex: `http://localhost:8080`)
3. Entrez le nom du modèle
4. Lancez le benchmark

### Options avancées

| Option | Description | Valeur par défaut |
|--------|-------------|------------------|
| Température | Contrôle la créativité (0 = déterministe, 2 = très créatif) | 0.7 |
| Tokens max | Nombre maximum de tokens à générer | 512 |
| Répétitions | Nombre de fois à exécuter chaque test | 1 |

### Configuration du backend RAM

Pour changer le port du backend :

**Dans server.js** :
```javascript
const PORT = 4000; // Changez ici
```

**Ou en ligne de commande** :
```bash
node server.js --port 4000
```

**Dans le frontend** (`js/core/memory.js`) :
```javascript
window.MEMORY_MONITOR_CONFIG = {
  backendUrl: 'http://localhost:4000', // Changez le port
  pollInterval: 500,
  timeout: 2000
};
```

---

## 📊 Fonctionnement

### Détection automatique de l'environnement

L'outil détecte automatiquement :
- Système d'exploitation (Windows, macOS, Linux)
- Navigateur (Chrome, Firefox, Safari, Edge)
- Nombre de cœurs CPU
- Mémoire RAM disponible
- GPU (via WebGL)

### Processus de benchmark

1. **Initialisation** : Connexion au runner sélectionné
2. **Exécution** : Envoi du prompt et réception de la réponse
3. **Mesure** : Calcul des métriques (tokens, vitesse, temps, **RAM**)
4. **Affichage** : Résultats présentés sous forme de cartes
5. **Stockage** : Sauvegarde dans l'historique

### Streaming

Pour **Ollama**, le benchmark utilise le streaming pour mesurer précisément :
- Le temps jusqu'au premier token (TTFT)
- La vitesse de génération en temps réel
- **La consommation RAM en temps réel** (si backend activé)

Pour les autres runners (LM Studio, llama.cpp, APIs externes), une requête non-streaming est utilisée.

---

## 📝 Export des résultats

### Format du rapport Markdown

Le rapport généré contient :

1. **En-tête** : Date, version de l'outil
2. **Environnement** : Configuration matérielle et logicielle
3. **Résumé** : Tableau récapitulatif de tous les tests (**avec colonnes RAM pic et RAM moyenne**)
4. **Détails** : Pour chaque test, métriques, prompt utilisé et réponse complète

Exemple de structure :

```markdown
# 📊 Rapport de Benchmark LLM

> Généré le 15 janvier 2025 à 14:30 par **LLM Benchmarker v0.03**

---

## 💻 Environnement de test

| Paramètre | Valeur |
|-----------|--------|
| Système d'exploitation | macOS |
| Navigateur | Chrome |
| Cœurs CPU | 8 vCPU |
| RAM (approx.) | 16 GB |

## 📈 Résumé des tests

| # | Modèle | Runner | Type | Tokens | Tok/s | TTFT | Temps total | RAM pic | RAM moy | Statut |
|---|--------|--------|------|--------|-------|------|-------------|---------|---------|--------|
| 1 | qwen3.6:27b | Ollama | 💬 Conversation | 1542 | 45.2 | 234ms | 8.50s | 2456 MB | 1892 MB | ✅ OK |
| 2 | gemini-1.5-pro | Gemini | 🏛️ Factuel | 89 | 12.4 | N/A | 7.20s | N/A | N/A | ✅ OK |

## 🔍 Détail des tests

### Test 1 — 💬 Conversation
**Modèle :** `qwen3.6:27b` | **Runner :** Ollama | **Date :** 15/01/2025, 14:30:00

#### Métriques
| Métrique | Valeur |
|----------|--------|
| Tokens générés | 1542 |
| Tokens / seconde | 45.2 |
| Temps 1er token (TTFT) | 234 ms |
| Temps total | 8.50 s |
| Température | 0.7 |
| Tokens max | 2000 |
| RAM pic | 2456 MB | ✨ NOUVEAU
| RAM moyenne | 1892 MB | ✨ NOUVEAU

#### Prompt
Bonjour ! Présente-toi brièvement...

#### Réponse
Je suis un modèle de langage...

---

*Rapport généré automatiquement par LLM Benchmarker v0.03*
```

---

## 💾 Stockage

### localStorage

Toutes les données sont stockées localement dans le navigateur :

- **Résultats actuels** : Stockés dans la variable `state.results` (session)
- **Historique** : Stocké dans `localStorage` sous la clé `llm_bench_history` (jusqu'à 50 sessions)
- **Clés API** : Stockées dans `localStorage` sous la clé `llm_bench_keys`
- **Configuration RAM** : Backend non stocké (exécuté localement)

### Sécurité

✅ **Aucune donnée ne quitte votre machine**
- Les clés API ne sont jamais envoyées à des serveurs tiers
- Les résultats restent dans votre navigateur
- Aucune connexion internet requise pour les runners locaux
- **Le backend RAM tourne localement** et ne transmet aucune donnée

---

## 📜 Licence

**Apache License 2.0**

Ce projet est distribué sous la licence [Apache License, Version 2.0](LICENSE).

© 2025 LLM Benchmarker

Voir le fichier [LICENSE](LICENSE) pour le texte complet de la licence.

---

### Résumé de la licence Apache 2.0

✅ **Autorisé** :
- Utilisation commerciale
- Modification
- Distribution
- Utilisation dans des projets fermés

❌ **Interdit** :
- Utilisation des marques commerciales sans autorisation
- Retirer les mentions de copyright

⚖️ **Obligations** :
- Inclure une copie de la licence
- Conserver les notices de copyright
- Indiquer les modifications apportées

---

## 🤝 Contribuer

Les contributions sont les bienvenues !

### Comment contribuer

1. **Forker** le dépôt
2. **Créer une branche** (`git checkout -b feature/amazing-feature`)
3. **Commiter** vos changements (`git commit -m 'feat: add amazing feature'`)
4. **Pousser** vers la branche (`git push origin feature/amazing-feature`)
5. **Ouvrir une Pull Request**

### Conventions de code

- **Commits** : Utilisez des messages clairs (`feat:`, `fix:`, `refactor:`, `docs:`)
- **Architecture** : Respectez la séparation en modules (core, ui, utils, config)
- **Noms de fichiers** : Utilisez le kebab-case (`my-module.js`)
- **Commentaires** : Documentez les fonctions et sections complexes

### Suggestions d'améliorations

- [ ] Support de plus de runners locaux (VLLM, Kobold, etc.)
- [ ] Benchmark comparatif entre plusieurs modèles
- [ ] Graphiques de visualisation des résultats (Chart.js, etc.)
- [ ] Export en JSON/CSV
- [ ] Tests automatisés (Jest, Cypress)
- [ ] Interface en anglais
- [ ] Thème sombre/clair
- [ ] Migration vers ES6 modules
- [ ] Intégration avec Prometheus/Grafana pour le monitoring

---

## ⚠️ Limitations connues

### Version v0.03

- **CORS** : Nécessite un serveur web local pour fonctionner (pas de `file://`)
- **Streaming** : Seule Ollama supporte le streaming pour la mesure du TTFT
- **Modèles lourds** : Peut être lent avec des modèles > 30B paramètres
- **APIs externes** : Nécessite une clé API valide
- **Browser support** : Testé sur Chrome, Firefox, Safari (Edge partiel)
- **Monitoring RAM** : Uniquement disponible pour Ollama avec le backend Node.js

### Problèmes connus

| Problème | Solution |
|----------|----------|
| Liste des modèles vide | Vérifiez que le runner est lancé et accessible |
| Erreur CORS | Servez le fichier via un serveur web local |
| Timeout | Augmentez le timeout ou utilisez un modèle plus léger |
| Clé API invalide | Vérifiez votre clé dans les paramètres |
| RAM non affichée | Lancez `node server.js` ou utilisez Chrome avec `--enable-precision-memory-info` |
| Backend non détecté | Vérifiez que le backend tourne sur `localhost:3001` |

### Dépannage du monitoring RAM

**Backend non détecté** :
```bash
# Vérifiez que le backend est lancé
curl http://localhost:3001/

# Vérifiez qu'Ollama est lancé
ps aux | grep ollama
# ou
ollama list
```

**performance.memory non disponible** :
- Utilisez Chrome avec le flag `--enable-precision-memory-info`
- Ou lancez le backend Node.js pour un monitoring précis

---

## 📞 Support

Pour toute question ou problème :

1. Vérifiez la section [Limitations connues](#️-limitations-connues)
2. Consultez les logs du navigateur (F12 → Console)
3. Assurez-vous que votre runner local est bien lancé
4. Pour le monitoring RAM, vérifiez que le backend est en cours d'exécution

---

## 🏆 Remerciements

- [Ollama](https://ollama.com) - Pour les modèles locaux
- [LM Studio](https://lmstudio.ai) - Pour l'interface utilisateur
- [llama.cpp](https://github.com/ggerganov/llama.cpp) - Pour l'inference efficace
- [OpenAI](https://openai.com) - Pour les APIs de référence
- [Mistral AI](https://mistral.ai) - Pour les modèles ouverts
- [Anthropic](https://anthropic.com) - Pour Claude
- [Google](https://ai.google.com) - Pour **Gemini** ✨

---

<div align="center">
  <p>
    <strong>LLM Benchmarker v0.03</strong> - Développé avec ❤️ pour la communauté LLM
  </p>
</div>
