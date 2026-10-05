# Architecture et protocole — LLM Benchmarker

[Prise en main](README.md) · [Backend](BACKEND_README.md) · [Contrat communautaire](schemas/README.md)

État documenté le 5 octobre 2026 : interface v0.06, protocole de génération 0.08, export 2.0.0 et bundle 1.0.0. Les exemples agentiques/Exo sont synthétiques et ne prouvent pas l’existence d’un exécuteur.

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
