# Runners locaux — application 0.14.0 / backend 1.4.0

La carte principale présente **Ollama, MLX LM et llama.cpp**. Les fournisseurs API restent dans **Fournisseurs distants**, repliable au clavier ; le nom du fournisseur sélectionné reste visible. LM Studio et l’endpoint personnalisé sont conservés dans **Autres connexions**, pour les installations/profils existants. Une API Ollama sur localhost peut toujours proxyfier le cloud : le classement du runner n’est pas une preuve d’inférence locale.

## Détection passive

Au lancement et avec **Vérifier les installations**, le backend observe des configurations usuelles sur sa propre machine :

| Runner | API inspectée | Recherche d’installation |
|---|---|---|
| Ollama | `127.0.0.1:11434/api/version` | App système, app utilisateur, app gérée ou commande `ollama` |
| llama.cpp | `127.0.0.1:8080/props` | Distribution gérée ou commande `llama-server` |
| MLX LM | `127.0.0.1:8081/v1/models` | Python géré ou module accessible depuis un Python usuel |

Un MLX déjà lancé sur son **port par défaut 8080** est reconnu seulement si le processus écoutant ce port correspond à `mlx_lm.server` (lsof/ps), puis si `/v1/models` répond. L’endpoint MLX de l’interface est alors adapté. Sinon, une réponse OpenAI compatible sur 8081 est signalée comme **moteur non confirmé**. Un service protégé, un port personnalisé ou un environnement Python non retrouvé ne devient pas automatiquement « absent ». Les états distinguent installation retrouvée, API non joignable, chargement, autre service et API détectée.

Aucun balayage réseau, installation, démarrage ou téléchargement de modèle au simple lancement de la page. Pas de changement automatique de runner. L’identification porte sur le protocole et, pour les processus gérés, sur le lancement effectué ; elle ne certifie pas le placement CPU/GPU ou toutes les capacités d’un modèle.

## Installer depuis la page

Les installations intégrées sont un **pilote Apple Silicon**, dans `~/Library/Application Support/LLM Benchmarker/runners`. Node/npm et le serveur de la page restent les prérequis du benchmark : cette fonction n’est pas un installateur complet de l’application.

1. Sélectionner le runner non retrouvé ; cliquer sur **Préparer l’installation**.
2. Lire source, version, destination et portée. Le plan expire après dix minutes.
3. Cocher l’accord de téléchargement/installation de logiciel tiers, puis **Installer ce runner**.
4. Suivre les phases, puis utiliser **Démarrer le service local**. Installation et API prête sont deux états distincts.

L’installation existante n’est jamais remplacée. Aucun sudo, script `curl | sh`, changement de PATH ou suppression de runner existant. Un dossier géré déjà présent bloque une réinstallation ; inspecter son contenu avant intervention manuelle. L’espace libre est revérifié : au moins 4 GiB pour préparer l’installation du logiciel, **sans compter les poids du futur modèle**.

| Recette | Source et vérification | Prérequis |
|---|---|---|
| Ollama | ZIP officiel actuel, extraction contrôlée, `codesign --verify --deep --strict` et évaluation Gatekeeper `spctl` avant déplacement | Python ≥ 3.9 ; les contrôles/signatures/OS doivent accepter le bundle |
| llama.cpp | Archive officielle macOS arm64 **b11429**, SHA-256 enregistré, extraction contrôlée et exécution `--version` | Python ≥ 3.9 ; dépendances du binaire disponibles |
| MLX LM | Version récupérée dans les métadonnées PyPI lors de la préparation ; installation exacte `mlx-lm==version` dans un venv, index PyPI fixe et **wheels uniquement** | Python natif arm64 ≥ 3.10, venv/pip fonctionnels et wheels compatibles |

Les versions des dépendances transitives MLX ne sont pas toutes figées par un lockfile. L’archive Ollama est actuelle et signée, pas épinglée par digest. llama.cpp est épinglé par digest, ce qui contrôle l’intégrité de l’asset, pas une notarisation Apple. Les recettes ne garantissent pas une installation sur tous les Mac et ne désactivent pas Gatekeeper. Une signature, dépendance, architecture, version de Python ou permission manquante produit un échec visible. Les chemins gérés restent locaux, hors exports/profils.

Les archives sont extraites dans un dossier neuf : traversées, chemins absolus, liens sortants, entrées spéciales et doublons de fichiers rejetés ; seuls les liens internes sont conservés. Limites de taille et nettoyage du staging. Une seule opération d’installation/démarrage active par backend. Garder le backend ouvert pendant une installation ; interrompre le backend au milieu peut laisser des opérations ou fichiers partiels. Il n’y a pas de reprise d’installateur ni de bouton d’annulation de pip en cours.

## Démarrer et arrêter

Ollama démarre avec `serve` et `OLLAMA_HOST=127.0.0.1:11434`. MLX et llama.cpp demandent un **identifiant public Hugging Face `organisation/modèle`** ; llama.cpp accepte aussi `:quantification`. Pas d’URL, de commande ou de chemin arbitraire. Le bouton de démarrage autorise le téléchargement et le chargement de ce modèle depuis Hugging Face si nécessaire : choisir une variante compatible avec la RAM et vérifier son espace disque. Ce parcours HF n’utilise pas l’estimateur du catalogue Ollama et ne prédit pas ces coûts.

- MLX : `python -m mlx_lm.server`, écoute **127.0.0.1:8081**, sans `--trust-remote-code`. Origines navigateur autorisées : localhost/127.0.0.1 sur port 8001.
- llama.cpp : `llama-server -hf`, écoute **127.0.0.1:8080**, aucun outil système ou MCP activé par la recette ; les variables de lancement sont allowlistées, sans paramètres LLAMA/PYTHON hérités.
- Une API répondant déjà sur le port bloque un nouveau lancement : aucun service existant n’est tué.

Après deux minutes sans API prête, le chargement est signalé comme **non confirmé** ; le processus peut continuer. Réactualiser la détection ou arrêter le service géré. Les logs bruts du sous-processus ne sont pas affichés ; une erreur système présente la phase et un message générique, pas des chemins/variables potentiellement sensibles. Les modèles privés/gated nécessitant une authentification HF ne sont pas configurés par cette première interface.

**Arrêter le service géré** envoie SIGTERM uniquement à un enfant lancé par ce processus backend. Aucun arrêt d’une application ou d’un processus externe. Fermer l’onglet ne coupe pas le service ; arrêter normalement le backend demande aussi l’arrêt de ses serveurs gérés. Après un crash ou arrêt forcé, un processus orphelin peut rester : la détection le verra, mais le nouveau backend ne revendique pas sa gestion.

Les campagnes sont verrouillées pendant installation/démarrage pour éviter une modification des conditions dans le même onglet. Les autres applications/onglets ne sont pas synchronisés. MLX dispose d’un runner OpenAI compatible, avec génération **streamée**, TTFT observé, usage fournisseur quand disponible et appels d’outils natifs si le modèle/template les supporte. L’inventaire Apple décrit le client ; **la télémétrie RSS/MLX actuelle du benchmark reste spécifique à Ollama** et n’est pas réattribuée aux serveurs MLX/llama.cpp. Le contexte chargé/cache y reste inconnu lorsque le moteur ne le fournit pas. Les profils MLX conservent le runner et les réglages, sans installer/démarrer de logiciel à leur chargement.

## API et contrôles

Routes `/api/runners/session`, GET `/api/runners`, POST `/api/runners/plan`, `/install`, `/start`, `/stop` et GET `/api/runners/jobs/:id`. Connexion/Host/Origin locaux requis ; toutes les opérations et le suivi demandent le jeton Bearer du backend. Plans/recettes/arguments contrôlés côté serveur, URLs et exécutables calculés, aucun shell fourni par le client. Les réponses sont sans cache. Les plans/opérations/procédés observés restent en mémoire et ne sont pas exportés.

## Sources et validation

[Installation officielle Ollama](https://github.com/ollama/ollama/blob/main/scripts/install.sh) · [Release llama.cpp b11429](https://github.com/ggml-org/llama.cpp/releases/tag/b11429) · [Serveur llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) · [Serveur MLX LM](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/SERVER.md).

```bash
node backend/local-runners.test.cjs
node backend/runner-archive.test.cjs
node backend/local-runners-ui.test.cjs
node backend/mlx-runner.test.cjs
```

Tests de fichiers/extraction réellement exécutés ; réseau, signatures, installations, processus, modèle et DOM simulés. Aucune installation réelle de runner macOS ni validation visuelle sur Mac dans cet environnement. À valider sur Apple Silicon : détection d’Ollama existant sans remplacement, installation sur un compte sans runner, signatures, démarrage/arrêt, chargement d’un petit modèle MLX/llama.cpp et campagne, préservation des profils/API cloud. Linux/Windows restent utilisables avec des serveurs existants ; leurs installateurs intégrés sont reportés.
