# Backend matériel et mémoire

[Guide de démarrage](README.md) · [Architecture](TECHNICAL_README.md)

Le backend Node.js fournit à l’interface des mesures Ollama et des informations sur la machine où il s’exécute. Il exécute également les outils restreints de la batterie agentique. Il écrit aussi les exports locaux demandés par les campagnes automatiques. Il ne sert pas la page HTML et n’exécute pas les modèles. La version `package.json` 1.5.0 est distincte de l’interface v0.17.0 et du protocole 0.09.

Le backend sauvegarde aussi campagnes et profils dans SQLite. Node ≥ 22.13.0 requis. [Guide SQLite, CRUD et migration](backend/DATABASE.md). Écoute réservée à 127.0.0.1.

## Lancement

Depuis la racine du dépôt :

```bash
npm install
npm start
```

Après une mise à jour, arrêter l’ancien backend avec `Ctrl+C`, puis `git pull origin main`, `npm install` et `npm start`. Garder le terminal ouvert. Dans un autre terminal, servir l’interface :

```bash
python3 -m http.server 8001 --bind 127.0.0.1
```

L’interface attend le backend sur `http://localhost:3001`. Le backend interroge l’API Ollama locale sur `127.0.0.1:11434` pour les modèles chargés.

Le port serveur peut être changé :

```bash
node server.js --port 4000
```

Ce changement n’adapte pas automatiquement les URLs utilisées par l’interface. Le parcours recommandé conserve 3001. Aucun paramètre `PORT` d’environnement n’est utilisé dans cette version.

## Endpoints

| Méthode | URL | Fonction |
|---|---|---|
| GET | `/` | Statut et liste indicative des endpoints historiques |
| GET | `/api/ping` | Disponibilité du backend, sans vérifier Ollama |
| GET | `/api/environment` | Environnement général ; inventaire structuré sur macOS |
| GET | `/api/hardware` | Inventaire Apple ; 501 sur les autres plateformes |
| GET | `/api/memory` | RSS cumulée des processus Ollama détectés et descendants |
| GET | `/api/ollama/status` | Présence d’Ollama |
| GET | `/api/ollama/pid` | PID détecté ; ne représente pas la totalité du modèle |
| GET | `/api/ollama/models` | Modèles chargés déclarés par Ollama `/api/ps` |
| POST | `/api/telemetry/start` | Début de session de télémétrie Apple ; 501 hors macOS |
| GET | `/api/telemetry/:id` | Échantillon et résumés de session |
| GET | `/api/telemetry/:id?finish=1` | Dernier échantillon, séries et fermeture de session |
| DELETE | `/api/telemetry/:id` | Abandon et nettoyage de session |

| GET | `/api/agentic/info` | Version, catalogue des six épreuves et budgets (en-tête local requis) |
| POST | `/api/agentic/start` | Nouveau dossier, cadre système, schémas et jeton ; corps `{scenario: id}` |
| POST | `/api/agentic/:id/tool` | Appel d’un outil natif déclaré, arguments JSON contrôlés |
| POST | `/api/agentic/:id/finish` | Vérification réelle, résultat et suppression du dossier |
| DELETE | `/api/agentic/:id` | Abandon et nettoyage |

Les routes agentiques exigent une connexion loopback, une origine locale si présente et `X-LLMB-Agentic: 1`. Les opérations sur une session demandent `Authorization: Bearer JETON_DE_SESSION`. Les jetons restent en mémoire pendant la tentative. Les protections ne s’appliquent pas rétroactivement aux anciennes routes. Voir [batterie et limites d’isolation](backend/AGENTIC_BENCHMARK.md).

```bash
curl -fsS -H 'X-LLMB-Agentic: 1' http://localhost:3001/api/agentic/info
```

La liste retournée par `/` n’est pas exhaustive ; ce tableau inclut les endpoints ajoutés depuis.

```bash
curl -fsS http://localhost:3001/api/ping
curl -fsS http://localhost:3001/api/environment
curl -fsS http://localhost:3001/api/hardware
curl -fsS http://localhost:3001/api/memory
curl -fsS http://localhost:3001/api/ollama/models
```

Les réponses de télémétrie peuvent être indisponibles (503) ou expirées (404). Une donnée manquante n’est pas remplacée par zéro.

## RSS, mémoire système et modèles chargés

`/api/memory` retourne notamment `process.memory` en octets, `process.memoryMB` historiquement nommé mais calculé en MiB, `source: process-tree-rss`, les PID et les détails de processus. Chaque PID est compté une fois ; des pages partagées peuvent néanmoins être comptées plusieurs fois.

Le processus serveur Ollama est distinct de ses runners enfants. Additionner leur RSS évite de mesurer seulement le parent, mais ne capture pas nécessairement les allocations Metal/MLX sur Apple Silicon. Ce n’est ni une empreinte physique exacte, ni une mesure de VRAM, ni la valeur du pic allocateur MLX.

Les champs système total/free/used concernent toute la machine ; une différence total moins mémoire libre ne doit pas être attribuée au modèle. La valeur `size` de `/api/ps` est une allocation déclarée qui peut évoluer avec les caches, pas la taille des seuls poids ni un pic échantillonné.

Voir [la télémétrie Apple](backend/APPLE_RESOURCES.md) pour les niveaux de swap/compression avant/après, les deltas disque et les événements MLX. Voir [l’inventaire Apple](backend/APPLE_INVENTORY.md) pour CPU, GPU et SSD.

## Plateformes et réseau

macOS utilise le collecteur Apple structuré. Windows/Linux conservent une détection générale dépendante des commandes et pilotes disponibles. Il n’y a pas de garantie de collecte exhaustive multi-GPU ni de preuve de placement des couches sur les GPU détectés.

Le serveur actuel utilise CORS ouvert et ne possède pas d’authentification. `app.listen(PORT)` ne limite pas explicitement l’écoute à la boucle locale. Les endpoints peuvent fournir des informations sur la machine : ce backend de développement doit rester dans un environnement maîtrisé. Ce constat décrit le code actuel ; il ne constitue pas une fonctionnalité de publication communautaire sécurisée.

Le backend ne reçoit ni ne relaie les clés de l’assistant IA. Les requêtes d’analyse partent directement du navigateur vers le fournisseur sélectionné, avec ses contraintes CORS.

## Diagnostic et vérifications

`Cannot find module 'express'` : exécuter `npm install`. `EADDRINUSE` : remplacer l’ancien processus plutôt que démarrer un deuxième backend sur le même port.

Sur Mac :

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
```

Les scripts de vérification et leur couverture figurent dans [CONTRIBUTING.md](CONTRIBUTING.md). Les sorties système sont simulées dans les tests automatisés ; une vérification sur une machine réelle reste nécessaire.

## Tests agentiques

```bash
node backend/agentic-harness.test.cjs
node backend/agentic-integration.test.cjs
```

Les opérations fichiers sont réellement exécutées en test ; les réponses des modèles sont simulées. La réussite sur modèles réels reste à vérifier.

## Batterie agentique 2.0

`backend/agentic-suite.js` contient six tâches versionnées, le cadre système, les outils restreints et les évaluateurs d’état. `POST /api/agentic/start` reçoit par exemple `{"scenario":"tool-selection"}` ; la session v2 possède son propre jeton et expire après quatre minutes. `finish` reçoit `finalAnswer` pour les contrôles de réponse et `reason` en cas d’interruption. Il retourne critères, objectif atteint, conformité, étapes et contenus locaux de fichiers avant nettoyage. L’interface exclut ces contenus des exports communautaires.

Le chemin fichiers v1 reste compatible pour les sessions démarrées sans scénario ; il n’est plus proposé par l’interface. Les sessions v1 et v2 sont routées vers leurs harness respectifs. Ne pas confondre la version de paquet backend 1.2.0 et le protocole agentique 2.0.1.

```bash
node backend/agentic-suite.test.cjs
node backend/agentic-stream.test.cjs
```

[Principes et sources de la méthodologie](backend/AGENTIC_METHODOLOGY.md). Les entrées sont synthétiques, les conversations utilisateur scriptées, le périmètre applicatif restreint ; aucun shell réseau ou Exo n’est ajouté.

## Provenance et MLX (application 0.09.0 / backend 1.2.0)

La batterie courante est 2.0.1 ; redémarrer Node après la mise à jour. Les journaux MLX ne fournissent pas de preuve d’attribution à un modèle. Chaque lecture indique `observedAt` (événement), `collectedAt` (collecte), âge, fraîcheur et chevauchement des sessions de télémétrie. Le pic utilise l’heure de l’événement maximal ; l’allocation conservée utilise celle du dernier événement. Les lignes antérieures au curseur/session, futures, incomplètes, ou provenant d’un fichier tourné ne deviennent pas des mesures fraîches valides. Les sessions externes non observées restent possibles.

## Exports locaux (application 0.10.0 / backend 1.2.0)

Le module `backend/local-exports.js` crée `export/` dans le dossier du projet, indépendamment du répertoire depuis lequel Node est lancé. Chaque modèle reçoit un sous-dossier basé sur son nom complet et un hash court ; fichiers JSON et Markdown datés, identifiés par campagne et position. Les exports ne remplacent pas ceux d’une campagne précédente. Les relances d’une même sauvegarde sont idempotentes si le contenu correspond exactement. Une réponse réussie n’est envoyée qu’après écriture et synchronisation des deux fichiers. Si le second échoue, une nouvelle tentative complète la paire ; le premier reste récupérable. Aucun nettoyage automatique n’efface ces fichiers.

| Endpoint | Fonction |
|---|---|
| `GET /api/exports/session` | Vérifier le dossier et obtenir le jeton de la session backend |
| `POST /api/exports/save` | Valider le JSON communautaire et écrire la paire JSON/Markdown |
| `POST /api/exports/open` | Ouvrir le dossier fixe dans le gestionnaire de fichiers |

Ces routes exigent une connexion de bouclage, un Host local et un Origin HTTP(S) local. Les mutations exigent en plus `X-LLMB-Export-Token`, aléatoire et renouvelé à chaque démarrage backend. Les pages externes et Origin `null` sont refusés ; servez la page avec Python plutôt que `file://`. Le jeton ne figure pas dans les rapports. Le corps des sauvegardes est limité à 50 MiB, chaque fichier à 24 MiB ; les limites existantes de télémétrie/outils restent inchangées. Les noms de chemins sont calculés côté serveur ; traversées, liens symboliques, conflits et remplacements sont refusés. Les JSON/bundles sont validés avec le validateur du projet avant écriture, et tous leurs tests doivent concerner le modèle demandé.

L’ouverture utilise `execFile` sans shell et un chemin fixe : `open` sur macOS, `explorer.exe` sur Windows, `xdg-open` sur Linux. Cela ouvre le dossier sur **la machine du backend**, qui doit donc être votre machine locale. L’ouverture native sur Windows/Linux reste à vérifier sur ces systèmes ; aucun test matériel réel n’est réalisé par les tests automatiques.

Le serveur Python sert le répertoire du projet et donc potentiellement les exports : utilisez `python3 -m http.server 8001 --bind 127.0.0.1` pour ce parcours local. `export/` est ignoré par Git, mais les Markdown peuvent contenir des données privées et ne sont pas chiffrés.

Validation : `node backend/local-exports.test.cjs` et `node backend/batch-campaign.test.cjs`. Après `git pull`, **redémarrer le backend**, puis recharger la page pour utiliser ces nouvelles routes.

## Interface Simple/Pro (0.15.0)

Le backend est en 1.5.0 ; les routes de campagne existantes restent compatibles. Simple lance les campagnes Ollama dans la même file à **un modèle** que Pro utilise pour plusieurs modèles : les routes `/api/exports/*` doivent donc être disponibles dès ce parcours simplifié. Pro affiche la sélection multi-modèles directement dans « Modèles à tester ». Le bouton de récupération reste dans la carte Campagne ; les exports manuels se trouvent dans « Autres exports ».

Les profils nommés sont enregistrés dans SQLite par le backend, hors dépôt et hors dossier `export/`. Ils peuvent inclure un prompt personnalisé ; ils n’incluent pas de clés API, de résultats ni d’informations matérielles.


## Ollama local ou proxy cloud (0.15.0)

Le backend mesure sa propre machine ; ces mesures ne décrivent pas le matériel Ollama cloud. L’interface ne démarre pas la télémétrie locale pour un modèle reconnu cloud, ne réclame pas de `/api/ps` correspondant et n’envoie pas de déchargement cloud. Les outils agentiques restent exécutés dans le sandbox du backend local, tandis que le modèle distant reçoit les messages et retours d’outils. Les exports conservent le client et un nœud d’inférence distant inconnu. Les routes de génération cloud restent inchangées. [Détails et dépannage](backend/OLLAMA_CLOUD.md).

## Catalogue de modèles (application 0.15.0 / backend 1.5.0)

Le bouton **Trouver des modèles pour ma machine** utilise les routes `/api/models/advisor*` : session, analyse GET, création POST d’une file de téléchargement, suivi et annulation. Elles exigent une origine locale et le suivi/mutations un jeton de session ; elles sont documentées dans [MODEL_ADVISOR.md](backend/MODEL_ADVISOR.md).

La première version estime uniquement Apple Silicon, un modèle texte à la fois, sans offload prévu. Elle utilise `os.totalmem/freemem` et `fs.statfs` sur `OLLAMA_MODELS` du backend ou `~/.ollama/models`. Le chemin présumé doit être confirmé : le backend ne lit pas l’environnement d’une application Ollama séparée. Le registre officiel fournit le manifeste actualisé, puis `/api/pull` sur `127.0.0.1:11434` installe les variantes explicitement sélectionnées. Aucun téléchargement n’est déclenché par l’analyse et aucune suppression de modèle n’est effectuée.

Diagnostic, depuis le terminal local :

```bash
curl -fsS -H 'Origin: http://localhost:8001' 'http://localhost:3001/api/models/advisor?context=4096'
node backend/model-advisor.test.cjs
node backend/model-advisor-ui.test.cjs
```

Le répertoire et les capacités matériels sont présentés localement ; ces estimations ne sont pas des métriques exportées. Le téléchargement contacte Ollama et son registre. Le service reste distinct des routes de génération, du sandbox agentique et de l’export communautaire.

## Installation des runners (application 0.15.0 / backend 1.5.0)

`backend/local-runners.js` expose `/api/runners*` pour une détection passive et des plans/installations/démarrages explicites. Le pilote installe Ollama, llama.cpp et MLX LM dans l’espace utilisateur sur Apple Silicon ; il utilise des recettes fixes, sans sudo, shell client ou écrasement d’une installation existante. L’extracteur Python contrôlé vérifie chemins et liens d’archives. Origine locale et jeton requis pour agir ; file unique et processus lancés identifiés en mémoire.

[Guide complet](backend/LOCAL_RUNNERS.md). Les serveurs existants Windows/Linux restent détectables aux ports usuels, mais aucun installateur n’y est lancé. Le backend démarre seulement les services demandés ; les poids HF demandent un choix explicite supplémentaire et ne sont pas estimés par le catalogue Ollama. Les télémétries Ollama existantes restent inchangées.
