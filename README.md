# LLM Benchmarker

Benchmarkez vos modèles locaux ou vos API, conservez les campagnes dans une base SQLite locale et comparez leurs performances sur votre machine.

**Interface v0.17.0 · protocole de mesure 0.09 · export communautaire 2.2.0 (anciens rapports 2.0.0/2.1.0 acceptés).** Documentation vérifiée le 7 octobre 2026. [Historique des versions et changements](CHANGELOG.md). Ces versions désignent des éléments différents ; la version 1.5.0 de `package.json` concerne le backend.

Fonctions actuelles : runners locaux en premier, détection passive et installation/démarrage intégrés sur Apple Silicon, catalogue Ollama avec estimation RAM/disque et téléchargement local séquentiel, interface Simple/Pro et profils nommés de campagne, campagnes automatiques multi-modèles Ollama avec exports locaux classés, chauffe séparée, contexte Auto, identification Dense/MoE lorsqu’elle est disponible, inventaire Apple Silicon, suivi RSS/swap/MLX, exports Markdown/JSON, statistiques interactives, batterie de capacités agentiques et assistant d’analyse au choix. Les bulles **!** expliquent les réglages et mesures au clic, au clavier ou sur mobile.

## Interface Simple, Pro et profils

Le sélecteur **Interface Simple / Interface Pro** est dans l’en-tête. Il s’agit de la même page, avec les réglages avancés masqués en Simple. Le choix d’interface est conservé dans le navigateur.

**Simple** est proposé au premier lancement : choisissez votre runner et **un seul modèle**, ajustez si nécessaire le plafond de sortie (8 192 tokens par défaut), puis lancez le benchmark. Tous les tests classiques sont présélectionnés, avec les cas de justesse disponibles pour Mathématiques, Logique et Code. Le contexte reste Auto, les températures sont celles prévues pour chaque catégorie et il y a **1 répétition**. Cocher **Ajouter les capacités agentiques** active les six épreuves sans autre sélection ; cette option est disponible pour les runners locaux compatibles. Les campagnes Ollama passent par la file automatique à un modèle : backend requis pour sauvegarder les exports et confirmer le déchargement des modèles locaux.

**Pro** affiche directement les **cases à cocher des modèles Ollama** dans « Modèles à tester », avec un compteur : sélectionnez un ou plusieurs modèles, puis le bouton de lancement exécute la file. Pour les autres fournisseurs, la sélection reste à un modèle. Pro expose les catégories, prompt personnalisé, température par type, répétitions, épreuves agentiques précises, justesse et deux contextes contrôlés. Passer de Pro à Simple préserve votre configuration Pro pendant la session ; revenir en Pro la restaure. Pour la conserver après fermeture ou rechargement, utilisez un profil.

Dans **Profils de campagne** (Pro) : faites vos réglages, donnez un nom, cliquez sur **Enregistrer un profil**. Plus tard, choisissez ce profil et cliquez sur **Charger**. **Mettre à jour** remplace les réglages du profil sélectionné ; **Supprimer** demande une confirmation. Charger un profil ne lance pas un test. Jusqu’à 40 profils peuvent être créés via l’interface ; ils sont sauvegardés dans SQLite sur la machine du backend.

Un profil conserve runner, modèle(s), catégories, prompt personnalisé et sa température, mode Auto/Manuel, plafond de sortie, répétitions, températures par type, épreuves agentiques, justesse, contextes et politique d’erreur. L’URL du runner personnalisé peut être conservée si elle ne contient aucun identifiant ou paramètre secret. Les clés API, résultats, inventaire matériel et jetons de session ne sont pas inclus. Les profils peuvent contenir le **prompt personnalisé en clair** : SQLite n’est pas une sauvegarde externe : utilisez la sauvegarde de la base dans Historique. Vider le navigateur ne supprime plus les profils migrés. Un modèle absent est signalé et bloque la file jusqu’à correction de la sélection ou disponibilité du modèle.

## Campagne automatique et exports par modèle

Après avoir lancé Ollama, le backend (`npm start`) et la page, passez en **Interface Pro**, puis utilisez **Modèles à tester** dans la colonne de gauche. Cochez un ou plusieurs modèles détectés, puis choisissez les catégories et, si souhaité, les capacités agentiques et la justesse. Les mêmes réglages sont conservés pendant toute la file. Le mode normal garde **1 répétition par défaut** ; augmentez ce nombre en mode Manuel pour mieux estimer la variabilité. Le mode contrôlé garde **3 répétitions × 2 contextes** par modèle.

Cliquez sur **Lancer N modèle(s)**, en bas des réglages. Pour chaque modèle : chargement/chauffe mesurée → catégories et épreuves → historique et exports → demande de déchargement Ollama → vérification de son absence dans `/api/ps` → modèle suivant. Pour les modèles cloud, la sauvegarde est suivie directement du modèle suivant : aucune RAM distante n’est gérée. La chauffe reste séparée des scores. Aucun modèle n’est lancé en parallèle et aucun processus n’est tué. L’absence dans `/api/ps` confirme le déchargement rapporté par Ollama, pas la restitution instantanée de toute la RAM système.

Le backend crée **`export/` à la racine du projet**, puis un sous-dossier par **nom complet de modèle** : Qwen, Gemma et leurs différentes variantes restent séparés. Un suffixe stable évite les collisions entre noms contenant `:`, `/`, etc. Chaque passage dans la file crée un **JSON communautaire v2** et un **Markdown**, avec modèle, date, identifiant de campagne et position dans leurs noms. Les contextes d’une campagne contrôlée sont regroupés dans les exports du modèle. Le dossier est exclu de Git.

**Récupérer les exports** ouvre le dossier dans le Finder sur macOS, l’Explorateur Windows ou le gestionnaire de fichiers Linux (`xdg-open`, si disponible). Si l’ouverture n’est pas disponible, ouvrez directement `export/`. Le navigateur seul ne peut pas ouvrir ce dossier : le backend local est requis. Les téléchargements manuels sont dans **Campagne → Autres exports**, et ne sont plus dans l’en-tête.

La file montre chaque étape et permet **Arrêter maintenant** (résultats partiels conservés) ou **Arrêter après ce modèle**. Par défaut, une erreur technique arrête la file ; une option permet de continuer après sauvegarde et déchargement réussis. Un critère de justesse ou une épreuve agentique échouée est un résultat, pas une erreur technique. Une sauvegarde ou un déchargement non confirmé bloque toujours le modèle suivant. En cas d’échec d’export, les données restent en mémoire : **Récupérer les exports** réessaie la sauvegarde. Ne fermez pas la page avant récupération. Les campagnes déjà exportées restent sur disque ; la file n’a pas de reprise automatique après fermeture du navigateur.

Les JSON excluent prompts, réponses, journaux et clés ; **les Markdown contiennent les prompts et réponses classiques**. Vérifiez-les avant partage. Gardez l’onglet ouvert pendant une campagne : le navigateur peut ralentir ou suspendre les tâches en arrière-plan. Le backend et Ollama doivent rester actifs. Les autres applications utilisant Ollama ne sont pas synchronisées avec la file.

## Premier lancement avec Ollama

Prérequis : Git, Python 3, un navigateur récent et Ollama. Pour le backend matériel, utilisez Node.js et npm ; Node.js **≥ 22.13.0** est requis pour SQLite (Node 22.22.3 convient).

### 1. Préparer le runner

Si Ollama est déjà installé, lancez-le puis vérifiez son API :

```bash
ollama list
curl -fsS http://localhost:11434/api/version
```

Si Ollama n’est pas installé sur votre Mac Apple Silicon, passez aux étapes 2 et 3, puis utilisez **Runners locaux → Ollama → Préparer l’installation**. Si aucun modèle n’est installé, vous pouvez utiliser le catalogue dans l’interface après les étapes 2 et 3, ou télécharger un modèle avec `ollama pull NOM_DU_MODELE`. Si vous utilisez `ollama serve`, gardez ce terminal ouvert ; ne lancez pas un second serveur si l’application Ollama fournit déjà l’API.

### 2. Télécharger le projet et lancer le backend

```bash
git clone https://github.com/DredGuer/LLM-Benchmarker.git
cd LLM-Benchmarker
npm install
npm start
```

Gardez ce terminal ouvert. Le backend écoute sur **http://localhost:3001**. Il est optionnel pour générer du texte, mais nécessaire pour l’inventaire, les mesures système et les tests agentiques décrits ici.

### 3. Servir l’interface dans un autre terminal

Depuis la racine du même dépôt :

```bash
python3 -m http.server 8001 --bind 127.0.0.1
```

Ouvrez **http://localhost:8001/llm-benchmarker.html**. Gardez aussi ce terminal ouvert. Le serveur Python fournit les fichiers de l’interface ; le backend Node fournit les mesures ; Ollama exécute le modèle. Aucun build frontend n’est nécessaire.

### 4. Lancer une campagne

1. Choisissez le runner **Ollama**. La liste des modèles est récupérée à l’initialisation et au changement de runner ; le bouton de rafraîchissement reste disponible.
2. Choisissez le modèle, ou saisissez son nom exact dans le champ personnalisé qui remplace la sélection.
3. Choisissez les catégories de prompts ou votre prompt personnalisé.
4. Vérifiez le récapitulatif du nombre de mesures, puis lancez le benchmark.

Pour un runner local, une chauffe courte précède les mesures. Les modèles cloud via Ollama ont une courte vérification séparée. Ses résultats restent visibles, mais sont exclus des statistiques. Une campagne avec les six catégories et une répétition produit normalement **1 chauffe + 6 mesures**.

## Runners : détection et installation intégrées

La carte **Runners locaux** affiche Ollama, MLX et llama.cpp. Les API restent dans la bulle repliable **Fournisseurs distants** ; LM Studio et l’endpoint personnalisé dans **Autres connexions**. Les profils existants restent compatibles. Ollama peut toujours servir de proxy cloud : endpoint local ne signifie pas nécessairement modèle local.

Au lancement, le backend vérifie les API et installations usuelles. **Installé** et **API détectée** sont distincts ; rien n’est installé ou démarré automatiquement. Si le runner manque, sélectionnez-le, cliquez sur **Préparer l’installation**, vérifiez le plan et acceptez-le, puis **Installer ce runner**. Le pilote Apple Silicon installe dans l’espace utilisateur, sans sudo ni remplacement d’une installation existante. Ollama/llama.cpp demandent Python ≥ 3.9 ; MLX demande Python arm64 ≥ 3.10 avec venv/pip et des wheels compatibles.

Après installation, cliquez sur **Démarrer le service local**. Pour MLX/llama.cpp, renseignez un modèle public Hugging Face adapté ; le démarrage peut en télécharger les poids. MLX écoute sur 8081, llama.cpp sur 8080, Ollama sur 11434. Un service déjà présent bloque un doublon. **Arrêter le service géré** ne coupe que les processus lancés par ce backend. La génération MLX est streamée ; la mémoire spécifique d’Ollama n’est pas attribuée à MLX.

Node/npm et le serveur Python de la page restent nécessaires : ce parcours n’est pas encore un paquet d’installation autonome du benchmark. Les signatures, Python, dépendances et téléchargements peuvent échouer avec un état visible ; les installateurs Linux/Windows sont reportés. [Recettes, ports, sources et limites](backend/LOCAL_RUNNERS.md).

## Trouver des modèles pour votre Mac

En Simple ou Pro, cliquez sur **Trouver des modèles pour ma machine**. Le pilote Apple Silicon analyse la RAM physique et l’espace libre du volume présumé des modèles Ollama. Le catalogue initial contient les **13 familles demandées et 30 variantes**, avec filtres famille, Dense/MoE, MLX/standard et modalités déclarées.

Les badges **vert / orange / rouge / grisé** donnent une estimation expliquée, de confiance faible, au contexte choisi. Vert indique une marge estimée ; il ne garantit ni chargement ni qualité. Modifiez le contexte et cliquez sur **Recalculer** avant de télécharger. Une architecture inconnue reste signalée ; un modèle MoE n’est pas évalué avec ses seuls paramètres actifs. MiniMax-M3 reste visible en **Cloud uniquement**, sans estimation RAM locale.

Cochez vos variantes, confirmez le **dossier présumé Ollama** affiché, puis cliquez sur **Télécharger les variantes sélectionnées**. Le backend installe dans Ollama local (`127.0.0.1:11434`) un modèle à la fois, relit les tailles du manifeste avant chaque installation et vérifie le disque. Une variante rouge exige un accord explicite. La progression est par couche ; une erreur arrête la file et les modèles déjà installés restent conservés. Vous pouvez annuler la requête active et les suivantes.

Une fois installés, choisissez les modèles dans le runner **Ollama** pour lancer votre campagne. Le catalogue ne lance pas de benchmark automatiquement : la chauffe existante confirme le chargement. Gardez Ollama et `npm start` actifs ; le scan seul ne télécharge rien. Si Ollama stocke ses modèles ailleurs, renseignez le même `OLLAMA_MODELS` pour lui et pour le backend, puis relancez-les. La déduction des couches en cache et la vitesse SSD ne sont pas mesurées.

[Formule, catalogue, sources et limites](backend/MODEL_ADVISOR.md). Les estimations restent distinctes des mesures et ne sont pas ajoutées aux exports communautaires.

## Modèles cloud via Ollama

Un modèle comme **`gemma4:cloud`** ou **`gemma4-cloud`** peut être testé via l’API de votre application Ollama locale, une fois connecté à votre compte Ollama. Choisissez-le dans la même liste ; la file peut mélanger modèles locaux et cloud. Les prompts et messages agentiques du modèle cloud partent au fournisseur, même si l’URL du proxy est `localhost`.

Le benchmark vérifie sa réponse avec une courte chauffe hors moyennes, puis exécute les catégories et répétitions demandées. Il ne lui impose ni présence dans `/api/ps`, ni déchargement local. Les cartes, statistiques et exports distinguent **client local** et **inférence distante** : RAM, matériel distant, contexte réel et cache distant restent inconnus. Un suffixe cloud est un indice de nommage ; les champs `remote_host`/`remote_model` des API Ollama apportent une provenance plus précise, sans exporter leurs adresses.

Si **Campagne contrôlée** est activée, un modèle cloud reçoit **3 répétitions à température 0, dans un seul contexte géré par le fournisseur**. Les contextes locaux A/B ne sont pas envoyés avec `num_ctx` et aucune comparaison de deux contextes n’est revendiquée. Pour les modèles locaux, les deux contextes demandés restent contrôlés et vérifiés après rechargement. Une erreur d’authentification ou de génération du fournisseur reste une erreur technique visible.

[Parcours et limites cloud/local](backend/OLLAMA_CLOUD.md) · [Documentation Ollama cloud](https://docs.ollama.com/cloud) · [Gestion du contexte Ollama](https://docs.ollama.com/context-length).

## Relancer et mettre à jour

Arrêtez le backend avec `Ctrl+C`, puis, depuis le dépôt :

```bash
git pull origin main
npm install
npm start
```

Relancez le serveur Python si nécessaire et rechargez l’interface avec **⌘⇧R** sur Mac ou **Ctrl⇧R** sous Windows/Linux. Il n’est pas nécessaire d’effacer toutes les données du navigateur pour recharger les scripts : cela pourrait supprimer votre historique.

Pour vérifier les trois services :

```bash
curl -fsS http://localhost:8001/llm-benchmarker.html
curl -fsS http://localhost:3001/api/ping
curl -fsS http://localhost:11434/api/version
curl -fsS http://localhost:3001/api/hardware
curl -fsS http://localhost:3001/api/memory
```

`/api/hardware` est actuellement réservé à macOS. Les collecteurs Apple ne sont pas exécutés sur Windows/Linux.

## Réglages et protocole

| Réglage Pro | Mode Manuel, par défaut en Pro | Mode Auto en Pro |
|---|---|---|
| Température | 0,7 ; réglages par catégorie possibles | Valeur prédéfinie par catégorie |
| Tokens maximum | **8 192** | **32 768** |
| Répétitions par catégorie | **1**, réglable de 1 à 20 | **1** |
| Contexte Ollama | Réglage du runner conservé | Réglage du runner conservé |

La limite de tokens est un plafond, pas une longueur imposée. Une réponse atteignant le plafond peut être tronquée : elle est signalée et exclue des statistiques. La raison d’arrêt du fournisseur est conservée lorsqu’elle est disponible.

Plusieurs répétitions permettent d’estimer la variabilité à conditions comparables ; elles allongent le test. Avec une seule mesure, l’écart-type reste indisponible. Une température nulle réduit l’aléatoire sans garantir une exécution reproductible.

La chauffe utilise un prompt court fixe, une température nulle et au plus 32 tokens. Pour Ollama, le thinking est désactivé pendant cette chauffe. `/api/ps` permet d’observer si le modèle était chargé ; un modèle déchargé pendant la campagne déclenche une nouvelle chauffe. Les modèles Ollama cloud reçoivent également une requête courte de vérification, hors scores ; elle ne mesure pas leur chargement distant. Les autres API externes n’ont pas de chauffe supplémentaire.

Le cache est géré par le runner et n’est pas vidé automatiquement. Des tokens réutilisés ne prouvent pas que tout le prompt est en cache. Le contexte observé du runner chargé est distinct du maximum théorique du modèle.

## Capacités agentiques dans la même campagne

Cochez **Ajouter les capacités agentiques à cette campagne**. Gardez les catégories de texte souhaitées, puis sélectionnez les épreuves agentiques : le même lancement peut tester les deux, avec une chauffe séparée. Le backend à jour est requis, ainsi qu’un modèle/template compatible avec les appels d’outils natifs sur **Ollama**, **MLX LM**, **LM Studio** ou **llama.cpp** local.

La batterie comporte six épreuves : choix/format des outils, création d’un rapport depuis des données, reprise après panne, clarification avant écriture, objectif modifié sur plusieurs tours et abstention lorsqu’aucun outil n’est nécessaire. Le modèle reçoit un **cadre système**, les schémas JSON et un objectif ; il choisit les actions. Le backend vérifie données, dépendances, états et fichiers réels.

Le suivi en direct montre attente, messages, appels, arguments, retours et vérifications. La réflexion apparaît uniquement lorsqu’elle est rapportée par le runner. Les cartes distinguent **objectif atteint**, **exécution conforme** et critères par capacité, avec traces locales repliables et téléchargement des fichiers. Les statistiques agentiques restent distinctes des courbes de génération ; tous les essais évalués comptent, échecs compris.

Gardez **1 répétition** pour vérifier le parcours, puis **3** aux mêmes réglages pour observer la variabilité. Par épreuve : **12 tours modèle, 24 appels, 4 minutes**. **Tokens max** est le budget cumulé de sortie de l’épreuve. Les seuls fichiers accessibles aux outils sont des entrées synthétiques et des sorties temporaires autorisées ; aucun shell ou document personnel. Le dialogue de clarification/changement d’objectif est scripté.

[Guide détaillé, scores et isolation](backend/AGENTIC_BENCHMARK.md) · [Recherche et limites de la méthodologie](backend/AGENTIC_METHODOLOGY.md). Ces tâches originales LLMB ne sont pas des scores officiels BFCL ou τ-bench et ne prouvent pas une autonomie générale. L’export communautaire **2.2.0** conserve scénarios et critères, et ajoute provenance, verdicts, justesse et contextes contrôlés, sans réflexion, arguments bruts ou contenu des fichiers ; les rapports 2.0.0 restent acceptés. Aucun envoi automatique n’est activé. **Exo reste reporté.**

## Lire les résultats

| Mesure | Signification et limite |
|---|---|
| Tokens générés | Comptage déclaré par le fournisseur, sinon estimation ; peut inclure la réflexion |
| Tokens/s moyen | Tokens générés / durée totale de la requête |
| Tokens/s génération | Comptage / durée de génération déclarée par Ollama, lorsque disponible |
| TTFT | Délai du premier segment reçu ; celui-ci peut appartenir au thinking |
| Premier segment de réponse finale | Délai du premier texte de réponse, après une éventuelle réflexion |
| Prefill | Durée de traitement du prompt déclarée par Ollama, en ms ; pas un débit |
| RSS cumulée | Somme des mémoires résidentes des processus Ollama suivis ; les pages partagées peuvent être comptées plusieurs fois |
| Allocation déclarée Ollama | Valeur issue de `/api/ps`, pouvant évoluer avec les caches ; pas un pic RAM ni la taille des seuls poids |
| Pic/allocations conservées MLX | Événements nouveaux des logs serveur ; attribution au modèle non vérifiée |
| Swap et mémoire compressée | Mesures du système entier, avec niveaux avant/après et pic échantillonné |
| Lectures/écritures disques | Activité système durant le test ; pas un benchmark du débit maximal du SSD |

Les mesures mémoire ne s’additionnent pas. Sur Apple Silicon, CPU et GPU partagent la RAM unifiée. La mémoire JavaScript du navigateur ne mesure pas celle d’Ollama. Une valeur absente reste inconnue, jamais artificiellement zéro.

Pour les API sans streaming, le TTFT n’est pas mesuré ; il reste indisponible dans l’export v2. Les comptes thinking/réponse séparés et la version interne de MLX ne sont pas déduits lorsqu’ils ne sont pas rapportés.

L’inventaire Apple indique CPU exact, cœurs physiques/logiques et performance/efficacité disponibles, RAM unifiée, GPU/cœurs, SSD physiques et sources. Les fréquences non exposées restent inconnues. L’inventaire et la télémétrie ont été observés sur un M3 Pro ; cela ne valide pas toutes les machines et versions.

## Lire les résultats

Chaque carte affiche quatre mesures : **TTFT**, **tokens/s sur la durée totale**, **pic de mémoire échantillonnée** et **temps total**. La mémoire conserve son libellé de source (RSS cumulée ou tas du navigateur) ; ce n’est pas une garantie de pic RAM complet. Une valeur inconnue reste `N/A`.

Dépliez **Toutes les métriques et conditions** pour les tokens générés, réponse finale, mémoire moyenne, allocation déclarée, MLX, swap, E/S, contexte et état de chargement/cache. Les critères, appels, traces et artefacts agentiques sont dans **Critères, outils et détails agentiques** ; l’objectif atteint et la conformité restent visibles. Ces volets sont fermés au départ et utilisables au clavier. Les exports et l’historique conservent les données complètes.

## Fiabilisation : provenance, verdicts et justesse

La **version au moment du test** est enregistrée par passe et distincte de la version de l’application qui exporte. Un ancien résultat sans provenance reste inconnu. Le client est le navigateur ; le moteur/backend d’inférence reste non rapporté lorsqu’aucune source ne le fournit. Une URL compatible n’est pas une preuve d’un moteur particulier.

Les cartes distinguent **exécution terminée/interrompue/erreur**, **objectif atteint**, **conformité agentique** et **justesse évaluée**. Les critères échoués apparaissent immédiatement. La phrase d’abstention distingue contenu avec apostrophes équivalentes et reproduction typographique exacte ; les anciennes évaluations ne sont pas recalculées.

Dans **Justesse et campagnes contrôlées**, activer les cas de justesse remplace les catégories Mathématiques/Logique/Code sélectionnées par **deux cas structurés par catégorie**, avec évaluateurs `llmb-duration`, `llmb-transport`, `llmb-fibonacci` version 1.0.0. Les vérifications portent sur valeurs numériques, conversions, ordre transport/traitement et sorties algorithmiques. JSON invalide et critères faux sont distingués par le détail des vérifications. Les prompts libres restent non évalués. **Aucun code généré n’est exécuté** ; Fibonacci teste ses sorties, pas la qualité d’une implémentation. Ce sont des tâches synthétiques originales, publiques, pas une mesure générale de qualité.

## Campagne contrôlée : trois répétitions et deux contextes

Disponible avec **Ollama local**. Activer **Campagne contrôlée**, choisir deux contextes distincts (8 192 et 16 384 tokens proposés), puis lancer normalement. Les catégories et les épreuves agentiques sélectionnées sont exécutées **trois fois à chaque contexte**, avec température **0** et le même plafond de sortie capturé au lancement. Le runner est déchargé via `keep_alive: 0`, son absence est vérifiée dans `/api/ps`, puis une chauffe est enregistrée à chaque contexte, hors moyennes. Cela force une nouvelle allocation du runner, sans garantir un cache système/disque vide. Un ID relie les deux séries dans l’export ; elles sont sauvegardées séparément dans l’historique et restent ensemble à l’écran. L’ordre A/B est alterné entre campagnes du navigateur, sans prétendre à une randomisation.

Le contexte demandé est transmis par `num_ctx` et comparé au contexte chargé rapporté par Ollama. Si la valeur n’est pas confirmée ou diffère, la campagne s’arrête et la passe est conservée avec son statut de vérification ; elle est exclue des comparaisons contrôlées. Le cache système/disque reste hors contrôle et le cache de prompt n’est pas déclaré réinitialisé. Le swap et les activités des autres applications peuvent varier entre séries. Ne pas utiliser les boutons de saut/reprise dans cette campagne ; un arrêt interrompt les contextes restants.

Exemple avec les trois catégories évaluées et six épreuves agentiques : `(6 cas + 6 épreuves) × 3 passes × 2 contextes = 72 mesures`, plus les chauffes. Prévoir le temps nécessaire. L’exécution réelle doit être validée sur votre machine ; les tests automatisés utilisent des réponses simulées.

## Historique et statistiques

Chaque nouvelle campagne remplace les résultats visibles. Les anciennes campagnes restent dans **Historique**, avec restauration et export. Le navigateur conserve au maximum 50 campagnes, moins si son quota impose de retirer les plus anciennes. Une sauvegarde impossible conserve la campagne courante et bloque son remplacement automatique.

Dans **Statistiques** :

- Choisissez les modèles, catégories et la mesure à afficher.
- Comparez une **moyenne ou médiane par modèle et catégorie**, en **lignes ou aires**.
- Dépliez un modèle pour sa synthèse, puis les conditions pour inclure/exclure chaque passe ou tout un groupe.
- Dépliez les graphiques du modèle : débit moyen, génération seule et prefill sur des graphiques séparés.
- Appliquez éventuellement une moyenne mobile sur 3, 5 ou 10 passes sélectionnées.
- Consultez les valeurs exactes dans les tableaux repliables ; **Tout sélectionner** réinitialise les filtres sans effacer l’historique.

Chaque passe sélectionnée a le même poids. Chauffes, erreurs et réponses limitées sont exclues. Les groupes de conditions distinguent notamment matériel, modèle/digest, runner/version, prompt, contexte, température, plafond de tokens, cache, quantification, thinking et protocole.

La moyenne globale d’un modèle peut mélanger des conditions : elle est descriptive et ne constitue pas un classement contrôlé. Le lissage ne modifie pas les moyennes récapitulatives. Le ratio tok/s par milliard de paramètres totaux ne mesure pas la qualité et ne normalise pas les paramètres actifs des MoE.

Les filtres statistiques sont conservés pendant l’utilisation de la page, sans modifier les données sauvegardées. Le résumé de la liste Historique est distinct : il exclut chauffes et erreurs, mais peut encore inclure une réponse signalée comme limitée.

## Assistant d’analyse

**Analyser les résultats** ouvre un panneau flottant. Choisissez le modèle testé ou un autre : Ollama local, OpenAI, Mistral ou API compatible OpenAI, dont LM Studio. Pour une API compatible, l’URL de base inclut `/v1`. Saisissez le nom exact ou récupérez la liste des modèles.

L’analyse démarre uniquement avec **Envoyer** ou **Écrire une conclusion**, après les tests. Analyse et benchmark ne tournent pas simultanément depuis cette interface. Utiliser un autre modèle local peut modifier la mémoire et le cache de la campagne suivante.

L’assistant consulte par défaut **tout l’historique disponible**, même sans campagne affichée, ainsi que les résultats affichés qui n’y figurent pas encore. Un sélecteur permet de choisir **la sélection des statistiques** ou **la campagne affichée**. Les tests sont dédupliqués par ID.

Tapez **@** dans la question puis choisissez un modèle testé dans les suggestions. Plusieurs mentions permettent une comparaison. Le filtre reste actif pour les questions suivantes ; **Effacer le filtre @** revient à tous les modèles du périmètre. Cette sélection concerne les résultats à lire, pas le modèle LLM qui répond, choisi séparément au-dessus. Exemple : `Compare @{gemma4:12b-MLX} avec @{qwen3.8:27b-mlx} sur le débit et le prefill` (si ces noms sont présents dans votre historique).

**Écrire une conclusion** utilise la campagne actuellement affichée : lancez ou restaurez une session pour ce bouton. Il ne réanalyse pas implicitement tout l’historique.

Les synthèses portent sur **toutes les passes du périmètre**, avec regroupement par modèle et conditions. Chauffes, erreurs et réponses limitées sont exclues des moyennes. Le contexte comprend ces synthèses, jusqu’à 100 détails récents, les réglages/matériel synthétiques, votre question et les échanges récents. Le nombre total, le nombre de mesures éligibles et la limitation des détails sont indiqués. Un contexte trop volumineux demande de réduire le périmètre, sans supprimer silencieusement des passes des moyennes. Les prompts, réponses, contenus des fichiers agentiques, arguments d’outils et logs des tests sont exclus. Les scores agentiques restent séparés des moyennes de génération. Pour une API distante, cochez l’autorisation d’envoi. La clé propre à ce panneau reste dans le champ de la page, sans sauvegarde ni export ; **Effacer échanges et clé** la retire.

Les consignes demandent une réponse courte, distinguant constats et hypothèses : un écart RSS/allocation déclarée n’est pas un overhead mesuré, et un MLX absent ne prouve pas l’absence d’accélération GPU. Ces consignes ne garantissent pas l’exactitude du modèle. Les conclusions restent consultatives, séparées des mesures et de l’export communautaire. Les accès directs dépendent des autorisations CORS du fournisseur ; aucun proxy de clés n’est intégré.

## Exports

| Export | Contenu | Usage |
|---|---|---|
| Markdown | Résumé, réglages, matériel, prompts/réponses des tests, bloc JSON v2 | Lecture et compte rendu ; vérifier avant partage |
| JSON v2 | Mesures, protocole, matériel autorisé, ressources disponibles ; sans prompts/réponses/logs/clés | Préparation du futur import communautaire |

Le nom du JSON inclut le modèle, par exemple `LLMB-hf.co-empero-ai-Qwen-Q4_K_M-community-v2-DATE.json`. Les caractères incompatibles sont remplacés. Pour plusieurs modèles, le nom reprend le premier et le nombre des autres ; le contenu reste la référence complète.

Un rapport récent utilise le schéma `llm-benchmarker.community` 2.2.0. Les historiques sans les nouveaux champs gardent un rapport 2.0.0 ou 2.1.0 selon leurs données. Des ensembles hétérogènes de runner/version/inventaire produisent un bundle 1.0.0 contenant plusieurs rapports v2. Les anciens historiques sont exportables avec leurs données manquantes explicitement inconnues.

Le futur site et l’envoi automatique ne sont pas implémentés. Voir [le contrat d’export](schemas/README.md).

## Autres runners et plateformes

Les benchmarks de génération proposent Ollama, MLX LM, LM Studio, llama.cpp, OpenAI, Mistral, Claude, Gemini et un endpoint personnalisé compatible. Les versions, noms de modèles, droits CORS et options acceptées dépendent du serveur choisi. Le backend Node suit Ollama, pas la RAM des modèles exécutés par tous ces autres runners.

L’inventaire général Windows/Linux peut détecter CPU/GPU selon les commandes disponibles. L’inventaire structuré Apple et la télémétrie swap/disques/MLX décrite ci-dessus sont réservés à macOS. Une liste de GPU détectés ne prouve pas leur utilisation simultanée. Le sélecteur GPU affiche une consigne de redémarrage manuel ; il ne reconfigure pas Ollama automatiquement.

Le batterie de capacités agentiques est intégré. Le schéma prépare aussi multi-CPU/GPU et Exo ; aucun orchestrateur distribué n’est intégré. [État et prochaines étapes](innovation.md).

## Dépannage

| Symptôme | Vérification |
|---|---|
| `Cannot find module 'express'` | Exécuter `npm install` à la racine du dépôt |
| `EADDRINUSE` sur 3001 | Un backend écoute déjà ; identifier et arrêter celui que vous souhaitez remplacer |
| API backend inaccessible | Garder `npm start` ouvert et vérifier `/api/ping` |
| Interface ancienne | Vérifier le dossier servi et recharger sans cache |
| Modèles absents | Vérifier le runner, son URL et `ollama list`, puis rafraîchir |
| Pic MLX indisponible | Le runner peut ne pas être MLX, le log manquer ou aucun nouvel événement n’être observé |
| Assistant/API indisponible | Vérifier URL, modèle, clé et autorisations CORS |
| Historique apparemment perdu | Vérifier l’origine exacte : localhost/127.0.0.1 et les ports ont des stockages distincts |

Sur Mac, identifiez le service occupant un port avec :

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:8001 -sTCP:LISTEN
```

Utilisez `Ctrl+C` dans son terminal si possible. Modifier seulement le port du backend ne reconfigure pas automatiquement l’interface. Voir [le guide backend](BACKEND_README.md).

## Documentation et contributions

- [Architecture, modules et protocole](TECHNICAL_README.md)
- [Backend, lancement et endpoints](BACKEND_README.md)
- [Inventaire Apple](backend/APPLE_INVENTORY.md)
- [Télémétrie Apple](backend/APPLE_RESOURCES.md)
- [Schémas et validation](schemas/README.md)
- [Roadmap](innovation.md)
- [Contribution : code, tests et documentation à mettre à jour ensemble](CONTRIBUTING.md)

Les captures d’écran seront ajoutées ensuite ; les commandes et comportements documentés peuvent déjà être utilisés.

## Historique durable et CRUD (v0.15.0)

Le backend enregistre désormais l’historique et les profils dans **SQLite**, indépendamment du cache du navigateur. Après la mise à jour, redémarrez `npm start`, ouvrez votre adresse habituelle et consultez le statut dans **Historique** : les anciennes données sont migrées automatiquement, leur copie navigateur est conservée.

Sur Mac : `~/Library/Application Support/LLM-Benchmarker/benchmarks.sqlite`. Chaque passe terminée est sauvegardée. Historique/statistiques/assistant lisent la base ; le backend doit rester démarré. Une erreur de sauvegarde est signalée et arrête la campagne : gardez la page ouverte pour exporter les résultats.

Dans Historique : **Modifier** (nom, notes, tags), inclusion/exclusion des passes des statistiques, **Corbeille**, restauration et suppression définitive confirmée. Les mesures originales restent intactes. Les profils Pro sont également sauvegardés dans SQLite. **Sauvegarder la base** et **Importer une sauvegarde** utilisent un JSON local complet, distinct de l’export communautaire ; import fusionné, pas remplacement. [Chemins, API, limites et tests SQLite](backend/DATABASE.md).

## Précautions d’utilisation et licence

En téléchargeant ou en utilisant LLM Benchmarker, vous reconnaissez avoir pris connaissance des informations du projet et de sa [charte d’utilisation](CHARTE_UTILISATION.md).

Les historiques et profils sont conservés dans une base SQLite locale, hors dépôt ; les clés API et préférences restent dans le navigateur. Ces données ne sont pas chiffrées par l’application. Effectuez des sauvegardes. Vérifiez les exports avant partage ; avec une API externe, les données nécessaires aux requêtes sont transmises au fournisseur choisi.

Le logiciel est proposé gratuitement sous [licence Apache 2.0](LICENSE), avec les conditions de garantie et de responsabilité qu’elle prévoit.


### Lire les verdicts et les mesures partielles

Un objectif agentique atteint ne signifie pas que tous les critères sont respectés. Une exécution peut terminer avec une conformité échouée, ou être arrêtée par un budget après production du fichier attendu. Les rapports distinguent exécution, objectif et conformité ; ils conservent les mesures disponibles sur les épreuves arrêtées. Le titre de chaque test précède désormais ses verdicts et sa version.

Le swap occupé concerne toute la machine ; les deltas de lecture/écriture indiquent séparément les échanges pendant la mesure. Ces données ne prouvent ni que le modèle en est seul responsable, ni qu’il explique un ralentissement. Les budgets et évaluateurs actuels restent inchangés. La piste des tests granulaires de contexte et capacités, avec bornes manuelles/automatiques, est consignée dans [la roadmap](innovation.md) et n’est pas encore implémentée.

## Partager vers NVNC-Tech (0.16.0)

Dans **Campagne → Autres exports**, télécharger **l’export communautaire JSON**. Dans NVNC-Tech ≥ 0.3.1, choisir ce fichier, cliquer **Vérifier le format**, puis envoyer depuis son compte. Aucune clé NVNC ni envoi automatique n’est ajouté au benchmark. Ne pas envoyer la sauvegarde SQLite locale ou le Markdown : ils peuvent contenir prompts, réponses et traces privées.

Rapports 2.0/2.1/2.2 et bundles 1.0 reconnus. Chauffe, génération, agentique, échecs et résultats partiels restent distingués ; données manquantes conservées inconnues. Le TTFT MLX natif et son inventaire local sont maintenant correctement exportés ; une API distante conserve un matériel d’inférence inconnu. Les métriques RAM Ollama ne sont pas attribuées au runner MLX natif.

Limite NVNC : 20 MiB par fichier, 32 rapports, 10 000 tests ; placements distribués/Exo et concurrence supérieure à 1 restent hors de cette étape. Un nom de modèle natif peut être importé sans fiche de catalogue ; le rapprochement catalogue doit être validé ultérieurement. [Contrat, contrôles et commandes de test](schemas/INTEROPERABILITY.md).

## Proposition de normalisation commune

La [convention de nommage du matériel et des modèles](docs/normalisation-catalogue.md) est partagée avec NVNC-Tech. Version documentaire 0.1, à valider : noms courts, formats, quantifications, alias et compatibilité avec les exports existants. Son ajout ne change pas encore les imports, les exports ou les bases.


## Noms catalogue normalisés (v0.17.0)

LLM-Benchmarker applique la [convention commune 0.1](docs/normalisation-catalogue.md) aux noms proposés dans les résultats, les métadonnées du modèle et le Markdown. Les identifiants exacts envoyés au runner restent inchangés. Les campagnes automatiques continuent de produire le JSON compatible NVNC.

Dans **Autres exports**, deux choix sont disponibles :

- **JSON compatible NVNC** : rapport 2.0/2.1/2.2 ou bundle 1.0, comme avant. Utiliser ce choix avec l’importeur NVNC actuel.
- **JSON normalisé · schéma 2.3** : noms normalisés, noms originaux, clés de rapprochement, source HF identifiable et révision si connue. Un ensemble de rapports devient un bundle 1.1. Ce format nécessite une mise à jour de l’importeur NVNC avant d’être envoyé ; aucun changement du site NVNC n’est effectué par cette mise à jour du benchmark.

Exemples : `Apple_M3Pro_36Go_12CPU_18GPU`, `Gemma4_12B_MLX_NVFP4`. La famille exacte d’un Mac et sa taille ne sont pas devinées. La taille d’un modèle vient des métadonnées déclarées, jamais du seul tag commercial ; sans donnée, le nom contient `TailleInconnue`. Le nombre total de paramètres est utilisé pour les MoE. MLX/GGUF et quantification restent distincts. Les variantes et sources conservent leur identité ; les noms ne sont pas des clés uniques certifiées.

Voir [l’implémentation et les limites](docs/normalisation-implementation.md).

### Mise à jour sur macOS

Dans le dossier du dépôt :

```bash
git pull --ff-only origin main
```

Arrêter le backend avec **Ctrl+C** dans son terminal, puis relancer :

```bash
npm start
```

Conserver le serveur de fichiers déjà lancé. S’il est arrêté, dans un autre terminal placé dans le même dossier :

```bash
python3 -m http.server 8001
```

Ouvrir `http://localhost:8001/llm-benchmarker.html`, puis recharger avec **⌘⇧R**. L’interface doit afficher **0.17.0**. La base SQLite et les résultats historiques sont conservés ; aucune migration manuelle de base n’est nécessaire.
