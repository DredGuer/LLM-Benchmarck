# Documentation technique — LLM Benchmarker v0.06

[Retour au guide de démarrage](README.md)

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


## Schéma communautaire et prochaines étapes

Voir [le contrat v2](schemas/README.md) : inventaire CPU/GPU/RAM/stockage, Apple Silicon, provenance des mesures, tâches agentiques et topologie multi-machine/Exo. Le contrat est accompagné d'exemples synthétiques et de tests. Les collecteurs et l'export courant restent inchangés (schéma v1.0.0) ; leur intégration suivra par étapes.
