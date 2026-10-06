# Architecture et protocole — LLM Benchmarker

[Prise en main](README.md) · [Backend](BACKEND_README.md) · [Contrat communautaire](schemas/README.md)

État documenté le 6 octobre 2026 : interface v0.13.0, protocole de génération 0.09, exports 2.0.0/2.1.0/2.2.0 et bundle 1.0.0. La batterie `agentic-suite-2.0.1` est exécutée ; les fixtures de schéma agentiques/Exo restent synthétiques. Exo n’est pas exécuté.

## Organisation

L’application charge des scripts classiques dans l’ordre déclaré dans `llm-benchmarker.html`. Ils partagent des fonctions et un état global ; ce ne sont pas des modules ES isolés. Aucun build ni framework frontend n’est requis.

| Fichier ou dossier | Responsabilité |
|---|---|
| `llm-benchmarker.html`, `css/styles.css` | Interface, formulaires, onglets et styles ; certains styles récents sont dans le HTML |
| `js/config/` | Définitions des runners et catégories de prompts |
| `js/core/state.js`, `storage.js` | État global et utilitaires de stockage |
| `js/core/environment.js` | Environnement client, backend et inventaire |
| `js/core/runners.js` | Modèles, métadonnées autorisées et contexte Auto |
| `js/core/advancedConfig.js` | Mode Manuel/Auto, températures, répétitions et plafond de tokens |
| `js/core/protocol.js` | Observation du chargement, empreinte du prompt, flux NDJSON, contrôles et arrêt de génération |
| `js/core/agentic.js`, `agentic-stream.js`, `backend/agentic-suite.js` | Boucle native d’outils locale, budgets, fichiers restreints et vérification réelle |
| `js/core/benchmark.js` | Campagne, chauffe, mesures, requêtes fournisseurs et finalisation |
| `js/core/memory.js` | RSS, taille déclarée du modèle et sessions de télémétrie |
| `js/core/history.js` | Sauvegarde, quota, restauration et liste des campagnes |
| `js/core/apiKeys.js`, `connectivity.js` | Clés des benchmarks et vérification des connexions |
| `js/core/streaming.js` | Affichage en direct et contrôles de génération |
| `js/core/community-export.js` | Construction autorisée des rapports v2/bundles et téléchargement JSON nommé par modèle |
| `js/ui/results.js` | Cartes, rapport Markdown et bulles d’aide accessibles |
| `js/ui/statistics.js` | Regroupements, sélection de passes, moyennes et graphiques lignes/aires |
| `js/ui/analysis.js` | Assistant opt-in, contexte restreint, fournisseurs et dialogue en mémoire |
| `js/ui/`, `js/utils/`, `js/main.js` | Onglets, notifications, modales, fonctions communes et initialisation |
| `server.js`, `backend/` | API locale, inventaire Apple et télémétrie |
| `schemas/` | Contrat d’échange, exemples synthétiques, validateur et tests |

## Parcours d’une campagne

1. Vérifier modèle, catégories et répétitions ; terminer la sauvegarde en attente avant de remplacer la campagne visible.
2. Verrouiller les contrôles ; récupérer les métadonnées et la version d’Ollama lorsqu’elle est accessible.
3. Pour un runner local, observer le chargement et réaliser une chauffe mesurée séparée. Pour Ollama : prompt fixe, température 0, plafond 32, thinking désactivé.
4. Avant chaque mesure Ollama, observer le chargement ; refaire une chauffe si le modèle a été déchargé. Le cache n’est pas forcé à zéro.
5. Relever l’allocation déclarée avant la requête, commencer la télémétrie et mesurer la génération. Le flux NDJSON tolère les lignes fragmentées ; erreurs serveur et absence de confirmation finale sont traitées comme erreurs.
6. Prendre la durée de fin de génération avant la finalisation des mesures. Relever contexte/allocation, fermer la télémétrie, puis sauvegarder les résultats et libérer les contrôles, y compris sur erreur.

Une erreur de chauffe empêche les mesures suivantes. Le protocole conserve phase, empreinte SHA-256 du prompt, répétition, nombre de chauffes, chargement et cache observés. La persistance du modèle est demandée à Ollama ; elle ne garantit pas un cache identique entre passes.

## Métriques et qualification

Le débit moyen inclut le temps de la requête complète. Le débit de génération repose sur `eval_count / eval_duration` quand ces métriques sont rapportées. TTFT et premier segment de réponse finale sont distincts avec le thinking. Le prefill reste une durée ; les tokens d’entrée déclarés ne doivent pas être assimilés sans vérification à un volume intégralement traité hors cache.

`thinkingObserved` indique la présence d’un champ de réflexion observé ; il ne prouve pas un comptage séparé. Les tokens thinking/réponse et paramètres actifs restent inconnus sans données fiables. Le type Dense/MoE est issu des métadonnées, pas déduit du seul nom commercial.

`completion` conserve raison d’arrêt, état et limite atteinte. Une raison de limite explicite donne `truncated` ; un compteur déclaré atteignant le plafond donne `possibly-truncated`. Certaines autres raisons restent `unknown`. Une génération limitée est exportée comme `partial`, sans être présentée comme une réussite complète de tâche.

## Statistiques

Les passes éligibles sont dédupliquées par ID ; erreurs, chauffes et limites sont exclues. Les conditions exactes restent séparées dans `buildStatistics`. L’interface ajoute une vue descriptive par modèle au-dessus de ces groupes.

Les sélections de modèles/catégories/passes sont en mémoire de page. Les moyennes donnent le même poids à chaque passe sélectionnée, sans pondération par durée ou nombre de tokens. Médiane et écart-type d’échantillon utilisent les seules valeurs disponibles. N = 1 ne permet pas d’écart-type.

Le graphique comparatif a les catégories en abscisse ; les graphiques par modèle montrent les passes sélectionnées en ordre chronologique. Débit et durée de prefill ont des graphiques séparés. La moyenne mobile est visuelle, conserve les manques comme trous et ne modifie pas les récapitulatifs. Les tableaux donnent les valeurs numériques.

## Stockage et analyse IA

Historique et clés des benchmarks sont dans `localStorage`, propre à chaque origine. L’historique contient les réponses et prompts. Sa limite est 50 campagnes ; une saturation peut supprimer les plus anciennes. Aucun changement de format des anciennes sessions n’est fait silencieusement : l’exporteur traite leurs champs absents comme inconnus.

L’assistant collecte historique et campagne affichée, déduplique par ID et applique un périmètre : historique disponible, passes sélectionnées des statistiques ou campagne affichée. Les mentions `@nom` ou `@{nom}` filtrent les modèles testés et restent actives pour les questions suivantes jusqu’à réinitialisation. Une mention inconnue produit une explication, sans basculer silencieusement vers tous les résultats. Le modèle chargé pour répondre reste indépendant.

Les synthèses couvrent toutes les passes du périmètre et les conditions, avec exclusions explicites des chauffes/erreurs/limites pour les moyennes. Les détails sont limités aux 100 tests les plus récents ; le contexte expose les comptes et cette limitation. Une limite de taille de 180 000 caractères demande de cibler davantage les données, sans tronquer les groupes de synthèse. Le contexte utilise une liste explicite de champs, sans séries brutes, prompts/réponses de tests, logs, chemins ou clés de benchmark. `Écrire une conclusion` utilise exclusivement la campagne affichée. Il reçoit aussi la question et les échanges récents. La clé de ce panneau n’est pas persistée. L’analyse est déclenchée manuellement, autorisée explicitement pour une API distante et bloquée pendant une campagne. Le texte reçu est affiché comme texte, sans exécution HTML.

Le schéma communautaire, ses contraintes et ses limites de validation sont décrits dans [schemas/README.md](schemas/README.md). La documentation doit évoluer avec le code selon [CONTRIBUTING.md](CONTRIBUTING.md).

## Parcours agentique intégré

[Guide de la batterie](backend/AGENTIC_BENCHMARK.md) · [Méthodologie et sources](backend/AGENTIC_METHODOLOGY.md). Une case ajoute les épreuves aux catégories de génération. `runBenchmark` dispatch vers la campagne mixte lorsqu’elle est cochée : une chauffe, puis catégories et tâches par répétition, nouveaux dossiers/conversations pour chaque épreuve, historique commun et déverrouillage en `finally`. Un déchargement Ollama observé déclenche une nouvelle chauffe.

Le backend fournit objectif, message système et schémas JSON. `agentic-stream.js` assemble NDJSON/SSE fragmentés, réflexion rapportée et appels indexés ; la confirmation finale est exigée avant exécution des outils. Messages assistant et retours natifs sont préservés. Le changement d’objectif est ajouté comme message utilisateur après les réponses d’outils. Le modèle décide de la séquence ; les évaluateurs vérifient l’évidence observable, pas un raisonnement caché.

`agentic-suite.js` protège des chemins fixes, entrées en lecture seule, taille des sorties, types/arguments et budgets. Il enregistre l’évidence existant à l’écriture/soumission : une lecture après une supposition ne valide pas la dépendance. L’objectif atteint et la conformité peuvent différer. Les états locaux sont supprimés après vérification ; des traces bornées et contenus de fichiers restent dans l’historique navigateur, sans jetons/chemins temporaires.

L’export 2.1.0 ajoute scénario, critères, objectif atteint, premier outil et nombre de tours. L’exporteur et l’assistant utilisent des listes de champs, sans traces, réflexions, paramètres d’outils bruts ni contenu d’artefact. Les statistiques agentiques regroupent les mêmes conditions et affichent les taux de critères évalués ; les courbes de débit de génération excluent ces essais. Les contrats 2.0.0 et les anciennes cartes fichiers v1 restent lus.

`fetchWithTimeout` propage le signal externe ; le contrôleur global de l’épreuve couvre aussi la lecture du flux. Annulation et tour incomplet n’exécutent pas les appels non confirmés. Le compteur total de tokens reste inconnu si le dernier tour n’a pas fourni son compteur final.

Tests : `agentic-harness.test.cjs` (compatibilité v1), `agentic-suite.test.cjs` (états réels), `agentic-stream.test.cjs` (assemblage/fin de flux), `agentic-integration.test.cjs` (campagne mixte/export/AI), puis suites existantes. Réponses modèle simulées ; validation modèles/runner réels encore requise. Les restrictions fichiers sont applicatives, pas une sandbox OS. Aucun Exo n’est intégré.

### Présentation compacte des résultats (0.08)

`js/ui/results.js` affiche quatre métriques principales et regroupe les autres mesures/conditions dans un élément HTML `details` fermé par défaut. Le bilan agentique reste visible ; ses critères et traces ont leur propre volet. `css/styles.css` adapte les quatre colonnes à deux puis une sur petits écrans. Cette présentation ne modifie ni la collecte, ni les statistiques, ni les données exportées.

## Fiabilisation 0.09.0

`version.js` capture la provenance à l’exécution, indépendamment du producteur de l’export. Les résultats ajoutent `executionOutcome` et `quality`, les protocoles contrôlés ajoutent un ID, ordre, contexte demandé et validation. `community-export.js` transforme ces champs par liste autorisée vers le schéma 2.2.0, sans URL, clés, prompts, réponses ou arguments bruts.

`quality.js` définit six cas structurés et leurs évaluateurs déterministes 1.0.0. Une réponse invalide échoue, une réponse tronquée est incomplète ; les autres catégories sont non évaluées. `controlled.js` orchestre deux campagnes locales avec déchargement confirmé et rechargement par contexte, trois répétitions, température 0 et plafond stable ; les contrôles restent verrouillés, l’arrêt et un contexte non confirmé empêchent la série suivante. Les contextes 8192/16384 sont des valeurs proposées, pas une optimisation matérielle garantie. Les groupes statistiques séparent versions, cas, prompts et conditions ; la justesse reste distincte du débit.

Validation supplémentaire : `node backend/provenance-quality-controlled.test.cjs`. Les tests de campagne et adaptateurs ne remplacent pas les essais sur Ollama/MLX réels.

## Orchestration multi-modèles (0.10.0)

`js/core/batch.js` orchestre des campagnes Ollama séquentielles via les moteurs existants (`benchmark.js`, `agentic.js`, `controlled.js`). Le modèle actif est surchargé par `getSelectedModel()` sans modifier la saisie utilisateur. Les catégories et réglages restent verrouillés ; l’assistant IA et la restauration d’historique sont bloqués pendant la file. Les moteurs conservent leurs propres sessions d’historique ; le bilan affiché regroupe les modèles sans créer un deuxième historique dupliqué.

Chaque modèle local est exporté avant la demande native `/api/generate` avec `keep_alive: 0`, puis son absence est vérifiée dans `/api/ps`. Une absence invérifiable ne vaut pas déchargement. Les sauvegardes échouées retiennent un payload stable en mémoire, réessayé par le bouton de récupération ; la file s’arrête. Les modèles d’autres utilisateurs ou applications ne sont pas déchargés volontairement, et aucun processus n’est tué. Il n’y a pas de verrou inter-applications ou de garantie sur la RAM système libérée.

`buildMarkdownReport(results, now)` est partagé entre le téléchargement manuel et l’écriture locale. Les JSON utilisent le même `buildCommunityV2` que l’export manuel ; le producteur est actuellement 0.13.0, la provenance des passes reste capturée lors de leur exécution. Les formats communautaires 2.0/2.1/2.2 et bundle 1.0 ne changent pas : l’identifiant de file est dans le nom des fichiers et non ajouté au contrat communautaire. Les anciennes versions des résultats sont préservées lors d’un nouvel export.

Validation : deux nouvelles suites testent le stockage réel en dossiers temporaires, les garde-fous locaux et les boucles des moteurs avec inférence simulée, y compris les deux contextes, interruptions, erreurs, sauvegarde avant déchargement et récupération. L’ouverture Finder et l’inférence réelle seront validées sur le Mac de l’utilisateur.

## Interface partagée et profils (0.13.0)

`js/core/profiles.js` gère le niveau Simple/Pro via `body[data-interface-mode]`, les préréglages et les profils nommés. Le niveau d’interface est indépendant du mode Auto/Manuel des paramètres. Simple impose une répétition, les six catégories classiques (hors prompt personnalisé), la justesse disponible, contexte Auto et températures par défaut ; l’agentique sélectionne les six épreuves et le plafond de sortie reste réglable. Pro conserve les contrôles existants et affiche les cases multi-modèles Ollama sans panneau replié. Le bouton de lancement partagé route Simple Ollama vers une file explicite d’un modèle, Pro Ollama vers la sélection cochée, les autres fournisseurs vers le moteur normal.

Les brouillons Pro et Simple sont distincts pendant la session, avec restauration des champs au changement d’interface. Les profils sont versionnés `1.0.0` dans `llmb-campaign-profiles-v1`, au maximum 40 ; sauvegarde, remplacement et suppression explicites. L’application ayant sauvegardé le profil est renseignée séparément. Une allowlist de champs et des vérifications de bornes, runner, catégories et scénarios protègent leur restauration ; les clés API, résultats, machines et jetons ne sont jamais capturés. Une URL personnalisée est acceptée seulement en HTTP(S), sans identifiants, query ni fragment. Les prompts personnalisés restent en clair dans le stockage local.

La sélection souhaitée d’un profil est conservée pendant les chargements asynchrones de modèles. Les modèles absents sont signalés et bloquent la file ; une modification explicite des cases remplace cette sélection. Le changement de mode et les opérations de profil sont bloqués pendant les mesures ou l’analyse. `initAgenticUI()` est appelé avant `js/main.js`, qui initialise les modes et profils ; les champs agentiques doivent exister avant la capture des réglages.

Le producteur/interface est 0.13.0 ; backend 1.3.0, protocole et schémas communautaires inchangés. La suite `backend/profiles-interface.test.cjs` construit les contrôles à partir du HTML livré et vérifie démarrage, presets, sauvegarde/restauration après rechargement, commutation, modèle unique, modèles absents, données exclues et profils invalides. Ce test simule le DOM ; le rendu Safari/Chrome et l’inférence réelle restent à valider sur la machine de l’utilisateur.


## Routage cloud et contexte local (0.13.0)

`protocol.js` distingue le proxy client et l’inférence distante. `noteOllamaDeployment` conserve seulement le nom de la source API lorsqu’un champ `remote_host` ou `remote_model` est présent ; aucune adresse distante n’est stockée. `isOllamaCloud` utilise cette preuve ou, à défaut, les suffixes `:cloud`/`-cloud` explicitement qualifiés d’inférés. Le flux natif de génération et de chat peut confirmer le routage pendant la réponse. La provenance garde `inferenceEndpoint: loopback` pour le proxy et renseigne `attribution: remote-inference: …` pour l’inférence.

La présence locale, le contexte chargé et la télémétrie Ollama ne sont pas exigés pour le cloud. Les mesures locales commencées avant une détection en cours de flux sont arrêtées/nettoyées et retirées du résultat. La file n’envoie pas de demande de déchargement au cloud. La campagne contrôlée cloud devient une série Auto de trois répétitions à température 0, sans ID de comparaison de contextes ni fausse validation. Les timings du fournisseur restent déclarés ; TTFT et durée navigateur incluent le trajet au proxy et au cloud.

Pour le local, `unloadOllamaModel` vérifie une confirmation finale et l’absence dans `/api/ps` avant chaque contexte. Un contexte MLX retenu malgré ce cycle arrête les mesures suivantes et conserve la chauffe avec demandé/observé ; aucune seconde génération échouée fictive n’est créée. La file indique « partiel : contexte non confirmé ». Ce cycle ne garantit pas la remise à zéro du cache OS/disque.

`buildCommunityV2` sépare les groupes local/cloud, conserve l’inventaire du client et crée un nœud d’inférence inconnu pour le cloud, sans RSS/swap/MLX locaux. Le contrat communautaire reste 2.2.0 : seuls les champs existants sont utilisés. L’assistant IA reçoit l’attribution et un matériel distant inconnu ; les statistiques n’affichent pas le CPU client comme moteur cloud. Voir `backend/OLLAMA_CLOUD.md`. Tests dédiés : `node backend/cloud-context.test.cjs` ; tests de rechargement dans `backend/provenance-quality-controlled.test.cjs` et `backend/batch-campaign.test.cjs`.


### Rapports et mesures partielles (0.13.0)

`buildMarkdownReport` écrit le titre du test avant verdict/évaluateur/provenance. La présence de `error` seule n’identifie plus une erreur technique : une exécution terminée non conforme garde son diagnostic distinct ; un arrêt conserve ses métriques finies et son évaluation agentique. Les mesures absentes ne sont pas converties en zéro. Le JSON communautaire reste inchangé, avec version du producteur actualisée et provenance historique conservée. Le swap occupé est distingué des deltas d’échanges et reste système entier. Budgets/scénarios inchangés ; conception des balayages granulaires enregistrée dans `innovation.md`.

## Catalogue et estimateur (0.13.0)

`backend/model-catalog.json` est un instantané versionné des variantes autorisées et de leurs fiches sources. `backend/model-advisor.js` fournit une estimation à confiance faible, les instantanés RAM/espace libre et une seule file de pulls séquentiels. Le client `js/ui/model-advisor.js` partage la même interface Simple/Pro : filtres, sélection explicite, recalcul de contexte, confirmation du volume et progression par couche. Les campagnes sont verrouillées pendant l’installation ; la file n’altère pas leurs paramètres.

L’analyse ne contacte pas un catalogue externe et n’envoie pas le matériel. Le téléchargement relit un manifeste officiel à URL calculée depuis l’allowlist, réévalue le budget et appelle uniquement Ollama local. La taille publiée, la RAM estimée, la RAM mesurée et la RAM déclarée par Ollama restent des notions distinctes. Pas de consommation MoE calculée sur les seuls experts actifs. Les variantes cloud ne reçoivent pas de fausse compatibilité matérielle locale.

Application/producteur 0.13.0 et backend 1.3.0 ; catalogue/estimateur 1.0.0. Formats/protocoles inchangés et versions historiques préservées. Voir [les formules, les routes et les limites](backend/MODEL_ADVISOR.md). Deux suites dédiées testent moteur et interface avec réseau, matériel et DOM simulés ; validation réelle sur Mac encore requise.
