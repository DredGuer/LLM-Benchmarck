# LLM Benchmarker

Benchmarkez vos modèles locaux ou vos API, conservez les campagnes dans votre navigateur et comparez leurs performances sur votre machine.

**Interface v0.06 · protocole de mesure 0.08 · export communautaire v2.** Documentation vérifiée le 5 octobre 2026. Ces versions désignent des éléments différents ; la version 1.0.0 de `package.json` concerne le backend.

Fonctions actuelles : chauffe séparée, contexte Auto, identification Dense/MoE lorsqu’elle est disponible, inventaire Apple Silicon, suivi RSS/swap/MLX, exports Markdown/JSON, statistiques interactives, premier scénario agentique de fichiers et assistant d’analyse au choix. Les bulles **!** expliquent les réglages et mesures au clic, au clavier ou sur mobile.

## Premier lancement avec Ollama

Prérequis : Git, Python 3, un navigateur récent et Ollama. Pour le backend matériel, utilisez Node.js et npm ; Node.js 22 est utilisé dans le parcours testé sur Mac.

### 1. Préparer le modèle

Lancez l’application Ollama, puis vérifiez son API :

```bash
ollama list
curl -fsS http://localhost:11434/api/version
```

Si aucun modèle n’est installé, téléchargez celui que vous souhaitez tester avec `ollama pull NOM_DU_MODELE`. Si vous utilisez `ollama serve`, gardez ce terminal ouvert ; ne lancez pas un second serveur si l’application Ollama fournit déjà l’API.

### 2. Télécharger le projet et lancer le backend

```bash
git clone https://github.com/DredGuer/LLM-Benchmarck.git
cd LLM-Benchmarck
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

Pour un runner local, une chauffe courte précède les mesures. Ses résultats restent visibles, mais sont exclus des statistiques. Une campagne avec les six catégories et une répétition produit normalement **1 chauffe + 6 mesures**.

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

| Réglage | Mode Manuel, par défaut | Mode Auto |
|---|---|---|
| Température | 0,7 ; réglages par catégorie possibles | Valeur prédéfinie par catégorie |
| Tokens maximum | **8 192** | **32 768** |
| Répétitions par catégorie | **1**, réglable de 1 à 20 | **1** |
| Contexte Ollama | Réglage du runner conservé | Réglage du runner conservé |

La limite de tokens est un plafond, pas une longueur imposée. Une réponse atteignant le plafond peut être tronquée : elle est signalée et exclue des statistiques. La raison d’arrêt du fournisseur est conservée lorsqu’elle est disponible.

Plusieurs répétitions permettent d’estimer la variabilité à conditions comparables ; elles allongent le test. Avec une seule mesure, l’écart-type reste indisponible. Une température nulle réduit l’aléatoire sans garantir une exécution reproductible.

La chauffe utilise un prompt court fixe, une température nulle et au plus 32 tokens. Pour Ollama, le thinking est désactivé pendant cette chauffe. `/api/ps` permet d’observer si le modèle était chargé ; un modèle déchargé pendant la campagne déclenche une nouvelle chauffe. Aucune chauffe supplémentaire n’est envoyée aux API externes.

Le cache est géré par le runner et n’est pas vidé automatiquement. Des tokens réutilisés ne prouvent pas que tout le prompt est en cache. Le contexte observé du runner chargé est distinct du maximum théorique du modèle.

## Benchmark agentique · fichiers

Choisissez **Type de benchmark → Agentique · fichiers (v1)**, puis un modèle local avec appels d’outils natifs (**Ollama**, **LM Studio** ou **llama.cpp**). Le backend `npm start` doit être à jour et lancé. Les API externes et Exo restent pour une étape ultérieure.

Après une chauffe séparée, le modèle doit calculer, créer un dossier, écrire un Markdown et le relire dans un répertoire temporaire dédié. Le backend contrôle les actions et le fichier réel : déclarer « fichier créé » ne suffit pas. Aucun shell ni accès aux documents personnels n’est proposé par les outils.

Gardez **1 répétition** pour démarrer ; **3 répétitions** permettent de mieux voir la variabilité. Chaque tentative a ses propres fichiers et un budget de **8 tours modèle, 12 appels d’outils et 3 minutes**. Dans ce mode, **Tokens max** est le plafond cumulé des sorties, avec un comptage estimé si le runner ne fournit pas de compteur. Le bouton **Arrêter le test agentique** permet d’interrompre la campagne.

Les cartes montrent réussite/échec, étapes repliables et reprises après rejet. Téléchargez le Markdown créé depuis la carte avant de quitter si vous souhaitez le conserver ; son texte est aussi sauvegardé dans l’historique local. Le dossier temporaire est supprimé après vérification. Les statistiques agentiques sont séparées des courbes de génération, avec les échecs dans le taux de réussite. **TTFT non mesuré** dans ce scénario non streaming ; le temps total couvre la tâche complète, outils compris. Un seul scénario de fichiers ne suffit pas à évaluer toutes les capacités agentiques.

[Scénario, isolation, mesures et tests détaillés](backend/AGENTIC_BENCHMARK.md). L’export **JSON v2** inclut étapes, budgets, scores et empreinte du fichier, sans son contenu ni arguments bruts. Aucun envoi automatique n’est activé.

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

Un rapport homogène utilise le schéma `llm-benchmarker.community` 2.0.0. Des ensembles hétérogènes de runner/version/inventaire produisent un bundle 1.0.0 contenant plusieurs rapports v2. Les anciens historiques sont exportables avec leurs données manquantes explicitement inconnues.

Le futur site et l’envoi automatique ne sont pas implémentés. Voir [le contrat d’export](schemas/README.md).

## Autres runners et plateformes

Les benchmarks de génération proposent Ollama, LM Studio, llama.cpp, OpenAI, Mistral, Claude, Gemini et un endpoint personnalisé compatible. Les versions, noms de modèles, droits CORS et options acceptées dépendent du serveur choisi. Le backend Node suit Ollama, pas la RAM des modèles exécutés par tous ces autres runners.

L’inventaire général Windows/Linux peut détecter CPU/GPU selon les commandes disponibles. L’inventaire structuré Apple et la télémétrie swap/disques/MLX décrite ci-dessus sont réservés à macOS. Une liste de GPU détectés ne prouve pas leur utilisation simultanée. Le sélecteur GPU affiche une consigne de redémarrage manuel ; il ne reconfigure pas Ollama automatiquement.

Le premier scénario agentique de fichiers est intégré. Le schéma prépare aussi multi-CPU/GPU et Exo ; aucun orchestrateur distribué n’est intégré. [État et prochaines étapes](innovation.md).

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

## Précautions d’utilisation et licence

En téléchargeant ou en utilisant LLM Benchmarker, vous reconnaissez avoir pris connaissance des informations du projet et de sa [charte d’utilisation](CHARTE_UTILISATION.md).

Les tests, historiques et clés API sauvegardées pour les benchmarks sont conservés dans le navigateur et peuvent être accessibles en clair. Le stockage local ne garantit pas leur sauvegarde. Vérifiez les exports avant partage ; avec une API externe, les données nécessaires aux requêtes sont transmises au fournisseur choisi.

Le logiciel est proposé gratuitement sous [licence Apache 2.0](LICENSE), avec les conditions de garantie et de responsabilité qu’elle prévoit.
