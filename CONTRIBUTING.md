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
