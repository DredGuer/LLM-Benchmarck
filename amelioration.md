# 📋 Plan d'Amélioration - LLM Benchmarker

*Version : 1.0*  
*Date : 20 Mai 2025*  
*Objectif : Refactorisation modulaire pour une meilleure maintenabilité*

---

## 🎯 **Objectifs Principaux**

1. **Séparer les préoccupations** (Separation of Concerns)
2. **Améliorer la maintenabilité** du code
3. **Faciliter les contributions** (collaboration, open-source)
4. **Préparer l'évolutivité** pour de nouvelles fonctionnalités
5. **Optimiser les performances** (chargement parallèle, cache)

---

## 📁 **Architecture Cible**

```
LLM-Benchmarck/
├── index.html                      # HTML statique minimal
├── css/
│   └── styles.css                 # Tous les styles CSS
│
├── js/
│   ├── main.js                    # Point d'entrée principal
│   ├── config/
│   │   ├── runners.json           # Configuration des runners
│   │   └── prompts.json           # Configuration des prompts
│   │
│   ├── core/
│   │   ├── benchmark.js           # Logique de benchmarking
│   │   ├── environment.js         # Détection & config matérielle
│   │   ├── streaming.js           # Gestion du streaming
│   │   └── storage.js             # Gestion localStorage
│   │
│   ├── ui/
│   │   ├── modals.js              # Gestion des modales
│   │   ├── results.js             # Affichage des résultats
│   │   ├── history.js             # Gestion de l'historique
│   │   └── toast.js               # Notifications
│   │
│   └── utils/
│       ├── helpers.js             # Fonctions utilitaires
│       └── fetchUtils.js          # Utilitaires de fetch
│
├── amelioration.md                # Ce fichier
├── README.md
├── LICENSE
└── NOTICE
```

---

## 📌 **Phases de Refactorisation**

---

### **✅ Phase 0 : Préparation** *(Terminée)*
- [x] Commit de l'état actuel (`233a93c`)
- [x] Tout est poussé sur GitHub (main branch)
- [x] Working tree clean

**Point de retour :** `git reset --hard 233a93c`

---

### **🔄 Phase 1 : Extraction du CSS** *(~30 min)*

**Objectif :** Séparer tout le CSS dans un fichier externe.

#### Tâches :
1. Créer le dossier `css/`
2. Créer le fichier `css/styles.css`
3. Copier tout le contenu entre `<style>...</style>` dans `styles.css`
4. Dans `llm-benchmarker.html` :
   - Supprimer la balise `<style>...</style>`
   - Ajouter `<link rel="stylesheet" href="css/styles.css">` dans le `<head>`

#### Fichiers concernés :
- `css/styles.css` (nouveau)
- `llm-benchmarker.html` (modifié)

#### Validation :
- [ ] Le design est identique à l'original
- [ ] Toutes les couleurs et polices fonctionnent
- [ ] Les animations (spinner) fonctionnent
- [ ] Responsive design toujours OK

#### Commit :
```bash
git add css/styles.css llm-benchmarker.html
git commit -m "refactor: extract CSS into external styles.css file"
```

---

### **📦 Phase 2 : Extraction des Configurations JSON** *(~1h)*

**Objectif :** Sortir les données statiques dans des fichiers JSON.

#### Tâches :

##### A. Créer `js/config/runners.json`
```json
{
  "ollama": {
    "name": "Ollama",
    "base": "http://localhost:11434",
    "type": "local",
    "streaming": true,
    "endpoints": {
      "generate": "/api/generate",
      "tags": "/api/tags",
      "pull": "/api/pull",
      "delete": "/api/delete"
    }
  },
  "lmstudio": {
    "name": "LM Studio",
    "base": "http://localhost:1234",
    "type": "local",
    "streaming": false
  },
  "llamacpp": {
    "name": "llama.cpp",
    "base": "http://localhost:8080",
    "type": "local",
    "streaming": false
  },
  "openai": {
    "name": "OpenAI",
    "base": "https://api.openai.com",
    "type": "api"
  },
  "mistral": {
    "name": "Mistral AI",
    "base": "https://api.mistral.ai",
    "type": "api"
  },
  "claude": {
    "name": "Claude",
    "base": "https://api.anthropic.com",
    "type": "api"
  },
  "custom": {
    "name": "Personnalisé",
    "base": "",
    "type": "custom"
  }
}
```

##### B. Créer `js/config/prompts.json`
```json
{
  "promptTypes": [
    {
      "id": "conversation",
      "name": "Conversation",
      "emoji": "💬",
      "desc": "Dialogue libre et réponse générale",
      "prompt": "Bonjour ! Présente-toi brièvement et explique ce que tu peux faire pour m'aider au quotidien."
    },
    {
      "id": "factual",
      "name": "Datation / Factuel",
      "emoji": "🏛️",
      "desc": "Questions de culture générale datées",
      "prompt": "Quand la Tour Eiffel a-t-elle été construite ? Donne-moi les dates précises de construction et d'inauguration."
    },
    {
      "id": "math",
      "name": "Mathématiques",
      "emoji": "🔢",
      "desc": "Résolution de problèmes mathématiques",
      "prompt": "Résous ce problème étape par étape :\nUne voiture roule à 80 km/h. Combien de temps lui faudra-t-il pour parcourir 360 km ? Exprime le résultat en heures et minutes."
    },
    {
      "id": "code",
      "name": "Code",
      "emoji": "💻",
      "desc": "Génération ou analyse de code",
      "prompt": "Écris une fonction Python qui calcule le n-ième nombre de Fibonacci de manière récursive avec mémoïsation. Ajoute des docstrings et un exemple d'utilisation."
    },
    {
      "id": "creative",
      "name": "Créatif",
      "emoji": "🎨",
      "desc": "Rédaction créative et brainstorming",
      "prompt": "Écris un haïku sur l'intelligence artificielle, puis propose 5 idées originales d'applications pour améliorer le quotidien des développeurs."
    },
    {
      "id": "logic",
      "name": "Logique",
      "emoji": "🧠",
      "desc": "Résolution de problèmes logiques et raisonnement",
      "prompt": "Je dois aller laver ma voiture, mais je suis à 200 mètres de la station de lavage. Je me demande si je dois y aller à pied ou en voiture. Analyse la situation et donne-moi une réponse logique."
    },
    {
      "id": "custom",
      "name": "Prompt personnalisé",
      "emoji": "✏️",
      "desc": "Votre propre question ou instruction",
      "prompt": null
    }
  ]
}
```

##### C. Modifier `llm-benchmarker.html`
- Supprimer les définitions JS de `RUNNERS` et `PROMPT_TYPES`
- Ajouter avant `</body>` :
```html
<!-- Chargement des configurations JSON -->
<script src="js/config/runners.json" type="application/json" id="runnersConfig"></script>
<script src="js/config/prompts.json" type="application/json" id="promptsConfig"></script>
```

- Remplacer dans le JS :
```javascript
// Anciennement :
const RUNNERS = { ... };
const PROMPT_TYPES = [ ... ];

// Nouveau :
const RUNNERS = JSON.parse(document.getElementById('runnersConfig').textContent);
const PROMPT_TYPES = JSON.parse(document.getElementById('promptsConfig').textContent).promptTypes;
```

#### Fichiers concernés :
- `js/config/runners.json` (nouveau)
- `js/config/prompts.json` (nouveau)
- `llm-benchmarker.html` (modifié)

#### Validation :
- [ ] Les runners s'affichent correctement
- [ ] Les prompts sont disponibles dans l'UI
- [ ] Le benchmark fonctionne avec les nouveaux fichiers

#### Commit :
```bash
git add js/config/runners.json js/config/prompts.json llm-benchmarker.html
git commit -m "refactor: extract runners and prompts configurations to JSON files"
```

---

### **🗂️ Phase 3 : Refactorisation JavaScript** *(~2-3h)*

**Objectif :** Découper le JavaScript en modules thématiques.

#### A. Créer `js/main.js` (Point d'entrée)
```javascript
"use strict";

// Charger les configurations
const RUNNERS = JSON.parse(document.getElementById('runnersConfig').textContent);
const PROMPT_TYPES = JSON.parse(document.getElementById('promptsConfig').textContent).promptTypes;

// État global
const state = {
  runner: 'ollama',
  model: '',
  selectedPrompts: new Set(['conversation']),
  results: [],
  isRunning: false,
  env: {},
  apiKeys: {},
  customBase: ''
};

// Initialisation
 document.addEventListener('DOMContentLoaded', () => {
  detectEnvironment();
  renderPromptTypes();
  updateRunnerConfig();
  populateModelSelect();
  loadApiKeys();
  loadHistory();
  updateTime();
  setInterval(updateTime, 30000);
});
```

#### B. Créer `js/core/environment.js`
Fonctions à extraire :
- `detectFullHardware()`
- `detectEnvironment()`
- `loadHardwareConfig()`
- `saveHardwareConfig()`
- `resetHardwareConfig()`
- `updateEnvDisplayWithIndicators()`

Variables globales :
- `manualHardwareConfig`
- `HARDWARE_CONFIG_KEY`

#### C. Créer `js/core/benchmark.js`
Fonctions à extraire :
- `runBenchmark()`
- `executeTest()`
- `buildErrorResult()`
- `setProgress()`
- `showResultsArea()`

#### D. Créer `js/core/streaming.js`
Fonctions à extraire :
- Gestion de `currentAbortController`
- `stopCurrentTest()`
- `skipToNextTest()`
- `retryCurrentTest()`
- `showLiveSections()`
- `setControlButtons()`
- `resetLiveOutput()`

Variables globales :
- `currentAbortController`
- `currentTestState`
- `skipToNextFlag`
- `retryCurrentFlag`

#### E. Créer `js/ui/modals.js`
Fonctions à extraire :
- `openModal()`
- `closeModal()`
- `openHardwareConfigModal()`
- `saveHardwareConfig()` (déjà dans environment.js ?)
- `resetHardwareConfig()` (déjà dans environment.js ?)
- `saveApiKeys()`
- `loadApiKeys()`

#### F. Créer `js/ui/results.js`
Fonctions à extraire :
- `renderResultCard()`
- `exportMarkdown()`
- `saveSessionToHistory()`
- `loadHistory()`
- `restoreSession()`
- `clearHistory()`
- `clearAllResults()`

#### G. Créer `js/ui/toast.js`
Fonctions à extraire :
- `showToast()`

#### H. Créer `js/ui/tabs.js`
Fonctions à extraire :
- `switchTab()`

#### I. Créer `js/utils/storage.js`
Fonctions à extraire :
- `saveToLocalStorage()`
- `loadFromLocalStorage()`

#### J. Créer `js/utils/helpers.js`
Fonctions à extraire :
- `fetchWithTimeout()`
- `estimateTokens()`
- `escapeHtml()`
- `escapeHtmlForMarkdown()`
- `getSelectedModel()`
- `updateTime()`

#### K. Créer `js/utils/fetchUtils.js`
Fonctions à extraire :
- `fetchWithTimeout()` (peut aussi rester dans helpers.js)

#### Fichiers concernés :
- `js/main.js` (nouveau)
- `js/core/environment.js` (nouveau)
- `js/core/benchmark.js` (nouveau)
- `js/core/streaming.js` (nouveau)
- `js/ui/modals.js` (nouveau)
- `js/ui/results.js` (nouveau)
- `js/ui/toast.js` (nouveau)
- `js/ui/tabs.js` (nouveau)
- `js/utils/storage.js` (nouveau)
- `js/utils/helpers.js` (nouveau)
- `js/utils/fetchUtils.js` (nouveau)
- `llm-benchmarker.html` (suppression de tout le JS inline)

#### Validation :
- [ ] Toutes les fonctionnalités existent toujours
- [ ] Aucun bug d'intégration
- [ ] Les modales fonctionnent
- [ ] Le benchmark fonctionne
- [ ] L'export Markdown fonctionne
- [ ] L'historique fonctionne

#### Commit :
```bash
git add js/main.js js/core/ js/ui/ js/utils/ llm-benchmarker.html
git commit -m "refactor: split JavaScript into modular files"
```

---

### **🧹 Phase 4 : Nettoyage Final** *(~30 min)*

**Objectif :** Finaliser et optimiser la refactorisation.

#### Tâches :
1. Vérifier les dépendances entre modules
2. Corriger les bugs d'intégration
3. Supprimer le code mort
4. Vérifier la console pour les erreurs
5. Tester sur plusieurs navigateurs (Chrome, Firefox, Safari)
6. Vérifier que tout fonctionne sur mobile

#### Validation complète :
- [ ] Détection environnement OK
- [ ] Sélection runner OK
- [ ] Listing modèles OK
- [ ] Benchmark OK (tous types de prompts)
- [ ] Streaming OK (Ollama)
- [ ] Export Markdown OK
- [ ] Historique OK
- [ ] Configuration matérielle OK
- [ ] Modales OK

#### Commit :
```bash
git add .
git commit -m "refactor: cleanup and finalize modular architecture"
```

---

### **🔄 Phase 5 : Merge sur main** *(~5 min)*

1. `git checkout main`
2. `git merge refactor/modular-architecture`
3. Résoudre les conflits (si présents)
4. `git push origin main`

---

## ⏱️ **Estimation Temps**

| Phase | Durée | Complexité |
|-------|-------|------------|
| 0 - Préparation | 5 min | ⭐ |
| 1 - CSS | 30 min | ⭐⭐ |
| 2 - JSON | 1h | ⭐⭐ |
| 3 - JS Modules | 2-3h | ⭐⭐⭐⭐ |
| 4 - Nettoyage | 30 min | ⭐⭐ |
| 5 - Merge | 5 min | ⭐ |
| **Total** | **4-5h** | - |

---

## 🎯 **Avantages Attendus**

### ✅ **Maintenabilité**
- Chaque fichier a **une seule responsabilité**
- Plus facile à lire et comprendre
- Correction de bugs plus rapide

### ✅ **Collaboration**
- Plusieurs développeurs peuvent travailler en parallèle
- Moins de conflits de merge
- Code review plus simple

### ✅ **Évolutivité**
- Ajouter une feature = ajouter un fichier
- Moins de risque de casser le code existant
- Meilleure séparation des préoccupations

### ✅ **Performance**
- Chargement parallèle des ressources
- Cache navigateur plus efficace
- Code potentiellement plus optimisé

### ✅ **Testabilité**
- Modules isolés = tests unitaires faciles
- Mocking plus simple
- Intégration continue facilitée

---

## 🚨 **Risques et Solutions**

| Risque | Probabilité | Impact | Solution |
|--------|-------------|--------|----------|
| Bug d'intégration | Moyenne | Élevé | Tests systématiques à chaque phase |
| Incompatibilité navigateur | Faible | Moyen | Test sur Chrome, Firefox, Safari |
| Temps de développement | - | - | Phaser par étapes, commits fréquents |
| Perte de fonctionnalités | Faible | Élevé | Vérifier chaque fonctionnalité après chaque phase |

---

## 📝 **Checklist de Validation**

### Après chaque phase :
- [ ] Le projet se lance sans erreur console
- [ ] Le design est correct (CSS)
- [ ] Les runners s'affichent
- [ ] Les modèles se listent
- [ ] Le benchmark fonctionne
- [ ] Les résultats s'affichent
- [ ] L'export Markdown fonctionne
- [ ] L'historique fonctionne
- [ ] La config matérielle fonctionne

### Validation finale :
- [ ] Toutes les fonctionnalités originales fonctionnent
- [ ] Pas de régression
- [ ] Code plus lisible
- [ ] Structure de fichiers claire

---

## 🛠️ **Outils Recommandés**

1. **Éditeur** : VS Code avec extensions
   - ESLint
   - Prettier
   - JSON Tools
   - Live Server

2. **Test** : Navigateurs multiples
   - Chrome (devtools)
   - Firefox
   - Safari (pour Mac)

3. **Validation** :
   - `git status` fréquent
   - Commits atomiques (une feature = un commit)
   - Messages de commit clairs

---

## 🎓 **Bonnes Pratiques à Appliquer**

1. **Commits fréquents** : Après chaque tâche complète
2. **Messages de commit clairs** : `feat:`, `fix:`, `refactor:`
3. **Tests à chaque phase** : Ne pas attendre la fin
4. **Branche dédiée** : `refactor/modular-architecture`
5. **Revue de code** : Vérifier les changements avant commit

---

## 📞 **Support**

Si tu bloques sur une phase, tu peux :
1. Revenir au commit précédent : `git reset --hard HEAD~1`
2. Vérifier les logs : `git log --oneline`
3. Voir les différences : `git diff HEAD~1`
4. Me demander de l'aide sur une phase spécifique

---

## ✅ **Statut**

- [x] Phase 0 : Préparation (Commit `233a93c`)
- [x] Phase 1 : Extraction CSS (Commit `51820e9` - 20/05/2025)
- [x] Phase 2 : Extraction JSON (Commit `f6b2d91` - 20/05/2025)
- [x] Phase 3 : Déplacement JS vers main.js (Commit `99fb98a` - 20/05/2025)
- [x] Phase 3 : Refactorisation JS en modules (Commit `c9d088b` - 20/05/2025)
  - [x] Création des dossiers js/core/, js/ui/, js/utils/
  - [x] Extraction de js/config/load.js - Chargement des configurations
  - [x] Extraction de js/core/state.js - État global
  - [x] Extraction de js/utils/helpers.js - Fonctions utilitaires
  - [x] Extraction de js/ui/toast.js - Notifications toast
  - [x] Extraction de js/ui/modals.js - Gestion des modales
  - [x] Extraction de js/ui/tabs.js - Gestion des onglets
  - [x] Extraction de js/core/storage.js - Stockage localStorage
  - [x] Extraction de js/core/environment.js - Détection matérielle
  - [x] Extraction de js/core/runners.js - Gestion des runners
  - [x] Extraction de js/core/prompts.js - Types de prompts
  - [x] Extraction de js/core/streaming.js - Streaming et output live
  - [x] Extraction de js/core/benchmark.js - Moteur de benchmark
  - [x] Extraction de js/ui/results.js - Affichage et export des résultats
  - [x] Extraction de js/core/apiKeys.js - Gestion des clés API
  - [x] Extraction de js/core/connectivity.js - Tests de connectivité
  - [x] Extraction de js/core/history.js - Gestion de l'historique
  - [x] Mise à jour de llm-benchmarker.html - Chargement des modules
  - [x] Mise à jour de js/main.js - Initialisation
- [x] Phase 4 : Nettoyage et validation
  - [x] Mise à jour README.md avec architecture modulaire (Commit `cf2a668`)
  - [x] Mise à jour LICENSE et .gitignore (Commit `cf2a668`)
  - [x] Correction bug PROMPT_TYPES undefined (Commit `5a0343c`)
  - [x] Correction bug state non accessible (Commit `5a0343c`)
  - [x] **Correction sélecteur de prompts** (Commit `c8b07f1`)
    - Suppression de load.js
    - Définition directe des configs globales dans HTML
    - Simplification de prompts.js
  - [x] Push sur main avec toutes les corrections

**✅ Toutes les phases principales sont terminées !**

### Prochaines améliorations possibles
- Migration vers ES6 modules (import/export)
- Ajout de tests automatisés (Jest, Cypress)
- Implémentation d'un système de build (Webpack, Rollup)
- Ajout de graphiques pour la visualisation des résultats (Chart.js)
- Support de plus de runners locaux (VLLM, Kobold)
- Benchmark comparatif entre plusieurs modèles
- Interface multilingue

---

*Document généré par Mistral Vibe - 20 Mai 2025*
*Dernière mise à jour : 20 Mai 2025 - 19:15*
