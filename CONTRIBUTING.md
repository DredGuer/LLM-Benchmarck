# Contribuer à LLM Benchmarker

[README](README.md) · [Architecture](TECHNICAL_README.md) · [Roadmap](innovation.md)

## Code et documentation font partie de la même modification

**Toute modification validée doit mettre à jour la documentation concernée dans la même livraison.** Si une modification ne change aucun comportement, commande, champ ou limite documenté, expliquer pourquoi dans sa description. Cette règle de revue ne constitue pas un contrôle CI automatisé.

Avant de considérer une modification terminée :

1. Décrire le problème, le comportement obtenu et les limites restantes.
2. Mettre à jour les commandes et réglages du README si le parcours utilisateur change.
3. Mettre à jour les sources, unités, portées, endpoints et limites dans les guides techniques concernés.
4. Modifier schéma, exporteur, exemples et tests ensemble si le contrat évolue ; conserver les inconnues des anciens historiques.
5. Vérifier les liens internes et les exemples de commandes ; retirer les chemins personnels et secrets.
6. Documenter ce qui a été testé réellement et ce qui repose sur des fixtures simulées.
7. Mettre à jour la roadmap pour distinguer livré, préparé et prévu.

## Où documenter

| Modification | Documentation |
|---|---|
| Démarrage, réglages, résultats, aide | [README.md](README.md) |
| Modules, chauffe, cache, statistiques, analyse | [TECHNICAL_README.md](TECHNICAL_README.md) |
| API backend et réseau | [BACKEND_README.md](BACKEND_README.md) |
| Matériel Apple et provenance | [backend/APPLE_INVENTORY.md](backend/APPLE_INVENTORY.md) |
| Swap, disque, MLX et ressources | [backend/APPLE_RESOURCES.md](backend/APPLE_RESOURCES.md) |
| Format d’échange | [schemas/README.md](schemas/README.md) et schémas |
| Flux de données et précautions | [CHARTE_UTILISATION.md](CHARTE_UTILISATION.md) |
| Fonctionnalité future ou changement de priorité | [innovation.md](innovation.md) |

## Vérifications disponibles

Depuis la racine du dépôt :

```bash
node backend/apple-inventory.test.cjs
node backend/apple-resources.test.cjs
node backend/model-metadata.test.cjs
node backend/monitor-integration.test.cjs
node backend/community-export.test.cjs
node backend/protocol-statistics.test.cjs
node backend/reliability-analysis.test.cjs
node backend/analysis-history.test.cjs
node backend/statistics-selection.test.cjs
node backend/agentic-harness.test.cjs
node backend/agentic-integration.test.cjs
node backend/agentic-suite.test.cjs
node backend/agentic-stream.test.cjs
node schemas/test.cjs
```

Les tests utilisent des sorties système et des réponses fournisseurs simulées. Ils ne certifient pas tous les matériels macOS/Windows/Linux, les connexions API réelles ni le rendu sur tous les navigateurs. Exécuter les suites adaptées au changement ; une modification documentaire seule demande surtout de vérifier les commandes, liens et concordance avec le code.

Pour valider un rapport reçu :

```bash
node schemas/validate.cjs schemas/examples/apple-generation.json
```

Le validateur interne couvre les mots-clés employés et des contraintes métier ; un futur importeur de production devra employer une validation Draft 2020-12 complète et des contrôles de données.

## Principes de mesure

Ne pas remplacer une absence par zéro, ne pas additionner RAM unifiée et capacité GPU du même pool, ne pas confondre RSS/allocation déclarée/pic MLX. Une détection matérielle n’est pas une preuve de placement ; une lecture disque n’est pas une preuve d’offload. Ne pas inférer la qualité d’une réponse à partir du débit.

Séparer données brutes locales et profil communautaire autorisé. Ne pas exporter clés, logs, chemins personnels, numéros de série ou prompts/réponses dans le profil JSON v2.

## Captures d’écran

Utiliser des données de démonstration sans secrets, stocker les images dans un dossier du dépôt et les référencer avec des chemins relatifs dans le README. Ajouter un texte alternatif décrivant l’écran. Les captures complètent les instructions ; elles ne remplacent pas les commandes ni les descriptions accessibles.

Pour les tâches agentiques, conserver un scénario versionné, des outils explicitement limités, des budgets et une vérification backend indépendante des déclarations du modèle. Documenter toute évolution des capacités fichiers/réseau/shell. Le taux de réussite inclut les tentatives évaluées en échec ; ne pas mélanger ces essais aux courbes de génération.

Toute nouvelle épreuve doit avoir un ID/version, un objectif sans recette d’appels imposée, un cadre système/protocole documenté et un évaluateur d’état indépendant. Tester au moins réussite, échec, dépendances causales observables et absence d’effet sur un tour tronqué. Ne jamais revendiquer un score officiel de benchmark externe pour les tâches LLMB originales. Les réflexions et appels bruts restent dans le journal local, sans export communautaire.

## Versions et changelog

À chaque modification implémentée et validée, augmenter la version de l’application dans `js/core/version.js` et actualiser les guides concernés et `CHANGELOG.md` (date, ajouts, corrections, limites et validation). La version de l’application est centralisée dans `js/core/version.js` ; mettre à jour les libellés de secours HTML, les paramètres de cache des scripts modifiés et les guides à chaque nouvelle version. Employer désormais des versions applicatives à trois composantes depuis 0.09.0 : incrémenter la composante corrective pour une correction compatible, la composante mineure pour une fonctionnalité, 1.0.0 pour la première version stable ou un changement incompatible. Ne pas renommer rétroactivement les versions 0.06/0.07/0.08. Les versions du backend (`package.json`), des protocoles, scénarios et schémas restent indépendantes. Ne pas réécrire les versions des résultats historiques ou des fixtures.

Les nouveaux résultats doivent préserver la version au moment de la mesure, distincte de l’export. Les nouveaux évaluateurs exigent ID/version, cas variés, critères déterministes et tests positifs/négatifs. Les campagnes contrôlées doivent vérifier le contexte observé, conserver les échecs et ne pas revendiquer un cache remis à zéro sans preuve. Exécuter aussi `node backend/provenance-quality-controlled.test.cjs`.

Les campagnes automatiques et exports locaux sont couverts par `node backend/batch-campaign.test.cjs` et `node backend/local-exports.test.cjs`. Conserver l’ordre sauvegarde → déchargement confirmé → modèle suivant, les versions capturées lors des tests et les chemins calculés côté serveur. Les fichiers du dossier `export/` ne doivent pas être committés.

Le mode d’interface Simple/Pro est distinct du mode de génération Auto/Manuel. Toute évolution des champs de campagne doit actualiser la capture, validation et restauration de `js/core/profiles.js`, ainsi que `backend/profiles-interface.test.cjs`. Les profils ne doivent pas copier clés API, résultats, inventaires ou jetons ; conserver les réglages Pro lors des passages en Simple et signaler les modèles manquants avant tout lancement.


Distinguer endpoint client et lieu de l’inférence : une URL localhost Ollama peut proxyfier le cloud. Ne jamais imposer des mesures RAM ou un contexte chargé localement à ce parcours, ni attribuer le matériel client au moteur distant. Tester noms cloud, aliases déclarés par API, erreurs fournisseur et exports avec `node backend/cloud-context.test.cjs`. Le déchargement confirmé reste exigé pour les modèles locaux, y compris avant chaque contexte contrôlé ; il ne prouve pas un cache système vide.

## Catalogue et estimation

Toute évolution du catalogue doit vérifier les fiches officielles, conserver sources/date, augmenter sa version et laisser les architectures ou capacités incertaines comme inconnues. Ne pas confondre téléchargement, estimation, chargement réel et mesure. Le MoE exige tous les poids pour l’estimation ; aucune prédiction de qualité ou débit sans validation. Les pulls restent explicitement sélectionnés, limités à l’allowlist et au serveur Ollama local. Tester les budgets, les erreurs, la concurrence, l’annulation, la provenance disque et les contrôles d’origine/jeton : `node backend/model-advisor.test.cjs` et `node backend/model-advisor-ui.test.cjs`.
