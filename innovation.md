# État du projet et roadmap

[Prise en main](README.md) · [Architecture](TECHNICAL_README.md) · [Contrat d’export](schemas/README.md)

Mise à jour : **6 octobre 2026**. Ce document distingue les fonctions exécutées aujourd’hui des possibilités décrites par le schéma. Il remplace les anciennes affirmations de prise en charge exhaustive multi-GPU.

## Fonctionnement actuel

| Domaine | État |
|---|---|
| Génération locale et API | Interface multi-runner ; options et accès dépendants du serveur |
| Protocole 0.09 | Chauffe séparée, 1 répétition par défaut, limites de sortie, contexte Auto, chargement/cache observés |
| Inventaire Apple Silicon | CPU/cœurs, RAM unifiée, GPU/cœurs, disques physiques et provenance ; observé sur un M3 Pro |
| Mémoire Ollama | RSS cumulée et allocation déclarée ; mesures distinctes |
| Télémétrie macOS | Swap/compression avant/après, deltas disque, nouveaux événements MLX peak/held si disponibles |
| Exports | Markdown et JSON communautaire v2 ; nom JSON comprenant le modèle |
| Statistiques | Sélection des modèles/catégories/passes, moyennes/médianes, détails repliables, lignes/aires, lissage et prefill |
| Assistant IA | Conclusion et questions à la demande ; modèle local ou API choisi indépendamment |
| Capacités agentiques 2.0.1 | Six épreuves dans les campagnes, cadre système/outils, streaming observé, critères d’état, objectif/conformité séparés, export 2.2 ; premières campagnes réelles examinées |
| Aide | Bulles ! au clic, au clavier et sur mobile |
| Détection Windows/Linux | Collecteurs généraux existants ; couverture dépendante des commandes/pilotes, validation réelle à étendre |

L’inventaire d’un GPU ne démontre pas qu’il participe à l’inférence. Le sélecteur présent dans l’interface peut conseiller un redémarrage manuel via `CUDA_VISIBLE_DEVICES` ; il ne relance ni ne reconfigure automatiquement Ollama et ne certifie pas le placement réel.

## Prochaine validation

1. Comparer **2 ou 3 modèles** sur le même Mac, mêmes catégories et réglages, avec **3 répétitions**.
2. Examiner débit, prefill, cache, swap et mémoire avant/après ; distinguer variation normale et accumulation à investiguer.
3. Vérifier que les conclusions de l’assistant restent fidèles aux chiffres et signalent les inconnues.

La présence de mémoire conservée ne prouve pas une fuite. Une API externe ne fournit pas les ressources de son serveur via l’inventaire local du client.

## Étapes suivantes

| Étape | Objectif | Critère de validation |
|---|---|---|
| Qualité des campagnes | Conditions de cache/chargement et répétitions documentées, diagnostic des dérives | Résultats sur machine réelle, inconnues conservées |
| Import communautaire manuel | Charger des exports v2, dédupliquer les ID de tests et comparer les conditions | Validation du schéma, limites de taille, unités et cohérence |
| Site communautaire | Comparaison de machines/modèles équivalents et gestion des données partagées | Parcours de consultation/import et règles de données explicites |
| Envoi automatique | Envoi à la demande avec aperçu et autorisation adaptée au futur service | Pas d’envoi implicite, authentification et protection côté serveur |
| Extension agentique | Ajouter des tâches et évaluateurs après validation du batterie 2.0 | Versions de tâches, critères reproductibles et sécurité adaptée à chaque outil |
| Exo / plusieurs Mac | Inventaire par nœud, modèle distribué, placements et liens observés | Adaptateur validé sur un cluster réel ; pas de somme naïve des débits |
| Linux/Windows et multi-GPU | Inventaire structuré et VRAM/activité par appareil selon source | Tests sur matériel réel NVIDIA/AMD/Intel et sources explicites |
| SSD/offload | Attribuer les lectures/placements lorsque le runner l’expose | L’activité disque seule ne suffit pas à conclure à un offload |

## Ce qui est préparé, sans exécution actuelle

Le schéma v2 décrit plusieurs CPU/GPU/nœuds, des placements demandés et observés, des liens et des tâches agentiques. Les fixtures Apple-agentic, Exo et Linux-multigpu sont **synthétiques**. Elles valident un contrat, pas une collecte complète ni un orchestrateur déjà disponible.

Chaque étape sera intégrée progressivement avec ses tests et sa documentation. Les captures du README viendront après la remise à jour documentaire. Voir [la règle de contribution](CONTRIBUTING.md).

## Ordre retenu

1. Tester le [ensemble d’épreuves agentiques](backend/AGENTIC_BENCHMARK.md) sur le Mac avec des modèles compatibles, 1 passe puis 3 répétitions ; contrôler critères, traces réelles, étapes et export 2.1.
2. Passer au site communautaire : import manuel v2, validation/déduplication, comparaisons à conditions équivalentes, scores agentiques séparés par tâche/version.
3. Prévoir ensuite l’envoi explicite authentifié avec aperçu des données et règles du service.

**Exo est reporté.** Aucun détecteur, adaptateur ni synchronisation multi-machine n’est ajouté par l’étape agentique. Sa déclaration et sa topologie devront être étudiées séparément avec un cluster réel.


## À concevoir : campagnes granulaires à bornes réglables

Demande du 6 octobre 2026, enregistrée après les campagnes cloud et MLX de l’interface 0.12.0. **Piste de conception, non implémentée**. Garder Simple minimal ; réserver les axes et budgets configurables au mode Pro, avec presets sauvegardables et estimation du nombre de passes avant lancement.

### Contexte : distinguer deux axes

- **Fenêtre allouée au runner** : minimum/maximum/pas ou liste explicite, par exemple 4 000 → 16 000 → 30 000 tokens. En Manuel, laisser choisir les bornes ; en Auto, proposer une série compatible avec le maximum déclaré sans prétendre connaître la capacité mémoire réelle.
- **Longueur réellement fournie au modèle** : préparer des prompts de longueur tokenisée et un budget de sortie contrôlés. Augmenter `num_ctx` seul ne remplit pas le contexte et ne mesure pas la qualité sur longues entrées.
- Vérifier séparément longueur du prompt, contexte demandé et contexte observé ; un compteur estimé reste qualifié d’estimé. Les valeurs arrondies/ignorées par le runner sont signalées, jamais assimilées à celles demandées. Cloud : ne pas prétendre régler un contexte distant non exposé par l’API.
- Maintenir mêmes tâches, température, plafond de sortie et répétitions ; ne varier qu’un axe à la fois. Chauffer chaque condition, documenter le cycle de déchargement et les limites du cache, équilibrer l’ordre et garder l’horodatage de chaque passe.
- Prévoir plafonds de temps, nombre de conditions, longueur d’entrée et sortie, arrêt/annulation et reprise des conditions déjà exportées. Auto ne doit pas remplir la RAM jusqu’à l’échec sans limites annoncées. Un échec mémoire doit rester un résultat de condition, pas disparaître de la synthèse.
- Comparer TTFT, prefill, génération, justesse, mémoire par source, swap occupé **et** deltas d’échanges, disque et dispersion ; ne pas déduire une causalité du swap système. Exporter la définition versionnée du balayage, ses bornes, l’ordre et les conditions effectivement exécutées ; adapter le contrat communautaire avant implémentation si nécessaire.

### Agentique : comprendre où la chaîne échoue

Conserver la batterie stricte actuelle (12 tours, 24 appels, 4 minutes). Concevoir une batterie étendue distincte/versionnée et des sous-épreuves : choix d’outil, arguments, création du dossier, écriture, relecture, récupération, clarification et conclusion. Ne pas relever silencieusement un budget ni renoter l’historique. Comparer objectif atteint, conformité, tours/appels consommés et motif d’arrêt, notamment lorsque la dernière relecture épuise le budget avant la conclusion.

### Critères avant implementation

Tester les bornes et pas invalides, les séries reproductibles, le comptage réel/estimé, les plafonds déclarés, l’arrêt après une condition, les contextes non confirmés et les exports partiels. Valider d’abord une petite série sur Apple Silicon ; distinguer ensuite autres runners, APIs distantes et futurs clusters Exo. L’import communautaire devra séparer balayage de fenêtre, longueur d’entrée et budget agentique, pour éviter les moyennes de conditions incompatibles.
