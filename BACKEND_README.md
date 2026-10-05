# Backend matériel et mémoire

[Guide de démarrage](README.md) · [Architecture](TECHNICAL_README.md)

Le backend Node.js fournit à l’interface des mesures Ollama et des informations sur la machine où il s’exécute. Il exécute également les outils restreints de la batterie agentique. Il ne sert pas la page HTML et n’exécute pas les modèles. La version `package.json` 1.0.0 est distincte de l’interface v0.06 et du protocole 0.08.

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

Le chemin fichiers v1 reste compatible pour les sessions démarrées sans scénario ; il n’est plus proposé par l’interface. Les sessions v1 et v2 sont routées vers leurs harness respectifs. Ne pas confondre la version de paquet backend 1.0.0 et le protocole agentique 2.0.0.

```bash
node backend/agentic-suite.test.cjs
node backend/agentic-stream.test.cjs
```

[Principes et sources de la méthodologie](backend/AGENTIC_METHODOLOGY.md). Les entrées sont synthétiques, les conversations utilisateur scriptées, le périmètre applicatif restreint ; aucun shell réseau ou Exo n’est ajouté.
